# Render single-service deployment

This project is configured so `accrediguard-ai` serves both the React/Vite frontend and the Express API from the same Render Web Service.

- Frontend: `/` and React routes
- Static Vite assets: `/assets/*`
- API: `/api/*`
- Database: PostgreSQL via `DATABASE_URL`

The frontend API client uses `/api`, so the browser stays on the same origin.

The Express server resolves `frontend/dist` relative to `backend/src`, serves hashed assets with long-lived caching, and deliberately does not cache `index.html`. This prevents an old application shell from being retained after a deployment.

## Render settings

Use the repository root as the Render service root.

Build command:

```text
npm ci --prefix backend && npm ci --include=dev --prefix frontend && npm run build --prefix frontend && test -f frontend/dist/index.html
```

Start command:

```text
npm run seed --prefix backend && npm start --prefix backend
```

Health check:

```text
/api/health
```

Required production environment variables include `NODE_ENV=production`, `FRONTEND_URL=https://accrediguard-ai.onrender.com`, `DATABASE_URL` from the Render PostgreSQL database, `USE_SQLITE=false`, and a generated `JWT_SECRET`.
