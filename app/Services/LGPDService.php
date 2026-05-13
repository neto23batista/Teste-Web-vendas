<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

final class LGPDService
{
    public function exportCustomerData(int $customerId): array
    {
        $db = Database::connection();
        $data = [];
        foreach (['customers', 'customer_addresses', 'orders', 'loyalty_points', 'loyalty_movements', 'lgpd_consents'] as $table) {
            $column = $table === 'customers' ? 'id' : 'customer_id';
            $stmt = $db->prepare("SELECT * FROM {$table} WHERE {$column} = :id");
            $stmt->execute(['id' => $customerId]);
            $data[$table] = sanitize_log_context($stmt->fetchAll());
        }
        (new AuditService())->sensitive($customerId, 'lgpd_export', 'Exportacao solicitada pelo titular', 'export', 'customer', $customerId);
        return $data;
    }

    public function request(int $customerId, string $type, string $description): void
    {
        Database::connection()->prepare('INSERT INTO lgpd_requests (public_id, customer_id, request_type, requested_by_user_id, description, due_at) VALUES (:public_id, :customer, :type, :user, :description, DATE_ADD(NOW(), INTERVAL 15 DAY))')
            ->execute(['public_id' => uuid_v4(), 'customer' => $customerId, 'type' => $type, 'user' => user()['id'] ?? null, 'description' => $description]);
    }
}

