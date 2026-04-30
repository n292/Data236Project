'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mysql = require('mysql2/promise')

async function main () {
  const host = process.env.MYSQL_HOST || '127.0.0.1'
  const port = Number(process.env.MYSQL_PORT) || 3306
  const user = process.env.MYSQL_USER || 'root'
  const password = process.env.MYSQL_PASSWORD
  const database = process.env.MYSQL_DATABASE || 'data236'

  if (!Object.prototype.hasOwnProperty.call(process.env, 'MYSQL_PASSWORD')) {
    console.error(
      'MYSQL_PASSWORD is missing. Copy .env.example to .env and set MYSQL_PASSWORD= (empty after = if no password).'
    )
    process.exit(1)
  }

  console.error(`Connecting as ${user}@${host}:${port} database=${database} ...`)

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database
  })

  const [rows] = await conn.query('SELECT 1 AS ok, DATABASE() AS db, VERSION() AS version')
  await conn.end()

  console.error('MySQL connection OK.')
  console.log(JSON.stringify(rows[0], null, 2))
}

main().catch((err) => {
  console.error('MySQL connection failed:', err.message)
  process.exit(1)
})
