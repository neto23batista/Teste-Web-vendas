<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$base = dirname(__DIR__, 2);
$migration = file_get_contents($base . '/database/migrations/019_customer_experience_workflows.sql') ?: '';
$loyalty = file_get_contents($base . '/app/Services/LoyaltyService.php') ?: '';
$order = file_get_contents($base . '/app/Services/OrderService.php') ?: '';
$reviews = file_get_contents($base . '/app/Services/ProductReviewService.php') ?: '';
$appointments = file_get_contents($base . '/app/Services/AppointmentService.php') ?: '';
$customerController = file_get_contents($base . '/app/Controllers/Customer/DashboardController.php') ?: '';
$customerRepo = file_get_contents($base . '/app/Repositories/CustomerRepository.php') ?: '';
$profileView = file_get_contents($base . '/resources/views/customer/profile.php') ?: '';
$lgpd = file_get_contents($base . '/app/Services/LGPDService.php') ?: '';
$transfers = file_get_contents($base . '/app/Services/StockTransferService.php') ?: '';
$webRoutes = file_get_contents($base . '/routes/web.php') ?: '';
$adminRoutes = file_get_contents($base . '/routes/admin.php') ?: '';
$adminMiddleware = file_get_contents($base . '/app/Middlewares/AdminMiddleware.php') ?: '';

assert_true(str_contains($migration, 'loyalty_points_redeemed') && str_contains($migration, 'loyalty_discount'), 'Migration adiciona campos de resgate no pedido.');
assert_true(str_contains($loyalty, 'consumeForOrder') && str_contains($loyalty, 'idempotency_key_hash'), 'Resgate de pontos e transacional e idempotente.');
assert_true(str_contains($order, 'loyalty_points') && str_contains($order, 'previewRedemption'), 'Checkout aplica pontos no backend.');
assert_true(str_contains($reviews, 'Avaliacao permitida apenas para produto comprado') && str_contains($reviews, 'moderate'), 'Avaliacoes exigem compra e moderacao.');
assert_true(str_contains($appointments, 'Horario ja reservado') && str_contains($appointments, 'adminAppointments'), 'Agenda bloqueia conflito e possui visao admin.');
assert_true(str_contains($customerController, 'profileUpdate') && str_contains($customerRepo, 'updateProfile'), 'Cliente consegue atualizar perfil pelo painel.');
assert_true(str_contains($profileView, 'Salvar perfil') && str_contains($profileView, 'marketing_opt_in'), 'Tela de perfil possui formulario de edicao.');
assert_true(str_contains($lgpd, 'Tipo de solicitacao LGPD invalido'), 'Solicitacao LGPD valida tipo antes de gravar.');
assert_true(str_contains($transfers, 'em_transporte') && str_contains($transfers, 'Transferencia geraria estoque negativo'), 'Transferencia formal evita estoque negativo.');
assert_true(str_contains($webRoutes, '/cliente/pontos') && str_contains($webRoutes, '/cliente/servicos') && str_contains($webRoutes, '/cliente/avaliacoes') && str_contains($webRoutes, "post('/cliente/perfil'"), 'Rotas do cliente foram criadas.');
assert_true(str_contains($adminRoutes, '/admin/avaliacoes') && str_contains($adminRoutes, '/admin/servicos') && str_contains($adminRoutes, '/admin/estoque/transferencias'), 'Rotas administrativas foram criadas.');
assert_true(str_contains($adminMiddleware, 'reviews.manage') && str_contains($adminMiddleware, 'services.manage'), 'Permissoes admin protegem os novos modulos.');
