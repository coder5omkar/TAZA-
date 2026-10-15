/* /api/products — public catalogue */
const express = require('express');
const db = require('../db');
const { wrap } = require('../util');

const router = express.Router();

/* GET /api/products?cat=veg|fruits */
router.get('/', wrap(async (req, res) => {
  const params = [];
  let sql = 'SELECT id, name, emoji, cat, unit, rate FROM products WHERE active = 1';
  if (req.query.cat === 'veg' || req.query.cat === 'fruits') {
    sql += ' AND cat = ?';
    params.push(req.query.cat);
  }
  sql += ' ORDER BY cat ASC, id ASC';
  const [products] = await db.query(sql, params);
  res.json({ products: products });
}));

module.exports = router;
