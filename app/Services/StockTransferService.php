<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use RuntimeException;

final class StockTransferService
{
    public function list(?int $branchId = null): array
    {
        $params = [];
        $scope = '';
        if ($branchId !== null) {
            (new BranchService())->assertCanAccess($branchId);
            $scope = 'WHERE (t.id_filial_origem = :filial OR t.id_filial_destino = :filial)';
            $params['filial'] = $branchId;
        } elseif (!is_admin_geral()) {
            $scope = 'WHERE (t.id_filial_origem = :filial OR t.id_filial_destino = :filial)';
            $params['filial'] = (new BranchService())->currentId();
        }

        $stmt = Database::connection()->prepare("SELECT t.*, p.name AS produto_nome, fo.nome AS origem_nome, fd.nome AS destino_nome,
                us.name AS solicitado_por_nome, ua.name AS aprovado_por_nome, uc.name AS concluido_por_nome
            FROM transferencias_estoque t
            INNER JOIN products p ON p.id = t.id_produto
            INNER JOIN filiais fo ON fo.id = t.id_filial_origem
            INNER JOIN filiais fd ON fd.id = t.id_filial_destino
            LEFT JOIN users us ON us.id = t.solicitado_por
            LEFT JOIN users ua ON ua.id = t.aprovado_por
            LEFT JOIN users uc ON uc.id = t.concluido_por
            {$scope}
            ORDER BY FIELD(t.status, 'solicitada', 'aprovada', 'em_transporte', 'concluida', 'cancelada'), t.criado_em DESC
            LIMIT 200");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['acoes_permitidas'] = $this->actionsFor($row);
        }
        unset($row);

        return $rows;
    }

    /** @return array<int, array<string, mixed>> */
    public function originBranchesForForm(): array
    {
        if (is_admin_geral()) {
            return (new BranchService())->all();
        }

        return $this->activeBranchRows([(new BranchService())->currentId()]);
    }

    /** @return array<int, array<string, mixed>> */
    public function destinationBranchesForForm(): array
    {
        return (new BranchService())->all();
    }

    /** @return array<int, array<string, mixed>> */
    public function productsForForm(?int $branchId = null): array
    {
        $params = [];
        if ($branchId !== null) {
            (new BranchService())->assertCanAccess($branchId);
            $params['filial'] = $branchId;
            $stockJoin = 'LEFT JOIN estoque_filial ef ON ef.id_produto = p.id AND ef.id_filial = :filial';
        } else {
            $stockJoin = 'LEFT JOIN (
                SELECT id_produto, SUM(quantidade) AS quantidade
                FROM estoque_filial
                GROUP BY id_produto
            ) ef ON ef.id_produto = p.id';
        }

