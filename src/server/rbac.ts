import type { AuthUser } from './auth';
import { ADMIN_ROLE, DEFAULT_ROLES, PERMISSION_KEYS } from '../lib/permissions';
import { schemeFor } from './accessCache';

/** Role keys every org starts with. Orgs may add custom roles (ProjectRoleMaster); members store the role key. */
export type ProjectRole = string;
export const PROJECT_ROLES = DEFAULT_ROLES.map((r) => r.key);

export type ProjectLike = { visibility?: string; members?: { userId: any; role: string }[]; orgId?: any; leadId?: any; permissionSchemeId?: any };

export function projectRole(u: AuthUser, p: ProjectLike): ProjectRole | null {
  if (!u.orgId || String(p.orgId) !== u.orgId) return null;
  if (u.role === 'org_admin') return ADMIN_ROLE;
  // Everyone else (members, guests) only sees projects they have been explicitly added to.
  const m = p.members?.find((x) => String(x.userId) === u.id);
  return m ? m.role : null;
}

/**
 * Central permission check, driven by the project's permission scheme (Jira-style).
 * `owns` = the user reported / is assigned the target issue, which unlocks "own issues only" grants.
 * Org admins hold the Administrator role in every project, and that role always has every permission.
 */
export function can(u: AuthUser, perm: string, p?: ProjectLike, owns = false): boolean {
  if (perm.startsWith('platform.')) return u.platformRole === 'super_admin';
  if (perm.startsWith('org.')) return !!u.orgId && u.role === 'org_admin';
  if (!p) return false;
  const r = projectRole(u, p);
  if (!r) return false;
  if (r === ADMIN_ROLE) return true;
  const g = schemeFor(String(p.orgId), p.permissionSchemeId ? String(p.permissionSchemeId) : null).get(perm);
  if (!g) return false;
  if (g.roles.has(r)) return true;
  if (owns && g.ownRoles.has(r)) return true;
  if (g.lead && p.leadId && String(p.leadId) === u.id) return true;
  return false;
}

/** What the UI may show for a project (per-issue "own" rights are resolved on the issue itself). */
export function abilities(u: AuthUser, p: ProjectLike) {
  const r = projectRole(u, p);
  return { role: r, ...Object.fromEntries(PERMISSION_KEYS.map((k) => [k, can(u, k, p, true)])) } as Record<string, any>;
}
