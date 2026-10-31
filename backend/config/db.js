require('dotenv').config();
const mysql = require('mysql2/promise');

// Credentials live only here, read from backend/.env — never sent to the browser.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agricultural_supply_chain',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL -> JS number
  dateStrings: true     // DATE -> 'YYYY-MM-DD' (no timezone shifts)
});

module.exports = pool;
