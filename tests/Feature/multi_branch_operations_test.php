<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$base = dirname(__DIR__, 2);
$migration = file_get_contents($base . '/database/migrations/018_multi_branch_operations.sql') ?: '';
$branch = file_get_contents($base . '/app/Services/BranchService.php') ?: '';
$stock = file_get_contents($base . '/app/Services/StockService.php') ?: '';
$transfers = file_get_contents($base . '/app/Services/StockTransferService.php') ?: '';
$orders = file_get_contents($base . '/app/Services/OrderService.php') ?: '';
$reports = file_get_contents($base . '/app/Services/ReportService.php') ?: '';
$auth = file_get_contents($base . '/app/Services/AuthService.php') ?: '';
$jobs = file_get_contents($base . '/app/Services/JobQueueService.php') ?: '';
$email = file_get_contents($base . '/app/Services/EmailService.php') ?: '';
$fiscal = file_get_contents($base . '/app/Services/FiscalService.php') ?: '';
$adminRoutes = file_get_contents($base . '/routes/admin.php') ?: '';
$adminController = file_get_contents($base . '/app/Controllers/Admin/DashboardController.php') ?: '';
$adminMiddleware = file_get_contents($base . '/app/Middlewares/AdminMiddleware.php') ?: '';
$transferView = file_get_contents($base . '/resources/views/admin/stock_transfers.php') ?: '';
$permissionsSeeder = file_get_contents($base . '/database/seeders/001_roles_permissions_settings.sql') ?: '';

assert_true(str_contains($migration, 'CREATE TABLE IF NOT EXISTS filiais'), 'Migration cria tabela de filiais.');
assert_true(str_contains($migration, 'CREATE TABLE IF NOT EXISTS estoque_filial'), 'Migration cria estoque por filial.');
assert_true(str_contains($migration, 'CREATE TABLE IF NOT EXISTS transferencias_estoque'), 'Migration cria tabela operacional de transferencias.');
assert_true(str_contains($migration, 'ADD COLUMN id_filial'), 'Migration adiciona id_filial nas tabelas criticas.');
assert_true(str_contains($migration, 'CREATE OR REPLACE VIEW v_stock_risk') && str_contains($migration, 'ef.id_filial'), 'Views de estoque sao segregadas por filial.');
assert_true(str_contains($branch, 'assertCanAccess'), 'BranchService bloqueia acesso cruzado entre filiais.');
assert_true(str_contains($auth, "'id_filial'"), 'Login grava id_filial na sessao.');
assert_true(str_contains($stock, 'estoque_filial') && str_contains($stock, 'id_filial'), 'StockService usa estoque_filial e id_filial.');
assert_true(str_contains($stock, 'assertCanAccess($fromBranchId)') && str_contains($stock, 'SELECT id, :filial, 0'), 'StockService transfere com permissao por origem e nao cria saldo falso.');
assert_true(str_contains($transfers, 'originBranchesForForm') && str_contains($transfers, 'actionsFor') && str_contains($transfers, 'assertCanAccess($fromBranchId)'), 'StockTransferService filtra formulario e acoes por filial.');
assert_true(str_contains($orders, 'id_filial') && str_contains($orders, 'assertCanAccess'), 'OrderService grava e valida filial do pedido.');
assert_true(str_contains($reports, 'id_filial') && str_contains($reports, 'FileCacheService'), 'Relatorios usam filtro/cache por filial.');
assert_true(str_contains($jobs, 'enviar_email') && str_contains($email, 'JobQueueService'), 'E-mails sao enfileirados em jobs.');
assert_true(str_contains($fiscal, 'homologacao_simulada') && str_contains($fiscal, 'FISCAL_API_TOKEN'), 'FiscalService usa homologacao explicita sem credenciais.');
assert_true(str_contains($adminRoutes, '/admin/estoque/transferencias') && str_contains($adminRoutes, 'stockTransferAction'), 'Rotas admin de transferencia cobrem listagem, criacao e acoes.');
assert_true(str_contains($adminController, 'flashStockTransferError') && str_contains($adminController, 'Nao foi possivel processar a transferencia'), 'Controller de transferencia usa mensagens de erro seguras.');
assert_true(str_contains($adminMiddleware, 'stock.transfers.manage') && str_contains($adminMiddleware, 'fallbackPermissions'), 'Middleware protege transferencias com permissao granular e fallback legado.');
assert_true(str_contains($permissionsSeeder, 'stock.transfers.view') && str_contains($migration, 'stock.transfers.manage'), 'Permissoes de transferencia sao semeadas e migradas.');
assert_true(str_contains($transferView, 'acoes_permitidas') && str_contains($transferView, 'solicitado_por_nome'), 'Tela de transferencia exibe historico e apenas acoes permitidas.');
