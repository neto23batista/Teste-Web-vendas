<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use DateTimeInterface;
use PDO;
use Throwable;

final class JobQueueService
{
    private const MAX_ATTEMPTS = 5;

    public function enqueue(string $type, array $payload, ?DateTimeInterface $runAt = null): int
    {
        $stmt = Database::connection()->prepare("INSERT INTO jobs (tipo, payload, status, executar_em)
            VALUES (:tipo, :payload, 'pendente', :executar_em)");
        $stmt->execute([
            'tipo' => $type,
            'payload' => json_encode(sanitize_log_context($payload), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'executar_em' => $runAt ? $runAt->format('Y-m-d H:i:s') : date('Y-m-d H:i:s'),
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    public function process(int $limit = 25): array
    {
        $limit = max(1, min(100, $limit));
        $pdo = Database::connection();
        $stmt = $pdo->prepare("SELECT * FROM jobs
            WHERE status IN ('pendente','falhou')
              AND executar_em <= NOW()
              AND tentativas < :max_attempts
            ORDER BY executar_em, id
            LIMIT :limit");
        $stmt->bindValue(':max_attempts', self::MAX_ATTEMPTS, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $result = ['processed' => 0, 'failed' => 0];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $job) {
            $this->processOne($job, $result);
        }
        return $result;
    }

    private function processOne(array $job, array &$result): void
    {
        $pdo = Database::connection();
        $payload = json_decode((string) $job['payload'], true);
        $payload = is_array($payload) ? $payload : [];
        $attempt = (int) $job['tentativas'] + 1;

        $pdo->prepare("UPDATE jobs SET status = 'processando', tentativas = :attempt, atualizado_em = NOW() WHERE id = :id")
            ->execute(['attempt' => $attempt, 'id' => $job['id']]);

        try {
            match ((string) $job['tipo']) {
                'enviar_email' => (new EmailService())->sendQueuedPayload($payload),
                'enviar_whatsapp' => (new NotificationService())->sendWhatsappPayload($payload),
                'processar_webhook' => (new WebhookService())->dispatchQueuedPayload($payload),
                'emitir_nfe' => (new FiscalService())->issue((int) ($payload['order_id'] ?? 0)),
                default => app_log('warning', 'Unknown job type skipped', ['job_id' => $job['id'], 'type' => $job['tipo']]),
            };

            $pdo->prepare("UPDATE jobs SET status = 'concluido', erro = NULL, atualizado_em = NOW() WHERE id = :id")
                ->execute(['id' => $job['id']]);
            $result['processed']++;
        } catch (Throwable $exception) {
            $next = date('Y-m-d H:i:s', time() + min(3600, 60 * (2 ** min($attempt, 6))));
            $status = $attempt >= self::MAX_ATTEMPTS ? 'falhou' : 'pendente';
            $pdo->prepare('UPDATE jobs SET status = :status, erro = :error, executar_em = :next, atualizado_em = NOW() WHERE id = :id')
                ->execute([
                    'status' => $status,
                    'error' => $exception->getMessage(),
                    'next' => $next,
                    'id' => $job['id'],
                ]);
            $result['failed']++;
        }
    }
}
