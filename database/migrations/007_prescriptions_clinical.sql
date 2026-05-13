-- FarmaVida
-- Module: receitas
-- Purpose: protected prescription uploads, pharmacist validation and clinical audit.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  uploaded_by_user_id BIGINT UNSIGNED NULL,
  validated_by_user_id BIGINT UNSIGNED NULL,
  file_storage_path VARCHAR(255) NOT NULL,
  original_filename VARCHAR(190) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  file_hash CHAR(64) NOT NULL,
  prescription_type ENUM('simple','antibiotic','controlled','psychotropic','other') NOT NULL,
  status ENUM('aguardando_receita','receita_enviada','em_validacao','liberado','rejeitado','bloqueado_orientacao_farmaceutica') NOT NULL DEFAULT 'receita_enviada',
  pharmacist_notes TEXT NULL,
  rejection_reason VARCHAR(500) NULL,
  customer_message VARCHAR(500) NULL,
  validated_at DATETIME NULL,
  expires_at DATETIME NULL,
  received_ip VARCHAR(45) NULL,
  received_user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prescriptions_public_id (public_id),
  KEY idx_prescriptions_order_status (order_id, status),
  KEY idx_prescriptions_customer_status (customer_id, status),
  KEY idx_prescriptions_validated_by (validated_by_user_id),
  KEY idx_prescriptions_file_hash (file_hash),
  KEY idx_prescriptions_created_status (created_at, status),
  KEY idx_prescriptions_deleted_at (deleted_at),
  CONSTRAINT fk_prescriptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_prescriptions_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_prescriptions_uploaded_by FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_prescriptions_validated_by FOREIGN KEY (validated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prescription_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prescription_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(190) NOT NULL,
  active_ingredient VARCHAR(190) NULL,
  quantity_requested INT UNSIGNED NULL,
  status ENUM('pending','approved','rejected','substituted','blocked') NOT NULL DEFAULT 'pending',
  pharmacist_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prescription_items_prescription (prescription_id),
  KEY idx_prescription_items_order_item (order_item_id),
  KEY idx_prescription_items_product (product_id),
  KEY idx_prescription_items_status (status),
  CONSTRAINT fk_prescription_items_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_prescription_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_prescription_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prescription_audits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prescription_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  action ENUM('uploaded','viewed','downloaded','validation_started','approved','rejected','blocked','note_added','file_replaced','deleted') NOT NULL,
  previous_status VARCHAR(80) NULL,
  new_status VARCHAR(80) NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(80) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prescription_audits_prescription_created (prescription_id, created_at),
  KEY idx_prescription_audits_order (order_id),
  KEY idx_prescription_audits_action (action),
  KEY idx_prescription_audits_actor (actor_user_id),
  CONSTRAINT fk_prescription_audits_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_prescription_audits_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_prescription_audits_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

