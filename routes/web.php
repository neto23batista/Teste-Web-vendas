<?php

declare(strict_types=1);

use App\Core\Router;

/** @var Router $router */

$router->get('/', 'StoreController@home');
$router->get('/catalogo', 'StoreController@catalog');
$router->get('/busca/autocomplete', 'StoreController@autocomplete');
$router->get('/produto/{slug}', 'StoreController@product');
$router->get('/farmacia', 'StoreController@institutional');
$router->get('/privacidade', 'StoreController@privacy');
$router->get('/termos', 'StoreController@terms');
$router->get('/faq-clinico', 'StoreController@clinicalFaq');

$router->get('/login', 'App\\Controllers\\Auth\\AuthController@loginForm');
$router->post('/login', 'App\\Controllers\\Auth\\AuthController@login', ['CsrfMiddleware']);
$router->get('/cadastro', 'App\\Controllers\\Auth\\AuthController@registerForm');
$router->post('/cadastro', 'App\\Controllers\\Auth\\AuthController@register', ['CsrfMiddleware']);
$router->get('/esqueci-senha', 'App\\Controllers\\Auth\\AuthController@forgotForm');
$router->post('/esqueci-senha', 'App\\Controllers\\Auth\\AuthController@forgot', ['CsrfMiddleware']);
$router->get('/redefinir-senha', 'App\\Controllers\\Auth\\AuthController@resetForm');
$router->post('/redefinir-senha', 'App\\Controllers\\Auth\\AuthController@reset', ['CsrfMiddleware']);
$router->post('/logout', 'App\\Controllers\\Auth\\AuthController@logout', ['CsrfMiddleware']);

$router->get('/sacola', 'CartController@show');
$router->post('/sacola/adicionar', 'CartController@add', ['CsrfMiddleware']);
$router->post('/sacola/atualizar', 'CartController@update', ['CsrfMiddleware']);
$router->post('/sacola/remover', 'CartController@remove', ['CsrfMiddleware']);

$router->get('/checkout', 'CheckoutController@show');
$router->post('/checkout', 'CheckoutController@process', ['CsrfMiddleware', 'RateLimitMiddleware']);

$router->get('/pedido/{public_id}', 'OrderTrackingController@show');
$router->get('/pedido/{public_id}/status', 'OrderTrackingController@status');
$router->post('/pagamento/mercado-pago/{public_id}', 'PaymentController@mercadoPago', ['CsrfMiddleware']);

$customer = ['AuthMiddleware', 'CustomerMiddleware'];
$customerPost = ['AuthMiddleware', 'CustomerMiddleware', 'CsrfMiddleware'];

$router->get('/cliente', 'App\\Controllers\\Customer\\DashboardController@index', $customer);
$router->get('/cliente/pedidos', 'App\\Controllers\\Customer\\DashboardController@orders', $customer);
$router->get('/cliente/pedidos/{id}', 'App\\Controllers\\Customer\\DashboardController@order', $customer);
$router->post('/cliente/avaliacoes', 'App\\Controllers\\Customer\\DashboardController@reviewStore', $customerPost);
$router->get('/cliente/pontos', 'App\\Controllers\\Customer\\DashboardController@loyalty', $customer);
$router->get('/cliente/servicos', 'App\\Controllers\\Customer\\DashboardController@services', $customer);
$router->post('/cliente/servicos', 'App\\Controllers\\Customer\\DashboardController@serviceSchedule', $customerPost);
$router->get('/cliente/perfil', 'App\\Controllers\\Customer\\DashboardController@profile', $customer);
$router->post('/cliente/perfil', 'App\\Controllers\\Customer\\DashboardController@profileUpdate', $customerPost);
$router->get('/cliente/lgpd/exportar', 'App\\Controllers\\Customer\\DashboardController@lgpdExport', $customer);
$router->post('/cliente/lgpd/solicitar', 'App\\Controllers\\Customer\\DashboardController@lgpdRequest', $customerPost);

$router->post('/webhooks/mercado-pago', 'App\\Controllers\\Webhook\\MercadoPagoController@receive');
$router->post('/webhooks/incoming/{token}', 'App\\Controllers\\Webhook\\IncomingController@receive');
