<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use RuntimeException;

final class NotificationService
{
    public function orderStatus(string $email, string $status, int $orderId): void
    {
        (new EmailService())->queue('order_status', $email, 'Atualizacao do pedido FarmaVida', 'emails/order_status', ['status' => $status], $orderId);
    }

    public function whatsapp(string $phone, string $event, array $payload = [], ?int $orderId = null, ?int $branchId = null): void
    {
        if (trim($phone) === '') {
            return;
        }

        Database::connection()->prepare("INSERT INTO whatsapp_logs (id_filial, order_id, recipient_phone, event_type, provider, status, payload_sanitized)
            VALUES (:filial, :order_id, :phone, :event, :provider, 'queued', :payload)")
            ->execute([
                'filial' => $branchId,
                'order_id' => $orderId,
                'phone' => $phone,
                'event' => $event,
                'provider' => (string) env_value('WHATSAPP_PROVIDER', 'not_configured'),
                'payload' => json_encode(sanitize_log_context($payload), JSON_UNESCAPED_UNICODE),
            ]);
        $logId = (int) Database::connection()->lastInsertId();

        (new JobQueueService())->enqueue('enviar_whatsapp', [
            'log_id' => $logId,
            'phone' => $phone,
            'event' => $event,
            'payload' => $payload,
        ]);
    }

    public function sendWhatsappPayload(array $payload): void
    {
        $logId = (int) ($payload['log_id'] ?? 0);
        $provider = strtolower((string) env_value('WHATSAPP_PROVIDER', ''));
        $token = (string) env_value('WHATSAPP_API_TOKEN', '');

        if ($provider === '' || $provider === 'not_configured' || $token === '') {
            Database::connection()->prepare("UPDATE whatsapp_logs SET status = 'skipped', error_message = 'WhatsApp nao configurado.', updated_at = NOW() WHERE id = :id")
                ->execute(['id' => $logId]);
            return;
        }

        throw new RuntimeException('Provedor WhatsApp configurado, mas adaptador HTTP ainda precisa ser implementado para ' . $provider . '.');
    }
}
