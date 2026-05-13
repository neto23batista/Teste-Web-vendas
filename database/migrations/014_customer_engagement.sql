-- FarmaVida
-- Module: cliente + catalogo
-- Purpose: favorites, recently viewed products, search telemetry and secure shared carts.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS customer_favorites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_favorites_customer_product (customer_id, product_id),
  KEY idx_customer_favorites_product (product_id),
  CONSTRAINT fk_customer_favorites_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_favorites_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recently_viewed_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NULL,
  session_id_hash CHAR(64) NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recently_viewed_customer (customer_id, viewed_at),
  KEY idx_recently_viewed_session (session_id_hash, viewed_at),
  KEY idx_recently_viewed_product (product_id),
  CONSTRAINT fk_recently_viewed_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_recently_viewed_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_search_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NULL,
  session_id_hash CHAR(64) NULL,
  query VARCHAR(190) NOT NULL,
  filters_json JSON NULL,
  results_count INT UNSIGNED NOT NULL DEFAULT 0,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_search_logs_customer (customer_id, searched_at),
  KEY idx_product_search_logs_query (query),
  CONSTRAINT fk_product_search_logs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

