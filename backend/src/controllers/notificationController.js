const db = require('../config/db');

async function listNotifications(req, res) {
  const rows = await db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`).all(req.user.id);
  res.json({ success: true, data: rows });
}

async function markRead(req, res) {
  await db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  res.json({ success: true });
}

module.exports = { listNotifications, markRead };
