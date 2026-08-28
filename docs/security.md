# Security

- **Passwords**: bcrypt (cost 12), never logged or returned by any endpoint.
- **Sessions**: stateless JWT (`JWT_SECRET` from env), default 8h expiry.
- **Account protection**: 5 failed logins locks the account for 15 minutes.
  Login errors are generic ("Invalid email or password") to avoid
  enumeration.
- **RBAC**: enforced in `backend/src/middleware/auth.js` (`authorize(...)`)
  on every protected route. The frontend's route guards are UX only.
- **Object-level authorization**: project/document access is checked
  against membership/ownership/role on every request
  (`projectController.canAccessProject`), not just role — a student cannot
  fetch another student's project by guessing its ID.
- **File upload**: PDF-only, validated by extension + MIME type + magic
  bytes (`%PDF-`); server-generated UUID filenames (no path traversal);
  10MB/file, 5 files/request caps.
- **Headers**: Helmet with a restrictive CSP, `X-Content-Type-Options`,
  `Referrer-Policy: no-referrer`, `frameAncestors: 'none'`.
- **CORS**: explicit allow-list from `FRONTEND_URL`, never `*`.
- **Rate limiting**: separate limiters for auth, upload, and general traffic.
- **SQL injection**: all queries use parameterized statements via
  `node:sqlite`'s prepared statements (`db.prepare(...).run(...)`) — no
  string concatenation.
- **XSS**: extracted PDF text is rendered as plain text in React (never
  `dangerouslySetInnerHTML`), so it can't execute as HTML.
- **Audit log**: append-only `audit_logs` table; no route updates or
  deletes rows in it.
- **Error handling**: stack traces are only included in non-production
  responses (`NODE_ENV !== 'production'`).
