const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_MEDIA_CHARS = 8 * 1024 * 1024;

function safe(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong' }); }
  };
}

router.post('/posts', requireAuth, safe(async (req, res) => {
  const { type, caption, mediaData } = req.body;
  if (!mediaData) return res.status(400).json({ error: 'mediaData required' });
  if (mediaData.length > MAX_MEDIA_CHARS) {
    return res.status(413).json({ error: 'File too large for the shared feed right now (roughly 3MB max) — it still shows on your own device.' });
  }
  const result = await pool.query(
    `INSERT INTO feed_posts (user_id, type, caption, media_data) VALUES ($1, $2, $3, $4)
     RETURNING id, type, caption, created_at`,
    [req.user.sub, type || 'video', (caption || '').slice(0, 300), mediaData]
  );
  res.status(201).json(result.rows[0]);
}));

router.get('/posts', safe(async (req, res) => {
  const result = await pool.query(
    `SELECT p.id, p.type, p.caption, p.media_data, p.created_at, u.id AS author_id, u.handle, u.display_name, u.verified
     FROM feed_posts p JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC LIMIT 150`
  );
  res.json(result.rows);
}));

router.delete('/posts/:id', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM feed_posts WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.sub]);
  res.status(204).end();
}));

module.exports = router;
