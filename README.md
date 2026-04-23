# MalariaCaseNotificationSystem_BackEnd

## Setup

1. Install dependencies: `npm install`
2. Copy env file: `cp .env.example .env` (or create `.env` manually on Windows)
3. Run migrations: `npm run db:migrate`
4. Start dev server: `npm run dev`
5. Build production: `npm run build`

## Production

Set `DATABASE_URL`, `FRONTEND_URL`, `APP_BASE_URL`, and JWT secrets in Render environment variables.

### Seed local users to production

1. Export your current local users to seed snapshot:
   - `npm run db:export-local-users-seed`
2. Commit `prisma/local-users.seed.json`.
3. On deploy, run:
   - `npm run db:deploy`

This applies migrations and runs Prisma seed (including `local-users.seed.json` if present).
