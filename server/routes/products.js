/* /api/products — public catalogue */
const express = require('express');
const db = require('../db');
const { wrap } = require('../util');

const router = express.Router();

/* attach description + photo list to product rows */
async function withImages(products) {
  if (!products.length) return products;
  const ids = products.map(function (p) { return p.id; });
  const [imgs] = await db.query(
    'SELECT id, product_id, path, thumb FROM product_images WHERE product_id IN (?) ORDER BY product_id ASC, sort_no ASC, id ASC',
    [ids]
  );
  const byProduct = {};
  imgs.forEach(function (im) {
    if (!byProduct[im.product_id]) byProduct[im.product_id] = [];
    byProduct[im.product_id].push({ id: im.id, url: im.path, thumb: im.thumb });
  });
  products.forEach(function (p) {
    p.images = byProduct[p.id] || [];
    p.description = p.description || '';
  });
  return products;
}

/* GET /api/products?cat=veg|fruits */
router.get('/', wrap(async (req, res) => {
  const params = [];
  let sql = 'SELECT id, name, emoji, cat, section, description, unit, rate FROM products WHERE active = 1';
  if (req.query.cat === 'veg' || req.query.cat === 'fruits') {
    sql += ' AND cat = ?';
    params.push(req.query.cat);
  }
  sql += ' ORDER BY cat ASC, id ASC';
  const [products] = await db.query(sql, params);
  await withImages(products);
  res.json({ products: products });
}));

module.exports = router;
module.exports.withImages = withImages;
