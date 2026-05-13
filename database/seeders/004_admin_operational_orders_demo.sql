-- FarmaVida
-- Seeder: demo orders for the admin operational queue.
-- Purpose: realistic scenarios for payment, prescription, fulfillment and delivery lanes.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (public_id, user_type, name, email, phone, password_hash, email_verified_at, status, created_ip, created_user_agent) VALUES
('21000000-0000-4000-8000-000000000001', 'admin', 'Atendente Demo Operacao', 'atendente.operacao@farmavida.local', '(11) 90000-1001', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('21000000-0000-4000-8000-000000000002', 'admin', 'Farmaceutica Demo Operacao', 'farmaceutica.operacao@farmavida.local', '(11) 90000-1002', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('21000000-0000-4000-8000-000000000003', 'admin', 'Estoquista Demo Operacao', 'estoque.operacao@farmavida.local', '(11) 90000-1003', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('21000000-0000-4000-8000-000000000004', 'system', 'Sistema Demo Operacao', 'sistema.operacao@farmavida.local', NULL, 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  phone = VALUES(phone),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO admins (user_id, employee_code, display_name, position, crf_number, is_pharmacist, can_validate_prescriptions, status)
SELECT u.id, 'DEMO-ATD-001', 'Atendente Demo', 'Atendimento operacional', NULL, 0, 0, 'active'
FROM users u
WHERE u.email = 'atendente.operacao@farmavida.local'
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  position = VALUES(position),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO admins (user_id, employee_code, display_name, position, crf_number, is_pharmacist, can_validate_prescriptions, status)
SELECT u.id, 'DEMO-FAR-001', 'Farmaceutica Demo', 'Farmaceutica responsavel demo', 'CRF-SP 123456', 1, 1, 'active'
FROM users u
WHERE u.email = 'farmaceutica.operacao@farmavida.local'
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  position = VALUES(position),
  crf_number = VALUES(crf_number),
  is_pharmacist = VALUES(is_pharmacist),
  can_validate_prescriptions = VALUES(can_validate_prescriptions),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO admins (user_id, employee_code, display_name, position, crf_number, is_pharmacist, can_validate_prescriptions, status)
SELECT u.id, 'DEMO-EST-001', 'Estoquista Demo', 'Separacao e estoque demo', NULL, 0, 0, 'active'
FROM users u
WHERE u.email = 'estoque.operacao@farmavida.local'
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  position = VALUES(position),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
INNER JOIN roles r ON r.slug = 'attendant'
WHERE u.email = 'atendente.operacao@farmavida.local';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
INNER JOIN roles r ON r.slug = 'pharmacist'
WHERE u.email = 'farmaceutica.operacao@farmavida.local';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
INNER JOIN roles r ON r.slug = 'stockist'
WHERE u.email = 'estoque.operacao@farmavida.local';

INSERT INTO delivery_people (name, phone, document_masked, vehicle_type, vehicle_plate, status)
SELECT 'Rafael Motoboy Demo', '(11) 98888-0101', '***.***.321-00', 'motorcycle', 'FVD-0P81', 'available'
WHERE NOT EXISTS (SELECT 1 FROM delivery_people WHERE name = 'Rafael Motoboy Demo');

INSERT INTO users (public_id, user_type, name, email, phone, password_hash, email_verified_at, status, created_ip, created_user_agent) VALUES
('22000000-0000-4000-8000-000000000001', 'customer', 'Ana Paula Ribeiro', 'ana.ribeiro.demo@farmavida.local', '(11) 95555-0001', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000002', 'customer', 'Bruno Carvalho', 'bruno.carvalho.demo@farmavida.local', '(11) 95555-0002', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000003', 'customer', 'Camila Torres', 'camila.torres.demo@farmavida.local', '(11) 95555-0003', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000004', 'customer', 'Daniel Martins', 'daniel.martins.demo@farmavida.local', '(11) 95555-0004', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000005', 'customer', 'Elisa Nogueira', 'elisa.nogueira.demo@farmavida.local', '(11) 95555-0005', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000006', 'customer', 'Fernando Lima', 'fernando.lima.demo@farmavida.local', '(11) 95555-0006', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000007', 'customer', 'Gabriela Souza', 'gabriela.souza.demo@farmavida.local', '(11) 95555-0007', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000008', 'customer', 'Helena Duarte', 'helena.duarte.demo@farmavida.local', '(11) 95555-0008', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders'),
('22000000-0000-4000-8000-000000000009', 'customer', 'Igor Batista', 'igor.batista.demo@farmavida.local', '(11) 95555-0009', 'seed-login-disabled', CURRENT_TIMESTAMP, 'active', '127.0.0.1', 'seed-admin-operational-orders')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  phone = VALUES(phone),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO customers (user_id, cpf_hash, cpf_masked, cpf_last4, birth_date, gender, accepts_lgpd, lgpd_accepted_at, lgpd_accepted_ip, lgpd_accepted_user_agent, marketing_opt_in, marketing_opt_in_at, account_status)
SELECT u.id, SHA2(CONCAT('demo-cpf-', u.email), 256), masks.cpf_masked, masks.cpf_last4, masks.birth_date, masks.gender, 1, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY), '127.0.0.1', 'seed-admin-operational-orders', masks.marketing_opt_in, IF(masks.marketing_opt_in = 1, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY), NULL), 'active'
FROM users u
INNER JOIN (
  SELECT 'ana.ribeiro.demo@farmavida.local' AS email, '***.***.111-01' AS cpf_masked, '1101' AS cpf_last4, '1988-03-14' AS birth_date, 'female' AS gender, 1 AS marketing_opt_in
  UNION ALL SELECT 'bruno.carvalho.demo@farmavida.local', '***.***.222-02', '2202', '1981-07-22', 'male', 0
  UNION ALL SELECT 'camila.torres.demo@farmavida.local', '***.***.333-03', '3303', '1992-11-08', 'female', 1
  UNION ALL SELECT 'daniel.martins.demo@farmavida.local', '***.***.444-04', '4404', '1975-02-19', 'male', 0
  UNION ALL SELECT 'elisa.nogueira.demo@farmavida.local', '***.***.555-05', '5505', '1969-09-03', 'female', 0
  UNION ALL SELECT 'fernando.lima.demo@farmavida.local', '***.***.666-06', '6606', '1984-05-27', 'male', 1
  UNION ALL SELECT 'gabriela.souza.demo@farmavida.local', '***.***.777-07', '7707', '1994-12-02', 'female', 1
  UNION ALL SELECT 'helena.duarte.demo@farmavida.local', '***.***.888-08', '8808', '1979-04-10', 'female', 0
  UNION ALL SELECT 'igor.batista.demo@farmavida.local', '***.***.999-09', '9909', '1986-08-16', 'male', 1
) masks ON masks.email = u.email
ON DUPLICATE KEY UPDATE
  cpf_masked = VALUES(cpf_masked),
  cpf_last4 = VALUES(cpf_last4),
  account_status = VALUES(account_status),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO customer_addresses (customer_id, label, recipient_name, phone, postal_code, street, number, complement, district, city, state, reference_point, latitude, longitude, is_default)
SELECT c.id, 'Casa Demo', u.name, u.phone, addr.postal_code, addr.street, addr.number, addr.complement, addr.district, 'Sao Paulo', 'SP', addr.reference_point, addr.latitude, addr.longitude, 1
FROM customers c
INNER JOIN users u ON u.id = c.user_id
INNER JOIN (
  SELECT 'ana.ribeiro.demo@farmavida.local' AS email, '01001-000' AS postal_code, 'Rua Boa Vista' AS street, '120' AS number, 'apto 54' AS complement, 'Centro' AS district, 'Portaria 24h' AS reference_point, -23.5452100 AS latitude, -46.6333100 AS longitude
  UNION ALL SELECT 'bruno.carvalho.demo@farmavida.local', '01310-100', 'Avenida Paulista', '900', 'conjunto 41', 'Bela Vista', 'Recepcao comercial', -23.5637700, -46.6543500
  UNION ALL SELECT 'camila.torres.demo@farmavida.local', '04101-300', 'Rua Domingos de Morais', '2200', 'apto 82', 'Vila Mariana', 'Proximo ao metro', -23.5908600, -46.6347700
  UNION ALL SELECT 'daniel.martins.demo@farmavida.local', '05407-002', 'Rua dos Pinheiros', '640', NULL, 'Pinheiros', 'Casa azul', -23.5661800, -46.6863300
  UNION ALL SELECT 'elisa.nogueira.demo@farmavida.local', '05010-000', 'Rua Turiassu', '1560', 'bloco B', 'Perdizes', 'Entrada lateral', -23.5312500, -46.6703800
  UNION ALL SELECT 'fernando.lima.demo@farmavida.local', '04552-050', 'Rua Florida', '480', 'sala 12', 'Brooklin', 'Portaria empresarial', -23.6102100, -46.6948700
  UNION ALL SELECT 'gabriela.souza.demo@farmavida.local', '03311-000', 'Rua Serra de Jurea', '310', 'apto 33', 'Tatuape', 'Perto da praca', -23.5398200, -46.5746100
  UNION ALL SELECT 'helena.duarte.demo@farmavida.local', '02012-010', 'Avenida Cruzeiro do Sul', '1700', 'apto 1104', 'Santana', 'Torre unica', -23.5119600, -46.6254500
  UNION ALL SELECT 'igor.batista.demo@farmavida.local', '01501-000', 'Rua Vergueiro', '210', NULL, 'Liberdade', 'Ao lado da farmacia', -23.5574300, -46.6372200
) addr ON addr.email = u.email
WHERE NOT EXISTS (
  SELECT 1
  FROM customer_addresses existing
  WHERE existing.customer_id = c.id
    AND existing.label = 'Casa Demo'
    AND existing.deleted_at IS NULL
);

INSERT INTO orders (
  public_id, order_number, customer_id, customer_address_id, responsible_user_id,
  status, payment_status, clinical_status, delivery_method, delivery_status, priority,
  has_problem, problem_reason, requires_prescription, has_controlled_items,
  currency, subtotal, discount_total, coupon_discount, delivery_fee, tax_total, grand_total,
  cost_total, estimated_profit, coupon_code, customer_note, internal_note, pharmacy_note_to_customer,
  delivery_address_snapshot, customer_snapshot, estimated_delivery_at, paid_at, delivered_at,
  created_ip, created_user_agent, created_at, updated_at
) VALUES
('23000000-0000-4000-8000-000000000001', 'FV-DEMO-OP-001', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'ana.ribeiro.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'ana.ribeiro.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'aguardando_pagamento', 'aguardando_pagamento', 'nao_exige_receita', 'local_delivery', 'pending', 'normal', 0, NULL, 0, 0, 'BRL', 71.70, 0.00, 0.00, 8.90, 0.00, 80.60, 43.90, 36.70, NULL, 'Entregar apos 18h, porteiro autorizado.', 'PIX gerado; cliente avisada sobre vencimento em 30 minutos.', 'Seu pedido esta reservado enquanto aguardamos a confirmacao do pagamento.', JSON_OBJECT('recipient','Ana Paula Ribeiro','street','Rua Boa Vista','number','120','district','Centro','city','Sao Paulo','state','SP','postal_code','01001-000'), JSON_OBJECT('name','Ana Paula Ribeiro','email','ana.ribeiro.demo@farmavida.local','phone','(11) 95555-0001','cpf_masked','***.***.111-01'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 90 MINUTE), NULL, NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 35 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000002', 'FV-DEMO-OP-002', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'bruno.carvalho.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'bruno.carvalho.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'pagamento_confirmado', 'aprovado', 'nao_exige_receita', 'pickup', 'not_required', 'normal', 0, NULL, 0, 0, 'BRL', 110.70, 0.00, 0.00, 8.90, 0.00, 119.60, 69.20, 50.40, NULL, 'Retirada pelo proprio cliente no balcao.', 'Pagamento aprovado no cartao; aguardando separacao.', 'Pagamento confirmado. Ja estamos preparando seu pedido.', JSON_OBJECT('recipient','Bruno Carvalho','street','Avenida Paulista','number','900','district','Bela Vista','city','Sao Paulo','state','SP','postal_code','01310-100'), JSON_OBJECT('name','Bruno Carvalho','email','bruno.carvalho.demo@farmavida.local','phone','(11) 95555-0002','cpf_masked','***.***.222-02'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 78 MINUTE), NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 105 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000003', 'FV-DEMO-OP-003', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'camila.torres.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'camila.torres.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'receita_em_validacao', 'aprovado', 'em_validacao', 'local_delivery', 'pending', 'normal', 0, NULL, 1, 0, 'BRL', 50.80, 0.00, 0.00, 8.90, 0.00, 59.70, 27.20, 32.50, NULL, 'Receita anexada no checkout.', 'Receita de antibiotico em validacao; conferir assinatura e data.', 'Receita recebida e em validacao farmaceutica.', JSON_OBJECT('recipient','Camila Torres','street','Rua Domingos de Morais','number','2200','district','Vila Mariana','city','Sao Paulo','state','SP','postal_code','04101-300'), JSON_OBJECT('name','Camila Torres','email','camila.torres.demo@farmavida.local','phone','(11) 95555-0003','cpf_masked','***.***.333-03'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 175 MINUTE), NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 195 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000004', 'FV-DEMO-OP-004', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'daniel.martins.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'daniel.martins.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'receita_rejeitada', 'aprovado', 'bloqueado_orientacao_farmaceutica', 'pickup', 'not_required', 'urgent', 1, 'Item controlado bloqueado para venda remota; orientar cliente sobre atendimento presencial e retencao da receita.', 1, 1, 'BRL', 24.90, 0.00, 0.00, 0.00, 0.00, 24.90, 12.00, 12.90, NULL, 'Cliente solicitou orientacao sobre retirada.', 'Clonazepam bloqueado pela politica de venda remota.', 'Identificamos item controlado. Nossa equipe entrara em contato para orientar o atendimento.', JSON_OBJECT('recipient','Daniel Martins','street','Rua dos Pinheiros','number','640','district','Pinheiros','city','Sao Paulo','state','SP','postal_code','05407-002'), JSON_OBJECT('name','Daniel Martins','email','daniel.martins.demo@farmavida.local','phone','(11) 95555-0004','cpf_masked','***.***.444-04'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 4 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 254 MINUTE), NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 270 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000005', 'FV-DEMO-OP-005', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'elisa.nogueira.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'elisa.nogueira.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'liberado_pelo_farmaceutico', 'aprovado', 'liberado', 'motoboy', 'assigned', 'critical', 0, NULL, 1, 0, 'BRL', 106.70, 0.00, 0.00, 14.90, 0.00, 121.60, 68.40, 53.20, NULL, 'Cliente informou que precisa da insulina ainda hoje.', 'Pedido urgente termossensivel; manter cadeia fria e priorizar motoboy.', 'Pedido liberado pelo farmaceutico e priorizado para entrega.', JSON_OBJECT('recipient','Elisa Nogueira','street','Rua Turiassu','number','1560','district','Perdizes','city','Sao Paulo','state','SP','postal_code','05010-000'), JSON_OBJECT('name','Elisa Nogueira','email','elisa.nogueira.demo@farmavida.local','phone','(11) 95555-0005','cpf_masked','***.***.555-05'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 55 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 20 MINUTE), NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 25 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000006', 'FV-DEMO-OP-006', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'fernando.lima.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'fernando.lima.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'pagamento_em_analise', 'divergente', 'nao_exige_receita', 'carrier', 'pending', 'urgent', 1, 'Pagamento recebido com R$ 10,00 a menos que o total do pedido; exige conciliacao manual.', 0, 0, 'BRL', 143.40, 0.00, 0.00, 14.90, 0.00, 158.30, 87.80, 70.50, NULL, 'Cliente pediu confirmacao por WhatsApp.', 'Divergencia de valor detectada na conciliacao do provedor.', 'Estamos conferindo o pagamento antes de liberar o pedido.', JSON_OBJECT('recipient','Fernando Lima','street','Rua Florida','number','480','district','Brooklin','city','Sao Paulo','state','SP','postal_code','04552-050'), JSON_OBJECT('name','Fernando Lima','email','fernando.lima.demo@farmavida.local','phone','(11) 95555-0006','cpf_masked','***.***.666-06'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 HOUR), NULL, NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 130 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000007', 'FV-DEMO-OP-007', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'gabriela.souza.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'gabriela.souza.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'estoque.operacao@farmavida.local'), 'em_separacao', 'aprovado', 'nao_exige_receita', 'local_delivery', 'pending', 'normal', 0, NULL, 0, 0, 'BRL', 82.60, 0.00, 0.00, 8.90, 0.00, 91.50, 50.10, 41.40, NULL, 'Pode substituir sacola por embalagem discreta.', 'Separacao iniciada no corredor A/C; conferir lote antes de expedicao.', 'Pedido em separacao.', JSON_OBJECT('recipient','Gabriela Souza','street','Rua Serra de Jurea','number','310','district','Tatuape','city','Sao Paulo','state','SP','postal_code','03311-000'), JSON_OBJECT('name','Gabriela Souza','email','gabriela.souza.demo@farmavida.local','phone','(11) 95555-0007','cpf_masked','***.***.777-07'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 2 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 285 MINUTE), NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 300 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000008', 'FV-DEMO-OP-008', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'helena.duarte.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'helena.duarte.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'saiu_para_entrega', 'aprovado', 'nao_exige_receita', 'motoboy', 'in_transit', 'normal', 0, NULL, 0, 0, 'BRL', 60.80, 0.00, 0.00, 8.90, 0.00, 69.70, 37.70, 32.00, NULL, 'Telefonar quando chegar na portaria.', 'Motoboy saiu com rota Santana; previsao dentro da janela.', 'Pedido saiu para entrega.', JSON_OBJECT('recipient','Helena Duarte','street','Avenida Cruzeiro do Sul','number','1700','district','Santana','city','Sao Paulo','state','SP','postal_code','02012-010'), JSON_OBJECT('name','Helena Duarte','email','helena.duarte.demo@farmavida.local','phone','(11) 95555-0008','cpf_masked','***.***.888-08'), DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 40 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 395 MINUTE), NULL, '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 420 MINUTE), CURRENT_TIMESTAMP),
('23000000-0000-4000-8000-000000000009', 'FV-DEMO-OP-009', (SELECT c.id FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'igor.batista.demo@farmavida.local'), (SELECT ca.id FROM customer_addresses ca INNER JOIN customers c ON c.id = ca.customer_id INNER JOIN users u ON u.id = c.user_id WHERE u.email = 'igor.batista.demo@farmavida.local' AND ca.label = 'Casa Demo' AND ca.deleted_at IS NULL LIMIT 1), (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'entregue', 'aprovado', 'nao_exige_receita', 'local_delivery', 'delivered', 'normal', 0, NULL, 0, 0, 'BRL', 60.80, 0.00, 0.00, 8.90, 0.00, 69.70, 37.70, 32.00, NULL, 'Cliente autorizou entrega ao porteiro.', 'Entrega concluida e comprovante registrado.', 'Pedido entregue. Obrigado pela preferencia.', JSON_OBJECT('recipient','Igor Batista','street','Rua Vergueiro','number','210','district','Liberdade','city','Sao Paulo','state','SP','postal_code','01501-000'), JSON_OBJECT('name','Igor Batista','email','igor.batista.demo@farmavida.local','phone','(11) 95555-0009','cpf_masked','***.***.999-09'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 23 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 26 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 23 HOUR), '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 27 HOUR), CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  customer_id = VALUES(customer_id),
  customer_address_id = VALUES(customer_address_id),
  responsible_user_id = VALUES(responsible_user_id),
  status = VALUES(status),
  payment_status = VALUES(payment_status),
  clinical_status = VALUES(clinical_status),
  delivery_method = VALUES(delivery_method),
  delivery_status = VALUES(delivery_status),
  priority = VALUES(priority),
  has_problem = VALUES(has_problem),
  problem_reason = VALUES(problem_reason),
  requires_prescription = VALUES(requires_prescription),
  has_controlled_items = VALUES(has_controlled_items),
  subtotal = VALUES(subtotal),
  discount_total = VALUES(discount_total),
  coupon_discount = VALUES(coupon_discount),
  delivery_fee = VALUES(delivery_fee),
  grand_total = VALUES(grand_total),
  cost_total = VALUES(cost_total),
  estimated_profit = VALUES(estimated_profit),
  coupon_code = VALUES(coupon_code),
  customer_note = VALUES(customer_note),
  internal_note = VALUES(internal_note),
  pharmacy_note_to_customer = VALUES(pharmacy_note_to_customer),
  delivery_address_snapshot = VALUES(delivery_address_snapshot),
  customer_snapshot = VALUES(customer_snapshot),
  estimated_delivery_at = VALUES(estimated_delivery_at),
  paid_at = VALUES(paid_at),
  delivered_at = VALUES(delivered_at),
  created_at = VALUES(created_at),
  updated_at = CURRENT_TIMESTAMP,
  deleted_at = NULL;

DELETE ii
FROM invoice_items ii
INNER JOIN invoices inv ON inv.id = ii.invoice_id
INNER JOIN orders o ON o.id = inv.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE inv
FROM invoices inv
INNER JOIN orders o ON o.id = inv.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE rf
FROM payment_refunds rf
INNER JOIN payments p ON p.id = rf.payment_id
INNER JOIN orders o ON o.id = p.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE pw
FROM payment_webhooks pw
INNER JOIN orders o ON o.id = pw.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE prc
FROM payment_reconciliations prc
INNER JOIN orders o ON o.id = prc.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE p
FROM payments p
INNER JOIN orders o ON o.id = p.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE pi
FROM prescription_items pi
INNER JOIN prescriptions pr ON pr.id = pi.prescription_id
INNER JOIN orders o ON o.id = pr.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE pa
FROM prescription_audits pa
INNER JOIN prescriptions pr ON pr.id = pa.prescription_id
INNER JOIN orders o ON o.id = pr.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE pr
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE da
FROM delivery_assignments da
INNER JOIN orders o ON o.id = da.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE sm
FROM support_messages sm
INNER JOIN orders o ON o.id = sm.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE oa
FROM operation_alerts oa
INNER JOIN orders o ON o.id = oa.related_id AND oa.related_type = 'order'
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE n
FROM order_internal_notes n
INNER JOIN orders o ON o.id = n.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE h
FROM order_status_history h
INNER JOIN orders o ON o.id = h.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

DELETE oi
FROM order_items oi
INNER JOIN orders o ON o.id = oi.order_id
WHERE o.order_number LIKE 'FV-DEMO-OP-%';

INSERT INTO order_items (
  order_id, product_id, batch_id, product_name, product_sku, ean, active_ingredient,
  anvisa_registration, quantity, unit_price, promotional_unit_price, discount_total,
  line_total, cost_unit_price, requires_prescription, prescription_type, is_controlled,
  is_thermosensitive, product_snapshot
)
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 2, 10.90, p.promotional_price, 0.00, 21.80, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-001'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 49.90, p.promotional_price, 0.00, 49.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'DER-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-001'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 2, 49.90, p.promotional_price, 0.00, 99.80, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'DER-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-002'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 10.90, p.promotional_price, 0.00, 10.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-002'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 39.90, NULL, 0.00, 39.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0002' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 10.90, p.promotional_price, 0.00, 10.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 24.90, NULL, 0.00, 24.90, p.cost_price, p.requires_prescription, p.prescription_type, 1, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0003' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 84.90, NULL, 0.00, 84.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'TER-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 2, 10.90, p.promotional_price, 0.00, 21.80, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 2, 49.90, p.promotional_price, 0.00, 99.80, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'DER-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-006'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 4, 10.90, p.promotional_price, 0.00, 43.60, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-006'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 3, 10.90, p.promotional_price, 0.00, 32.70, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-007'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 49.90, p.promotional_price, 0.00, 49.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'DER-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-007'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 49.90, p.promotional_price, 0.00, 49.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'DER-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 10.90, p.promotional_price, 0.00, 10.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 49.90, p.promotional_price, 0.00, 49.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'DER-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-009'
UNION ALL
SELECT o.id, p.id, pb.id, p.name, p.sku, p.ean, p.active_ingredient, p.anvisa_registration, 1, 10.90, p.promotional_price, 0.00, 10.90, p.cost_price, p.requires_prescription, p.prescription_type, 0, p.is_thermosensitive, JSON_OBJECT('internal_code', p.internal_code, 'name', p.name, 'dosage_form', p.dosage_form, 'presentation', p.presentation)
FROM orders o INNER JOIN products p ON p.internal_code = 'MED-0001' LEFT JOIN product_batches pb ON pb.product_id = p.id AND pb.batch_code = CONCAT('LT-', p.internal_code, '-A') WHERE o.order_number = 'FV-DEMO-OP-009';

INSERT INTO payments (
  public_id, order_id, provider, environment, payment_method, provider_payment_id,
  provider_preference_id, idempotency_key_hash, status, provider_status, provider_status_detail,
  installments, amount, currency, payer_email, payer_document_masked, pix_qr_code,
  pix_expiration_at, checkout_url, metadata, approved_at, paid_at, expires_at, last_synced_at,
  created_at, updated_at
)
SELECT CONCAT('24000000-0000-4000-8000-00000000000', seq.n), o.id, 'sandbox_fake', 'sandbox', seq.payment_method, CONCAT('mp-demo-op-00', seq.n), CONCAT('pref-demo-op-00', seq.n), SHA2(CONCAT('fv-demo-payment-op-00', seq.n), 256), seq.status, seq.provider_status, seq.provider_status_detail, seq.installments, seq.amount, 'BRL', seq.email, seq.document_masked, seq.pix_qr_code, seq.pix_expiration_at, seq.checkout_url, JSON_OBJECT('scenario', seq.scenario, 'order_number', o.order_number), seq.approved_at, seq.paid_at, seq.expires_at, CURRENT_TIMESTAMP, seq.created_at, CURRENT_TIMESTAMP
FROM orders o
INNER JOIN (
  SELECT 1 AS n, 'FV-DEMO-OP-001' AS order_number, 'pix' AS payment_method, 'aguardando_pagamento' AS status, 'pending' AS provider_status, 'pending_waiting_transfer' AS provider_status_detail, NULL AS installments, 80.60 AS amount, 'ana.ribeiro.demo@farmavida.local' AS email, '***.***.111-01' AS document_masked, '00020126580014BR.GOV.BCB.PIX0136demo-pix-fv-op-001520400005303986540580.605802BR5909FarmaVida6009SaoPaulo62070503***6304DEMO' AS pix_qr_code, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 25 MINUTE) AS pix_expiration_at, '/checkout/demo/op-001' AS checkout_url, NULL AS approved_at, NULL AS paid_at, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 25 MINUTE) AS expires_at, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 34 MINUTE) AS created_at, 'pagamento_pendente' AS scenario
  UNION ALL SELECT 2, 'FV-DEMO-OP-002', 'credit_card', 'aprovado', 'approved', 'accredited', 3, 119.60, 'bruno.carvalho.demo@farmavida.local', '***.***.222-02', NULL, NULL, '/checkout/demo/op-002', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 78 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 78 MINUTE), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 103 MINUTE), 'pagamento_aprovado'
  UNION ALL SELECT 3, 'FV-DEMO-OP-003', 'pix', 'aprovado', 'approved', 'accredited', NULL, 59.70, 'camila.torres.demo@farmavida.local', '***.***.333-03', NULL, NULL, '/checkout/demo/op-003', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 175 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 175 MINUTE), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 193 MINUTE), 'receita_em_validacao'
  UNION ALL SELECT 4, 'FV-DEMO-OP-004', 'credit_card', 'aprovado', 'approved', 'accredited', 1, 24.90, 'daniel.martins.demo@farmavida.local', '***.***.444-04', NULL, NULL, '/checkout/demo/op-004', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 254 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 254 MINUTE), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 267 MINUTE), 'item_controlado_bloqueado'
  UNION ALL SELECT 5, 'FV-DEMO-OP-005', 'pix', 'aprovado', 'approved', 'accredited', NULL, 121.60, 'elisa.nogueira.demo@farmavida.local', '***.***.555-05', NULL, NULL, '/checkout/demo/op-005', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 20 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 20 MINUTE), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 MINUTE), 'pedido_urgente'
  UNION ALL SELECT 6, 'FV-DEMO-OP-006', 'pix', 'divergente', 'approved', 'accredited_amount_mismatch', NULL, 148.30, 'fernando.lima.demo@farmavida.local', '***.***.666-06', NULL, NULL, '/checkout/demo/op-006', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 113 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 113 MINUTE), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 128 MINUTE), 'pedido_com_problema'
  UNION ALL SELECT 7, 'FV-DEMO-OP-007', 'debit_card', 'aprovado', 'approved', 'accredited', 1, 91.50, 'gabriela.souza.demo@farmavida.local', '***.***.777-07', NULL, NULL, '/checkout/demo/op-007', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 285 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 285 MINUTE), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 298 MINUTE), 'separacao'
  UNION ALL SELECT 8, 'FV-DEMO-OP-008', 'credit_card', 'aprovado', 'approved', 'accredited', 2, 69.70, 'helena.duarte.demo@farmavida.local', '***.***.888-08', NULL, NULL, '/checkout/demo/op-008', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 395 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 395 MINUTE), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 418 MINUTE), 'expedicao'
  UNION ALL SELECT 9, 'FV-DEMO-OP-009', 'pix', 'aprovado', 'approved', 'accredited', NULL, 69.70, 'igor.batista.demo@farmavida.local', '***.***.999-09', NULL, NULL, '/checkout/demo/op-009', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 26 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 26 HOUR), NULL, DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 27 HOUR), 'concluido'
) seq ON seq.order_number = o.order_number;

