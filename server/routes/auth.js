/* /api/auth — login, register, me */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../auth');
const { wrap } = require('../util');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

/* POST /api/auth/login  { email, password } */
router.post('/login', wrap(async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const password = String((req.body || {}).password || '');
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password' });

  const [[user]] = await db.query(
    'SELECT id, name, email, role, status, password_hash FROM users WHERE email = ?',
    [email]
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This account is suspended — contact support' });
  }

  res.json({ token: sign(user), user: publicUser(user) });
}));

/* POST /api/auth/register  { name, email, phone, password } */
router.post('/register', wrap(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const phone = b.phone ? String(b.phone).trim().slice(0, 30) : null;
  const password = String(b.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password (6+ characters) are required' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await db.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, "customer")',
      [name.slice(0, 80), email.slice(0, 160), phone, hash]
    );
    const user = { id: r.insertId, name: name, email: email, role: 'customer' };
    res.status(201).json({ token: sign(user), user: user });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already registered — sign in instead' });
    }
    throw e;
  }
}));

/* GET /api/auth/me */
router.get('/me', requireAuth, wrap(async (req, res) => {
  const [[user]] = await db.query(
    'SELECT id, name, email, phone, role, status FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user });
}));

module.exports = router;
