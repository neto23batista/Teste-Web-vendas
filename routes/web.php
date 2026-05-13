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

$router->get('/cliente', 'App\\Controllers\\Customer\\DashboardController@index', ['AuthMiddleware']);
$router->get('/cliente/pedidos', 'App\\Controllers\\Customer\\DashboardController@orders', ['AuthMiddleware']);
$router->get('/cliente/pedidos/{id}', 'App\\Controllers\\Customer\\DashboardController@order', ['AuthMiddleware']);
$router->get('/cliente/perfil', 'App\\Controllers\\Customer\\DashboardController@profile', ['AuthMiddleware']);
$router->get('/cliente/lgpd/exportar', 'App\\Controllers\\Customer\\DashboardController@lgpdExport', ['AuthMiddleware']);
$router->post('/cliente/lgpd/solicitar', 'App\\Controllers\\Customer\\DashboardController@lgpdRequest', ['AuthMiddleware', 'CsrfMiddleware']);

$router->post('/webhooks/mercado-pago', 'App\\Controllers\\Webhook\\MercadoPagoController@receive');
$router->post('/webhooks/incoming/{token}', 'App\\Controllers\\Webhook\\IncomingController@receive');
