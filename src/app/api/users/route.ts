import { route } from '@/server/api';
import { User, Project } from '@/server/models';
import { can } from '@/server/rbac';

/** Org directory (used by assignee pickers, mentions, member management). `?project=KEY` limits to users who can be assigned. */
export const GET = route(async (req, { user }) => {
  const sp = new URL(req.url).searchParams;
  const users = await User.find({ orgId: user.orgId, status: 'active' }).select('name email color title role avatarUrl').sort({ name: 1 }).lean<any[]>();
  const key = sp.get('project');
  if (key) {
    const p = await Project.findOne({ orgId: user.orgId, key: key.toUpperCase() }).lean<any>();
    if (p) return users.filter((u) => can({ id: String(u._id), orgId: user.orgId, role: u.role, platformRole: 'user' } as any, 'issue.create', p));
  }
  const q = sp.get('q')?.toLowerCase();
  return q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.includes(q)) : users;
});
