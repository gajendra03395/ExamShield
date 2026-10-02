# ExamShield college deployment

## Requirements

- Windows 10/11 machines for the WPF kiosk, with WebView2 Runtime installed.
- Node.js LTS and npm for the API and web panel.
- PostgreSQL 14 or later, reachable at `127.0.0.1:5432`.
- .NET 8 SDK on the build machine. The published kiosk includes the .NET runtime.

## Configure and initialize

Set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters in `backend/.env`. For first-time setup only, also set `ADMIN_BOOTSTRAP_TOKEN` to a separate random value of at least 32 characters. Keep the file private and use unique secrets and a database password for each deployment. Install dependencies in `backend` and `web-panel`, then run `npx prisma db push` from `backend` to create/update the schema. Create the first administrator once through `POST /api/auth/bootstrap-admin` with `x-bootstrap-token` and a 12-character minimum password, then remove `ADMIN_BOOTSTRAP_TOKEN` from the API environment.

## Build and run

From the project root, run `.\build-desktop-exe.ps1` to create `dist\ExamShield.exe` as a self-contained Windows x64 executable. The kiosk still loads the web application from the local Vite server, so deploy/start both services on each kiosk or replace the Vite URL with the institution's hosted URL before publishing.

Run `.\start-examshield.ps1` to check PostgreSQL and start backend, web panel, then the kiosk. Use `.\start-examshield.ps1 -NoDesktop` to start the services only. Services listen on API port 5000 and web port 5173. Logs are written to `logs\`.

## Accounts and college setup

Students sign in with email or enrollment number. Faculty and administrators sign in with email. Student and faculty registrations begin inactive until an administrator activates them. Administrators can manage users, batches, divisions, and audit records from `/admin`; faculty use Question Bank, Test Builder, and Live Monitoring from `/faculty`. Create batch and division names in the admin panel before using them for registrations.

## Network and maintenance

Allow loopback access to ports 5000 and 5173. If the API and PostgreSQL are on separate machines, configure the API's database URL and firewall rules accordingly; do not expose PostgreSQL publicly. Back up the PostgreSQL database regularly, protect `backend/.env`, and update Node packages and Windows/WebView2 components on a maintenance schedule. Test kiosk lockdown policies with institution IT before exam deployment because Windows policy, endpoint security, and multi-display hardware can affect behavior.

During a temporary API outage, answer edits are retained in browser local storage and synchronized when the connection returns. Desktop violation reports are queued locally and retried after the API becomes reachable. Keep the exam browser profile and kiosk account protected because queued data is stored on that device.
