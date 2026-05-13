-- FarmaVida
-- Module: erp + integracoes
-- Purpose: API keys, API logs, incoming/outgoing webhooks and ERP sync.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  name VARCHAR(140) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  scopes JSON NOT NULL,
  allowed_ips TEXT NULL,
  status ENUM('active','inactive','revoked') NOT NULL DEFAULT 'active',
  rate_limit_per_minute INT UNSIGNED NOT NULL DEFAULT 120,
  created_by BIGINT UNSIGNED NULL,
  last_used_at DATETIME NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_keys_public_id (public_id),
  UNIQUE KEY uq_api_keys_key_hash (key_hash),
  KEY idx_api_keys_prefix_status (key_prefix, status),
  KEY idx_api_keys_created_by (created_by),
  CONSTRAINT fk_api_keys_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  api_key_id BIGINT UNSIGNED NULL,
  request_id CHAR(36) NOT NULL,
  method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  route_name VARCHAR(120) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  request_payload_sanitized JSON NULL,
  response_status SMALLINT UNSIGNED NOT NULL,
  response_time_ms INT UNSIGNED NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_logs_request_id (request_id),
  KEY idx_api_logs_api_key_created (api_key_id, created_at),
  KEY idx_api_logs_endpoint_created (endpoint, created_at),
  KEY idx_api_logs_status_created (response_status, created_at),
  CONSTRAINT fk_api_logs_api_key FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incoming_webhooks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  name VARCHAR(140) NOT NULL,
  source ENUM('erp','zapier','make','bling','omie','conta_azul','sap','custom') NOT NULL DEFAULT 'custom',
  endpoint_token_hash CHAR(64) NOT NULL,
  secret_hash CHAR(64) NULL,
  scopes JSON NOT NULL,
  status ENUM('active','inactive','revoked') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  last_received_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_incoming_webhooks_public_id (public_id),
  UNIQUE KEY uq_incoming_webhooks_token_hash (endpoint_token_hash),
  KEY idx_incoming_webhooks_source_status (source, status),
  KEY idx_incoming_webhooks_created_by (created_by),
  CONSTRAINT fk_incoming_webhooks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outgoing_webhooks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  name VARCHAR(140) NOT NULL,
  event_type ENUM('pedido_criado','status_atualizado','pagamento_confirmado','estoque_baixo','estoque_zerado','nfe_emitida','receita_aprovada','receita_rejeitada') NOT NULL,
  target_url VARCHAR(500) NOT NULL,
  secret_hash CHAR(64) NULL,
  headers_json JSON NULL,
  status ENUM('active','inactive','paused') NOT NULL DEFAULT 'active',
  max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 8,
  timeout_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  created_by BIGINT UNSIGNED NULL,
  last_success_at DATETIME NULL,
  last_failure_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_outgoing_webhooks_public_id (public_id),
  KEY idx_outgoing_webhooks_event_status (event_type, status),
  KEY idx_outgoing_webhooks_created_by (created_by),
  CONSTRAINT fk_outgoing_webhooks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  webhook_id BIGINT UNSIGNED NULL,
  incoming_webhook_id BIGINT UNSIGNED NULL,
  direction ENUM('incoming','outgoing') NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  idempotency_key_hash CHAR(64) NULL,
  related_type VARCHAR(80) NULL,
  related_id BIGINT UNSIGNED NULL,
  request_payload_sanitized JSON NULL,
  response_payload_sanitized JSON NULL,
  response_status SMALLINT UNSIGNED NULL,
  processing_status ENUM('queued','sent','received','processed','failed','duplicate','dead_letter') NOT NULL DEFAULT 'queued',
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_webhook_logs_idempotency (idempotency_key_hash),
  KEY idx_webhook_logs_outgoing (webhook_id, created_at),
  KEY idx_webhook_logs_incoming (incoming_webhook_id, created_at),
  KEY idx_webhook_logs_status_next (processing_status, next_attempt_at),
  KEY idx_webhook_logs_event_created (event_type, created_at),
  CONSTRAINT fk_webhook_logs_outgoing FOREIGN KEY (webhook_id) REFERENCES outgoing_webhooks(id) ON DELETE SET NULL,
  CONSTRAINT fk_webhook_logs_incoming FOREIGN KEY (incoming_webhook_id) REFERENCES incoming_webhooks(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_delivery_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  webhook_log_id BIGINT UNSIGNED NOT NULL,
  attempt_number SMALLINT UNSIGNED NOT NULL,
  request_headers JSON NULL,
  request_body_sanitized JSON NULL,
  response_status SMALLINT UNSIGNED NULL,
  response_body_sanitized JSON NULL,
  response_time_ms INT UNSIGNED NULL,
  error_message TEXT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_webhook_delivery_attempts_log_attempt (webhook_log_id, attempt_number),
  KEY idx_webhook_delivery_attempts_attempted (attempted_at),
  CONSTRAINT fk_webhook_delivery_attempts_log FOREIGN KEY (webhook_log_id) REFERENCES webhook_logs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_integrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  provider ENUM('bling','omie','conta_azul','sap','custom_rest','zapier','make') NOT NULL,
  name VARCHAR(140) NOT NULL,
  base_url VARCHAR(500) NULL,
  credentials_encrypted VARBINARY(2048) NULL,
  config_json JSON NULL,
  status ENUM('active','inactive','error') NOT NULL DEFAULT 'inactive',
  last_sync_at DATETIME NULL,
  last_error TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_erp_integrations_public_id (public_id),
  KEY idx_erp_integrations_provider_status (provider, status),
  KEY idx_erp_integrations_created_by (created_by),
  CONSTRAINT fk_erp_integrations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erp_sync_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  erp_integration_id BIGINT UNSIGNED NOT NULL,
  entity_type ENUM('product','stock','order','customer','payment','invoice','prescription') NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  direction ENUM('import','export') NOT NULL,
  status ENUM('queued','success','failed','skipped') NOT NULL DEFAULT 'queued',
  request_payload_sanitized JSON NULL,
  response_payload_sanitized JSON NULL,
  error_message TEXT NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_erp_sync_logs_integration_created (erp_integration_id, created_at),
  KEY idx_erp_sync_logs_entity (entity_type, entity_id),
  KEY idx_erp_sync_logs_status (status),
  CONSTRAINT fk_erp_sync_logs_integration FOREIGN KEY (erp_integration_id) REFERENCES erp_integrations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

