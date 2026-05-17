<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

final class CustomerMiddleware
{
    public function handle(Request $request): void
    {
        $user = user();
        $customerId = Session::get('customer_id');
        if ($user && ($user['user_type'] ?? '') === 'customer' && is_numeric($customerId) && (int) $customerId > 0 && $this->customerIsUsable((int) $customerId, (int) $user['id'])) {
            return;
        }

        app_log('warning', 'Customer area access denied', [
            'path' => $request->path(),
            'user_id' => $user['id'] ?? null,
            'user_type' => $user['user_type'] ?? null,
        ]);

        if (is_json_request()) {
            Response::json(['ok' => false, 'error' => 'Acesso permitido apenas ao cliente titular.'], 403);
            exit;
        }

        http_response_code(403);
        echo view('errors/403', ['title' => 'Acesso negado']);
        exit;
    }

    private function customerIsUsable(int $customerId, int $userId): bool
    {
        $stmt = Database::connection()->prepare("SELECT COUNT(*)
            FROM customers
            WHERE id = :customer_id
              AND user_id = :user_id
              AND deleted_at IS NULL
              AND account_status NOT IN ('deleted', 'anonymized')");
        $stmt->execute(['customer_id' => $customerId, 'user_id' => $userId]);
        return (int) $stmt->fetchColumn() === 1;
    }
}
