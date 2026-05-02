# Integration Tests

Cross-service end-to-end tests. Run with all services up via docker-compose.

```
cd tests/integration
npm install
npm test
```

Before running tests against a local stack, confirm **job-service is FastAPI** (not the old Express server on the same port):

```bash
# Expect JSON with "openapi" key (FastAPI default). If you see HTML "Cannot GET", stop legacy Node.
curl -sSf "${JOB_URL:-http://localhost:3002}/openapi.json" | head -c 120
```

Optional automated check (OpenAPI + **JWT accepted by job-service** + **analytics health**):

```bash
npm run preflight
# or run tests only after a successful probe:
npm run test:integration
```

If preflight fails with **JWT rejected (401)**, your running job/application containers were likely built before a secret change — rebuild them:

`docker compose build job-service application-service && docker compose up -d job-service application-service`

Use the same `JWT_SECRET` / `SECRET_KEY` as in `docker-compose.yml`, or export them before tests.

If analytics is intentionally down: `SKIP_ANALYTICS_PREFLIGHT=1 npm run preflight` (tests in `02_connections_analytics_ai.test.js` that call analytics will still fail).

Set env vars or use defaults:

- PROFILE_URL=http://localhost:8002/api
- JOB_URL=http://localhost:3002
- APP_URL=http://localhost:5003
- CONNECTION_URL=http://localhost:3005/api
- ANALYTICS_URL=http://localhost:4001
- AI_URL=http://localhost:8015
- JWT_SECRET / SECRET_KEY should match profile + job + application services (default matches compose).
