-- FarmaVida
-- Module: migrations
-- Purpose: controlled migration registry and execution lock.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS migrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  migration VARCHAR(190) NOT NULL,
  module VARCHAR(80) NOT NULL,
  batch INT UNSIGNED NOT NULL DEFAULT 1,
  checksum CHAR(64) NULL,
  status ENUM('pending','running','ran','failed','rolled_back') NOT NULL DEFAULT 'pending',
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  execution_ms INT UNSIGNED NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_migrations_migration (migration),
  KEY idx_migrations_module_status (module, status),
  KEY idx_migrations_batch (batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_locks (
  id TINYINT UNSIGNED NOT NULL,
  locked_by VARCHAR(120) NOT NULL,
  locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_migration_locks_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

