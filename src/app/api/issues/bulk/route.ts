import { z } from 'zod';
import { route } from '@/server/api';
import { loadIssue, applyIssueUpdate, requirePerm } from '@/server/domain';

const schema = z.object({
  keys: z.array(z.string()).min(1).max(200),
  patch: z.object({ status: z.string().optional(), assigneeId: z.string().nullable().optional(), priority: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']).optional(), sprintId: z.string().nullable().optional(), labels: z.array(z.string()).optional() }),
  delete: z.boolean().optional(),
});

export const POST = route(async (req, { user }) => {
  const b = schema.parse(await req.json());
  const results: { key: string; ok: boolean; error?: string }[] = [];
  for (const key of b.keys) {
    try {
      const { issue, project } = await loadIssue(user, key);
      if (b.delete) { requirePerm(user, 'issue.delete_any', project); issue.deletedAt = new Date(); await issue.save(); }
      else { requirePerm(user, 'issue.edit_any', project, String(issue.reporterId) === user.id); await applyIssueUpdate(user, issue, project, b.patch); }
      results.push({ key, ok: true });
    } catch (e: any) { results.push({ key, ok: false, error: e.message }); }
  }
  return { results, succeeded: results.filter((r) => r.ok).length };
});
