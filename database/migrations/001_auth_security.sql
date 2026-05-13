-- FarmaVida
-- Module: auth + seguranca
-- Purpose: identity, RBAC, password recovery, login throttling and secure sessions.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_slug (slug),
  KEY idx_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_slug (slug),
  KEY idx_permissions_module_action (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_type ENUM('customer','admin','system') NOT NULL DEFAULT 'customer',
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_changed_at DATETIME NULL,
  email_verified_at DATETIME NULL,
  status ENUM('pending','active','blocked','deleted') NOT NULL DEFAULT 'pending',
  mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  force_password_change TINYINT(1) NOT NULL DEFAULT 0,
  session_version INT UNSIGNED NOT NULL DEFAULT 1,
  remember_token_hash CHAR(64) NULL,
  last_login_at DATETIME NULL,
  last_login_ip VARCHAR(45) NULL,
  created_ip VARCHAR(45) NULL,
  created_user_agent VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_public_id (public_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_type_status (user_type, status),
  KEY idx_users_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role_id (role_id),
  KEY idx_user_roles_assigned_by (assigned_by),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  employee_code VARCHAR(60) NULL,
  display_name VARCHAR(160) NULL,
  position VARCHAR(120) NULL,
  crf_number VARCHAR(40) NULL,
  is_pharmacist TINYINT(1) NOT NULL DEFAULT 0,
  can_validate_prescriptions TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  last_panel_access_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_user_id (user_id),
  UNIQUE KEY uq_admins_employee_code (employee_code),
  KEY idx_admins_status_pharmacist (status, is_pharmacist),
  CONSTRAINT fk_admins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  email VARCHAR(190) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  requester_ip VARCHAR(45) NULL,
  requester_user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token_hash (token_hash),
  KEY idx_password_resets_email_expires (email, expires_at),
  KEY idx_password_resets_user_id (user_id),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  context ENUM('customer_login','admin_login','password_reset','checkout','api') NOT NULL,
  identifier VARCHAR(190) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_login_attempts_context_identifier_ip (context, identifier, ip_address),
  KEY idx_login_attempts_locked_until (locked_until),
  KEY idx_login_attempts_last_attempt_at (last_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  session_id_hash CHAR(64) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_sessions_session_hash (session_id_hash),
  KEY idx_user_sessions_user_activity (user_id, last_activity_at),
  KEY idx_user_sessions_expires_revoked (expires_at, revoked_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS csrf_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  session_id_hash CHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  form_context VARCHAR(120) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_csrf_tokens_token_hash (token_hash),
  KEY idx_csrf_tokens_session_context (session_id_hash, form_context),
  KEY idx_csrf_tokens_user_id (user_id),
  KEY idx_csrf_tokens_expires_at (expires_at),
  CONSTRAINT fk_csrf_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

