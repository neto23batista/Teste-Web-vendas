-- FarmaVida
-- Module: relatorios
-- Purpose: decision dashboard reporting helpers for payments, statuses and prescriptions.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE OR REPLACE VIEW v_report_payment_mix_daily AS
SELECT
  DATE(p.created_at) AS report_date,
  p.payment_method,
  p.status,
  COUNT(*) AS payment_count,
  SUM(p.amount) AS total_amount,
  SUM(CASE WHEN p.status = 'aprovado' THEN 1 ELSE 0 END) AS approved_count,
  SUM(CASE WHEN p.status IN ('recusado','cancelado','estornado','expirado','divergente') THEN 1 ELSE 0 END) AS exception_count
FROM payments p
INNER JOIN orders o ON o.id = p.order_id
WHERE o.deleted_at IS NULL
GROUP BY DATE(p.created_at), p.payment_method, p.status;

CREATE OR REPLACE VIEW v_report_order_status_daily AS
SELECT
  DATE(o.created_at) AS report_date,
  o.status,
  o.payment_status,
  o.clinical_status,
  COUNT(*) AS order_count,
  SUM(o.grand_total) AS gross_total,
  SUM(CASE WHEN o.payment_status = 'aprovado' THEN o.grand_total ELSE 0 END) AS approved_revenue,
  SUM(CASE WHEN o.requires_prescription = 1 THEN 1 ELSE 0 END) AS prescription_orders,
  SUM(CASE WHEN o.has_problem = 1 THEN 1 ELSE 0 END) AS problem_orders
FROM orders o
WHERE o.deleted_at IS NULL
GROUP BY DATE(o.created_at), o.status, o.payment_status, o.clinical_status;

CREATE OR REPLACE VIEW v_report_prescription_outcomes_daily AS
SELECT
  DATE(pr.created_at) AS report_date,
  pr.prescription_type,
  pr.status,
  COUNT(*) AS prescription_count,
  AVG(TIMESTAMPDIFF(MINUTE, pr.created_at, COALESCE(pr.validated_at, CURRENT_TIMESTAMP))) AS avg_minutes_in_queue,
  SUM(CASE WHEN pr.status = 'liberado' THEN 1 ELSE 0 END) AS approved_count,
  SUM(CASE WHEN pr.status IN ('rejeitado','bloqueado_orientacao_farmaceutica') THEN 1 ELSE 0 END) AS blocked_count
FROM prescriptions pr
WHERE pr.deleted_at IS NULL
GROUP BY DATE(pr.created_at), pr.prescription_type, pr.status;
