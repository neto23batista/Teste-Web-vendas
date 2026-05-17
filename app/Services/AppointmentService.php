<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use DateTimeImmutable;
use PDO;
use PDOException;
use RuntimeException;

final class AppointmentService
{
    public function services(bool $activeOnly = true): array
    {
        $where = $activeOnly ? "WHERE status = 'ativo'" : '';
        return Database::connection()->query("SELECT * FROM servicos_farmacia {$where} ORDER BY nome")->fetchAll(PDO::FETCH_ASSOC);
    }

    public function customerAppointments(int $customerId): array
    {
        $stmt = Database::connection()->prepare("SELECT a.*, s.nome AS servico_nome, s.duracao_minutos, s.preco, f.nome AS filial_nome
            FROM agendamentos_servicos a
            INNER JOIN servicos_farmacia s ON s.id = a.id_servico
            INNER JOIN filiais f ON f.id = a.id_filial
            WHERE a.id_cliente = :customer
            ORDER BY a.data_hora DESC
            LIMIT 50");
        $stmt->execute(['customer' => $customerId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function schedule(int $customerId, int $branchId, int $serviceId, string $dateTime, string $note = ''): int
    {
        $branch = Database::connection()->prepare("SELECT id FROM filiais WHERE id = :id AND status = 'ativa' LIMIT 1");
        $branch->execute(['id' => $branchId]);
        if (!$branch->fetchColumn()) {
            throw new RuntimeException('Filial indisponivel para agendamento.');
        }

        $service = Database::connection()->prepare("SELECT id, duracao_minutos FROM servicos_farmacia WHERE id = :id AND status = 'ativo' LIMIT 1");
        $service->execute(['id' => $serviceId]);
        if (!$service->fetch()) {
            throw new RuntimeException('Servico indisponivel.');
        }

        $at = $this->parseFutureDate($dateTime);
        try {
            Database::connection()->prepare("INSERT INTO agendamentos_servicos (id_cliente, id_filial, id_servico, data_hora, status, observacao)
                VALUES (:customer, :filial, :service, :date_time, 'agendado', :note)")
                ->execute([
                    'customer' => $customerId,
                    'filial' => $branchId,
                    'service' => $serviceId,
                    'date_time' => $at->format('Y-m-d H:i:s'),
                    'note' => trim($note) !== '' ? trim($note) : null,
                ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new RuntimeException('Horario ja reservado para este servico nesta filial.');
            }
            throw $exception;
        }

        return (int) Database::connection()->lastInsertId();
    }

    public function adminAppointments(?int $branchId = null): array
    {
        $params = [];
        $scope = '';
        if ($branchId !== null) {
            (new BranchService())->assertCanAccess($branchId);
            $scope = 'WHERE a.id_filial = :filial';
            $params['filial'] = $branchId;
        } elseif (!is_admin_geral()) {
            $scope = 'WHERE a.id_filial = :filial';
            $params['filial'] = (new BranchService())->currentId();
        }

        $stmt = Database::connection()->prepare("SELECT a.*, s.nome AS servico_nome, s.duracao_minutos, s.preco, f.nome AS filial_nome, u.name AS cliente_nome, u.email AS cliente_email
            FROM agendamentos_servicos a
            INNER JOIN servicos_farmacia s ON s.id = a.id_servico
            INNER JOIN filiais f ON f.id = a.id_filial
            LEFT JOIN customers c ON c.id = a.id_cliente
            LEFT JOIN users u ON u.id = c.user_id
            {$scope}
            ORDER BY a.data_hora DESC
            LIMIT 200");
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function saveService(array $input): int
    {
        $name = trim((string) ($input['nome'] ?? ''));
        if ($name === '') {
            throw new RuntimeException('Nome do servico e obrigatorio.');
        }

        Database::connection()->prepare("INSERT INTO servicos_farmacia (nome, descricao, duracao_minutos, preco, status)
            VALUES (:nome, :descricao, :duracao, :preco, :status)
            ON DUPLICATE KEY UPDATE descricao = VALUES(descricao), duracao_minutos = VALUES(duracao_minutos), preco = VALUES(preco), status = VALUES(status)")
            ->execute([
                'nome' => $name,
                'descricao' => trim((string) ($input['descricao'] ?? '')) ?: null,
                'duracao' => max(5, min(480, (int) ($input['duracao_minutos'] ?? 30))),
                'preco' => max(0, (float) ($input['preco'] ?? 0)),
                'status' => in_array(($input['status'] ?? 'ativo'), ['ativo', 'inativo'], true) ? (string) $input['status'] : 'ativo',
            ]);

        return (int) Database::connection()->lastInsertId();
    }

    public function updateStatus(int $appointmentId, string $status): void
    {
        if (!in_array($status, ['agendado', 'confirmado', 'atendido', 'cancelado', 'faltou'], true)) {
            throw new RuntimeException('Status de agendamento invalido.');
        }

        $stmt = Database::connection()->prepare('SELECT id_filial FROM agendamentos_servicos WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $appointmentId]);
        $branchId = $stmt->fetchColumn();
        if (!$branchId) {
            throw new RuntimeException('Agendamento nao encontrado.');
        }
        (new BranchService())->assertCanAccess((int) $branchId);

        Database::connection()->prepare('UPDATE agendamentos_servicos SET status = :status, atualizado_por = :user, atualizado_em = NOW() WHERE id = :id')
            ->execute(['status' => $status, 'user' => user()['id'] ?? null, 'id' => $appointmentId]);

        (new AuditService())->admin('services', 'appointment_status', 'appointment', $appointmentId, [], ['status' => $status]);
    }

    private function parseFutureDate(string $dateTime): DateTimeImmutable
    {
        $at = new DateTimeImmutable($dateTime);
        if ($at <= new DateTimeImmutable('+30 minutes')) {
            throw new RuntimeException('Escolha um horario futuro com pelo menos 30 minutos de antecedencia.');
        }
        $hour = (int) $at->format('H');
        if ($hour < 7 || $hour > 21) {
            throw new RuntimeException('Agendamentos sao permitidos entre 07:00 e 21:59.');
        }
        return $at;
    }
}
