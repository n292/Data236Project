-- Idempotent Kafka consumer bookkeeping (Guideline #3 — at-least-once)
CREATE TABLE IF NOT EXISTS processed_events (
  idempotency_key VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  trace_id CHAR(36) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idempotency_key),
  KEY idx_processed_trace (trace_id),
  KEY idx_processed_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
