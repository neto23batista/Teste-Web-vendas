<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use RuntimeException;

final class FiscalService
{
    public function issue(int $orderId): int
    {
        if ($orderId <= 0) {
            throw new RuntimeException('Pedido invalido para emissao fiscal.');
        }

        return (int) Database::transaction(function (PDO $pdo) use ($orderId): int {
            $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = :id AND deleted_at IS NULL LIMIT 1 FOR UPDATE');
            $stmt->execute(['id' => $orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                throw new RuntimeException('Pedido nao encontrado.');
            }

            (new BranchService())->assertCanAccess((int) $order['id_filial']);

            $config = $this->providerConfig();
            $status = $config['configured'] ? 'pendente' : 'homologacao_simulada';
            $error = $config['configured'] ? null : 'Credenciais fiscais ausentes. Registro criado em homologacao/simulacao explicita.';

            $pdo->prepare("INSERT INTO notas_fiscais (id_pedido, id_filial, provedor, status, ambiente, erro)
                VALUES (:order_id, :filial, :provider, :status, :environment, :error)
                ON DUPLICATE KEY UPDATE status = VALUES(status), ambiente = VALUES(ambiente), erro = VALUES(erro), atualizado_em = NOW()")
                ->execute([
                    'order_id' => $orderId,
                    'filial' => $order['id_filial'],
                    'provider' => $config['provider'],
                    'status' => $status,
                    'environment' => $config['environment'],
                    'error' => $error,
                ]);
            $noteId = (int) ($pdo->lastInsertId() ?: $pdo->query('SELECT LAST_INSERT_ID()')->fetchColumn());
            if ($noteId <= 0) {
                $lookup = $pdo->prepare('SELECT id FROM notas_fiscais WHERE id_pedido = :order_id LIMIT 1');
                $lookup->execute(['order_id' => $orderId]);
                $noteId = (int) $lookup->fetchColumn();
            }

            $pdo->prepare('INSERT INTO fiscal_api_logs (id_filial, id_nota_fiscal, provedor, operacao, ambiente, request_sanitized, response_sanitized, erro)
                VALUES (:filial, :note, :provider, :operation, :environment, :request, :response, :error)')
                ->execute([
                    'filial' => $order['id_filial'],
                    'note' => $noteId ?: null,
                    'provider' => $config['provider'],
                    'operation' => 'issue',
                    'environment' => $config['environment'],
                    'request' => json_encode(['order_id' => $orderId, 'order_number' => $order['order_number']], JSON_UNESCAPED_UNICODE),
                    'response' => json_encode(['mode' => $status], JSON_UNESCAPED_UNICODE),
                    'error' => $error,
                ]);

            (new AuditService())->admin('invoices', 'fiscal_issue_requested', 'nota_fiscal', $noteId, [], [
                'order_id' => $orderId,
                'status' => $status,
                'provider' => $config['provider'],
                'environment' => $config['environment'],
            ]);

            return $noteId;
        });
    }

    public function cancel(int $noteId, string $reason): void
    {
        $stmt = Database::connection()->prepare('SELECT * FROM notas_fiscais WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $noteId]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$note) {
            throw new RuntimeException('Nota fiscal nao encontrada.');
        }

        (new BranchService())->assertCanAccess((int) $note['id_filial']);
        Database::connection()->prepare("UPDATE notas_fiscais SET status = 'cancelada', erro = :reason, atualizado_em = NOW() WHERE id = :id")
            ->execute(['reason' => $reason, 'id' => $noteId]);
    }

    public function readiness(): array
    {
        return $this->providerConfig();
    }

    private function providerConfig(): array
    {
        $provider = strtolower(trim((string) config('fiscal.provider', env_value('FISCAL_PROVIDER', 'homologacao_interna'))));
        $environment = strtolower(trim((string) config('fiscal.environment', env_value('FISCAL_ENVIRONMENT', 'homologacao'))));
        if (!in_array($provider, ['focus_nfe', 'nfe_io', 'tecnospeed', 'homologacao_interna'], true)) {
            $provider = 'homologacao_interna';
        }
        if (!in_array($environment, ['homologacao', 'producao'], true)) {
            $environment = 'homologacao';
        }

        $token = trim((string) env_value('FISCAL_API_TOKEN', ''));
        return [
            'provider' => $provider,
            'environment' => $environment,
            'configured' => $provider !== 'homologacao_interna' && $token !== '',
            'message' => $token === '' ? 'FISCAL_API_TOKEN nao configurado.' : 'Credenciais fiscais configuradas.',
        ];
    }
}
