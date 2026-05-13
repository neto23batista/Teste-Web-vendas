<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use RuntimeException;

final class InvoiceService
{
    public function issue(int $orderId): int
    {
        return (int) Database::transaction(function (PDO $pdo) use ($orderId): int {
            $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                throw new RuntimeException('Pedido nao encontrado.');
            }

            $sequence = $pdo->query("SELECT * FROM invoice_sequences WHERE series = '1' AND environment = 'simulated' FOR UPDATE")->fetch(PDO::FETCH_ASSOC);
            if (!$sequence) {
                $pdo->exec("INSERT INTO invoice_sequences (series, current_number, environment) VALUES ('1', 0, 'simulated')");
                $sequence = ['current_number' => 0];
            }
            $number = (int) $sequence['current_number'] + 1;
            $pdo->prepare("UPDATE invoice_sequences SET current_number = :number WHERE series = '1' AND environment = 'simulated'")->execute(['number' => $number]);

            $pharmacy = $pdo->query('SELECT * FROM pharmacy_profiles WHERE is_active = 1 ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC) ?: [];
            $accessKey = $this->simulatedAccessKey($number);
            $pdo->prepare("INSERT INTO invoices (public_id, order_id, customer_id, invoice_number, series, access_key_simulated, status, pharmacy_snapshot, customer_snapshot, delivery_address_snapshot, products_total, delivery_fee, discount_total, grand_total, issued_by)
                VALUES (:public_id, :order_id, :customer_id, :number, '1', :key, 'emitida', :pharmacy, :customer, :address, :products, :delivery, :discount, :total, :user)")
                ->execute([
                    'public_id' => uuid_v4(),
                    'order_id' => $orderId,
                    'customer_id' => $order['customer_id'],
                    'number' => $number,
                    'key' => $accessKey,
                    'pharmacy' => json_encode(sanitize_log_context($pharmacy), JSON_UNESCAPED_UNICODE),
                    'customer' => $order['customer_snapshot'],
                    'address' => $order['delivery_address_snapshot'],
                    'products' => $order['subtotal'],
                    'delivery' => $order['delivery_fee'],
                    'discount' => $order['discount_total'],
                    'total' => $order['grand_total'],
                    'user' => user()['id'] ?? null,
                ]);
            $invoiceId = (int) $pdo->lastInsertId();

            $items = $pdo->prepare('SELECT * FROM order_items WHERE order_id = :id');
            $items->execute(['id' => $orderId]);
            foreach ($items->fetchAll(PDO::FETCH_ASSOC) as $item) {
                $pdo->prepare('INSERT INTO invoice_items (invoice_id, order_item_id, product_id, product_name, ean, anvisa_registration, active_ingredient, quantity, unit_price, discount_total, line_total, simulated_tax_info) VALUES (:invoice, :order_item, :product, :name, :ean, :anvisa, :active, :qty, :unit, :discount, :line, :tax)')
                    ->execute([
                        'invoice' => $invoiceId,
                        'order_item' => $item['id'],
                        'product' => $item['product_id'],
                        'name' => $item['product_name'],
                        'ean' => $item['ean'],
                        'anvisa' => $item['anvisa_registration'],
                        'active' => $item['active_ingredient'],
                        'qty' => $item['quantity'],
                        'unit' => $item['unit_price'],
                        'discount' => $item['discount_total'],
                        'line' => $item['line_total'],
                        'tax' => json_encode(['notice' => 'NF-e simulada sem valor fiscal.'], JSON_UNESCAPED_UNICODE),
                    ]);
            }

            (new WebhookService())->dispatch('nfe_emitida', 'invoice', $invoiceId);
            return $invoiceId;
        });
    }

    public function cancel(int $invoiceId, string $reason): void
    {
        Database::connection()->prepare("UPDATE invoices SET status = 'cancelada', cancel_reason = :reason, cancelled_by = :user, cancelled_at = NOW() WHERE id = :id")
            ->execute(['reason' => $reason, 'user' => user()['id'] ?? null, 'id' => $invoiceId]);
    }

    private function simulatedAccessKey(int $number): string
    {
        return 'SIM' . date('Ymd') . str_pad((string) $number, 12, '0', STR_PAD_LEFT) . random_int(100000, 999999);
    }
}