INSERT INTO prescriptions (
  public_id, order_id, customer_id, uploaded_by_user_id, validated_by_user_id,
  file_storage_path, original_filename, mime_type, file_size, file_hash,
  prescription_type, status, pharmacist_notes, rejection_reason, customer_message,
  validated_at, expires_at, received_ip, received_user_agent, created_at, updated_at
)
SELECT '25000000-0000-4000-8000-000000000003', o.id, o.customer_id, c.user_id, NULL, 'uploads/prescriptions/demo/op-003-amoxicilina.pdf', 'receita-amoxicilina-camila.pdf', 'application/pdf', 184320, SHA2('demo-prescription-op-003', 256), 'antibiotic', 'em_validacao', 'Conferir CRM, data e posologia antes da liberacao.', NULL, 'Receita em validacao farmaceutica.', NULL, DATE_ADD(CURRENT_DATE, INTERVAL 10 DAY), '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 180 MINUTE), CURRENT_TIMESTAMP
FROM orders o INNER JOIN customers c ON c.id = o.customer_id WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL
SELECT '25000000-0000-4000-8000-000000000004', o.id, o.customer_id, c.user_id, (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'uploads/prescriptions/demo/op-004-controlado.pdf', 'receita-controlado-daniel.pdf', 'application/pdf', 212480, SHA2('demo-prescription-op-004', 256), 'controlled', 'bloqueado_orientacao_farmaceutica', 'Controlado bloqueado para fluxo remoto. Orientar cliente sobre retirada presencial e conferencia documental.', 'Venda remota automatica bloqueada para item controlado.', 'Nossa equipe farmaceutica entrara em contato para orientar o atendimento presencial.', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 238 MINUTE), DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY), '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 255 MINUTE), CURRENT_TIMESTAMP
FROM orders o INNER JOIN customers c ON c.id = o.customer_id WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL
SELECT '25000000-0000-4000-8000-000000000005', o.id, o.customer_id, c.user_id, (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'uploads/prescriptions/demo/op-005-insulina.pdf', 'receita-insulina-elisa.pdf', 'application/pdf', 167936, SHA2('demo-prescription-op-005', 256), 'simple', 'liberado', 'Receita valida. Produto termossensivel liberado com orientacao de cadeia fria.', NULL, 'Receita aprovada. Entrega priorizada.', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 18 MINUTE), DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY), '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 22 MINUTE), CURRENT_TIMESTAMP
FROM orders o INNER JOIN customers c ON c.id = o.customer_id WHERE o.order_number = 'FV-DEMO-OP-005';

