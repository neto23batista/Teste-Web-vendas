<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'login_max_attempts' => 5,
    'login_lock_minutes' => 15,
    'password_reset_minutes' => 60,
    'api_rate_limit_per_minute' => 120,
    'checkout_rate_limit_per_minute' => 10,
    'trusted_proxies' => array_values(array_filter(array_map('trim', explode(',', (string) Env::get('TRUSTED_PROXIES', ''))))),
    'headers' => [
        'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
        'X-Frame-Options' => 'SAMEORIGIN',
        'X-Content-Type-Options' => 'nosniff',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'Permissions-Policy' => 'geolocation=(), microphone=(), camera=()',
        'Content-Security-Policy' => "default-src 'self'; img-src 'self' data: https:; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    ],
];
