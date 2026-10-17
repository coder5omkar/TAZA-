/* ==========================================================================
   npm run migrate
   Safe, idempotent migration for existing databases:
   - users.address column
   - products.section column + '100 g' unit + new products
   - order_items.qty -> DECIMAL(5,1) (0.5 kg steps)
   - orders.amount -> DECIMAL(8,1)
   - backfills sections / gram items / demo addresses
   ========================================================================== */
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dbConfig = require('./db-config');

const SECTION_KG = ['Potato', 'Tomato', 'Onion', 'Cucumber', 'Sweet Potato', 'Carrot', 'Brinjal', 'Capsicum', 'Pumpkin', 'Broccoli', 'Cabbage',
  'Mango', 'Grapes', 'Orange', 'Watermelon', 'Peach', 'Pear', 'Melon'];
const SECTION_BUNCH = ['Spinach', 'Fenugreek Leaves', 'Dill', 'Sorrel', 'Lettuce'];
const SECTION_GRAM = ['Ginger', 'Garlic', 'Coriander', 'Curry Leaves', 'Green Chilli'];
const SECTION_PIECE_PACK = ['Sweet Corn', 'Mushroom'];
const SECTION_DOZEN_PIECE = ['Banana', 'Lemon', 'Pineapple', 'Kiwi', 'Coconut', 'Avocado'];
const SECTION_PACK = ['Apple', 'Strawberry', 'Cherry'];

const NEW_PRODUCTS = [
  ['Ginger', '🫚', 'veg', 'gram', '100 g', 2],
  ['Curry Leaves', '🍃', 'veg', 'gram', '100 g', 1],
  ['Fenugreek Leaves', '🌿', 'veg', 'bunch', 'bunch', 2],
  ['Dill', '🌱', 'veg', 'bunch', 'bunch', 2],
  ['Sorrel', '🥬', 'veg', 'bunch', 'bunch', 2]
];

const ADDRESSES = [
  ['hannah@vegfruit.shop', '12, Green Park Society, MG Road, Pune 411001'],
  ['vikram@store.com', 'Store HQ, FC Road, Pune 411004'],
  ['ravi.k@gmail.com', 'Flat 302, Sai Residency, Baner, Pune 411045'],
  ['priya.s@yahoo.com', '7, Rose Villa, Kothrud, Pune 411038'],
  ['amit@outlook.com', '21, Shanti Nagar, Wakad, Pune 411057'],
  ['sneha.j@gmail.com', '5-B, Lake View, Viman Nagar, Pune 411014'],
  ['neha.g@gmail.com', '88, Green Meadows, Hinjewadi, Pune 411057'],
  ['rahul@deliver.in', '3, Workers Colony, Hadapsar, Pune 411028']
];