INSERT INTO prescription_items (prescription_id, order_item_id, product_id, product_name, active_ingredient, quantity_requested, status, pharmacist_note)
SELECT pr.id, oi.id, oi.product_id, oi.product_name, oi.active_ingredient, oi.quantity, 'pending', 'Aguardando validacao de dados obrigatorios da receita.'
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
INNER JOIN order_items oi ON oi.order_id = o.id AND oi.prescription_type = 'antibiotic'
WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL
SELECT pr.id, oi.id, oi.product_id, oi.product_name, oi.active_ingredient, oi.quantity, 'blocked', 'Venda remota bloqueada; exige orientacao farmaceutica e atendimento presencial.'
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
INNER JOIN order_items oi ON oi.order_id = o.id AND oi.is_controlled = 1
WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL
SELECT pr.id, oi.id, oi.product_id, oi.product_name, oi.active_ingredient, oi.quantity, 'approved', 'Receita conferida e liberada com orientacao de transporte refrigerado.'
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
INNER JOIN order_items oi ON oi.order_id = o.id AND oi.prescription_type = 'simple'
WHERE o.order_number = 'FV-DEMO-OP-005';

INSERT INTO prescription_audits (prescription_id, order_id, action, previous_status, new_status, actor_user_id, actor_role, ip_address, user_agent, notes, created_at)
SELECT pr.id, pr.order_id, 'uploaded', NULL, pr.status, pr.uploaded_by_user_id, 'customer', '127.0.0.1', 'seed-admin-operational-orders', 'Receita anexada durante checkout demo.', pr.created_at
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
WHERE o.order_number IN ('FV-DEMO-OP-003', 'FV-DEMO-OP-004', 'FV-DEMO-OP-005')
UNION ALL
SELECT pr.id, pr.order_id, 'validation_started', 'receita_enviada', 'em_validacao', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'pharmacist', '127.0.0.1', 'seed-admin-operational-orders', 'Validacao iniciada pela farmaceutica demo.', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 160 MINUTE)
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL
SELECT pr.id, pr.order_id, 'blocked', 'em_validacao', 'bloqueado_orientacao_farmaceutica', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'pharmacist', '127.0.0.1', 'seed-admin-operational-orders', 'Item controlado bloqueado para venda remota.', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 238 MINUTE)
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL
SELECT pr.id, pr.order_id, 'approved', 'em_validacao', 'liberado', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'pharmacist', '127.0.0.1', 'seed-admin-operational-orders', 'Receita aprovada e pedido urgente liberado.', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 18 MINUTE)
FROM prescriptions pr
INNER JOIN orders o ON o.id = pr.order_id
WHERE o.order_number = 'FV-DEMO-OP-005';

