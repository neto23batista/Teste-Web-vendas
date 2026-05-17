<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;

final class PaymentService
{
    public function createPending(int $orderId, float $amount, string $method): int
    {
        $idempotency = hash('sha256', 'order:' . $orderId . ':amount:' . number_format($amount, 2, '.', ''));
        $orderStmt = Database::connection()->prepare('SELECT id_filial FROM orders WHERE id = :id LIMIT 1');
        $orderStmt->execute(['id' => $orderId]);
        $branchId = (int) ($orderStmt->fetchColumn() ?: (new BranchService())->currentId());
        $stmt = Database::connection()->prepare("INSERT INTO payments (public_id, order_id, id_filial, provider, environment, payment_method, idempotency_key_hash, status, amount, currency)
            VALUES (:public_id, :order_id, :filial, 'mercado_pago', :environment, :method, :idempotency, 'aguardando_pagamento', :amount, 'BRL')
            ON DUPLICATE KEY UPDATE amount = VALUES(amount), payment_method = VALUES(payment_method), updated_at = NOW()");
        $stmt->execute([
            'public_id' => uuid_v4(),
            'order_id' => $orderId,
            'filial' => $branchId,
            'environment' => $this->mercadoPagoEnvironment(),
            'method' => in_array($method, ['pix', 'credit_card', 'debit_card'], true) ? $method : 'unknown',
            'idempotency' => $idempotency,
            'amount' => $amount,
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    public function createMercadoPagoPreference(int $orderId): array
    {
        $readiness = $this->mercadoPagoReadiness();
        if (!($readiness['checkout_ready'] ?? false)) {
            return ['ok' => false, 'error' => $this->readinessUserMessage($readiness), 'readiness' => $readiness];
        }
        $token = trim((string) config('payment.mercado_pago.access_token', ''));

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            return ['ok' => false, 'error' => 'Pedido nao encontrado.'];
        }
        (new BranchService())->assertCanAccess((int) $order['id_filial']);

        $notification = $this->resolveMercadoPagoNotificationUrl();
        $payload = [
            'external_reference' => (string) $order['order_number'],
            'items' => [[
                'title' => 'Pedido FarmaVida ' . $order['order_number'],
                'quantity' => 1,
                'unit_price' => (float) $order['grand_total'],
                'currency_id' => 'BRL',
            ]],
            'back_urls' => [
                'success' => url('/pedido/' . $order['public_id']),
                'failure' => url('/pedido/' . $order['public_id']),
                'pending' => url('/pedido/' . $order['public_id']),
            ],
        ];

        if (($notification['include'] ?? false) === true) {
            $payload['notification_url'] = $notification['url'];
        } elseif (($notification['message'] ?? '') !== '') {
            app_log('info', 'Mercado Pago preference created without notification_url', [
                'mode' => $this->mercadoPagoEnvironment(),
                'reason' => $notification['message'],
                'candidate' => $notification['candidate'] ?? null,
            ]);
        }

        $result = $this->postMercadoPagoPreference($token, $payload);
        $status = $result['status'];
        $json = $result['json'];

        if ($this->isInvalidNotificationUrl($status, $json) && isset($payload['notification_url'])) {
            app_log('warning', 'Mercado Pago rejected notification_url; retrying without webhook', [
                'status' => $status,
                'notification_url' => $payload['notification_url'],
                'response' => $json,
            ]);
            unset($payload['notification_url']);
            $result = $this->postMercadoPagoPreference($token, $payload);
            $status = $result['status'];
            $json = $result['json'];
        }

        if ($status >= 200 && $status < 300 && is_array($json)) {
            $checkoutUrl = $this->mercadoPagoCheckoutUrl($json);
            $metadata = $json;
            $metadata['_farmavida'] = [
                'mode' => $this->mercadoPagoEnvironment(),
                'notification_url_used' => isset($payload['notification_url']),
                'notification_url_source' => $notification['source'] ?? null,
                'notification_url_message' => $notification['message'] ?? null,
            ];
            $pdo->prepare('UPDATE payments SET provider_preference_id = :pref, checkout_url = :url, metadata = :metadata WHERE order_id = :order_id ORDER BY id DESC LIMIT 1')
                ->execute(['pref' => $json['id'] ?? null, 'url' => $checkoutUrl, 'metadata' => json_encode($metadata), 'order_id' => $orderId]);
            return ['ok' => true, 'preference' => $json, 'checkout_url' => $checkoutUrl];
        }

        app_log('error', 'Mercado Pago preference failed', ['status' => $status, 'response' => $json, 'curl_error' => $result['curl_error']]);
        return ['ok' => false, 'error' => $this->mercadoPagoErrorMessage($status, $json, $result['curl_error'])];
    }

    public function mercadoPagoReadiness(bool $includeRemoteTokenCheck = false): array
    {
        $mode = $this->mercadoPagoMode();
        $effectiveMode = in_array($mode, ['sandbox', 'production'], true) ? $mode : 'sandbox';
        $token = trim((string) config('payment.mercado_pago.access_token', ''));
        $issues = [];
        $warnings = [];

        if (!in_array($mode, ['sandbox', 'production'], true)) {
            $issues[] = 'MERCADO_PAGO_MODE deve ser sandbox ou production.';
        }

        if ($token === '') {
            $issues[] = 'MERCADO_PAGO_ACCESS_TOKEN nao esta configurado.';
        } else {
            $tokenType = $this->classifyAccessToken($token);
            if ($effectiveMode === 'sandbox' && $tokenType === 'production') {
                $issues[] = 'Sandbox esta usando token de producao. Use o Access Token de teste da aplicacao Mercado Pago.';
            } elseif ($effectiveMode === 'production' && $tokenType === 'test') {
                $issues[] = 'Producao esta usando token de teste. Configure o Access Token produtivo.';
            } elseif ($tokenType === 'unknown') {
                $warnings[] = 'Formato do Access Token nao reconhecido; confirme que ele foi copiado completo do painel Mercado Pago.';
            }
        }

        if (!function_exists('curl_init')) {
            $issues[] = 'Extensao PHP cURL indisponivel.';
        }

        $notification = $this->resolveMercadoPagoNotificationUrl($effectiveMode);
        if (($notification['include'] ?? false) !== true && ($notification['message'] ?? '') !== '') {
            if (($notification['required'] ?? false) === true) {
                $issues[] = $notification['message'];
            } else {
                $warnings[] = $notification['message'];
            }
        }

        if ((string) config('payment.mercado_pago.webhook_secret', '') === '') {
            $warnings[] = 'MERCADO_PAGO_WEBHOOK_SECRET nao configurado; webhooks assinados serao recusados.';
        }

        if ($effectiveMode === 'sandbox') {
            $warnings[] = 'Em sandbox, pagamentos com credenciais de teste nao disparam webhooks reais; use a simulacao em Suas integracoes para testar o endpoint.';
        }

        if ($includeRemoteTokenCheck && $token !== '' && function_exists('curl_init')) {
            $remote = $this->checkMercadoPagoAccessToken();
            if (!($remote['ok'] ?? false)) {
                if (($remote['level'] ?? 'warning') === 'fail') {
                    $issues[] = (string) $remote['message'];
                } else {
                    $warnings[] = (string) $remote['message'];
                }
            }
        }

        $summary = empty($issues)
            ? (empty($warnings) ? 'Mercado Pago pronto para criar preferencias.' : implode(' ', array_slice($warnings, 0, 2)))
            : implode(' ', $issues);

        return [
            'checkout_ready' => empty($issues),
            'mode' => $effectiveMode,
            'issues' => array_values(array_unique($issues)),
            'warnings' => array_values(array_unique($warnings)),
            'summary' => $summary,
            'notification_url' => $notification,
        ];
    }

    public function checkMercadoPagoAccessToken(): array
    {
        $token = trim((string) config('payment.mercado_pago.access_token', ''));
        if ($token === '') {
            return ['ok' => false, 'level' => 'warning', 'message' => 'Access token nao configurado.'];
        }
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'level' => 'warning', 'message' => 'cURL indisponivel para validar o token no Mercado Pago.'];
        }

        $ch = curl_init('https://api.mercadolibre.com/users/me');
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
        ]);
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = json_decode((string) $response, true);
        $json = is_array($json) ? $json : null;

