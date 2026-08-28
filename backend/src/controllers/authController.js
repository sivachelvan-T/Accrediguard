const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { validatePasswordStrength } = require('../services/securityService/password');
const audit = require('../services/auditService');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function sanitizeUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, departmentId: u.department_id, isActive: !!u.is_active };
}

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.validated;

    const strength = validatePasswordStrength(password);
    if (!strength.valid) throw new AppError(strength.errors.join(' '), 400);

    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (existing) throw new AppError('Registration failed. Please check your details.', 400); // no user enumeration

    const hash = await bcrypt.hash(password, 12);
    const id = uuid();
    // Public self-registration always creates STUDENT accounts; any other
    // role must be provisioned by an admin via /api/users.
    const assignedRole = role === 'STUDENT' || !role ? 'STUDENT' : 'STUDENT';

    await db.prepare(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(id, name, email.toLowerCase(), hash, assignedRole);

    audit.record({ userId: id, action: 'USER_CREATED', resource: 'user', resourceId: id, req });

    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    const token = signToken(user);
    res.status(201).json({ success: true, data: { token, user: sanitizeUser(user) } });
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.validated;
    const user = await db.prepare(`SELECT * FROM users WHERE email = ? AND deleted_at IS NULL`).get(email.toLowerCase());

    // Generic error for both "no such user" and "wrong password" — avoids
    // username enumeration.
    const genericError = () => new AppError('Invalid email or password.', 401);

    if (!user) { audit.record({ action: 'FAILED_LOGIN', metadata: { email }, req }); throw genericError(); }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      audit.record({ userId: user.id, action: 'FAILED_LOGIN', metadata: { reason: 'locked' }, req });
      throw new AppError('Account temporarily locked due to repeated failed attempts. Try again later.', 423);
    }

    if (!user.is_active) throw new AppError('Account is deactivated. Contact an administrator.', 403);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const failedCount = user.failed_login_count + 1;
      let lockedUntil = null;
      if (failedCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
      }
      await db.prepare(`UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?`).run(failedCount, lockedUntil, user.id);
      audit.record({ userId: user.id, action: 'FAILED_LOGIN', req });
      throw genericError();
    }

    await db.prepare(`UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?`).run(user.id);
    audit.record({ userId: user.id, action: 'LOGIN', req });

    const token = signToken(user);
    res.json({ success: true, data: { token, user: sanitizeUser(user) } });
  } catch (e) { next(e); }
}

async function me(req, res) {
  const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  res.json({ success: true, data: sanitizeUser(user) });
}

async function updateProfile(req, res, next) {
  try {
    const { name, email } = req.body || {};
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedName || !normalizedEmail) throw new AppError('Name and email are required.', 400);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new AppError('Please provide a valid email address.', 400);
    const existing = await db.prepare(`SELECT id FROM users WHERE email = ? AND id <> ? AND deleted_at IS NULL`).get(normalizedEmail, req.user.id);
    if (existing) throw new AppError('An account with that email already exists.', 409);
    await db.prepare(`UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(normalizedName, normalizedEmail, req.user.id);
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
    audit.record({ userId: req.user.id, action: 'USER_UPDATED', resource: 'user', resourceId: req.user.id, metadata: { fields: ['name', 'email'] }, req });
    res.json({ success: true, data: sanitizeUser(user) });
  } catch (e) { next(e); }
}

async function logout(req, res) {
  audit.record({ userId: req.user.id, action: 'LOGOUT', req });
  // Stateless JWT: logout is client-side (token discard). Documented in README.
  res.json({ success: true, message: 'Logged out.' });
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new AppError('Current and new password are required.', 400);
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) throw new AppError(strength.errors.join(' '), 400);

    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) throw new AppError('Current password is incorrect.', 400);

    const hash = await bcrypt.hash(newPassword, 12);
    await db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, user.id);
    audit.record({ userId: user.id, action: 'PASSWORD_CHANGED', req });

    res.json({ success: true, message: 'Password updated.' });
  } catch (e) { next(e); }
}

module.exports = { register, login, me, logout, changePassword, updateProfile };
