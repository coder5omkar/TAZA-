/* ==========================================================================
   npm run seed
   - creates the database (if missing) + schema
   - seeds the 34-product catalogue, staff accounts and settings
   Safe to re-run (products/users use INSERT IGNORE / upsert).
   ========================================================================== */
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dbConfig = require('./db-config');

/* host/user/password from .env or Railway's MYSQL* variables */
const CONNECT_OPTS = dbConfig.connectionOptions(false);   /* no database yet — created below */
const DB_NAME = String(dbConfig.connectionOptions().database || 'taza_sabzi').replace(/[^a-zA-Z0-9_]/g, '') || 'taza_sabzi';

const PRODUCTS = [
  /* [name, emoji, cat, section, unit, rate] — matches the landing page sections */
  ['Potato', '🥔', 'veg', 'kg', 'kg', 1],
  ['Tomato', '🍅', 'veg', 'kg', 'kg', 2],
  ['Onion', '🧅', 'veg', 'kg', 'kg', 2],
  ['Cucumber', '🥒', 'veg', 'kg', 'kg', 1],
  ['Sweet Potato', '🍠', 'veg', 'kg', 'kg', 1],
  ['Carrot', '🥕', 'veg', 'kg', 'kg', 2],
  ['Brinjal', '🍆', 'veg', 'kg', 'kg', 2],
  ['Capsicum', '🫑', 'veg', 'kg', 'kg', 3],
  ['Pumpkin', '🎃', 'veg', 'kg', 'kg', 1],
  ['Broccoli', '🥦', 'veg', 'kg', 'kg', 3],
  ['Cabbage', '🥬', 'veg', 'kg', 'kg', 1],
  ['Spinach', '🥬', 'veg', 'bunch', 'bunch', 3],
  ['Fenugreek Leaves', '🌿', 'veg', 'bunch', 'bunch', 2],
  ['Dill', '🌱', 'veg', 'bunch', 'bunch', 2],
  ['Sorrel', '🥬', 'veg', 'bunch', 'bunch', 2],
  ['Lettuce', '🥗', 'veg', 'bunch', 'bunch', 2],
  ['Ginger', '🫚', 'veg', 'gram', '100 g', 2],
  ['Garlic', '🧄', 'veg', 'gram', '100 g', 1],
  ['Coriander', '🌿', 'veg', 'gram', '100 g', 1],
  ['Curry Leaves', '🍃', 'veg', 'gram', '100 g', 1],
  ['Green Chilli', '🌶️', 'veg', 'gram', '100 g', 1],
  ['Sweet Corn', '🌽', 'veg', 'piece_pack', 'piece', 1],
  ['Mushroom', '🍄', 'veg', 'piece_pack', 'pack', 4],
  ['Mango', '🥭', 'fruits', 'kg', 'kg', 4],
  ['Grapes', '🍇', 'fruits', 'kg', 'kg', 3],
  ['Orange', '🍊', 'fruits', 'kg', 'kg', 2],
  ['Watermelon', '🍉', 'fruits', 'kg', 'kg', 1],
  ['Peach', '🍑', 'fruits', 'kg', 'kg', 3],
  ['Pear', '🍐', 'fruits', 'kg', 'kg', 2],
  ['Melon', '🍈', 'fruits', 'kg', 'kg', 2],
  ['Banana', '🍌', 'fruits', 'dozen_piece', 'dozen', 2],
  ['Lemon', '🍋', 'fruits', 'dozen_piece', 'piece', 1],
  ['Pineapple', '🍍', 'fruits', 'dozen_piece', 'piece', 2],
  ['Kiwi', '🥝', 'fruits', 'dozen_piece', 'piece', 1],
  ['Coconut', '🥥', 'fruits', 'dozen_piece', 'piece', 2],
  ['Avocado', '🥑', 'fruits', 'dozen_piece', 'piece', 2],
  ['Apple', '🍎', 'fruits', 'pack', 'pack', 2],
  ['Strawberry', '🍓', 'fruits', 'pack', 'pack', 4],
  ['Cherry', '🍒', 'fruits', 'pack', 'pack', 3]
];

/* [name, email, phone, password, role] — same logins as the demo templates */
const USERS = [
  ['Hannah', 'hannah@vegfruit.shop', '+91 98200 11001', '12, Green Park Society, MG Road, Pune 411001', 'hannah@123', 'admin'],
  ['Vikram Rao', 'vikram@store.com', '+91 98200 11006', 'Store HQ, FC Road, Pune 411004', 'vikram@654', 'admin'],
  ['Ravi Kumar', 'ravi.k@gmail.com', '+91 98200 11002', 'Flat 302, Sai Residency, Baner, Pune 411045', 'ravi@123', 'customer'],
  ['Priya Sharma', 'priya.s@yahoo.com', '+91 98200 11003', '7, Rose Villa, Kothrud, Pune 411038', 'priya@456', 'customer'],
  ['Amit Patel', 'amit@outlook.com', '+91 98200 11004', '21, Shanti Nagar, Wakad, Pune 411057', 'amit@789', 'delivery'],
  ['Sneha Joshi', 'sneha.j@gmail.com', '+91 98200 11005', '5-B, Lake View, Viman Nagar, Pune 411014', 'sneha@321', 'customer'],
  ['Neha Gupta', 'neha.g@gmail.com', '+91 98200 11007', '88, Green Meadows, Hinjewadi, Pune 411057', 'neha@987', 'customer'],
  ['Rahul Singh', 'rahul@deliver.in', '+91 98200 11008', '3, Workers Colony, Hadapsar, Pune 411028', 'rahul@135', 'delivery']
];

(async function () {
  /* connect without a database first so we can create it */
  const conn = await mysql.createConnection(Object.assign({
    multipleStatements: true,
    charset: 'utf8mb4'
  }, CONNECT_OPTS));
  await dbConfig.pinTimezone(conn);

  await conn.query('CREATE DATABASE IF NOT EXISTS `' + DB_NAME + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await conn.changeUser({ database: DB_NAME });
  console.log('Database ready:', DB_NAME);

  const schema = fs.readFileSync(path.join(__dirname, 'sql', 'schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('Schema ready');

  let added = 0;
  for (const p of PRODUCTS) {
    const [r] = await conn.query(
      'INSERT IGNORE INTO products (name, emoji, cat, section, unit, rate) VALUES (?, ?, ?, ?, ?, ?)',
      p
    );
    added += r.affectedRows;
  }
  console.log('Products: ' + added + ' added, ' + (PRODUCTS.length - added) + ' already present');

  for (const u of USERS) {
    const hash = await bcrypt.hash(u[4], 10);
    await conn.query(
      'INSERT INTO users (name, email, phone, address, password_hash, role) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), name = VALUES(name), address = COALESCE(VALUES(address), address)',
      [u[0], u[1], u[2], u[3], hash, u[5]]
    );
  }
  console.log('Users seeded:', USERS.length);

  await conn.query('INSERT IGNORE INTO settings (id) VALUES (1)');
  console.log('Settings ready (cutoff 10:00 PM, delivery fee ₹3)');

  await conn.end();
  console.log('');
  console.log('Seed complete ✓ — start the server with: npm run dev');
  console.log('Admin login : hannah@vegfruit.shop / hannah@123');
  console.log('Customer    : ravi.k@gmail.com / ravi@123');
})().catch(function (e) {
  console.error('Seed failed:', e.message);
  console.error('Check your .env database settings (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).');
  process.exit(1);
});
