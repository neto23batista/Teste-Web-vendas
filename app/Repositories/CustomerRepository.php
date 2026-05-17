<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use App\Core\Session;
use PDO;
use PDOException;
use RuntimeException;

final class CustomerRepository extends BaseRepository
{
    public function findByUserId(int $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT c.*, u.name, u.email, u.phone FROM customers c INNER JOIN users u ON u.id = c.user_id WHERE c.user_id = :user_id LIMIT 1');
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

    public function updateProfile(int $userId, int $customerId, array $data): void
    {
        $name = trim((string) ($data['name'] ?? ''));
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $phone = trim((string) ($data['phone'] ?? ''));
        $birthDate = trim((string) ($data['birth_date'] ?? ''));
        $gender = (string) ($data['gender'] ?? 'not_informed');
        $marketing = !empty($data['marketing_opt_in']) ? 1 : 0;

        if ($name === '') {
            throw new RuntimeException('Nome e obrigatorio.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('E-mail invalido.');
        }
        if ($birthDate !== '' && !$this->validDate($birthDate)) {
            throw new RuntimeException('Data de nascimento invalida.');
        }
        if (!in_array($gender, ['female', 'male', 'non_binary', 'not_informed'], true)) {
            $gender = 'not_informed';
        }

        $stmt = $this->db->prepare('SELECT COUNT(*) FROM users WHERE email = :email AND id <> :id AND deleted_at IS NULL');
        $stmt->execute(['email' => $email, 'id' => $userId]);
        if ((int) $stmt->fetchColumn() > 0) {
            throw new RuntimeException('E-mail ja cadastrado para outro usuario.');
        }

        try {
            Database::transaction(function (PDO $pdo) use ($userId, $customerId, $name, $email, $phone, $birthDate, $gender, $marketing): void {
                $pdo->prepare('UPDATE users SET name = :name, email = :email, phone = :phone, updated_at = NOW() WHERE id = :id')
                    ->execute([
                        'name' => $name,
                        'email' => $email,
                        'phone' => $phone !== '' ? $phone : null,
                        'id' => $userId,
                    ]);

                $pdo->prepare('UPDATE customers
                    SET birth_date = :birth_date,
                        gender = :gender,
                        marketing_opt_in = :marketing,
                        marketing_opt_in_at = CASE WHEN :marketing_for_date = 1 AND marketing_opt_in_at IS NULL THEN NOW() ELSE marketing_opt_in_at END,
                        updated_at = NOW()
                    WHERE id = :customer_id AND user_id = :user_id')
                    ->execute([
                        'birth_date' => $birthDate !== '' ? $birthDate : null,
                        'gender' => $gender,
                        'marketing' => $marketing,
                        'marketing_for_date' => $marketing,
                        'customer_id' => $customerId,
                        'user_id' => $userId,
                    ]);
            });
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new RuntimeException('E-mail ja cadastrado para outro usuario.');
            }
            throw $exception;
        }

        $user = user();
        if ($user && (int) ($user['id'] ?? 0) === $userId) {
            $user['name'] = $name;
            $user['email'] = $email;
            $user['phone'] = $phone !== '' ? $phone : null;
            Session::put('user', $user);
        }
    }

    private function validDate(string $value): bool
    {
        $date = \DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value && $date <= new \DateTimeImmutable('today');
    }
}
