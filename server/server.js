/* ==========================================================================
   TAZA-PHAL-SABZI.COM — Node.js backend (Express + MySQL)
   - REST API under /api
   - Serves the customer app (/templates) and admin panel (/admin)
   - Works locally and on Hostinger Node.js hosting (PORT from env)
   ========================================================================== */

process.env.TZ = process.env.TZ || 'Asia/Kolkata';
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* ---------------- API ---------------- */

app.get('/api/health', async (req, res) => {
  try {
    const db = require('./db');
    await db.query('SELECT 1');
    res.json({ ok: true, service: 'taza-phal-sabzi', database: 'up' });
  } catch (e) {
    res.status(500).json({ ok: false, service: 'taza-phal-sabzi', database: 'down', error: 'Database not reachable — check .env' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/settings', require('./routes/settings'));

/* ---------------- Frontend (static templates) ---------------- */

const root = path.join(__dirname, '..');
app.use('/templates', express.static(path.join(root, 'templates')));
app.use('/admin', express.static(path.join(root, 'admin')));

/* uploaded photos (Railway: a mounted volume via UPLOADS_DIR) */
const uploadsStore = require('./uploads');
app.use('/uploads', express.static(uploadsStore.ROOT, { maxAge: '365d', immutable: true }));

app.get('/', (req, res) => res.redirect('/templates/login.html'));

/* ---------------- 404 + errors ---------------- */

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

/* ---------------- start ---------------- */

const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', function () {
  console.log('----------------------------------------------');
  console.log('TAZA-PHAL-SABZI.COM server is running');
  console.log('  Store  : http://localhost:' + port + '/templates/login.html');
  console.log('  Admin  : http://localhost:' + port + '/admin/index.html');
  console.log('  Health : http://localhost:' + port + '/api/health');
  console.log('  Mobile : http://<your-pc-ip>:' + port + '/templates/login.html (same Wi-Fi)');
  console.log('----------------------------------------------');
});
