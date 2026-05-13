<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Repositories\OrderRepository;
use App\Services\PaymentService;

final class OrderTrackingController extends Controller
{
    public function show(Request $request): void
    {
        $repo = new OrderRepository();
        $order = $repo->findByPublicId((string) $request->param('public_id'));
        $this->render('store/order_tracking', [
            'title' => 'Acompanhar pedido',
            'order' => $order,
            'items' => $order ? $repo->items((int) $order['id']) : [],
            'history' => $order ? $repo->visibleHistory((int) $order['id']) : [],
            'paymentReadiness' => $order ? (new PaymentService())->mercadoPagoReadiness() : null,
        ]);
    }

    public function status(Request $request): void
    {
        $order = (new OrderRepository())->publicStatus((string) $request->param('public_id'));
        if ($order) {
            $order['status_label'] = status_label($order['status']);
        }
        $this->json(['ok' => true, 'order' => $order]);
    }
}
