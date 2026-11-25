import { route } from '@/server/api';
import { orgIssueTypes, orgStatuses } from '@/server/masters';

/** The active Issue Type / Status masters of the caller's organization — what "Create issue" and the issue pickers offer. */
export const GET = route(async (_req, { user }) => {
  if (!user.orgId) return { types: [], statuses: [] };
  const [types, statuses] = await Promise.all([orgIssueTypes(user.orgId), orgStatuses(user.orgId)]);
  return { types, statuses };
});
