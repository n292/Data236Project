-- Optional industry filter for POST /jobs/search (W1)
-- Re-run: migrate script skips duplicate column / duplicate key errors.
ALTER TABLE job_postings
  ADD COLUMN industry VARCHAR(128) NULL DEFAULT NULL AFTER location;

ALTER TABLE job_postings
  ADD KEY idx_job_postings_industry (industry);
