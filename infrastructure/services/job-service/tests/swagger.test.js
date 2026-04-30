'use strict'

const request = require('supertest')
const app = require('../src/app')

describe('Swagger UI', () => {
  it('serves OpenAPI JSON', async () => {
    const res = await request(app).get('/api/docs/openapi.json')
    expect(res.status).toBe(200)
    expect(res.body.openapi).toMatch(/^3\./)
    expect(res.body.paths['/api/v1/jobs/create']).toBeDefined()
  })

  it('serves Swagger HTML', async () => {
    const res = await request(app).get('/api/docs/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('swagger')
  })
})