        if ($curlError !== '') {
            return ['ok' => false, 'level' => 'warning', 'message' => 'Nao foi possivel validar o token no Mercado Pago: falha de comunicacao.'];
        }
        if ($status >= 200 && $status < 300) {
            return ['ok' => true, 'level' => 'pass', 'message' => 'Access token aceito pela API do Mercado Pago.'];
        }
        if ($this->isInvalidAccessToken($status, $json)) {
            return ['ok' => false, 'level' => 'fail', 'message' => $this->invalidAccessTokenMessage()];
        }
        if ($this->isUnauthorizedPolicy($status, $json)) {
            return ['ok' => false, 'level' => 'fail', 'message' => $this->unauthorizedPolicyMessage()];
        }

        return ['ok' => false, 'level' => 'warning', 'message' => 'Mercado Pago respondeu HTTP ' . $status . ' ao validar o token.'];
    }

    public function handleMercadoPagoWebhook(array $query, array $payload, array $headers): array
    {
        $signature = (string) ($headers['x-signature'] ?? $headers['X-Signature'] ?? $_SERVER['HTTP_X_SIGNATURE'] ?? '');
        $requestId = (string) ($headers['x-request-id'] ?? $headers['X-Request-Id'] ?? $_SERVER['HTTP_X_REQUEST_ID'] ?? '');
        $dataId = (string) ($query['data.id'] ?? ($payload['data']['id'] ?? ''));
        $valid = $this->validateMercadoPagoSignature($signature, $requestId, $dataId);
        $eventId = (string) ($payload['id'] ?? $dataId);

        $pdo = Database::connection();
        $pdo->prepare("INSERT INTO payment_webhooks (provider, environment, event_id, topic, action, signature_header, signature_valid, request_id, headers_json, payload_json, sanitized_payload_json, processing_status, received_ip)
            VALUES ('mercado_pago', :env, :event_id, :topic, :action, :signature, :valid, :request_id, :headers, :payload, :sanitized, :status, :ip)
            ON DUPLICATE KEY UPDATE processing_status = 'duplicate'")
            ->execute([
                'env' => $this->mercadoPagoEnvironment(),
                'event_id' => $eventId ?: null,
                'topic' => $payload['type'] ?? ($query['topic'] ?? null),
                'action' => $payload['action'] ?? null,
                'signature' => $signature,
                'valid' => $valid ? 1 : 0,
                'request_id' => $requestId,
                'headers' => json_encode(sanitize_log_context($headers), JSON_UNESCAPED_UNICODE),
                'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                'sanitized' => json_encode(sanitize_log_context($payload), JSON_UNESCAPED_UNICODE),
                'status' => $valid ? 'received' : 'failed',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            ]);

        if (!$valid) {
            return ['ok' => false, 'error' => 'Assinatura invalida.'];
        }

        if ($dataId !== '') {
            $this->syncPaymentStatus($dataId);
        }

        return ['ok' => true];
    }

    public function validateMercadoPagoSignature(string $signature, string $requestId, string $dataId): bool
    {
        $secret = (string) config('payment.mercado_pago.webhook_secret', '');
        if ($secret === '' || $signature === '') {
            return false;
        }

        $parts = [];
        foreach (explode(',', $signature) as $part) {
            [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
            $parts[trim($key)] = trim($value);
        }
        $ts = $parts['ts'] ?? '';
        $hash = $parts['v1'] ?? '';
        if ($ts === '' || $hash === '') {
            return false;
        }

        $manifest = '';
        if ($dataId !== '') {
            $manifest .= 'id:' . $dataId . ';';
        }
        if ($requestId !== '') {
            $manifest .= 'request-id:' . $requestId . ';';
        }
        $manifest .= 'ts:' . $ts . ';';

        $expected = hash_hmac('sha256', $manifest, $secret);
        return hash_equals($expected, $hash);
    }

    private function syncPaymentStatus(string $providerPaymentId): void
    {
        $token = (string) config('payment.mercado_pago.access_token', '');
        if ($token === '' || !function_exists('curl_init')) {
            return;
        }

        $ch = curl_init('https://api.mercadopago.com/v1/payments/' . rawurlencode($providerPaymentId));
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ]);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $json = json_decode((string) $response, true);
        if ($status < 200 || $status >= 300 || !is_array($json)) {
            return;
        }

        $orderNumber = (string) ($json['external_reference'] ?? '');
        $mapped = $this->mapStatus((string) ($json['status'] ?? ''));
        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT id, id_filial FROM orders WHERE order_number = :number LIMIT 1');
        $stmt->execute(['number' => $orderNumber]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        $orderId = (int) ($order['id'] ?? 0);
        if ($orderId <= 0) {
            return;
        }

        $pdo->prepare('UPDATE payments SET provider_payment_id = :provider_id, status = :status, provider_status = :provider_status, provider_status_detail = :detail, metadata = :metadata, paid_at = IF(:status_for_paid = "aprovado", NOW(), paid_at), last_synced_at = NOW() WHERE order_id = :order_id ORDER BY id DESC LIMIT 1')
            ->execute(['provider_id' => $providerPaymentId, 'status' => $mapped, 'status_for_paid' => $mapped, 'provider_status' => $json['status'] ?? null, 'detail' => $json['status_detail'] ?? null, 'metadata' => json_encode($json), 'order_id' => $orderId]);

        if ($mapped === 'aprovado') {
            $pdo->prepare("UPDATE orders SET payment_status = 'aprovado', status = IF(requires_prescription = 1, status, 'pagamento_confirmado'), paid_at = NOW() WHERE id = :id")
                ->execute(['id' => $orderId]);
            (new StockService())->reserveOrDebitForOrder($orderId);
            (new LoyaltyService())->releaseForOrder($orderId);
            (new WebhookService())->dispatch('pagamento_confirmado', 'order', $orderId);
            (new FileCacheService())->forgetPrefix('dashboard', (int) $order['id_filial']);
        }
    }

    private function mapStatus(string $status): string
    {
        return match ($status) {
            'approved' => 'aprovado',
            'pending', 'in_process' => 'em_analise',
            'rejected' => 'recusado',
            'cancelled' => 'cancelado',
            'refunded', 'charged_back' => 'estornado',
            default => 'aguardando_pagamento',
        };
    }

    private function postMercadoPagoPreference(string $token, array $payload): array
    {
        $ch = curl_init('https://api.mercadopago.com/checkout/preferences');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ]);
        $response = curl_exec($ch);
        $curlError = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = json_decode((string) $response, true);
        return [
            'status' => $status,
            'json' => is_array($json) ? $json : null,
            'curl_error' => $curlError !== '' ? $curlError : null,
        ];
    }

    private function isInvalidNotificationUrl(int $status, ?array $json): bool
    {
        return $status === 400 && ($json['error'] ?? '') === 'invalid_notification_url';
    }

    private function isInvalidAccessToken(int $status, ?array $json): bool
    {
        $message = strtolower((string) ($json['message'] ?? $json['error'] ?? $json['code'] ?? ''));
        return $status === 401 && str_contains($message, 'invalid access token');
    }

    private function isUnauthorizedPolicy(int $status, ?array $json): bool
    {
        return $status === 403 && (($json['code'] ?? '') === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' || ($json['message'] ?? '') === 'At least one policy returned UNAUTHORIZED.');
    }

    private function mercadoPagoErrorMessage(int $status, ?array $json, ?string $curlError): string
    {
        if ($curlError !== null) {
            return 'Falha de comunicacao com o Mercado Pago.';
        }
        if ($this->isInvalidAccessToken($status, $json)) {
            return $this->invalidAccessTokenMessage();
        }
        if ($this->isUnauthorizedPolicy($status, $json)) {
            return $this->unauthorizedPolicyMessage();
        }
        if ($this->isInvalidNotificationUrl($status, $json)) {
            return 'Mercado Pago recusou a URL de notificacao. Em ambiente local/sandbox, deixe MERCADO_PAGO_NOTIFICATION_URL vazio para criar a preferencia sem webhook por pagamento; para webhook real, use uma URL HTTPS publica.';
        }

        $message = trim((string) ($json['message'] ?? $json['error'] ?? ''));
        if ($message !== '') {
            return 'Mercado Pago: ' . $message;
        }

        return 'Falha ao criar preferencia de pagamento.';
    }

    private function readinessUserMessage(array $readiness): string
    {
        $summary = trim((string) ($readiness['summary'] ?? ''));
        if ($summary !== '') {
            return 'Pagamento Mercado Pago indisponivel: ' . $summary;
        }
        return 'Pagamento Mercado Pago indisponivel. Confira as configuracoes da integracao.';
    }

    private function mercadoPagoMode(): string
    {
        $mode = strtolower(trim((string) config('payment.mercado_pago.mode', 'sandbox')));
        return match ($mode) {
            'prod', 'production' => 'production',
            'test', 'testing', 'sandbox' => 'sandbox',
            default => $mode,
        };
    }

    private function mercadoPagoEnvironment(): string
    {
        return $this->mercadoPagoMode() === 'production' ? 'production' : 'sandbox';
    }

    private function mercadoPagoCheckoutUrl(array $preference): ?string
    {
        if ($this->mercadoPagoEnvironment() === 'sandbox') {
            return $preference['sandbox_init_point'] ?? $preference['init_point'] ?? null;
        }

        return $preference['init_point'] ?? $preference['sandbox_init_point'] ?? null;
    }

    private function classifyAccessToken(string $token): string
    {
        if (str_starts_with($token, 'TEST-')) {
            return 'test';
        }
        if (str_starts_with($token, 'APP_USR-')) {
            return 'production';
        }
        return 'unknown';
    }

    private function resolveMercadoPagoNotificationUrl(?string $mode = null): array
    {
        $mode ??= $this->mercadoPagoEnvironment();
        $appEnv = strtolower(trim((string) config('app.env', 'local')));
        $override = trim((string) config('payment.mercado_pago.notification_url', ''));
        $candidate = $override !== '' ? $override : url('/webhooks/mercado-pago');
        $source = $override !== '' ? 'MERCADO_PAGO_NOTIFICATION_URL' : 'APP_URL';

        if ($override === '' && $appEnv === 'local') {
            return [
                'include' => false,
                'required' => false,
                'url' => null,
                'candidate' => $candidate,
                'source' => $source,
                'message' => 'Ambiente local: defina MERCADO_PAGO_NOTIFICATION_URL com HTTPS publico para enviar webhook por preferencia; sem isso o checkout sera criado sem notification_url.',
            ];
        }

        if ($override === '' && $mode === 'sandbox') {
            return [
                'include' => false,
                'required' => false,
                'url' => null,
                'candidate' => $candidate,
                'source' => $source,
                'message' => 'Sandbox: use a URL de teste em Suas integracoes do Mercado Pago ou defina MERCADO_PAGO_NOTIFICATION_URL para enviar notification_url explicitamente.',
            ];
        }

        $url = $this->appendWebhookSourceParam($candidate);
        $validation = $this->validateNotificationUrl($url);
        if (!($validation['ok'] ?? false)) {
            return [
                'include' => false,
                'required' => $mode === 'production',
                'url' => null,
                'candidate' => $candidate,
                'source' => $source,
                'message' => (string) $validation['message'],
            ];
        }

        return [
            'include' => true,
            'required' => $mode === 'production',
            'url' => $url,
            'candidate' => $candidate,
            'source' => $source,
            'message' => null,
        ];
    }

    private function appendWebhookSourceParam(string $url): string
    {
        if (str_contains($url, 'source_news=')) {
            return $url;
        }

        $fragment = '';
        $base = $url;
        $fragmentPos = strpos($url, '#');
        if ($fragmentPos !== false) {
            $fragment = substr($url, $fragmentPos);
            $base = substr($url, 0, $fragmentPos);
        }

        return $base . (str_contains($base, '?') ? '&' : '?') . 'source_news=webhooks' . $fragment;
    }

    private function validateNotificationUrl(string $url): array
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));

        if ($scheme === '' || $host === '') {
            return ['ok' => false, 'message' => 'URL de notificacao do Mercado Pago deve ser absoluta, com protocolo e host.'];
        }
        if ($scheme !== 'https') {
            return ['ok' => false, 'message' => 'URL de notificacao do Mercado Pago deve usar HTTPS publico.'];
        }
        if (in_array($host, ['localhost', '127.0.0.1', '::1'], true) || str_ends_with($host, '.local') || str_ends_with($host, '.test') || str_ends_with($host, '.invalid')) {
            return ['ok' => false, 'message' => 'URL de notificacao do Mercado Pago nao pode apontar para localhost ou dominio local.'];
        }
        if (filter_var($host, FILTER_VALIDATE_IP) !== false && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return ['ok' => false, 'message' => 'URL de notificacao do Mercado Pago deve apontar para IP publico.'];
        }

        return ['ok' => true, 'message' => null];
    }

    private function invalidAccessTokenMessage(): string
    {
        return 'Mercado Pago recusou o Access Token. Confira se MERCADO_PAGO_MODE combina com a credencial: sandbox deve usar Access Token de teste e production deve usar token produtivo ativo.';
    }

    private function unauthorizedPolicyMessage(): string
    {
        return 'Mercado Pago recusou a credencial por politica de autorizacao. Verifique se a aplicacao tem Checkout Pro habilitado, se a conta/credencial esta ativa e se o token pertence ao vendedor correto.';
    }
}
