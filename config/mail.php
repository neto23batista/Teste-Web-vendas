<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'host' => Env::get('SMTP_HOST', ''),
    'port' => (int) Env::get('SMTP_PORT', 587),
    'username' => Env::get('SMTP_USERNAME', ''),
    'password' => Env::get('SMTP_PASSWORD', ''),
    'from_email' => Env::get('SMTP_FROM_EMAIL', 'nao-responda@farmavida.local'),
    'from_name' => Env::get('SMTP_FROM_NAME', 'FarmaVida'),
];

