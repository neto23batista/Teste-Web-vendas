-- FarmaVida
-- Module: fidelidade + marketing
-- Purpose: loyalty points, replenishment, coupons, promotions, campaigns and banners.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS loyalty_points (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  available_points INT NOT NULL DEFAULT 0,
  pending_points INT NOT NULL DEFAULT 0,
  expired_points INT NOT NULL DEFAULT 0,
  redeemed_points INT NOT NULL DEFAULT 0,
  lifetime_points INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loyalty_points_customer (customer_id),
  CONSTRAINT fk_loyalty_points_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  movement_type ENUM('earn','redeem','expire','adjust_positive','adjust_negative','cancel','refund') NOT NULL,
  points INT NOT NULL,
  status ENUM('pending','available','cancelled','expired','used') NOT NULL DEFAULT 'pending',
  description VARCHAR(255) NOT NULL,
  expires_at DATETIME NULL,
  available_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_loyalty_movements_customer_created (customer_id, created_at),
  KEY idx_loyalty_movements_order (order_id),
  KEY idx_loyalty_movements_status_expiry (status, expires_at),
  KEY idx_loyalty_movements_created_by (created_by),
  CONSTRAINT fk_loyalty_movements_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_loyalty_movements_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_loyalty_movements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS replenishment_reminders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  order_item_id BIGINT UNSIGNED NULL,
  estimated_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  reminder_date DATE NOT NULL,
  status ENUM('scheduled','sent','snoozed','cancelled','converted') NOT NULL DEFAULT 'scheduled',
  channel ENUM('email','whatsapp','sms','internal') NOT NULL DEFAULT 'email',
  last_sent_at DATETIME NULL,
  converted_order_id BIGINT UNSIGNED NULL,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_replenishment_customer_status_date (customer_id, status, reminder_date),
  KEY idx_replenishment_product (product_id),
  KEY idx_replenishment_order_item (order_item_id),
  KEY idx_replenishment_converted_order (converted_order_id),
  CONSTRAINT fk_replenishment_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_replenishment_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_replenishment_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_replenishment_converted_order FOREIGN KEY (converted_order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(140) NOT NULL,
  description VARCHAR(255) NULL,
  discount_type ENUM('fixed','percent','free_shipping','points_cashback') NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  minimum_order_value DECIMAL(12,2) NULL,
  max_discount_value DECIMAL(12,2) NULL,
  usage_limit INT UNSIGNED NULL,
  usage_limit_per_customer INT UNSIGNED NULL,
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  applies_to ENUM('all','category','product','delivery') NOT NULL DEFAULT 'all',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  status ENUM('active','inactive','expired','exhausted') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupons_code (code),
  KEY idx_coupons_status_dates (status, starts_at, ends_at),
  KEY idx_coupons_created_by (created_by),
  KEY idx_coupons_deleted_at (deleted_at),
  CONSTRAINT fk_coupons_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupon_usages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  coupon_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_coupon_usages_coupon (coupon_id),
  KEY idx_coupon_usages_customer (customer_id),
  KEY idx_coupon_usages_order (order_id),
  CONSTRAINT fk_coupon_usages_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_usages_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_coupon_usages_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(190) NOT NULL,
  description TEXT NULL,
  promotion_type ENUM('category','product','flash','banner','free_shipping','cashback','kit') NOT NULL,
  discount_type ENUM('none','fixed','percent') NOT NULL DEFAULT 'none',
  discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft','active','paused','finished','cancelled') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_promotions_slug (slug),
  KEY idx_promotions_type_status_dates (promotion_type, status, starts_at, ends_at),
  KEY idx_promotions_created_by (created_by),
  KEY idx_promotions_deleted_at (deleted_at),
  CONSTRAINT fk_promotions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (promotion_id, product_id),
  KEY idx_promotion_products_product (product_id),
  CONSTRAINT fk_promotion_products_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotion_categories (
  promotion_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (promotion_id, category_id),
  KEY idx_promotion_categories_category (category_id),
  CONSTRAINT fk_promotion_categories_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotion_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_segments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(140) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description VARCHAR(255) NULL,
  rule_json JSON NULL,
  uses_sensitive_health_data TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_segments_slug (slug),
  KEY idx_customer_segments_status (status),
  KEY idx_customer_segments_created_by (created_by),
  CONSTRAINT fk_customer_segments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_segment_members (
  segment_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (segment_id, customer_id),
  KEY idx_customer_segment_members_customer (customer_id),
  CONSTRAINT fk_customer_segment_members_segment FOREIGN KEY (segment_id) REFERENCES customer_segments(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_segment_members_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  campaign_type ENUM('coupon','inactive_customer','replenishment','holiday','banner','newsletter') NOT NULL,
  channel ENUM('email','whatsapp','sms','site_banner') NOT NULL DEFAULT 'email',
  status ENUM('draft','scheduled','running','paused','finished','cancelled') NOT NULL DEFAULT 'draft',
  segment_id BIGINT UNSIGNED NULL,
  coupon_id BIGINT UNSIGNED NULL,
  subject VARCHAR(190) NULL,
  content_template TEXT NULL,
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  uses_sensitive_health_data TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marketing_campaigns_public_id (public_id),
  KEY idx_marketing_campaigns_status_schedule (status, scheduled_at),
  KEY idx_marketing_campaigns_segment (segment_id),
  KEY idx_marketing_campaigns_coupon (coupon_id),
  KEY idx_marketing_campaigns_created_by (created_by),
  CONSTRAINT fk_marketing_campaigns_segment FOREIGN KEY (segment_id) REFERENCES customer_segments(id) ON DELETE SET NULL,
  CONSTRAINT fk_marketing_campaigns_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
  CONSTRAINT fk_marketing_campaigns_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  email VARCHAR(190) NULL,
  status ENUM('queued','sent','failed','opened','clicked','unsubscribed','skipped') NOT NULL DEFAULT 'queued',
  sent_at DATETIME NULL,
  opened_at DATETIME NULL,
  clicked_at DATETIME NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaign_recipients_campaign_status (campaign_id, status),
  KEY idx_campaign_recipients_customer (customer_id),
  CONSTRAINT fk_campaign_recipients_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_recipients_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(255) NULL,
  image_path VARCHAR(255) NOT NULL,
  mobile_image_path VARCHAR(255) NULL,
  target_url VARCHAR(500) NULL,
  position ENUM('home_hero','home_middle','category','checkout','admin_notice') NOT NULL DEFAULT 'home_hero',
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_banners_position_active_order (position, is_active, display_order),
  KEY idx_banners_dates (starts_at, ends_at),
  KEY idx_banners_created_by (created_by),
  KEY idx_banners_deleted_at (deleted_at),
  CONSTRAINT fk_banners_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

