import { Automation, Issue, Project } from './models';
import { STATUSES } from '../lib/statuses';

const TARGET_IDS = STATUSES.map((s) => s.id).join(',');
const byId = new Map(STATUSES.map((s) => [s.id, s]));

/** Where each old workflow status goes in the shared status set. */
function mapStatus(old: { id: string; category?: string }, projectType: string): string {
  if (old.id === 'done' && projectType === 'service_desk') return 'resolved'; // service desk "done" was named "Resolved"
  if (byId.has(old.id)) return old.id;
  if (old.id === 'review' || old.id === 'qa') return 'progress';
  if (old.id === 'customer') return 'hold';
  return old.category === 'done' ? 'done' : old.category === 'inprogress' ? 'progress' : 'todo';
}

/**
 * Idempotent migration: moves every project onto the shared STATUSES list and re-points its
 * issues, WIP limits and status-based automation rules. Projects already on the shared list
 * are skipped, so running this on every server start is cheap.
 */
export async function migrateStatuses(): Promise<{ total: number; migrated: number }> {
  const projects = await Project.find({}).select('type statuses wip').lean<any[]>();
  let migrated = 0;
  for (const p of projects) if (await ensureProjectStatuses(p)) migrated++;
  return { total: projects.length, migrated };
}

/** True when a project still has an old status list. */
export const needsStatusMigration = (p: { statuses?: { id: string }[] }) => (p.statuses || []).map((s) => s.id).join(',') !== TARGET_IDS;

/**
 * Converts ONE project (given as a lean document with _id, type, statuses, wip) if it still has an
 * old status list, and updates the passed object in place so the caller sees the new statuses.
 * Returns true if it converted anything.
 */
export async function ensureProjectStatuses(p: any): Promise<boolean> {
  if (!p || !needsStatusMigration(p)) return false;
  {
    const old: any[] = p.statuses || [];
    const mapping = new Map(old.map((s) => [s.id, mapStatus(s, p.type)]));
    // Issues: move status ids that changed, then make every issue's category match its status.
    // (No old id maps onto another old id that is itself remapped, so the order doesn't matter.)
    for (const [from, to] of mapping) if (from !== to) await Issue.updateMany({ projectId: p._id, status: from }, { $set: { status: to } });
    for (const s of STATUSES) await Issue.updateMany({ projectId: p._id, status: s.id, statusCategory: { $ne: s.category } }, { $set: { statusCategory: s.category } });

    // WIP limits: keep limits whose column still exists (first one wins when columns merge).
    const wip: Record<string, number> = {};
    const oldWip = p.wip instanceof Map ? Object.fromEntries(p.wip) : (p.wip || {});
    for (const [from, limit] of Object.entries(oldWip)) { const to = mapping.get(from) ?? from; if (byId.has(to) && wip[to] === undefined) wip[to] = Number(limit); }

    await Project.updateOne({ _id: p._id }, { $set: { statuses: STATUSES, wip } });

    // Automation rules that match on a status (stored as either the id or the display name).
    const rules = await Automation.find({ projectId: p._id, conditionField: 'status' }).select('conditionValue').lean<any[]>();
    for (const r of rules) {
      const v = String(r.conditionValue ?? '').toLowerCase();
      const hit = old.find((s) => s.id.toLowerCase() === v || String(s.name).toLowerCase() === v);
      if (hit) await Automation.updateOne({ _id: r._id }, { $set: { conditionValue: mapStatus(hit, p.type) } });
    }
    p.statuses = STATUSES; p.wip = wip;
  }
  return true;
}
