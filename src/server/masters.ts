import { IssueTypeMaster, StatusMaster } from './models';
import { STATUSES, type StatusDef } from '../lib/statuses';
import { DEFAULT_ISSUE_TYPES } from '../lib/issueTypes';

import { z } from 'zod';
import { AppError } from './api';

export const kindOf = (k: string): 'types' | 'statuses' => {
  if (k !== 'types' && k !== 'statuses') throw new AppError(404, 'NOT_FOUND', 'Unknown master');
  return k;
};
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'item';
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour');
export const nameSchema = z.string().trim().min(2, 'Name needs at least 2 characters').max(40, 'Keep the name under 40 characters');

export type TypeDef = { key: string; name: string; color: string; system: boolean; active: boolean; order: number };

/** Seeds an organization's master lists with the built-in defaults the first time they are needed. Safe to call concurrently. */
export async function ensureMasters(orgId: any): Promise<void> {
  const [t, s] = await Promise.all([IssueTypeMaster.exists({ orgId }), StatusMaster.exists({ orgId })]);
  const ops: Promise<unknown>[] = [];
  if (!t) ops.push(IssueTypeMaster.bulkWrite(DEFAULT_ISSUE_TYPES.map((d, order) => ({ updateOne: { filter: { orgId, key: d.key }, update: { $setOnInsert: { ...d, active: true, order } }, upsert: true } }))));
  if (!s) ops.push(StatusMaster.bulkWrite(STATUSES.map((d, order) => ({ updateOne: { filter: { orgId, id: d.id }, update: { $setOnInsert: { ...d, active: true, order } }, upsert: true } }))));
  // A concurrent request may seed the same rows first; that duplicate-key error (11000) is harmless.
  await Promise.all(ops.map((p) => p.catch((e: any) => { if (e?.code !== 11000 && !e?.writeErrors?.every?.((w: any) => w.code === 11000)) throw e; })));
  if (t) await ensureSystemTypes(orgId);
}

const systemTypesChecked = new Set<string>();
/**
 * Organizations created before a type became built-in (e.g. Bug) keep it as an ordinary, removable type.
 * Once per org per server process: (re)create every built-in type that is missing, mark it built-in and active.
 * Names and colours the admin chose are kept.
 */
async function ensureSystemTypes(orgId: any) {
  const k = String(orgId); if (systemTypesChecked.has(k)) return;
  const sys = DEFAULT_ISSUE_TYPES.filter((d) => d.system);
  const res = await IssueTypeMaster.bulkWrite(sys.map((d, i) => ({ updateOne: {
    filter: { orgId, key: d.key },
    update: { $set: { system: true, active: true }, $setOnInsert: { name: d.name, color: d.color, order: 1000 + i } },
    upsert: true,
  } }))).catch((e: any) => { if (e?.code !== 11000 && !e?.writeErrors?.every?.((w: any) => w.code === 11000)) throw e; return null; });
  // Defaults that are no longer built-in (e.g. Subtask) become ordinary, editable types for existing orgs too.
  const nonSys = DEFAULT_ISSUE_TYPES.filter((d) => !d.system).map((d) => d.key);
  if (nonSys.length) await IssueTypeMaster.updateMany({ orgId, key: { $in: nonSys }, system: true }, { $set: { system: false } });
  if (res) systemTypesChecked.add(k);
}

export async function orgIssueTypes(orgId: any, opts: { all?: boolean } = {}): Promise<TypeDef[]> {
  await ensureMasters(orgId);
  return IssueTypeMaster.find({ orgId, ...(opts.all ? {} : { active: true }) }).sort({ order: 1, _id: 1 }).select('-_id key name color system active order').lean<TypeDef[]>();
}

export async function orgStatuses(orgId: any, opts: { all?: boolean } = {}): Promise<(StatusDef & { active: boolean; order: number })[]> {
  await ensureMasters(orgId);
  return StatusMaster.find({ orgId, ...(opts.all ? {} : { active: true }) }).sort({ order: 1, _id: 1 }).select('-_id id name category color active order').lean<any[]>();
}

/** Replaces a (lean) project's status list with the organization's active status master, in place. */
export async function applyMasters<T extends { orgId?: any; statuses?: any }>(project: T): Promise<T> {
  if (!project?.orgId) return project;
  const list = await orgStatuses(project.orgId);
  if (list.length) project.statuses = list.map(({ id, name, category, color }) => ({ id, name, category, color }));
  return project;
}

/** Keys of the issue types that can currently be used on new/edited issues. */
export async function activeTypeKeys(orgId: any): Promise<string[]> {
  return (await orgIssueTypes(orgId)).map((t) => t.key);
}
