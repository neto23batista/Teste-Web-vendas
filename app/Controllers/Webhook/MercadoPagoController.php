<?php

declare(strict_types=1);

namespace App\Controllers\Webhook;

use App\Controllers\Controller;
use App\Core\Request;
use App\Services\PaymentService;

final class MercadoPagoController extends Controller
{
    public function receive(Request $request): void
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $result = (new PaymentService())->handleMercadoPagoWebhook($_GET, $request->json(), $headers);
        $this->json($result, $result['ok'] ? 200 : 401);
    }
}

