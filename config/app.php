<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'name' => Env::get('APP_NAME', 'FarmaVida'),
    'env' => Env::get('APP_ENV', 'local'),
    'debug' => Env::get('APP_DEBUG', false),
    'url' => Env::get('APP_URL', ''),
    'timezone' => Env::get('APP_TIMEZONE', 'America/Sao_Paulo'),
    'key' => Env::get('APP_KEY', 'change-me'),
    'session_secure' => Env::get('SESSION_SECURE', false),
    'session_name' => Env::get('SESSION_NAME', 'farmavida_session'),
    'upload_max_mb' => (int) Env::get('UPLOAD_MAX_MB', 8),
];

