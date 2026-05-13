-- FarmaVida
-- Module: nfe
-- Purpose: simulated NF-e and DANFE-ready data. This is not real fiscal transmission.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  invoice_number INT UNSIGNED NOT NULL,
  series VARCHAR(10) NOT NULL DEFAULT '1',
  access_key_simulated VARCHAR(80) NOT NULL,
  status ENUM('emitida','cancelada') NOT NULL DEFAULT 'emitida',
  environment ENUM('simulated','future_real_provider') NOT NULL DEFAULT 'simulated',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  cancel_reason VARCHAR(500) NULL,
  pharmacy_snapshot JSON NOT NULL,
  customer_snapshot JSON NOT NULL,
  delivery_address_snapshot JSON NULL,
  products_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  danfe_storage_path VARCHAR(255) NULL,
  xml_simulated_storage_path VARCHAR(255) NULL,
  issued_by BIGINT UNSIGNED NULL,
  cancelled_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_public_id (public_id),
  UNIQUE KEY uq_invoices_order_id (order_id),
  UNIQUE KEY uq_invoices_number_series (invoice_number, series),
  UNIQUE KEY uq_invoices_access_key (access_key_simulated),
  KEY idx_invoices_customer_issued (customer_id, issued_at),
  KEY idx_invoices_status_issued (status, issued_at),
  KEY idx_invoices_issued_by (issued_by),
  KEY idx_invoices_cancelled_by (cancelled_by),
  CONSTRAINT fk_invoices_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoices_issued_by FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoices_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  product_name VARCHAR(190) NOT NULL,
  ean VARCHAR(30) NULL,
  ncm VARCHAR(20) NULL,
  cfop VARCHAR(20) NULL,
  anvisa_registration VARCHAR(80) NULL,
  active_ingredient VARCHAR(190) NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'UN',
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(12,2) NOT NULL,
  simulated_tax_info JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invoice_items_invoice (invoice_id),
  KEY idx_invoice_items_order_item (order_item_id),
  KEY idx_invoice_items_product (product_id),
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  series VARCHAR(10) NOT NULL,
  current_number INT UNSIGNED NOT NULL DEFAULT 0,
  environment ENUM('simulated','future_real_provider') NOT NULL DEFAULT 'simulated',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_sequences_series_env (series, environment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

