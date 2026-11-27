import { ProjectRoleMaster, PermissionScheme } from './models';
import { DEFAULT_GRANTS, DEFAULT_ROLES } from '../lib/permissions';
import { ACCESS_TTL_MS, compile, getOrgAccess, invalidateAccess, setOrgAccess } from './accessCache';

const dupOk = (e: any) => { if (e?.code !== 11000 && !e?.writeErrors?.every?.((w: any) => w.code === 11000)) throw e; };

/** Creates the built-in roles and a "Default permission scheme" (the original rules) for an org that has none. */
export async function ensureAccessMasters(orgId: any) {
  const [r, s] = await Promise.all([ProjectRoleMaster.exists({ orgId }), PermissionScheme.exists({ orgId })]);
  const ops: Promise<unknown>[] = [];
  if (!r) ops.push(ProjectRoleMaster.bulkWrite(DEFAULT_ROLES.map((d, order) => ({ updateOne: { filter: { orgId, key: d.key }, update: { $setOnInsert: { ...d, order } }, upsert: true } }))).catch(dupOk));
  if (!s) ops.push(PermissionScheme.updateOne({ orgId, isDefault: true }, { $setOnInsert: { name: 'Default permission scheme', description: 'Used by every project that has no scheme of its own', grants: DEFAULT_GRANTS } }, { upsert: true }));
  await Promise.all(ops);
}

/** Loads (or refreshes after the TTL) the org's permission schemes into the cache `can()` reads. */
export async function loadAccess(orgId?: string | null, force = false) {
  if (!orgId) return;
  const cur = getOrgAccess(orgId);
  if (!force && cur && Date.now() - cur.at < ACCESS_TTL_MS) return;
  await ensureAccessMasters(orgId);
  const schemes = await PermissionScheme.find({ orgId }).lean<any[]>();
  const def = schemes.find((x) => x.isDefault) || schemes[0];
  setOrgAccess(orgId, { at: Date.now(), defaultId: def ? String(def._id) : null, schemes: new Map(schemes.map((x) => [String(x._id), compile(x.grants || [])])) });
}

/** After an admin changes roles or schemes: drop the cache and reload it for this request. */
export async function reloadAccess(orgId: string) { invalidateAccess(orgId); await loadAccess(orgId, true); }

export async function orgRoles(orgId: any) {
  await ensureAccessMasters(orgId);
  return ProjectRoleMaster.find({ orgId }).sort({ order: 1, _id: 1 }).select('-_id key name description system order').lean<any[]>();
}
