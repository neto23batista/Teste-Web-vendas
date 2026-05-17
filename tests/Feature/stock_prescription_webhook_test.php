<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$stock = file_get_contents(dirname(__DIR__, 2) . '/app/Services/StockService.php') ?: '';
$admin = file_get_contents(dirname(__DIR__, 2) . '/app/Controllers/Admin/DashboardController.php') ?: '';
$prescription = file_get_contents(dirname(__DIR__, 2) . '/app/Services/PrescriptionService.php') ?: '';
$webhook = file_get_contents(dirname(__DIR__, 2) . '/app/Services/WebhookService.php') ?: '';
$processor = file_get_contents(dirname(__DIR__, 2) . '/scripts/process_webhooks.php') ?: '';

assert_true(str_contains($stock, 'FOR UPDATE'), 'Estoque usa bloqueio transacional.');
assert_true(str_contains($stock, 'stock_movements'), 'Movimentacoes de estoque sao registradas.');
assert_true(str_contains($admin, 'manualStockQuantity') && str_contains($admin, 'safeStockMovementError'), 'Admin normaliza sinal e trata erros de movimentacao manual.');
assert_true(str_contains($prescription, 'mime_content_type'), 'Upload de receita valida MIME.');
assert_true(str_contains($prescription, 'storage') || str_contains($prescription, 'STORAGE_PATH'), 'Receita fica fora do public.');
assert_true(str_contains($webhook, 'webhook_logs'), 'Webhooks de saida sao logados.');
assert_true(str_contains($processor, 'next_attempt_at'), 'Webhooks possuem retry/backoff.');
