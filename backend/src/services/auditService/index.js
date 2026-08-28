const { v4: uuid } = require('uuid');
const db = require('../../config/db');

// Audit log records are append-only by convention: no route in this
// application ever UPDATEs or DELETEs a row in audit_logs.
async function record({ userId = null, action, resource = null, resourceId = null, metadata = null, req = null }) {
  const stmt = await db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, resource, resource_id, metadata, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(
    uuid(),
    userId,
    action,
    resource,
    resourceId,
    metadata ? JSON.stringify(metadata) : null,
    req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null,
    req ? (req.headers['user-agent'] || null) : null,
  );
}

async function list({ limit = 100, offset = 0 } = {}) {
  return await db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
}

module.exports = { record, list };
