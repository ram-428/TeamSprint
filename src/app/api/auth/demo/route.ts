import { route } from '@/server/api';
import { User } from '@/server/models';

// Dev-only: powers the "Demo accounts" quick-fill panel on the login page.
export const GET = route(async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEMO_ACCOUNTS_PANEL !== 'true') return { accounts: [] };
  const us = await User.find({ email: { $in: ['superadmin@orbit.dev', 'admin@acme.dev', 'priya.lead@acme.dev', 'marcus.po@acme.dev', 'sara.dev@acme.dev', 'lena.qa@acme.dev', 'tom.reporter@acme.dev', 'vera.viewer@acme.dev', 'guest@client.com'] } })
    .select('name email role platformRole title color').lean<any[]>();
  const pw = (e: string) => (e === 'superadmin@orbit.dev' ? 'Orbit@Super123!' : e === 'admin@acme.dev' ? 'Orbit@Admin123!' : 'Orbit@Demo123!');
  const label = (u: any) => (u.platformRole === 'super_admin' ? 'Super Admin' : u.role === 'org_admin' ? 'Org Admin' : u.role === 'guest' ? 'Guest' : u.title || 'Member');
  return { accounts: us.map((u) => ({ name: u.name, email: u.email, password: pw(u.email), label: label(u), color: u.color })).sort((a, b) => (a.label === 'Super Admin' ? -1 : b.label === 'Super Admin' ? 1 : a.label.localeCompare(b.label))) };
}, { auth: false });
