"""
Parse JMeter CSV results, print summary, and update PPT with real numbers.
"""
import csv, os, json, statistics, math

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")

def parse_csv(path):
    rows = []
    try:
        with open(path, newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
    except FileNotFoundError:
        return None
    return rows

def compute_stats(rows):
    if not rows:
        return None
    latencies = []
    errors = 0
    start_ts = None
    end_ts = None
    for row in rows:
        try:
            elapsed = int(row.get('elapsed', row.get('Latency', 0)))
            latencies.append(elapsed)
            success = row.get('success', row.get('Success', 'true')).strip().lower()
            if success not in ('true', '1'):
                errors += 1
            ts = int(row.get('timeStamp', row.get('timestamp', 0)))
            if start_ts is None or ts < start_ts:
                start_ts = ts
            if end_ts is None or ts > end_ts:
                end_ts = ts
        except (ValueError, KeyError):
            continue

    if not latencies:
        return None

    n = len(latencies)
    avg = statistics.mean(latencies)
    sorted_lat = sorted(latencies)
    p90 = sorted_lat[math.ceil(0.90 * n) - 1]
    p95 = sorted_lat[math.ceil(0.95 * n) - 1]
    p99 = sorted_lat[math.ceil(0.99 * n) - 1]
    error_rate = (errors / n) * 100

    # TPS = total requests / total duration in seconds
    duration_s = (end_ts - start_ts) / 1000.0 if start_ts and end_ts and end_ts > start_ts else 1
    tps = round(n / duration_s, 1)

    return {
        "samples": n,
        "avg_ms": round(avg, 1),
        "p90_ms": p90,
        "p95_ms": p95,
        "p99_ms": p99,
        "error_pct": round(error_rate, 1),
        "tps": tps,
        "errors": errors,
    }

configs = ["B", "BpS", "BpSpK", "BpSpKpX"]
config_labels = ["B", "B+S", "B+S+K", "B+S+K+Other"]

print("\n=== SCENARIO A: Job Search + Job Detail ===")
print(f"{'Config':<16} {'TPS':>8} {'Avg(ms)':>10} {'P95(ms)':>10} {'P99(ms)':>10} {'Errors%':>9}")
print("-" * 65)
stats_a = {}
for cfg, lbl in zip(configs, config_labels):
    path = os.path.join(RESULTS_DIR, f"a_{cfg}.csv")
    rows = parse_csv(path)
    s = compute_stats(rows) if rows else None
    stats_a[lbl] = s
    if s:
        print(f"{lbl:<16} {s['tps']:>8} {s['avg_ms']:>10} {s['p95_ms']:>10} {s['p99_ms']:>10} {s['error_pct']:>9}")
    else:
        print(f"{lbl:<16} {'N/A':>8}")

print("\n=== SCENARIO B: Apply Submit ===")
print(f"{'Config':<16} {'TPS':>8} {'Avg(ms)':>10} {'P95(ms)':>10} {'P99(ms)':>10} {'Errors%':>9}")
print("-" * 65)
stats_b = {}
for cfg, lbl in zip(configs, config_labels):
    path = os.path.join(RESULTS_DIR, f"b_{cfg}.csv")
    rows = parse_csv(path)
    s = compute_stats(rows) if rows else None
    stats_b[lbl] = s
    if s:
        print(f"{lbl:<16} {s['tps']:>8} {s['avg_ms']:>10} {s['p95_ms']:>10} {s['p99_ms']:>10} {s['error_pct']:>9}")
    else:
        print(f"{lbl:<16} {'N/A':>8}")

# Save to JSON for PPT generator
out = {
    "scenario_a": {lbl: stats_a[lbl] for lbl in config_labels},
    "scenario_b": {lbl: stats_b[lbl] for lbl in config_labels},
}
json_path = os.path.join(RESULTS_DIR, "summary.json")
with open(json_path, "w") as f:
    json.dump(out, f, indent=2)
print(f"\nSaved summary → {json_path}")
print("Run update_ppt.py to regenerate the presentation with these numbers.")
