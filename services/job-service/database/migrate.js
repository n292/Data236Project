'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

async function main () {
  const host = process.env.MYSQL_HOST || '127.0.0.1'
  const port = Number(process.env.MYSQL_PORT) || 3306
  const user = process.env.MYSQL_USER || 'root'
  const password = process.env.MYSQL_PASSWORD
  const database = process.env.MYSQL_DATABASE || 'data236'

  if (!Object.prototype.hasOwnProperty.call(process.env, 'MYSQL_PASSWORD')) {
    console.error(
      'Set MYSQL_PASSWORD in .env (use MYSQL_PASSWORD= for an empty password).'
    )
    process.exit(1)
  }

  if (!/^[\w]+$/.test(database)) {
    console.error('MYSQL_DATABASE must contain only letters, numbers, underscore.')
    process.exit(1)
  }

  const admin = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  })

  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``)
  await admin.end()

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true
  })

  const sqlPath = path.join(__dirname, '001_create_job_postings.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await conn.query(sql)
  await conn.end()

  console.error(`Migration applied: ${sqlPath} on database ${database}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