INSERT INTO order_status_history (
  order_id, previous_status, new_status, previous_payment_status, new_payment_status,
  previous_clinical_status, new_clinical_status, visible_to_customer,
  message_to_customer, internal_note, changed_by, source, ip_address, user_agent, created_at
)
SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'nao_exige_receita', 1, 'Pedido recebido e aguardando pagamento PIX.', 'Pedido demo criado para fila: pagamento pendente.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 35 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-001'
UNION ALL SELECT o.id, 'pedido_recebido', 'aguardando_pagamento', 'aguardando_pagamento', 'aguardando_pagamento', 'nao_exige_receita', 'nao_exige_receita', 1, 'Link PIX enviado ao cliente.', 'Cliente avisada sobre vencimento do PIX.', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 33 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-001'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'nao_exige_receita', 1, 'Pedido recebido.', 'Pedido demo criado para fila: pagamento aprovado.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 105 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-002'
UNION ALL SELECT o.id, 'aguardando_pagamento', 'pagamento_confirmado', 'aguardando_pagamento', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pagamento aprovado.', 'Webhook sandbox confirmou pagamento em cartao.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'payment_webhook', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 78 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-002'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'aguardando_receita', 1, 'Pedido recebido com item que exige receita.', 'Pedido demo criado para fila: receita em validacao.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 195 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL SELECT o.id, 'aguardando_pagamento', 'pagamento_confirmado', 'aguardando_pagamento', 'aprovado', 'aguardando_receita', 'receita_enviada', 1, 'Pagamento aprovado e receita recebida.', 'Receita anexada no checkout.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'payment_webhook', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 175 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL SELECT o.id, 'receita_enviada', 'receita_em_validacao', 'aprovado', 'aprovado', 'receita_enviada', 'em_validacao', 1, 'Receita em validacao farmaceutica.', 'Farmaceutica assumiu a validacao da receita.', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 160 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'aguardando_receita', 1, 'Pedido recebido com item controlado.', 'Pedido demo criado para fila: controlado bloqueado.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 270 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL SELECT o.id, 'receita_em_validacao', 'receita_rejeitada', 'aprovado', 'aprovado', 'em_validacao', 'bloqueado_orientacao_farmaceutica', 1, 'Pedido bloqueado para orientacao farmaceutica.', 'Medicamento controlado bloqueado pela politica de venda remota.', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 238 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'aguardando_receita', 1, 'Pedido urgente recebido.', 'Pedido demo criado para fila: urgente termossensivel.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 25 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL SELECT o.id, 'receita_em_validacao', 'liberado_pelo_farmaceutico', 'aprovado', 'aprovado', 'em_validacao', 'liberado', 1, 'Receita aprovada e pedido liberado.', 'Prioridade critica aplicada por necessidade do cliente e cadeia fria.', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 18 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'nao_exige_receita', 1, 'Pedido recebido.', 'Pedido demo criado para fila: problema de pagamento.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 130 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-006'
UNION ALL SELECT o.id, 'aguardando_pagamento', 'pagamento_em_analise', 'aguardando_pagamento', 'divergente', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pagamento em analise.', 'Conciliacao detectou diferenca de R$ 10,00.', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 113 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-006'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'nao_exige_receita', 1, 'Pedido recebido.', 'Pedido demo criado para fila: separacao.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 300 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-007'
UNION ALL SELECT o.id, 'pagamento_confirmado', 'em_separacao', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido em separacao.', 'Estoquista iniciou separacao e conferencia de lote.', (SELECT id FROM users WHERE email = 'estoque.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 260 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-007'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'nao_exige_receita', 1, 'Pedido recebido.', 'Pedido demo criado para fila: expedicao.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 420 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL SELECT o.id, 'conferido', 'saiu_para_entrega', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido saiu para entrega.', 'Motoboy Rafael saiu com a rota Santana.', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 32 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL SELECT o.id, NULL, 'pedido_recebido', NULL, 'aguardando_pagamento', NULL, 'nao_exige_receita', 1, 'Pedido recebido.', 'Pedido demo criado para fila: concluido.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'system', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 27 HOUR) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-009'
UNION ALL SELECT o.id, 'saiu_para_entrega', 'entregue', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido entregue.', 'Entrega confirmada pelo motoboy e recebida na portaria.', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 23 HOUR) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-009';

