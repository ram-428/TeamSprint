import { z } from 'zod';
import { route, AppError } from '@/server/api';
import { cleanAttachments } from '@/server/cloudinary';
import { Issue } from '@/server/models';
import { loadProject, createIssue } from '@/server/domain';
import { hydrate, runOql, visibleProjectIds } from '@/server/query';

export const GET = route(async (req, { user }) => {
  const sp = new URL(req.url).searchParams;
  const oql = sp.get('oql');
  if (oql !== null) return runOql(user, oql, { limit: Number(sp.get('limit') || 100), skip: Number(sp.get('skip') || 0) });
  const filter: any = { deletedAt: null };
  const projectKey = sp.get('project');
  if (projectKey) filter.projectId = (await loadProject(user, projectKey))._id;
  else filter.projectId = { $in: await visibleProjectIds(user) };
  const sprint = sp.get('sprint');
  if (sprint === 'none') filter.sprintId = null; else if (sprint) filter.sprintId = sprint;
  if (sp.get('assignee') === 'me') filter.assigneeId = user.id; else if (sp.get('assignee')) filter.assigneeId = sp.get('assignee');
  if (sp.get('type')) filter.type = sp.get('type');
  if (sp.get('epic')) filter.epicId = sp.get('epic');
  if (sp.get('parent')) filter.parentId = sp.get('parent');
  if (sp.get('category')) filter.statusCategory = sp.get('category');
  const items = await Issue.find(filter).select('-description -watchers -votes -orgId -attachments').sort({ rank: 1 }).limit(1000).lean<any[]>();
  return { items: await hydrate(items), total: items.length };
});

const schema = z.object({
  project: z.string(), type: z.string().trim().min(1).max(40).default('task'), // validated against the org's Issue Type master in createIssue
  summary: z.string().trim().min(3, 'Title needs at least 3 characters').max(200),
  description: z.string().max(20000).optional(), priority: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']).default('Medium'),
  assigneeId: z.string().nullish(), labels: z.array(z.string()).optional(), components: z.array(z.string()).optional(), fixVersion: z.string().optional(),
  epicId: z.string().nullish(), parentId: z.string().nullish(), sprintId: z.string().nullish(), points: z.number().min(0).max(100).nullish(),
  attachments: z.array(z.any()).max(20).optional(), estimate: z.number().min(0).nullish(), dueDate: z.string().nullish(), startDate: z.string().nullish(), status: z.string().optional(),
});

export const POST = route(async (req, { user }) => {
  const d = schema.parse(await req.json());
  const project = await loadProject(user, d.project);
  if (project.archived) throw new Error('archived');
  let attachments: any[] = [];
  if (d.attachments?.length) { try { attachments = cleanAttachments(d.attachments, String(project.orgId), user.id); } catch { throw new AppError(400, 'BAD_ATTACHMENT', 'One of the files could not be attached'); } }
  const issue = await createIssue(user, project, {
    ...d, attachments, assigneeId: d.assigneeId || undefined, epicId: d.epicId || undefined, parentId: d.parentId || undefined, sprintId: d.sprintId || undefined,
    points: d.points ?? undefined, estimate: d.estimate ?? undefined, dueDate: d.dueDate ? new Date(d.dueDate) : undefined, startDate: d.startDate ? new Date(d.startDate) : undefined,
  });
  return { key: issue.key, _id: issue._id };
});
