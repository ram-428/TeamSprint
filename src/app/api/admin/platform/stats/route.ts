import { route, forbidden } from '@/server/api';
import { Org, User, Project, Issue, Audit } from '@/server/models';
import mongoose from 'mongoose';

export const GET = route(async (_req, { user }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const since = new Date(Date.now() - 864e5);
  const [orgs, users, projects, issues, failedLogins, recent, signups, activeDay] = await Promise.all([
    Org.countDocuments(), User.countDocuments(), Project.countDocuments({ archived: false }), Issue.countDocuments({ deletedAt: null }),
    Audit.countDocuments({ action: 'auth.locked', createdAt: { $gte: since } }),
    Audit.find({}).sort({ createdAt: -1 }).limit(12).lean<any[]>(),
    User.find({}).sort({ createdAt: -1 }).limit(5).select('name email createdAt color').lean<any[]>(),
    User.countDocuments({ lastLoginAt: { $gte: since } }),
  ]);
  const days = [];
  for (let d = 13; d >= 0; d--) {
    const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - d);
    const e = new Date(+s + 864e5);
    days.push({ day: s.toISOString().slice(5, 10), logins: await Audit.countDocuments({ action: 'auth.login', createdAt: { $gte: s, $lt: e } }), issues: await Issue.countDocuments({ createdAt: { $gte: s, $lt: e } }) });
  }
  const actors = await User.find({ _id: { $in: recent.map((r) => r.actorId) } }).select('name').lean<any[]>();
  return {
    totals: { orgs, users, projects, issues, failedLogins, activeDay },
    days, signups,
    recent: recent.map((r) => ({ ...r, actor: actors.find((a) => String(a._id) === String(r.actorId))?.name || 'System' })),
    health: { db: mongoose.connection.readyState === 1 ? 'connected' : 'down', uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576), node: process.version },
  };
});
