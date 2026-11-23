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
| Super Admin | superadmin@orbit.dev | Orbit@Super123! |
| Org Admin | admin@acme.dev | Orbit@Admin123! |
| Scrum Master | priya.lead@acme.dev | Orbit@Demo123! |
| Product Owner | marcus.po@acme.dev | Orbit@Demo123! |
| Developer | sara.dev@acme.dev | Orbit@Demo123! |
| QA | lena.qa@acme.dev | Orbit@Demo123! |
| Reporter | tom.reporter@acme.dev | Orbit@Demo123! |
| Viewer | vera.viewer@acme.dev | Orbit@Demo123! |
| Guest | guest@client.com | Orbit@Demo123! |
