const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function safe(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong' }); }
  };
}

router.get('/users/search', safe(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const r = await pool.query(`SELECT id, handle, display_name, verified FROM users WHERE handle ILIKE $1 OR display_name ILIKE $1 ORDER BY verified DESC, handle ASC LIMIT 20`, ['%' + q + '%']);
  res.json(r.rows);
}));

router.get('/users/:handle/profile', safe(async (req, res) => {
  const r = await pool.query(`SELECT id, handle, display_name, bio, verified, rank, created_at,
      (SELECT COUNT(*) FROM follows WHERE followee_id = users.id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following,
      (SELECT COUNT(*) FROM gifts_sent WHERE to_user_id = users.id) AS gifts_received
    FROM users WHERE handle = $1`, [req.params.handle]);
  if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(r.rows[0]);
}));

router.get('/users/me/live-eligibility', requireAuth, safe(async (req, res) => {
  const u = await pool.query(`SELECT verified FROM users WHERE id = $1`, [req.user.sub]);
  const followers = await pool.query(`SELECT COUNT(*) FROM follows WHERE followee_id = $1`, [req.user.sub]);
  const likes = await pool.query(
    `SELECT COUNT(*) FROM likes l JOIN feed_posts p ON p.id::text = l.video_id::text WHERE p.user_id = $1`,
    [req.user.sub]
  );
  const followerCount = parseInt(followers.rows[0].count, 10);
  const likeCount = parseInt(likes.rows[0].count, 10);
  const verified = u.rows[0]?.verified || false;
  const eligible = verified || (followerCount >= 100 && likeCount >= 100);
  res.json({ eligible, followerCount, likeCount, verified, required: 100 });
}));

router.post('/videos/:id/like', requireAuth, safe(async (req, res) => {
  await pool.query(`INSERT INTO likes (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.delete('/videos/:id/like', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM likes WHERE user_id = $1 AND video_id = $2`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.post('/videos/:id/comments', requireAuth, safe(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });
  const r = await pool.query(`INSERT INTO comments (video_id, user_id, text) VALUES ($1, $2, $3) RETURNING *`, [req.params.id, req.user.sub, text.trim().slice(0, 500)]);
  res.status(201).json(r.rows[0]);
}));

router.get('/videos/:id/comments', safe(async (req, res) => {
  const r = await pool.query(`SELECT c.*, u.handle, u.display_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.video_id = $1 ORDER BY c.created_at ASC`, [req.params.id]);
  res.json(r.rows);
}));

router.post('/users/:id/follow', requireAuth, safe(async (req, res) => {
  if (req.user.sub === req.params.id) return res.status(400).json({ error: "Can't follow yourself" });
  await pool.query(`INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.delete('/users/:id/follow', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.get('/users/my-invites', requireAuth, safe(async (req, res) => {
  const r = await pool.query(`SELECT handle, display_name, verified, created_at FROM users WHERE invited_by = $1 ORDER BY created_at DESC`, [req.user.handle]);
  res.json(r.rows);
}));

router.get('/users/me/following', requireAuth, safe(async (req, res) => {
  const r = await pool.query(`SELECT followee_id FROM follows WHERE follower_id = $1`, [req.user.sub]);
  res.json(r.rows.map(row => row.followee_id));
}));

router.delete('/users/me', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [req.user.sub]);
  res.status(204).end();
}));

router.post('/auth/change-password', requireAuth, safe(async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const r = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.sub]);
  if (!r.rows.length) return res.status(404).json({ error: 'Account not found' });
  const valid = await bcrypt.compare(currentPassword || '', r.rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, req.user.sub]);
  res.status(204).end();
}));

router.get('/users/me/coins', requireAuth, safe(async (req, res) => {
  const r = await pool.query(`SELECT coins, earnings_balance FROM users WHERE id = $1`, [req.user.sub]);
  res.json(r.rows[0] || { coins: 0, earnings_balance: 0 });
}));

router.post('/gifts', requireAuth, safe(async (req, res) => {
  const { toUserId, giftType, coinCost } = req.body;
  if (!toUserId || !giftType || !coinCost || coinCost < 1) return res.status(400).json({ error: 'Invalid gift request' });
  if (toUserId === req.user.sub) return res.status(400).json({ error: "Can't gift yourself" });

  const PLATFORM_CUT = 0.30; // VELTEX keeps 30%, same idea as TikTok's real gift economy
  const recipientShare = Math.floor(coinCost * (1 - PLATFORM_CUT));
  const platformShare = coinCost - recipientShare;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sender = await client.query(`SELECT coins FROM users WHERE id = $1 FOR UPDATE`, [req.user.sub]);
    if (!sender.rows.length || sender.rows[0].coins < coinCost) {
      await client.query('ROLLBACK');
      return res.status(402).json({ error: 'Not enough coins' });
    }
    await client.query(`UPDATE users SET coins = coins - $1 WHERE id = $2`, [coinCost, req.user.sub]);
    await client.query(`UPDATE users SET earnings_balance = earnings_balance + $1 WHERE id = $2`, [recipientShare, toUserId]);
    await client.query(
      `INSERT INTO gifts_sent (from_user_id, to_user_id, gift_type, coin_cost) VALUES ($1, $2, $3, $4)`,
      [req.user.sub, toUserId, giftType, coinCost]
    );
    await client.query(
      `INSERT INTO platform_revenue (source, amount) VALUES ('gift', $1)`,
      [platformShare]
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true, recipientShare, platformShare });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.post('/messages', requireAuth, safe(async (req, res) => {
  const { toUserId, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });
  if (toUserId === req.user.sub) return res.status(400).json({ error: "Can't message yourself" });
  const r = await pool.query(
    `INSERT INTO messages (from_user_id, to_user_id, text) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.sub, toUserId, text.trim().slice(0, 1000)]
  );
  res.status(201).json(r.rows[0]);
}));

