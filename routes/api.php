<?php

declare(strict_types=1);

use App\Core\Router;

/** @var Router $router */

$api = ['ApiKeyMiddleware'];

$router->get('/api/produtos', 'App\\Controllers\\Api\\ApiController@products', $api);
$router->get('/api/produtos/{id}', 'App\\Controllers\\Api\\ApiController@product', $api);
$router->post('/api/produtos', 'App\\Controllers\\Api\\ApiController@productStore', $api);
$router->put('/api/produtos/{id}', 'App\\Controllers\\Api\\ApiController@productUpdate', $api);
$router->delete('/api/produtos/{id}', 'App\\Controllers\\Api\\ApiController@productDelete', $api);

$router->get('/api/pedidos', 'App\\Controllers\\Api\\ApiController@orders', $api);
$router->get('/api/pedidos/{id}', 'App\\Controllers\\Api\\ApiController@order', $api);
$router->post('/api/pedidos', 'App\\Controllers\\Api\\ApiController@orderStore', $api);
$router->put('/api/pedidos/{id}/status', 'App\\Controllers\\Api\\ApiController@orderStatus', $api);

$router->get('/api/estoque', 'App\\Controllers\\Api\\ApiController@stock', $api);
$router->get('/api/estoque/{id}', 'App\\Controllers\\Api\\ApiController@stockProduct', $api);
$router->post('/api/estoque/movimentacao', 'App\\Controllers\\Api\\ApiController@stockMovement', $api);

$router->get('/api/clientes', 'App\\Controllers\\Api\\ApiController@customers', $api);
$router->get('/api/clientes/{id}', 'App\\Controllers\\Api\\ApiController@customer', $api);

$router->get('/api/financeiro/pagamentos', 'App\\Controllers\\Api\\ApiController@payments', $api);
$router->get('/api/financeiro/vendas', 'App\\Controllers\\Api\\ApiController@sales', $api);

$router->get('/api/nfe', 'App\\Controllers\\Api\\ApiController@invoices', $api);
$router->get('/api/nfe/{id}', 'App\\Controllers\\Api\\ApiController@invoice', $api);