INSERT INTO order_status_history (
  order_id, previous_status, new_status, previous_payment_status, new_payment_status,
  previous_clinical_status, new_clinical_status, visible_to_customer,
  message_to_customer, internal_note, changed_by, source, ip_address, user_agent, created_at
)
SELECT o.id, 'aguardando_pagamento', 'pagamento_confirmado', 'aguardando_pagamento', 'aprovado', 'aguardando_receita', 'receita_enviada', 1, 'Pagamento aprovado e receita recebida.', 'Pagamento confirmado antes da analise do item controlado.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'payment_webhook', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 254 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL SELECT o.id, 'receita_enviada', 'receita_em_validacao', 'aprovado', 'aprovado', 'receita_enviada', 'em_validacao', 1, 'Receita em validacao farmaceutica.', 'Farmaceutica iniciou conferencia do documento controlado.', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 246 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL SELECT o.id, 'aguardando_pagamento', 'pagamento_confirmado', 'aguardando_pagamento', 'aprovado', 'aguardando_receita', 'receita_enviada', 1, 'Pagamento aprovado e receita recebida.', 'Pagamento PIX aprovado para pedido urgente.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'payment_webhook', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 20 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL SELECT o.id, 'pagamento_confirmado', 'receita_em_validacao', 'aprovado', 'aprovado', 'receita_enviada', 'em_validacao', 1, 'Receita em validacao farmaceutica.', 'Validacao acelerada por pedido critico termossensivel.', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 19 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL SELECT o.id, 'aguardando_pagamento', 'pagamento_confirmado', 'aguardando_pagamento', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pagamento aprovado.', 'Pagamento confirmado antes da separacao.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'payment_webhook', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 285 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-007'
UNION ALL SELECT o.id, 'aguardando_pagamento', 'pagamento_confirmado', 'aguardando_pagamento', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pagamento aprovado.', 'Pagamento confirmado e pedido liberado para separacao.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'payment_webhook', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 395 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL SELECT o.id, 'pagamento_confirmado', 'em_separacao', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido em separacao.', 'Pedido separado no estoque.', (SELECT id FROM users WHERE email = 'estoque.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 350 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL SELECT o.id, 'em_separacao', 'conferido', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido conferido.', 'Conferencia concluida e embalagem lacrada.', (SELECT id FROM users WHERE email = 'estoque.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 70 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL SELECT o.id, 'aguardando_pagamento', 'pagamento_confirmado', 'aguardando_pagamento', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pagamento aprovado.', 'Pagamento confirmado no dia anterior.', (SELECT id FROM users WHERE email = 'sistema.operacao@farmavida.local'), 'payment_webhook', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 26 HOUR) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-009'
UNION ALL SELECT o.id, 'pagamento_confirmado', 'em_separacao', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido em separacao.', 'Separacao iniciada no fechamento do turno.', (SELECT id FROM users WHERE email = 'estoque.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 25 HOUR) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-009'
UNION ALL SELECT o.id, 'em_separacao', 'conferido', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido conferido.', 'Conferencia e lacre finalizados.', (SELECT id FROM users WHERE email = 'estoque.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1470 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-009'
UNION ALL SELECT o.id, 'conferido', 'saiu_para_entrega', 'aprovado', 'aprovado', 'nao_exige_receita', 'nao_exige_receita', 1, 'Pedido saiu para entrega.', 'Pedido entregue ao motoboy com comprovante de rota.', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), 'admin', '127.0.0.1', 'seed-admin-operational-orders', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-009';

