/* ==========================================================================
   Shared MySQL connection options + shop timezone.
   - Local dev :  .env with DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
   - Railway   :  the MySQL service exposes MYSQLHOST / MYSQLPORT / MYSQLUSER /
                  MYSQLPASSWORD / MYSQLDATABASE / MYSQL_URL — all accepted here,
                  so either naming style (or the ${{MySQL.*}} references) works.
   - Every connection pins the MySQL *session* timezone to the shop timezone
     (IST, +05:30): Railway's MySQL container runs in UTC, and the order-ID
     dates, the 10 PM cutoff and DATE(placed_at) queries must follow the
     shop's day (IST), not the server's.
   ========================================================================== */

require('dotenv').config();

const SHOP_TZ = process.env.SHOP_TZ || '+05:30';

function connectionOptions(includeDatabase) {
  const withDb = includeDatabase !== false;

  /* a full mysql:// URL wins when no explicit DB_HOST is set */
  const url = process.env.MYSQL_URL || '';
  if (!process.env.DB_HOST && /^mysql/i.test(url)) {
    try {
      const u = new URL(url);
      const opts = {
        host: u.hostname,
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username || 'root'),
        password: decodeURIComponent(u.password || '')
      };
      if (withDb) opts.database = (u.pathname || '').replace(/^\//, '') || 'taza_sabzi';
      return opts;
    } catch (e) { /* fall through to plain env vars */ }
  }

  const opts = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: (process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '')
      ? process.env.DB_PASSWORD
      : (process.env.MYSQLPASSWORD || '')
  };
  if (withDb) opts.database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'taza_sabzi';
  return opts;
}

/* pin the MySQL session clock to the shop timezone */
async function pinTimezone(conn) {
  await conn.query("SET time_zone = '" + SHOP_TZ + "'");
}

module.exports = { connectionOptions: connectionOptions, pinTimezone: pinTimezone, SHOP_TZ: SHOP_TZ };
