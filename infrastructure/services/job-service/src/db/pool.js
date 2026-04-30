'use strict'

const mysql = require('mysql2/promise')

let pool

function getPool () {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || 'data236',
      waitForConnections: true,
      connectionLimit: 10
    })
  }
  return pool
}

/** @param {import('mysql2/promise').Pool} p */
function setPoolForTests (p) {
  pool = p
}

function resetPoolForTests () {
  pool = undefined
}

module.exports = { getPool, setPoolForTests, resetPoolForTests }
