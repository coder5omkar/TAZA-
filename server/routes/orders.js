/* ==========================================================================
   /api/orders
   Rules:
   - Cutoff 10:00 PM (configurable in settings). Before cutoff -> cycle
     'tomorrow' (procured tonight, delivered tomorrow). After cutoff ->
     'day-after' (delivered the day after tomorrow).
   - Order ID: TS + YY + MM + NN  (e.g. TS261001 = 1st order of Oct 2026),
     max 99 orders per day (counter locked inside the transaction).
   ========================================================================== */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { wrap, pad2 } = require('../util');

const router = express.Router();

/* POST /api/orders — place an order (customer) */
router.post('/', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  const slot = b.slot;
  const payment = b.payment;
  const address = String(b.address || '').trim();

  if (!items.length) return res.status(400).json({ error: 'Your bag is empty' });
  if (slot !== 'morning' && slot !== 'evening') return res.status(400).json({ error: 'Pick a delivery slot' });
  if (payment !== 'upi' && payment !== 'cod') return res.status(400).json({ error: 'Pick a payment method' });
  if (!address) return res.status(400).json({ error: 'Delivery address is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    /* 1. validate items against the live catalogue */
    const ids = items.map(function (i) { return Number(i.productId); });
    const [prods] = await conn.query(
      'SELECT id, name, unit, rate FROM products WHERE active = 1 AND id IN (?)',
      [ids]
    );
    if (!prods.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Items are no longer available' });
    }
    let subtotal = 0;
    const lines = items.map(function (i) {
      const p = prods.find(function (x) { return x.id === Number(i.productId); });
      /* rounds to 0.5 steps so kg items can be ordered as 0.5 / 1 / 1.5 … */
      let qty = Math.round((Number(i.qty) || 1) * 2) / 2;
      qty = Math.min(99, Math.max(0.5, qty));
      if (!p) return null;
      subtotal += p.rate * qty;
      return { product_id: p.id, name: p.name, unit: p.unit, rate: p.rate, qty: qty };
    }).filter(Boolean);
    if (!lines.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Items are no longer available' });
    }

    /* 2. settings: delivery fee + cutoff */
    const [[settings]] = await conn.query('SELECT delivery_fee, cutoff_hour FROM settings WHERE id = 1');
    const fee = settings ? settings.delivery_fee : 3;
    const cutoff = settings ? settings.cutoff_hour : 22;

    /* UPI orders get a 3% discount on the items subtotal */
    const discount = payment === 'upi' ? Math.round(subtotal * 0.03 * 10) / 10 : 0;
    const total = Math.round((subtotal - discount + fee) * 10) / 10;

    /* 2b. merge into an open order (pending/confirmed, not yet delivered) instead
       of creating a new one — per store rule, same-day items join the open order */
    const [[openOrder]] = await conn.query(
      "SELECT id, delivery_fee, payment, paid, cycle, delivery_date, status FROM orders " +
      "WHERE user_id = ? AND status IN ('pending', 'confirmed') AND delivery_date >= CURDATE() " +
      'ORDER BY delivery_date ASC, placed_at ASC LIMIT 1 FOR UPDATE',
      [req.user.id]
    );

    if (openOrder) {
      for (const l of lines) {
        const [[existing]] = await conn.query(
          'SELECT id FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1',
          [openOrder.id, l.product_id]
        );
        if (existing) {
          await conn.query('UPDATE order_items SET qty = qty + ? WHERE id = ?', [l.qty, existing.id]);
        } else {
          await conn.query(
            'INSERT INTO order_items (order_id, product_id, name, unit, rate, qty) VALUES (?, ?, ?, ?, ?, ?)',
            [openOrder.id, l.product_id, l.name, l.unit, l.rate, l.qty]
          );
        }
      }
      const [[totals]] = await conn.query(
        'SELECT COALESCE(SUM(qty * rate), 0) AS sub FROM order_items WHERE order_id = ?',
        [openOrder.id]
      );
      const newSub = Number(totals.sub);
      const newDiscount = openOrder.payment === 'upi' ? Math.round(newSub * 0.03 * 10) / 10 : 0;
      const newAmount = Math.round((newSub - newDiscount + Number(openOrder.delivery_fee)) * 10) / 10;
      await conn.query('UPDATE orders SET amount = ?, discount = ? WHERE id = ?', [newAmount, newDiscount, openOrder.id]);

      await conn.commit();
      return res.status(200).json({
        merged: true,
        order: {
          id: openOrder.id,
          amount: newAmount,
          discount: newDiscount,
          paid: Number(openOrder.paid || 0),
          cycle: openOrder.cycle,
          deliveryDate: openOrder.delivery_date,
          status: openOrder.status,
          items: lines
        }
      });
    }

    /* 3. cycle + delivery date */
    const now = new Date();
    const beforeCutoff = now.getHours() < cutoff;
    const cycle = beforeCutoff ? 'tomorrow' : 'day-after';
    const d = new Date(now);
    d.setDate(d.getDate() + (beforeCutoff ? 1 : 2));
    const deliveryDate = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

    /* 4. daily order number (max 99) */
    const ym = String(now.getFullYear()).slice(2) + pad2(now.getMonth() + 1);
    await conn.query('INSERT IGNORE INTO order_counters (ym, last_no) VALUES (?, 0)', [ym]);
    const [[counter]] = await conn.query('SELECT last_no FROM order_counters WHERE ym = ? FOR UPDATE', [ym]);
    const nextNo = counter.last_no + 1;
    if (nextNo > 99) {
      await conn.rollback();
      return res.status(429).json({ error: "Today's capacity (99 orders) is full — please order tomorrow" });
    }
    await conn.query('UPDATE order_counters SET last_no = ? WHERE ym = ?', [nextNo, ym]);
    const orderId = 'TS' + ym + pad2(nextNo);

    /* 5. save the order + items */
    const [[user]] = await conn.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
    await conn.query(
      'INSERT INTO orders (id, user_id, customer_name, address, slot, payment, delivery_fee, discount, amount, cycle, delivery_date) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, req.user.id, user ? user.name : 'Customer', address.slice(0, 380), slot, payment, fee, discount, total, cycle, deliveryDate]
    );
    for (const l of lines) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, name, unit, rate, qty) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, l.product_id, l.name, l.unit, l.rate, l.qty]
      );
    }

    await conn.commit();
    res.status(201).json({
      order: { id: orderId, amount: total, discount: discount, paid: 0, cycle: cycle, deliveryDate: deliveryDate, status: 'pending', items: lines }
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

/* GET /api/orders — customer: own orders; admin: all (?status=, ?cycle=) */
router.get('/', requireAuth, wrap(async (req, res) => {
  const params = [];
  let sql =
    'SELECT o.id, o.user_id, o.customer_name, o.address, o.slot, o.payment, o.delivery_fee, o.discount, o.paid, ' +
    'o.amount, o.cycle, o.delivery_date, o.status, o.placed_at FROM orders o';

  const where = [];
  if (req.user.role !== 'admin') {
    where.push('o.user_id = ?');
    params.push(req.user.id);
  } else {
    if (req.query.status) { where.push('o.status = ?'); params.push(req.query.status); }
    if (req.query.cycle) { where.push('o.cycle = ?'); params.push(req.query.cycle); }
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY o.placed_at DESC, o.id DESC LIMIT 300';

  const [orders] = await db.query(sql, params);
  if (orders.length) {
    const [items] = await db.query(
      'SELECT oi.order_id, oi.name, oi.unit, oi.rate, oi.qty, p.emoji ' +
      'FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id IN (?)',
      [orders.map(function (o) { return o.id; })]
    );
    orders.forEach(function (o) {
      o.items = items.filter(function (i) { return i.order_id === o.id; })
        .map(function (i) { return { name: i.name, unit: i.unit, rate: i.rate, qty: i.qty, emoji: i.emoji || '🧺' }; });
    });
  }
  res.json({ orders: orders });
}));

/* PATCH /api/orders/:id/status — admin confirm / reject / deliver */
router.patch('/:id/status', requireAdmin, wrap(async (req, res) => {
  const status = (req.body || {}).status;
  const allowed = ['pending', 'confirmed', 'on_way', 'delivered', 'rejected'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Unknown status' });

  const [r] = await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Order not found' });
  res.json({ ok: true, id: req.params.id, status: status });
}));

/* PATCH /api/orders/:id/paid — admin marks the payment collected (UPI scan or cash) */
router.patch('/:id/paid', requireAdmin, wrap(async (req, res) => {
  const paid = (req.body || {}).paid ? 1 : 0;
  const [r] = await db.query('UPDATE orders SET paid = ? WHERE id = ?', [paid, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Order not found' });
  res.json({ ok: true, id: req.params.id, paid: !!paid });
}));

module.exports = router;
