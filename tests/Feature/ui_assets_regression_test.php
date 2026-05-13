<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$root = dirname(__DIR__, 2);

$publicIndex = file_get_contents($root . '/public/index.php') ?: '';
$appLayout = file_get_contents($root . '/resources/views/layouts/app.php') ?: '';
$adminLayout = file_get_contents($root . '/resources/views/layouts/admin.php') ?: '';
$globalScript = file_get_contents($root . '/public/assets/js/script.js') ?: '';
$dashboard = file_get_contents($root . '/resources/views/admin/dashboard.php') ?: '';

assert_true(str_contains($publicIndex, "PHP_SAPI === 'cli-server'"), 'Servidor local usa atalho para assets reais.');
assert_true(str_contains($publicIndex, 'return false'), 'Servidor local deixa o PHP embutido entregar CSS/JS/imagens.');

assert_true(str_contains($appLayout, '/assets/css/style.css'), 'Layout publico carrega o design system global.');
assert_true(str_contains($appLayout, '/assets/css/responsive.css'), 'Layout publico carrega CSS responsivo.');
assert_true(str_contains($appLayout, "try{document.documentElement.dataset.theme"), 'Layout publico nao quebra sem localStorage.');

assert_true(str_contains($adminLayout, '/assets/css/dashboard.css'), 'Layout admin carrega estilos de dashboard.');
assert_true(str_contains($adminLayout, '/assets/js/charts.js'), 'Layout admin carrega graficos.');
assert_true(str_contains($adminLayout, "try{document.documentElement.dataset.theme"), 'Layout admin nao quebra sem localStorage.');

assert_true(str_contains($globalScript, 'data-theme-toggle'), 'Script global controla alternancia de tema.');
assert_true(str_contains($globalScript, 'readPreference'), 'Script global le preferencias de forma segura.');
assert_true(str_contains($globalScript, 'writePreference'), 'Script global grava preferencias de forma segura.');

assert_true(str_contains($dashboard, 'dashboard-hero'), 'Dashboard admin tem cabecalho operacional.');
assert_true(str_contains($dashboard, 'dashboardSalesChart'), 'Dashboard admin tem grafico de vendas.');

echo "UI assets regression tests passed.\n";
