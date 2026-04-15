# Job search performance notes (W2 / Guideline #10)

## 10k+ rows

Load data (cap while iterating on laptop):

```bash
JOBS_CSV_PATH=./data/job_postings.csv SEED_MAX_ROWS=10000 npm run seed
```

Confirm count:

```sql
SELECT COUNT(*) FROM job_postings;
```

## EXPLAIN full-text search

Example (adjust keyword):

```sql
EXPLAIN SELECT *
FROM job_postings
WHERE MATCH(title, description) AGAINST ('+engineer* +insurance*' IN BOOLEAN MODE)
 AND status = 'open'
ORDER BY posted_datetime DESC
LIMIT 20;
```

Expect **`type`** / **`key`** to show use of the **`ft_job_postings_search`** FULLTEXT index where the `MATCH` predicate is selective enough. Add filters (`location`, `employment_type`, `remote`, `industry`) and re-run `EXPLAIN` for team benchmarks (M7).

## Operational notes

- Very short keywords (e.g. one or two letters) may return zero hits due to InnoDB full-text token rules.
- For production-scale loads, prefer **streaming CSV ingest** over loading the entire file in memory (future improvement to `database/seed.js`).
