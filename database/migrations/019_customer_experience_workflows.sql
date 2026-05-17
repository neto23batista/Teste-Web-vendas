-- FarmaVida
-- Module: experiencia operacional
-- Purpose: resgate de pontos, avaliacoes, agenda clinica e transferencias formais.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'loyalty_points_redeemed') = 0,
  'ALTER TABLE orders ADD COLUMN loyalty_points_redeemed INT UNSIGNED NOT NULL DEFAULT 0 AFTER coupon_discount',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'loyalty_discount') = 0,
  'ALTER TABLE orders ADD COLUMN loyalty_discount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER loyalty_points_redeemed',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'loyalty_redemption_id') = 0,
  'ALTER TABLE orders ADD COLUMN loyalty_redemption_id BIGINT UNSIGNED NULL AFTER loyalty_discount',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'loyalty_redemptions' AND COLUMN_NAME = 'coupon_code') = 0,
  'ALTER TABLE loyalty_redemptions ADD COLUMN coupon_code VARCHAR(80) NULL AFTER discount_amount',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_reviews' AND COLUMN_NAME = 'moderation_note') = 0,
  'ALTER TABLE product_reviews ADD COLUMN moderation_note TEXT NULL AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_reviews' AND INDEX_NAME = 'idx_product_reviews_status_created') = 0,
  'ALTER TABLE product_reviews ADD KEY idx_product_reviews_status_created (status, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agendamentos_servicos' AND INDEX_NAME = 'uq_agendamentos_slot') = 0,
  'ALTER TABLE agendamentos_servicos ADD UNIQUE KEY uq_agendamentos_slot (id_filial, id_servico, data_hora)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agendamentos_servicos' AND COLUMN_NAME = 'atualizado_por') = 0,
  'ALTER TABLE agendamentos_servicos ADD COLUMN atualizado_por BIGINT UNSIGNED NULL AFTER observacao',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO servicos_farmacia (nome, descricao, duracao_minutos, preco, status) VALUES
('Afericao de pressao', 'Medicao de pressao arterial com registro no atendimento.', 15, 0.00, 'ativo'),
('Teste de glicemia', 'Teste rapido de glicemia capilar.', 20, 0.00, 'ativo'),
('Aplicacao de injetaveis', 'Aplicacao conforme prescricao e regras sanitarias.', 30, 0.00, 'ativo'),
('Vacinas', 'Atendimento para vacinas disponiveis na filial.', 30, 0.00, 'ativo')
ON DUPLICATE KEY UPDATE
  descricao = VALUES(descricao),
  duracao_minutos = VALUES(duracao_minutos),
  status = VALUES(status);

INSERT INTO permissions (module, action, slug, description) VALUES
('reviews','view','reviews.view','Visualizar avaliacoes de produtos.'),
('reviews','manage','reviews.manage','Moderar avaliacoes de produtos.'),
('services','view','services.view','Visualizar agenda de servicos clinicos.'),
('services','manage','services.manage','Gerenciar servicos clinicos e agenda.')
ON DUPLICATE KEY UPDATE
  module = VALUES(module),
  action = VALUES(action),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('admin_geral', 'owner');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN ('reviews.view','reviews.manage','services.view','services.manage')
WHERE r.slug IN ('gerente_loja', 'admin');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN ('services.view','services.manage')
WHERE r.slug IN ('farmaceutico', 'pharmacist');