INSERT INTO order_internal_notes (order_id, note, visibility, created_by, created_at)
SELECT o.id, 'PIX vence em poucos minutos. Acionar cliente por WhatsApp se nao pagar ate a proxima checagem.', 'internal', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 28 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-001'
UNION ALL SELECT o.id, 'Pagamento aprovado. Pode seguir para separacao quando houver operador livre.', 'internal', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 70 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-002'
UNION ALL SELECT o.id, 'Validar assinatura, CRM e data da receita antes de liberar antibiotico.', 'internal', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 155 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL SELECT o.id, 'Controlado bloqueado para venda remota. Registrar orientacao e alinhar retirada presencial.', 'internal', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 232 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL SELECT o.id, 'Cliente idosa com necessidade para hoje. Entregar em embalagem termica e confirmar recebimento.', 'internal', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 17 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL SELECT o.id, 'Abrir conciliacao manual: provedor aprovou R$ 148,30, total esperado R$ 158,30.', 'internal', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 110 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-006'
UNION ALL SELECT o.id, 'Separacao em andamento. Conferir lote da dipirona e validade do protetor.', 'internal', (SELECT id FROM users WHERE email = 'estoque.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 250 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-007'
UNION ALL SELECT o.id, 'Rafael saiu com o pedido. Cliente pediu ligacao na portaria.', 'internal', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL SELECT o.id, 'Entrega concluida e nota simulada emitida para conferencia no painel.', 'internal', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 22 HOUR) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-009'
UNION ALL SELECT o.id, 'Estamos validando sua receita e avisaremos assim que a compra for liberada.', 'customer', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 150 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL SELECT o.id, 'Seu pedido foi priorizado para entrega refrigerada.', 'customer', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE) FROM orders o WHERE o.order_number = 'FV-DEMO-OP-005';

