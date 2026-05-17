<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use RuntimeException;

final class CashRegisterService
{
    public function current(?int $branchId = null): ?array
    {
        $branchId ??= (new BranchService())->currentId();
        $stmt = Database::connection()->prepare("SELECT * FROM caixas WHERE id_filial = :filial AND status = 'aberto' ORDER BY aberto_em DESC LIMIT 1");
        $stmt->execute(['filial' => $branchId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function open(float $openingAmount, ?int $branchId = null): int
    {
        $branchId ??= (new BranchService())->currentId();
        (new BranchService())->assertCanAccess($branchId);
        if ($this->current($branchId)) {
            throw new RuntimeException('Ja existe caixa aberto para esta filial.');
        }

        $stmt = Database::connection()->prepare("INSERT INTO caixas (id_filial, aberto_por, valor_abertura, valor_esperado, status)
            VALUES (:filial, :user, :opening, :opening, 'aberto')");
        $stmt->execute(['filial' => $branchId, 'user' => user()['id'] ?? 0, 'opening' => $openingAmount]);
        return (int) Database::connection()->lastInsertId();
    }

    public function movement(int $cashId, string $type, string $paymentMethod, float $amount, string $description = '', ?int $orderId = null): void
    {
        Database::transaction(function (PDO $pdo) use ($cashId, $type, $paymentMethod, $amount, $description, $orderId): void {
            $stmt = $pdo->prepare("SELECT * FROM caixas WHERE id = :id AND status = 'aberto' LIMIT 1 FOR UPDATE");
            $stmt->execute(['id' => $cashId]);
            $cash = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$cash) {
                throw new RuntimeException('Caixa aberto nao encontrado.');
            }
            (new BranchService())->assertCanAccess((int) $cash['id_filial']);

            $pdo->prepare('INSERT INTO caixa_movimentacoes (id_caixa, tipo, forma_pagamento, valor, descricao, id_pedido, criado_por)
                VALUES (:cash, :type, :method, :amount, :description, :order_id, :user)')
                ->execute([
                    'cash' => $cashId,
                    'type' => $type,
                    'method' => $paymentMethod,
                    'amount' => $amount,
                    'description' => $description,
                    'order_id' => $orderId,
                    'user' => user()['id'] ?? null,
                ]);

            $pdo->prepare('UPDATE caixas SET valor_esperado = valor_esperado + :amount WHERE id = :id')
                ->execute(['amount' => $amount, 'id' => $cashId]);
        });
    }

    public function close(int $cashId, float $closingAmount): void
    {
        Database::transaction(function (PDO $pdo) use ($cashId, $closingAmount): void {
            $stmt = $pdo->prepare("SELECT * FROM caixas WHERE id = :id AND status = 'aberto' LIMIT 1 FOR UPDATE");
            $stmt->execute(['id' => $cashId]);
            $cash = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$cash) {
                throw new RuntimeException('Caixa aberto nao encontrado.');
            }
            (new BranchService())->assertCanAccess((int) $cash['id_filial']);

            $expected = (float) $cash['valor_esperado'];
            $pdo->prepare("UPDATE caixas SET status = 'fechado', fechado_por = :user, valor_fechamento = :closing, divergencia = :divergence, fechado_em = NOW() WHERE id = :id")
                ->execute([
                    'user' => user()['id'] ?? null,
                    'closing' => $closingAmount,
                    'divergence' => $closingAmount - $expected,
                    'id' => $cashId,
                ]);
        });
    }

    public function report(?int $branchId = null): array
    {
        $branchId ??= is_admin_geral() ? null : (new BranchService())->currentId();
        $params = [];
        $where = '1=1';
        if ($branchId !== null) {
            $where = 'c.id_filial = :filial';
            $params['filial'] = $branchId;
        }
        $stmt = Database::connection()->prepare("SELECT c.*, f.nome AS filial_nome, u.name AS aberto_por_nome
            FROM caixas c
            INNER JOIN filiais f ON f.id = c.id_filial
            LEFT JOIN users u ON u.id = c.aberto_por
            WHERE {$where}
            ORDER BY c.aberto_em DESC
            LIMIT 100");
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
