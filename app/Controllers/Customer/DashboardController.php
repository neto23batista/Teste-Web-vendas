<?php

declare(strict_types=1);

namespace App\Controllers\Customer;

use App\Controllers\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Repositories\CustomerRepository;
use App\Repositories\OrderRepository;
use App\Services\AppointmentService;
use App\Services\BranchService;
use App\Services\LGPDService;
use App\Services\LoyaltyService;
use App\Services\ProductReviewService;

final class DashboardController extends Controller
{
    public function index(Request $request): void
    {
        $customerId = (int) Session::get('customer_id');
        $this->render('customer/dashboard', [
            'title' => 'Minha conta',
            'orders' => (new OrderRepository())->latest($customerId, 5),
            'loyalty' => (new LoyaltyService())->summary($customerId),
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
            'existingReviews' => $order ? (new ProductReviewService())->existingForOrder((int) Session::get('customer_id'), (int) $order['id']) : [],
        ]);
    }

    public function loyalty(Request $request): void
    {
        $this->render('customer/loyalty', [
            'title' => 'Pontos de fidelidade',
            'data' => (new LoyaltyService())->summary((int) Session::get('customer_id')),
        ]);
    }

    public function services(Request $request): void
    {
        $appointmentService = new AppointmentService();
        $this->render('customer/services', [
            'title' => 'Servicos da farmacia',
            'services' => $appointmentService->services(),
            'branches' => (new BranchService())->all(),
            'appointments' => $appointmentService->customerAppointments((int) Session::get('customer_id')),
        ]);
    }

    public function serviceSchedule(Request $request): void
    {
        try {
            (new AppointmentService())->schedule(
                (int) Session::get('customer_id'),
                (int) $request->input('id_filial'),
                (int) $request->input('id_servico'),
                (string) $request->input('data_hora'),
                (string) $request->input('observacao', '')
            );
            $this->redirect('/cliente/servicos', 'Servico agendado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/cliente/servicos');
        }
    }

    public function reviewStore(Request $request): void
    {
        try {
            (new ProductReviewService())->submit(
                (int) Session::get('customer_id'),
                (int) $request->input('order_id'),
                (int) $request->input('product_id'),
                (int) $request->input('rating'),
                (string) $request->input('comment', '')
            );
            $this->redirect('/cliente/pedidos/' . (int) $request->input('order_id'), 'Avaliacao enviada para moderacao.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/cliente/pedidos/' . (int) $request->input('order_id'));
        }
    }

    public function profile(Request $request): void
    {
        $this->render('customer/profile', [
            'title' => 'Perfil',
            'customer' => (new CustomerRepository())->findByUserId((int) user()['id']),
        ]);
    }

    public function profileUpdate(Request $request): void
    {
        try {
            (new CustomerRepository())->updateProfile((int) user()['id'], (int) Session::get('customer_id'), $request->all());
            $this->redirect('/cliente/perfil', 'Perfil atualizado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $this->safeProfileError($exception));
            $this->redirect('/cliente/perfil');
        }
    }

    public function lgpdExport(Request $request): void
    {
        Response::json(['ok' => true, 'data' => (new LGPDService())->exportCustomerData((int) Session::get('customer_id'))]);
    }

    public function lgpdRequest(Request $request): void
    {
        try {
            (new LGPDService())->request((int) Session::get('customer_id'), (string) $request->input('request_type', 'export'), (string) $request->input('description', ''));
            $this->redirect('/cliente/perfil', 'Solicitacao LGPD registrada.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage() === 'Tipo de solicitacao LGPD invalido.' ? $exception->getMessage() : 'Nao foi possivel registrar a solicitacao LGPD.');
            $this->redirect('/cliente/perfil');
        }
    }

    private function safeProfileError(\Throwable $exception): string
    {
        $safe = [
            'Data de nascimento invalida.',
            'E-mail invalido.',
            'E-mail ja cadastrado para outro usuario.',
            'Nome e obrigatorio.',
        ];

        if (in_array($exception->getMessage(), $safe, true)) {
            return $exception->getMessage();
        }

        app_log('error', 'Customer profile update failed', [
            'exception' => $exception::class,
            'message' => $exception->getMessage(),
            'user_id' => user()['id'] ?? null,
        ]);

        return 'Nao foi possivel atualizar o perfil. Verifique os dados e tente novamente.';
    }
}
