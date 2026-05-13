<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$auth = file_get_contents(dirname(__DIR__, 2) . '/app/Services/AuthService.php') ?: '';
$rate = file_get_contents(dirname(__DIR__, 2) . '/app/Middlewares/RateLimitMiddleware.php') ?: '';
$csrf = file_get_contents(dirname(__DIR__, 2) . '/app/Middlewares/CsrfMiddleware.php') ?: '';

assert_true(str_contains($auth, 'password_hash'), 'Cadastro usa password_hash.');
assert_true(str_contains($auth, 'password_verify'), 'Login usa password_verify.');
assert_true(str_contains($rate, 'login_attempts'), 'Rate limit persiste em banco.');
assert_true(str_contains($csrf, 'hash_equals'), 'CSRF usa comparacao segura.');
