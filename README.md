# Team Sprint

Jira-style team task / sprint management. Next.js 15 (App Router) + MongoDB (Mongoose), single monolith.

## Run
```
npm install
npm run seed        # fills the MongoDB database (MONGODB_URI / MONGODB_DB in .env.local)
npm run serve       # production build + start on http://localhost:7000  (fastest)
npm run dev         # dev mode on http://localhost:7000 (slower: compiles each page on first visit)
npm test            # unit tests (OQL parser, RBAC, helpers)
```
`.env.local`: `MONGODB_URI`, `MONGODB_DB` (default `team-sprint`), `JWT_SECRET`, `ENABLE_DEMO_ACCOUNTS_PANEL=true`.
The seed script refuses to reset any database whose name contains "ssd" or "temple".

## Demo logins
| Role | Email | Password |
|---|---|---|
| System Admin | netkathirtestmail@gmail.com | Systemadmin@321 (+ emailed login code) |
