<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use RuntimeException;

final class MigrationService
{
    public function pending(): array
    {
        $dir = BASE_PATH . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'migrations';
        $files = glob($dir . DIRECTORY_SEPARATOR . '*.sql') ?: [];
        sort($files);

        $db = Database::connection();
        $rows = $db->query("SELECT migration, checksum, status FROM migrations WHERE status = 'ran'")->fetchAll();
        $ran = [];
        foreach ($rows as $row) {
            $ran[$row['migration']] = $row;
        }

        $pending = [];
        foreach ($files as $file) {
            $name = basename($file);
            $checksum = hash_file('sha256', $file);
            if (!isset($ran[$name]) || !hash_equals((string) $ran[$name]['checksum'], (string) $checksum)) {
                $pending[] = ['name' => $name, 'path' => $file, 'checksum' => $checksum];
            }
        }
        return $pending;
    }

    public function runSelected(array $names): array
    {
        $allowed = [];
        foreach ($this->pending() as $item) {
            $allowed[$item['name']] = $item;
        }

        $ran = [];
        foreach ($names as $name) {
            $name = basename((string) $name);
            if (!isset($allowed[$name])) {
                continue;
            }
            if ($name === '000_migrations.sql') {
                continue;
            }
            $sql = file_get_contents($allowed[$name]['path']);
            if ($sql === false) {
                throw new RuntimeException('Nao foi possivel ler ' . $name);
            }
            $module = explode('_', preg_replace('/^\d+_/', '', basename($name, '.sql')) ?? '')[0] ?: 'core';
            $db = Database::connection();
            $start = microtime(true);
            $db->prepare("INSERT INTO migrations (migration, module, batch, checksum, status, started_at) VALUES (:migration, :module, 1, :checksum, 'running', NOW()) ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'running', started_at = NOW(), error_message = NULL")
                ->execute(['migration' => $name, 'module' => $module, 'checksum' => $allowed[$name]['checksum']]);
            try {
                $db->exec($sql);
                $db->prepare("UPDATE migrations SET status = 'ran', finished_at = NOW(), execution_ms = :ms WHERE migration = :migration")
                    ->execute(['ms' => (int) round((microtime(true) - $start) * 1000), 'migration' => $name]);
                $ran[] = $name;
            } catch (\Throwable $exception) {
                $db->prepare("UPDATE migrations SET status = 'failed', finished_at = NOW(), error_message = :error WHERE migration = :migration")
                    ->execute(['error' => $exception->getMessage(), 'migration' => $name]);
                throw $exception;
            }
        }
        return $ran;
    }
}

