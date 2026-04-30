'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

async function main () {
  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT) || 3306
  const user = process.env.DB_USER || 'root'
  const password = process.env.DB_PASSWORD
  const database = process.env.DB_NAME || 'application_db'

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  })

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await conn.query(schema)
  await conn.end()
  console.log(`Schema applied to ${database}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
