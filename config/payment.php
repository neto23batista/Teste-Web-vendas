<?php

declare(strict_types=1);

use App\Core\Env;

return [
    'mercado_pago' => [
        'mode' => Env::get('MERCADO_PAGO_MODE', 'sandbox'),
        'access_token' => Env::get('MERCADO_PAGO_ACCESS_TOKEN', ''),
        'webhook_secret' => Env::get('MERCADO_PAGO_WEBHOOK_SECRET', ''),
        'notification_url' => Env::get('MERCADO_PAGO_NOTIFICATION_URL', ''),
    ],
];
