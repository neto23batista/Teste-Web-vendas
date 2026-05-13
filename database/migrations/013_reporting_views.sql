-- FarmaVida
-- Module: relatorios
-- Purpose: reporting views for admin dashboards and Chart.js datasets.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
  DATE(o.created_at) AS sale_date,
  COUNT(*) AS order_count,
  SUM(CASE WHEN o.payment_status = 'aprovado' THEN o.grand_total ELSE 0 END) AS approved_revenue,
  AVG(CASE WHEN o.payment_status = 'aprovado' THEN o.grand_total ELSE NULL END) AS average_ticket,
  SUM(CASE WHEN o.status = 'cancelado' THEN 1 ELSE 0 END) AS cancelled_orders
FROM orders o
GROUP BY DATE(o.created_at);

CREATE OR REPLACE VIEW v_order_dashboard AS
SELECT
  o.status,
  o.payment_status,
  o.clinical_status,
  o.delivery_method,
  o.priority,
  o.has_problem,
  COUNT(*) AS total_orders,
  SUM(o.grand_total) AS gross_total,
  MIN(o.created_at) AS oldest_order_at,
  MAX(o.created_at) AS newest_order_at
FROM orders o
WHERE o.deleted_at IS NULL
GROUP BY o.status, o.payment_status, o.clinical_status, o.delivery_method, o.priority, o.has_problem;

CREATE OR REPLACE VIEW v_stock_risk AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.internal_code,
  p.ean,
  p.current_stock,
  p.minimum_stock,
  p.maximum_stock,
  MIN(pb.expiration_date) AS nearest_expiration_date,
  CASE
    WHEN p.current_stock <= 0 THEN 'out_of_stock'
    WHEN p.current_stock <= p.minimum_stock THEN 'low_stock'
    WHEN MIN(pb.expiration_date) IS NOT NULL AND MIN(pb.expiration_date) < CURRENT_DATE THEN 'expired'
    WHEN MIN(pb.expiration_date) IS NOT NULL AND MIN(pb.expiration_date) <= DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY) THEN 'near_expiration'
    ELSE 'normal'
  END AS risk_status
FROM products p
LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.status IN ('available','reserved')
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.internal_code, p.ean, p.current_stock, p.minimum_stock, p.maximum_stock;

CREATE OR REPLACE VIEW v_prescription_queue AS
SELECT
  pr.id AS prescription_id,
  pr.public_id,
  pr.order_id,
  o.order_number,
  pr.customer_id,
  pr.prescription_type,
  pr.status,
  pr.created_at,
  pr.validated_at,
  TIMESTAMPDIFF(MINUTE, pr.created_at, COALESCE(pr.validated_at, CURRENT_TIMESTAMP)) AS minutes_in_queue
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
WHERE pr.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_product_sales_summary AS
SELECT
  oi.product_id,
  oi.product_name,
  SUM(oi.quantity) AS quantity_sold,
  SUM(oi.line_total) AS revenue_total,
  SUM(COALESCE(oi.cost_unit_price, 0) * oi.quantity) AS cost_total,
  SUM(oi.line_total - (COALESCE(oi.cost_unit_price, 0) * oi.quantity)) AS estimated_profit,
  MAX(o.created_at) AS last_sold_at
FROM order_items oi
INNER JOIN orders o ON o.id = oi.order_id
WHERE o.payment_status = 'aprovado'
GROUP BY oi.product_id, oi.product_name;

