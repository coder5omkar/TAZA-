/* MySQL connection pool (mysql2/promise) */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'taza_sabzi',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  charset: 'utf8mb4',
  dateStrings: true
});

module.exports = pool;
