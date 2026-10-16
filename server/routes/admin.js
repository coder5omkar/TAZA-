/* ==========================================================================
   /api/admin — admin-only management endpoints
   stats · users · products · procurement · settings
   ========================================================================== */
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../auth');
const { wrap } = require('../util');

const router = express.Router();

/* ---------- stats (dashboard) ---------- */
router.get('/stats', requireAdmin, wrap(async (req, res) => {
  const [[o]] = await db.query(
    "SELECT COUNT(*) AS total, " +
    "COALESCE(SUM(status = 'pending'), 0) AS pending, " +
    "COALESCE(SUM(cycle = 'day-after' AND status <> 'rejected'), 0) AS late, " +
    "COALESCE(SUM(CASE WHEN status = 'rejected' THEN 0 ELSE amount END), 0) AS revenue " +
    'FROM orders'
  );
  const [[u]] = await db.query(
    "SELECT COUNT(*) AS total, COALESCE(SUM(status = 'active'), 0) AS active FROM users"
  );
  const [[p]] = await db.query('SELECT COUNT(*) AS total FROM products WHERE active = 1');
  res.json({ orders: o, users: u, products: p });
}));

/* ---------- users ---------- */
router.get('/users', requireAdmin, wrap(async (req, res) => {
  const [users] = await db.query(
    'SELECT id, name, email, phone, address, role, status, created_at FROM users ORDER BY id ASC'
  );
  res.json({ users: users });
}));

router.patch('/users/:id', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const sets = [];
  const params = [];

  if (b.name) { sets.push('name = ?'); params.push(String(b.name).trim().slice(0, 80)); }
  if (b.email) { sets.push('email = ?'); params.push(String(b.email).trim().toLowerCase().slice(0, 160)); }
  if (b.phone !== undefined) { sets.push('phone = ?'); params.push(b.phone ? String(b.phone).trim().slice(0, 30) : null); }
  if (b.address !== undefined) { sets.push('address = ?'); params.push(b.address ? String(b.address).trim().slice(0, 380) : null); }
  if (['customer', 'admin', 'delivery'].includes(b.role)) { sets.push('role = ?'); params.push(b.role); }
  if (['active', 'suspended'].includes(b.status)) { sets.push('status = ?'); params.push(b.status); }
  if (b.password) {
    sets.push('password_hash = ?');
    params.push(await bcrypt.hash(String(b.password), 10));
  }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(id);

  try {
    const [r] = await db.query('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?', params);
    if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already used by another account' });
    throw e;
  }
}));

router.delete('/users/:id', requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

  const [[o]] = await db.query('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?', [id]);
  if (o.n > 0) return res.status(409).json({ error: 'This user has orders — suspend the account instead' });

  await db.query('DELETE FROM conversations WHERE user_id = ?', [id]);
  const [r] = await db.query('DELETE FROM users WHERE id = ?', [id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
}));

/* ---------- products ---------- */
const PRODUCT_SECTIONS = ['kg', 'bunch', 'gram', 'piece_pack', 'dozen_piece', 'pack'];
const PRODUCT_UNITS = ['kg', 'bunch', 'pack', 'piece', 'dozen', '100 g'];

router.post('/products', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const cat = b.cat === 'fruits' ? 'fruits' : 'veg';
  const section = PRODUCT_SECTIONS.includes(b.section) ? b.section : null;
  const unit = PRODUCT_UNITS.includes(b.unit) ? b.unit : 'kg';
  const rate = Math.max(1, parseInt(b.rate, 10) || 1);
  const emoji = String(b.emoji || '🥬').trim().slice(0, 8);
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  try {
    const [r] = await db.query(
      'INSERT INTO products (name, emoji, cat, section, unit, rate) VALUES (?, ?, ?, ?, ?, ?)',
      [name.slice(0, 80), emoji, cat, section, unit, rate]
    );
    res.status(201).json({ product: { id: r.insertId, name: name, emoji: emoji, cat: cat, section: section, unit: unit, rate: rate } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A product with this name already exists' });
    throw e;
  }
}));

router.patch('/products/:id', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const rate = b.rate !== undefined ? Math.max(1, parseInt(b.rate, 10) || 1) : null;
  const unit = PRODUCT_UNITS.includes(b.unit) ? b.unit : null;
  const section = PRODUCT_SECTIONS.includes(b.section) ? b.section : null;
  const emoji = b.emoji ? String(b.emoji).trim().slice(0, 8) : null;
  const active = b.active === 0 || b.active === 1 ? b.active : null;
  if (rate === null && unit === null && section === null && emoji === null && active === null) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  const [r] = await db.query(
    'UPDATE products SET rate = COALESCE(?, rate), unit = COALESCE(?, unit), section = COALESCE(?, section), emoji = COALESCE(?, emoji), active = COALESCE(?, active) WHERE id = ?',
    [rate, unit, section, emoji, active, Number(req.params.id)]
  );
  if (!r.affectedRows) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
}));

router.delete('/products/:id', requireAdmin, wrap(async (req, res) => {
  const [r] = await db.query('DELETE FROM products WHERE id = ?', [Number(req.params.id)]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
}));

/* ---------- procurement (tonight's supplier list) ---------- */
router.get('/procurement', requireAdmin, wrap(async (req, res) => {
  const [rows] = await db.query(
    'SELECT oi.name, oi.unit, SUM(oi.qty) AS qty, SUM(oi.qty * oi.rate) AS value ' +
    'FROM orders o JOIN order_items oi ON oi.order_id = o.id ' +
    "WHERE o.cycle = 'tomorrow' AND o.status IN ('pending', 'confirmed', 'on_way') " +
    'GROUP BY oi.name, oi.unit ORDER BY oi.name ASC'
  );
  const [[totals]] = await db.query(
    "SELECT COUNT(*) AS orders, COALESCE(SUM(amount), 0) AS value FROM orders " +
    "WHERE cycle = 'tomorrow' AND status IN ('pending', 'confirmed', 'on_way')"
  );
  res.json({ rows: rows, orders: totals.orders, value: totals.value });
}));

/* ---------- settings ---------- */
router.get('/settings', requireAdmin, wrap(async (req, res) => {
  const [[settings]] = await db.query('SELECT * FROM settings WHERE id = 1');
  res.json({ settings: settings });
}));

router.put('/settings', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const num = function (v) { return v === undefined || v === null || v === '' ? null : Math.max(0, parseInt(v, 10) || 0); };
  const flag = function (v) { return v === 0 || v === 1 || v === true || v === false ? (v ? 1 : 0) : null; };

  await db.query(
    'UPDATE settings SET store_name = COALESCE(?, store_name), support_phone = COALESCE(?, support_phone), ' +
    'delivery_fee = COALESCE(?, delivery_fee), cutoff_hour = COALESCE(?, cutoff_hour), ' +
    'morning_slot = COALESCE(?, morning_slot), evening_slot = COALESCE(?, evening_slot), ' +
    'upi_enabled = COALESCE(?, upi_enabled), cod_enabled = COALESCE(?, cod_enabled) WHERE id = 1',
    [
      b.store_name ? String(b.store_name).slice(0, 120) : null,
      b.support_phone ? String(b.support_phone).slice(0, 30) : null,
      num(b.delivery_fee),
      b.cutoff_hour !== undefined ? Math.min(23, Math.max(1, parseInt(b.cutoff_hour, 10) || 22)) : null,
      flag(b.morning_slot),
      flag(b.evening_slot),
      flag(b.upi_enabled),
      flag(b.cod_enabled)
    ]
  );
  res.json({ ok: true });
}));

module.exports = router;
