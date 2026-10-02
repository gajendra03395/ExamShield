# API reference

Base URL: `http://127.0.0.1:5000/api`. Protected routes use `Authorization: Bearer <token>`. JSON errors use an `error` or `message` field. The API checks the PostgreSQL connection at `GET /health` and returns HTTP 503 while the database is unavailable.

## Authentication and registration

- `POST /auth/login`: `{ "identifier": "email-or-enrollment", "password": "…", "role": "STUDENT|FACULTY|ADMIN" }`
- `GET /auth/options`: configured registration batches and divisions.
- `POST /auth/register/student`: student self-registration. New accounts remain inactive until admin approval.
- `POST /auth/register/faculty`: faculty registration. New accounts remain inactive until admin approval.
- `POST /auth/bootstrap-admin`: one-time initial administrator creation. Requires `ADMIN_BOOTSTRAP_TOKEN` (at least 32 random characters) in the `x-bootstrap-token` header, and only works while there are no admin records. Remove the bootstrap token from the environment after the first admin is created.
- `GET /auth/me`: current authenticated identity.

Set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters in `backend/.env`. Do not use the bootstrap endpoint as routine account provisioning.

## Faculty endpoints

- `GET/POST /questions`
- `GET /tests/faculty`, `POST /tests`, `PUT /tests/:id`, `PUT /tests/:id/questions`, `POST /tests/:id/publish`
- `GET /tests/:id/live-monitor`
- `GET /grading/test/:testId/submissions`
- `GET /grading/submission/:studentTestId`
- `POST /grading/submission/:studentTestId/grade-question`
- `POST /grading/test/:testId/publish-results`
- `GET /grading/test/:testId/analytics`
- `GET /grading/test/:testId/export/csv` and `/export/excel`

Only the test owner can edit, publish, grade, or monitor that test. Tests must have at least one selected question, and their total marks are set from the selected questions.

## Student exam endpoints

- `GET /exam/available`
- `POST /exam/start/:testId`
- `GET /exam/session/:studentTestId`
- `POST /exam/session/:studentTestId/answer`
- `POST /exam/session/:studentTestId/heartbeat`
- `POST /exam/session/:studentTestId/submit`
- `POST /exam/violation`
- `GET /grading/student/results` and `GET /grading/student/result/:studentTestId`

The server validates enrollment, active account state, test assignment, test publication, answer ownership, and exam deadlines. Answer and violation writes are idempotent where the client supplies its event identity.

## Administration endpoints

All routes require an active `ADMIN` identity:

- `GET /admin/overview`
- `GET/POST /admin/batches` and `/admin/divisions`
- `GET /admin/users`
- `PATCH /admin/users/:role/:id/active` with `{ "isActive": true|false }`
- `GET /admin/audit-logs?take=200` (maximum 500)
