<?php

declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Controllers\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Repositories\CustomerRepository;
use App\Repositories\OrderRepository;
use App\Services\LGPDService;

final class DashboardController extends Controller
{
    public function index(Request $request): void
    {
        $customerId = (int) Session::get('customer_id');
        $this->render('customer/dashboard', [
            'title' => 'Minha conta',
            'orders' => (new OrderRepository())->latest($customerId, 5),
        ]);
    }

    public function orders(Request $request): void
    {
        $this->render('customer/orders', [
            'title' => 'Meus pedidos',
            'orders' => (new OrderRepository())->latest((int) Session::get('customer_id'), 50),
        ]);
    }

    public function order(Request $request): void
    {
        $repo = new OrderRepository();
        $order = $repo->findForCustomer((int) $request->param('id'), (int) Session::get('customer_id'));
        $this->render('customer/order', [
            'title' => 'Pedido',
            'order' => $order,
            'items' => $order ? $repo->items((int) $order['id']) : [],
        ]);
    }

    public function profile(Request $request): void
    {
        $this->render('customer/profile', [
            'title' => 'Perfil',
            'customer' => (new CustomerRepository())->findByUserId((int) user()['id']),
        ]);
    }

    public function lgpdExport(Request $request): void
    {
        Response::json(['ok' => true, 'data' => (new LGPDService())->exportCustomerData((int) Session::get('customer_id'))]);
    }

    public function lgpdRequest(Request $request): void
    {
        (new LGPDService())->request((int) Session::get('customer_id'), (string) $request->input('request_type', 'export'), (string) $request->input('description', ''));
        $this->redirect('/cliente/perfil', 'Solicitacao LGPD registrada.');
    }
}
