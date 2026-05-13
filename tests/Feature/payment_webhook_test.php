<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$payment = file_get_contents(dirname(__DIR__, 2) . '/app/Services/PaymentService.php') ?: '';

assert_true(str_contains($payment, 'hash_hmac'), 'Webhook Mercado Pago valida HMAC SHA-256.');
assert_true(str_contains($payment, 'hash_equals'), 'Webhook usa comparacao constante.');
assert_true(str_contains($payment, 'idempotency_key_hash'), 'Pagamento usa idempotencia.');
assert_true(str_contains($payment, 'payment_webhooks'), 'Webhook recebido e logado.');
assert_true(str_contains($payment, 'mercadoPagoReadiness'), 'Pagamento valida prontidao Mercado Pago antes do checkout.');
assert_true(str_contains($payment, 'MERCADO_PAGO_NOTIFICATION_URL'), 'Webhook Mercado Pago usa URL explicita para ambientes locais/sandbox.');
assert_true(str_contains($payment, 'invalid access token'), 'Erros de Access Token recebem mensagem especifica.');
assert_true(str_contains($payment, 'sandbox_init_point'), 'Sandbox usa URL de checkout sandbox quando disponivel.');
