import { route } from '@/server/api';
import { orgIssueTypes, orgStatuses } from '@/server/masters';
import { orgRoles } from '@/server/access';

/** The active Issue Type / Status masters of the caller's organization — what "Create issue" and the issue pickers offer. */
export const GET = route(async (_req, { user }) => {
  if (!user.orgId) return { types: [], statuses: [], roles: [] };
  const [types, statuses, roles] = await Promise.all([orgIssueTypes(user.orgId), orgStatuses(user.orgId), orgRoles(user.orgId)]);
  return { types, statuses, roles };
});
