/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
for (const f of ['.env.local', '.env']) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
import mongoose from 'mongoose';
import { connectDB, closeDB } from '../src/server/db';
import { User, Org, Team, Project, Issue, Comment, Worklog, Sprint, Activity, Notification, Audit, Goal, SavedFilter, Automation } from '../src/server/models';
import { WORKFLOWS } from '../src/server/domain';

// deterministic RNG so reseeds are reproducible
let seedN = 20260101;
const rnd = () => { seedN |= 0; seedN = (seedN + 0x6d2b79f5) | 0; let t = Math.imul(seedN ^ (seedN >>> 15), 1 | seedN); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const DAY = 864e5;
const now = Date.now();
const ago = (d: number, jitterH = 0) => new Date(now - d * DAY + (rnd() - 0.5) * jitterH * 36e5);
const oid = () => new mongoose.Types.ObjectId();

const COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185', '#a78bfa', '#2dd4bf', '#f97316'];

async function main() {
  await connectDB();
  const dbName = mongoose.connection.db!.databaseName;
  if (/ssd|temple/i.test(dbName)) throw new Error(`Refusing to reset "${dbName}" – it looks like another project's database`);
  console.log(`› Resetting database "${dbName}"…`);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Org, Team, Project, Issue, Comment, Worklog, Sprint, Activity, Notification, Audit, Goal, SavedFilter, Automation].map((m) => m.syncIndexes()));

  const pw = { super: await bcrypt.hash('Systemadmin@321', 10), admin: await bcrypt.hash('Orbit@Admin123!', 10), demo: await bcrypt.hash('Orbit@Demo123!', 10) };

  // ───────────────────────── Orgs & users ─────────────────────────
  const acme = await Org.create({ name: 'Acme Inc', slug: 'acme', plan: 'pro', maxUsers: 100, maxProjects: 50 });
  const globex = await Org.create({ name: 'Globex Labs', slug: 'globex', plan: 'free', maxUsers: 10, maxProjects: 3 });

  const mk = (name: string, email: string, org: any, role: string, title: string, hash: string, i: number, extra: any = {}) =>
    ({ name, email, orgId: org?._id, role, title, passwordHash: hash, color: COLORS[i % COLORS.length], lastLoginAt: ago(rnd() * 3), createdAt: ago(100 - i), ...extra });

  const sa = await User.create(mk('System Admin', 'netkathirtestmail@gmail.com', null, 'member', 'Platform Owner', pw.super, 0, { platformRole: 'super_admin' }));
  const U: Record<string, any> = {};
  const defs: [string, string, string, string, string][] = [
    ['admin', 'Alex Morgan', 'admin@acme.dev', 'org_admin', 'Head of Engineering'],
    ['priya', 'Priya Sharma', 'priya.lead@acme.dev', 'member', 'Scrum Master'],
    ['marcus', 'Marcus Johnson', 'marcus.po@acme.dev', 'member', 'Product Owner'],
    ['sara', 'Sara Dev', 'sara.dev@acme.dev', 'member', 'Senior Developer'],
    ['kiran', 'Kiran Patel', 'kiran.dev@acme.dev', 'member', 'Backend Developer'],
    ['lena', 'Lena Fischer', 'lena.qa@acme.dev', 'member', 'QA Engineer'],
    ['omar', 'Omar Haddad', 'omar.design@acme.dev', 'member', 'Product Designer'],
    ['tom', 'Tom Reporter', 'tom.reporter@acme.dev', 'member', 'Support Analyst'],
    ['vera', 'Vera Viewer', 'vera.viewer@acme.dev', 'member', 'Stakeholder'],
    ['guest', 'Client Guest', 'guest@client.com', 'guest', 'External Customer'],
    ['aisha', 'Aisha Khan', 'aisha.khan@acme.dev', 'member', 'Frontend Developer'],
    ['diego', 'Diego Rivera', 'diego.rivera@acme.dev', 'member', 'Mobile Developer'],
    ['mei', 'Mei Chen', 'mei.chen@acme.dev', 'member', 'Mobile Developer'],
    ['noah', 'Noah Williams', 'noah.williams@acme.dev', 'member', 'DevOps Engineer'],
    ['fatima', 'Fatima Ali', 'fatima.ali@acme.dev', 'member', 'Marketing Manager'],
    ['lucas', 'Lucas Meyer', 'lucas.meyer@acme.dev', 'member', 'Content Strategist'],
    ['ananya', 'Ananya Rao', 'ananya.rao@acme.dev', 'member', 'Support Lead'],
    ['ethan', 'Ethan Brooks', 'ethan.brooks@acme.dev', 'member', 'Support Agent'],
  ];
  for (const [i, d] of defs.entries()) U[d[0]] = await User.create(mk(d[1], d[2], acme, d[3], d[4], d[0] === 'admin' ? pw.admin : pw.demo, i + 1));
  const gx = await User.create(mk('Gina Globex', 'admin@globex.dev', globex, 'org_admin', 'CTO', pw.admin, 30));
  const gx2 = await User.create(mk('Hank Globex', 'hank@globex.dev', globex, 'member', 'Developer', pw.demo, 31));

  const teams = [
    { name: 'Platform', color: '#7c5cff', leadId: U.priya._id, memberIds: [U.priya, U.sara, U.kiran, U.noah].map((u) => u._id) },
    { name: 'Mobile', color: '#22d3ee', leadId: U.diego._id, memberIds: [U.diego, U.mei, U.omar].map((u) => u._id) },
    { name: 'Design', color: '#f472b6', leadId: U.omar._id, memberIds: [U.omar, U.aisha].map((u) => u._id) },
    { name: 'QA', color: '#34d399', leadId: U.lena._id, memberIds: [U.lena].map((u) => u._id) },
  ];
  await Team.insertMany(teams.map((t) => ({ ...t, orgId: acme._id })));

  // ───────────────────────── Projects ─────────────────────────
  const mkProject = async (key: string, name: string, description: string, type: string, lead: any, color: string, icon: string, members: [any, string][], visibility = 'org', extra: any = {}) =>
    Project.create({
      orgId: acme._id, key, name, description, type, leadId: lead._id, color, icon, visibility, statuses: WORKFLOWS[type],
      members: members.map(([u, role]) => ({ userId: u._id, role })), createdAt: ago(95), ...extra,
    });

  const devRoster: [any, string][] = [[U.priya, 'project_admin'], [U.marcus, 'project_admin'], [U.sara, 'developer'], [U.kiran, 'developer'], [U.aisha, 'developer'], [U.noah, 'developer'], [U.lena, 'developer'], [U.omar, 'developer'], [U.tom, 'reporter'], [U.vera, 'viewer'], [U.admin, 'project_admin']];
  const pACME = await mkProject('ACME', 'Team Sprint Web App', 'The flagship web product: auth, payments, onboarding, performance and dark mode.', 'scrum', U.priya, '#7c5cff', 'rocket', devRoster, 'org', {
    components: ['API', 'Frontend', 'Infra', 'Docs'],
    versions: [{ id: 'v1.0', name: 'v1.0', released: true, releaseDate: ago(70) }, { id: 'v1.1', name: 'v1.1', released: true, releaseDate: ago(30) }, { id: 'v1.2', name: 'v1.2', released: false, releaseDate: ago(-10) }, { id: 'v2.0', name: 'v2.0', released: false, releaseDate: ago(-60) }],
  });
  const pMOB = await mkProject('MOB', 'Mobile Apps', 'iOS & Android apps built with React Native.', 'kanban', U.diego, '#22d3ee', 'smartphone', [[U.diego, 'project_admin'], [U.mei, 'developer'], [U.omar, 'developer'], [U.lena, 'developer'], [U.marcus, 'project_admin'], [U.vera, 'viewer'], [U.admin, 'project_admin']], 'org', { components: ['iOS', 'Android', 'Shared'], wip: { progress: 4, review: 3 } });
  const pSUP = await mkProject('SUP', 'Customer Support', 'Customer-facing support desk with SLA tracking.', 'service_desk', U.ananya, '#34d399', 'life-buoy', [[U.ananya, 'project_admin'], [U.ethan, 'developer'], [U.tom, 'reporter'], [U.guest, 'reporter'], [U.priya, 'developer'], [U.admin, 'project_admin']]);
  const pMKT = await mkProject('MKT', 'Marketing Campaigns', 'Campaign planning, content calendar and launches.', 'business', U.fatima, '#f472b6', 'megaphone', [[U.fatima, 'project_admin'], [U.lucas, 'developer'], [U.omar, 'developer'], [U.marcus, 'developer'], [U.vera, 'viewer'], [U.admin, 'project_admin']]);
  const pPLAT = await mkProject('PLAT', 'Platform & Infra', 'Private: infrastructure, security and cost work.', 'kanban', U.noah, '#fbbf24', 'server', [[U.noah, 'project_admin'], [U.admin, 'project_admin'], [U.kiran, 'developer']], 'private', { components: ['K8s', 'CI/CD', 'Observability'] });
  await Project.updateOne({ _id: pACME._id }, { starredBy: [U.sara._id, U.priya._id, U.admin._id] });
  await Project.updateOne({ _id: pMOB._id }, { starredBy: [U.sara._id] });

  // Globex project (tenant isolation proof)
  const pGX = await Project.create({ orgId: globex._id, key: 'GLX', name: 'Globex Core', description: 'Tenant isolation sample project', type: 'kanban', leadId: gx._id, color: '#fb7185', icon: 'globe', statuses: WORKFLOWS.kanban, members: [{ userId: gx._id, role: 'project_admin' }, { userId: gx2._id, role: 'developer' }] });

  // ───────────────────────── Issue factory ─────────────────────────
  const counters: Record<string, number> = {};
  const rankC: Record<string, number> = {};
  const issueDocs: any[] = [];
  const actDocs: any[] = [];
  const mkIssue = (project: any, o: any) => {
    const k = project.key;
    counters[k] = (counters[k] || 0) + 1;
    rankC[k] = (rankC[k] || 0) + 1000;
    const st = project.statuses.find((s: any) => s.id === o.status) || project.statuses[0];
    const createdAt = o.createdAt || ago(20);
    const doc = {
      _id: oid(), orgId: project.orgId, projectId: project._id, projectKey: k, number: counters[k], key: `${k}-${counters[k]}`,
      type: o.type || 'task', summary: o.summary, description: o.description || `${o.summary}.\n\n**Acceptance criteria**\n- [ ] Works as described in the ticket\n- [ ] Covered by tests\n- [ ] Reviewed and documented`,
      status: st.id, statusCategory: st.category, priority: o.priority || pick(['Medium', 'Medium', 'High', 'Low', 'Highest', 'Lowest']),
      reporterId: (o.reporter || pick([U.marcus, U.priya, U.tom, U.lena]))._id, assigneeId: o.assignee?._id, labels: o.labels || [], components: o.components || [],
      fixVersion: o.fixVersion, epicId: o.epic?._id, parentId: o.parent?._id, sprintId: o.sprint?._id, points: o.points, estimate: o.estimate,
      timeSpent: o.timeSpent || 0, dueDate: o.dueDate, rank: rankC[k], flagged: o.flagged, watchers: [], votes: [], links: o.links || [],
      resolvedAt: st.category === 'done' ? o.resolvedAt || createdAt : undefined, resolution: st.category === 'done' ? 'Done' : undefined,
      statusChangedAt: o.statusChangedAt || o.resolvedAt || createdAt, slaDue: o.slaDue, version: 1, createdAt, updatedAt: o.updatedAt || o.resolvedAt || createdAt,
    };
    issueDocs.push(doc);
    actDocs.push({ orgId: project.orgId, projectId: project._id, issueId: doc._id, actorId: doc.reporterId, action: 'created', createdAt, updatedAt: createdAt });
    if (st.category === 'done') actDocs.push({ orgId: project.orgId, projectId: project._id, issueId: doc._id, actorId: doc.assigneeId || doc.reporterId, action: 'updated', diff: { status: { from: 'progress', to: st.id } }, createdAt: doc.resolvedAt, updatedAt: doc.resolvedAt });
    return doc;
  };

  // ── ACME epics
  const epic = (summary: string, status = 'progress', due?: Date) => mkIssue(pACME, { type: 'epic', summary, status, createdAt: ago(90), assignee: U.marcus, priority: 'High', dueDate: due, labels: ['roadmap'] });
  const eAuth = epic('Authentication & Security', 'progress', ago(-20));
  const ePay = epic('Payments & Billing', 'progress', ago(-45));
  const eOnb = epic('Onboarding Experience', 'done');
  const ePerf = epic('Performance & Reliability', 'progress', ago(-30));
  const eDark = epic('Dark Mode & Design System', 'progress', ago(-15));

  const devs = [U.sara, U.kiran, U.aisha, U.noah, U.priya];
  const stories: { s: string; e: any; t?: string; c: string; p: number; l?: string[] }[] = [
    { s: 'Add Google & GitHub single sign-on', e: eAuth, t: 'story', c: 'API', p: 8, l: ['oauth'] },
    { s: 'Two-factor authentication with authenticator apps', e: eAuth, t: 'story', c: 'API', p: 8, l: ['security'] },
    { s: 'Password strength meter on registration', e: eAuth, t: 'story', c: 'Frontend', p: 3 },
    { s: 'Rotate refresh tokens and detect token reuse', e: eAuth, t: 'task', c: 'API', p: 5, l: ['security'] },
    { s: 'Session management page (revoke devices)', e: eAuth, t: 'story', c: 'Frontend', p: 5 },
    { s: 'Account lockout after repeated failed logins', e: eAuth, t: 'task', c: 'API', p: 3 },
    { s: 'Integrate Stripe checkout', e: ePay, t: 'story', c: 'API', p: 13, l: ['stripe'] },
    { s: 'Invoice PDF generation', e: ePay, t: 'story', c: 'API', p: 5 },
    { s: 'Subscription plan upgrade/downgrade flow', e: ePay, t: 'story', c: 'Frontend', p: 8 },
    { s: 'Handle failed payment retries (dunning)', e: ePay, t: 'task', c: 'API', p: 5 },
    { s: 'Tax calculation by region', e: ePay, t: 'story', c: 'API', p: 8 },
    { s: 'Billing history table with filters', e: ePay, t: 'story', c: 'Frontend', p: 3 },
    { s: 'Interactive product tour for new users', e: eOnb, t: 'story', c: 'Frontend', p: 8 },
    { s: 'Welcome email sequence', e: eOnb, t: 'task', c: 'API', p: 3 },
    { s: 'Sample project created on first sign-in', e: eOnb, t: 'story', c: 'API', p: 5 },
    { s: 'Reduce initial JS bundle below 180KB', e: ePerf, t: 'task', c: 'Frontend', p: 5, l: ['perf'] },
    { s: 'Add database indexes for issue search', e: ePerf, t: 'task', c: 'API', p: 3, l: ['perf'] },
    { s: 'Cache dashboard aggregates for 60 seconds', e: ePerf, t: 'task', c: 'API', p: 3 },
    { s: 'Virtualize long issue lists', e: ePerf, t: 'story', c: 'Frontend', p: 5 },
    { s: 'Set up synthetic uptime monitoring', e: ePerf, t: 'task', c: 'Infra', p: 2 },
    { s: 'Design tokens for light and dark themes', e: eDark, t: 'story', c: 'Frontend', p: 5, l: ['design'] },
    { s: 'Dark mode toggle with system preference', e: eDark, t: 'story', c: 'Frontend', p: 3 },
    { s: 'Audit colour contrast to WCAG AA', e: eDark, t: 'task', c: 'Frontend', p: 3, l: ['a11y'] },
    { s: 'Dark theme for charts and data tables', e: eDark, t: 'story', c: 'Frontend', p: 5 },
    { s: 'Document the component library', e: eDark, t: 'task', c: 'Docs', p: 2, l: ['docs'] },
    { s: 'Rate limit public API endpoints', e: eAuth, t: 'task', c: 'API', p: 3 },
    { s: 'Export user data (GDPR)', e: eAuth, t: 'story', c: 'API', p: 5 },
    { s: 'Webhooks for payment events', e: ePay, t: 'story', c: 'API', p: 5 },
    { s: 'Keyboard shortcuts overlay', e: eDark, t: 'story', c: 'Frontend', p: 3 },
    { s: 'Migrate CI to cached builds', e: ePerf, t: 'task', c: 'Infra', p: 3 },
  ];
  const bugs = [
    'Login button stays disabled after failed attempt', 'Checkout total off by one cent on 3-item carts', 'Avatar upload crashes on HEIC images', 'Dashboard flickers on tab refocus',
    'Date picker shows wrong month in Safari', 'Password reset email link expires immediately', 'Sidebar overlaps content at 1280px width', 'Duplicate notifications on comment edit',
    'CSV export drops non-ASCII characters', 'Search ignores accents (é, ñ)', 'Timezone shift in invoice dates', 'Memory leak when switching boards rapidly',
    'Focus ring invisible in dark mode', '500 error when deleting project with sub-tasks', 'Tooltip stuck after drag and drop',
  ];

  // closed sprints (1-4) – resolved inside their window
  const sprints: any[] = [];
  const velocityTargets = [29, 32, 34, 36];
  let storyIdx = 0;
  for (let sN = 0; sN < 4; sN++) {
    const end = 56 - sN * 14, start = end + 14;
    const sp = await Sprint.create({ orgId: acme._id, projectId: pACME._id, name: `ACME Sprint ${sN + 1}`, goal: ['Foundation: auth basics & design tokens', 'Payments MVP and performance quick wins', 'Onboarding journey and dark mode groundwork', 'Hardening: security & accessibility'][sN], state: 'closed', startDate: ago(start), endDate: ago(end), completedAt: ago(end), committed: velocityTargets[sN] + 3, completed: velocityTargets[sN] });
    sprints.push(sp);
    let pts = 0;
    while (pts < velocityTargets[sN] && storyIdx < stories.length) {
      const st = stories[storyIdx++];
      if (pts + st.p > velocityTargets[sN] + 2) continue;
      pts += st.p;
      const rAt = ago(end + rnd() * 12 + 0.5);
      mkIssue(pACME, { type: st.t, summary: st.s, status: 'done', epic: st.e, components: [st.c], labels: st.l, points: st.p, sprint: sp, assignee: pick(devs), createdAt: ago(start + 3 + rnd() * 6), resolvedAt: rAt, fixVersion: sN < 2 ? 'v1.0' : 'v1.1', timeSpent: st.p * 3600 * 3 });
    }
    // some bugs per sprint
    for (let b = 0; b < 2; b++) { const bs = bugs.shift()!; mkIssue(pACME, { type: 'bug', summary: bs, status: 'done', sprint: sp, points: 2, assignee: pick(devs), components: [pick(['API', 'Frontend'])], createdAt: ago(start + 2), resolvedAt: ago(end + 1 + rnd() * 10), fixVersion: sN < 2 ? 'v1.0' : 'v1.1', priority: pick(['High', 'Medium', 'Highest']), reporter: U.lena }); }
  }

  // Active sprint (day 6 of 14)
  const active = await Sprint.create({ orgId: acme._id, projectId: pACME._id, name: 'ACME Sprint 5', goal: 'Ship SSO + 2FA and finish Stripe checkout for v1.2', state: 'active', startDate: ago(6), endDate: ago(-8), committed: 0 });
  const future = await Sprint.create({ orgId: acme._id, projectId: pACME._id, name: 'ACME Sprint 6', goal: 'Billing polish and dark mode QA', state: 'future' });
  const activeStatuses = ['done', 'done', 'done', 'review', 'review', 'qa', 'progress', 'progress', 'progress', 'todo', 'todo', 'todo'];
  const activeItems: any[] = [];
  for (const [i, st] of stories.slice(storyIdx, storyIdx + 12).entries()) {
    const status = activeStatuses[i];
    const d = mkIssue(pACME, { type: st.t, summary: st.s, status, epic: st.e, components: [st.c], labels: st.l, points: st.p, sprint: active, assignee: [U.sara, U.kiran, U.aisha, U.noah, U.priya][i % 5], createdAt: ago(10 + i), resolvedAt: status === 'done' ? ago(1 + i * 1.3) : undefined, fixVersion: 'v1.2', estimate: st.p * 3600 * 4, timeSpent: status === 'todo' ? 0 : st.p * 3600, flagged: i === 6, dueDate: i % 4 === 0 ? ago(-3 - i) : undefined });
    activeItems.push(d);
  }
  storyIdx += 12;
  for (const [i, bs] of bugs.slice(0, 3).entries()) activeItems.push(mkIssue(pACME, { type: 'bug', summary: bs, status: ['progress', 'qa', 'todo'][i], sprint: active, points: 2, assignee: [U.kiran, U.sara, U.aisha][i], components: [pick(['API', 'Frontend'])], priority: ['Highest', 'High', 'High'][i], reporter: U.lena, createdAt: ago(5 - i), fixVersion: 'v1.2' }));
  // future sprint
  for (const st of stories.slice(storyIdx, storyIdx + 4)) mkIssue(pACME, { type: st.t, summary: st.s, status: 'todo', epic: st.e, components: [st.c], labels: st.l, points: st.p, sprint: future, assignee: pick(devs), createdAt: ago(4), fixVersion: 'v2.0' });
  storyIdx += 4;
  // backlog
  for (const st of stories.slice(storyIdx)) mkIssue(pACME, { type: st.t, summary: st.s, status: 'todo', epic: st.e, components: [st.c], labels: st.l, points: st.p, createdAt: ago(3 + rnd() * 20), reporter: U.marcus });
  const backlogExtras = ['Spike: evaluate edge rendering for marketing pages', 'Add public status page', 'Support SAML for enterprise customers', 'Localise UI into Spanish and German', 'Offline mode for issue viewing', 'In-app changelog widget', 'Bulk import from CSV', 'Slack integration for notifications', 'Improve empty states with illustrations', 'Audit log export to CSV', 'Custom fields on issues', 'Time-tracking summary widget'];
  for (const [i, s] of backlogExtras.entries()) mkIssue(pACME, { type: i === 0 ? 'task' : 'story', summary: s, status: 'todo', points: pick([2, 3, 5, 8]), createdAt: ago(2 + i), reporter: pick([U.marcus, U.priya]), epic: pick([eAuth, ePerf, eDark, ePay]), labels: i === 0 ? ['spike'] : [] });
  for (const bs of bugs.slice(3)) mkIssue(pACME, { type: 'bug', summary: bs, status: 'todo', points: pick([1, 2, 3]), createdAt: ago(1 + rnd() * 8), reporter: pick([U.lena, U.tom]), priority: pick(['Medium', 'High', 'Low']), components: [pick(['API', 'Frontend'])] });
  // sub-tasks for several active stories
  for (const parent of activeItems.slice(0, 6)) for (const [i, t] of ['Implement', 'Write tests', 'Update docs'].entries()) mkIssue(pACME, { type: 'subtask', summary: `${t}: ${parent.summary.slice(0, 50)}`, status: parent.status === 'done' ? 'done' : i === 0 && parent.status !== 'todo' ? 'progress' : 'todo', parent, sprint: active, assignee: pick(devs), createdAt: parent.createdAt, resolvedAt: parent.resolvedAt, points: 1 });
  // links
  const byKey = (k: string) => issueDocs.find((d) => d.key === k);
  const a = activeItems; if (a[0] && a[1]) { a[0].links.push({ type: 'blocks', targetKey: a[1].key }); a[1].links.push({ type: 'is blocked by', targetKey: a[0].key }); }
  if (a[7] && a[8]) { a[7].links.push({ type: 'relates to', targetKey: a[8].key }); a[8].links.push({ type: 'relates to', targetKey: a[7].key }); }
  void byKey;

  // ── MOB (kanban)
  const mobItems: [string, string, string, string?, string?, number?][] = [
    ['Push notification deep links open correct screen', 'story', 'progress', 'diego', 'iOS', 5], ['Biometric login (Face ID / fingerprint)', 'story', 'review', 'mei', 'Shared', 8],
    ['App crashes on Android 14 when rotating', 'bug', 'progress', 'diego', 'Android', 3], ['Offline queue for created issues', 'story', 'todo', 'mei', 'Shared', 8], ['Dark mode for iOS app', 'story', 'progress', 'omar', 'iOS', 5],
    ['Splash screen flicker on cold start', 'bug', 'done', 'mei', 'iOS', 2], ['Upgrade to React Native 0.76', 'task', 'review', 'diego', 'Shared', 5], ['Haptic feedback on drag and drop', 'story', 'todo', 'mei', 'iOS', 2],
    ['Camera upload for attachments', 'story', 'done', 'diego', 'Android', 5], ['Widget showing my open issues', 'story', 'todo', 'diego', 'iOS', 8], ['Fix keyboard overlapping comment box', 'bug', 'progress', 'mei', 'Android', 2],
    ['App Store screenshots & copy', 'task', 'done', 'omar', 'iOS', 2], ['Crash reporting integration', 'task', 'done', 'diego', 'Shared', 3], ['Tablet layout for board view', 'story', 'todo', 'omar', 'Shared', 8],
    ['Pull-to-refresh jank on long lists', 'bug', 'review', 'mei', 'Shared', 3], ['Localise onboarding screens', 'story', 'todo', undefined, 'Shared', 3], ['Accessibility audit with VoiceOver', 'task', 'progress', 'lena', 'iOS', 5],
    ['Deep link to issue from email', 'story', 'done', 'diego', 'Shared', 3], ['Reduce app size by 20%', 'task', 'todo', 'mei', 'Shared', 5], ['Release checklist automation', 'task', 'done', 'diego', 'Shared', 2],
  ];
  for (const [i, [s, t, st, who, c, p]] of mobItems.entries()) mkIssue(pMOB, { type: t, summary: s, status: st, assignee: who ? U[who] : undefined, components: c ? [c] : [], points: p, createdAt: ago(25 - i), resolvedAt: st === 'done' ? ago(1 + i * 0.9) : undefined, priority: t === 'bug' ? pick(['High', 'Highest']) : undefined, reporter: pick([U.marcus, U.lena, U.diego]) });

  // ── SUP (service desk) w/ SLA states
  const tickets: [string, string, string, number][] = [
    ['Cannot reset my password – link says expired', 'todo', 'ethan', -2], ['Invoice shows wrong company name', 'progress', 'ananya', 3], ['How do I export my data?', 'done', 'ethan', 6], ['App is very slow since yesterday', 'progress', 'ethan', 1],
    ['Need to add 5 more seats to our plan', 'customer', 'ananya', 20], ['SSO login loops back to sign-in page', 'todo', 'ananya', -5], ['Feature request: dark mode for emails', 'done', 'ethan', 10], ['Billing charged twice this month', 'progress', 'ananya', 0.5],
    ['Webhook not firing for payment events', 'todo', 'ethan', 4], ['Cannot upload files larger than 5MB', 'customer', 'ethan', 15], ['Please remove a former employee from our workspace', 'done', 'ananya', 12], ['Mobile app logs me out every day', 'progress', 'ethan', 2],
    ['Request: audit log export', 'todo', undefined as any, 7], ['Dashboard widgets not loading in Firefox', 'done', 'ethan', 9], ['Question about GDPR data processing', 'done', 'ananya', 11], ['Two-factor codes not accepted', 'todo', 'ethan', -1],
    ['Trial extension request', 'done', 'ananya', 14], ['Wrong timezone on sprint dates', 'progress', 'ethan', 5], ['Can I use custom domains?', 'done', 'ethan', 8], ['Notifications arrive twice by email', 'todo', 'ananya', 6],
    ['Import from Jira fails at 90%', 'progress', 'ananya', 1.5], ['Account locked after password change', 'todo', 'ethan', -3], ['Slow search on large projects', 'customer', 'ananya', 18], ['Typo on pricing page', 'done', 'ethan', 13], ['Cannot add guest to project', 'todo', 'ethan', 9],
  ];
  for (const [i, [s, st, who, sla]] of tickets.entries()) mkIssue(pSUP, { type: 'task', summary: s, status: st, assignee: who ? U[who] : undefined, reporter: pick([U.guest, U.tom, U.guest]), createdAt: ago(1 + i * 0.7), resolvedAt: st === 'done' ? ago(0.3 + i * 0.3) : undefined, priority: pick(['Medium', 'High', 'Low']), slaDue: st === 'done' ? undefined : new Date(now + sla * 36e5), labels: ['support'] });

  // ── MKT (business)
  const mkt: [string, string, string, number][] = [
    ['Q4 product launch landing page', 'progress', 'lucas', -5], ['Launch email sequence (5 emails)', 'review', 'fatima', -2], ['Webinar: "Ship faster with Team Sprint"', 'todo', 'fatima', -12], ['Case study: Globex Labs', 'progress', 'lucas', -8],
    ['Redesign pricing page hero', 'review', 'omar', -3], ['Blog: 10 sprint planning tips', 'done', 'lucas', 4], ['Social calendar for November', 'done', 'fatima', 10], ['Press kit refresh', 'todo', 'lucas', -20], ['Paid ads creative testing', 'progress', 'fatima', -6],
    ['SEO audit and fixes', 'todo', 'lucas', -14], ['Customer testimonial videos', 'todo', 'omar', -25], ['Product Hunt launch plan', 'progress', 'fatima', 1], ['Newsletter: October roundup', 'done', 'lucas', 18], ['Partner co-marketing brief', 'todo', 'fatima', -9],
    ['Conference booth materials', 'review', 'omar', -4], ['Update brand guidelines', 'done', 'omar', 22], ['Analytics dashboard for campaigns', 'progress', 'marcus', -7], ['Referral program copy', 'todo', 'lucas', -16], ['Holiday campaign concepts', 'todo', 'fatima', -30], ['Quarterly marketing report', 'done', 'fatima', 5],
  ];
  for (const [i, [s, st, who, due]] of mkt.entries()) mkIssue(pMKT, { type: 'task', summary: s, status: st, assignee: U[who], createdAt: ago(20 - i), dueDate: new Date(now - due * DAY), resolvedAt: st === 'done' ? ago(2 + i * 0.6) : undefined, reporter: U.fatima, labels: [pick(['content', 'campaign', 'design', 'email'])] });

  // ── PLAT (private)
  const plat: [string, string, string, string][] = [
    ['Migrate staging to Kubernetes 1.31', 'progress', 'noah', 'K8s'], ['Rotate production secrets quarterly', 'todo', 'noah', 'CI/CD'], ['Add distributed tracing to API', 'progress', 'kiran', 'Observability'], ['Reduce cloud spend by 15%', 'todo', 'noah', 'K8s'],
    ['Zero-downtime deploys for web app', 'done', 'noah', 'CI/CD'], ['Backup restore drill', 'todo', 'noah', 'Observability'], ['Penetration test remediation', 'progress', 'kiran', 'CI/CD'], ['Alerting runbooks', 'done', 'noah', 'Observability'],
  ];
  for (const [i, [s, st, who, c]] of plat.entries()) mkIssue(pPLAT, { type: 'task', summary: s, status: st, assignee: U[who], components: [c], createdAt: ago(18 - i), resolvedAt: st === 'done' ? ago(2 + i) : undefined, priority: pick(['High', 'Highest', 'Medium']), reporter: U.noah, points: pick([3, 5, 8]) });
  // Globex
  for (const [s, st] of [['Set up SSO', 'progress'], ['Audit billing flow', 'todo'], ['Ship v1', 'done']]) mkIssue(pGX, { type: 'task', summary: s, status: st, assignee: gx2, reporter: gx, createdAt: ago(5), resolvedAt: st === 'done' ? ago(1) : undefined });

  // write issues, activity (bypass mongoose timestamp overwrite via raw collection)
  console.log(`› Inserting ${issueDocs.length} issues…`);
  const bounds: Record<string, number> = {};
  for (const d of issueDocs) bounds[String(d.projectId)] = Math.max(bounds[String(d.projectId)] || 0, d.number);
  await Issue.collection.insertMany(issueDocs);
  await Activity.collection.insertMany(actDocs);
  for (const p of [pACME, pMOB, pSUP, pMKT, pPLAT, pGX]) await Project.updateOne({ _id: p._id }, { issueCounter: bounds[String(p._id)] || 0 });

  // sprint snapshots
  for (const sp of [...sprints, active]) {
    const items = issueDocs.filter((d) => String(d.sprintId) === String(sp._id));
    const total = items.reduce((a, i) => a + (i.points || 0), 0);
    await Sprint.updateOne({ _id: sp._id }, { committed: sp.state === 'closed' ? sp.committed : total });
  }
  await Sprint.updateOne({ _id: sprints[3]._id }, { retro: { wentWell: ['Pairing on security work paid off', 'Zero escaped bugs in release', 'Demo was crisp'], improve: ['Too many mid-sprint scope changes', 'Code reviews waited >24h'], actions: ['Introduce review rotation', 'Freeze scope after day 3'] } });

  // ───────────────────────── Comments / worklogs ─────────────────────────
  const issueByKey = (k: string) => issueDocs.find((d) => d.key === k)!;
  const commentBodies = [
    (u: string) => `@${u} can you take a look at this before the sprint review?`, () => 'Reproduced locally. Root cause is in the retry logic — fix incoming.', () => 'Updated the designs in Figma, ready for implementation.',
    () => 'Looks good to me 👍 merging after CI passes.', (u: string) => `Blocked on infra — @${u} could you grant access to the staging cluster?`, () => 'Added tests for the edge cases we discussed.', () => 'QA passed on Chrome, Safari and Firefox.',
    () => 'Heads up: this affects the mobile app as well, linking MOB tickets.', () => 'Can we split this into smaller stories? It is bigger than 8 points.',
  ];
  const commentDocs: any[] = [];
  const talk = issueDocs.filter((d) => d.projectKey === 'ACME' && d.type !== 'epic' && d.type !== 'subtask').slice(0, 60);
  for (const d of talk) {
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const author = pick([U.sara, U.kiran, U.lena, U.priya, U.marcus, U.omar, U.aisha]);
      const mention = pick(['Sara Dev', 'Lena Fischer', 'Kiran Patel', 'Noah Williams']);
      const body = pick(commentBodies)(mention);
      const at = new Date(+d.createdAt + (i + 1) * (0.2 + rnd()) * DAY);
      commentDocs.push({ orgId: acme._id, issueId: d._id, authorId: author._id, body, mentions: [], createdAt: at <= new Date() ? at : new Date(), updatedAt: at });
    }
  }
  await Comment.collection.insertMany(commentDocs);
  const wl: any[] = [];
  for (const d of issueDocs.filter((x) => x.projectKey === 'ACME' && x.assigneeId && x.statusCategory !== 'todo' && x.type !== 'epic')) {
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) { const at = ago(rnd() * 40); wl.push({ orgId: acme._id, issueId: d._id, userId: d.assigneeId, seconds: pick([1800, 3600, 5400, 7200, 10800, 14400]), startedAt: at, description: pick(['Implementation', 'Code review', 'Debugging', 'Pairing session', 'Writing tests']), createdAt: at, updatedAt: at }); }
  }
  await Worklog.collection.insertMany(wl);
  const sums = new Map<string, number>(); for (const w of wl) sums.set(String(w.issueId), (sums.get(String(w.issueId)) || 0) + w.seconds);
  for (const [id, secs] of sums) await Issue.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { timeSpent: secs } });

  // ───────────────────────── Automation / filters / goals / notifications / audit ─────────────────────────
  await Automation.insertMany([
    { orgId: acme._id, projectId: pACME._id, name: 'Highest-priority bugs notify the lead', trigger: 'issue_created', conditionField: 'priority', conditionValue: 'Highest', actionType: 'notify_lead', runCount: 7, lastRunAt: ago(1) },
    { orgId: acme._id, projectId: pACME._id, name: 'Label issues moved to QA', trigger: 'status_changed', conditionField: 'status', conditionValue: 'qa', actionType: 'add_label', actionValue: 'needs-qa', runCount: 23, lastRunAt: ago(0.2) },
    { orgId: acme._id, projectId: pSUP._id, name: 'Auto-assign new tickets to support lead', trigger: 'issue_created', actionType: 'assign_lead', runCount: 41, lastRunAt: ago(0.1) },
    { orgId: acme._id, projectId: pMKT._id, name: 'Escalate stalled review items', trigger: 'status_changed', conditionField: 'status', conditionValue: 'review', actionType: 'set_priority', actionValue: 'High', enabled: false, runCount: 3 },
  ]);
  await SavedFilter.insertMany([
    { orgId: acme._id, ownerId: U.sara._id, name: 'My open bugs', oql: 'type = bug AND assignee = currentUser() AND statusCategory != done ORDER BY priority DESC' },
    { orgId: acme._id, ownerId: U.priya._id, name: 'Overdue high priority', oql: 'priority >= High AND due < now() AND statusCategory != done ORDER BY due ASC', shared: true },
    { orgId: acme._id, ownerId: U.priya._id, name: 'Active sprint – everything', oql: 'sprint IN openSprints() ORDER BY rank ASC', shared: true },
    { orgId: acme._id, ownerId: U.marcus._id, name: 'Recently resolved', oql: 'resolved >= -7d ORDER BY resolved DESC', shared: true },
    { orgId: acme._id, ownerId: U.lena._id, name: 'Needs QA', oql: 'status = QA OR labels = needs-qa', shared: true },
    { orgId: acme._id, ownerId: U.admin._id, name: 'Unassigned work', oql: 'assignee IS EMPTY AND statusCategory != done ORDER BY created DESC', shared: true },
    { orgId: acme._id, ownerId: U.admin._id, name: 'Created this week', oql: 'created >= startOfWeek() ORDER BY created DESC', shared: true },
    { orgId: acme._id, ownerId: U.marcus._id, name: 'Epic backlog (payments)', oql: 'text ~ "payment" OR text ~ "stripe"', shared: true },
  ]);
  await Goal.insertMany([
    { orgId: acme._id, ownerId: U.marcus._id, title: 'Launch v1.2 with SSO and checkout', period: 'Q4', status: 'on_track', keyResults: [{ title: 'Ship SSO (Google + GitHub)', target: 100, current: 70, unit: '%' }, { title: 'Stripe checkout conversion', target: 4, current: 2.6, unit: '%' }, { title: 'Escaped bugs in release', target: 0, current: 0, unit: '' }].map((k) => (k.target === 0 ? { ...k, target: 1, current: 1 } : k)) },
    { orgId: acme._id, ownerId: U.priya._id, title: 'Raise team delivery predictability', period: 'Q4', status: 'at_risk', keyResults: [{ title: 'Sprint commitment accuracy', target: 90, current: 78, unit: '%' }, { title: 'Median cycle time (days)', target: 3, current: 2, unit: 'd' }, { title: 'PRs reviewed within 24h', target: 95, current: 61, unit: '%' }] },
    { orgId: acme._id, ownerId: U.noah._id, title: 'Platform reliability', period: 'Q4', status: 'on_track', keyResults: [{ title: 'Uptime', target: 99.9, current: 99.95, unit: '%' }, { title: 'p95 API latency under 300ms', target: 100, current: 85, unit: '%' }] },
  ]);
  const notifs: any[] = [];
  const msgs: [any, any, string, string, string][] = [
    [U.sara, U.priya, 'assigned', 'assigned you ACME-61: Add Google & GitHub single sign-on', 'ACME-61'], [U.sara, U.lena, 'mention', 'mentioned you on ACME-70', 'ACME-70'], [U.sara, U.marcus, 'comment', 'commented on ACME-64: Rotate refresh tokens', 'ACME-64'],
    [U.sara, U.priya, 'sprint', 'ACME Sprint 5 has started', ''], [U.sara, U.kiran, 'status', 'moved ACME-66 to QA', 'ACME-66'], [U.lena, U.sara, 'status', 'moved ACME-66 to In Review', 'ACME-66'], [U.lena, U.priya, 'assigned', 'assigned you ACME-80: Dashboard flickers on tab refocus', 'ACME-80'],
    [U.priya, U.marcus, 'mention', 'mentioned you on ACME-62', 'ACME-62'], [U.priya, U.lena, 'comment', 'commented on ACME-75', 'ACME-75'], [U.admin, U.priya, 'member', 'added Aisha Khan to Team Sprint Web App', ''],
  ];
  msgs.forEach(([to, from, type, message, issueKey], i) => notifs.push({ userId: to._id, actorId: from._id, type, message: `${from.name} ${message}`.replace(/^(.+) ACME Sprint/, 'ACME Sprint'), issueKey, readAt: i % 3 === 2 ? ago(0.5) : undefined, createdAt: ago(0.1 + i * 0.4), updatedAt: ago(0.1 + i * 0.4) }));
  await Notification.collection.insertMany(notifs);

  const audits: any[] = [];
  const everyone = Object.values(U);
  for (let d = 13; d >= 0; d--) {
    const n = 4 + Math.floor(rnd() * 10);
    for (let i = 0; i < n; i++) { const u = pick(everyone); const at = ago(d + rnd() * 0.9); audits.push({ orgId: acme._id, actorId: u._id, action: 'auth.login', target: u.email, createdAt: at, updatedAt: at }); }
  }
  for (const [i, [a, t, u]] of ([['project.created', 'MKT', U.admin], ['org.member_invited', 'ethan.brooks@acme.dev', U.admin], ['project.member_changed', 'ACME', U.priya], ['sprint.started', 'ACME Sprint 5', U.priya], ['automation.created', 'Label issues moved to QA', U.priya], ['org.member_updated', 'vera.viewer@acme.dev', U.admin], ['platform.org_created', 'Globex Labs', sa], ['sprint.completed', 'ACME Sprint 4', U.priya]] as any[]).entries()) { const at = ago(i * 1.6 + 0.2); audits.push({ orgId: acme._id, actorId: u._id, action: a, target: t, createdAt: at, updatedAt: at }); }
  audits.push({ actorId: U.sara._id, orgId: acme._id, action: 'auth.locked', target: U.sara.email, createdAt: ago(0.3), updatedAt: ago(0.3) });
  await Audit.collection.insertMany(audits);

  const counts = { users: await User.countDocuments(), orgs: await Org.countDocuments(), projects: await Project.countDocuments(), issues: await Issue.countDocuments(), comments: await Comment.countDocuments(), sprints: await Sprint.countDocuments() };
  console.log('\n✔ Seed complete', counts);
  console.log('\n  Credentials');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  System Admin  netkathirtestmail@gmail.com  (email code required)');
  await closeDB();
  process.exit(0);
}
main().catch(async (e) => { console.error(e); try { await closeDB(); } catch { /* ignore */ } process.exit(1); });
