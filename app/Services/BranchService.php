<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use App\Core\Session;
use PDO;
use RuntimeException;

final class BranchService
{
    /** @return array<int, array<string, mixed>> */
    public function all(bool $activeOnly = true): array
    {
        $sql = 'SELECT * FROM filiais';
        if ($activeOnly) {
            $sql .= " WHERE status = 'ativa'";
        }
        $sql .= ' ORDER BY nome';
        return Database::connection()->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    }

    public function defaultId(): int
    {
        $id = (int) (Database::connection()->query("SELECT id FROM filiais WHERE status = 'ativa' ORDER BY id LIMIT 1")->fetchColumn() ?: 0);
        if ($id <= 0) {
            throw new RuntimeException('Nenhuma filial ativa cadastrada.');
        }
        return $id;
    }

    public function currentId(): int
    {
        $selected = Session::get('selected_filial_id');
        if ($this->isGlobalAdmin() && is_numeric($selected) && (int) $selected > 0) {
            return (int) $selected;
        }

        $user = user();
        if ($user && !empty($user['id_filial'])) {
            return (int) $user['id_filial'];
        }

        $apiBranch = $_SERVER['FARMAVIDA_API_FILIAL_ID'] ?? null;
        if (is_numeric($apiBranch) && (int) $apiBranch > 0) {
            return (int) $apiBranch;
        }

        return $this->defaultId();
    }

    public function selectedIdFromRequest(Request $request, bool $allowAll = true): ?int
    {
        if (!$this->isGlobalAdmin()) {
            return $this->currentId();
        }

        $raw = $request->input('id_filial', $request->input('filial', Session::get('selected_filial_id', 'all')));
        if ($allowAll && ($raw === 'all' || $raw === '' || $raw === null)) {
            Session::forget('selected_filial_id');
            return null;
        }

        $branchId = (int) $raw;
        if ($branchId <= 0) {
            $branchId = $this->defaultId();
        }
        $this->assertExists($branchId);
        Session::put('selected_filial_id', $branchId);
        return $branchId;
    }

    public function assertCanAccess(?int $branchId): void
    {
        if ($branchId === null || $this->isGlobalAdmin()) {
            return;
        }

        if ($branchId !== $this->currentId()) {
            app_log('warning', 'Cross branch access blocked', [
                'requested_filial' => $branchId,
                'user_filial' => $this->currentId(),
                'user_id' => user()['id'] ?? null,
            ]);
            throw new RuntimeException('Acesso negado para esta filial.');
        }
    }

    public function filterSql(string $alias, ?int $branchId, array &$params, string $param = 'id_filial'): string
    {
        if ($branchId === null) {
            return '';
        }
        $params[$param] = $branchId;
        return " AND {$alias}.id_filial = :{$param}";
    }

    public function whereSql(string $alias, ?int $branchId, array &$params, string $param = 'id_filial'): string
    {
        if ($branchId === null) {
            return '1=1';
        }
        $params[$param] = $branchId;
        return "{$alias}.id_filial = :{$param}";
    }

    public function branchName(?int $branchId): string
    {
        if ($branchId === null) {
            return 'Todas as filiais';
        }

        $stmt = Database::connection()->prepare('SELECT nome FROM filiais WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $branchId]);
        return (string) ($stmt->fetchColumn() ?: 'Filial #' . $branchId);
    }

    private function assertExists(int $branchId): void
    {
        $stmt = Database::connection()->prepare("SELECT COUNT(*) FROM filiais WHERE id = :id AND status = 'ativa'");
        $stmt->execute(['id' => $branchId]);
        if ((int) $stmt->fetchColumn() === 0) {
            throw new RuntimeException('Filial invalida ou inativa.');
        }
    }

    private function isGlobalAdmin(): bool
    {
        return function_exists('is_admin_geral') ? is_admin_geral() : is_owner();
    }
}
