# Load Test Results — LinkedIn Simulation Platform

**Date:** 2026-04-27  
**Tool:** k6 v1.7.1  
**Concurrency:** 100 VUs, 30 seconds each configuration  
**Machine:** macOS (local, services running via Docker)

---

## Scenario A — Job Search + Job Detail View

| Configuration  | p95 Search (ms) | p95 View (ms) | Throughput (req/s) | Error Rate |
|----------------|-----------------|---------------|--------------------|------------|
| B              | 1.1             | 0.4           | 503.5              | 0.00%      |
| B + S          | 1.2             | 0.5           | 506.7              | 0.00%      |
| B + S + K      | 1.1             | 0.5           | 507.9              | 0.00%      |
| B + S + K + O  | 1.1             | 0.5           | 501.5              | 0.00%      |

**Observation:** Redis cache hit path for search results keeps p95 sub-2ms across all configs. Adding Kafka (B+S+K) and the analytics consumer (B+S+K+O) adds negligible overhead (<1%) to search latency. The FULLTEXT index on `job_postings(title, description)` sustains >500 req/s at 100 concurrent users with 0% errors.

---

## Scenario B — Apply Submit (DB Write + Kafka Event)

| Configuration  | p50 Submit (ms) | p95 Submit (ms) | p99 Submit (ms) | Throughput (req/s) | Applications |
|----------------|-----------------|-----------------|-----------------|--------------------|--------------| 
| B              | <1              | 0.6             | <1              | 395.1              | 12,024       |
| B + S          | <1              | 0.6             | <1              | 394.5              | 11,991       |
| B + S + K      | <1              | 0.5             | <1              | 395.1              | 12,020       |
| B + S + K + O  | <1              | 0.5             | <1              | 393.1              | 11,929       |

**Observation:** The DB-write-first pattern (application persisted before Kafka publish) keeps p95 under 1ms even with Kafka enabled. The analytics consumer running in a separate container adds <0.5% throughput reduction. All configurations stay well within the 1000ms p95 threshold.

---

## Deployment Comparison (Conceptual — Docker Compose)

| Deployment Model                      | Latency Impact | Notes                                               |
|---------------------------------------|---------------|-----------------------------------------------------|
| 1 UI + 1 service + 1 DB               | Baseline       | Single job-service instance, no Redis               |
| Multi-service (8 containers + Redis)  | ~Same          | Redis absorbs read load; services are independent   |
| Multi-replica (2× job-service)        | -10–20%        | Kafka consumer group load balances automatically     |

---

## Reproduce

```bash
# Install k6
brew install k6

# Run all 8 configurations
cd /path/to/linkedin
bash tests/load/run_benchmarks.sh

# Or individually:
k6 run -e K6_CONFIG=B     --vus 100 --duration 30s tests/load/scenario_a_search_view.js
k6 run -e K6_CONFIG=B+S+K --vus 100 --duration 30s tests/load/scenario_b_apply_submit.js
```

Raw CSV data: `tests/load/results/scenario_a_B.csv`, `scenario_a_B_S.csv`, etc.
