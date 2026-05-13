<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use PDOException;
use RuntimeException;

final class StockService
{
    public function reserveOrDebitForOrder(int $orderId): void
    {
        Database::transaction(function (PDO $pdo) use ($orderId): void {
            try {
                $pdo->prepare("INSERT INTO stock_movement_locks (public_id, order_id, lock_key) VALUES (:public_id, :order_id, 'stock_debit')")
                    ->execute(['public_id' => uuid_v4(), 'order_id' => $orderId]);
            } catch (PDOException $exception) {
                if ($exception->getCode() === '23000') {
                    return;
                }
                throw $exception;
            }

            $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = :id');
            $stmt->execute(['id' => $orderId]);
            $items = $stmt->fetchAll();

            foreach ($items as $item) {
                $product = $pdo->prepare('SELECT current_stock, physical_location, cost_price FROM products WHERE id = :id FOR UPDATE');
                $product->execute(['id' => $item['product_id']]);
                $row = $product->fetch();
                if (!$row) {
                    throw new RuntimeException('Produto inexistente no estoque.');
                }
                $previous = (int) $row['current_stock'];
                $qty = (int) $item['quantity'];
                if ($previous < $qty) {
                    throw new RuntimeException('Estoque insuficiente para baixa.');
                }
                $final = $previous - $qty;

                $pdo->prepare('UPDATE products SET current_stock = :stock, updated_at = NOW() WHERE id = :id')
                    ->execute(['stock' => $final, 'id' => $item['product_id']]);
                $pdo->prepare("INSERT INTO stock_movements (public_id, product_id, batch_id, order_id, movement_type, reason, previous_quantity, movement_quantity, final_quantity, previous_location, unit_cost, total_cost, reference_type, reference_id, responsible_user_id)
                    VALUES (:public_id, :product_id, :batch_id, :order_id, 'saida_venda', 'Baixa automatica apos pagamento confirmado', :previous, :movement, :final, :location, :unit_cost, :total_cost, 'order', :order_ref, :user)")
                    ->execute([
                        'public_id' => uuid_v4(),
                        'product_id' => $item['product_id'],
                        'batch_id' => $item['batch_id'],
                        'order_id' => $orderId,
                        'previous' => $previous,
                        'movement' => -$qty,
                        'final' => $final,
                        'location' => $row['physical_location'],
                        'unit_cost' => $row['cost_price'],
                        'total_cost' => $row['cost_price'] !== null ? ((float) $row['cost_price'] * $qty) : null,
                        'order_ref' => $orderId,
                        'user' => user()['id'] ?? null,
                    ]);

                if ($final <= 0) {
                    $this->alert((int) $item['product_id'], 'out_of_stock', 'critical', $final, 'Produto zerado apos venda.');
                } else {
                    $minStmt = $pdo->prepare('SELECT minimum_stock FROM products WHERE id = :id');
                    $minStmt->execute(['id' => $item['product_id']]);
                    $min = (int) $minStmt->fetchColumn();
                    if ($final <= $min) {
                        $this->alert((int) $item['product_id'], 'low_stock', 'warning', $final, 'Produto abaixo do estoque minimo.');
                    }
                }
            }
        });
    }

    public function move(int $productId, int $quantity, string $type, string $reason): void
    {
        Database::transaction(function (PDO $pdo) use ($productId, $quantity, $type, $reason): void {
            $stmt = $pdo->prepare('SELECT current_stock FROM products WHERE id = :id FOR UPDATE');
            $stmt->execute(['id' => $productId]);
            $previous = (int) $stmt->fetchColumn();
            $final = $previous + $quantity;
            if ($final < 0) {
                throw new RuntimeException('Movimento deixaria estoque negativo.');
            }
            $pdo->prepare('UPDATE products SET current_stock = :stock WHERE id = :id')->execute(['stock' => $final, 'id' => $productId]);
            $pdo->prepare('INSERT INTO stock_movements (public_id, product_id, movement_type, reason, previous_quantity, movement_quantity, final_quantity, responsible_user_id) VALUES (:public_id, :product_id, :type, :reason, :previous, :movement, :final, :user)')
                ->execute(['public_id' => uuid_v4(), 'product_id' => $productId, 'type' => $type, 'reason' => $reason, 'previous' => $previous, 'movement' => $quantity, 'final' => $final, 'user' => user()['id'] ?? null]);
        });
    }

    private function alert(int $productId, string $type, string $severity, int $quantity, string $message): void
    {
        Database::connection()->prepare('INSERT INTO stock_alerts (product_id, alert_type, severity, current_quantity, message) VALUES (:product, :type, :severity, :qty, :message)')
            ->execute(['product' => $productId, 'type' => $type, 'severity' => $severity, 'qty' => $quantity, 'message' => $message]);
    }
}
