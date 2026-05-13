<?php

declare(strict_types=1);

use App\Core\Database;

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

$pdo = Database::connection();
$dir = BASE_PATH . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'migrations';
$files = glob($dir . DIRECTORY_SEPARATOR . '*.sql') ?: [];
sort($files);

$bootstrapMigration = $dir . DIRECTORY_SEPARATOR . '000_migrations.sql';
if (is_file($bootstrapMigration)) {
    $pdo->exec((string) file_get_contents($bootstrapMigration));
    $checksum = hash_file('sha256', $bootstrapMigration);
    $pdo->prepare("INSERT INTO migrations (migration, module, batch, checksum, status, started_at, finished_at, execution_ms)
        VALUES ('000_migrations.sql', 'migrations', 1, :checksum, 'ran', NOW(), NOW(), 0)
        ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'ran', updated_at = NOW()")
        ->execute(['checksum' => $checksum]);
}

$batch = (int) ($pdo->query("SELECT COALESCE(MAX(batch), 0) + 1 FROM migrations")->fetchColumn() ?: 1);

foreach ($files as $file) {
    $name = basename($file);
    $module = explode('_', preg_replace('/^\d+_/', '', basename($file, '.sql')) ?? '')[0] ?: 'core';
    $checksum = hash_file('sha256', $file);

    $stmt = $pdo->prepare("SELECT * FROM migrations WHERE migration = :migration AND status = 'ran' LIMIT 1");
    $stmt->execute(['migration' => $name]);
    $existing = $stmt->fetch();
    if ($existing && hash_equals((string) $existing['checksum'], (string) $checksum)) {
        echo "SKIP {$name}\n";
        continue;
    }

    $started = microtime(true);
    $pdo->prepare("INSERT INTO migrations (migration, module, batch, checksum, status, started_at) VALUES (:migration, :module, :batch, :checksum, 'running', NOW()) ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), status = 'running', started_at = NOW(), error_message = NULL")
        ->execute(['migration' => $name, 'module' => $module, 'batch' => $batch, 'checksum' => $checksum]);

    try {
        $sql = file_get_contents($file);
        if ($sql === false) {
            throw new RuntimeException('Nao foi possivel ler migration.');
        }
        $pdo->exec($sql);
        $elapsed = (int) round((microtime(true) - $started) * 1000);
        $pdo->prepare("UPDATE migrations SET status = 'ran', finished_at = NOW(), execution_ms = :ms WHERE migration = :migration")
            ->execute(['ms' => $elapsed, 'migration' => $name]);
        echo "RAN {$name}\n";
    } catch (Throwable $exception) {
        $pdo->prepare("UPDATE migrations SET status = 'failed', finished_at = NOW(), error_message = :error WHERE migration = :migration")
            ->execute(['error' => $exception->getMessage(), 'migration' => $name]);
        throw $exception;
    }
}
