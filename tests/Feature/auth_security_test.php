<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$auth = file_get_contents(dirname(__DIR__, 2) . '/app/Services/AuthService.php') ?: '';
$authMiddleware = file_get_contents(dirname(__DIR__, 2) . '/app/Middlewares/AuthMiddleware.php') ?: '';
$customerMiddleware = file_get_contents(dirname(__DIR__, 2) . '/app/Middlewares/CustomerMiddleware.php') ?: '';
$rate = file_get_contents(dirname(__DIR__, 2) . '/app/Middlewares/RateLimitMiddleware.php') ?: '';
$csrf = file_get_contents(dirname(__DIR__, 2) . '/app/Middlewares/CsrfMiddleware.php') ?: '';
$routes = file_get_contents(dirname(__DIR__, 2) . '/routes/web.php') ?: '';
$layout = file_get_contents(dirname(__DIR__, 2) . '/resources/views/layouts/app.php') ?: '';

assert_true(str_contains($auth, 'password_hash'), 'Cadastro usa password_hash.');
assert_true(str_contains($auth, 'password_verify'), 'Login usa password_verify.');
assert_true(str_contains($auth, "user['user_type'] !== 'customer'") && str_contains($auth, 'Session::forget(\'customer_id\')'), 'Login publico aceita apenas clientes e limpa contexto de sessao.');
assert_true(str_contains($auth, 'session_version'), 'Sessao guarda versao para invalidacao segura.');
assert_true(str_contains($authMiddleware, '/admin/login') && str_contains($authMiddleware, 'sessionIsCurrent'), 'Middleware de autenticacao redireciona admin corretamente e valida sessao atual.');
assert_true(str_contains($customerMiddleware, "user_type'] ?? '') === 'customer'") && str_contains($routes, 'CustomerMiddleware'), 'Area do cliente exige middleware especifico de cliente.');
assert_true(str_contains($rate, 'login_attempts'), 'Rate limit persiste em banco.');
assert_true(str_contains($rate, 'Session::flash') && str_contains($rate, '/admin/login'), 'Rate limit preserva UX de formularios HTML.');
assert_true(str_contains($csrf, 'hash_equals'), 'CSRF usa comparacao segura.');
assert_true(str_contains($layout, '$isCustomerUser') && str_contains($layout, '$isAdminUser'), 'Layout publico separa navegacao de cliente e admin.');
