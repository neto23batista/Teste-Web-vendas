<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';
require dirname(__DIR__, 1) . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

$root = dirname(__DIR__, 2);
$data = [];

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (($severity & (E_WARNING | E_NOTICE | E_USER_WARNING | E_USER_NOTICE)) !== 0) {
        throw new ErrorException($message, 0, $severity, $file, $line);
    }

    return false;
});

ob_start();
try {
    include $root . '/resources/views/admin/dashboard.php';
    $html = ob_get_clean();
} catch (Throwable $exception) {
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    restore_error_handler();
    throw $exception;
}
restore_error_handler();

assert_true(str_contains($html, 'Operacao FarmaVida'), 'Dashboard admin renderiza com dados vazios.');
assert_true(!str_contains($html, 'Warning'), 'Dashboard admin nao exibe warnings de chaves ausentes.');
assert_true(str_contains($html, 'dashboardSalesChart'), 'Dashboard admin preserva grafico principal.');

echo "Admin dashboard view tests passed.\n";
