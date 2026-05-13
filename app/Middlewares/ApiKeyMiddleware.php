<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use PDO;

final class ApiKeyMiddleware
{
    public function handle(Request $request): void
    {
        $raw = (string) ($_SERVER['HTTP_X_API_KEY'] ?? '');
        if ($raw === '') {
            Response::json(['ok' => false, 'error' => 'API Key obrigatoria.'], 401);
            exit;
        }

        $hash = hash('sha256', $raw);
        $pdo = Database::connection();
        $stmt = $pdo->prepare("SELECT * FROM api_keys WHERE key_hash = :hash AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1");
        $stmt->execute(['hash' => $hash]);
        $key = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$key) {
            Response::json(['ok' => false, 'error' => 'API Key invalida.'], 401);
            exit;
        }

        $scopes = json_decode((string) $key['scopes'], true);
        $scopes = is_array($scopes) ? $scopes : [];
        $required = $this->requiredScope($request);
        $writeEquivalent = str_ends_with($required ?? '', ':read') ? str_replace(':read', ':write', (string) $required) : null;
        if ($required !== null && !in_array('*', $scopes, true) && !in_array($required, $scopes, true) && ($writeEquivalent === null || !in_array($writeEquivalent, $scopes, true))) {
            Response::json(['ok' => false, 'error' => 'Escopo insuficiente para este endpoint.'], 403);
            exit;
        }

        $rate = new RateLimitMiddleware();
        $rate->hit('api', (string) $key['id'], $request, (int) ($key['rate_limit_per_minute'] ?? config('security.api_rate_limit_per_minute', 120)), 1);

        $_SERVER['FARMAVIDA_API_KEY_ID'] = (string) $key['id'];
        $pdo->prepare('UPDATE api_keys SET last_used_at = NOW() WHERE id = :id')->execute(['id' => $key['id']]);
        $requestId = uuid_v4();
        $_SERVER['FARMAVIDA_REQUEST_ID'] = $requestId;
        $pdo->prepare('INSERT INTO api_logs (api_key_id, request_id, method, endpoint, ip_address, user_agent, request_payload_sanitized, response_status) VALUES (:key_id, :request_id, :method, :endpoint, :ip, :ua, :payload, 200)')
            ->execute([
                'key_id' => $key['id'],
                'request_id' => $requestId,
                'method' => $request->method(),
                'endpoint' => $request->path(),
                'ip' => $request->ip(),
                'ua' => $request->userAgent(),
                'payload' => json_encode(sanitize_log_context($request->json() ?: $request->all()), JSON_UNESCAPED_UNICODE),
            ]);
    }

    private function requiredScope(Request $request): ?string
    {
        $path = $request->path();
        $write = in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        if (str_starts_with($path, '/api/produtos')) {
            return $write ? 'products:write' : 'products:read';
        }
        if (str_starts_with($path, '/api/pedidos')) {
            return $write ? 'orders:write' : 'orders:read';
        }
        if (str_starts_with($path, '/api/estoque')) {
            return $write ? 'stock:write' : 'stock:read';
        }
        if (str_starts_with($path, '/api/clientes')) {
            return 'customers:read';
        }
        if (str_starts_with($path, '/api/financeiro')) {
            return 'finance:read';
        }
        if (str_starts_with($path, '/api/nfe')) {
            return 'invoices:read';
        }
        return null;
    }
}
