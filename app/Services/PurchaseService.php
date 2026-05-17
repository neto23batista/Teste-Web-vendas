<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use RuntimeException;

final class PurchaseService
{
    public function suppliers(): array
    {
        return Database::connection()->query('SELECT * FROM fornecedores ORDER BY nome_fantasia, razao_social')->fetchAll(PDO::FETCH_ASSOC);
    }

    public function createSupplier(array $data): int
    {
        $stmt = Database::connection()->prepare("INSERT INTO fornecedores (razao_social, nome_fantasia, cnpj, telefone, email, endereco, status)
            VALUES (:razao, :fantasia, :cnpj, :telefone, :email, :endereco, 'ativo')
            ON DUPLICATE KEY UPDATE razao_social = VALUES(razao_social), nome_fantasia = VALUES(nome_fantasia), telefone = VALUES(telefone), email = VALUES(email), endereco = VALUES(endereco), atualizado_em = NOW()");
        $stmt->execute([
            'razao' => trim((string) ($data['razao_social'] ?? '')),
            'fantasia' => trim((string) ($data['nome_fantasia'] ?? '')),
            'cnpj' => trim((string) ($data['cnpj'] ?? '')),
            'telefone' => trim((string) ($data['telefone'] ?? '')),
            'email' => trim((string) ($data['email'] ?? '')),
            'endereco' => trim((string) ($data['endereco'] ?? '')),
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    public function createOrder(array $data): int
    {
        $branchId = is_admin_geral() && isset($data['id_filial']) ? (int) $data['id_filial'] : (new BranchService())->currentId();
        (new BranchService())->assertCanAccess($branchId);
        $supplierId = (int) ($data['id_fornecedor'] ?? 0);
        if ($supplierId <= 0) {
            throw new RuntimeException('Fornecedor obrigatorio.');
        }

        $stmt = Database::connection()->prepare("INSERT INTO ordens_compra (id_fornecedor, id_filial, status, previsao_entrega, criado_por)
            VALUES (:supplier, :filial, 'pendente_aprovacao', :previsao, :user)");
        $stmt->execute([
            'supplier' => $supplierId,
            'filial' => $branchId,
            'previsao' => ($data['previsao_entrega'] ?? '') ?: null,
            'user' => user()['id'] ?? null,
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    public function receive(int $orderId): void
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare("SELECT * FROM ordens_compra WHERE id = :id AND status IN ('aprovada','pendente_aprovacao') LIMIT 1");
        $stmt->execute(['id' => $orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            throw new RuntimeException('Ordem de compra nao encontrada ou ja recebida.');
        }
        (new BranchService())->assertCanAccess((int) $order['id_filial']);

        $items = $pdo->prepare('SELECT * FROM ordens_compra_itens WHERE id_ordem_compra = :id');
        $items->execute(['id' => $orderId]);
        foreach ($items->fetchAll(PDO::FETCH_ASSOC) as $item) {
            (new StockService())->move((int) $item['id_produto'], (int) $item['quantidade'], 'entrada_compra', 'Recebimento da ordem de compra #' . $orderId, (int) $order['id_filial']);
        }
        $pdo->prepare("UPDATE ordens_compra SET status = 'recebida', recebido_por = :user, recebido_em = NOW(), atualizado_em = NOW() WHERE id = :id")
            ->execute(['user' => user()['id'] ?? null, 'id' => $orderId]);
    }

    public function orders(?int $branchId = null): array
    {
        $branchId ??= is_admin_geral() ? null : (new BranchService())->currentId();
        $params = [];
        $where = '1=1';
        if ($branchId !== null) {
            $where = 'oc.id_filial = :filial';
            $params['filial'] = $branchId;
        }
        $stmt = Database::connection()->prepare("SELECT oc.*, f.nome AS filial_nome, fo.nome_fantasia, fo.razao_social
            FROM ordens_compra oc
            INNER JOIN filiais f ON f.id = oc.id_filial
            INNER JOIN fornecedores fo ON fo.id = oc.id_fornecedor
            WHERE {$where}
            ORDER BY oc.criado_em DESC
            LIMIT 100");
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
