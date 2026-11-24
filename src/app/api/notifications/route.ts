import { route } from '@/server/api';
import { Notification, User } from '@/server/models';

export const GET = route(async (req, { user }) => {
  const sp = new URL(req.url).searchParams;
  const filter: any = { userId: user.id };
  if (sp.get('unread') === '1') filter.readAt = null;
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(Number(sp.get('limit') || 50)).lean<any[]>();
  const actors = await User.find({ _id: { $in: items.map((i) => i.actorId).filter(Boolean) } }).select('name color avatarUrl').lean<any[]>();
  return {
    unread: await Notification.countDocuments({ userId: user.id, readAt: null }),
    items: items.map((i) => ({ ...i, actor: actors.find((a) => String(a._id) === String(i.actorId)) })),
  };
});

export const POST = route(async (req, { user }) => {
  const b = await req.json();
  if (b.all) await Notification.updateMany({ userId: user.id, readAt: null }, { readAt: new Date() });
  else if (b.id) await Notification.updateOne({ _id: b.id, userId: user.id }, { readAt: new Date() });
  return { done: true };
});
