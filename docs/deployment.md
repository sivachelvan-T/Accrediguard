# Deployment (Render)

This project deploys as **one Render Web Service**. The build compiles the
React frontend to static files and the Node/Express backend serves both
the compiled frontend *and* the `/api/*` routes from the same origin —
there's no separate frontend service, no CORS to configure, and no
`VITE_API_BASE_URL` to set in production (the frontend defaults to the
same-origin `/api` path automatically).

## Deploy via Blueprint (recommended)
1. Push this repo to GitHub (or GitLab).
2. In the Render dashboard: **New +** → **Blueprint** → select the repo.
   Render reads `render.yaml` at the repo root and provisions the service
   automatically, including a random `JWT_SECRET`.
3. Before the first deploy finishes, open the service's **Environment**
   tab and set `FRONTEND_URL` to the service's own Render URL, e.g.
   `https://accrediguard-ai.onrender.com` (Render shows you the assigned
   URL once the service is created — it may not exactly match the
   placeholder already in `render.yaml`). This value is used for CORS.
4. Deploy. The build runs:
   ```
   npm install --prefix backend
   npm install --include=dev --prefix frontend && npm run build --prefix frontend
   ```
   and the start command runs:
   ```
   npm run seed --prefix backend && npm start --prefix backend
   ```
   which loads demo data and starts the server serving both the API and
   the built frontend.
5. Render polls `GET /api/health` automatically (`healthCheckPath` in
   `render.yaml`) to know when the service is live.

## Deploy manually (without Blueprint)
1. **New +** → **Web Service** → connect the repo.
2. Runtime: **Node**. Build command:
   ```
   npm install --prefix backend && npm install --include=dev --prefix frontend && npm run build --prefix frontend
   ```
3. Start command:
   ```
   npm run seed --prefix backend && npm start --prefix backend
   ```
4. Add environment variables (see `backend/.env.example` for the full
   list): at minimum `NODE_ENV=production`, `JWT_SECRET` (generate a long
   random string), `FRONTEND_URL` (this service's own URL), and
   `SQLITE_PATH=./data/accrediguard.db`.
5. Set health check path to `/api/health`.

## Re-seeding demo data
The start command re-runs the seed script on every deploy/restart, which
resets demo accounts and sample data. If you want to preserve real data
between deploys instead, remove `npm run seed --prefix backend &&` from
the start command after the first successful deploy — but read the
ephemeral disk warning below first, since without a persistent disk
there's nothing to preserve anyway.

## Ephemeral disk warning
Render's default web service filesystem is **not persistent** across
deploys or restarts — every redeploy wipes the SQLite database and any
uploaded files. For a real (non-demo) deployment:
- Attach a [Render Disk](https://render.com/docs/disks) to this service
  and point `SQLITE_PATH` and `UPLOAD_DIR` at paths under the mounted
  disk (e.g. `/var/data/accrediguard.db`, `/var/data/uploads`), **or**
- Provision Render Postgres and complete the Postgres driver swap noted
  in `docs/architecture.md`.

For a demo/portfolio deployment, ephemeral storage is fine — the seed
script re-populates demo accounts and sample data on every restart.

## Environment variables
See `backend/.env.example` for the full list with descriptions. Never
commit a real `.env` file. `JWT_SECRET` must be a long random value in
production — the Blueprint's `generateValue: true` handles this for you;
if deploying manually, generate one yourself (e.g. `openssl rand -hex 32`).

## Verifying the deployment
Once live, open the service URL in a browser — you should see the
AccrediGuard AI landing page, not a 404 or blank page. Log in with one of
the demo accounts printed by the seed script (see `backend/src/seed/seed.js`
or run `npm run seed --prefix backend` locally to see the full list; all
demo accounts use the password `Demo@1234`).
