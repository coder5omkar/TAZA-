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
    'SELECT id, name, email, phone, address, address_flat, address_floor, address_building, ' +
    'address_area, address_city, address_pin, default_payment, avatar, role, status FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user });
}));

/* POST /api/auth/avatar — upload/replace own profile photo (multipart "image") */
const uploads = require('../uploads');
router.post('/avatar', requireAuth, uploads.imageUpload, wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Pick a photo first' });

  const [[old]] = await db.query('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
  let saved;
  try {
    saved = await uploads.saveImageSet('avatars', 'avatar-' + req.user.id, req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  await db.query('UPDATE users SET avatar = ? WHERE id = ?', [saved.path, req.user.id]);
  if (old && old.avatar) uploads.removeImage(old.avatar);

  const [[user]] = await db.query(
    'SELECT id, name, email, phone, address, default_payment, avatar, role, status FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json({ user: user });
}));

/* PATCH /api/auth/me — edit own profile, address or default payment.
   Email verification will be added later (currently saved immediately). */
router.patch('/me', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const sets = [];
  const params = [];

  if (b.name) { sets.push('name = ?'); params.push(String(b.name).trim().slice(0, 80)); }
  if (b.email) { sets.push('email = ?'); params.push(String(b.email).trim().toLowerCase().slice(0, 160)); }
  if (b.default_payment === 'upi' || b.default_payment === 'cod') {
    sets.push('default_payment = ?');
    params.push(b.default_payment);
  }

  /* structured address parts -> compose the single display address */
  const ADDR = [
    ['flat', 'address_flat', 30],
    ['floor', 'address_floor', 30],
    ['building', 'address_building', 120],
    ['area', 'address_area', 120],
    ['city', 'address_city', 60],
    ['pin', 'address_pin', 10]
  ];
  const addrProvided = ADDR.some(function (a) { return b[a[0]] !== undefined; });
  if (addrProvided) {
    const [[cur]] = await db.query(
      'SELECT address_flat, address_floor, address_building, address_area, address_city, address_pin ' +
      'FROM users WHERE id = ?',
      [req.user.id]
    );
    const vals = {
      address_flat: cur.address_flat, address_floor: cur.address_floor, address_building: cur.address_building,
      address_area: cur.address_area, address_city: cur.address_city, address_pin: cur.address_pin
    };
    ADDR.forEach(function (a) {
      if (b[a[0]] !== undefined) {
        vals[a[1]] = b[a[0]] ? String(b[a[0]]).trim().slice(0, a[2]) : null;
      }
    });
    Object.keys(vals).forEach(function (col) { sets.push(col + ' = ?'); params.push(vals[col]); });

    const cityPin = [vals.address_city, vals.address_pin].filter(Boolean).join(' ');
    const composed = [vals.address_flat, vals.address_floor, vals.address_building, vals.address_area, cityPin]
      .filter(Boolean).join(', ');
    sets.push('address = ?');
    params.push(composed.slice(0, 380));
  }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.user.id);

  try {
    await db.query('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?', params);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already registered' });
    throw e;
  }

  const [[user]] = await db.query(
    'SELECT id, name, email, phone, address, address_flat, address_floor, address_building, ' +
    'address_area, address_city, address_pin, default_payment, avatar, role, status FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json({ user: user });
}));

module.exports = router;
