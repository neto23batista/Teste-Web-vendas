-- FarmaVida
-- Seeder: delivery, operating hours, coupons, promotions and invoice sequence.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO delivery_zones (name, zone_type, district, city, state, fee, minimum_order_value, free_shipping_minimum, estimated_minutes, is_active) VALUES
('Centro - Delivery Local', 'district', 'Centro', 'Sao Paulo', 'SP', 8.90, 30.00, 199.90, 45, 1),
('Bairros proximos - Motoboy', 'distance', NULL, 'Sao Paulo', 'SP', 14.90, 50.00, 249.90, 70, 1)
ON DUPLICATE KEY UPDATE
  fee = VALUES(fee),
  minimum_order_value = VALUES(minimum_order_value),
  free_shipping_minimum = VALUES(free_shipping_minimum),
  estimated_minutes = VALUES(estimated_minutes),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO operating_hours (weekday, opens_at, closes_at, is_closed, accepts_delivery, accepts_pickup) VALUES
(0, NULL, NULL, 1, 0, 0),
(1, '08:00:00', '18:00:00', 0, 1, 1),
(2, '08:00:00', '18:00:00', 0, 1, 1),
(3, '08:00:00', '18:00:00', 0, 1, 1),
(4, '08:00:00', '18:00:00', 0, 1, 1),
(5, '08:00:00', '18:00:00', 0, 1, 1),
(6, '08:00:00', '12:00:00', 0, 1, 1)
ON DUPLICATE KEY UPDATE
  opens_at = VALUES(opens_at),
  closes_at = VALUES(closes_at),
  is_closed = VALUES(is_closed),
  accepts_delivery = VALUES(accepts_delivery),
  accepts_pickup = VALUES(accepts_pickup),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO coupons (code, name, description, discount_type, discount_value, minimum_order_value, max_discount_value, usage_limit, usage_limit_per_customer, applies_to, starts_at, ends_at, status)
VALUES
('BEMVINDO10', 'Boas-vindas 10%', 'Cupom demonstrativo para primeira compra.', 'percent', 10.00, 50.00, 30.00, 500, 1, 'all', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 90 DAY), 'active'),
('FRETEGRATIS', 'Frete gratis demonstrativo', 'Cupom demonstrativo de frete gratis.', 'free_shipping', 0.00, 120.00, NULL, 200, 1, 'delivery', CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 DAY), 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  discount_type = VALUES(discount_type),
  discount_value = VALUES(discount_value),
  minimum_order_value = VALUES(minimum_order_value),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO promotions (name, slug, description, promotion_type, discount_type, discount_value, starts_at, ends_at, is_featured, status)
VALUES
('Ofertas de Boas-vindas', 'ofertas-boas-vindas', 'Promocao demonstrativa para vitrine inicial.', 'flash', 'percent', 8.00, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY), 1, 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  discount_type = VALUES(discount_type),
  discount_value = VALUES(discount_value),
  starts_at = VALUES(starts_at),
  ends_at = VALUES(ends_at),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

INSERT IGNORE INTO promotion_products (promotion_id, product_id)
SELECT pr.id, p.id
FROM promotions pr
INNER JOIN products p ON p.internal_code IN ('MED-0001','DER-0001')
WHERE pr.slug = 'ofertas-boas-vindas';

INSERT INTO invoice_sequences (series, current_number, environment)
VALUES ('1', 0, 'simulated')
ON DUPLICATE KEY UPDATE
  current_number = current_number,
  updated_at = CURRENT_TIMESTAMP;

