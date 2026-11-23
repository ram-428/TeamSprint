import { z } from 'zod';
import { route, AppError } from '@/server/api';
import { SavedFilter } from '@/server/models';
import { parse, OqlError } from '@/server/oql';

export const GET = route(async (_req, { user }) => SavedFilter.find({ orgId: user.orgId, $or: [{ ownerId: user.id }, { shared: true }] }).sort({ name: 1 }).lean());

const schema = z.object({ name: z.string().trim().min(2).max(60), oql: z.string().max(1000), shared: z.boolean().optional() });
export const POST = route(async (req, { user }) => {
  const b = schema.parse(await req.json());
  try { parse(b.oql); } catch (e) { if (e instanceof OqlError) throw new AppError(400, 'OQL', e.message); throw e; }
  return SavedFilter.create({ ...b, orgId: user.orgId, ownerId: user.id });
});

export const DELETE = route(async (req, { user }) => {
  const id = new URL(req.url).searchParams.get('id');
  const r = await SavedFilter.deleteOne({ _id: id, ownerId: user.id });
  if (!r.deletedCount) throw new AppError(404, 'NOT_FOUND', 'Filter not found');
  return { done: true };
});
