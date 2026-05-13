<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PHPMailer\PHPMailer\PHPMailer;

final class EmailService
{
    public function queue(string $type, string $to, string $subject, string $template, array $data = [], ?int $orderId = null): void
    {
        if ($to === '') {
            return;
        }

        $stmt = Database::connection()->prepare("INSERT INTO email_logs (public_id, order_id, email_type, recipient_email, subject, template_name, provider, status, metadata)
            VALUES (:public_id, :order_id, :type, :to, :subject, :template, :provider, 'queued', :metadata)");
        $stmt->execute([
            'public_id' => uuid_v4(),
            'order_id' => $orderId,
            'type' => $type,
            'to' => $to,
            'subject' => $subject,
            'template' => $template,
            'provider' => class_exists(PHPMailer::class) ? 'phpmailer' : 'mail',
            'metadata' => json_encode(sanitize_log_context($data), JSON_UNESCAPED_UNICODE),
        ]);
        $logId = (int) Database::connection()->lastInsertId();
        $this->send($logId, $to, $subject, $template, $data);
    }

    private function send(int $logId, string $to, string $subject, string $template, array $data): void
    {
        $body = partial($template, $data);
        $sent = false;
        $error = null;

        try {
            if (class_exists(PHPMailer::class) && config('mail.host')) {
                $mail = new PHPMailer(true);
                $mail->isSMTP();
                $mail->Host = (string) config('mail.host');
                $mail->Port = (int) config('mail.port', 587);
                $mail->SMTPAuth = config('mail.username') !== '';
                $mail->Username = (string) config('mail.username', '');
                $mail->Password = (string) config('mail.password', '');
                $mail->CharSet = 'UTF-8';
                $mail->setFrom((string) config('mail.from_email'), (string) config('mail.from_name'));
                $mail->addAddress($to);
                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = $body;
                $sent = $mail->send();
            } else {
                $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
                $headers .= 'From: ' . config('mail.from_name') . ' <' . config('mail.from_email') . ">\r\n";
                $sent = @mail($to, $subject, $body, $headers);
            }
        } catch (\Throwable $exception) {
            $error = $exception->getMessage();
        }

        Database::connection()->prepare('UPDATE email_logs SET status = :status, error_message = :error, sent_at = IF(:status_for_sent = "sent", NOW(), sent_at), updated_at = NOW() WHERE id = :id')
            ->execute(['status' => $sent ? 'sent' : 'failed', 'status_for_sent' => $sent ? 'sent' : 'failed', 'error' => $error, 'id' => $logId]);
    }
}
