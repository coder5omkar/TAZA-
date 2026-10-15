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

const DB_NAME = (process.env.DB_NAME || 'taza_sabzi').replace(/[^a-zA-Z0-9_]/g, '');
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);

const PRODUCTS = [
  /* [name, emoji, cat, unit, rate] — matches the store/landing tables */
  ['Tomato', '🍅', 'veg', 'kg', 2],
  ['Potato', '🥔', 'veg', 'kg', 1],
  ['Onion', '🧅', 'veg', 'kg', 2],
  ['Spinach', '🥬', 'veg', 'bunch', 3],
  ['Carrot', '🥕', 'veg', 'kg', 2],
  ['Cucumber', '🥒', 'veg', 'kg', 1],
  ['Capsicum', '🫑', 'veg', 'kg', 3],
  ['Brinjal', '🍆', 'veg', 'kg', 2],
  ['Sweet Corn', '🌽', 'veg', 'piece', 1],
  ['Pumpkin', '🎃', 'veg', 'kg', 1],
  ['Broccoli', '🥦', 'veg', 'kg', 3],
  ['Mushroom', '🍄', 'veg', 'pack', 4],
  ['Garlic', '🧄', 'veg', 'kg', 3],
  ['Green Chilli', '🌶️', 'veg', 'kg', 2],
  ['Lettuce', '🥗', 'veg', 'bunch', 2],
  ['Cabbage', '🥬', 'veg', 'kg', 1],
  ['Coriander', '🌿', 'veg', 'bunch', 1],
  ['Sweet Potato', '🍠', 'veg', 'kg', 1],
  ['Apple', '🍎', 'fruits', 'pack', 2],
  ['Banana', '🍌', 'fruits', 'dozen', 2],
  ['Mango', '🥭', 'fruits', 'kg', 4],
  ['Grapes', '🍇', 'fruits', 'kg', 3],
  ['Orange', '🍊', 'fruits', 'kg', 2],
  ['Lemon', '🍋', 'fruits', 'piece', 1],
  ['Watermelon', '🍉', 'fruits', 'kg', 1],
  ['Strawberry', '🍓', 'fruits', 'pack', 4],
  ['Peach', '🍑', 'fruits', 'kg', 3],
  ['Pineapple', '🍍', 'fruits', 'piece', 2],
  ['Kiwi', '🥝', 'fruits', 'piece', 1],
  ['Pear', '🍐', 'fruits', 'kg', 2],
  ['Melon', '🍈', 'fruits', 'kg', 2],
  ['Cherry', '🍒', 'fruits', 'pack', 3],
  ['Coconut', '🥥', 'fruits', 'piece', 2],
  ['Avocado', '🥑', 'fruits', 'piece', 2]
];

/* [name, email, phone, password, role] — same logins as the demo templates */
const USERS = [
  ['Hannah', 'hannah@vegfruit.shop', '+91 98200 11001', 'hannah@123', 'admin'],
  ['Vikram Rao', 'vikram@store.com', '+91 98200 11006', 'vikram@654', 'admin'],
  ['Ravi Kumar', 'ravi.k@gmail.com', '+91 98200 11002', 'ravi@123', 'customer'],
  ['Priya Sharma', 'priya.s@yahoo.com', '+91 98200 11003', 'priya@456', 'customer'],
  ['Amit Patel', 'amit@outlook.com', '+91 98200 11004', 'amit@789', 'delivery'],
  ['Sneha Joshi', 'sneha.j@gmail.com', '+91 98200 11005', 'sneha@321', 'customer'],
  ['Neha Gupta', 'neha.g@gmail.com', '+91 98200 11007', 'neha@987', 'customer'],
  ['Rahul Singh', 'rahul@deliver.in', '+91 98200 11008', 'rahul@135', 'delivery']
];

(async function () {
  /* connect without a database first so we can create it */
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  await conn.query('CREATE DATABASE IF NOT EXISTS `' + DB_NAME + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await conn.changeUser({ database: DB_NAME });
  console.log('Database ready:', DB_NAME);

  const schema = fs.readFileSync(path.join(__dirname, 'sql', 'schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('Schema ready');

  let added = 0;
  for (const p of PRODUCTS) {
    const [r] = await conn.query(
      'INSERT IGNORE INTO products (name, emoji, cat, unit, rate) VALUES (?, ?, ?, ?, ?)',
      p
    );
    added += r.affectedRows;
  }
  console.log('Products: ' + added + ' added, ' + (PRODUCTS.length - added) + ' already present');

  for (const u of USERS) {
    const hash = await bcrypt.hash(u[3], 10);
    await conn.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), name = VALUES(name)',
      [u[0], u[1], u[2], hash, u[4]]
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
