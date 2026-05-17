-- FarmaVida
-- Module: multi filial + operacao
-- Purpose: branch isolation, branch stock, purchases, cash closing, fiscal provider readiness, jobs and cache.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS filiais (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(190) NOT NULL,
  cnpj VARCHAR(20) NOT NULL,
  telefone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  endereco VARCHAR(255) NULL,
  cidade VARCHAR(120) NULL,
  estado CHAR(2) NULL,
  cep VARCHAR(12) NULL,
  status ENUM('ativa','inativa','bloqueada') NOT NULL DEFAULT 'ativa',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_filiais_cnpj (cnpj),
  KEY idx_filiais_status_nome (status, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO filiais (nome, cnpj, telefone, email, endereco, cidade, estado, cep, status)
SELECT
  COALESCE(NULLIF(trade_name, ''), 'FarmaVida Matriz'),
  COALESCE(NULLIF(cnpj, ''), '00.000.000/0001-00'),
  phone,
  email,
  CONCAT_WS(', ', address_street, address_number, address_complement, address_district),
  address_city,
  address_state,
  address_postal_code,
  'ativa'
FROM pharmacy_profiles
WHERE is_active = 1
ORDER BY id DESC
LIMIT 1
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  telefone = VALUES(telefone),
  email = VALUES(email),
  endereco = VALUES(endereco),
  cidade = VALUES(cidade),
  estado = VALUES(estado),
  cep = VALUES(cep),
  atualizado_em = CURRENT_TIMESTAMP;

INSERT INTO filiais (nome, cnpj, telefone, email, endereco, cidade, estado, cep, status)
SELECT 'FarmaVida Matriz', '00.000.000/0001-00', '(11) 0000-0000', 'atendimento@farmavida.local', 'Rua Exemplo, 100, Centro', 'Sao Paulo', 'SP', '01000-000', 'ativa'
WHERE NOT EXISTS (SELECT 1 FROM filiais);

SET @default_filial_id := (SELECT id FROM filiais ORDER BY id LIMIT 1);

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE users ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER user_type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE admins ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER user_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'responsavel_tecnico') = 0,
  'ALTER TABLE admins ADD COLUMN responsavel_tecnico TINYINT(1) NOT NULL DEFAULT 0 AFTER can_validate_prescriptions',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'carga_horaria') = 0,
  'ALTER TABLE admins ADD COLUMN carga_horaria VARCHAR(80) NULL AFTER responsavel_tecnico',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'turno') = 0,
  'ALTER TABLE admins ADD COLUMN turno VARCHAR(80) NULL AFTER carga_horaria',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'carts' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE carts ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER public_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE orders ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER public_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE payments ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_webhooks' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE payment_webhooks ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE prescriptions ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_audits' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE prescription_audits ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movements' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE stock_movements ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER public_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_alerts' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE stock_alerts ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_inventories' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE stock_inventories ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER public_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movement_locks' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE stock_movement_locks ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_zones' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE delivery_zones ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_zones' AND INDEX_NAME = 'uq_delivery_zones_name') > 0,
  'ALTER TABLE delivery_zones DROP INDEX uq_delivery_zones_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_people' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE delivery_people ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_assignments' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE delivery_assignments ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'operating_hours' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE operating_hours ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'operating_hours' AND INDEX_NAME = 'uq_operating_hours_weekday') > 0,
  'ALTER TABLE operating_hours DROP INDEX uq_operating_hours_weekday',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE invoices ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_logs' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE email_logs ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER order_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_action_logs' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE admin_action_logs ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER admin_user_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'api_keys' AND COLUMN_NAME = 'id_filial') = 0,
  'ALTER TABLE api_keys ADD COLUMN id_filial BIGINT UNSIGNED NULL AFTER name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS estoque_filial (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_produto BIGINT UNSIGNED NOT NULL,
  id_filial BIGINT UNSIGNED NOT NULL,
  quantidade INT NOT NULL DEFAULT 0,
  estoque_minimo INT NOT NULL DEFAULT 0,
  estoque_maximo INT NULL,
  localizacao VARCHAR(160) NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estoque_filial_produto_filial (id_produto, id_filial),
  KEY idx_estoque_filial_filial_quantidade (id_filial, quantidade),
  CONSTRAINT fk_estoque_filial_produto FOREIGN KEY (id_produto) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_estoque_filial_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO estoque_filial (id_produto, id_filial, quantidade, estoque_minimo, estoque_maximo, localizacao)
