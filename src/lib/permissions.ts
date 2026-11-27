/**
 * Jira-style permission model, shared by server and client.
 * - Project roles: an org-level master list (Administrator, Developer, … + custom ones). Project members hold one role each.
 * - Permission schemes: per org; each project uses one (or the org's default). A scheme is a list of grants
 *   "permission → holder", where the holder is a project role (optionally "only on their own issues") or the project lead.
 */
export type PermDef = { key: string; label: string; help: string; group: string; ownable?: boolean };

export const PERMISSIONS: PermDef[] = [
  { group: 'Project', key: 'project.view', label: 'Browse project', help: 'See the project, its issues, board and reports' },
  { group: 'Project', key: 'project.edit', label: 'Edit project details', help: 'Name, description, lead and linked teams' },
  { group: 'Project', key: 'project.manage_members', label: 'Manage members', help: 'Add or remove people and change their project role' },
  { group: 'Project', key: 'project.manage_workflow', label: 'Manage workflow', help: 'Change the project workflow settings' },
  { group: 'Project', key: 'project.manage_automation', label: 'Manage automation', help: 'Create, edit and delete automation rules' },
  { group: 'Issues', key: 'issue.create', label: 'Create issues', help: 'Create work items in the project' },
  { group: 'Issues', key: 'issue.edit_any', label: 'Edit issues', help: 'Change fields, sprint, epic and rank', ownable: true },
  { group: 'Issues', key: 'issue.transition', label: 'Transition issues', help: 'Move issues between statuses', ownable: true },
  { group: 'Issues', key: 'issue.assign', label: 'Assign issues', help: 'Change the assignee' },
  { group: 'Issues', key: 'issue.delete_any', label: 'Delete issues', help: 'Delete work items', ownable: true },
  { group: 'Comments & time', key: 'comment.add', label: 'Add comments', help: 'Comment on issues' },
  { group: 'Comments & time', key: 'comment.delete_any', label: 'Delete any comment', help: 'Remove other people’s comments' },
  { group: 'Comments & time', key: 'worklog.add', label: 'Log work', help: 'Record time spent' },
  { group: 'Planning', key: 'sprint.manage', label: 'Manage sprints', help: 'Create, start, complete and delete sprints' },
  { group: 'Planning', key: 'board.manage', label: 'Manage board', help: 'Column WIP limits and board settings' },
];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export type RoleDef = { key: string; name: string; description: string; system: boolean };
/** Built-in roles. Keys match the values already stored in Project.members[].role. */
export const DEFAULT_ROLES: RoleDef[] = [
  { key: 'project_admin', name: 'Administrator', description: 'Full control of the project', system: true },
  { key: 'developer', name: 'Developer', description: 'Plans and delivers work', system: true },
  { key: 'tester', name: 'Tester', description: 'Works and verifies issues', system: true },
  { key: 'reporter', name: 'Reporter', description: 'Raises issues and edits their own', system: true },
  { key: 'viewer', name: 'Viewer', description: 'Read-only access', system: true },
];
/** The role that always has every permission and that every project must keep at least one of. */
export const ADMIN_ROLE = 'project_admin';

export type Holder = 'role' | 'lead';
export type Grant = { perm: string; holder: Holder; value?: string; own?: boolean };

/** The original fixed rules, as grants — new orgs (and existing ones) start from exactly this. */
const OLD: Record<string, string[]> = {
  project_admin: PERMISSION_KEYS,
  developer: ['project.view', 'issue.create', 'issue.edit_any', 'issue.assign', 'issue.transition', 'comment.add', 'worklog.add', 'sprint.manage', 'board.manage'],
  tester: ['project.view', 'issue.create', 'issue.edit_any', 'issue.assign', 'issue.transition', 'comment.add', 'worklog.add'],
  reporter: ['project.view', 'issue.create', 'comment.add'],
  viewer: ['project.view'],
};
export const DEFAULT_GRANTS: Grant[] = [
  ...Object.entries(OLD).flatMap(([role, perms]) => perms.map((perm) => ({ perm, holder: 'role' as const, value: role }))),
  { perm: 'issue.edit_any', holder: 'role', value: 'reporter', own: true },
  { perm: 'issue.transition', holder: 'role', value: 'reporter', own: true },
];
