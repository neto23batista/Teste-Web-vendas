<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use PDOException;
use RuntimeException;

final class LoyaltyService
{
    private const POINTS_PER_REAL = 10;
    private const MIN_REDEEM_POINTS = 10;

    public function summary(int $customerId): array
    {
        $this->ensureAccount($customerId);
        $stmt = Database::connection()->prepare('SELECT * FROM loyalty_points WHERE customer_id = :customer LIMIT 1');
        $stmt->execute(['customer' => $customerId]);
        $points = $stmt->fetch() ?: [
            'available_points' => 0,
            'pending_points' => 0,
            'expired_points' => 0,
            'redeemed_points' => 0,
            'lifetime_points' => 0,
        ];

        $movements = Database::connection()->prepare('SELECT * FROM loyalty_movements WHERE customer_id = :customer ORDER BY created_at DESC LIMIT 50');
        $movements->execute(['customer' => $customerId]);

        $redemptions = Database::connection()->prepare('SELECT lr.*, o.order_number FROM loyalty_redemptions lr LEFT JOIN orders o ON o.id = lr.order_id WHERE lr.customer_id = :customer ORDER BY lr.created_at DESC LIMIT 30');
        $redemptions->execute(['customer' => $customerId]);

        return [
            'points' => $points,
            'movements' => $movements->fetchAll(),
            'redemptions' => $redemptions->fetchAll(),
            'rules' => [
                'points_per_real' => self::POINTS_PER_REAL,
                'min_redeem_points' => self::MIN_REDEEM_POINTS,
            ],
        ];
    }

    public function checkoutPreview(?int $customerId, float $eligibleAmount): array
    {
        if (!$customerId) {
            return ['available_points' => 0, 'max_points' => 0, 'max_discount' => 0.0, 'points_per_real' => self::POINTS_PER_REAL];
        }

        $this->ensureAccount($customerId);
        $stmt = Database::connection()->prepare('SELECT available_points FROM loyalty_points WHERE customer_id = :customer LIMIT 1');
        $stmt->execute(['customer' => $customerId]);
        $available = (int) ($stmt->fetchColumn() ?: 0);
        $maxByAmount = (int) floor(max(0.0, $eligibleAmount) * self::POINTS_PER_REAL);
        $maxPoints = $this->normalizePoints(min($available, $maxByAmount));

        return [
            'available_points' => $available,
            'max_points' => $maxPoints,
            'max_discount' => $this->discountFor($maxPoints, $eligibleAmount),
            'points_per_real' => self::POINTS_PER_REAL,
            'min_redeem_points' => self::MIN_REDEEM_POINTS,
        ];
    }

    public function previewRedemption(int $customerId, int $requestedPoints, float $eligibleAmount): array
    {
        $points = $this->normalizePoints($requestedPoints);
        if ($points <= 0) {
            return ['points' => 0, 'discount' => 0.0, 'coupon_code' => null];
        }
        if ($points < self::MIN_REDEEM_POINTS) {
            throw new RuntimeException('Resgate minimo de ' . self::MIN_REDEEM_POINTS . ' pontos.');
        }

        $checkout = $this->checkoutPreview($customerId, $eligibleAmount);
        if ($points > (int) $checkout['max_points']) {
            throw new RuntimeException('Pontos insuficientes ou desconto maior que o valor elegivel.');
        }

        return [
            'points' => $points,
            'discount' => $this->discountFor($points, $eligibleAmount),
            'coupon_code' => $this->redemptionCode($customerId, $points),
        ];
    }

    public function consumeForOrder(PDO $pdo, int $customerId, int $orderId, int $cartId, int $requestedPoints, float $eligibleAmount): array
    {
        $preview = $this->previewRedemption($customerId, $requestedPoints, $eligibleAmount);
        if ((int) $preview['points'] <= 0) {
            return $preview + ['id' => null];
        }

        $hash = hash('sha256', $customerId . '|' . $cartId . '|' . $preview['points']);
        try {
            $pdo->prepare("INSERT INTO loyalty_redemptions (customer_id, order_id, points, discount_amount, coupon_code, idempotency_key_hash, status, expires_at)
                VALUES (:customer, :order_id, :points, :discount, :coupon, :hash, 'used', DATE_ADD(NOW(), INTERVAL 30 DAY))")
                ->execute([
                    'customer' => $customerId,
                    'order_id' => $orderId,
                    'points' => $preview['points'],
                    'discount' => $preview['discount'],
                    'coupon' => $preview['coupon_code'],
                    'hash' => $hash,
                ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new RuntimeException('Este resgate de pontos ja foi processado.');
            }
            throw $exception;
        }
        $redemptionId = (int) $pdo->lastInsertId();

        $update = $pdo->prepare('UPDATE loyalty_points
            SET available_points = available_points - :points,
                redeemed_points = redeemed_points + :points,
                updated_at = NOW()
            WHERE customer_id = :customer AND available_points >= :points');
        $update->execute(['points' => $preview['points'], 'customer' => $customerId]);
        if ($update->rowCount() !== 1) {
            throw new RuntimeException('Pontos insuficientes para concluir o resgate.');
        }

        $pdo->prepare("INSERT INTO loyalty_movements (customer_id, order_id, movement_type, points, status, description, created_by, available_at)
            VALUES (:customer, :order_id, 'redeem', :points, 'used', :description, :user, NOW())")
            ->execute([
                'customer' => $customerId,
                'order_id' => $orderId,
                'points' => -1 * (int) $preview['points'],
                'description' => 'Resgate aplicado ao pedido #' . $orderId . ' (' . $preview['coupon_code'] . ')',
                'user' => user()['id'] ?? null,
            ]);

        return $preview + ['id' => $redemptionId];
    }

    public function releaseForOrder(int $orderId): void
    {
        $stmt = Database::connection()->prepare('SELECT customer_id, grand_total FROM orders WHERE id = :id AND customer_id IS NOT NULL LIMIT 1');
        $stmt->execute(['id' => $orderId]);
        $order = $stmt->fetch();
        if (!$order) {
            return;
        }
        $this->ensureAccount((int) $order['customer_id']);
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

    private function ensureAccount(int $customerId): void
    {
        Database::connection()->prepare('INSERT IGNORE INTO loyalty_points (customer_id) VALUES (:customer)')
            ->execute(['customer' => $customerId]);
    }

    private function normalizePoints(int $points): int
    {
        if ($points <= 0) {
            return 0;
        }
        return $points - ($points % self::POINTS_PER_REAL);
    }

    private function discountFor(int $points, float $eligibleAmount): float
    {
        return round(min(max(0, $points) / self::POINTS_PER_REAL, max(0.0, $eligibleAmount)), 2);
    }

    private function redemptionCode(int $customerId, int $points): string
    {
        return 'PONTOS-' . strtoupper(substr(hash('sha256', $customerId . '|' . $points . '|' . date('Ymd')), 0, 8));
    }
}
