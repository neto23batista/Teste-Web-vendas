<?php

declare(strict_types=1);

use App\Core\Router;

/** @var Router $router */

$router->get('/admin/login', 'App\\Controllers\\Auth\\AuthController@adminLoginForm');
$router->post('/admin/login', 'App\\Controllers\\Auth\\AuthController@adminLogin', ['CsrfMiddleware']);

$admin = ['AuthMiddleware', 'AdminMiddleware'];
$adminPost = ['AuthMiddleware', 'AdminMiddleware', 'CsrfMiddleware'];

$router->get('/admin', 'App\\Controllers\\Admin\\DashboardController@index', $admin);
$router->get('/admin/produtos', 'App\\Controllers\\Admin\\DashboardController@products', $admin);
$router->get('/admin/produtos/novo', 'App\\Controllers\\Admin\\DashboardController@productCreate', $admin);
$router->post('/admin/produtos', 'App\\Controllers\\Admin\\DashboardController@productStore', $adminPost);
$router->get('/admin/produtos/{id}/editar', 'App\\Controllers\\Admin\\DashboardController@productEdit', $admin);
$router->post('/admin/produtos/{id}', 'App\\Controllers\\Admin\\DashboardController@productUpdate', $adminPost);

$router->get('/admin/pedidos', 'App\\Controllers\\Admin\\DashboardController@orders', $admin);
$router->get('/admin/pedidos/{id}', 'App\\Controllers\\Admin\\DashboardController@orderShow', $admin);
$router->post('/admin/pedidos/{id}/status', 'App\\Controllers\\Admin\\DashboardController@orderStatus', $adminPost);

$router->get('/admin/clientes', 'App\\Controllers\\Admin\\DashboardController@customers', $admin);
$router->get('/admin/funcionarios', 'App\\Controllers\\Admin\\DashboardController@staff', $admin);
$router->post('/admin/funcionarios', 'App\\Controllers\\Admin\\DashboardController@staffStore', $adminPost);
$router->post('/admin/funcionarios/{id}', 'App\\Controllers\\Admin\\DashboardController@staffUpdate', $adminPost);
$router->post('/admin/funcionarios/{id}/status', 'App\\Controllers\\Admin\\DashboardController@staffStatus', $adminPost);
$router->post('/admin/funcionarios/{id}/excluir', 'App\\Controllers\\Admin\\DashboardController@staffDelete', $adminPost);

$router->get('/admin/estoque', 'App\\Controllers\\Admin\\DashboardController@stock', $admin);
$router->post('/admin/estoque/movimentar', 'App\\Controllers\\Admin\\DashboardController@stockMove', $adminPost);

$router->get('/admin/receitas', 'App\\Controllers\\Admin\\DashboardController@prescriptions', $admin);
$router->post('/admin/receitas/{id}/validar', 'App\\Controllers\\Admin\\DashboardController@prescriptionValidate', $adminPost);

$router->get('/admin/pagamentos', 'App\\Controllers\\Admin\\DashboardController@payments', $admin);
$router->get('/admin/nfe', 'App\\Controllers\\Admin\\DashboardController@invoices', $admin);
$router->post('/admin/nfe/emitir', 'App\\Controllers\\Admin\\DashboardController@invoiceIssue', $adminPost);
$router->get('/admin/nfe/{id}/danfe', 'App\\Controllers\\Admin\\DashboardController@danfe', $admin);

$router->get('/admin/relatorios', 'App\\Controllers\\Admin\\DashboardController@reports', $admin);
$router->get('/admin/integracoes', 'App\\Controllers\\Admin\\DashboardController@integrations', $admin);
$router->post('/admin/integracoes/api-key', 'App\\Controllers\\Admin\\DashboardController@apiKeyStore', $adminPost);
$router->post('/admin/integracoes/webhook-saida', 'App\\Controllers\\Admin\\DashboardController@outgoingWebhookStore', $adminPost);
$router->post('/admin/integracoes/webhook-entrada', 'App\\Controllers\\Admin\\DashboardController@incomingWebhookStore', $adminPost);
$router->get('/admin/marketing', 'App\\Controllers\\Admin\\DashboardController@marketing', $admin);
$router->post('/admin/marketing/cupons', 'App\\Controllers\\Admin\\DashboardController@couponStore', $adminPost);
$router->post('/admin/marketing/promocoes', 'App\\Controllers\\Admin\\DashboardController@promotionStore', $adminPost);
$router->post('/admin/marketing/banners', 'App\\Controllers\\Admin\\DashboardController@bannerStore', $adminPost);
$router->get('/admin/entrega', 'App\\Controllers\\Admin\\DashboardController@delivery', $admin);
$router->post('/admin/entrega/zonas', 'App\\Controllers\\Admin\\DashboardController@deliveryZoneStore', $adminPost);
$router->post('/admin/entrega/entregadores', 'App\\Controllers\\Admin\\DashboardController@deliveryPersonStore', $adminPost);
$router->get('/admin/configuracoes', 'App\\Controllers\\Admin\\DashboardController@settings', $admin);
$router->post('/admin/configuracoes/migrations', 'App\\Controllers\\Admin\\DashboardController@migrationRun', $adminPost);
$router->get('/admin/logs', 'App\\Controllers\\Admin\\DashboardController@logs', $admin);
