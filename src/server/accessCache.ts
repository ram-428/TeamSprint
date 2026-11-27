import { DEFAULT_GRANTS, type Grant } from '../lib/permissions';

/**
 * In-memory permission schemes per organization, so `can()` can stay synchronous.
 * `loadAccess()` (src/server/access.ts) fills this from the database at the start of each API request;
 * when an org has nothing loaded, the built-in default rules apply.
 */
export type CompiledGrant = { roles: Set<string>; ownRoles: Set<string>; lead: boolean };
export type Compiled = Map<string, CompiledGrant>;
export type OrgAccess = { at: number; defaultId: string | null; schemes: Map<string, Compiled> };

const cache = new Map<string, OrgAccess>();
export const ACCESS_TTL_MS = 15_000;

export function compile(grants: Grant[]): Compiled {
  const m: Compiled = new Map();
  for (const g of grants) {
    let c = m.get(g.perm); if (!c) { c = { roles: new Set(), ownRoles: new Set(), lead: false }; m.set(g.perm, c); }
    if (g.holder === 'lead') c.lead = true;
    else if (g.holder === 'role' && g.value) (g.own ? c.ownRoles : c.roles).add(g.value);
  }
  return m;
}
export const BUILT_IN: Compiled = compile(DEFAULT_GRANTS);

export function setOrgAccess(orgId: string, a: OrgAccess) { cache.set(orgId, a); }
export function getOrgAccess(orgId: string) { return cache.get(orgId); }
export function invalidateAccess(orgId: string) { cache.delete(String(orgId)); }

/** The compiled scheme a project uses: its own, else the org default, else the built-in rules. */
export function schemeFor(orgId: string, schemeId?: string | null): Compiled {
  const a = cache.get(orgId);
  if (!a) return BUILT_IN;
  return (schemeId && a.schemes.get(schemeId)) || (a.defaultId && a.schemes.get(a.defaultId)) || BUILT_IN;
}
