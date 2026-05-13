<?php

declare(strict_types=1);

use App\Core\Database;

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

$pdo = Database::connection();
$files = glob(BASE_PATH . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'seeders' . DIRECTORY_SEPARATOR . '*.sql') ?: [];
sort($files);

foreach ($files as $file) {
    $sql = file_get_contents($file);
    if ($sql === false) {
        throw new RuntimeException('Nao foi possivel ler seeder ' . basename($file));
    }
    $pdo->exec($sql);
    echo 'SEEDED ' . basename($file) . PHP_EOL;
}
