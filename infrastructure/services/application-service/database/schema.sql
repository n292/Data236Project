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
  resume_url        VARCHAR(512)  NULL,
  cover_letter      TEXT          NULL,
  metadata          JSON          NULL, -- For extra fields like "top choice", "education", etc.

  -- Status machine: draft, submitted, reviewing, rejected, interview, offer
  status          ENUM('draft', 'submitted', 'reviewing', 'rejected', 'interview', 'offer')
                  NOT NULL DEFAULT 'submitted',

  -- Recruiter interaction
  recruiter_note  TEXT          NULL,

  -- Timestamps
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,

  -- Prevents one member from applying to the same job twice (only for submitted applications)
  -- Note: Drafts should not block submission. We might handle this in application logic.
  CONSTRAINT uq_job_member UNIQUE (job_id, member_id),

  -- Indexes for query performance
  INDEX idx_job_id     (job_id),
  INDEX idx_member_id  (member_id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
);