<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Repositories\OrderRepository;
use App\Services\PaymentService;

final class PaymentController extends Controller
{
    public function mercadoPago(Request $request): void
    {
        $publicId = (string) $request->param('public_id');
        $order = (new OrderRepository())->findByPublicId($publicId);
        if (!$order) {
            Session::flash('error', 'Pedido nao encontrado.');
            Response::redirect('/');
            return;
        }

        $result = (new PaymentService())->createMercadoPagoPreference((int) $order['id']);
        if (!($result['ok'] ?? false)) {
            Session::flash('error', (string) ($result['error'] ?? 'Pagamento indisponivel.'));
            Response::redirect('/pedido/' . $publicId);
            return;
        }
        $url = $result['checkout_url'] ?? null;
        if (!is_string($url) || $url === '') {
            Session::flash('error', 'Mercado Pago nao retornou URL de checkout.');
            Response::redirect('/pedido/' . $publicId);
            return;
        }
        Response::redirect((string) $url);
    }
}
