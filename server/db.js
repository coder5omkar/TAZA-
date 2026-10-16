/* MySQL connection pool (mysql2/promise)
   - reads DB_* (.env) or Railway's MYSQL* variables — see db-config.js
   - pins every pooled session to the shop timezone (IST) so CURDATE()/NOW()
     behave the same locally and on Railway (which runs MySQL in UTC) */

const mysql = require('mysql2/promise');
const dbConfig = require('./db-config');

const pool = mysql.createPool(Object.assign({
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  charset: 'utf8mb4',
  dateStrings: true
}, dbConfig.connectionOptions()));

/* SET time_zone on each new physical connection */
const core = pool.pool || pool;      /* mysql2/promise exposes the core pool */
core.on('connection', function (conn) {
  conn.query("SET time_zone = '" + dbConfig.SHOP_TZ + "'");
});

module.exports = pool;
