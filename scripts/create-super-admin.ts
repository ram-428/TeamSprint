/* eslint-disable @typescript-eslint/no-explicit-any */
// Creates (or promotes) a platform Super Admin. This is the ONLY way to get a Super Admin.
//   npm run create-super-admin -- --email you@example.com --password 'Str0ng!Pass' [--name "Your Name"]
// An existing user with that email is promoted (password is updated only if --password is given).
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
for (const f of ['.env.local', '.env']) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
import { connectDB, closeDB } from '../src/server/db';
import { User } from '../src/server/models';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const password = arg('password');
  const name = arg('name') || 'System Admin';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Usage: npm run create-super-admin -- --email <email> --password <password> [--name <name>]');
  await connectDB();
  const existing = await User.findOne({ email });
  if (existing) {
    existing.platformRole = 'super_admin';
    existing.status = 'active';
    if (password) { existing.passwordHash = await bcrypt.hash(password, 10); existing.tokenVersion = (existing.tokenVersion || 0) + 1; }
    await existing.save();
    console.log(`✔ ${email} is now a Super Admin`);
  } else {
    if (!password || password.length < 8) throw new Error('A --password of at least 8 characters is required for a new user');
    await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role: 'member', platformRole: 'super_admin', title: 'Platform Owner', color: '#7c5cff' });
    console.log(`✔ Super Admin created: ${email}`);
  }
}
main().then(() => closeDB()).catch(async (e) => { console.error('✖', e.message); await closeDB(); process.exit(1); });
