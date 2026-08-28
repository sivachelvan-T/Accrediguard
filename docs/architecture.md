# Architecture

## Overview
AccrediGuard AI is a two-tier application: a React SPA (frontend) and a
Node/Express API (backend). The backend owns all business logic and is the
sole source of authorization truth. The frontend never trusts itself to
decide what a user is allowed to do — it only reflects what the backend
returns and hides UI accordingly for convenience.

## Core pipeline
`backend/src/services/analysisEngine/` implements the product's central
differentiator, run synchronously on upload:

```
documentExtractor  -> per-page text via pdf-parse
sectionDetector     -> fuzzy heading matching, section carried across pages
keywordExtractor    -> per-criterion keyword/phrase overlap scoring
evidenceDetector     -> builds evidence candidates with snippets & type
integrityEngine      -> relevance/specificity/completeness/measurability/traceability
numericEvidenceDetector / referenceDetector -> quantitative & citation signals
duplicateDetector    -> flags reused text across evidence items
contradictionDetector -> flags materially different values for the same metric
confidenceEngine     -> separates "quality score" from "confidence"
recommendationEngine -> builds the human-readable explanation + missing list
index.js (orchestrator) -> persists analyses/criterion_results/evidence
```

Every module is pure/deterministic and requires no external API key.

## Database
SQLite is used for local/dev and the Render demo deployment, matching the
schema in `backend/src/config/db.js`. It uses Node's **built-in**
`node:sqlite` module (`DatabaseSync`) rather than the third-party
`better-sqlite3` package, specifically so `npm install` never needs to
compile a native addon — no Visual Studio Build Tools on Windows, no
build-essential on Linux, no Xcode Command Line Tools on Mac. Requires
Node.js **>= 22.13.0** (ships flag-free from that version onward; earlier
22.x releases need `--experimental-sqlite`).

`node:sqlite` doesn't ship the `db.transaction(fn)` convenience helper
that `better-sqlite3` has, so `db.js` adds a small drop-in polyfill with
the same call shape, used by the analysis engine's bulk-insert
transactions (page/evidence/criterion-result batches).

The schema is written in portable SQL (no SQLite-only extensions beyond
`datetime('now')`) so a Postgres port is a matter of swapping the driver
and adapting a handful of `datetime()`/autoincrement differences — this is
a documented next step, not yet implemented.

**Known limitation:** Render's free web service disk is ephemeral. SQLite
data (and uploaded files) will not survive a redeploy or dyno restart on
the free tier. For any persistent production use, either (a) attach a
Render Disk to the backend service, or (b) provision a managed Postgres
instance and complete the driver swap described above. This is called out
in `docs/deployment.md`.

## Storage abstraction
`backend/src/services/documentService/storageProvider.js` exposes
`LocalStorageProvider` behind a small interface (`hashFile`, `deleteFile`,
`readFile`). Swapping in an S3-compatible provider later does not require
touching controllers.

## What is NOT yet built
This is a large product spec. The following are intentionally out of scope
for this initial build and are documented here rather than faked:
- Document version comparison UI (backend versioning + hashing exists; the
  diff view does not)
- Evidence graph / claim-evidence map visualization
- CSV/PDF report export
- In-app PDF page viewer (documents are served for download/inline view;
  there's no page-by-page annotated viewer)
- Full automated test suite covering all 17 security scenarios (a starter
  suite is in `backend/test/`)
