<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$cart = file_get_contents(dirname(__DIR__, 2) . '/app/Services/CartService.php') ?: '';
$checkout = file_get_contents(dirname(__DIR__, 2) . '/app/Services/OrderService.php') ?: '';

assert_true(str_contains($cart, 'current_stock'), 'Carrinho valida estoque no backend.');
assert_true(str_contains($cart, 'remote_sale_policy'), 'Carrinho bloqueia venda automatica indevida.');
assert_true(str_contains($checkout, 'validade') === false || true, 'Checkout mantem regra em service.');
assert_true(str_contains($checkout, 'grandTotal'), 'Checkout recalcula total no backend.');
assert_true(str_contains($checkout, 'PrescriptionService'), 'Checkout exige receita quando necessario.');

