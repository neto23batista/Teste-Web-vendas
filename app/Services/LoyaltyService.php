<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

final class LoyaltyService
{
    public function releaseForOrder(int $orderId): void
    {
        $stmt = Database::connection()->prepare('SELECT customer_id, grand_total FROM orders WHERE id = :id AND customer_id IS NOT NULL LIMIT 1');
        $stmt->execute(['id' => $orderId]);
        $order = $stmt->fetch();
        if (!$order) {
            return;
        }
        $exists = Database::connection()->prepare("SELECT COUNT(*) FROM loyalty_movements WHERE order_id = :order_id AND movement_type = 'earn'");
        $exists->execute(['order_id' => $orderId]);
        if ((int) $exists->fetchColumn() > 0) {
            return;
        }

        $points = (int) floor((float) $order['grand_total']);
        if ($points <= 0) {
            return;
        }

        Database::connection()->prepare("INSERT INTO loyalty_movements (customer_id, order_id, movement_type, points, status, description, available_at)
            VALUES (:customer, :order_id, 'earn', :points, 'available', 'Pontos liberados por compra aprovada', NOW())")
            ->execute(['customer' => $order['customer_id'], 'order_id' => $orderId, 'points' => $points]);
        Database::connection()->prepare('UPDATE loyalty_points SET available_points = available_points + :points, lifetime_points = lifetime_points + :points WHERE customer_id = :customer')
            ->execute(['points' => $points, 'customer' => $order['customer_id']]);
    }
}
