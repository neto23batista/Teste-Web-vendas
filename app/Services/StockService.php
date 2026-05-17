<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use PDOException;
use RuntimeException;

final class StockService
{
    public function reserveOrDebitForOrder(int $orderId): void
    {
        Database::transaction(function (PDO $pdo) use ($orderId): void {
            $orderStmt = $pdo->prepare('SELECT id, id_filial FROM orders WHERE id = :id AND deleted_at IS NULL LIMIT 1 FOR UPDATE');
            $orderStmt->execute(['id' => $orderId]);
            $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                throw new RuntimeException('Pedido nao encontrado para baixa de estoque.');
            }
            $branchId = (int) $order['id_filial'];
            (new BranchService())->assertCanAccess($branchId);

            try {
                $pdo->prepare("INSERT INTO stock_movement_locks (public_id, order_id, id_filial, lock_key) VALUES (:public_id, :order_id, :filial, 'stock_debit')")
                    ->execute(['public_id' => uuid_v4(), 'order_id' => $orderId, 'filial' => $branchId]);
            } catch (PDOException $exception) {
                if ($exception->getCode() === '23000') {
                    return;
                }
                throw $exception;
            }

            $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = :id');
            $stmt->execute(['id' => $orderId]);
            $items = $stmt->fetchAll();

            foreach ($items as $item) {
                $row = $this->stockRowForUpdate($pdo, (int) $item['product_id'], $branchId);
                if (!$row) {
                    throw new RuntimeException('Produto inexistente no estoque.');
                }
                $previous = (int) $row['quantidade'];
                $qty = (int) $item['quantity'];
                if ($previous < $qty) {
                    throw new RuntimeException('Estoque insuficiente para baixa.');
                }
                $final = $previous - $qty;

                $pdo->prepare('UPDATE estoque_filial SET quantidade = :stock, atualizado_em = NOW() WHERE id_produto = :product_id AND id_filial = :filial')
                    ->execute(['stock' => $final, 'product_id' => $item['product_id'], 'filial' => $branchId]);
                $this->syncGlobalProductStock($pdo, (int) $item['product_id']);
                $pdo->prepare("INSERT INTO stock_movements (public_id, id_filial, product_id, batch_id, order_id, movement_type, reason, previous_quantity, movement_quantity, final_quantity, previous_location, unit_cost, total_cost, reference_type, reference_id, responsible_user_id)
                    VALUES (:public_id, :filial, :product_id, :batch_id, :order_id, 'saida_venda', 'Baixa automatica apos pagamento confirmado', :previous, :movement, :final, :location, :unit_cost, :total_cost, 'order', :order_ref, :user)")
                    ->execute([
                        'public_id' => uuid_v4(),
                        'filial' => $branchId,
                        'product_id' => $item['product_id'],
                        'batch_id' => $item['batch_id'],
                        'order_id' => $orderId,
                        'previous' => $previous,
                        'movement' => -$qty,
                        'final' => $final,
                        'location' => $row['localizacao'],
                        'unit_cost' => $row['cost_price'],
                        'total_cost' => $row['cost_price'] !== null ? ((float) $row['cost_price'] * $qty) : null,
                        'order_ref' => $orderId,
                        'user' => user()['id'] ?? null,
                    ]);

                if ($final <= 0) {
                    $this->alert($branchId, (int) $item['product_id'], 'out_of_stock', 'critical', $final, 'Produto zerado apos venda.');
                } else {
                    $min = (int) $row['estoque_minimo'];
                    if ($final <= $min) {
                        $this->alert($branchId, (int) $item['product_id'], 'low_stock', 'warning', $final, 'Produto abaixo do estoque minimo.');
                    }
                }
            }
        });
    }

