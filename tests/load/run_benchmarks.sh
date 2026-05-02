#!/usr/bin/env bash
# run_benchmarks.sh — Execute all 4 k6 configurations for Scenario A and B.
#
# Prerequisites:
#   brew install k6   (macOS)   OR   https://k6.io/docs/getting-started/installation/
#
# Usage:
#   cd /path/to/linkedin
#   bash tests/load/run_benchmarks.sh
#
# Results are written to tests/load/results/
#   scenario_a_B.csv, scenario_a_B+S.csv, scenario_a_B+S+K.csv, scenario_a_B+S+K+O.csv
#   scenario_b_B.csv, ... (same)
#   summary.txt  — human-readable table of all runs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
mkdir -p "${RESULTS_DIR}"

CONFIGS=("B" "B+S" "B+S+K" "B+S+K+O")

JOB_SERVICE_URL="${JOB_SERVICE_URL:-http://localhost:3002}"
APP_SERVICE_URL="${APP_SERVICE_URL:-http://localhost:5003}"

SUMMARY="${RESULTS_DIR}/summary.txt"
echo "LinkedIn Load Test Summary — $(date)" > "${SUMMARY}"
echo "======================================" >> "${SUMMARY}"
echo "" >> "${SUMMARY}"

run_scenario() {
  local SCENARIO="$1"   # a or b
  local CONFIG="$2"
  local SCRIPT="${SCRIPT_DIR}/scenario_${SCENARIO}_*.js"
  # Expand glob
  local SCRIPT_FILE
  SCRIPT_FILE=$(ls "${SCRIPT_DIR}/scenario_${SCENARIO}"_*.js 2>/dev/null | head -1)
  if [[ -z "${SCRIPT_FILE}" ]]; then
    echo "WARN: no script for scenario ${SCENARIO}" | tee -a "${SUMMARY}"
    return
  fi

  local OUT_CSV="${RESULTS_DIR}/scenario_${SCENARIO}_${CONFIG//+/_}.csv"
  echo "▶ Scenario ${SCENARIO^^} [${CONFIG}] ..."

  k6 run \
    --out "csv=${OUT_CSV}" \
    -e "K6_CONFIG=${CONFIG}" \
    -e "JOB_SERVICE_URL=${JOB_SERVICE_URL}" \
    -e "APP_SERVICE_URL=${APP_SERVICE_URL}" \
    --summary-export "${RESULTS_DIR}/scenario_${SCENARIO}_${CONFIG//+/_}_summary.json" \
    "${SCRIPT_FILE}" 2>&1 | tee -a "${SUMMARY}"

  echo "" >> "${SUMMARY}"
  echo "  CSV: ${OUT_CSV}" >> "${SUMMARY}"
  echo "" >> "${SUMMARY}"
}

echo "=== Scenario A: Job Search + View ===" | tee -a "${SUMMARY}"
for C in "${CONFIGS[@]}"; do
  run_scenario "a" "${C}"
done

echo "" | tee -a "${SUMMARY}"
echo "=== Scenario B: Apply Submit ===" | tee -a "${SUMMARY}"
for C in "${CONFIGS[@]}"; do
  run_scenario "b" "${C}"
done

echo "" >> "${SUMMARY}"
echo "Done. Results: ${RESULTS_DIR}" | tee -a "${SUMMARY}"
