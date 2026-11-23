import { route } from '@/server/api';
import { Issue, Project, User } from '@/server/models';
import { visibleProjectIds } from '@/server/query';
import { can } from '@/server/rbac';

/** Global search for the command palette: issues, projects, people. */
export const GET = route(async (req, { user }) => {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (!q) return { issues: [], projects: [], people: [] };
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const pids = await visibleProjectIds(user);
  const [issues, projects, people] = await Promise.all([
    Issue.find({ deletedAt: null, projectId: { $in: pids }, $or: [{ key: re }, { summary: re }] }).sort({ updatedAt: -1 }).limit(8).select('key summary type status statusCategory priority').lean<any[]>(),
    Project.find({ _id: { $in: pids }, $or: [{ key: re }, { name: re }] }).limit(5).select('key name color').lean<any[]>(),
    user.orgId ? User.find({ orgId: user.orgId, status: 'active', $or: [{ name: re }, { email: re }] }).limit(5).select('name email color title').lean<any[]>() : [],
  ]);
  void can;
  return { issues, projects, people };
});
