-- FarmaVida
-- Module: clientes + LGPD
-- Purpose: customer profile, addresses, consent, privacy requests and communication preferences.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  cpf_hash CHAR(64) NULL,
  cpf_masked VARCHAR(20) NULL,
  cpf_last4 CHAR(4) NULL,
  cpf_encrypted VARBINARY(512) NULL,
  birth_date DATE NULL,
  gender ENUM('female','male','non_binary','not_informed') NULL,
  accepts_lgpd TINYINT(1) NOT NULL DEFAULT 0,
  lgpd_accepted_at DATETIME NULL,
  lgpd_accepted_ip VARCHAR(45) NULL,
  lgpd_accepted_user_agent VARCHAR(255) NULL,
  marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0,
  marketing_opt_in_at DATETIME NULL,
  account_status ENUM('active','pending_verification','anonymization_requested','anonymized','deleted') NOT NULL DEFAULT 'pending_verification',
  last_order_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_user_id (user_id),
  UNIQUE KEY uq_customers_cpf_hash (cpf_hash),
  KEY idx_customers_status (account_status),
  KEY idx_customers_last_order_at (last_order_at),
  KEY idx_customers_deleted_at (deleted_at),
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(80) NOT NULL DEFAULT 'Principal',
  recipient_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NULL,
  postal_code VARCHAR(12) NOT NULL,
  street VARCHAR(180) NOT NULL,
  number VARCHAR(30) NOT NULL,
  complement VARCHAR(120) NULL,
  district VARCHAR(120) NOT NULL,
  city VARCHAR(120) NOT NULL,
  state CHAR(2) NOT NULL,
  country CHAR(2) NOT NULL DEFAULT 'BR',
  reference_point VARCHAR(160) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customer_addresses_customer_default (customer_id, is_default),
  KEY idx_customer_addresses_postal_code (postal_code),
  KEY idx_customer_addresses_city_state (city, state),
  KEY idx_customer_addresses_deleted_at (deleted_at),
  CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lgpd_consents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  consent_type ENUM('privacy_policy','terms_of_use','marketing','sensitive_data','cookies','pharmaceutical_guidance') NOT NULL,
  version VARCHAR(40) NOT NULL,
  accepted TINYINT(1) NOT NULL DEFAULT 1,
  accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  legal_basis VARCHAR(120) NULL,
  purpose VARCHAR(255) NOT NULL,
  evidence_hash CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lgpd_consents_user_type (user_id, consent_type),
  KEY idx_lgpd_consents_customer_id (customer_id),
  KEY idx_lgpd_consents_accepted_at (accepted_at),
  CONSTRAINT fk_lgpd_consents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lgpd_consents_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lgpd_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  request_type ENUM('export','delete','anonymize','rectify','revoke_consent','information') NOT NULL,
  status ENUM('received','in_review','waiting_customer','completed','rejected','cancelled') NOT NULL DEFAULT 'received',
  requested_by_user_id BIGINT UNSIGNED NULL,
  description TEXT NULL,
  admin_notes TEXT NULL,
  response_file_path VARCHAR(255) NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME NULL,
  completed_at DATETIME NULL,
  handled_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lgpd_requests_public_id (public_id),
  KEY idx_lgpd_requests_customer_status (customer_id, status),
  KEY idx_lgpd_requests_type_status (request_type, status),
  KEY idx_lgpd_requests_handled_by (handled_by),
  CONSTRAINT fk_lgpd_requests_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_lgpd_requests_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_lgpd_requests_handled_by FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_communication_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('email','sms','whatsapp','phone') NOT NULL,
  transactional_enabled TINYINT(1) NOT NULL DEFAULT 1,
  marketing_enabled TINYINT(1) NOT NULL DEFAULT 0,
  replenishment_enabled TINYINT(1) NOT NULL DEFAULT 1,
  inactive_customer_enabled TINYINT(1) NOT NULL DEFAULT 0,
  updated_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_comm_preferences (customer_id, channel),
  KEY idx_customer_comm_preferences_updated_by (updated_by_user_id),
  CONSTRAINT fk_customer_comm_preferences_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_comm_preferences_updated_by FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