(async function () {
  const conn = await mysql.createConnection(Object.assign({
    charset: 'utf8mb4',
    multipleStatements: true
  }, dbConfig.connectionOptions()));
  await dbConfig.pinTimezone(conn);

  /* fresh installs: create any missing tables first (schema.sql is idempotent) */
  const schema = fs.readFileSync(path.join(__dirname, 'sql', 'schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('~ schema ensured');

  const hasColumn = async function (table, col) {
    const [[r]] = await conn.query(
      'SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, col]
    );
    return r.n > 0;
  };

  if (!(await hasColumn('users', 'address'))) {
    await conn.query('ALTER TABLE users ADD COLUMN address VARCHAR(400) DEFAULT NULL AFTER phone');
    console.log('+ users.address');
  }

  if (!(await hasColumn('products', 'section'))) {
    await conn.query("ALTER TABLE products ADD COLUMN section ENUM('kg','bunch','gram','piece_pack','dozen_piece','pack') DEFAULT NULL AFTER cat");
    console.log('+ products.section');
  }

  const [[unitCol]] = await conn.query(
    "SELECT COLUMN_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'unit'"
  );
  if (String(unitCol.t).indexOf('100 g') === -1) {
    await conn.query("ALTER TABLE products MODIFY unit ENUM('kg','bunch','pack','piece','dozen','100 g') NOT NULL DEFAULT 'kg'");
    console.log('+ products.unit includes 100 g');
  }

  const [[qtyCol]] = await conn.query(
    "SELECT DATA_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'qty'"
  );
  if (String(qtyCol.t).toLowerCase() !== 'decimal') {
    await conn.query('ALTER TABLE order_items MODIFY qty DECIMAL(5,1) UNSIGNED NOT NULL');
    console.log('~ order_items.qty -> DECIMAL(5,1) (0.5 kg steps)');
  }

  /* v3: structured address + default payment + order discount */
  const addCol = async function (table, col, ddl) {
    if (!(await hasColumn(table, col))) {
      await conn.query('ALTER TABLE ' + table + ' ADD COLUMN ' + ddl);
      console.log('+ ' + table + '.' + col);
    }
  };
  await addCol('users', 'address_flat', 'address_flat VARCHAR(30) DEFAULT NULL');
  await addCol('users', 'address_floor', 'address_floor VARCHAR(30) DEFAULT NULL');
  await addCol('users', 'address_building', 'address_building VARCHAR(120) DEFAULT NULL');
  await addCol('users', 'address_area', 'address_area VARCHAR(120) DEFAULT NULL');
  await addCol('users', 'address_city', 'address_city VARCHAR(60) DEFAULT NULL');
  await addCol('users', 'address_pin', 'address_pin VARCHAR(10) DEFAULT NULL');
  await addCol('users', 'default_payment', "default_payment ENUM('upi','cod') NOT NULL DEFAULT 'upi'");
  await addCol('orders', 'discount', 'discount DECIMAL(6,1) NOT NULL DEFAULT 0');

  const [[amtCol]] = await conn.query(
    "SELECT DATA_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'amount'"
  );
  if (String(amtCol.t).toLowerCase() !== 'decimal') {
    await conn.query('ALTER TABLE orders MODIFY amount DECIMAL(8,1) NOT NULL');
    console.log('~ orders.amount -> DECIMAL(8,1)');
  }

  /* v4: payment is collected at delivery for both UPI & COD; default method -> COD */
  await addCol('orders', 'paid', 'paid TINYINT(1) NOT NULL DEFAULT 0');
  const [[payDef]] = await conn.query(
    "SELECT COLUMN_DEFAULT d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'default_payment'"
  );
  if (String(payDef.d).toLowerCase() !== 'cod') {
    await conn.query("ALTER TABLE users MODIFY default_payment ENUM('upi','cod') NOT NULL DEFAULT 'cod'");
    await conn.query("UPDATE users SET default_payment = 'cod'");
    console.log('~ default payment -> cod (all users)');
  }
  const [paidBackfill] = await conn.query("UPDATE orders SET paid = 1 WHERE status = 'delivered' AND paid = 0");
  if (paidBackfill.affectedRows) console.log('~ paid=1 backfilled for delivered orders:', paidBackfill.affectedRows);

  /* v5: order ids -> TS·YY·MM·DD·NN (daily counter resets to 01 each day) */  const [[ymCol]] = await conn.query(
    "SELECT CHARACTER_MAXIMUM_LENGTH len FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_counters' AND COLUMN_NAME = 'ym'"
  );
  if (Number(ymCol.len) < 6) {
    await conn.query('ALTER TABLE order_counters MODIFY ym CHAR(6) NOT NULL');
    console.log('~ order_counters.ym -> CHAR(6) (YYMMDD)');
  }

  /* renumber old-format ids (TS + YYMM + NN) day-wise, oldest order first */
  const pad2 = function (n) { return String(n).padStart(2, '0'); };
  const [allOrders] = await conn.query('SELECT id, placed_at FROM orders ORDER BY placed_at ASC, id ASC');
  const perDay = {};
  const rename = [];
  allOrders.forEach(function (o) {
    /* mysql2 may hand back a Date or a 'YYYY-MM-DD HH:MM:SS' string */
    const d = (o.placed_at instanceof Date)
      ? o.placed_at
      : new Date(String(o.placed_at).replace(' ', 'T'));
    if (isNaN(d.getTime())) {
      console.log('! could not parse placed_at for', o.id, '->', String(o.placed_at));
      return;
    }
    const ymd = String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate());
    perDay[ymd] = (perDay[ymd] || 0) + 1;
    if (perDay[ymd] > 99) return;                       /* safety: never overflow */
    const newId = 'TS' + ymd + pad2(perDay[ymd]);
    if (newId !== o.id) rename.push([o.id, newId]);
  });

  if (rename.length) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const CHUNK = 50;
    for (let i = 0; i < rename.length; i += CHUNK) {
      const batch = rename.slice(i, i + CHUNK);
      const oldIds = batch.map(function (b) { return conn.escape(b[0]); }).join(',');
      const idCase = 'CASE id ' + batch.map(function (b) { return 'WHEN ' + conn.escape(b[0]) + ' THEN ' + conn.escape(b[1]); }).join(' ') + ' END';
      await conn.query('UPDATE orders SET id = ' + idCase + ' WHERE id IN (' + oldIds + ')');
      const fkCase = 'CASE order_id ' + batch.map(function (b) { return 'WHEN ' + conn.escape(b[0]) + ' THEN ' + conn.escape(b[1]); }).join(' ') + ' END';
      await conn.query('UPDATE order_items SET order_id = ' + fkCase + ' WHERE order_id IN (' + oldIds + ')');
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('~ order ids renumbered to TS·YY·MM·DD·NN:', rename.length);
  }

  /* seed today's counter so the next order continues the sequence */
  const nowD = new Date();
  const ymdToday = String(nowD.getFullYear()).slice(2) + pad2(nowD.getMonth() + 1) + pad2(nowD.getDate());
  const [[todayCount]] = await conn.query('SELECT COUNT(*) n FROM orders WHERE DATE(placed_at) = CURDATE()');
  if (todayCount.n > 0) {
    await conn.query(
      'INSERT INTO order_counters (ym, last_no) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_no = GREATEST(last_no, VALUES(last_no))',
      [ymdToday, Math.min(99, todayCount.n)]
    );
    console.log('~ daily counter for today (' + ymdToday + ') set to', Math.min(99, todayCount.n));
  }
  /* drop the old monthly counters — they are no longer used */
  const [oldCounters] = await conn.query("DELETE FROM order_counters WHERE CHAR_LENGTH(ym) < 6");
  if (oldCounters.affectedRows) console.log('~ removed old monthly counters:', oldCounters.affectedRows);

  /* v6: images — product photos + admin description + user avatars */
  await addCol('products', 'description', 'description VARCHAR(160) DEFAULT NULL');
  await addCol('users', 'avatar', 'avatar VARCHAR(255) DEFAULT NULL');
  await conn.query(
    'CREATE TABLE IF NOT EXISTS product_images (' +
    '  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,' +
    '  product_id INT UNSIGNED NOT NULL,' +
    '  path VARCHAR(255) NOT NULL,' +
    '  thumb VARCHAR(255) NOT NULL,' +
    '  sort_no TINYINT UNSIGNED NOT NULL DEFAULT 0,' +
    '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,' +
    '  CONSTRAINT fk_pimg_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE' +
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
  );
  console.log('~ product_images table ensured');

  /* backfill sections */
  const maps = [
    ['kg', SECTION_KG], ['bunch', SECTION_BUNCH], ['gram', SECTION_GRAM],
    ['piece_pack', SECTION_PIECE_PACK], ['dozen_piece', SECTION_DOZEN_PIECE], ['pack', SECTION_PACK]
  ];
  for (const [sec, names] of maps) {
    await conn.query('UPDATE products SET section = ? WHERE name IN (?) AND (section IS NULL OR section <> ?)', [sec, names, sec]);
  }
  console.log('~ sections backfilled');

  /* gram items: unit + rate per 100 g */
  await conn.query("UPDATE products SET unit = '100 g', rate = 1 WHERE name IN ('Garlic', 'Coriander', 'Green Chilli')");
  console.log('~ gram items priced per 100 g');

  /* new products */
  let added = 0;
  for (const p of NEW_PRODUCTS) {
    const [r] = await conn.query(
      'INSERT IGNORE INTO products (name, emoji, cat, section, unit, rate) VALUES (?, ?, ?, ?, ?, ?)',
      p
    );
    added += r.affectedRows;
  }
  console.log('+ new products added:', added);

  /* demo addresses */
  let addr = 0;
  for (const [email, address] of ADDRESSES) {
    const [r] = await conn.query('UPDATE users SET address = ? WHERE email = ? AND address IS NULL', [address, email]);
    addr += r.affectedRows;
  }
  console.log('+ addresses set:', addr);

  /* fresh database (e.g. first Railway deploy): seed catalogue + logins automatically */
  const [[userCount]] = await conn.query('SELECT COUNT(*) c FROM users');
  if (userCount.c === 0) {
    console.log('~ fresh database — seeding the catalogue + logins…');
    await conn.end();
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit', env: process.env });
    console.log('');
    console.log('Migration complete ✓ (database seeded)');
    return;
  }

  await conn.end();
  console.log('');
  console.log('Migration complete ✓');
})().catch(function (e) {
  console.error('Migration failed:', e.message);
  if (/ECONNREFUSED 127\.0\.0\.1|ENOTFOUND|ETIMEDOUT|Access denied/.test(String(e.message))) {
    console.error('');
    console.error('→ No database reachable with the current variables.');
    console.error('  Check that THIS service has DB_HOST..DB_NAME (or MYSQLHOST..MYSQLDATABASE)');
    console.error('  pointing at your MySQL service — see BACKEND.md §5b (Railway).');
  }
  process.exit(1);
});
