const express = require('express');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function safe(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong' }); }
  };
}

router.get('/admin/users', requireAdmin, safe(async (req, res) => {
  const r = await pool.query(
    `SELECT id, handle, display_name, email, verified, is_banned, invited_by, created_at FROM users ORDER BY created_at DESC`
  );
  res.json(r.rows);
}));

router.get('/admin/growth', requireAdmin, safe(async (req, res) => {
  const r = await pool.query(
    `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS count
     FROM users
     WHERE created_at > now() - interval '7 days'
     GROUP BY day ORDER BY day ASC`
  );
  res.json(r.rows);
}));

// Real platform revenue — VELTEX's actual cut of every gift sent, tracked live.
router.get('/admin/revenue', requireAdmin, safe(async (req, res) => {
  const total = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM platform_revenue`);
  const today = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM platform_revenue WHERE created_at > now() - interval '1 day'`);
  res.json({ totalCoins: parseInt(total.rows[0].total, 10), todayCoins: parseInt(today.rows[0].total, 10) });
}));

router.post('/admin/users/:id/verify', requireAdmin, safe(async (req, res) => {
  const r = await pool.query(`UPDATE users SET verified = NOT verified WHERE id = $1 RETURNING verified`, [req.params.id]);
  res.json(r.rows[0]);
}));

router.post('/admin/users/:id/ban', requireAdmin, safe(async (req, res) => {
  const r = await pool.query(`UPDATE users SET is_banned = NOT is_banned WHERE id = $1 RETURNING is_banned`, [req.params.id]);
  res.json(r.rows[0]);
}));

// Real broadcast — sends one message from the admin's own real account to
// every other real user, landing in their genuine inbox as a normal message.
router.post('/admin/broadcast', requireAdmin, safe(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Broadcast text required' });
  const clean = text.trim().slice(0, 1000);
  const users = await pool.query(`SELECT id FROM users WHERE id != $1`, [req.user.sub]);
  for (const u of users.rows) {
    await pool.query(
      `INSERT INTO messages (from_user_id, to_user_id, text) VALUES ($1, $2, $3)`,
      [req.user.sub, u.id, clean]
    );
  }
  res.json({ sentTo: users.rows.length });
}));

router.post('/admin/users/:id/grant-coins', requireAdmin, safe(async (req, res) => {
  const amount = parseInt(req.body.amount, 10);
  if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });
  const r = await pool.query(`UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins`, [amount, req.params.id]);
  res.json(r.rows[0]);
}));

router.post('/admin/users/:id/rank', requireAdmin, safe(async (req, res) => {
  const rank = (req.body.rank || '').trim().slice(0, 40);
  const r = await pool.query(`UPDATE users SET rank = $1 WHERE id = $2 RETURNING rank`, [rank || null, req.params.id]);
  res.json(r.rows[0]);
}));

module.exports = router;
