import { route } from '@/server/api';
import { Issue, User, Project, Sprint, Team } from '@/server/models';
import { oqlQuery } from '@/server/query';
import { orgIssueTypes, orgStatuses } from '@/server/masters';

/** Hard cap so one export stays fast and memory-safe; the response says when it was cut. */
const MAX_ROWS = 5000;

const COLUMNS = ['Key', 'Summary', 'Work type', 'Status', 'Priority', 'Project', 'Assignee', 'Reporter', 'Epic', 'Sprint', 'Team', 'Labels', 'Components', 'Fix version', 'Story points', 'Original estimate (h)', 'Time spent (h)', 'Due date', 'Created', 'Updated', 'Resolved', 'Resolution'] as const;

/** RFC 4180 quoting, plus a leading ' on values Excel would run as a formula (CSV injection). */
function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const day = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const stamp = (d?: Date) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '');
const hours = (sec?: number) => (sec ? Math.round((sec / 3600) * 100) / 100 : '');

/**
 * Exports the issues matching an OQL query (the same query the Filters page runs) as a CSV file.
 * Only issues in projects the caller can view are included.
 */
export const GET = route(async (req, { user }) => {
  const oql = new URL(req.url).searchParams.get('oql') ?? '';
  const { filter, sort } = await oqlQuery(user, oql);
  const items = await Issue.find(filter)
    .select('key summary type status priority projectId assigneeId reporterId epicId sprintId teamId labels components fixVersion points estimate timeSpent dueDate createdAt updatedAt resolvedAt resolution')
    .sort(sort).limit(MAX_ROWS + 1).lean<any[]>();
  const truncated = items.length > MAX_ROWS; if (truncated) items.length = MAX_ROWS;

  // Resolve every referenced id in one query per collection (no per-row lookups).
  const ids = (f: string) => [...new Set(items.map((i) => i[f]).filter(Boolean).map(String))];
  const [users, projects, sprints, epics, teams, types, statuses] = await Promise.all([
    User.find({ _id: { $in: [...new Set([...ids('assigneeId'), ...ids('reporterId')])] } }).select('name').lean<any[]>(),
    Project.find({ _id: { $in: ids('projectId') } }).select('key name').lean<any[]>(),
    Sprint.find({ _id: { $in: ids('sprintId') } }).select('name').lean<any[]>(),
    Issue.find({ _id: { $in: ids('epicId') } }).select('key summary').lean<any[]>(),
    Team.find({ _id: { $in: ids('teamId') } }).select('name').lean<any[]>(),
    user.orgId ? orgIssueTypes(user.orgId, { all: true }) : Promise.resolve([]),
    user.orgId ? orgStatuses(user.orgId, { all: true }) : Promise.resolve([]),
  ]);
  const by = <T extends { _id: any }>(list: T[]) => new Map(list.map((x) => [String(x._id), x]));
  const U = by(users), P = by(projects), S = by(sprints), E = by(epics), T = by(teams);
  const typeName = new Map((types as any[]).map((t) => [t.key, t.name]));
  const statusName = new Map((statuses as any[]).map((s) => [s.id, s.name]));
  const name = (m: Map<string, any>, id: any, f = 'name') => (id ? m.get(String(id))?.[f] ?? '' : '');

  const rows = items.map((i) => [
    i.key, i.summary, typeName.get(i.type) ?? i.type, statusName.get(i.status) ?? i.status, i.priority,
    name(P, i.projectId, 'key'), name(U, i.assigneeId) || 'Unassigned', name(U, i.reporterId),
    i.epicId ? `${name(E, i.epicId, 'key')} ${name(E, i.epicId, 'summary')}`.trim() : '', name(S, i.sprintId), name(T, i.teamId),
    (i.labels || []).join(', '), (i.components || []).join(', '), i.fixVersion ?? '', i.points ?? '',
    hours(i.estimate), hours(i.timeSpent), day(i.dueDate), stamp(i.createdAt), stamp(i.updatedAt), stamp(i.resolvedAt), i.resolution ?? '',
  ].map(cell).join(','));

  // BOM so Excel opens UTF-8 (names, emoji, non-Latin text) correctly.
  const csv = '﻿' + [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
  const file = `team-sprint-issues-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file}"`, 'Cache-Control': 'no-store',
    'X-Export-Rows': String(items.length), 'X-Export-Truncated': String(truncated),
  } });
});
