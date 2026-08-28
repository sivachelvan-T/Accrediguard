# Testing

`backend/test/` contains a starter suite using Node's built-in test runner
(`node --test`), covering:
- password validation rules
- JWT-based auth middleware rejecting missing/invalid tokens
- the analysis engine's keyword/numeric/section detectors on sample text

Run with:
```
cd backend
npm test
```

**Not yet covered** (see docs/architecture.md for full list of gaps): the
full 17-scenario security checklist from the product spec (brute force,
IDOR across roles, XSS/SQLi payloads, CORS violations, oversized/faked
PDF uploads, path traversal filenames). These are documented as the next
testing milestone rather than stubbed out with fake passing tests.

Frontend currently has no automated tests; manual QA checklist is in the
root README.

## Fixed end-to-end demo workflow

1. Log in as a Student.
2. Create a project. The application now assigns the configured framework automatically if one is not supplied, records the student's department, and auto-assigns an active Faculty Reviewer (preferring the same department).
3. Upload a PDF report. The project is moved through `UNDER_ANALYSIS` to `UNDER_REVIEW` after successful analysis.
4. Log in as the assigned Faculty Reviewer. The project is visible because the backend checks the stored `faculty_id`; reviewer access is not based on frontend hiding.
5. Review evidence. `REQUEST_REVISION` or `REJECT` changes the project to `REVISION_REQUIRED` and notifies the coordinator when one exists.
6. After revision, the coordinator can submit the project again. A faculty reviewer can approve only from `UNDER_REVIEW` and only after pending/partial/human-review evidence has been resolved.
7. Super Admin and Accreditation Admin can review institution-wide projects and manage final workflow actions.

### Framework safety

New projects must have a framework with criteria. Legacy projects without a framework are repaired automatically when a PDF is uploaded by selecting the first configured framework (official frameworks are preferred). The analysis engine also refuses to silently produce a zero-criterion analysis when no framework is configured.
