<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Controllers\Controller;
use App\Core\Database;
use App\Core\Request;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\ProductService;
use App\Services\StockService;
use PDO;
use RuntimeException;

final class ApiController extends Controller
{
    public function products(Request $request): void
    {
        $this->json(['ok' => true, 'data' => (new ProductService())->catalog($request->all())['products']]);
    }

    public function product(Request $request): void
    {
        $stmt = Database::connection()->prepare('SELECT * FROM products WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $request->param('id')]);
        $this->json(['ok' => true, 'data' => $stmt->fetch()]);
    }

    public function productStore(Request $request): void
    {
        $id = (new ProductService())->createFromAdmin($request->json() ?: $request->all());
        $this->json(['ok' => true, 'id' => $id], 201);
    }

    public function productUpdate(Request $request): void
    {
        (new ProductService())->updateFromAdmin((int) $request->param('id'), $request->json() ?: $request->all());
        $this->json(['ok' => true]);
    }

    public function productDelete(Request $request): void
    {
        Database::connection()->prepare('UPDATE products SET deleted_at = NOW(), is_active = 0 WHERE id = :id')->execute(['id' => $request->param('id')]);
        $this->json(['ok' => true]);
    }

    public function orders(Request $request): void
    {
        $this->json(['ok' => true, 'data' => Database::connection()->query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100')->fetchAll()]);
    }

    public function orderStore(Request $request): void
    {
        try {
            $data = $request->json();
            $items = $data['items'] ?? [];
            if (!is_array($items) || $items === []) {
                throw new RuntimeException('Itens obrigatorios.');
            }
            $orderId = Database::transaction(function (PDO $pdo) use ($data, $items): int {
                $subtotal = 0.0;
                $normalized = [];
                foreach ($items as $item) {
                    $stmt = $pdo->prepare('SELECT * FROM products WHERE id = :id AND deleted_at IS NULL AND is_active = 1 LIMIT 1 FOR UPDATE');
                    $stmt->execute(['id' => (int) ($item['product_id'] ?? 0)]);
                    $product = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$product) {
                        throw new RuntimeException('Produto invalido.');
                    }
                    $qty = max(1, (int) ($item['quantity'] ?? 1));
                    if ((int) $product['current_stock'] < $qty && (int) $product['allow_pre_sale'] !== 1) {
                        throw new RuntimeException('Estoque insuficiente para ' . $product['name']);
                    }
                    if ($product['remote_sale_policy'] === 'blocked') {
                        throw new RuntimeException('Produto bloqueado para venda automatica.');
                    }
                    $unit = $product['promotional_price'] !== null ? (float) $product['promotional_price'] : (float) $product['sale_price'];
                    $line = $unit * $qty;
                    $subtotal += $line;
                    $normalized[] = ['product' => $product, 'quantity' => $qty, 'unit' => $unit, 'line' => $line];
                }

                $orderNumber = 'API' . date('YmdHis') . random_int(100, 999);
                $hasPrescription = array_reduce($normalized, static fn (bool $carry, array $item): bool => $carry || (int) $item['product']['requires_prescription'] === 1, false);
                $pdo->prepare("INSERT INTO orders (public_id, order_number, customer_id, status, payment_status, clinical_status, delivery_method, requires_prescription, subtotal, delivery_fee, grand_total, customer_note, customer_snapshot, delivery_address_snapshot, created_ip, created_user_agent)
                    VALUES (:public_id, :number, :customer_id, :status, 'aguardando_pagamento', :clinical, :delivery, :requires, :subtotal, :delivery_fee, :total, :note, :customer, :address, :ip, :ua)")
                    ->execute([
                        'public_id' => uuid_v4(),
                        'number' => $orderNumber,
                        'customer_id' => $data['customer_id'] ?? null,
                        'status' => $hasPrescription ? 'aguardando_receita' : 'aguardando_pagamento',
                        'clinical' => $hasPrescription ? 'aguardando_receita' : 'nao_exige_receita',
                        'delivery' => $data['delivery_method'] ?? 'pickup',
                        'requires' => $hasPrescription ? 1 : 0,
                        'subtotal' => $subtotal,
                        'delivery_fee' => (float) ($data['delivery_fee'] ?? 0),
                        'total' => $subtotal + (float) ($data['delivery_fee'] ?? 0),
                        'note' => $data['customer_note'] ?? null,
                        'customer' => json_encode(sanitize_log_context($data['customer'] ?? []), JSON_UNESCAPED_UNICODE),
                        'address' => json_encode(sanitize_log_context($data['address'] ?? []), JSON_UNESCAPED_UNICODE),
                        'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                        'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
                    ]);
                $orderId = (int) $pdo->lastInsertId();
                foreach ($normalized as $item) {
                    $p = $item['product'];
                    $pdo->prepare("INSERT INTO order_items (order_id, product_id, product_name, product_sku, ean, active_ingredient, anvisa_registration, quantity, unit_price, promotional_unit_price, line_total, cost_unit_price, requires_prescription, prescription_type, is_controlled, is_thermosensitive, product_snapshot)
                        VALUES (:order, :product, :name, :sku, :ean, :active, :anvisa, :qty, :unit, :promo, :line, :cost, :requires, :type, :controlled, :thermo, :snapshot)")
                        ->execute([
                            'order' => $orderId,
                            'product' => $p['id'],
                            'name' => $p['name'],
                            'sku' => $p['sku'],
                            'ean' => $p['ean'],
                            'active' => $p['active_ingredient'],
                            'anvisa' => $p['anvisa_registration'],
                            'qty' => $item['quantity'],
                            'unit' => $p['sale_price'],
                            'promo' => $p['promotional_price'],
                            'line' => $item['line'],
                            'cost' => $p['cost_price'],
                            'requires' => $p['requires_prescription'],
                            'type' => $p['prescription_type'],
                            'controlled' => in_array($p['prescription_type'], ['controlled', 'psychotropic'], true) ? 1 : 0,
                            'thermo' => $p['is_thermosensitive'],
                            'snapshot' => json_encode(sanitize_log_context($p), JSON_UNESCAPED_UNICODE),
                        ]);
                }
                $pdo->prepare('INSERT INTO order_status_history (order_id, new_status, source, message_to_customer) VALUES (:order, :status, "api", "Pedido criado via API.")')
                    ->execute(['order' => $orderId, 'status' => $hasPrescription ? 'aguardando_receita' : 'aguardando_pagamento']);
                return $orderId;
            });
            (new PaymentService())->createPending($orderId, (float) Database::connection()->query('SELECT grand_total FROM orders WHERE id = ' . (int) $orderId)->fetchColumn(), (string) ($data['payment_method'] ?? 'pix'));
            $this->json(['ok' => true, 'id' => $orderId], 201);
        } catch (\Throwable $exception) {
            $this->json(['ok' => false, 'error' => $exception->getMessage()], 422);
        }
    }

    public function order(Request $request): void
    {
        $stmt = Database::connection()->prepare('SELECT * FROM orders WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $request->param('id')]);
        $this->json(['ok' => true, 'data' => $stmt->fetch()]);
    }

    public function orderStatus(Request $request): void
    {
        $data = $request->json() ?: $request->all();
        (new OrderService())->updateStatus((int) $request->param('id'), (string) ($data['status'] ?? 'pedido_recebido'), (string) ($data['message'] ?? ''));
        $this->json(['ok' => true]);
    }

    public function stock(Request $request): void
    {
        $this->json(['ok' => true, 'data' => Database::connection()->query('SELECT * FROM v_stock_risk')->fetchAll()]);
    }

    public function stockProduct(Request $request): void
    {
        $stmt = Database::connection()->prepare('SELECT * FROM v_stock_risk WHERE product_id = :id LIMIT 1');
        $stmt->execute(['id' => $request->param('id')]);
        $this->json(['ok' => true, 'data' => $stmt->fetch()]);
    }

    public function stockMovement(Request $request): void
    {
        $data = $request->json() ?: $request->all();
        (new StockService())->move((int) $data['product_id'], (int) $data['quantity'], (string) $data['movement_type'], (string) $data['reason']);
        $this->json(['ok' => true], 201);
    }

    public function customers(Request $request): void
    {
        $this->json(['ok' => true, 'data' => Database::connection()->query('SELECT c.id, u.name, u.email, c.cpf_masked, c.account_status, c.created_at FROM customers c INNER JOIN users u ON u.id = c.user_id LIMIT 100')->fetchAll()]);
    }

    public function customer(Request $request): void
    {
        $stmt = Database::connection()->prepare('SELECT c.id, u.name, u.email, c.cpf_masked, c.account_status, c.created_at FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE c.id = :id LIMIT 1');
        $stmt->execute(['id' => $request->param('id')]);
        $this->json(['ok' => true, 'data' => $stmt->fetch()]);
    }

    public function payments(Request $request): void
    {
        $this->json(['ok' => true, 'data' => Database::connection()->query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 100')->fetchAll()]);
    }

    public function sales(Request $request): void
    {
        $this->json(['ok' => true, 'data' => Database::connection()->query('SELECT * FROM v_daily_revenue ORDER BY sale_date DESC LIMIT 100')->fetchAll()]);
    }

    public function invoices(Request $request): void
    {
        $this->json(['ok' => true, 'data' => Database::connection()->query('SELECT * FROM invoices ORDER BY issued_at DESC LIMIT 100')->fetchAll()]);
    }

    public function invoice(Request $request): void
    {
        $stmt = Database::connection()->prepare('SELECT * FROM invoices WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $request->param('id')]);
        $this->json(['ok' => true, 'data' => $stmt->fetch()]);
    }
}
