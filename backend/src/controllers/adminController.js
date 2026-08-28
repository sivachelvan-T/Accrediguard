const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const audit = require('../services/auditService');

async function dashboard(req, res) {
  const totals = {
    users: (await db.prepare(`SELECT COUNT(*) c FROM users WHERE deleted_at IS NULL`).get()).c,
    projects: (await db.prepare(`SELECT COUNT(*) c FROM projects WHERE deleted_at IS NULL`).get()).c,
    documents: (await db.prepare(`SELECT COUNT(*) c FROM documents WHERE deleted_at IS NULL`).get()).c,
    pendingReviews: (await db.prepare(`SELECT COUNT(*) c FROM evidence WHERE review_status = 'PENDING'`).get()).c,
    revisionRequests: (await db.prepare(`SELECT COUNT(*) c FROM reviews WHERE decision = 'REQUEST_REVISION'`).get()).c,
    approvedProjects: (await db.prepare(`SELECT COUNT(*) c FROM projects WHERE status = 'APPROVED'`).get()).c,
  };
  const avgEvidenceScore = (await db.prepare(`SELECT AVG(overall_quality) a FROM evidence`).get()).a;
  const byStatus = await db.prepare(`SELECT status, COUNT(*) count FROM projects WHERE deleted_at IS NULL GROUP BY status`).all();

  res.json({ success: true, data: { totals, avgEvidenceScore: avgEvidenceScore ? Math.round(avgEvidenceScore) : 0, projectsByStatus: byStatus } });
}

async function security(req, res) {
  const failedLogins = await db.prepare(`SELECT * FROM audit_logs WHERE action = 'FAILED_LOGIN' ORDER BY created_at DESC LIMIT 25`).all();
  const roleChanges = await db.prepare(`SELECT * FROM audit_logs WHERE action = 'ROLE_CHANGED' ORDER BY created_at DESC LIMIT 25`).all();
  res.json({ success: true, data: { failedLogins, roleChanges } });
}


async function listDepartments(req, res) {
  const rows = await db.prepare(`SELECT id, name FROM departments ORDER BY name ASC`).all();
  res.json({ success: true, data: rows });
}

async function createFaculty(req, res, next) {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ success: false, message: 'Only the Super Admin can create faculty accounts.' });
    const { name, email, password, departmentId } = req.body || {};
    if (!name || !email || !password || !departmentId) return res.status(400).json({ success: false, message: 'Name, email, password and department are required.' });
    if (String(password).length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
    if (existing) return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    const department = await db.prepare(`SELECT id FROM departments WHERE id = ?`).get(departmentId);
    if (!department) return res.status(400).json({ success: false, message: 'Selected department was not found.' });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const id = uuid();
    await db.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, 'FACULTY_REVIEWER', ?)`).run(id, String(name).trim(), normalizedEmail, passwordHash, departmentId);
    audit.record({ userId: req.user.id, action: 'USER_CREATED', resource: 'user', resourceId: id, metadata: { role: 'FACULTY_REVIEWER', departmentId }, req });
    const user = await db.prepare(`SELECT id, name, email, role, department_id, is_active, created_at FROM users WHERE id = ?`).get(id);
    res.status(201).json({ success: true, data: user });
  } catch (e) { next(e); }
}


async function createAccount(req, res, next) {
  try {
    const { name, email, password, role, departmentId } = req.body || {};
    const validRoles = ['SUPER_ADMIN','ACCREDITATION_ADMIN','FACULTY_REVIEWER','PROJECT_COORDINATOR','STUDENT','VIEWER'];

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password and role are required.' });
    }
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }
    if (req.user.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the Super Admin can create a Super Admin account.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const normalizedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedName) return res.status(400).json({ success: false, message: 'Name is required.' });
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    const existing = await db.prepare(`SELECT id FROM users WHERE email = ? AND deleted_at IS NULL`).get(normalizedEmail);
    if (existing) return res.status(409).json({ success: false, message: 'An account with that email already exists.' });

    if (departmentId) {
      const department = await db.prepare(`SELECT id FROM departments WHERE id = ?`).get(departmentId);
      if (!department) return res.status(400).json({ success: false, message: 'Selected department was not found.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);
    const id = uuid();
    await db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, department_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, normalizedName, normalizedEmail, passwordHash, role, departmentId || null);

    audit.record({
      userId: req.user.id,
      action: 'USER_CREATED',
      resource: 'user',
      resourceId: id,
      metadata: { role, departmentId: departmentId || null },
      req,
    });

    const user = await db.prepare(`
      SELECT id, name, email, role, department_id, is_active, created_at
      FROM users WHERE id = ?
    `).get(id);

    return res.status(201).json({ success: true, data: user, message: `${role.replace(/_/g, ' ')} account created successfully.` });
  } catch (e) { next(e); }
}

async function listUsers(req, res) {
  const rows = await db.prepare(`SELECT id, name, email, role, is_active, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`).all();
  res.json({ success: true, data: rows });
}

async function setUserStatus(req, res, next) {
  try {
    const { isActive } = req.body;
    await db.prepare(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(isActive ? 1 : 0, req.params.id);
    audit.record({ userId: req.user.id, action: 'USER_UPDATED', resource: 'user', resourceId: req.params.id, metadata: { isActive }, req });
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function setUserRole(req, res, next) {
  try {
    const validRoles = ['SUPER_ADMIN','ACCREDITATION_ADMIN','FACULTY_REVIEWER','PROJECT_COORDINATOR','STUDENT','VIEWER'];
    const { role } = req.body;
    if (!validRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
    await db.prepare(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`).run(role, req.params.id);
    audit.record({ userId: req.user.id, action: 'ROLE_CHANGED', resource: 'user', resourceId: req.params.id, metadata: { role }, req });
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function resetUserPassword(req, res, next) {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    const target = await db.prepare(`SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL`).get(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    if (target.id === req.user.id) return res.status(400).json({ success: false, message: 'Use My Settings to change your own password.' });
    if (target.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ success: false, message: 'Only the Super Admin can reset a Super Admin password.' });
    const hash = await bcrypt.hash(String(password), 12);
    await db.prepare(`UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(hash, target.id);
    audit.record({ userId: req.user.id, action: 'PASSWORD_RESET', resource: 'user', resourceId: target.id, req });
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (e) { next(e); }
}

async function listAuditLogs(req, res) {
  const rows = await db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200`).all();
  res.json({ success: true, data: rows });
}

module.exports = { dashboard, security, listUsers, listDepartments, createFaculty, createAccount, setUserStatus, setUserRole, resetUserPassword, listAuditLogs };
