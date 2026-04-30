-- Add company_name column missing from initial schema
ALTER TABLE job_postings
  ADD COLUMN company_name VARCHAR(255) NULL DEFAULT NULL AFTER recruiter_id;
