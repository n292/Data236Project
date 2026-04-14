'use strict'

require('dotenv').config()
const app = require('./app')

const port = Number(process.env.PORT) || 3002

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`job-service listening on ${port}`)
})