    public function move(int $productId, int $quantity, string $type, string $reason, ?int $branchId = null): void
    {
        $branchId ??= (new BranchService())->currentId();
        (new BranchService())->assertCanAccess($branchId);

        Database::transaction(function (PDO $pdo) use ($productId, $quantity, $type, $reason, $branchId): void {
            $row = $this->stockRowForUpdate($pdo, $productId, $branchId);
            if (!$row) {
                throw new RuntimeException('Produto nao encontrado no estoque da filial.');
            }
            $previous = (int) $row['quantidade'];
            $final = $previous + $quantity;
            if ($final < 0) {
                throw new RuntimeException('Movimento deixaria estoque negativo.');
            }
            $pdo->prepare('UPDATE estoque_filial SET quantidade = :stock, atualizado_em = NOW() WHERE id_produto = :product_id AND id_filial = :filial')
                ->execute(['stock' => $final, 'product_id' => $productId, 'filial' => $branchId]);
            $this->syncGlobalProductStock($pdo, $productId);
            $pdo->prepare('INSERT INTO stock_movements (public_id, id_filial, product_id, movement_type, reason, previous_quantity, movement_quantity, final_quantity, previous_location, responsible_user_id) VALUES (:public_id, :filial, :product_id, :type, :reason, :previous, :movement, :final, :location, :user)')
                ->execute([
                    'public_id' => uuid_v4(),
                    'filial' => $branchId,
                    'product_id' => $productId,
                    'type' => $type,
                    'reason' => $reason,
                    'previous' => $previous,
                    'movement' => $quantity,
                    'final' => $final,
                    'location' => $row['localizacao'],
                    'user' => user()['id'] ?? null,
                ]);
            (new FileCacheService())->forgetPrefix('dashboard', $branchId);
        });
    }

