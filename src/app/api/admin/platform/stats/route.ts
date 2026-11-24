import { route, forbidden } from '@/server/api';
import { Org, User, Project, Issue, Audit } from '@/server/models';
import mongoose from 'mongoose';

/** Optional ?orgId=<id|none> narrows every figure to a single organization. */
const orgScope = (v: string | null) => (v === 'none' ? { orgId: null } : v && /^[a-f0-9]{24}$/i.test(v) ? { orgId: new mongoose.Types.ObjectId(v) } : {});

export const GET = route(async (req, { user }) => {
  if (user.platformRole !== 'super_admin') throw forbidden();
  const sc: any = orgScope(new URL(req.url).searchParams.get('orgId')); const scoped = Object.keys(sc).length > 0;
  const since = new Date(Date.now() - 864e5);
  const [orgs, users, projects, issues, failedLogins, recent, signups, activeDay] = await Promise.all([
    scoped ? (sc.orgId ? 1 : 0) : Org.countDocuments(), User.countDocuments(sc), Project.countDocuments({ ...sc, archived: false }), Issue.countDocuments({ ...sc, deletedAt: null }),
    Audit.countDocuments({ ...sc, action: 'auth.locked', createdAt: { $gte: since } }),
    Audit.find(sc).sort({ createdAt: -1 }).limit(12).lean<any[]>(),
    User.find(sc).sort({ createdAt: -1 }).limit(5).select('name email createdAt color').lean<any[]>(),
    User.countDocuments({ ...sc, lastLoginAt: { $gte: since } }),
  ]);
  const days = [];
  for (let d = 13; d >= 0; d--) {
    const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - d);
    const e = new Date(+s + 864e5);
    days.push({ day: s.toISOString().slice(5, 10), logins: await Audit.countDocuments({ ...sc, action: 'auth.login', createdAt: { $gte: s, $lt: e } }), issues: await Issue.countDocuments({ ...sc, createdAt: { $gte: s, $lt: e } }) });
  }
  const actors = await User.find({ _id: { $in: recent.map((r) => r.actorId) } }).select('name').lean<any[]>();
  return {
    totals: { orgs, users, projects, issues, failedLogins, activeDay },
    days, signups,
    recent: recent.map((r) => ({ ...r, actor: actors.find((a) => String(a._id) === String(r.actorId))?.name || 'System' })),
    health: { db: mongoose.connection.readyState === 1 ? 'connected' : 'down', uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576), node: process.version },
  };
});
