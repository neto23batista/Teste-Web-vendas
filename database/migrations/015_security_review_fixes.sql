CREATE TABLE IF NOT EXISTS stock_movement_locks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  lock_key VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_movement_locks_public_id (public_id),
  UNIQUE KEY uq_stock_movement_locks_order_key (order_id, lock_key),
  CONSTRAINT fk_stock_movement_locks_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE products
SET visibility = 'public'
WHERE deleted_at IS NULL
  AND requires_prescription = 1
  AND visibility = 'restricted';
