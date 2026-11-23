import { z } from 'zod';
import { route, AppError } from '@/server/api';
import { Goal, User } from '@/server/models';

export const GET = route(async (_req, { user }) => {
  const goals = await Goal.find({ orgId: user.orgId }).sort({ createdAt: -1 }).lean<any[]>();
  const owners = await User.find({ _id: { $in: goals.map((g) => g.ownerId) } }).select('name color').lean<any[]>();
  return goals.map((g) => {
    const pct = g.keyResults.length ? Math.round(g.keyResults.reduce((a: number, k: any) => a + Math.min(1, (k.current || 0) / (k.target || 1)), 0) / g.keyResults.length * 100) : 0;
    return { ...g, progress: pct, owner: owners.find((o) => String(o._id) === String(g.ownerId)) };
  });
});

const schema = z.object({
  title: z.string().trim().min(3).max(120), period: z.string().default('Q4'),
  keyResults: z.array(z.object({ title: z.string().min(2), target: z.number().positive(), current: z.number().min(0).default(0), unit: z.string().default('') })).min(1, 'Add at least one key result'),
});
export const POST = route(async (req, { user }) => {
  if (user.role === 'guest') throw new AppError(403, 'FORBIDDEN', 'Guests cannot create goals');
  const b = schema.parse(await req.json());
  return Goal.create({ ...b, orgId: user.orgId, ownerId: user.id });
});

export const PATCH = route(async (req, { user }) => {
  const b = z.object({ id: z.string(), status: z.enum(['on_track', 'at_risk', 'off_track']).optional(), krIndex: z.number().optional(), current: z.number().min(0).optional() }).parse(await req.json());
  const g = await Goal.findOne({ _id: b.id, orgId: user.orgId });
  if (!g) throw new AppError(404, 'NOT_FOUND', 'Goal not found');
  if (String(g.ownerId) !== user.id && user.role !== 'org_admin') throw new AppError(403, 'FORBIDDEN', 'Only the owner can update this goal');
  if (b.status) g.status = b.status;
  if (b.krIndex !== undefined && b.current !== undefined && g.keyResults[b.krIndex]) g.keyResults[b.krIndex].current = b.current;
  await g.save();
  return { done: true };
});
