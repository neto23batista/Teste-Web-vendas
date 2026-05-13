<?php

declare(strict_types=1);

use App\Core\Database;

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

$name = $argv[1] ?? null;
$email = $argv[2] ?? null;
$password = $argv[3] ?? null;

if (!$name || !$email || !$password) {
    echo "Uso: php scripts/create_admin.php \"Nome\" email@dominio.com SenhaForte123\n";
    exit(1);
}

$pdo = Database::connection();
$pdo->beginTransaction();
try {
    $pdo->prepare("INSERT INTO users (public_id, user_type, name, email, password_hash, status) VALUES (:public_id, 'admin', :name, :email, :password, 'active')")
        ->execute(['public_id' => uuid_v4(), 'name' => $name, 'email' => strtolower($email), 'password' => password_hash($password, PASSWORD_BCRYPT)]);
    $userId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO admins (user_id, display_name, position, status) VALUES (:user, :name, 'Administrador', 'active')")
        ->execute(['user' => $userId, 'name' => $name]);
    $roleId = $pdo->query("SELECT id FROM roles WHERE slug = 'owner' LIMIT 1")->fetchColumn();
    if ($roleId) {
        $pdo->prepare('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (:user, :role)')->execute(['user' => $userId, 'role' => $roleId]);
    }
    $pdo->commit();
    echo "Admin criado: {$email}\n";
} catch (Throwable $exception) {
    $pdo->rollBack();
    throw $exception;
}
