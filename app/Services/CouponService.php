<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

final class CouponService
{
    public function apply(?string $code, float $subtotal, float $deliveryFee): array
    {
        if (!$code) {
            return ['discount' => 0.0, 'delivery_discount' => 0.0, 'coupon' => null];
        }

        $stmt = Database::connection()->prepare("SELECT * FROM coupons WHERE code = :code AND status = 'active' AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW()) LIMIT 1");
        $stmt->execute(['code' => strtoupper(trim($code))]);
        $coupon = $stmt->fetch();
        if (!$coupon || ($coupon['minimum_order_value'] !== null && $subtotal < (float) $coupon['minimum_order_value'])) {
            return ['discount' => 0.0, 'delivery_discount' => 0.0, 'coupon' => null];
        }

        $discount = 0.0;
        $deliveryDiscount = 0.0;
        if ($coupon['discount_type'] === 'percent') {
            $discount = $subtotal * ((float) $coupon['discount_value'] / 100);
            if ($coupon['max_discount_value'] !== null) {
                $discount = min($discount, (float) $coupon['max_discount_value']);
            }
        } elseif ($coupon['discount_type'] === 'fixed') {
            $discount = min($subtotal, (float) $coupon['discount_value']);
        } elseif ($coupon['discount_type'] === 'free_shipping') {
            $deliveryDiscount = $deliveryFee;
        }

        return ['discount' => round($discount, 2), 'delivery_discount' => round($deliveryDiscount, 2), 'coupon' => $coupon];
    }
}

