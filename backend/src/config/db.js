const { Pool } = require('pg');

// Production persistence uses Render Postgres when DATABASE_URL is present.
// Local development can still use SQLite by setting USE_SQLITE=true.
// The Render deployment in this package is configured for Postgres.
const useSqlite = String(process.env.USE_SQLITE || '').toLowerCase() === 'true';

function normalizeSql(sql) {
  let index = 0;
  return sql
    .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP')
    .replace(/\?/g, () => `$${++index}`);
}

let pool;
let sqliteDb;

if (useSqlite || !process.env.DATABASE_URL) {
  // Local-only fallback. Render deployment should always provide DATABASE_URL.
  const path = require('path');
  const fs = require('fs');
  const { DatabaseSync } = require('node:sqlite');
  const SQLITE_PATH = process.env.SQLITE_PATH || './data/accrediguard.db';
  const resolvedPath = path.resolve(process.cwd(), SQLITE_PATH);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  sqliteDb = new DatabaseSync(resolvedPath);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.transaction = function transaction(fn) {
    return function runInTransaction(...args) {
      sqliteDb.exec('BEGIN');
      try { const result = fn(...args); sqliteDb.exec('COMMIT'); return result; }
      catch (err) { sqliteDb.exec('ROLLBACK'); throw err; }
    };
  };
  sqliteDb.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN','ACCREDITATION_ADMIN','FACULTY_REVIEWER','PROJECT_COORDINATOR','STUDENT','VIEWER')),
  department_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS frameworks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_official INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS criteria (
  id TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL REFERENCES frameworks(id),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  keywords TEXT NOT NULL,            -- JSON array
  required_sections TEXT NOT NULL,   -- JSON array
  evidence_expectations TEXT NOT NULL, -- JSON array of strings
  min_confidence INTEGER NOT NULL DEFAULT 50,
  weight_relevance REAL NOT NULL DEFAULT 0.30,
  weight_specificity REAL NOT NULL DEFAULT 0.20,
  weight_completeness REAL NOT NULL DEFAULT 0.20,
  weight_measurability REAL NOT NULL DEFAULT 0.15,
  weight_traceability REAL NOT NULL DEFAULT 0.15,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_criteria_framework ON criteria(framework_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  department_id TEXT REFERENCES departments(id),
  academic_year TEXT,
  semester TEXT,
  coordinator_id TEXT REFERENCES users(id),
  faculty_id TEXT REFERENCES users(id),
  framework_id TEXT REFERENCES frameworks(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','UNDER_ANALYSIS','UNDER_REVIEW','REVISION_REQUIRED','APPROVED','ARCHIVED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role_in_project TEXT NOT NULL DEFAULT 'STUDENT'
);
CREATE INDEX IF NOT EXISTS idx_pm_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  latest_version INTEGER NOT NULL DEFAULT 1,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);

CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  version_number INTEGER NOT NULL,
  stored_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by TEXT REFERENCES users(id),
  page_count INTEGER,
  extracted_text_chars INTEGER,
  analysis_status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (analysis_status IN ('QUEUED','PROCESSING','COMPLETED','FAILED','NEEDS_REVIEW')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docver_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_docver_hash ON document_versions(file_hash);

CREATE TABLE IF NOT EXISTS document_pages (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  section_guess TEXT
);
CREATE INDEX IF NOT EXISTS idx_pages_docver ON document_pages(document_version_id);

CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  status TEXT NOT NULL DEFAULT 'QUEUED',
  overall_readiness REAL,
  evidence_health REAL,
  evidence_debt_level TEXT,
  traceability_index REAL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_analyses_docver ON analyses(document_version_id);

CREATE TABLE IF NOT EXISTS criterion_results (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id),
  criterion_id TEXT NOT NULL REFERENCES criteria(id),
  score REAL NOT NULL,
  band TEXT NOT NULL,          -- Strong/Adequate/Partial/Weak/Insufficient
  confidence REAL NOT NULL,
  confidence_label TEXT NOT NULL,
  missing_expectations TEXT NOT NULL, -- JSON array
  recommendation TEXT
);
CREATE INDEX IF NOT EXISTS idx_cr_analysis ON criterion_results(analysis_id);
CREATE INDEX IF NOT EXISTS idx_cr_criterion ON criterion_results(criterion_id);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id),
  criterion_id TEXT NOT NULL REFERENCES criteria(id),
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  page_number INTEGER NOT NULL,
  section TEXT,
  extracted_text TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  matched_keywords TEXT NOT NULL,   -- JSON array
  has_numeric INTEGER NOT NULL DEFAULT 0,
  relevance REAL NOT NULL,
  specificity REAL NOT NULL,
  completeness REAL NOT NULL,
  measurability REAL NOT NULL,
  traceability REAL NOT NULL,
  overall_quality REAL NOT NULL,
  confidence REAL NOT NULL,
  duplicate_of TEXT,
  contradiction_flag INTEGER NOT NULL DEFAULT 0,
  contradiction_note TEXT,
  review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING','APPROVED','REJECTED','PARTIAL','NEEDS_HUMAN_REVIEW')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evidence_analysis ON evidence(analysis_id);
CREATE INDEX IF NOT EXISTS idx_evidence_criterion ON evidence(criterion_id);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  ai_recommendation TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE','REJECT','PARTIAL','REQUEST_REVISION','NEEDS_HUMAN_REVIEW')),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_evidence ON reviews(evidence_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
`);
  try { sqliteDb.exec('ALTER TABLE document_versions ADD COLUMN file_data BLOB'); } catch (_) { /* column already exists */ }
}

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30000,
  });
}

function prepare(sql) {
  if (sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    return {
      get: async (...params) => stmt.get(...params),
      all: async (...params) => stmt.all(...params),
      run: async (...params) => stmt.run(...params),
    };
  }
  const text = normalizeSql(sql);
  return {
    get: async (...params) => {
      const result = await pool.query(text, params);
      return result.rows[0];
    },
    all: async (...params) => {
      const result = await pool.query(text, params);
      return result.rows;
    },
    run: async (...params) => {
      const result = await pool.query(text, params);
      return { changes: result.rowCount };
    },
  };
}

async function transaction(fn) {
  if (sqliteDb) return sqliteDb.transaction(fn)();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Expose a transaction-scoped prepare implementation to the callback.
    const txDb = {
      prepare(sql) {
        const text = normalizeSql(sql);
        return {
          get: async (...params) => (await client.query(text, params)).rows[0],
          all: async (...params) => (await client.query(text, params)).rows,
          run: async (...params) => ({ changes: (await client.query(text, params)).rowCount }),
        };
      },
    };
    const result = await fn(txDb);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function init() {
  if (sqliteDb) return;
  const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN','ACCREDITATION_ADMIN','FACULTY_REVIEWER','PROJECT_COORDINATOR','STUDENT','VIEWER')),
  department_id TEXT, is_active INTEGER NOT NULL DEFAULT 1, failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text);
CREATE TABLE IF NOT EXISTS frameworks (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_official INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text);
CREATE TABLE IF NOT EXISTS criteria (
  id TEXT PRIMARY KEY, framework_id TEXT NOT NULL REFERENCES frameworks(id), code TEXT NOT NULL, title TEXT NOT NULL,
  description TEXT, keywords TEXT NOT NULL, required_sections TEXT NOT NULL, evidence_expectations TEXT NOT NULL,
  min_confidence INTEGER NOT NULL DEFAULT 50, weight_relevance REAL NOT NULL DEFAULT 0.30, weight_specificity REAL NOT NULL DEFAULT 0.20,
  weight_completeness REAL NOT NULL DEFAULT 0.20, weight_measurability REAL NOT NULL DEFAULT 0.15, weight_traceability REAL NOT NULL DEFAULT 0.15,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);
CREATE INDEX IF NOT EXISTS idx_criteria_framework ON criteria(framework_id);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, department_id TEXT REFERENCES departments(id), academic_year TEXT, semester TEXT,
  coordinator_id TEXT REFERENCES users(id), faculty_id TEXT REFERENCES users(id), framework_id TEXT REFERENCES frameworks(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','UNDER_ANALYSIS','UNDER_REVIEW','REVISION_REQUIRED','APPROVED','ARCHIVED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE TABLE IF NOT EXISTS project_members (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES users(id), role_in_project TEXT NOT NULL DEFAULT 'STUDENT');
CREATE INDEX IF NOT EXISTS idx_pm_project ON project_members(project_id); CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), original_filename TEXT NOT NULL, stored_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, latest_version INTEGER NOT NULL DEFAULT 1, uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), version_number INTEGER NOT NULL, stored_path TEXT NOT NULL,
  file_hash TEXT NOT NULL, size_bytes INTEGER NOT NULL, uploaded_by TEXT REFERENCES users(id), page_count INTEGER, extracted_text_chars INTEGER,
  analysis_status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (analysis_status IN ('QUEUED','PROCESSING','COMPLETED','FAILED','NEEDS_REVIEW')),
  file_data BYTEA, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);
CREATE INDEX IF NOT EXISTS idx_docver_document ON document_versions(document_id); CREATE INDEX IF NOT EXISTS idx_docver_hash ON document_versions(file_hash);
CREATE TABLE IF NOT EXISTS document_pages (id TEXT PRIMARY KEY, document_version_id TEXT NOT NULL REFERENCES document_versions(id), page_number INTEGER NOT NULL, text TEXT NOT NULL, char_count INTEGER NOT NULL, section_guess TEXT);
CREATE INDEX IF NOT EXISTS idx_pages_docver ON document_pages(document_version_id);
CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, document_version_id TEXT NOT NULL REFERENCES document_versions(id), status TEXT NOT NULL DEFAULT 'QUEUED', overall_readiness REAL, evidence_health REAL, evidence_debt_level TEXT, traceability_index REAL, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text, completed_at TEXT, error_message TEXT);
CREATE INDEX IF NOT EXISTS idx_analyses_docver ON analyses(document_version_id);
CREATE TABLE IF NOT EXISTS criterion_results (id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL REFERENCES analyses(id), criterion_id TEXT NOT NULL REFERENCES criteria(id), score REAL NOT NULL, band TEXT NOT NULL, confidence REAL NOT NULL, confidence_label TEXT NOT NULL, missing_expectations TEXT NOT NULL, recommendation TEXT);
CREATE INDEX IF NOT EXISTS idx_cr_analysis ON criterion_results(analysis_id); CREATE INDEX IF NOT EXISTS idx_cr_criterion ON criterion_results(criterion_id);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL REFERENCES analyses(id), criterion_id TEXT NOT NULL REFERENCES criteria(id), document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  page_number INTEGER NOT NULL, section TEXT, extracted_text TEXT NOT NULL, evidence_type TEXT NOT NULL, matched_keywords TEXT NOT NULL,
  has_numeric INTEGER NOT NULL DEFAULT 0, relevance REAL NOT NULL, specificity REAL NOT NULL, completeness REAL NOT NULL, measurability REAL NOT NULL, traceability REAL NOT NULL,
  overall_quality REAL NOT NULL, confidence REAL NOT NULL, duplicate_of TEXT, contradiction_flag INTEGER NOT NULL DEFAULT 0, contradiction_note TEXT,
  review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING','APPROVED','REJECTED','PARTIAL','NEEDS_HUMAN_REVIEW')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text
);
CREATE INDEX IF NOT EXISTS idx_evidence_analysis ON evidence(analysis_id); CREATE INDEX IF NOT EXISTS idx_evidence_criterion ON evidence(criterion_id);
CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL REFERENCES evidence(id), reviewer_id TEXT NOT NULL REFERENCES users(id), ai_recommendation TEXT NOT NULL, decision TEXT NOT NULL CHECK (decision IN ('APPROVE','REJECT','PARTIAL','REQUEST_REVISION','NEEDS_HUMAN_REVIEW')), comment TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text);
CREATE INDEX IF NOT EXISTS idx_reviews_evidence ON reviews(evidence_id);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL, link TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, resource TEXT, resource_id TEXT, metadata TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::text);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at); CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
`;
  await pool.query(schema);
}

module.exports = { prepare, transaction, init, isPostgres: () => !!pool };
