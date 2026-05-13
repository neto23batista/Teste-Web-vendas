<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

final class AdminMiddleware
{
    public function handle(Request $request): void
    {
        if (is_admin() && admin_account_is_active() && $this->allowed($request)) {
            return;
        }

        app_log('warning', 'Admin permission denied', ['path' => $request->path(), 'user' => user()['id'] ?? null]);
        if (is_json_request()) {
            Response::json(['ok' => false, 'error' => 'Permissao insuficiente.'], 403);
            exit;
        }

        http_response_code(403);
        echo view('errors/403', ['title' => 'Acesso negado']);
        exit;
    }

    private function allowed(Request $request): bool
    {
        $user = user();
        if (!$user) {
            return false;
        }

        $permission = $this->permissionFor($request);
        if ($permission === null) {
            return true;
        }

        if (is_owner()) {
            return true;
        }

        if (in_array($permission, $this->ownerOnlyPermissions(), true)) {
            return false;
        }

        $stmt = Database::connection()->prepare("SELECT COUNT(*)
            FROM user_roles ur
            INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
            INNER JOIN permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = :user_id AND p.slug = :permission");
        $stmt->execute(['user_id' => $user['id'], 'permission' => $permission]);
        return (int) $stmt->fetchColumn() > 0;
    }

    /** @return array<int, string> */
    private function ownerOnlyPermissions(): array
    {
        return ['users.manage', 'settings.manage'];
    }

    private function permissionFor(Request $request): ?string
    {
        $path = $request->path();
        $write = in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        return match (true) {
            str_starts_with($path, '/admin/produtos') => $write ? 'products.manage' : 'products.view',
            str_starts_with($path, '/admin/pedidos') => $write ? 'orders.manage' : 'orders.view',
            str_starts_with($path, '/admin/clientes') => $write ? 'customers.manage' : 'customers.view',
            str_starts_with($path, '/admin/funcionarios') => 'users.manage',
            str_starts_with($path, '/admin/estoque') => $write ? 'stock.manage' : 'stock.view',
            str_starts_with($path, '/admin/receitas') => $write ? 'prescriptions.validate' : 'prescriptions.view',
            str_starts_with($path, '/admin/pagamentos') => $write ? 'payments.manage' : 'payments.view',
            str_starts_with($path, '/admin/nfe') => $write ? 'invoices.manage' : 'invoices.view',
            str_starts_with($path, '/admin/relatorios') => 'reports.view',
            str_starts_with($path, '/admin/integracoes') => $write ? 'integrations.manage' : 'integrations.view',
            str_starts_with($path, '/admin/marketing') => $write ? 'marketing.manage' : 'marketing.view',
            str_starts_with($path, '/admin/entrega') => $write ? 'delivery.manage' : 'delivery.view',
            str_starts_with($path, '/admin/configuracoes') => 'settings.manage',
            str_starts_with($path, '/admin/logs') => 'logs.view',
            default => 'dashboard.view',
        };
    }
}
