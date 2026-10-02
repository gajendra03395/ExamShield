# Setup and troubleshooting

## Local development

1. Start PostgreSQL and create the database named `examshield`.
2. Copy the required values into `backend/.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT=5000`, and `NODE_ENV=development`. `DATABASE_URL` must point to the local database. Use `REDIS_URL` only if Redis is configured; the current API does not require Redis for core exam flows.
3. Run `npm ci` and `npx prisma db push` in `backend`.
4. Run `npm run dev` in `backend`; verify `http://127.0.0.1:5000/api/health` reports both API and database as healthy.
5. Run `npm ci` and `npm run dev` in `web-panel`; open `http://localhost:5173/login`.
6. Bootstrap the first admin once through the secured endpoint in [API.md](API.md), then remove the bootstrap secret and have the administrator activate accounts.

Build checks: `npm run build` in both `backend` and `web-panel`; on Windows, `dotnet build desktop-client/SecureExam/SecureExam.csproj`. The standalone x64 publish also needs .NET runtime packs; on offline build machines, restore those packs from an approved NuGet mirror before publishing.

## Common problems

- **API says database unavailable:** verify PostgreSQL is listening on port 5432 and `DATABASE_URL` uses the correct database, username, password, and URL-encoded special characters.
- **Login says account inactive:** an administrator must activate the registration from `/admin`.
- **No questions appear on a test:** add questions to the faculty question bank, then open the draft and assign questions before publishing.
- **Kiosk cannot start:** verify backend and web panel are running, WebView2 Runtime is installed, the device has one display, and the keyboard hook can be installed.
- **NuGet restore fails:** restore `win-x64` runtime packs through the organization’s package mirror, then rerun the build/publish script.

## Backups

Back up PostgreSQL regularly and verify restores on a separate database. Protect `backend/.env`, the one-time bootstrap credential, kiosk profiles, queued offline reports, and database backups as sensitive material.
