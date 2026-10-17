/* /api/settings — public, customer-facing store settings (no secrets) */
const express = require('express');
const db = require('../db');
const { wrap } = require('../util');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  const [[s]] = await db.query(
    'SELECT morning_slot, evening_slot, morning_from, morning_to, evening_from, evening_to, cutoff_hour, delivery_fee, support_phone, store_name FROM settings WHERE id = 1'
  );
  res.json(s || { morning_slot: 1, evening_slot: 1 });
}));

module.exports = router;
