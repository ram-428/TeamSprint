import { describe, it, expect } from 'vitest';
import { parse, compile, OqlError } from '../src/server/oql';
import { parseDuration } from '../src/server/time';
import { can, projectRole } from '../src/server/rbac';
import { parseCapture } from '../src/lib/capture';
import { mdToHtml } from '../src/lib/md';

const r: any = { userId: 'aaaaaaaaaaaaaaaaaaaaaaaa', user: async () => 'u2', project: async () => 'p1', sprint: async () => ['s1'] };

describe('OQL', () => {
  it('parses a filter without ORDER BY', async () => {
    const { filter } = await compile(parse('type = bug'), r);
    expect((filter.type as RegExp).test('bug')).toBe(true);
  });
  it('supports AND/OR/NOT, IN, IS EMPTY, ORDER BY', async () => {
    const q = parse('status IN ("QA","Done") AND (priority >= High OR assignee IS EMPTY) ORDER BY created DESC');
    const { filter, sort } = await compile(q, r);
    expect(filter.$and).toBeTruthy(); expect(sort).toEqual({ createdAt: -1 });
  });
  it('priority comparison expands to a set', async () => {
    const { filter } = await compile(parse('priority >= High'), r);
    expect(filter.priority.$in).toEqual(['High', 'Highest']);
  });
  it('rejects unknown fields and operator injection', async () => {
    await expect(compile(parse('foo = 1'), r)).rejects.toThrow(OqlError);
    expect(() => parse('status = {"$ne":1}')).toThrow(OqlError);
  });
  it('currentUser() resolves to the caller', async () => {
    const { filter } = await compile(parse('assignee = currentUser()'), r);
    expect(filter.assigneeId.$in).toEqual(['aaaaaaaaaaaaaaaaaaaaaaaa']);
  });
});

describe('helpers', () => {
  it('parses durations', () => { expect(parseDuration('1h 30m')).toBe(5400); expect(parseDuration('1d')).toBe(28800); expect(parseDuration('abc')).toBeNull(); });
  it('quick capture', () => { const c = parseCapture('Fix login @sara !high #auth ^5 /bug'); expect(c).toMatchObject({ summary: 'Fix login', priority: 'High', labels: ['auth'], assigneeQuery: 'sara', points: 5, type: 'bug' }); });
  it('markdown escapes HTML', () => { expect(mdToHtml('<script>alert(1)</script>')).not.toContain('<script>'); });
});

describe('RBAC', () => {
  const base = { orgId: 'o1', visibility: 'org', members: [{ userId: 'dev', role: 'developer' }, { userId: 'rep', role: 'reporter' }, { userId: 'adm', role: 'project_admin' }] };
  const u = (id: string, role = 'member', platformRole = 'user', orgId: string | null = 'o1') => ({ id, role, platformRole, orgId } as any);
  it('viewer is read-only', () => { expect(can(u('x'), 'project.view', base)).toBe(true); expect(can(u('x'), 'issue.create', base)).toBe(false); });
  it('developer can transition, reporter only own', () => { expect(can(u('dev'), 'issue.transition', base)).toBe(true); expect(can(u('rep'), 'issue.transition', base)).toBe(false); expect(can(u('rep'), 'issue.transition', base, true)).toBe(true); });
  it('tenant isolation + private + guest', () => {
    expect(projectRole(u('dev', 'member', 'user', 'o2'), base)).toBeNull();
    expect(projectRole(u('x'), { ...base, visibility: 'private' })).toBeNull();
    expect(projectRole(u('g', 'guest'), base)).toBeNull();
  });
  it('platform perms are super-admin only', () => { expect(can(u('a', 'org_admin'), 'platform.manage_orgs')).toBe(false); expect(can(u('s', 'member', 'super_admin', null), 'platform.manage_orgs')).toBe(true); });
});
