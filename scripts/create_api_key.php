<?php

declare(strict_types=1);

use App\Core\Database;

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

$name = $argv[1] ?? 'ERP';
$rawScopes = $argv[2] ?? '["products:read","orders:read","stock:write"]';
$decodedScopes = json_decode($rawScopes, true);
if (!is_array($decodedScopes)) {
    $decodedScopes = json_decode(stripslashes($rawScopes), true);
}
if (!is_array($decodedScopes)) {
    $decodedScopes = ['products:read', 'orders:read', 'stock:write'];
}
$scopes = json_encode(array_values($decodedScopes), JSON_UNESCAPED_UNICODE);
$secret = 'fv_' . bin2hex(random_bytes(32));

Database::connection()->prepare("INSERT INTO api_keys (public_id, name, key_prefix, key_hash, scopes, status) VALUES (:public_id, :name, :prefix, :hash, :scopes, 'active')")
    ->execute([
        'public_id' => uuid_v4(),
        'name' => $name,
        'prefix' => substr($secret, 0, 10),
        'hash' => hash('sha256', $secret),
        'scopes' => $scopes,
    ]);

echo "API Key criada. Guarde agora, ela nao sera exibida novamente:\n{$secret}\n";