SELECT p.id, @default_filial_id, p.current_stock, p.minimum_stock, p.maximum_stock, p.physical_location
FROM products p
WHERE p.deleted_at IS NULL
ON DUPLICATE KEY UPDATE
  quantidade = IF(estoque_filial.quantidade = 0, VALUES(quantidade), estoque_filial.quantidade),
  estoque_minimo = VALUES(estoque_minimo),
  estoque_maximo = VALUES(estoque_maximo),
  localizacao = COALESCE(estoque_filial.localizacao, VALUES(localizacao));

UPDATE users SET id_filial = @default_filial_id WHERE id_filial IS NULL AND user_type <> 'system';
UPDATE admins SET id_filial = (SELECT u.id_filial FROM users u WHERE u.id = admins.user_id) WHERE id_filial IS NULL;
UPDATE carts SET id_filial = @default_filial_id WHERE id_filial IS NULL;
UPDATE orders SET id_filial = @default_filial_id WHERE id_filial IS NULL;
UPDATE payments p INNER JOIN orders o ON o.id = p.order_id SET p.id_filial = o.id_filial WHERE p.id_filial IS NULL;
UPDATE payment_webhooks pw INNER JOIN orders o ON o.id = pw.order_id SET pw.id_filial = o.id_filial WHERE pw.id_filial IS NULL;
UPDATE prescriptions pr INNER JOIN orders o ON o.id = pr.order_id SET pr.id_filial = o.id_filial WHERE pr.id_filial IS NULL;
UPDATE prescription_audits pa INNER JOIN orders o ON o.id = pa.order_id SET pa.id_filial = o.id_filial WHERE pa.id_filial IS NULL;
UPDATE stock_movements sm LEFT JOIN orders o ON o.id = sm.order_id SET sm.id_filial = COALESCE(o.id_filial, @default_filial_id) WHERE sm.id_filial IS NULL;
UPDATE stock_alerts SET id_filial = @default_filial_id WHERE id_filial IS NULL;
UPDATE stock_inventories SET id_filial = @default_filial_id WHERE id_filial IS NULL;
UPDATE stock_movement_locks sml INNER JOIN orders o ON o.id = sml.order_id SET sml.id_filial = o.id_filial WHERE sml.id_filial IS NULL;
UPDATE delivery_zones SET id_filial = @default_filial_id WHERE id_filial IS NULL;
UPDATE delivery_people SET id_filial = @default_filial_id WHERE id_filial IS NULL;
UPDATE delivery_assignments da INNER JOIN orders o ON o.id = da.order_id SET da.id_filial = o.id_filial WHERE da.id_filial IS NULL;
UPDATE operating_hours SET id_filial = @default_filial_id WHERE id_filial IS NULL;
UPDATE invoices i INNER JOIN orders o ON o.id = i.order_id SET i.id_filial = o.id_filial WHERE i.id_filial IS NULL;
UPDATE email_logs el LEFT JOIN orders o ON o.id = el.order_id SET el.id_filial = COALESCE(o.id_filial, @default_filial_id) WHERE el.id_filial IS NULL;
UPDATE admin_action_logs SET id_filial = @default_filial_id WHERE id_filial IS NULL;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_filial_status') = 0,
  'CREATE INDEX idx_users_filial_status ON users (id_filial, status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND INDEX_NAME = 'idx_admins_filial_status') = 0,
  'CREATE INDEX idx_admins_filial_status ON admins (id_filial, status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'carts' AND INDEX_NAME = 'idx_carts_filial_status') = 0,
  'CREATE INDEX idx_carts_filial_status ON carts (id_filial, status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_filial_created') = 0,
  'CREATE INDEX idx_orders_filial_created ON orders (id_filial, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payments_filial_status') = 0,
  'CREATE INDEX idx_payments_filial_status ON payments (id_filial, status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND INDEX_NAME = 'idx_prescriptions_filial_status') = 0,
  'CREATE INDEX idx_prescriptions_filial_status ON prescriptions (id_filial, status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movements' AND INDEX_NAME = 'idx_stock_movements_filial_product') = 0,
  'CREATE INDEX idx_stock_movements_filial_product ON stock_movements (id_filial, product_id, occurred_at)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_zones' AND INDEX_NAME = 'uq_delivery_zones_filial_name') = 0,
  'CREATE UNIQUE INDEX uq_delivery_zones_filial_name ON delivery_zones (id_filial, name)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'operating_hours' AND INDEX_NAME = 'uq_operating_hours_filial_weekday') = 0,
  'CREATE UNIQUE INDEX uq_operating_hours_filial_weekday ON operating_hours (id_filial, weekday)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_filial') = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND CONSTRAINT_NAME = 'fk_admins_filial') = 0,
  'ALTER TABLE admins ADD CONSTRAINT fk_admins_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'carts' AND CONSTRAINT_NAME = 'fk_carts_filial') = 0,
  'ALTER TABLE carts ADD CONSTRAINT fk_carts_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND CONSTRAINT_NAME = 'fk_orders_filial') = 0,
  'ALTER TABLE orders ADD CONSTRAINT fk_orders_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND CONSTRAINT_NAME = 'fk_payments_filial') = 0,
  'ALTER TABLE payments ADD CONSTRAINT fk_payments_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions' AND CONSTRAINT_NAME = 'fk_prescriptions_filial') = 0,
  'ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movements' AND CONSTRAINT_NAME = 'fk_stock_movements_filial') = 0,
  'ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_alerts' AND CONSTRAINT_NAME = 'fk_stock_alerts_filial') = 0,
  'ALTER TABLE stock_alerts ADD CONSTRAINT fk_stock_alerts_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND CONSTRAINT_NAME = 'fk_invoices_filial') = 0,
  'ALTER TABLE invoices ADD CONSTRAINT fk_invoices_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS fornecedores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  razao_social VARCHAR(190) NOT NULL,
  nome_fantasia VARCHAR(190) NULL,
  cnpj VARCHAR(20) NOT NULL,
  telefone VARCHAR(30) NULL,
  email VARCHAR(190) NULL,
  endereco VARCHAR(255) NULL,
  status ENUM('ativo','inativo','bloqueado') NOT NULL DEFAULT 'ativo',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fornecedores_cnpj (cnpj),
  KEY idx_fornecedores_status_nome (status, nome_fantasia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ordens_compra (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_fornecedor BIGINT UNSIGNED NOT NULL,
  id_filial BIGINT UNSIGNED NOT NULL,
  status ENUM('rascunho','pendente_aprovacao','aprovada','recebida','cancelada') NOT NULL DEFAULT 'rascunho',
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  previsao_entrega DATE NULL,
  criado_por BIGINT UNSIGNED NULL,
  aprovado_por BIGINT UNSIGNED NULL,
  recebido_por BIGINT UNSIGNED NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aprovado_em DATETIME NULL,
  recebido_em DATETIME NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ordens_compra_filial_status (id_filial, status),
  KEY idx_ordens_compra_fornecedor (id_fornecedor),
  CONSTRAINT fk_ordens_compra_fornecedor FOREIGN KEY (id_fornecedor) REFERENCES fornecedores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ordens_compra_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ordens_compra_criado_por FOREIGN KEY (criado_por) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ordens_compra_aprovado_por FOREIGN KEY (aprovado_por) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ordens_compra_recebido_por FOREIGN KEY (recebido_por) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ordens_compra_itens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_ordem_compra BIGINT UNSIGNED NOT NULL,
  id_produto BIGINT UNSIGNED NOT NULL,
  quantidade INT UNSIGNED NOT NULL,
  custo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ordens_compra_itens_produto (id_ordem_compra, id_produto),
  KEY idx_ordens_compra_itens_produto (id_produto),
  CONSTRAINT fk_ordens_compra_itens_ordem FOREIGN KEY (id_ordem_compra) REFERENCES ordens_compra(id) ON DELETE CASCADE,
  CONSTRAINT fk_ordens_compra_itens_produto FOREIGN KEY (id_produto) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS caixas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_filial BIGINT UNSIGNED NOT NULL,
  aberto_por BIGINT UNSIGNED NOT NULL,
  fechado_por BIGINT UNSIGNED NULL,
  valor_abertura DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  valor_fechamento DECIMAL(12,2) NULL,
  valor_esperado DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  divergencia DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('aberto','fechado','cancelado') NOT NULL DEFAULT 'aberto',
  aberto_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fechado_em DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_caixas_filial_status (id_filial, status, aberto_em),
  KEY idx_caixas_aberto_por (aberto_por),
  KEY idx_caixas_fechado_por (fechado_por),
  CONSTRAINT fk_caixas_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT,
  CONSTRAINT fk_caixas_aberto_por FOREIGN KEY (aberto_por) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_caixas_fechado_por FOREIGN KEY (fechado_por) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS caixa_movimentacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_caixa BIGINT UNSIGNED NOT NULL,
  tipo ENUM('venda','sangria','suprimento','ajuste') NOT NULL,
  forma_pagamento ENUM('mercado_pago','dinheiro','cartao_balcao','pix','pagamento_entrega','outro') NOT NULL DEFAULT 'outro',
  valor DECIMAL(12,2) NOT NULL,
  descricao VARCHAR(255) NULL,
  id_pedido BIGINT UNSIGNED NULL,
  criado_por BIGINT UNSIGNED NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_caixa_movimentacoes_caixa (id_caixa, criado_em),
  KEY idx_caixa_movimentacoes_pedido (id_pedido),
  CONSTRAINT fk_caixa_movimentacoes_caixa FOREIGN KEY (id_caixa) REFERENCES caixas(id) ON DELETE CASCADE,
  CONSTRAINT fk_caixa_movimentacoes_pedido FOREIGN KEY (id_pedido) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_caixa_movimentacoes_criado_por FOREIGN KEY (criado_por) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notas_fiscais (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_pedido BIGINT UNSIGNED NOT NULL,
  id_filial BIGINT UNSIGNED NOT NULL,
  provedor ENUM('focus_nfe','nfe_io','tecnospeed','homologacao_interna') NOT NULL DEFAULT 'homologacao_interna',
  chave_acesso VARCHAR(80) NULL,
  status ENUM('pendente','homologacao_simulada','emitida','cancelada','rejeitada','erro') NOT NULL DEFAULT 'pendente',
  xml_path VARCHAR(255) NULL,
  danfe_path VARCHAR(255) NULL,
  protocolo VARCHAR(120) NULL,
  ambiente ENUM('homologacao','producao') NOT NULL DEFAULT 'homologacao',
  erro TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notas_fiscais_pedido (id_pedido),
  KEY idx_notas_fiscais_filial_status (id_filial, status),
  CONSTRAINT fk_notas_fiscais_pedido FOREIGN KEY (id_pedido) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_notas_fiscais_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fiscal_api_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_filial BIGINT UNSIGNED NULL,
  id_nota_fiscal BIGINT UNSIGNED NULL,
  provedor VARCHAR(80) NOT NULL,
  operacao VARCHAR(80) NOT NULL,
  ambiente ENUM('homologacao','producao') NOT NULL DEFAULT 'homologacao',
  request_sanitized JSON NULL,
  response_sanitized JSON NULL,
  status_http SMALLINT UNSIGNED NULL,
  erro TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fiscal_api_logs_nota (id_nota_fiscal),
  KEY idx_fiscal_api_logs_filial_created (id_filial, criado_em),
  CONSTRAINT fk_fiscal_api_logs_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE SET NULL,
  CONSTRAINT fk_fiscal_api_logs_nota FOREIGN KEY (id_nota_fiscal) REFERENCES notas_fiscais(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zonas_entrega (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_filial BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(140) NOT NULL,
  bairros TEXT NULL,
  raio_km DECIMAL(8,2) NULL,
  taxa DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  prazo_estimado SMALLINT UNSIGNED NULL,
  status ENUM('ativa','inativa') NOT NULL DEFAULT 'ativa',
  PRIMARY KEY (id),
  UNIQUE KEY uq_zonas_entrega_filial_nome (id_filial, nome),
  KEY idx_zonas_entrega_filial_status (id_filial, status),
  CONSTRAINT fk_zonas_entrega_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entregadores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_filial BIGINT UNSIGNED NOT NULL,
  nome VARCHAR(160) NOT NULL,
  telefone VARCHAR(30) NULL,
  status ENUM('disponivel','em_entrega','indisponivel') NOT NULL DEFAULT 'disponivel',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_entregadores_filial_status (id_filial, status),
  CONSTRAINT fk_entregadores_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entregas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_pedido BIGINT UNSIGNED NOT NULL,
  id_filial BIGINT UNSIGNED NOT NULL,
  id_entregador BIGINT UNSIGNED NULL,
  status ENUM('pendente','atribuida','em_rota','entregue','falhou','cancelada') NOT NULL DEFAULT 'pendente',
  taxa_entrega DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  previsao_entrega DATETIME NULL,
  entregue_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entregas_pedido (id_pedido),
  KEY idx_entregas_filial_status (id_filial, status),
  KEY idx_entregas_entregador_status (id_entregador, status),
  CONSTRAINT fk_entregas_pedido FOREIGN KEY (id_pedido) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_entregas_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT,
  CONSTRAINT fk_entregas_entregador FOREIGN KEY (id_entregador) REFERENCES entregadores(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo ENUM('enviar_email','enviar_whatsapp','processar_webhook','atualizar_status_pagamento','recuperar_carrinho','emitir_nfe') NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pendente','processando','concluido','falhou','cancelado') NOT NULL DEFAULT 'pendente',
  tentativas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  erro TEXT NULL,
  executar_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jobs_status_exec (status, executar_em),
  KEY idx_jobs_tipo_status (tipo, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_cache (
  cache_key VARCHAR(190) NOT NULL,
  cache_value MEDIUMTEXT NOT NULL,
  id_filial BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cache_key),
  KEY idx_app_cache_filial_expires (id_filial, expires_at),
  CONSTRAINT fk_app_cache_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_filial BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  provider VARCHAR(80) NOT NULL DEFAULT 'not_configured',
  status ENUM('queued','sent','failed','skipped') NOT NULL DEFAULT 'queued',
  error_message TEXT NULL,
  payload_sanitized JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_whatsapp_logs_filial_status (id_filial, status),
  KEY idx_whatsapp_logs_order (order_id),
  CONSTRAINT fk_whatsapp_logs_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE SET NULL,
  CONSTRAINT fk_whatsapp_logs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS servicos_farmacia (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(160) NOT NULL,
  descricao TEXT NULL,
  duracao_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  preco DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  PRIMARY KEY (id),
  UNIQUE KEY uq_servicos_farmacia_nome (nome),
  KEY idx_servicos_farmacia_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agendamentos_servicos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_cliente BIGINT UNSIGNED NULL,
  id_filial BIGINT UNSIGNED NOT NULL,
  id_servico BIGINT UNSIGNED NOT NULL,
  data_hora DATETIME NOT NULL,
  status ENUM('agendado','confirmado','atendido','cancelado','faltou') NOT NULL DEFAULT 'agendado',
  observacao TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_agendamentos_filial_data (id_filial, data_hora),
  KEY idx_agendamentos_cliente (id_cliente),
  CONSTRAINT fk_agendamentos_cliente FOREIGN KEY (id_cliente) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_agendamentos_filial FOREIGN KEY (id_filial) REFERENCES filiais(id) ON DELETE RESTRICT,
  CONSTRAINT fk_agendamentos_servico FOREIGN KEY (id_servico) REFERENCES servicos_farmacia(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transferencias_estoque (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_produto BIGINT UNSIGNED NOT NULL,
  id_filial_origem BIGINT UNSIGNED NOT NULL,
  id_filial_destino BIGINT UNSIGNED NOT NULL,
  quantidade INT UNSIGNED NOT NULL,
  status ENUM('solicitada','aprovada','em_transporte','concluida','cancelada') NOT NULL DEFAULT 'solicitada',
  solicitado_por BIGINT UNSIGNED NULL,
  aprovado_por BIGINT UNSIGNED NULL,
  concluido_por BIGINT UNSIGNED NULL,
  observacao TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_transferencias_origem_status (id_filial_origem, status),
  KEY idx_transferencias_destino_status (id_filial_destino, status),
  CONSTRAINT fk_transferencias_produto FOREIGN KEY (id_produto) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transferencias_origem FOREIGN KEY (id_filial_origem) REFERENCES filiais(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transferencias_destino FOREIGN KEY (id_filial_destino) REFERENCES filiais(id) ON DELETE RESTRICT,
  CONSTRAINT fk_transferencias_solicitado FOREIGN KEY (solicitado_por) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_transferencias_aprovado FOREIGN KEY (aprovado_por) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_transferencias_concluido FOREIGN KEY (concluido_por) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  points INT UNSIGNED NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  idempotency_key_hash CHAR(64) NOT NULL,
  status ENUM('reserved','used','cancelled') NOT NULL DEFAULT 'reserved',
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loyalty_redemptions_idem (idempotency_key_hash),
  KEY idx_loyalty_redemptions_customer_status (customer_id, status),
  CONSTRAINT fk_loyalty_redemptions_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_loyalty_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  moderated_by BIGINT UNSIGNED NULL,
  moderated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_reviews_customer_product_order (customer_id, product_id, order_id),
  KEY idx_product_reviews_product_status (product_id, status),
  CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_product_reviews_moderated_by FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_product_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name, slug, description, is_system) VALUES
('Admin geral', 'admin_geral', 'Acesso global a todas as filiais, configuracoes e relatorios consolidados.', 1),
('Gerente de loja', 'gerente_loja', 'Gestao operacional limitada a filial vinculada.', 1),
('Farmaceutico', 'farmaceutico', 'Validacao de receitas e operacao tecnica limitada a filial vinculada.', 1),
('Funcionario', 'funcionario', 'Acesso operacional basico limitado a filial vinculada.', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO permissions (module, action, slug, description) VALUES
('branches','view','branches.view','Visualizar filiais.'),
('branches','manage','branches.manage','Gerenciar filiais.'),
('cash','view','cash.view','Visualizar caixas por filial.'),
('cash','manage','cash.manage','Abrir, movimentar e fechar caixas.'),
('purchases','view','purchases.view','Visualizar fornecedores e ordens de compra.'),
('purchases','manage','purchases.manage','Gerenciar compras e recebimentos.'),
('stock_transfers','view','stock.transfers.view','Visualizar transferencias de estoque entre filiais.'),
('stock_transfers','manage','stock.transfers.manage','Solicitar e atualizar transferencias de estoque entre filiais.'),
('jobs','view','jobs.view','Visualizar jobs falhos e pendentes.'),
('jobs','manage','jobs.manage','Reprocessar e cancelar jobs.')
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
INNER JOIN permissions p ON p.slug IN (
  'dashboard.view','orders.view','orders.manage','customers.view','products.view','products.manage',
  'stock.view','stock.manage','stock.transfers.view','stock.transfers.manage','payments.view','payments.manage',
  'prescriptions.view','delivery.view','delivery.manage','reports.view','cash.view','cash.manage',
  'purchases.view','purchases.manage'
)
WHERE r.slug IN ('gerente_loja', 'admin');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN (
  'dashboard.view','orders.view','orders.manage','prescriptions.view','prescriptions.validate',
  'products.view','stock.view','stock.transfers.view','reports.view'
)
WHERE r.slug IN ('farmaceutico', 'pharmacist');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN ('dashboard.view','orders.view','customers.view','products.view','delivery.view')
WHERE r.slug IN ('funcionario', 'employee', 'attendant');

CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
  o.id_filial,
  f.nome AS filial_nome,
  DATE(o.created_at) AS sale_date,
  COUNT(*) AS order_count,
  SUM(CASE WHEN o.payment_status = 'aprovado' THEN o.grand_total ELSE 0 END) AS approved_revenue,
  AVG(CASE WHEN o.payment_status = 'aprovado' THEN o.grand_total ELSE NULL END) AS average_ticket,
  SUM(CASE WHEN o.status = 'cancelado' THEN 1 ELSE 0 END) AS cancelled_orders
FROM orders o
LEFT JOIN filiais f ON f.id = o.id_filial
GROUP BY o.id_filial, f.nome, DATE(o.created_at);

CREATE OR REPLACE VIEW v_order_dashboard AS
SELECT
  o.id_filial,
  f.nome AS filial_nome,
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
LEFT JOIN filiais f ON f.id = o.id_filial
WHERE o.deleted_at IS NULL
GROUP BY o.id_filial, f.nome, o.status, o.payment_status, o.clinical_status, o.delivery_method, o.priority, o.has_problem;

CREATE OR REPLACE VIEW v_stock_risk AS
SELECT
  ef.id_filial,
  f.nome AS filial_nome,
  p.id AS product_id,
  p.name AS product_name,
  p.internal_code,
  p.ean,
  ef.quantidade AS current_stock,
  ef.estoque_minimo AS minimum_stock,
  ef.estoque_maximo AS maximum_stock,
  MIN(pb.expiration_date) AS nearest_expiration_date,
  CASE
    WHEN ef.quantidade <= 0 THEN 'out_of_stock'
    WHEN ef.quantidade <= ef.estoque_minimo THEN 'low_stock'
    WHEN MIN(pb.expiration_date) IS NOT NULL AND MIN(pb.expiration_date) < CURRENT_DATE THEN 'expired'
    WHEN MIN(pb.expiration_date) IS NOT NULL AND MIN(pb.expiration_date) <= DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY) THEN 'near_expiration'
    ELSE 'normal'
  END AS risk_status
FROM estoque_filial ef
INNER JOIN products p ON p.id = ef.id_produto
INNER JOIN filiais f ON f.id = ef.id_filial
LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.status IN ('available','reserved')
WHERE p.deleted_at IS NULL
GROUP BY ef.id_filial, f.nome, p.id, p.name, p.internal_code, p.ean, ef.quantidade, ef.estoque_minimo, ef.estoque_maximo;

CREATE OR REPLACE VIEW v_prescription_queue AS
SELECT
  pr.id_filial,
  f.nome AS filial_nome,
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
LEFT JOIN filiais f ON f.id = pr.id_filial
WHERE pr.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_product_sales_summary AS
SELECT
  o.id_filial,
  f.nome AS filial_nome,
  oi.product_id,
  oi.product_name,
  SUM(oi.quantity) AS quantity_sold,
  SUM(oi.line_total) AS revenue_total,
  SUM(COALESCE(oi.cost_unit_price, 0) * oi.quantity) AS cost_total,
  SUM(oi.line_total - (COALESCE(oi.cost_unit_price, 0) * oi.quantity)) AS estimated_profit,
  MAX(o.created_at) AS last_sold_at
FROM order_items oi
INNER JOIN orders o ON o.id = oi.order_id
LEFT JOIN filiais f ON f.id = o.id_filial
WHERE o.payment_status = 'aprovado'
GROUP BY o.id_filial, f.nome, oi.product_id, oi.product_name;
