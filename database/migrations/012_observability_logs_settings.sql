-- FarmaVida
-- Module: logs + seguranca + configuracoes
-- Purpose: settings, pharmacy profile, email logs, audit logs and health/readiness records.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_group VARCHAR(80) NOT NULL,
  setting_key VARCHAR(140) NOT NULL,
  setting_value TEXT NULL,
  value_type ENUM('string','int','decimal','bool','json','encrypted') NOT NULL DEFAULT 'string',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  is_sensitive TINYINT(1) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_group_key (setting_group, setting_key),
  KEY idx_settings_public_group (is_public, setting_group),
  KEY idx_settings_updated_by (updated_by),
  CONSTRAINT fk_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pharmacy_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legal_name VARCHAR(190) NOT NULL,
  trade_name VARCHAR(190) NOT NULL,
  cnpj VARCHAR(20) NOT NULL,
  address_street VARCHAR(180) NOT NULL,
  address_number VARCHAR(30) NOT NULL,
  address_complement VARCHAR(120) NULL,
  address_district VARCHAR(120) NOT NULL,
  address_city VARCHAR(120) NOT NULL,
  address_state CHAR(2) NOT NULL,
  address_postal_code VARCHAR(12) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(190) NOT NULL,
  responsible_pharmacist VARCHAR(160) NOT NULL,
  crf_number VARCHAR(40) NOT NULL,
  sanitary_license VARCHAR(120) NULL,
  anvisa_afe VARCHAR(120) NULL,
  anvisa_ae VARCHAR(120) NULL,
  operating_hours_text TEXT NULL,
  privacy_policy_url VARCHAR(500) NULL,
  terms_url VARCHAR(500) NULL,
  customer_service_channel VARCHAR(255) NULL,
  pharmaceutical_guidance_channel VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pharmacy_profiles_cnpj (cnpj),
  KEY idx_pharmacy_profiles_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  email_type ENUM('welcome','registration_confirmation','password_reset','order_confirmation','order_status','payment_confirmed','prescription_approved','prescription_rejected','out_for_delivery','ready_for_pickup','delivered','abandoned_cart','replenishment','inactive_customer','promotional','manual') NOT NULL,
  recipient_email VARCHAR(190) NOT NULL,
  recipient_name VARCHAR(160) NULL,
  subject VARCHAR(190) NOT NULL,
  template_name VARCHAR(120) NULL,
  provider ENUM('phpmailer','mail','log_only') NOT NULL DEFAULT 'phpmailer',
  status ENUM('queued','sent','failed','skipped') NOT NULL DEFAULT 'queued',
  error_message TEXT NULL,
  metadata JSON NULL,
  queued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_logs_public_id (public_id),
  KEY idx_email_logs_user (user_id),
  KEY idx_email_logs_customer (customer_id),
  KEY idx_email_logs_order (order_id),
  KEY idx_email_logs_type_status (email_type, status),
  KEY idx_email_logs_recipient_created (recipient_email, created_at),
  CONSTRAINT fk_email_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_logs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_email_logs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  module VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id BIGINT UNSIGNED NULL,
  previous_data_sanitized JSON NULL,
  new_data_sanitized JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_action_logs_admin_created (admin_user_id, created_at),
  KEY idx_admin_action_logs_module_action (module, action),
  KEY idx_admin_action_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_admin_action_logs_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sensitive_data_access_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  data_type ENUM('cpf','address','prescription','order_health_context','lgpd_export','payment_payer','invoice_customer') NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  legal_basis VARCHAR(120) NULL,
  entity_type VARCHAR(80) NULL,
  entity_id BIGINT UNSIGNED NULL,
  access_type ENUM('view','export','download','print','mask_reveal','update','delete') NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sensitive_access_actor_created (actor_user_id, created_at),
  KEY idx_sensitive_access_customer_created (customer_id, created_at),
  KEY idx_sensitive_access_type_created (data_type, created_at),
  KEY idx_sensitive_access_entity (entity_type, entity_id),
  CONSTRAINT fk_sensitive_access_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_sensitive_access_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level ENUM('debug','info','notice','warning','error','critical','alert','emergency') NOT NULL DEFAULT 'info',
  channel VARCHAR(80) NOT NULL DEFAULT 'app',
  message VARCHAR(1000) NOT NULL,
  context_sanitized JSON NULL,
  request_id CHAR(36) NULL,
  user_id BIGINT UNSIGNED NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_application_logs_level_created (level, created_at),
  KEY idx_application_logs_channel_created (channel, created_at),
  KEY idx_application_logs_request (request_id),
  KEY idx_application_logs_user (user_id),
  CONSTRAINT fk_application_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_health_checks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  check_name VARCHAR(120) NOT NULL,
  status ENUM('ok','warning','failed','unknown') NOT NULL DEFAULT 'unknown',
  response_time_ms INT UNSIGNED NULL,
  message VARCHAR(500) NULL,
  details_json JSON NULL,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_system_health_checks_name_checked (check_name, checked_at),
  KEY idx_system_health_checks_status_checked (status, checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS readiness_checks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id CHAR(36) NOT NULL,
  check_name VARCHAR(140) NOT NULL,
  status ENUM('pass','warning','fail') NOT NULL,
  message VARCHAR(500) NULL,
  details_json JSON NULL,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_readiness_checks_run (run_id),
  KEY idx_readiness_checks_status (status),
  KEY idx_readiness_checks_name (check_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type ENUM('login_success','login_failed','rate_limited','password_reset_requested','password_reset_used','csrf_failed','permission_denied','api_key_denied','suspicious_upload','webhook_signature_failed','session_revoked') NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  user_id BIGINT UNSIGNED NULL,
  identifier VARCHAR(190) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  metadata_sanitized JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_security_events_type_created (event_type, created_at),
  KEY idx_security_events_user_created (user_id, created_at),
  KEY idx_security_events_ip_created (ip_address, created_at),
  KEY idx_security_events_severity_created (severity, created_at),
  CONSTRAINT fk_security_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

