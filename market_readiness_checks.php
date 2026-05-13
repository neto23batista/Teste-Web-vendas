<?php

declare(strict_types=1);

use App\Core\Database;
use App\Services\PaymentService;

require __DIR__ . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

$checks = [];

function readiness(string $name, bool $pass, string $message, string $level = 'fail'): void
{
    global $checks;
    $checks[] = ['name' => $name, 'status' => $pass ? 'pass' : $level, 'message' => $message];
}

readiness('PHP >= 8.2', version_compare(PHP_VERSION, '8.2.0', '>='), 'Versao atual: ' . PHP_VERSION);
foreach (['pdo', 'pdo_mysql', 'json', 'mbstring', 'curl', 'fileinfo', 'openssl'] as $ext) {
    readiness('Extensao ' . $ext, extension_loaded($ext), extension_loaded($ext) ? 'OK' : 'Extensao ausente.');
}

readiness('.env', is_file(__DIR__ . DIRECTORY_SEPARATOR . '.env'), 'Arquivo .env ' . (is_file(__DIR__ . DIRECTORY_SEPARATOR . '.env') ? 'encontrado' : 'nao encontrado'), 'warning');
readiness('.env.example', is_file(__DIR__ . DIRECTORY_SEPARATOR . '.env.example'), 'Arquivo de exemplo presente.');

foreach (['storage/logs', 'storage/uploads/products', 'storage/uploads/prescriptions', 'storage/uploads/invoices', 'storage/cache'] as $dir) {
    $path = __DIR__ . DIRECTORY_SEPARATOR . $dir;
    $writable = false;
    if (is_dir($path)) {
        $probe = $path . DIRECTORY_SEPARATOR . '.write-test-' . bin2hex(random_bytes(4));
        $writable = @file_put_contents($probe, 'ok') !== false;
        if ($writable) {
            @unlink($probe);
        }
    }
    readiness('Permissao ' . $dir, is_dir($path) && $writable, is_dir($path) ? 'Diretorio existe e escrita foi testada.' : 'Diretorio ausente.');
}

foreach (['storage/.htaccess', 'storage/uploads/.htaccess', 'storage/uploads/prescriptions/.htaccess', 'storage/uploads/invoices/.htaccess', 'storage/logs/.htaccess', 'public/.htaccess'] as $file) {
    readiness('Protecao ' . $file, is_file(__DIR__ . DIRECTORY_SEPARATOR . $file), 'Protecao Apache verificada.');
}

$requiredTables = ['users','customers','admins','roles','permissions','password_resets','login_attempts','lgpd_consents','products','product_images','categories','product_recommendations','product_kits','product_batches','product_expirations','carts','cart_items','abandoned_carts','orders','order_items','order_status_history','payments','payment_webhooks','stock_movements','stock_alerts','stock_inventories','prescriptions','prescription_audits','invoices','invoice_items','api_keys','api_logs','outgoing_webhooks','incoming_webhooks','webhook_logs','loyalty_points','loyalty_movements','replenishment_reminders','coupons','promotions','email_logs','admin_action_logs','sensitive_data_access_logs','settings','migrations','delivery_zones','delivery_people','support_messages'];

try {
    $pdo = Database::connection();
    readiness('Banco de dados', true, 'Conexao estabelecida.');
    foreach ($requiredTables as $table) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table');
        $stmt->execute(['table' => $table]);
        readiness('Tabela ' . $table, (bool) $stmt->fetchColumn(), 'Tabela obrigatoria.');
    }
    $pending = $pdo->query("SELECT COUNT(*) FROM migrations WHERE status <> 'ran'")->fetchColumn();
    readiness('Migrations pendentes', (int) $pending === 0, 'Pendentes/falhas: ' . (int) $pending, 'warning');
} catch (Throwable $exception) {
    readiness('Banco de dados', false, $exception->getMessage());
}

$smtpConfigured = (string) config('mail.host', '') !== '';
readiness('SMTP configurado', $smtpConfigured, $smtpConfigured ? 'Host SMTP configurado.' : 'Host SMTP nao configurado.', 'warning');
$paymentService = new PaymentService();
$mpReadiness = $paymentService->mercadoPagoReadiness();
readiness('Mercado Pago checkout', (bool) ($mpReadiness['checkout_ready'] ?? false), (string) ($mpReadiness['summary'] ?? 'Configuracao Mercado Pago indisponivel.'));
foreach ((array) ($mpReadiness['warnings'] ?? []) as $warning) {
    readiness('Mercado Pago aviso', false, (string) $warning, 'warning');
}
$mpRemoteToken = $paymentService->checkMercadoPagoAccessToken();
readiness('Mercado Pago token remoto', (bool) ($mpRemoteToken['ok'] ?? false), (string) ($mpRemoteToken['message'] ?? 'Validacao remota indisponivel.'), (($mpRemoteToken['level'] ?? 'warning') === 'fail') ? 'fail' : 'warning');
readiness('CSRF ativo', function_exists('csrf_token'), 'Helper CSRF carregado.');
readiness('UTF-8 default', strtolower(ini_get('default_charset') ?: 'utf-8') === 'utf-8', 'default_charset=' . ini_get('default_charset'), 'warning');
readiness('Templates essenciais', is_file(__DIR__ . '/resources/views/layouts/app.php') && is_file(__DIR__ . '/resources/views/store/checkout.php'), 'Views essenciais presentes.');
readiness('Rotas principais', is_file(__DIR__ . '/routes/web.php') && is_file(__DIR__ . '/routes/admin.php') && is_file(__DIR__ . '/routes/api.php'), 'Arquivos de rota presentes.');
readiness('Credenciais no frontend', !preg_match('/MERCADO_PAGO_ACCESS_TOKEN|SMTP_PASSWORD|APP_KEY/', file_get_contents(__DIR__ . '/public/assets/js/app.js') ?: ''), 'Nenhuma chave sensivel nos assets.');

$statusCode = 0;
if (PHP_SAPI === 'cli') {
    foreach ($checks as $check) {
        echo '[' . strtoupper($check['status']) . '] ' . $check['name'] . ' - ' . $check['message'] . PHP_EOL;
        if ($check['status'] === 'fail') {
            $statusCode = 1;
        }
    }
    exit($statusCode);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => !in_array('fail', array_column($checks, 'status'), true), 'checks' => $checks], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
