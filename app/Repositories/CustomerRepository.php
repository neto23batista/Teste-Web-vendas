<?php

declare(strict_types=1);

namespace App\Repositories;

final class CustomerRepository extends BaseRepository
{
    public function findByUserId(int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM customers WHERE user_id = :user_id LIMIT 1');
        $stmt->execute(['user_id' => $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function addresses(int $customerId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM customer_addresses WHERE customer_id = :id AND deleted_at IS NULL ORDER BY is_default DESC, id DESC');
        $stmt->execute(['id' => $customerId]);
        return $stmt->fetchAll();
    }

    public function defaultAddress(int $customerId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM customer_addresses WHERE customer_id = :id AND deleted_at IS NULL ORDER BY is_default DESC, id DESC LIMIT 1');
        $stmt->execute(['id' => $customerId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}

