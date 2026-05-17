-- FarmaVida
-- Seeder: roles, permissions, pharmacy profile and baseline settings.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO roles (name, slug, description, is_system) VALUES
('Dono', 'owner', 'Acesso total ao sistema e configuracoes criticas.', 1),
('Administrador', 'admin', 'Gestao operacional ampla sem propriedade do sistema.', 1),
('Farmaceutico', 'pharmacist', 'Validacao de receitas e orientacao farmaceutica.', 1),
('Atendente', 'attendant', 'Atendimento, pedidos e suporte ao cliente.', 1),
('Estoquista', 'stockist', 'Controle de estoque, lotes e inventario.', 1),
('Entregador', 'delivery', 'Acompanhamento de entregas atribuidas.', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO permissions (module, action, slug, description) VALUES
('dashboard','view','dashboard.view','Visualizar dashboard administrativo.'),
('settings','manage','settings.manage','Gerenciar configuracoes do sistema.'),
('users','manage','users.manage','Gerenciar usuarios, roles e permissoes.'),
('customers','view','customers.view','Visualizar clientes.'),
('customers','manage','customers.manage','Gerenciar clientes.'),
('products','view','products.view','Visualizar produtos.'),
('products','manage','products.manage','Gerenciar produtos, categorias, imagens e kits.'),
('stock','view','stock.view','Visualizar estoque.'),
('stock','manage','stock.manage','Gerenciar movimentos, lotes e inventarios.'),
('stock_transfers','view','stock.transfers.view','Visualizar transferencias de estoque entre filiais.'),
('stock_transfers','manage','stock.transfers.manage','Solicitar e atualizar transferencias de estoque entre filiais.'),
('orders','view','orders.view','Visualizar pedidos.'),
('orders','manage','orders.manage','Gerenciar pedidos e status.'),
('orders','cancel','orders.cancel','Cancelar pedidos com justificativa.'),
('payments','view','payments.view','Visualizar pagamentos.'),
('payments','manage','payments.manage','Gerenciar pagamentos, divergencias e conciliacao.'),
('prescriptions','view','prescriptions.view','Visualizar receitas protegidas.'),
('prescriptions','validate','prescriptions.validate','Validar, rejeitar ou bloquear receitas.'),
('invoices','view','invoices.view','Visualizar NF-e simulada.'),
('invoices','manage','invoices.manage','Emitir e cancelar NF-e simulada.'),
('integrations','view','integrations.view','Visualizar integracoes, API e webhooks.'),
('integrations','manage','integrations.manage','Gerenciar API keys, ERP e webhooks.'),
('loyalty','view','loyalty.view','Visualizar fidelidade.'),
('loyalty','manage','loyalty.manage','Gerenciar pontos e ajustes.'),
('marketing','view','marketing.view','Visualizar marketing.'),
('marketing','manage','marketing.manage','Gerenciar cupons, campanhas e banners.'),
('reports','view','reports.view','Visualizar relatorios.'),
('lgpd','view','lgpd.view','Visualizar solicitacoes LGPD.'),
('lgpd','manage','lgpd.manage','Atender solicitacoes LGPD.'),
('logs','view','logs.view','Visualizar logs e auditorias.'),
('delivery','view','delivery.view','Visualizar entregas.'),
('delivery','manage','delivery.manage','Gerenciar entregas e entregadores.')
ON DUPLICATE KEY UPDATE
  module = VALUES(module),
  action = VALUES(action),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN ('owner','admin');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN (
  'dashboard.view','orders.view','orders.manage','prescriptions.view','prescriptions.validate',
  'products.view','stock.view','stock.transfers.view','customers.view','reports.view'
)
WHERE r.slug = 'pharmacist';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN (
  'dashboard.view','orders.view','orders.manage','customers.view','products.view',
  'payments.view','delivery.view'
)
WHERE r.slug = 'attendant';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN (
  'dashboard.view','products.view','stock.view','stock.manage','stock.transfers.view',
  'stock.transfers.manage','reports.view'
)
WHERE r.slug = 'stockist';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.slug IN ('delivery.view')
WHERE r.slug = 'delivery';

INSERT INTO pharmacy_profiles (
  legal_name, trade_name, cnpj, address_street, address_number, address_complement,
  address_district, address_city, address_state, address_postal_code, phone, email,
  responsible_pharmacist, crf_number, sanitary_license, anvisa_afe, anvisa_ae,
  operating_hours_text, privacy_policy_url, terms_url, customer_service_channel,
  pharmaceutical_guidance_channel, is_active
) VALUES (
  'FarmaVida Comercio Varejista de Medicamentos Ltda.',
  'FarmaVida',
  '00.000.000/0001-00',
  'Rua Exemplo',
  '100',
  NULL,
  'Centro',
  'Sao Paulo',
  'SP',
  '01000-000',
  '(11) 0000-0000',
  'atendimento@farmavida.local',
  'Farmaceutico Responsavel',
  'CRF-SP 000000',
  'Alvara sanitario pendente de configuracao',
  'AFE pendente de configuracao',
  NULL,
  'Segunda a sexta, 08:00 as 18:00; sabado, 08:00 as 12:00.',
  '/privacidade',
  '/termos',
  'atendimento@farmavida.local',
  'farmaceutico@farmavida.local',
  1
) ON DUPLICATE KEY UPDATE
  trade_name = VALUES(trade_name),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO settings (setting_group, setting_key, setting_value, value_type, is_public, is_sensitive, description) VALUES
('app','name','FarmaVida','string',1,0,'Nome publico do sistema.'),
('app','environment','local','string',0,0,'Ambiente atual: local, staging ou production.'),
('app','debug','1','bool',0,0,'Debug deve ficar desativado em producao.'),
('store','status','open','string',1,0,'Status operacional da loja.'),
('store','currency','BRL','string',1,0,'Moeda padrao.'),
('store','cart_expiration_hours','72','int',0,0,'Validade de carrinho em horas.'),
('store','free_shipping_minimum','199.90','decimal',1,0,'Valor minimo para frete gratis.'),
('stock','allow_pre_sale','0','bool',0,0,'Permite venda sem estoque quando ativado.'),
('stock','movement_retention_days','365','int',0,0,'Retencao minima de movimentos de estoque.'),
('security','login_max_attempts','5','int',0,0,'Tentativas de login antes do bloqueio.'),
('security','login_lock_minutes','15','int',0,0,'Tempo de bloqueio por rate limit.'),
('security','password_reset_token_minutes','60','int',0,0,'Validade do token de recuperacao.'),
('security','csrf_enabled','1','bool',0,0,'CSRF obrigatorio em POST.'),
('mercado_pago','mode','sandbox','string',0,0,'Modo Mercado Pago.'),
('mercado_pago','access_token',NULL,'encrypted',0,1,'Access token deve ser configurado em ambiente seguro.'),
('mercado_pago','webhook_secret',NULL,'encrypted',0,1,'Segredo HMAC para webhook.'),
('smtp','host',NULL,'string',0,1,'Host SMTP.'),
('smtp','port','587','int',0,0,'Porta SMTP.'),
('smtp','username',NULL,'string',0,1,'Usuario SMTP.'),
('smtp','password',NULL,'encrypted',0,1,'Senha SMTP.'),
('lgpd','privacy_policy_version','1.0.0','string',1,0,'Versao da politica de privacidade.'),
('lgpd','terms_version','1.0.0','string',1,0,'Versao dos termos de uso.')
ON DUPLICATE KEY UPDATE
  setting_value = IF(VALUES(is_sensitive) = 1, settings.setting_value, VALUES(setting_value)),
  value_type = VALUES(value_type),
  is_public = VALUES(is_public),
  is_sensitive = VALUES(is_sensitive),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;
