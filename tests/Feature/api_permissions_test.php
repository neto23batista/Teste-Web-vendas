<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$api = file_get_contents(dirname(__DIR__, 2) . '/app/Middlewares/ApiKeyMiddleware.php') ?: '';
$routes = file_get_contents(dirname(__DIR__, 2) . '/routes/api.php') ?: '';

assert_true(str_contains($api, 'key_hash'), 'API key e validada por hash.');
assert_true(str_contains($api, 'rate_limit_per_minute'), 'API possui rate limit.');
assert_true(str_contains($routes, '/api/produtos'), 'Rotas de produtos existem.');
assert_true(str_contains($routes, '/api/pedidos'), 'Rotas de pedidos existem.');
assert_true(str_contains($routes, '/api/estoque'), 'Rotas de estoque existem.');

