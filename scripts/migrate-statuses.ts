// Moves every project onto the shared status list (Todo, In Progress, On Hold, Resolved, Reopened, Done, Cancelled).
//   npm run migrate-statuses
// Safe to run any number of times: projects that are already converted are skipped.
// The app also does this automatically the first time a freshly started server connects to the database.
import fs from 'node:fs';
for (const f of ['.env.local', '.env']) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
import { connectDB, closeDB } from '../src/server/db';
import { migrateStatuses } from '../src/server/migrate';

async function main() {
  await connectDB(); // runs the migration once as part of connecting
  const r = await migrateStatuses(); // runs again to report: anything left over is converted now
  console.log(`Projects: ${r.total}. Still needed converting: ${r.migrated}. All projects now use the shared statuses.`);
}

main().then(() => closeDB()).catch(async (e) => { console.error(e); await closeDB(); process.exit(1); });
