-- FarmaVida
-- Module: operacao
-- Purpose: delivery zones, delivery people, operating hours, order responsibility and support.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS delivery_zones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(140) NOT NULL,
  zone_type ENUM('district','postal_code','distance','city') NOT NULL DEFAULT 'district',
  district VARCHAR(120) NULL,
  postal_code_start VARCHAR(12) NULL,
  postal_code_end VARCHAR(12) NULL,
  city VARCHAR(120) NULL,
  state CHAR(2) NULL,
  max_distance_km DECIMAL(8,2) NULL,
  fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  minimum_order_value DECIMAL(12,2) NULL,
  free_shipping_minimum DECIMAL(12,2) NULL,
  estimated_minutes SMALLINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_zones_name (name),
  KEY idx_delivery_zones_type_active (zone_type, is_active),
  KEY idx_delivery_zones_district_city (district, city, state),
  KEY idx_delivery_zones_postal_range (postal_code_start, postal_code_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_people (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NULL,
  document_masked VARCHAR(30) NULL,
  vehicle_type ENUM('motorcycle','car','bicycle','walking','third_party') NOT NULL DEFAULT 'motorcycle',
  vehicle_plate VARCHAR(20) NULL,
  status ENUM('available','busy','inactive','blocked') NOT NULL DEFAULT 'available',
  current_latitude DECIMAL(10,7) NULL,
  current_longitude DECIMAL(10,7) NULL,
  last_location_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_delivery_people_user (user_id),
  KEY idx_delivery_people_status (status),
  KEY idx_delivery_people_deleted_at (deleted_at),
  CONSTRAINT fk_delivery_people_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  delivery_person_id BIGINT UNSIGNED NULL,
  status ENUM('assigned','accepted','picked_up','in_transit','delivered','failed','cancelled') NOT NULL DEFAULT 'assigned',
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  picked_up_at DATETIME NULL,
  delivered_at DATETIME NULL,
  failure_reason VARCHAR(255) NULL,
  tracking_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_delivery_assignments_order (order_id),
  KEY idx_delivery_assignments_person_status (delivery_person_id, status),
  KEY idx_delivery_assignments_assigned_by (assigned_by),
  CONSTRAINT fk_delivery_assignments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_delivery_assignments_person FOREIGN KEY (delivery_person_id) REFERENCES delivery_people(id) ON DELETE SET NULL,
  CONSTRAINT fk_delivery_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operating_hours (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  weekday TINYINT UNSIGNED NOT NULL,
  opens_at TIME NULL,
  closes_at TIME NULL,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  accepts_delivery TINYINT(1) NOT NULL DEFAULT 1,
  accepts_pickup TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_operating_hours_weekday (weekday)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  previous_status ENUM('open','closed','paused','pickup_only') NULL,
  new_status ENUM('open','closed','paused','pickup_only') NOT NULL,
  reason VARCHAR(255) NULL,
  changed_by BIGINT UNSIGNED NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_store_status_history_changed (changed_at),
  KEY idx_store_status_history_changed_by (changed_by),
  CONSTRAINT fk_store_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_internal_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  note TEXT NOT NULL,
  visibility ENUM('internal','customer') NOT NULL DEFAULT 'internal',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_order_internal_notes_order_created (order_id, created_at),
  KEY idx_order_internal_notes_created_by (created_by),
  KEY idx_order_internal_notes_deleted_at (deleted_at),
  CONSTRAINT fk_order_internal_notes_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_internal_notes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  sender_user_id BIGINT UNSIGNED NULL,
  sender_type ENUM('customer','admin','system') NOT NULL,
  subject VARCHAR(190) NULL,
  message TEXT NOT NULL,
  channel ENUM('order','email','phone','whatsapp','internal') NOT NULL DEFAULT 'order',
  status ENUM('open','waiting_customer','waiting_admin','resolved','closed') NOT NULL DEFAULT 'open',
  assigned_to BIGINT UNSIGNED NULL,
  read_at DATETIME NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_support_messages_public_id (public_id),
  KEY idx_support_messages_order (order_id),
  KEY idx_support_messages_customer_status (customer_id, status),
  KEY idx_support_messages_sender (sender_user_id),
  KEY idx_support_messages_assigned (assigned_to),
  KEY idx_support_messages_created (created_at),
  CONSTRAINT fk_support_messages_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_support_messages_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_support_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_support_messages_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operation_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alert_type ENUM('payment_divergence','prescription_pending','stock_low','stock_zero','expiration','delivery_delay','webhook_failure','email_failure','system_health') NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
  title VARCHAR(190) NOT NULL,
  message VARCHAR(500) NOT NULL,
  related_type VARCHAR(80) NULL,
  related_id BIGINT UNSIGNED NULL,
  status ENUM('open','acknowledged','resolved','ignored') NOT NULL DEFAULT 'open',
  assigned_to BIGINT UNSIGNED NULL,
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_operation_alerts_type_status (alert_type, status),
  KEY idx_operation_alerts_severity_created (severity, created_at),
  KEY idx_operation_alerts_assigned (assigned_to),
  KEY idx_operation_alerts_resolved_by (resolved_by),
  CONSTRAINT fk_operation_alerts_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_operation_alerts_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
