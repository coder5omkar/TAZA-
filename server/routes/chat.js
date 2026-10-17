/* ==========================================================================
   /api/chat — customer <-> admin support chat
   One conversation per customer (created lazily).
   ========================================================================== */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { wrap } = require('../util');

const router = express.Router();

async function myConversation(userId) {
  await db.query('INSERT IGNORE INTO conversations (user_id) VALUES (?)', [userId]);
  const [[conv]] = await db.query('SELECT id FROM conversations WHERE user_id = ?', [userId]);
  return conv.id;
}

/* ---------- customer side ---------- */

/* GET /api/chat/unread — red-badge count for the customer app nav */
router.get('/unread', requireAuth, wrap(async (req, res) => {
  const [[r]] = await db.query(
    "SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id " +
    "WHERE c.user_id = ? AND m.sender = 'admin' AND m.read_by_customer = 0",
    [req.user.id]
  );
  res.json({ unread: r.n });
}));

/* GET /api/chat/my */
router.get('/my', requireAuth, wrap(async (req, res) => {
  const convId = await myConversation(req.user.id);
  const [messages] = await db.query(
    'SELECT id, sender, text, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500',
    [convId]
  );
  await db.query("UPDATE messages SET read_by_customer = 1 WHERE conversation_id = ? AND sender = 'admin'", [convId]);
  res.json({ messages: messages });
}));

/* POST /api/chat/my  { text } */
router.post('/my', requireAuth, wrap(async (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message is empty' });
  const convId = await myConversation(req.user.id);
  const [r] = await db.query(
    "INSERT INTO messages (conversation_id, sender, text, read_by_customer) VALUES (?, 'customer', ?, 1)",
    [convId, text.slice(0, 990)]
  );
  res.status(201).json({ message: { id: r.insertId, sender: 'customer', text: text } });
}));

/* ---------- admin side ---------- */

/* GET /api/chat/conversations */
router.get('/conversations', requireAdmin, wrap(async (req, res) => {
  const [conversations] = await db.query(
    "SELECT c.id, u.id AS user_id, u.name, u.status, " +
    "(SELECT text FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_text, " +
    "(SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_at, " +
    "(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender = 'customer' AND m.read_by_admin = 0) AS unread " +
    "FROM conversations c JOIN users u ON u.id = c.user_id " +
    "HAVING last_at IS NOT NULL ORDER BY last_at DESC"
  );
  res.json({ conversations: conversations });
}));

/* GET /api/chat/admin-unread — total unread customer messages (sidebar badge) */
router.get('/admin-unread', requireAdmin, wrap(async (req, res) => {
  const [[r]] = await db.query(
    "SELECT COUNT(*) AS n FROM messages WHERE sender = 'customer' AND read_by_admin = 0"
  );
  res.json({ unread: r.n });
}));

/* GET /api/chat/conversations/:id */
router.get('/conversations/:id', requireAdmin, wrap(async (req, res) => {
  const convId = Number(req.params.id);
  const [messages] = await db.query(
    'SELECT id, sender, text, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500',
    [convId]
  );
  await db.query("UPDATE messages SET read_by_admin = 1 WHERE conversation_id = ? AND sender = 'customer'", [convId]);
  res.json({ messages: messages });
}));

/* POST /api/chat/conversations/:id  { text } */
router.post('/conversations/:id', requireAdmin, wrap(async (req, res) => {
  const convId = Number(req.params.id);
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message is empty' });
  const [r] = await db.query(
    "INSERT INTO messages (conversation_id, sender, text, read_by_admin) VALUES (?, 'admin', ?, 1)",
    [convId, text.slice(0, 990)]
  );
  res.status(201).json({ message: { id: r.insertId, sender: 'admin', text: text } });
}));

module.exports = router;
