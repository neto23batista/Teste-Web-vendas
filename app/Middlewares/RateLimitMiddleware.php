<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

final class RateLimitMiddleware
{
    public function handle(Request $request): void
    {
        $this->hit('checkout', session_id(), $request, (int) config('security.checkout_rate_limit_per_minute', 10), 1);
    }

    public function hit(string $context, string $identifier, Request $request, int $maxAttempts, int $windowMinutes): void
    {
        $pdo = Database::connection();
        $ip = $request->ip();
        $stmt = $pdo->prepare('SELECT * FROM login_attempts WHERE context = :context AND identifier = :identifier AND ip_address = :ip LIMIT 1');
        $stmt->execute(['context' => $context, 'identifier' => $identifier, 'ip' => $ip]);
        $row = $stmt->fetch();

        if ($row && $row['locked_until'] !== null && strtotime((string) $row['locked_until']) > time()) {
            $this->deny($context, $request, 'Muitas tentativas. Aguarde antes de tentar novamente.');
        }

        if (!$row) {
            $pdo->prepare('INSERT INTO login_attempts (context, identifier, ip_address, attempts, first_attempt_at, last_attempt_at, user_agent) VALUES (:context, :identifier, :ip, 1, NOW(), NOW(), :ua)')
                ->execute(['context' => $context, 'identifier' => $identifier, 'ip' => $ip, 'ua' => $request->userAgent()]);
            return;
        }

        $first = strtotime((string) $row['first_attempt_at']);
        $attempts = ((time() - $first) > ($windowMinutes * 60)) ? 1 : ((int) $row['attempts'] + 1);
        $lockedUntil = $attempts > $maxAttempts ? date('Y-m-d H:i:s', time() + (15 * 60)) : null;

        $pdo->prepare('UPDATE login_attempts SET attempts = :attempts, locked_until = :locked, last_attempt_at = NOW(), first_attempt_at = IF(:reset = 1, NOW(), first_attempt_at), user_agent = :ua WHERE id = :id')
            ->execute([
                'attempts' => $attempts,
                'locked' => $lockedUntil,
                'reset' => (time() - $first) > ($windowMinutes * 60) ? 1 : 0,
                'ua' => $request->userAgent(),
                'id' => $row['id'],
            ]);

        if ($lockedUntil !== null) {
            $this->deny($context, $request, 'Limite de tentativas excedido.');
        }
    }

    public function clear(string $context, string $identifier, string $ip): void
    {
        Database::connection()
            ->prepare('DELETE FROM login_attempts WHERE context = :context AND identifier = :identifier AND ip_address = :ip')
            ->execute(['context' => $context, 'identifier' => $identifier, 'ip' => $ip]);
    }

    private function deny(string $context, Request $request, string $message): never
    {
        http_response_code(429);
        if (is_json_request() || $context === 'api') {
            Response::json(['ok' => false, 'error' => $message], 429);
            exit;
        }

        Session::flash('error', $message);
        $target = match ($context) {
            'admin_login' => '/admin/login',
            'checkout' => '/checkout',
            'password_reset' => '/esqueci-senha',
            default => '/login',
        };
        Response::redirect($target);
        exit;
    }
}
