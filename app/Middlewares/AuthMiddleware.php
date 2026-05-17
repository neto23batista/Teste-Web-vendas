<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

final class AuthMiddleware
{
    public function handle(Request $request): void
    {
        $user = user();
        if ($user !== null && $this->sessionIsCurrent($user)) {
            return;
        }

        if ($user !== null) {
            Session::destroy();
        }

        if (is_json_request()) {
            Response::json(['ok' => false, 'error' => 'Autenticacao obrigatoria.'], 401);
            exit;
        }

        Response::redirect(str_starts_with($request->path(), '/admin') ? '/admin/login' : '/login');
        exit;
    }

    /** @param array<string, mixed> $user */
    private function sessionIsCurrent(array $user): bool
    {
        if (empty($user['id'])) {
            return false;
        }

        $stmt = Database::connection()->prepare('SELECT status, session_version, deleted_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => (int) $user['id']]);
        $row = $stmt->fetch();
        if (!$row || $row['deleted_at'] !== null || $row['status'] !== 'active') {
            return false;
        }

        return (int) ($user['session_version'] ?? 0) === (int) $row['session_version'];
    }
}
