<?php

declare(strict_types=1);

namespace App\Controllers\Webhook;

use App\Controllers\Controller;
use App\Core\Database;
use App\Core\Request;

final class IncomingController extends Controller
{
    public function receive(Request $request): void
    {
        $token = (string) $request->param('token');
        $hash = hash('sha256', $token);
        $stmt = Database::connection()->prepare("SELECT * FROM incoming_webhooks WHERE endpoint_token_hash = :hash AND status = 'active' LIMIT 1");
        $stmt->execute(['hash' => $hash]);
        $webhook = $stmt->fetch();
        if (!$webhook) {
            $this->json(['ok' => false, 'error' => 'Webhook invalido.'], 401);
            return;
        }

        $payload = $request->json();
        Database::connection()->prepare("INSERT INTO webhook_logs (incoming_webhook_id, direction, event_type, idempotency_key_hash, request_payload_sanitized, processing_status, attempt_count, processed_at)
            VALUES (:incoming, 'incoming', :event, :idem, :payload, 'received', 1, NOW())
            ON DUPLICATE KEY UPDATE processing_status = 'duplicate'")
            ->execute([
                'incoming' => $webhook['id'],
                'event' => (string) ($payload['event'] ?? 'external_event'),
                'idem' => hash('sha256', (string) ($payload['idempotency_key'] ?? json_encode($payload))),
                'payload' => json_encode(sanitize_log_context($payload), JSON_UNESCAPED_UNICODE),
            ]);
        Database::connection()->prepare('UPDATE incoming_webhooks SET last_received_at = NOW() WHERE id = :id')->execute(['id' => $webhook['id']]);
        $this->json(['ok' => true]);
    }
}

