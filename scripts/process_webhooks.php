<?php

declare(strict_types=1);

use App\Core\Database;

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

if (!function_exists('curl_init')) {
    echo "Extensao cURL indisponivel.\n";
    exit(1);
}

$pdo = Database::connection();
$stmt = $pdo->query("SELECT wl.*, ow.target_url, ow.secret_hash, ow.timeout_seconds, ow.max_attempts
    FROM webhook_logs wl
    INNER JOIN outgoing_webhooks ow ON ow.id = wl.webhook_id
    WHERE wl.direction = 'outgoing'
      AND wl.processing_status IN ('queued','failed')
      AND (wl.next_attempt_at IS NULL OR wl.next_attempt_at <= NOW())
      AND wl.attempt_count < ow.max_attempts
    ORDER BY wl.created_at
    LIMIT 25");

foreach ($stmt->fetchAll() as $job) {
    $attempt = (int) $job['attempt_count'] + 1;
    $payload = (string) $job['request_payload_sanitized'];
    $headers = ['Content-Type: application/json'];
    if (!empty($job['secret_hash'])) {
        $headers[] = 'X-FarmaVida-Signature: ' . hash_hmac('sha256', $payload, (string) $job['secret_hash']);
    }

    $ch = curl_init((string) $job['target_url']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => (int) $job['timeout_seconds'],
    ]);
    $start = microtime(true);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch) ?: null;
    curl_close($ch);
    $elapsed = (int) round((microtime(true) - $start) * 1000);
    $success = $status >= 200 && $status < 300;
    $next = $success ? null : date('Y-m-d H:i:s', time() + min(3600, 60 * (2 ** min($attempt, 6))));

    $pdo->prepare('INSERT INTO webhook_delivery_attempts (webhook_log_id, attempt_number, request_headers, request_body_sanitized, response_status, response_body_sanitized, response_time_ms, error_message) VALUES (:log, :attempt, :headers, :body, :status, :response, :ms, :error)')
        ->execute(['log' => $job['id'], 'attempt' => $attempt, 'headers' => json_encode($headers), 'body' => $payload, 'status' => $status ?: null, 'response' => json_encode(sanitize_log_context(['body' => substr((string) $response, 0, 2000)])), 'ms' => $elapsed, 'error' => $error]);

    $pdo->prepare('UPDATE webhook_logs SET processing_status = :status, attempt_count = :attempt, next_attempt_at = :next, response_status = :response_status, response_payload_sanitized = :response, error_message = :error, processed_at = NOW() WHERE id = :id')
        ->execute(['status' => $success ? 'sent' : (((int) $job['max_attempts'] <= $attempt) ? 'dead_letter' : 'failed'), 'attempt' => $attempt, 'next' => $next, 'response_status' => $status ?: null, 'response' => json_encode(sanitize_log_context(['body' => substr((string) $response, 0, 2000)])), 'error' => $error, 'id' => $job['id']]);

    echo ($success ? 'SENT ' : 'FAILED ') . $job['id'] . PHP_EOL;
}