INSERT INTO delivery_assignments (order_id, delivery_person_id, status, assigned_by, assigned_at, picked_up_at, delivered_at, failure_reason, tracking_url, created_at, updated_at)
SELECT o.id, dp.id, 'assigned', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 12 MINUTE), NULL, NULL, NULL, '/admin/entrega/demo/op-005', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 12 MINUTE), CURRENT_TIMESTAMP
FROM orders o INNER JOIN delivery_people dp ON dp.name = 'Rafael Motoboy Demo'
WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL
SELECT o.id, dp.id, 'in_transit', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 48 MINUTE), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 32 MINUTE), NULL, NULL, '/admin/entrega/demo/op-008', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 48 MINUTE), CURRENT_TIMESTAMP
FROM orders o INNER JOIN delivery_people dp ON dp.name = 'Rafael Motoboy Demo'
WHERE o.order_number = 'FV-DEMO-OP-008'
UNION ALL
SELECT o.id, dp.id, 'delivered', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 26 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 23 HOUR), NULL, '/admin/entrega/demo/op-009', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 26 HOUR), CURRENT_TIMESTAMP
FROM orders o INNER JOIN delivery_people dp ON dp.name = 'Rafael Motoboy Demo'
WHERE o.order_number = 'FV-DEMO-OP-009';

