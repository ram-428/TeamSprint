import type { AuthUser } from './auth';

export const PERMS = {
  project_admin: ['project.view', 'project.edit', 'project.manage_members', 'project.manage_workflow', 'project.manage_automation',
    'issue.create', 'issue.edit_any', 'issue.delete_any', 'issue.assign', 'issue.transition', 'comment.add', 'comment.delete_any',
    'worklog.add', 'sprint.manage', 'board.manage'],
  developer: ['project.view', 'issue.create', 'issue.edit_any', 'issue.assign', 'issue.transition', 'comment.add', 'worklog.add', 'sprint.manage', 'board.manage'],
  reporter: ['project.view', 'issue.create', 'issue.edit_own', 'issue.transition_own', 'comment.add'],
  viewer: ['project.view'],
} as const satisfies Record<string, readonly string[]>;

export type ProjectRole = keyof typeof PERMS;
export const PROJECT_ROLES = Object.keys(PERMS) as ProjectRole[];

export type ProjectLike = { visibility?: string; members?: { userId: any; role: string }[]; orgId?: any };

export function projectRole(u: AuthUser, p: ProjectLike): ProjectRole | null {
  if (u.platformRole === 'super_admin') return 'project_admin';
  if (!u.orgId || String(p.orgId) !== u.orgId) return null;
  if (u.role === 'org_admin') return 'project_admin';
  const m = p.members?.find((x) => String(x.userId) === u.id);
  if (m) return m.role as ProjectRole;
  if (p.visibility === 'org' && u.role === 'member') return 'viewer';
  return null;
}

/** Central permission check. `owns` = the user reported/owns the target resource. */
export function can(u: AuthUser, perm: string, p?: ProjectLike, owns = false): boolean {
  if (perm.startsWith('platform.')) return u.platformRole === 'super_admin';
  if (perm.startsWith('org.')) return u.role === 'org_admin' || u.platformRole === 'super_admin';
  if (!p) return false;
  const r = projectRole(u, p);
  if (!r) return false;
  const set = PERMS[r] as readonly string[];
  if (set.includes(perm)) return true;
  if (owns && perm === 'issue.edit_any' && set.includes('issue.edit_own')) return true;
  if (owns && perm === 'issue.transition' && set.includes('issue.transition_own')) return true;
  return false;
}

export function abilities(u: AuthUser, p: ProjectLike) {
  const r = projectRole(u, p);
  const set = new Set<string>(r ? (PERMS[r] as readonly string[]) : []);
  return { role: r, ...Object.fromEntries(['project.edit', 'project.manage_members', 'issue.create', 'issue.edit_any', 'issue.delete_any', 'issue.assign', 'issue.transition', 'comment.add', 'worklog.add', 'sprint.manage', 'board.manage', 'project.manage_workflow', 'project.manage_automation'].map((k) => [k, set.has(k) || (k === 'issue.edit_any' && set.has('issue.edit_own')) || (k === 'issue.transition' && set.has('issue.transition_own'))])) } as Record<string, any>;
}
