<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use PDO;

final class FileCacheService
{
    public function remember(string $key, int $ttlSeconds, callable $callback, ?int $branchId = null): mixed
    {
        $cacheKey = $this->key($key, $branchId);
        $stmt = Database::connection()->prepare('SELECT cache_value FROM app_cache WHERE cache_key = :key AND expires_at > NOW() LIMIT 1');
        $stmt->execute(['key' => $cacheKey]);
        $cached = $stmt->fetchColumn();
        if (is_string($cached) && $cached !== '') {
            $decoded = json_decode($cached, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $decoded;
            }
        }

        $value = $callback();
        Database::connection()->prepare('INSERT INTO app_cache (cache_key, cache_value, id_filial, expires_at)
            VALUES (:key, :value, :filial, :expires_at)
            ON DUPLICATE KEY UPDATE cache_value = VALUES(cache_value), id_filial = VALUES(id_filial), expires_at = VALUES(expires_at), updated_at = NOW()')
            ->execute([
                'key' => $cacheKey,
                'value' => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'filial' => $branchId,
                'expires_at' => date('Y-m-d H:i:s', time() + $ttlSeconds),
            ]);
        return $value;
    }

    public function forgetPrefix(string $prefix, ?int $branchId = null): void
    {
        $like = $this->key($prefix, $branchId) . '%';
        $stmt = Database::connection()->prepare('DELETE FROM app_cache WHERE cache_key LIKE :prefix');
        $stmt->execute(['prefix' => $like]);
    }

    public function prune(): int
    {
        $stmt = Database::connection()->prepare('DELETE FROM app_cache WHERE expires_at <= NOW()');
        $stmt->execute();
        return $stmt->rowCount();
    }

    private function key(string $key, ?int $branchId): string
    {
        return 'filial:' . ($branchId === null ? 'all' : $branchId) . ':' . $key;
    }
}
