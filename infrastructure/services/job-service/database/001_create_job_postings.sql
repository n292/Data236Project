-- Job postings (Member 2 — transactional MySQL)
-- Apply: mysql -u root -p data236 < database/001_create_job_postings.sql
--
-- Note: company_id and recruiter_id are shaped for UUID strings. Foreign keys to
-- `companies` / `recruiters` (or `members`) are deferred until those tables exist
-- in the shared schema; add ALTER TABLE ... ADD CONSTRAINT when ready.

CREATE TABLE IF NOT EXISTS job_postings (
  job_id CHAR(36) NOT NULL,
  company_id CHAR(36) NOT NULL,
  recruiter_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  seniority_level VARCHAR(64) DEFAULT NULL,
  employment_type VARCHAR(64) NOT NULL,
  location VARCHAR(255) NOT NULL,
  remote ENUM('onsite', 'remote', 'hybrid') NOT NULL DEFAULT 'onsite',
  skills_required JSON DEFAULT NULL,
  salary_min DECIMAL(12, 2) DEFAULT NULL,
  salary_max DECIMAL(12, 2) DEFAULT NULL,
  posted_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  views_count INT NOT NULL DEFAULT 0,
  applicants_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id),
  KEY idx_job_postings_location (location),
  KEY idx_job_postings_company (company_id),
  KEY idx_job_postings_status (status),
  KEY idx_job_postings_recruiter (recruiter_id),
  FULLTEXT KEY ft_job_postings_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
