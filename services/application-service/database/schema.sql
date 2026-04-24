-- ─────────────────────────────────────────────────────────────────
-- M3 — Application Service Schema
-- Database: MySQL
-- Run this file once to initialize the applications table.
-- ─────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS application_db;
USE application_db;

CREATE TABLE IF NOT EXISTS applications (
  -- Primary key
  application_id  VARCHAR(36)   NOT NULL PRIMARY KEY,

  -- Foreign keys (referenced from other services)
  job_id          VARCHAR(36)   NOT NULL,
  member_id       VARCHAR(36)   NOT NULL,
  recruiter_id    VARCHAR(36)   NULL,

  -- Application content
  resume_text     LONGTEXT      NULL,
  cover_letter    TEXT          NULL,

  -- Status machine: submitted → reviewed → accepted | rejected
  status          ENUM('submitted', 'reviewed', 'accepted', 'rejected')
                  NOT NULL DEFAULT 'submitted',

  -- Recruiter interaction
  recruiter_note  TEXT          NULL,

  -- Timestamps
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,

  -- Prevents one member from applying to the same job twice
  CONSTRAINT uq_job_member UNIQUE (job_id, member_id),

  -- Indexes for query performance (per spec: job_id, member_id, status)
  INDEX idx_job_id     (job_id),
  INDEX idx_member_id  (member_id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
);