INSERT INTO payment_reconciliations (payment_id, order_id, provider, provider_payment_id, expected_amount, provider_amount, expected_status, provider_status, status, notes, created_at, updated_at)
SELECT p.id, o.id, 'other', p.provider_payment_id, o.grand_total, p.amount, 'aprovado', p.status, 'amount_mismatch', 'Pagamento aprovado com valor menor que o total do pedido demo; exige ajuste manual antes de liberar.', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 108 MINUTE), CURRENT_TIMESTAMP
FROM orders o
INNER JOIN payments p ON p.order_id = o.id
WHERE o.order_number = 'FV-DEMO-OP-006';

INSERT INTO support_messages (public_id, order_id, customer_id, sender_user_id, sender_type, subject, message, channel, status, assigned_to, created_at, updated_at)
SELECT '26000000-0000-4000-8000-000000000006', o.id, o.customer_id, c.user_id, 'customer', 'Divergencia no pagamento', 'Recebi confirmacao do banco, mas o pedido ainda aparece em analise. Podem verificar?', 'whatsapp', 'waiting_admin', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 95 MINUTE), CURRENT_TIMESTAMP
FROM orders o
INNER JOIN customers c ON c.id = o.customer_id
WHERE o.order_number = 'FV-DEMO-OP-006';

INSERT INTO operation_alerts (alert_type, severity, title, message, related_type, related_id, status, assigned_to, created_at, updated_at)
SELECT 'prescription_pending', 'warning', 'Receita em validacao', 'Pedido FV-DEMO-OP-003 aguarda validacao farmaceutica antes da separacao.', 'order', o.id, 'open', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 155 MINUTE), CURRENT_TIMESTAMP
FROM orders o WHERE o.order_number = 'FV-DEMO-OP-003'
UNION ALL
SELECT 'prescription_pending', 'critical', 'Controlado bloqueado', 'Pedido FV-DEMO-OP-004 contem item controlado bloqueado para venda remota.', 'order', o.id, 'open', (SELECT id FROM users WHERE email = 'farmaceutica.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 232 MINUTE), CURRENT_TIMESTAMP
FROM orders o WHERE o.order_number = 'FV-DEMO-OP-004'
UNION ALL
SELECT 'delivery_delay', 'critical', 'Entrega urgente termossensivel', 'Pedido FV-DEMO-OP-005 deve ser expedido em embalagem termica ainda nesta janela.', 'order', o.id, 'open', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 16 MINUTE), CURRENT_TIMESTAMP
FROM orders o WHERE o.order_number = 'FV-DEMO-OP-005'
UNION ALL
SELECT 'payment_divergence', 'critical', 'Divergencia de pagamento', 'Pedido FV-DEMO-OP-006 tem pagamento aprovado com valor menor que o total esperado.', 'order', o.id, 'open', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 108 MINUTE), CURRENT_TIMESTAMP
FROM orders o WHERE o.order_number = 'FV-DEMO-OP-006';

INSERT INTO invoices (
  public_id, order_id, customer_id, invoice_number, series, access_key_simulated,
  status, environment, issued_at, pharmacy_snapshot, customer_snapshot,
  delivery_address_snapshot, products_total, delivery_fee, discount_total,
  grand_total, danfe_storage_path, xml_simulated_storage_path, issued_by,
  created_at, updated_at
)
SELECT '27000000-0000-4000-8000-000000000009', o.id, o.customer_id, 990009, '1', 'FVDEMO202605130000000000000000000000000000000009', 'emitida', 'simulated', DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 23 HOUR), JSON_OBJECT('trade_name','FarmaVida','cnpj','00.000.000/0001-00','city','Sao Paulo','state','SP'), o.customer_snapshot, o.delivery_address_snapshot, o.subtotal, o.delivery_fee, o.discount_total, o.grand_total, 'invoices/demo/danfe-fv-demo-op-009.pdf', 'invoices/demo/xml-fv-demo-op-009.xml', (SELECT id FROM users WHERE email = 'atendente.operacao@farmavida.local'), DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 23 HOUR), CURRENT_TIMESTAMP
FROM orders o
WHERE o.order_number = 'FV-DEMO-OP-009';

INSERT INTO invoice_items (
  invoice_id, order_item_id, product_id, product_name, ean, ncm, cfop,
  anvisa_registration, active_ingredient, unit, quantity, unit_price,
  discount_total, line_total, simulated_tax_info, created_at
)
SELECT inv.id, oi.id, oi.product_id, oi.product_name, oi.ean, '30049099', '5102', oi.anvisa_registration, oi.active_ingredient, 'UN', oi.quantity, oi.unit_price, oi.discount_total, oi.line_total, JSON_OBJECT('note','Tributacao simulada para demo operacional.'), inv.issued_at
FROM invoices inv
INNER JOIN orders o ON o.id = inv.order_id
INNER JOIN order_items oi ON oi.order_id = o.id
WHERE o.order_number = 'FV-DEMO-OP-009';

UPDATE customers c
INNER JOIN (
  SELECT customer_id, MAX(created_at) AS last_order_at
  FROM orders
  WHERE order_number LIKE 'FV-DEMO-OP-%'
  GROUP BY customer_id
) demo_orders ON demo_orders.customer_id = c.id
SET c.last_order_at = demo_orders.last_order_at,
    c.updated_at = CURRENT_TIMESTAMP;
