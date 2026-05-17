<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use RuntimeException;

final class PrescriptionService
{
    private array $allowed = ['application/pdf', 'image/jpeg', 'image/png'];

    public function store(int $orderId, ?int $customerId, array $file): int
    {
        $orderStmt = Database::connection()->prepare('SELECT id_filial FROM orders WHERE id = :id LIMIT 1');
        $orderStmt->execute(['id' => $orderId]);
        $branchId = (int) ($orderStmt->fetchColumn() ?: (new BranchService())->currentId());

        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Falha no upload da receita.');
        }
        $max = (int) config('app.upload_max_mb', 8) * 1024 * 1024;
        if ((int) $file['size'] > $max) {
            throw new RuntimeException('Receita excede o tamanho maximo permitido.');
        }

        $mime = mime_content_type((string) $file['tmp_name']) ?: (string) $file['type'];
        if (!in_array($mime, $this->allowed, true)) {
            throw new RuntimeException('Formato de receita nao permitido.');
        }

        $extension = match ($mime) {
            'application/pdf' => 'pdf',
            'image/png' => 'png',
            default => 'jpg',
        };
        $dir = STORAGE_PATH . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'prescriptions' . DIRECTORY_SEPARATOR . date('Y') . DIRECTORY_SEPARATOR . date('m');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $name = uuid_v4() . '.' . $extension;
        $target = $dir . DIRECTORY_SEPARATOR . $name;
        if (!move_uploaded_file((string) $file['tmp_name'], $target)) {
            if (!rename((string) $file['tmp_name'], $target)) {
                throw new RuntimeException('Nao foi possivel armazenar a receita.');
            }
        }

        $hash = hash_file('sha256', $target);
        $stmt = Database::connection()->prepare("INSERT INTO prescriptions (public_id, order_id, id_filial, customer_id, uploaded_by_user_id, file_storage_path, original_filename, mime_type, file_size, file_hash, prescription_type, status, received_ip, received_user_agent)
            VALUES (:public_id, :order_id, :filial, :customer_id, :user_id, :path, :original, :mime, :size, :hash, :type, 'receita_enviada', :ip, :ua)");
        $stmt->execute([
            'public_id' => uuid_v4(),
            'order_id' => $orderId,
            'filial' => $branchId,
            'customer_id' => $customerId,
            'user_id' => user()['id'] ?? null,
            'path' => $target,
            'original' => substr((string) $file['name'], 0, 190),
            'mime' => $mime,
            'size' => (int) $file['size'],
            'hash' => $hash,
            'type' => 'other',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ]);
        $id = (int) Database::connection()->lastInsertId();
        $this->audit($id, $orderId, 'uploaded', null, 'receita_enviada');
        return $id;
    }

    public function validate(int $prescriptionId, string $decision, string $note = ''): void
    {
        if (!is_farmaceutico() && !is_admin_geral() && !is_gerente_loja()) {
            throw new RuntimeException('Apenas farmaceutico, gerente da loja ou admin geral pode validar receitas.');
        }

        $status = $decision === 'approve' ? 'liberado' : ($decision === 'block' ? 'bloqueado_orientacao_farmaceutica' : 'rejeitado');
        $stmt = Database::connection()->prepare('SELECT pr.*, o.id_filial AS order_filial FROM prescriptions pr INNER JOIN orders o ON o.id = pr.order_id WHERE pr.id = :id LIMIT 1');
        $stmt->execute(['id' => $prescriptionId]);
        $prescription = $stmt->fetch();
        if (!$prescription) {
            throw new RuntimeException('Receita nao encontrada.');
        }
        (new BranchService())->assertCanAccess((int) $prescription['order_filial']);

        Database::connection()->prepare('UPDATE prescriptions SET status = :status, pharmacist_notes = :note, rejection_reason = IF(:status_for_rejection = "rejeitado", :rejection_note, rejection_reason), validated_by_user_id = :user, validated_at = NOW() WHERE id = :id')
            ->execute(['status' => $status, 'status_for_rejection' => $status, 'note' => $note, 'rejection_note' => $note, 'user' => user()['id'] ?? null, 'id' => $prescriptionId]);
        Database::connection()->prepare('UPDATE orders SET clinical_status = :clinical, status = :order_status WHERE id = :id')
            ->execute([
                'clinical' => $status,
                'order_status' => $status === 'liberado' ? 'liberado_pelo_farmaceutico' : ($status === 'rejeitado' ? 'receita_rejeitada' : 'aguardando_receita'),
                'id' => $prescription['order_id'],
            ]);
        $this->audit($prescriptionId, (int) $prescription['order_id'], $decision === 'approve' ? 'approved' : 'rejected', (string) $prescription['status'], $status, $note);
        $emailStmt = Database::connection()->prepare('SELECT u.email FROM orders o INNER JOIN customers c ON c.id = o.customer_id INNER JOIN users u ON u.id = c.user_id WHERE o.id = :order_id LIMIT 1');
        $emailStmt->execute(['order_id' => $prescription['order_id']]);
        $email = (string) ($emailStmt->fetchColumn() ?: '');
        if ($email !== '') {
            (new EmailService())->queue($status === 'liberado' ? 'prescription_approved' : 'prescription_rejected', $email, $status === 'liberado' ? 'Receita aprovada' : 'Receita rejeitada', 'emails/order_status', ['status' => $status], (int) $prescription['order_id']);
        }
        (new WebhookService())->dispatch($status === 'liberado' ? 'receita_aprovada' : 'receita_rejeitada', 'prescription', $prescriptionId);
    }

    private function audit(int $prescriptionId, int $orderId, string $action, ?string $previous, ?string $new, ?string $notes = null): void
    {
        $branchStmt = Database::connection()->prepare('SELECT id_filial FROM orders WHERE id = :id LIMIT 1');
        $branchStmt->execute(['id' => $orderId]);
        $branchId = (int) ($branchStmt->fetchColumn() ?: 0) ?: null;
        Database::connection()->prepare('INSERT INTO prescription_audits (prescription_id, order_id, id_filial, action, previous_status, new_status, actor_user_id, actor_role, ip_address, user_agent, notes) VALUES (:prescription, :order_id, :filial, :action, :previous, :new, :actor, :role, :ip, :ua, :notes)')
            ->execute([
                'prescription' => $prescriptionId,
                'order_id' => $orderId,
                'filial' => $branchId,
                'action' => $action,
                'previous' => $previous,
                'new' => $new,
                'actor' => user()['id'] ?? null,
                'role' => user()['user_type'] ?? 'customer',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
                'notes' => $notes,
            ]);
    }
}
