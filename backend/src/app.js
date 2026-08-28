require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { generalLimiter, analysisLimiter } = require('./middleware/rateLimiters');
const { authenticate } = require('./middleware/auth');
const { listFrameworks, createFramework, updateFramework, deleteFramework } = require('./controllers/criteriaController');
const { authorize } = require('./middleware/auth');
const { ROLES } = require('./config/roles');
const FRAMEWORK_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN];

const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const documentRoutes = require('./routes/document.routes');
const criteriaRoutes = require('./routes/criteria.routes');
const reviewRoutes = require('./routes/review.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
}));

// Never wildcard CORS in production — only the configured frontend origin
// (and localhost in dev) may call this API.
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(generalLimiter);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/criteria', criteriaRoutes);
// criteriaRoutes also exposes GET /api/criteria/frameworks; this top-level
// alias is what the frontend actually calls, so it must be a real route
// (mounting the whole router again here would shadow it with listCriteria).
app.get('/api/frameworks', authenticate, listFrameworks);
app.post('/api/frameworks', authenticate, authorize(...FRAMEWORK_ADMIN_ROLES), createFramework);
app.patch('/api/frameworks/:id', authenticate, authorize(...FRAMEWORK_ADMIN_ROLES), updateFramework);
app.delete('/api/frameworks/:id', authenticate, authorize(...FRAMEWORK_ADMIN_ROLES), deleteFramework);
app.use('/api/evidence', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// In production Render deploys the React app from the same Web Service.
// Keeping the frontend and API on one origin avoids CORS/VITE URL issues.
// IMPORTANT: resolve this relative to this file (__dirname), not
// process.cwd(). Render's start command is `npm start --prefix backend`,
// which runs the script with its cwd set to backend/ — resolving from
// process.cwd() would look for backend/frontend/dist, which never exists.
// This file lives at backend/src/app.js, so go up two levels to the repo
// root, then into frontend/dist.
const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

// Serve the Vite production build from the repository root.
// Render runs `npm start --prefix backend`, so __dirname is backend/src.
// Resolve from __dirname rather than process.cwd() so the path remains
// correct on Render and in local production-style runs.
const frontendIndex = path.join(frontendDist, 'index.html');

// Vite emits hashed assets under /assets. Serve this path explicitly so
// missing/incorrect SPA routes can never turn JS/CSS requests into HTML.
app.use('/assets', express.static(path.join(frontendDist, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Serve the remaining public frontend files. Do not cache index.html so a
// newly deployed bundle is picked up immediately instead of showing an old
// application shell after login. Hashed /assets files remain long-cacheable.
app.use(express.static(frontendDist, {
  index: false,
  maxAge: 0,
  etag: true,
}));

// SPA fallback: API routes and asset requests must never be rewritten to
// index.html. This allows React Router routes such as /login and /criteria
// to work when the browser is refreshed.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) return next();
  res.sendFile(frontendIndex, (err) => {
    if (err) next(err);
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
