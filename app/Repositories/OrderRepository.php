<?php

declare(strict_types=1);

namespace App\Repositories;

final class OrderRepository extends BaseRepository
{
    public function latest(?int $customerId = null, int $limit = 20, array $filters = []): array
    {
        $limit = max(1, min(200, $limit));
        $params = [];
        $where = 'o.deleted_at IS NULL';
        if ($customerId !== null) {
            $where .= ' AND o.customer_id = :customer_id';
            $params['customer_id'] = $customerId;
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && $status !== 'all') {
            $where .= ' AND o.status = :status';
            $params['status'] = $status;
        }

        $priority = trim((string) ($filters['priority'] ?? ''));
        if ($priority !== '' && $priority !== 'all') {
            $where .= ' AND o.priority = :priority';
            $params['priority'] = $priority;
        }

        $delivery = trim((string) ($filters['delivery_method'] ?? ''));
        if ($delivery !== '' && $delivery !== 'all') {
            $where .= ' AND o.delivery_method = :delivery_method';
            $params['delivery_method'] = $delivery;
        }

        $problem = trim((string) ($filters['problem'] ?? ''));
        if ($problem === '1' || $problem === 'problem') {
            $where .= ' AND o.has_problem = 1';
        } elseif ($problem === '0' || $problem === 'clear') {
            $where .= ' AND o.has_problem = 0';
        }

        $query = trim((string) ($filters['q'] ?? ''));
        if ($query !== '') {
            $where .= ' AND (o.order_number LIKE :q OR u.name LIKE :q OR u.email LIKE :q OR o.customer_snapshot LIKE :q)';
            $params['q'] = '%' . $query . '%';
        }

        $stmt = $this->db->prepare("SELECT
                o.*,
                COALESCE(u.name, JSON_UNQUOTE(JSON_EXTRACT(o.customer_snapshot, '$.name'))) AS customer_name,
                u.email AS customer_email,
                u.phone AS customer_phone,
                c.cpf_masked,
                COALESCE(item_stats.item_count, 0) AS item_count,
                COALESCE(item_stats.prescription_item_count, 0) AS prescription_item_count,
                COALESCE(item_stats.controlled_item_count, 0) AS controlled_item_count,
                COALESCE(note_stats.internal_note_count, 0) AS internal_note_count,
                COALESCE(note_stats.customer_note_count, 0) AS customer_note_count,
                hist.last_status_at,
                TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) AS age_minutes
            FROM orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            LEFT JOIN users u ON u.id = c.user_id
            LEFT JOIN (
                SELECT
                    order_id,
                    COUNT(*) AS item_count,
                    SUM(requires_prescription = 1) AS prescription_item_count,
                    SUM(is_controlled = 1) AS controlled_item_count
                FROM order_items
                GROUP BY order_id
            ) item_stats ON item_stats.order_id = o.id
            LEFT JOIN (
                SELECT
                    order_id,
                    SUM(visibility = 'internal') AS internal_note_count,
                    SUM(visibility = 'customer') AS customer_note_count
                FROM order_internal_notes
                WHERE deleted_at IS NULL
                GROUP BY order_id
            ) note_stats ON note_stats.order_id = o.id
            LEFT JOIN (
                SELECT order_id, MAX(created_at) AS last_status_at
                FROM order_status_history
                GROUP BY order_id
            ) hist ON hist.order_id = o.id
            WHERE {$where}
            ORDER BY
                CASE WHEN o.status IN ('entregue', 'cancelado') THEN 1 ELSE 0 END ASC,
                o.has_problem DESC,
                CASE o.priority WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END ASC,
                o.created_at DESC
            LIMIT :limit");
        foreach ($params as $key => $value) {
            $type = is_int($value) ? \PDO::PARAM_INT : \PDO::PARAM_STR;
            $stmt->bindValue(':' . $key, $value, $type);
        }
        $stmt->bindValue(':limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function adminSummary(): array
    {
        $row = $this->db->query("SELECT
                COUNT(*) AS total_orders,
                COALESCE(SUM(status NOT IN ('entregue', 'cancelado')), 0) AS open_orders,
                COALESCE(SUM(status = 'aguardando_pagamento'), 0) AS waiting_payment,
                COALESCE(SUM(status IN ('aguardando_receita', 'receita_enviada', 'receita_em_validacao') OR clinical_status IN ('aguardando_receita', 'receita_enviada', 'em_validacao')), 0) AS prescription_queue,
                COALESCE(SUM(status IN ('em_separacao', 'conferido')), 0) AS fulfillment_queue,
                COALESCE(SUM(status IN ('saiu_para_entrega', 'pronto_para_retirada')), 0) AS dispatch_queue,
                COALESCE(SUM(has_problem = 1), 0) AS problem_orders,
                COALESCE(SUM(priority IN ('urgent', 'critical') AND status NOT IN ('entregue', 'cancelado')), 0) AS urgent_orders
            FROM orders
            WHERE deleted_at IS NULL")->fetch();

        return $row ?: [];
    }

    public function findForCustomer(int $id, int $customerId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM orders WHERE id = :id AND customer_id = :customer_id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['id' => $id, 'customer_id' => $customerId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function findByPublicId(string $publicId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM orders WHERE public_id = :public_id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['public_id' => $publicId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function publicStatus(string $publicId): ?array
    {
        $stmt = $this->db->prepare('SELECT public_id, order_number, status, payment_status, clinical_status, delivery_status, estimated_delivery_at, updated_at FROM orders WHERE public_id = :public_id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['public_id' => $publicId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function visibleHistory(int $orderId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM order_status_history WHERE order_id = :id AND visible_to_customer = 1 ORDER BY created_at');
        $stmt->execute(['id' => $orderId]);
        return $stmt->fetchAll();
    }

    public function publicIdFor(int $id): ?string
    {
        $stmt = $this->db->prepare('SELECT public_id FROM orders WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['id' => $id]);
        $value = $stmt->fetchColumn();
        return is_string($value) && $value !== '' ? $value : null;
    }

    public function find(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT
                o.*,
                COALESCE(u.name, JSON_UNQUOTE(JSON_EXTRACT(o.customer_snapshot, '$.name'))) AS customer_name,
                COALESCE(u.email, JSON_UNQUOTE(JSON_EXTRACT(o.customer_snapshot, '$.email'))) AS customer_email,
                u.phone AS customer_phone,
                c.cpf_masked
            FROM orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            LEFT JOIN users u ON u.id = c.user_id
            WHERE o.id = :id AND o.deleted_at IS NULL
            LIMIT 1");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function items(int $orderId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM order_items WHERE order_id = :id ORDER BY id');
        $stmt->execute(['id' => $orderId]);
        return $stmt->fetchAll();
    }

    public function history(int $orderId, bool $visibleOnly = false): array
    {
        $where = 'h.order_id = :id';
        if ($visibleOnly) {
            $where .= ' AND h.visible_to_customer = 1';
        }

        $stmt = $this->db->prepare("SELECT h.*, u.name AS changed_by_name
            FROM order_status_history h
            LEFT JOIN users u ON u.id = h.changed_by
            WHERE {$where}
            ORDER BY h.created_at DESC, h.id DESC");
        $stmt->execute(['id' => $orderId]);
        return $stmt->fetchAll();
    }

    public function notes(int $orderId, ?string $visibility = null): array
    {
        $where = 'n.order_id = :id AND n.deleted_at IS NULL';
        $params = ['id' => $orderId];
        if ($visibility !== null) {
            $where .= ' AND n.visibility = :visibility';
            $params['visibility'] = $visibility;
        }

        $stmt = $this->db->prepare("SELECT n.*, u.name AS created_by_name
            FROM order_internal_notes n
            LEFT JOIN users u ON u.id = n.created_by
            WHERE {$where}
            ORDER BY n.created_at DESC, n.id DESC");
        $stmt->execute($params);
        return $stmt->fetchAll();
    }
}
