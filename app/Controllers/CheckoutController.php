<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Session;
use App\Repositories\OrderRepository;
use App\Services\CartService;
use App\Services\OrderService;

final class CheckoutController extends Controller
{
    public function show(Request $request): void
    {
        $this->render('store/checkout', ['title' => 'Checkout', 'summary' => (new CartService())->summary()]);
    }

    public function process(Request $request): void
    {
        if (empty($request->input('lgpd_accept'))) {
            Session::flash('error', 'Aceite LGPD obrigatorio para concluir o pedido.');
            $this->redirect('/checkout');
            return;
        }
        if (!valid_cpf((string) $request->input('cpf'))) {
            Session::flash('error', 'CPF invalido.');
            $this->redirect('/checkout');
            return;
        }

        try {
            $orderId = (new OrderService())->checkout($request->all(), $request->file('prescription'));
            $publicId = (new OrderRepository())->publicIdFor($orderId);
            $this->redirect('/pedido/' . ($publicId ?: $orderId), 'Pedido criado com sucesso.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/checkout');
        }
    }
}
