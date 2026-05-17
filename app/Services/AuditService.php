<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

final class AuditService
{
    public function admin(string $module, string $action, ?string $entityType = null, ?int $entityId = null, array $before = [], array $after = []): void
    {
        $user = user();
        $branchId = $user['id_filial'] ?? null;
        if (isset($after['id_filial']) && is_numeric($after['id_filial'])) {
            $branchId = (int) $after['id_filial'];
        }
        Database::connection()->prepare('INSERT INTO admin_action_logs (admin_user_id, id_filial, action, module, entity_type, entity_id, previous_data_sanitized, new_data_sanitized, ip_address, user_agent) VALUES (:user_id, :filial, :action, :module, :entity_type, :entity_id, :before, :after, :ip, :ua)')
            ->execute([
                'user_id' => $user['id'] ?? null,
                'filial' => $branchId,
                'action' => $action,
                'module' => $module,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'before' => json_encode(sanitize_log_context($before), JSON_UNESCAPED_UNICODE),
                'after' => json_encode(sanitize_log_context($after), JSON_UNESCAPED_UNICODE),
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ]);
    }

    public function sensitive(?int $customerId, string $dataType, string $purpose, string $accessType, ?string $entityType = null, ?int $entityId = null): void
    {
        $user = user();
        Database::connection()->prepare('INSERT INTO sensitive_data_access_logs (actor_user_id, customer_id, data_type, purpose, entity_type, entity_id, access_type, ip_address, user_agent) VALUES (:actor, :customer, :data_type, :purpose, :entity_type, :entity_id, :access_type, :ip, :ua)')
            ->execute([
                'actor' => $user['id'] ?? null,
                'customer' => $customerId,
                'data_type' => $dataType,
                'purpose' => $purpose,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'access_type' => $accessType,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ]);
    }
}
