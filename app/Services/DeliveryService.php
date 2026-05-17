<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

final class DeliveryService
{
    public function calculate(string $method, array $address, float $subtotal, ?int $branchId = null): array
    {
        $branchId ??= (new BranchService())->currentId();
        if ($method === 'pickup') {
            return ['fee' => 0.0, 'estimated_minutes' => 30, 'zone' => null];
        }

        $district = trim((string) ($address['district'] ?? ''));
        $postal = only_digits((string) ($address['postal_code'] ?? ''));

        $stmt = Database::connection()->prepare("SELECT * FROM delivery_zones
            WHERE is_active = 1
              AND id_filial = :filial
              AND ((zone_type = 'district' AND district = :district) OR (zone_type = 'postal_code' AND :postal BETWEEN postal_code_start AND postal_code_end) OR zone_type = 'distance')
            ORDER BY zone_type = 'district' DESC, fee ASC
            LIMIT 1");
        $stmt->execute(['filial' => $branchId, 'district' => $district, 'postal' => $postal]);
        $zone = $stmt->fetch();
        if (!$zone) {
            return ['fee' => 0.0, 'estimated_minutes' => null, 'zone' => null, 'error' => 'Area de entrega indisponivel.'];
        }

        $fee = (float) $zone['fee'];
        if ($zone['free_shipping_minimum'] !== null && $subtotal >= (float) $zone['free_shipping_minimum']) {
            $fee = 0.0;
        }

        return ['fee' => $fee, 'estimated_minutes' => $zone['estimated_minutes'], 'zone' => $zone];
    }
}
