# API Reference (summary)

Base path: `/api`

## Auth
- `POST /auth/register` — creates a STUDENT account
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`

## Projects
- `GET /projects` — scoped to what the caller can access
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id` — status transitions
- `POST /projects/:projectId/documents` — multipart upload, `file` field, triggers analysis

## Documents
- `GET /documents/:id/analysis`
- `GET /documents/:id/versions`
- `GET /documents/:id/download`

## Criteria
- `GET /frameworks`
- `GET /criteria?frameworkId=`

## Evidence / Reviews
- `POST /evidence/:evidenceId/review` — body `{ decision, comment }`
- `GET /evidence/:evidenceId/reviews`

## Admin (SUPER_ADMIN / ACCREDITATION_ADMIN)
- `GET /admin/dashboard`
- `GET /admin/security`
- `GET /admin/audit-logs`
- `GET /admin/users`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/role` (SUPER_ADMIN only)

## Notifications
- `GET /notifications`
- `PATCH /notifications/:id/read`

## Health
- `GET /health` — `{ status, service, version }`

All responses are `{ success: boolean, data?, message? }`. Every
non-health, non-auth route requires `Authorization: Bearer <token>`.