        $stmt = Database::connection()->prepare("SELECT p.id, p.name, p.internal_code, COALESCE(ef.quantidade, 0) AS current_stock
            FROM products p
            {$stockJoin}
            WHERE p.deleted_at IS NULL
            ORDER BY COALESCE(ef.quantidade, 0) DESC, p.name ASC
            LIMIT 300");
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /** @param array<string, mixed> $transfer @return array<string, string> */
    public function actionsFor(array $transfer): array
    {
        $status = (string) ($transfer['status'] ?? '');
        $originId = (int) ($transfer['id_filial_origem'] ?? 0);
        $destinationId = (int) ($transfer['id_filial_destino'] ?? 0);

        if ($status === 'solicitada' && $this->canAccessBranch($originId)) {
            return ['approve' => 'Aprovar', 'cancel' => 'Cancelar'];
        }
        if ($status === 'aprovada' && $this->canAccessBranch($originId)) {
            return ['dispatch' => 'Enviar', 'cancel' => 'Cancelar'];
        }
        if ($status === 'em_transporte' && $this->canAccessBranch($destinationId)) {
            return ['complete' => 'Concluir'];
        }

        return [];
    }

    public function request(int $productId, int $fromBranchId, int $toBranchId, int $quantity, string $note = ''): int
    {
        $this->validateTransferInput($productId, $fromBranchId, $toBranchId, $quantity);
        (new BranchService())->assertCanAccess($fromBranchId);

        return (int) Database::transaction(function (PDO $pdo) use ($productId, $fromBranchId, $toBranchId, $quantity, $note): int {
            $origin = $this->stockRowForUpdate($pdo, $productId, $fromBranchId);
            if (!$origin) {
                throw new RuntimeException('Produto nao encontrado no estoque da filial origem.');
            }
            if ((int) $origin['quantidade'] < $quantity) {
                throw new RuntimeException('Filial origem nao possui saldo suficiente para solicitar transferencia.');
            }
            if (!$this->stockRowForUpdate($pdo, $productId, $toBranchId)) {
                throw new RuntimeException('Produto inexistente no estoque da filial destino.');
            }

            $pdo->prepare("INSERT INTO transferencias_estoque (id_produto, id_filial_origem, id_filial_destino, quantidade, status, solicitado_por, observacao)
                VALUES (:product, :from, :to, :quantity, 'solicitada', :user, :note)")
                ->execute([
                    'product' => $productId,
                    'from' => $fromBranchId,
                    'to' => $toBranchId,
                    'quantity' => $quantity,
                    'user' => user()['id'] ?? null,
                    'note' => trim($note) !== '' ? trim($note) : null,
                ]);
            $transferId = (int) $pdo->lastInsertId();
            (new AuditService())->admin('stock', 'transfer_requested', 'stock_transfer', $transferId, [], [
                'id_filial' => $fromBranchId,
                'id_filial_destino' => $toBranchId,
                'id_produto' => $productId,
                'quantidade' => $quantity,
            ]);

            return $transferId;
        });
    }

    public function approve(int $id): void
    {
        $this->transition($id, 'solicitada', 'aprovada', false, false);
    }

    public function dispatch(int $id): void
    {
        $this->transition($id, 'aprovada', 'em_transporte', true, false);
    }

    public function complete(int $id): void
    {
        $this->transition($id, 'em_transporte', 'concluida', false, true);
    }

    public function cancel(int $id): void
    {
        Database::transaction(function (PDO $pdo) use ($id): void {
            $transfer = $this->transferForUpdate($pdo, $id);
            if (!in_array((string) $transfer['status'], ['solicitada', 'aprovada'], true)) {
                throw new RuntimeException('Somente transferencias solicitadas ou aprovadas podem ser canceladas sem estorno.');
            }
            (new BranchService())->assertCanAccess((int) $transfer['id_filial_origem']);
            $pdo->prepare("UPDATE transferencias_estoque SET status = 'cancelada', atualizado_em = NOW() WHERE id = :id")
                ->execute(['id' => $id]);
            (new AuditService())->admin('stock', 'transfer_cancelled', 'stock_transfer', $id, $transfer, ['status' => 'cancelada']);
        });
    }

    private function transition(int $id, string $fromStatus, string $toStatus, bool $debitOrigin, bool $creditDestination): void
    {
        Database::transaction(function (PDO $pdo) use ($id, $fromStatus, $toStatus, $debitOrigin, $creditDestination): void {
            $transfer = $this->transferForUpdate($pdo, $id);
            if ((string) $transfer['status'] !== $fromStatus) {
                throw new RuntimeException('Transferencia nao esta no status esperado para esta acao.');
            }

            $originId = (int) $transfer['id_filial_origem'];
            $destinationId = (int) $transfer['id_filial_destino'];
            if ($creditDestination) {
                (new BranchService())->assertCanAccess($destinationId);
            } else {
                (new BranchService())->assertCanAccess($originId);
            }

            $productId = (int) $transfer['id_produto'];
            $quantity = (int) $transfer['quantidade'];
            if ($debitOrigin) {
                $origin = $this->stockRowForUpdate($pdo, $productId, $originId);
                if (!$origin || (int) $origin['quantidade'] < $quantity) {
                    throw new RuntimeException('Transferencia geraria estoque negativo na filial origem.');
                }
                $final = (int) $origin['quantidade'] - $quantity;
                $pdo->prepare('UPDATE estoque_filial SET quantidade = :quantity, atualizado_em = NOW() WHERE id_produto = :product AND id_filial = :filial')
                    ->execute(['quantity' => $final, 'product' => $productId, 'filial' => $originId]);
                $this->movement($pdo, $productId, $originId, -$quantity, 'Saida para transferencia #' . $id, (int) $origin['quantidade'], $final);
            }

            if ($creditDestination) {
                $destination = $this->stockRowForUpdate($pdo, $productId, $destinationId);
                if (!$destination) {
                    throw new RuntimeException('Produto inexistente no estoque da filial destino.');
                }
                $final = (int) $destination['quantidade'] + $quantity;
                $pdo->prepare('UPDATE estoque_filial SET quantidade = :quantity, atualizado_em = NOW() WHERE id_produto = :product AND id_filial = :filial')
                    ->execute(['quantity' => $final, 'product' => $productId, 'filial' => $destinationId]);
                $this->movement($pdo, $productId, $destinationId, $quantity, 'Entrada por transferencia #' . $id, (int) $destination['quantidade'], $final);
            }

            $sets = ['status = :status', 'atualizado_em = NOW()'];
            $params = ['id' => $id, 'status' => $toStatus];
            if ($toStatus === 'aprovada') {
                $sets[] = 'aprovado_por = :user';
                $params['user'] = user()['id'] ?? null;
            }
            if ($toStatus === 'concluida') {
                $sets[] = 'concluido_por = :user';
                $params['user'] = user()['id'] ?? null;
            }
            $pdo->prepare('UPDATE transferencias_estoque SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);
            $this->syncGlobalProductStock($pdo, $productId);
            (new FileCacheService())->forgetPrefix('dashboard', $originId);
            (new FileCacheService())->forgetPrefix('dashboard', $destinationId);
            (new AuditService())->admin('stock', 'transfer_' . $toStatus, 'stock_transfer', $id, $transfer, ['status' => $toStatus]);
        });
    }

    private function validateTransferInput(int $productId, int $fromBranchId, int $toBranchId, int $quantity): void
    {
        if ($productId <= 0 || $fromBranchId <= 0 || $toBranchId <= 0) {
            throw new RuntimeException('Produto e filiais sao obrigatorios.');
        }
        if ($fromBranchId === $toBranchId) {
            throw new RuntimeException('Filial origem e destino devem ser diferentes.');
        }
        if ($quantity <= 0) {
            throw new RuntimeException('Quantidade de transferencia invalida.');
        }

        $this->assertActiveBranch($fromBranchId);
        $this->assertActiveBranch($toBranchId);
    }

    private function transferForUpdate(PDO $pdo, int $id): array
    {
        $stmt = $pdo->prepare('SELECT * FROM transferencias_estoque WHERE id = :id LIMIT 1 FOR UPDATE');
        $stmt->execute(['id' => $id]);
        $transfer = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$transfer) {
            throw new RuntimeException('Transferencia nao encontrada.');
        }
        return $transfer;
    }

    private function stockRowForUpdate(PDO $pdo, int $productId, int $branchId): ?array
    {
        $pdo->prepare('INSERT INTO estoque_filial (id_produto, id_filial, quantidade, estoque_minimo, estoque_maximo, localizacao)
            SELECT id, :filial, 0, minimum_stock, maximum_stock, physical_location
            FROM products
            WHERE id = :product AND deleted_at IS NULL
            ON DUPLICATE KEY UPDATE id = id')
            ->execute(['filial' => $branchId, 'product' => $productId]);

        $stmt = $pdo->prepare('SELECT * FROM estoque_filial WHERE id_produto = :product AND id_filial = :filial LIMIT 1 FOR UPDATE');
        $stmt->execute(['product' => $productId, 'filial' => $branchId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function canAccessBranch(int $branchId): bool
    {
        try {
            (new BranchService())->assertCanAccess($branchId);
            return true;
        } catch (RuntimeException) {
            return false;
        }
    }

    /** @param array<int, int> $ids @return array<int, array<string, mixed>> */
    private function activeBranchRows(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
        if ($ids === []) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach ($ids as $index => $id) {
            $key = 'id' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $id;
        }

        $stmt = Database::connection()->prepare("SELECT * FROM filiais WHERE status = 'ativa' AND id IN (" . implode(',', $placeholders) . ') ORDER BY nome');
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function assertActiveBranch(int $branchId): void
    {
        $stmt = Database::connection()->prepare("SELECT COUNT(*) FROM filiais WHERE id = :id AND status = 'ativa'");
        $stmt->execute(['id' => $branchId]);
        if ((int) $stmt->fetchColumn() === 0) {
            throw new RuntimeException('Filial invalida ou inativa para transferencia.');
        }
    }

    private function movement(PDO $pdo, int $productId, int $branchId, int $quantity, string $reason, int $previous, int $final): void
    {
        $pdo->prepare("INSERT INTO stock_movements (public_id, id_filial, product_id, movement_type, reason, previous_quantity, movement_quantity, final_quantity, responsible_user_id)
            VALUES (:public_id, :filial, :product, 'transferencia_interna', :reason, :previous, :movement, :final, :user)")
            ->execute([
                'public_id' => uuid_v4(),
                'filial' => $branchId,
                'product' => $productId,
                'reason' => $reason,
                'previous' => $previous,
                'movement' => $quantity,
                'final' => $final,
                'user' => user()['id'] ?? null,
            ]);
    }

    private function syncGlobalProductStock(PDO $pdo, int $productId): void
    {
        $pdo->prepare('UPDATE products p
            SET p.current_stock = COALESCE((SELECT SUM(ef.quantidade) FROM estoque_filial ef WHERE ef.id_produto = p.id), p.current_stock),
                p.updated_at = NOW()
            WHERE p.id = :product')
            ->execute(['product' => $productId]);
    }
}