    public function upsertProductStock(int $productId, int $branchId, int $quantity, int $minimum = 0, ?int $maximum = null, ?string $location = null): void
    {
        (new BranchService())->assertCanAccess($branchId);
        Database::connection()->prepare('INSERT INTO estoque_filial (id_produto, id_filial, quantidade, estoque_minimo, estoque_maximo, localizacao)
            VALUES (:product, :filial, :quantity, :minimum, :maximum, :location)
            ON DUPLICATE KEY UPDATE quantidade = VALUES(quantidade), estoque_minimo = VALUES(estoque_minimo), estoque_maximo = VALUES(estoque_maximo), localizacao = VALUES(localizacao), atualizado_em = NOW()')
            ->execute([
                'product' => $productId,
                'filial' => $branchId,
                'quantity' => $quantity,
                'minimum' => $minimum,
                'maximum' => $maximum,
                'location' => $location,
            ]);
        $this->syncGlobalProductStock(Database::connection(), $productId);
    }

    public function listRisk(?int $branchId = null, int $limit = 200): array
    {
        $params = [];
        $where = '1=1';
        if ($branchId !== null) {
            (new BranchService())->assertCanAccess($branchId);
            $where = 'id_filial = :filial';
            $params['filial'] = $branchId;
        }
        $limit = max(1, min(500, $limit));
        $stmt = Database::connection()->prepare("SELECT * FROM v_stock_risk WHERE {$where} ORDER BY risk_status DESC, product_name LIMIT :limit");
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value, PDO::PARAM_INT);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function transfer(int $productId, int $fromBranchId, int $toBranchId, int $quantity, string $note = ''): int
    {
        (new BranchService())->assertCanAccess($fromBranchId);
        $this->assertActiveBranch($fromBranchId);
        $this->assertActiveBranch($toBranchId);

        if ($fromBranchId === $toBranchId) {
            throw new RuntimeException('Filiais de origem e destino devem ser diferentes.');
        }
        if ($quantity <= 0) {
            throw new RuntimeException('Quantidade de transferencia invalida.');
        }

        return (int) Database::transaction(function (PDO $pdo) use ($productId, $fromBranchId, $toBranchId, $quantity, $note): int {
            $from = $this->stockRowForUpdate($pdo, $productId, $fromBranchId);
            $to = $this->stockRowForUpdate($pdo, $productId, $toBranchId);
            if (!$from || !$to || (int) $from['quantidade'] < $quantity) {
                throw new RuntimeException('Transferencia geraria estoque negativo na filial origem.');
            }

            $pdo->prepare("INSERT INTO transferencias_estoque (id_produto, id_filial_origem, id_filial_destino, quantidade, status, solicitado_por, aprovado_por, concluido_por, observacao)
                VALUES (:product, :from, :to, :quantity, 'concluida', :user, :user, :user, :note)")
                ->execute([
                    'product' => $productId,
                    'from' => $fromBranchId,
                    'to' => $toBranchId,
                    'quantity' => $quantity,
                    'user' => user()['id'] ?? null,
                    'note' => $note,
                ]);
            $transferId = (int) $pdo->lastInsertId();

            $pdo->prepare('UPDATE estoque_filial SET quantidade = quantidade - :quantity WHERE id_produto = :product AND id_filial = :filial')
                ->execute(['quantity' => $quantity, 'product' => $productId, 'filial' => $fromBranchId]);
            $pdo->prepare('UPDATE estoque_filial SET quantidade = quantidade + :quantity WHERE id_produto = :product AND id_filial = :filial')
                ->execute(['quantity' => $quantity, 'product' => $productId, 'filial' => $toBranchId]);

            $this->movement($pdo, $productId, $fromBranchId, -$quantity, 'transferencia_interna', 'Saida por transferencia #' . $transferId, (int) $from['quantidade'], (int) $from['quantidade'] - $quantity);
            $this->movement($pdo, $productId, $toBranchId, $quantity, 'transferencia_interna', 'Entrada por transferencia #' . $transferId, (int) $to['quantidade'], (int) $to['quantidade'] + $quantity);
            $this->syncGlobalProductStock($pdo, $productId);

            return $transferId;
        });
    }

    private function stockRowForUpdate(PDO $pdo, int $productId, int $branchId): ?array
    {
        $pdo->prepare('INSERT INTO estoque_filial (id_produto, id_filial, quantidade, estoque_minimo, estoque_maximo, localizacao)
            SELECT id, :filial, 0, minimum_stock, maximum_stock, physical_location
            FROM products
            WHERE id = :product AND deleted_at IS NULL
            ON DUPLICATE KEY UPDATE id = id')
            ->execute(['filial' => $branchId, 'product' => $productId]);

        $stmt = $pdo->prepare('SELECT ef.*, p.cost_price
            FROM estoque_filial ef
            INNER JOIN products p ON p.id = ef.id_produto
            WHERE ef.id_produto = :product AND ef.id_filial = :filial
            LIMIT 1 FOR UPDATE');
        $stmt->execute(['product' => $productId, 'filial' => $branchId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function assertActiveBranch(int $branchId): void
    {
        if ($branchId <= 0) {
            throw new RuntimeException('Filial invalida ou inativa para transferencia.');
        }

        $stmt = Database::connection()->prepare("SELECT COUNT(*) FROM filiais WHERE id = :id AND status = 'ativa'");
        $stmt->execute(['id' => $branchId]);
        if ((int) $stmt->fetchColumn() === 0) {
            throw new RuntimeException('Filial invalida ou inativa para transferencia.');
        }
    }

    private function syncGlobalProductStock(PDO $pdo, int $productId): void
    {
        $pdo->prepare('UPDATE products p
            SET p.current_stock = COALESCE((SELECT SUM(ef.quantidade) FROM estoque_filial ef WHERE ef.id_produto = p.id), p.current_stock),
                p.updated_at = NOW()
            WHERE p.id = :product')
            ->execute(['product' => $productId]);
    }

    private function movement(PDO $pdo, int $productId, int $branchId, int $quantity, string $type, string $reason, int $previous, int $final): void
    {
        $pdo->prepare('INSERT INTO stock_movements (public_id, id_filial, product_id, movement_type, reason, previous_quantity, movement_quantity, final_quantity, responsible_user_id)
            VALUES (:public_id, :filial, :product, :type, :reason, :previous, :movement, :final, :user)')
            ->execute([
                'public_id' => uuid_v4(),
                'filial' => $branchId,
                'product' => $productId,
                'type' => $type,
                'reason' => $reason,
                'previous' => $previous,
                'movement' => $quantity,
                'final' => $final,
                'user' => user()['id'] ?? null,
            ]);
    }

    private function alert(int $branchId, int $productId, string $type, string $severity, int $quantity, string $message): void
    {
        Database::connection()->prepare('INSERT INTO stock_alerts (id_filial, product_id, alert_type, severity, current_quantity, message) VALUES (:filial, :product, :type, :severity, :qty, :message)')
            ->execute(['filial' => $branchId, 'product' => $productId, 'type' => $type, 'severity' => $severity, 'qty' => $quantity, 'message' => $message]);
    }
}
