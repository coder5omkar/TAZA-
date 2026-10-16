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

const mysql = require('mysql2/promise');

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
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'taza_sabzi',
    charset: 'utf8mb4'
  });

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

  await conn.end();
  console.log('');
  console.log('Migration complete ✓');
})().catch(function (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
