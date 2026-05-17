<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;
use PDOException;
use RuntimeException;

final class ProductReviewService
{
    public function productSummary(int $productId): array
    {
        $stats = Database::connection()->prepare("SELECT COUNT(*) AS total_reviews, COALESCE(AVG(rating), 0) AS average_rating
            FROM product_reviews
            WHERE product_id = :product AND status = 'approved'");
        $stats->execute(['product' => $productId]);
        $row = $stats->fetch() ?: ['total_reviews' => 0, 'average_rating' => 0];

        $reviews = Database::connection()->prepare("SELECT pr.*, u.name AS customer_name
            FROM product_reviews pr
            INNER JOIN customers c ON c.id = pr.customer_id
            INNER JOIN users u ON u.id = c.user_id
            WHERE pr.product_id = :product AND pr.status = 'approved'
            ORDER BY pr.created_at DESC
            LIMIT 12");
        $reviews->execute(['product' => $productId]);

        return [
            'total_reviews' => (int) $row['total_reviews'],
            'average_rating' => round((float) $row['average_rating'], 1),
            'reviews' => $reviews->fetchAll(),
        ];
    }

    public function existingForOrder(int $customerId, int $orderId): array
    {
        $stmt = Database::connection()->prepare('SELECT product_id, order_id, status FROM product_reviews WHERE customer_id = :customer AND order_id = :order_id');
        $stmt->execute(['customer' => $customerId, 'order_id' => $orderId]);
        $rows = [];
        foreach ($stmt->fetchAll() as $row) {
            $rows[(int) $row['product_id']] = $row;
        }
        return $rows;
    }

    public function submit(int $customerId, int $orderId, int $productId, int $rating, string $comment): int
    {
        $rating = max(1, min(5, $rating));
        $comment = trim($comment);
        if (mb_strlen($comment) > 2000) {
            throw new RuntimeException('Comentario muito longo.');
        }

        $stmt = Database::connection()->prepare("SELECT o.id
            FROM orders o
            INNER JOIN order_items oi ON oi.order_id = o.id
            WHERE o.id = :order_id
              AND o.customer_id = :customer
              AND oi.product_id = :product
              AND o.deleted_at IS NULL
              AND (o.status = 'entregue' OR o.payment_status = 'aprovado')
            LIMIT 1");
        $stmt->execute(['order_id' => $orderId, 'customer' => $customerId, 'product' => $productId]);
        if (!$stmt->fetchColumn()) {
            throw new RuntimeException('Avaliacao permitida apenas para produto comprado em pedido aprovado ou entregue.');
        }

        try {
            Database::connection()->prepare("INSERT INTO product_reviews (product_id, customer_id, order_id, rating, comment, status)
                VALUES (:product, :customer, :order_id, :rating, :comment, 'pending')")
                ->execute([
                    'product' => $productId,
                    'customer' => $customerId,
                    'order_id' => $orderId,
                    'rating' => $rating,
                    'comment' => $comment !== '' ? $comment : null,
                ]);
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new RuntimeException('Este produto ja foi avaliado para este pedido.');
            }
            throw $exception;
        }

        return (int) Database::connection()->lastInsertId();
    }

    public function adminList(?int $branchId = null): array
    {
        $params = [];
        $scope = '';
        if ($branchId !== null) {
            (new BranchService())->assertCanAccess($branchId);
            $scope = ' AND o.id_filial = :filial';
            $params['filial'] = $branchId;
        } elseif (!is_admin_geral()) {
            $scope = ' AND o.id_filial = :filial';
            $params['filial'] = (new BranchService())->currentId();
        }

        $stmt = Database::connection()->prepare("SELECT pr.*, p.name AS product_name, u.name AS customer_name, o.order_number, f.nome AS filial_nome
            FROM product_reviews pr
            INNER JOIN products p ON p.id = pr.product_id
            INNER JOIN customers c ON c.id = pr.customer_id
            INNER JOIN users u ON u.id = c.user_id
            LEFT JOIN orders o ON o.id = pr.order_id
            LEFT JOIN filiais f ON f.id = o.id_filial
            WHERE 1=1{$scope}
            ORDER BY FIELD(pr.status, 'pending', 'approved', 'rejected'), pr.created_at DESC
            LIMIT 200");
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function moderate(int $reviewId, string $status, string $note = ''): void
    {
        if (!in_array($status, ['approved', 'rejected'], true)) {
            throw new RuntimeException('Status de avaliacao invalido.');
        }

        $stmt = Database::connection()->prepare("SELECT pr.id, o.id_filial
            FROM product_reviews pr
            LEFT JOIN orders o ON o.id = pr.order_id
            WHERE pr.id = :id
            LIMIT 1");
        $stmt->execute(['id' => $reviewId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Avaliacao nao encontrada.');
        }
        if (!empty($row['id_filial'])) {
            (new BranchService())->assertCanAccess((int) $row['id_filial']);
        }

        Database::connection()->prepare('UPDATE product_reviews
            SET status = :status,
                moderation_note = :note,
                moderated_by = :user,
                moderated_at = NOW(),
                updated_at = NOW()
            WHERE id = :id')
            ->execute([
                'status' => $status,
                'note' => trim($note) !== '' ? trim($note) : null,
                'user' => user()['id'] ?? null,
                'id' => $reviewId,
            ]);

        (new AuditService())->admin('reviews', 'moderated', 'product_review', $reviewId, [], ['status' => $status]);
    }
}
