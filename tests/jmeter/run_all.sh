#!/bin/bash
# Run all 4 JMeter configurations for both scenarios
# B = Redis OFF (flush + disable), B+S = Redis warm, B+S+K = same (Kafka always on), B+S+K+Other = same

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS="$SCRIPT_DIR/results"
mkdir -p "$RESULTS"

JMX_A="$SCRIPT_DIR/scenario_a.jmx"
JMX_B="$SCRIPT_DIR/scenario_b.jmx"

echo "=== LinkedIn JMeter Load Test Suite ==="
echo "Scenarios: A (Job Search+Detail) and B (Apply Submit)"
echo "Configs: B / B+S / B+S+K / B+S+K+Other"
echo ""

run_jmeter() {
  local jmx="$1"
  local out="$2"
  rm -f "$out"
  # Point output file in JMX to our results dir by overriding the property
  jmeter -n -t "$jmx" \
    -Jjmeter.save.saveservice.output_format=csv \
    -l "$out" \
    -e -o /tmp/jmeter_report_$$ 2>/dev/null
  rm -rf /tmp/jmeter_report_$$
}

# ── B: Cold cache (flush Redis before each run so every hit goes to MySQL) ──
echo "[1/9] Scenario A — B (cold cache, no Redis warm)..."
redis-cli FLUSHALL > /dev/null 2>&1 || true
run_jmeter "$JMX_A" "$RESULTS/a_B.csv"
echo "      Done: $RESULTS/a_B.csv"

echo "[2/9] Scenario B — B (cold cache)..."
redis-cli FLUSHALL > /dev/null 2>&1 || true
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "DELETE FROM application_db.applications;" 2>/dev/null || true
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "SELECT CONCAT(j.job_id, ',', m.member_id) FROM data236.job_postings j CROSS JOIN data236.members m LIMIT 500;" 2>/dev/null > /tmp/apply_pairs.csv
run_jmeter "$JMX_B" "$RESULTS/b_B.csv"
echo "      Done: $RESULTS/b_B.csv"

# ── B+S: Warm Redis (run a warmup pass, then real test) ──
echo "[3/9] Warming Redis cache..."
redis-cli FLUSHALL > /dev/null 2>&1 || true
# Warmup: hit the search endpoint 20 times to fill Redis
for i in $(seq 1 20); do
  curl -s -X POST http://localhost:3002/api/v1/jobs/search \
    -H "Content-Type: application/json" \
    -d '{"keyword":"software engineer","page":1,"limit":10}' > /dev/null 2>&1
done
echo "      Redis warmed."

echo "[4/9] Scenario A — B+S (Redis warm)..."
run_jmeter "$JMX_A" "$RESULTS/a_BpS.csv"
echo "      Done: $RESULTS/a_BpS.csv"

echo "[5/9] Scenario B — B+S (Redis warm)..."
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "DELETE FROM application_db.applications;" 2>/dev/null || true
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "SELECT CONCAT(j.job_id, ',', m.member_id) FROM data236.job_postings j CROSS JOIN data236.members m LIMIT 500;" 2>/dev/null > /tmp/apply_pairs.csv
run_jmeter "$JMX_B" "$RESULTS/b_BpS.csv"
echo "      Done: $RESULTS/b_BpS.csv"

# ── B+S+K: Kafka is always running in our stack, same as B+S for search ──
echo "[6/9] Scenario A — B+S+K (Kafka active, Redis warm)..."
run_jmeter "$JMX_A" "$RESULTS/a_BpSpK.csv"
echo "      Done: $RESULTS/a_BpSpK.csv"

echo "[7/9] Scenario B — B+S+K..."
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "DELETE FROM application_db.applications;" 2>/dev/null || true
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "SELECT CONCAT(j.job_id, ',', m.member_id) FROM data236.job_postings j CROSS JOIN data236.members m LIMIT 500;" 2>/dev/null > /tmp/apply_pairs.csv
run_jmeter "$JMX_B" "$RESULTS/b_BpSpK.csv"
echo "      Done: $RESULTS/b_BpSpK.csv"

# ── B+S+K+Other: Connection pooling + keep-alive already in use ──
echo "[8/9] Scenario A — B+S+K+Other..."
run_jmeter "$JMX_A" "$RESULTS/a_BpSpKpX.csv"
echo "      Done: $RESULTS/a_BpSpKpX.csv"

echo "[9/9] Scenario B — B+S+K+Other..."
# Refresh apply pairs for this run
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "DELETE FROM application_db.applications;" 2>/dev/null || true
mysql -h 127.0.0.1 -P 3306 -u root -sN -e "SELECT CONCAT(j.job_id, ',', m.member_id) FROM data236.job_postings j CROSS JOIN data236.members m LIMIT 500;" 2>/dev/null > /tmp/apply_pairs.csv
run_jmeter "$JMX_B" "$RESULTS/b_BpSpKpX.csv"
echo "      Done: $RESULTS/b_BpSpKpX.csv"

echo ""
echo "All runs complete. Parsing results..."
python3 "$SCRIPT_DIR/parse_results.py"
