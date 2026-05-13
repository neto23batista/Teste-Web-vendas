<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

final class WebhookService
{
    public function dispatch(string $event, string $relatedType, int $relatedId, array $payload = []): void
    {
        $stmt = Database::connection()->prepare("SELECT * FROM outgoing_webhooks WHERE event_type = :event AND status = 'active'");
        $stmt->execute(['event' => $event]);
        foreach ($stmt->fetchAll() as $webhook) {
            $body = array_merge($payload, [
                'event' => $event,
                'related_type' => $relatedType,
                'related_id' => $relatedId,
                'occurred_at' => date('c'),
            ]);
            Database::connection()->prepare("INSERT IGNORE INTO webhook_logs (webhook_id, direction, event_type, idempotency_key_hash, related_type, related_id, request_payload_sanitized, processing_status, attempt_count, next_attempt_at)
                VALUES (:webhook, 'outgoing', :event, :idem, :related_type, :related_id, :payload, 'queued', 0, NOW())")
                ->execute([
                    'webhook' => $webhook['id'],
                    'event' => $event,
                    'idem' => hash('sha256', $event . ':' . $relatedType . ':' . $relatedId . ':' . $webhook['id']),
                    'related_type' => $relatedType,
                    'related_id' => $relatedId,
                    'payload' => json_encode(sanitize_log_context($body), JSON_UNESCAPED_UNICODE),
                ]);
        }
    }
}