router.get('/messages/:withUserId', requireAuth, safe(async (req, res) => {
  const r = await pool.query(
    `SELECT * FROM messages WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1) ORDER BY created_at ASC LIMIT 100`,
    [req.user.sub, req.params.withUserId]
  );
  res.json(r.rows);
}));

router.get('/messages', requireAuth, safe(async (req, res) => {
  const r = await pool.query(
    `SELECT DISTINCT ON (other_id) other_id, u.handle, u.display_name, m.text, m.created_at FROM (
       SELECT CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END AS other_id, text, created_at
       FROM messages WHERE from_user_id = $1 OR to_user_id = $1
     ) m JOIN users u ON u.id = m.other_id
     ORDER BY other_id, created_at DESC`,
    [req.user.sub]
  );
  res.json(r.rows);
}));

router.post('/live-rooms', requireAuth, safe(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Room code required' });
  await pool.query(
    `INSERT INTO live_rooms (code, host_id, host_handle, host_display_name) VALUES ($1, $2, $3, $4)
     ON CONFLICT (code) DO UPDATE SET started_at = now()`,
    [code, req.user.sub, req.user.handle, req.body.hostDisplayName || req.user.handle]
  );
  res.status(201).json({ ok: true });
}));

router.delete('/live-rooms/:code', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM live_rooms WHERE code = $1 AND host_id = $2`, [req.params.code, req.user.sub]);
  res.status(204).end();
}));

router.get('/live-rooms', safe(async (req, res) => {
  // Rooms "expire" from the list after 2 hours with no refresh, in case a host's
  // browser closed without cleanly leaving
  const r = await pool.query(`SELECT code, host_handle, host_display_name, started_at FROM live_rooms WHERE started_at > now() - interval '2 hours' ORDER BY started_at DESC`);
  res.json(r.rows);
}));

router.post('/marketplace/listings', requireAuth, safe(async (req, res) => {
  const { title, description, productLink, imageData, price, currency, payoutInfo } = req.body;
  if (!title || !price || price <= 0) return res.status(400).json({ error: 'Title and a valid price are required' });
  if (imageData && imageData.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Image too large (max ~3MB)' });
  const r = await pool.query(
    `INSERT INTO marketplace_listings (seller_id, title, description, product_link, image_data, price, currency, payout_info)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
    [req.user.sub, title.slice(0, 120), (description || '').slice(0, 500), (productLink || '').slice(0, 500), imageData || null, price, currency || 'NGN', (payoutInfo || '').slice(0, 300)]
  );
  res.status(201).json(r.rows[0]);
}));

router.get('/marketplace/listings', safe(async (req, res) => {
  const r = await pool.query(
    `SELECT l.id, l.title, l.description, l.product_link, l.image_data, l.price, l.currency, l.created_at,
            u.handle, u.display_name, u.verified
     FROM marketplace_listings l JOIN users u ON u.id = l.seller_id
     ORDER BY l.created_at DESC LIMIT 60`
  );
  res.json(r.rows);
}));

router.delete('/marketplace/listings/:id', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM marketplace_listings WHERE id = $1 AND seller_id = $2`, [req.params.id, req.user.sub]);
  res.status(204).end();
}));

router.post('/marketplace/listings/:id/order', requireAuth, safe(async (req, res) => {
  const { buyerName, buyerPhone, buyerAddress } = req.body;
  if (!buyerName || !buyerPhone || !buyerAddress) return res.status(400).json({ error: 'Name, phone, and address are all required' });
  const r = await pool.query(
    `INSERT INTO marketplace_orders (listing_id, buyer_id, buyer_name, buyer_phone, buyer_address)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
    [req.params.id, req.user.sub, buyerName.slice(0, 100), buyerPhone.slice(0, 30), buyerAddress.slice(0, 400)]
  );
  res.status(201).json(r.rows[0]);
}));

// Seller views orders placed against their own listings — includes the
// listing's payout info so they know exactly where the buyer should pay.
router.get('/marketplace/my-orders', requireAuth, safe(async (req, res) => {
  const r = await pool.query(
    `SELECT o.id, o.buyer_name, o.buyer_phone, o.buyer_address, o.created_at,
            l.title, l.price, l.currency, l.payout_info
     FROM marketplace_orders o JOIN marketplace_listings l ON l.id = o.listing_id
     WHERE l.seller_id = $1 ORDER BY o.created_at DESC`,
    [req.user.sub]
  );
  res.json(r.rows);
}));

module.exports = router;
