const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { AppError } = require('./errorHandler');

// Verifies the JWT and attaches req.user. Never trusts client-supplied
// role/id claims beyond what's in the signed token; re-reads the user
// row so a deactivated/deleted account is rejected immediately.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Authentication required.', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.prepare(`SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`).get(payload.sub);

    if (!user) throw new AppError('Account no longer exists.', 401);
    if (!user.is_active) throw new AppError('Account is deactivated.', 403);

    req.user = { id: user.id, email: user.email, role: user.role, name: user.name, departmentId: user.department_id };
    next();
  } catch (e) {
    if (e instanceof AppError) return next(e);
    return next(new AppError('Invalid or expired session.', 401));
  }
}

// Backend authorization is the source of truth; the frontend only hides
// buttons for UX. Every protected route re-checks req.user.role here.
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required.', 401));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
