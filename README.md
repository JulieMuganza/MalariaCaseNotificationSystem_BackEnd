# MalariaCaseNotificationSystem_BackEnd

## Setup

1. Install dependencies: `npm install`
2. Copy env file: `cp .env.example .env` (or create `.env` manually on Windows)
3. Run migrations: `npm run db:migrate`
4. Start dev server: `npm run dev`
5. Build production: `npm run build`

## Production

Set `DATABASE_URL`, `FRONTEND_URL`, `APP_BASE_URL`, and JWT secrets in Render environment variables.
