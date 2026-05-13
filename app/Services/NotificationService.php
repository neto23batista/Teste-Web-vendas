<?php

declare(strict_types=1);

namespace App\Services;

final class NotificationService
{
    public function orderStatus(string $email, string $status, int $orderId): void
    {
        (new EmailService())->queue('order_status', $email, 'Atualizacao do pedido FarmaVida', 'emails/order_status', ['status' => $status], $orderId);
    }
}

