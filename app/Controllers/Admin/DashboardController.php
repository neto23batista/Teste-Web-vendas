<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Controllers\Controller;
use App\Core\Database;
use App\Core\Request;
use App\Core\Session;
use App\Repositories\OrderRepository;
use App\Repositories\ProductRepository;
use App\Services\AdminStaffService;
use App\Services\AppointmentService;
use App\Services\BranchService;
use App\Services\CashRegisterService;
use App\Services\InvoiceService;
use App\Services\MigrationService;
use App\Services\OrderService;
use App\Services\PrescriptionService;
use App\Services\ProductReviewService;
use App\Services\ProductService;
use App\Services\PurchaseService;
use App\Services\ReportService;
use App\Services\StockService;
use App\Services\StockTransferService;

final class DashboardController extends Controller
{
    public function index(Request $request): void
    {
        $this->render('admin/dashboard', ['title' => 'Dashboard', 'data' => (new ReportService())->dashboard($request->all())], 'layouts/admin');
    }

    public function products(Request $request): void
    {
        $filters = $request->all();
        $filters['id_filial'] = (new BranchService())->selectedIdFromRequest($request) ?? 'all';
        $data = (new ProductService())->adminCatalog($filters, (int) $request->input('page', 1));
        $this->render('admin/products/index', array_merge($data, ['title' => 'Produtos']), 'layouts/admin');
    }

    public function productCreate(Request $request): void
    {
        $repo = new ProductRepository();
        $this->render('admin/products/form', ['title' => 'Novo produto', 'product' => null, 'categories' => $repo->categories(), 'brands' => $repo->brands()], 'layouts/admin');
    }

    public function productStore(Request $request): void
    {
        try {
            (new ProductService())->createFromAdmin($request->all(), $request->file('main_image'));
            $this->redirect('/admin/produtos', 'Produto criado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/produtos/novo');
        }
    }

    public function productEdit(Request $request): void
    {
        $repo = new ProductRepository();
        $this->render('admin/products/form', [
            'title' => 'Editar produto',
            'product' => $repo->find((int) $request->param('id')),
            'categories' => $repo->categories(),
            'brands' => $repo->brands(),
        ], 'layouts/admin');
    }

    public function productUpdate(Request $request): void
    {
        try {
            (new ProductService())->updateFromAdmin((int) $request->param('id'), $request->all(), $request->file('main_image'));
            $this->redirect('/admin/produtos', 'Produto atualizado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/produtos/' . $request->param('id') . '/editar');
        }
    }

    public function orders(Request $request): void
    {
        $filters = [
            'q' => (string) $request->input('q', ''),
            'status' => (string) $request->input('status', 'all'),
            'priority' => (string) $request->input('priority', 'all'),
            'problem' => (string) $request->input('problem', 'all'),
            'delivery_method' => (string) $request->input('delivery_method', 'all'),
            'id_filial' => (new BranchService())->selectedIdFromRequest($request) ?? 'all',
        ];
        $repo = new OrderRepository();
        $this->render('admin/orders/index', [
            'title' => 'Pedidos',
            'orders' => $repo->latest(null, 120, $filters),
            'summary' => $repo->adminSummary(),
            'filters' => $filters,
            'statusGroups' => OrderService::statusGroups(),
            'priorityOptions' => OrderService::priorityOptions(),
        ], 'layouts/admin');
    }

    public function orderShow(Request $request): void
    {
        $repo = new OrderRepository();
        $id = (int) $request->param('id');
        $order = $repo->find($id);
        $this->render('admin/orders/show', [
            'title' => 'Pedido',
            'order' => $order,
            'items' => $order ? $repo->items($id) : [],
            'history' => $order ? $repo->history($id) : [],
            'notes' => $order ? $repo->notes($id) : [],
            'statusControls' => $order ? OrderService::statusControlsFor($order) : [],
            'priorityOptions' => OrderService::priorityOptions(),
        ], 'layouts/admin');
    }

    public function orderStatus(Request $request): void
    {
        $id = (int) $request->param('id');
        $redirect = (string) $request->input('redirect_to', '/admin/pedidos/' . $id);
        $payload = $request->all();
        $options = [];
        foreach (['priority', 'has_problem', 'problem_reason', 'internal_note', 'visible_to_customer'] as $key) {
            if (array_key_exists($key, $payload)) {
                $options[$key] = $payload[$key];
            }
        }

        try {
            $message = (string) $request->input('message', $request->input('customer_message', ''));
            (new OrderService())->updateStatus($id, (string) $request->input('status'), $message, $options);
            if (is_json_request()) {
                $this->json(['ok' => true, 'reload' => true]);
                return;
            }
            $this->redirect($redirect, 'Pedido atualizado.');
        } catch (\Throwable $exception) {
            if (is_json_request()) {
                $this->json(['ok' => false, 'error' => $exception->getMessage()], 422);
                return;
            }
            Session::flash('error', $exception->getMessage());
            $this->redirect($redirect);
        }
    }

    public function customers(Request $request): void
    {
        $rows = Database::connection()->query("SELECT c.id, c.cpf_masked, c.accepts_lgpd, c.account_status, c.last_order_at, c.created_at, u.name, u.email, u.phone, u.status AS user_status
            FROM customers c
            INNER JOIN users u ON u.id = c.user_id
            WHERE c.deleted_at IS NULL
            ORDER BY c.created_at DESC
            LIMIT 200")->fetchAll();
        $this->render('admin/customers', ['title' => 'Clientes', 'rows' => $rows], 'layouts/admin');
    }

    public function staff(Request $request): void
    {
        $service = new AdminStaffService();
        $filters = [
            'q' => (string) $request->input('q', ''),
            'role' => (string) $request->input('role', 'all'),
            'status' => (string) $request->input('status', 'all'),
            'id_filial' => (new BranchService())->selectedIdFromRequest($request) ?? 'all',
        ];
        $this->render('admin/staff', [
            'title' => 'Funcionarios',
            'rows' => $service->list($filters),
            'filters' => $filters,
            'summary' => $service->summary(),
            'roleOptions' => $service->roleOptions(is_owner()),
            'statusOptions' => $service->statusOptions(),
            'canCreateOwner' => is_owner(),
        ], 'layouts/admin');
    }

    public function staffStore(Request $request): void
    {
        try {
            (new AdminStaffService())->create($request->all(), $request->file('profile_photo'), $request);
            $this->redirect('/admin/funcionarios', 'Funcionario criado com seguranca.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/funcionarios');
        }
    }

    public function staffUpdate(Request $request): void
    {
        $id = (int) $request->param('id');
        try {
            (new AdminStaffService())->update($id, $request->all(), $request->file('profile_photo'), $request);
            $this->redirect('/admin/funcionarios', 'Funcionario atualizado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/funcionarios');
        }
    }

    public function staffStatus(Request $request): void
    {
        $id = (int) $request->param('id');
        try {
            (new AdminStaffService())->changeStatus($id, (string) $request->input('status'));
            $this->redirect('/admin/funcionarios', 'Status do funcionario atualizado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/funcionarios');
        }
    }

    public function staffDelete(Request $request): void
    {
        $id = (int) $request->param('id');
        try {
            (new AdminStaffService())->delete($id);
            $this->redirect('/admin/funcionarios', 'Funcionario removido com auditoria.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/funcionarios');
        }
    }

    public function cash(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $service = new CashRegisterService();
        $this->render('admin/cash', [
            'title' => 'Caixa',
            'current' => $branchId === null ? null : $service->current($branchId),
            'rows' => $service->report($branchId),
        ], 'layouts/admin');
    }

    public function cashOpen(Request $request): void
    {
        try {
            (new CashRegisterService())->open((float) $request->input('valor_abertura', 0), (new BranchService())->selectedIdFromRequest($request, false));
            $this->redirect('/admin/caixa', 'Caixa aberto.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/caixa');
        }
    }

    public function cashMovement(Request $request): void
    {
        try {
            (new CashRegisterService())->movement((int) $request->input('id_caixa'), (string) $request->input('tipo'), (string) $request->input('forma_pagamento'), (float) $request->input('valor'), (string) $request->input('descricao'));
            $this->redirect('/admin/caixa', 'Movimentacao de caixa registrada.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/caixa');
        }
    }

    public function cashClose(Request $request): void
    {
        try {
            (new CashRegisterService())->close((int) $request->param('id'), (float) $request->input('valor_fechamento'));
            $this->redirect('/admin/caixa', 'Caixa fechado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/caixa');
        }
    }

    public function purchases(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $service = new PurchaseService();
        $this->render('admin/purchases', [
            'title' => 'Compras',
            'suppliers' => $service->suppliers(),
            'orders' => $service->orders($branchId),
        ], 'layouts/admin');
    }

    public function supplierStore(Request $request): void
    {
        try {
            (new PurchaseService())->createSupplier($request->all());
            $this->redirect('/admin/compras', 'Fornecedor salvo.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/compras');
        }
    }

    public function purchaseOrderStore(Request $request): void
    {
        try {
            (new PurchaseService())->createOrder($request->all());
            $this->redirect('/admin/compras', 'Ordem de compra criada.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/compras');
        }
    }

    public function purchaseOrderReceive(Request $request): void
    {
        try {
            (new PurchaseService())->receive((int) $request->param('id'));
            $this->redirect('/admin/compras', 'Mercadoria recebida e estoque movimentado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/compras');
        }
    }

    public function stock(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $rows = (new StockService())->listRisk($branchId, 200);
        $this->render('admin/stock', ['title' => 'Estoque', 'rows' => $rows], 'layouts/admin');
    }

    public function stockMove(Request $request): void
    {
        try {
            $branchId = (new BranchService())->selectedIdFromRequest($request, false);
            $type = (string) $request->input('movement_type');
            (new StockService())->move(
                (int) $request->input('product_id'),
                $this->manualStockQuantity((int) $request->input('quantity'), $type),
                $type,
                (string) $request->input('reason'),
                $branchId
            );
            $this->redirect('/admin/estoque', 'Movimentacao registrada.');
        } catch (\Throwable $exception) {
            Session::flash('error', $this->safeStockMovementError($exception));
            $this->redirect('/admin/estoque');
        }
    }

    public function stockTransfers(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $service = new StockTransferService();
        $this->render('admin/stock_transfers', [
            'title' => 'Transferencias de estoque',
            'rows' => $service->list($branchId),
            'originBranches' => $service->originBranchesForForm(),
            'destinationBranches' => $service->destinationBranchesForForm(),
            'products' => $service->productsForForm($branchId),
            'selectedBranchId' => $branchId,
        ], 'layouts/admin');
    }

    public function stockTransferStore(Request $request): void
    {
        try {
            (new StockTransferService())->request(
                (int) $request->input('product_id'),
                (int) $request->input('id_filial_origem'),
                (int) $request->input('id_filial_destino'),
                (int) $request->input('quantidade'),
                (string) $request->input('observacao', '')
            );
            $this->redirect('/admin/estoque/transferencias', 'Transferencia solicitada.');
        } catch (\Throwable $exception) {
            $this->flashStockTransferError($exception, 'request');
            $this->redirect('/admin/estoque/transferencias');
        }
    }

    public function stockTransferAction(Request $request): void
    {
        try {
            $service = new StockTransferService();
            match ((string) $request->input('action')) {
                'approve' => $service->approve((int) $request->param('id')),
                'dispatch' => $service->dispatch((int) $request->param('id')),
                'complete' => $service->complete((int) $request->param('id')),
                'cancel' => $service->cancel((int) $request->param('id')),
                default => throw new \RuntimeException('Acao invalida.'),
            };
            $this->redirect('/admin/estoque/transferencias', 'Transferencia atualizada.');
        } catch (\Throwable $exception) {
            $this->flashStockTransferError($exception, 'action');
            $this->redirect('/admin/estoque/transferencias');
        }
    }

    public function prescriptions(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $params = [];
        $where = '';
        if ($branchId !== null) {
            $where = 'WHERE id_filial = :filial';
            $params['filial'] = $branchId;
        }
        $stmt = Database::connection()->prepare("SELECT * FROM v_prescription_queue {$where} ORDER BY created_at DESC LIMIT 100");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $this->render('admin/prescriptions', ['title' => 'Receitas', 'rows' => $rows], 'layouts/admin');
    }

    public function prescriptionValidate(Request $request): void
    {
        (new PrescriptionService())->validate((int) $request->param('id'), (string) $request->input('decision'), (string) $request->input('note', ''));
        $this->redirect('/admin/receitas', 'Receita atualizada.');
    }

    public function prescriptionFile(Request $request): void
    {
        $id = (int) $request->param('id');
        $stmt = Database::connection()->prepare('SELECT pr.*, o.id_filial FROM prescriptions pr INNER JOIN orders o ON o.id = pr.order_id WHERE pr.id = :id AND pr.deleted_at IS NULL LIMIT 1');
        $stmt->execute(['id' => $id]);
        $prescription = $stmt->fetch();
        if (!$prescription) {
            http_response_code(404);
            echo view('errors/404', ['title' => 'Receita nao encontrada']);
            return;
        }
        (new BranchService())->assertCanAccess((int) $prescription['id_filial']);
        (new \App\Services\AuditService())->sensitive((int) ($prescription['customer_id'] ?? 0), 'prescription', 'Validacao farmaceutica', 'view', 'prescription', $id);

        $path = (string) $prescription['file_storage_path'];
        if (!is_file($path)) {
            http_response_code(404);
            echo view('errors/404', ['title' => 'Arquivo nao encontrado']);
            return;
        }

        header('Content-Type: ' . (string) $prescription['mime_type']);
        header('Content-Disposition: inline; filename="' . basename((string) $prescription['original_filename']) . '"');
        header('Content-Length: ' . filesize($path));
        readfile($path);
    }

    public function payments(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $params = [];
        $scope = $branchId === null ? '' : ' WHERE p.id_filial = :filial';
        if ($branchId !== null) {
            $params['filial'] = $branchId;
        }
        $stmt = Database::connection()->prepare("SELECT p.*, o.order_number FROM payments p INNER JOIN orders o ON o.id = p.order_id{$scope} ORDER BY p.created_at DESC LIMIT 100");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $this->render('admin/payments', ['title' => 'Pagamentos', 'rows' => $rows], 'layouts/admin');
    }

    public function invoices(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $params = [];
        $scope = $branchId === null ? '' : ' WHERE i.id_filial = :filial';
        if ($branchId !== null) {
            $params['filial'] = $branchId;
        }
        $stmt = Database::connection()->prepare('SELECT i.*, o.order_number, nf.status AS fiscal_status, nf.provedor, nf.ambiente, nf.erro AS fiscal_erro FROM invoices i INNER JOIN orders o ON o.id = i.order_id LEFT JOIN notas_fiscais nf ON nf.id_pedido = o.id' . $scope . ' ORDER BY i.issued_at DESC LIMIT 100');
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $this->render('admin/invoices', ['title' => 'Fiscal', 'rows' => $rows, 'fiscalReadiness' => (new \App\Services\FiscalService())->readiness()], 'layouts/admin');
    }

    public function invoiceIssue(Request $request): void
    {
        (new InvoiceService())->issue((int) $request->input('order_id'));
        $this->redirect('/admin/nfe', 'NF-e simulada emitida.');
    }

    public function reports(Request $request): void
    {
        $input = $request->all();
        $input['id_filial'] = (new BranchService())->selectedIdFromRequest($request) ?? 'all';
        $report = (new ReportService())->decisionDashboard($input);
        $this->render('admin/reports/index', array_merge(['title' => 'Relatorios'], $report), 'layouts/admin');
    }

    public function integrations(Request $request): void
    {
        $db = Database::connection();
        $this->render('admin/integrations', [
            'title' => 'Integracoes',
            'apiKeys' => $db->query('SELECT id, public_id, name, key_prefix, scopes, status, last_used_at, created_at FROM api_keys ORDER BY created_at DESC')->fetchAll(),
            'webhooks' => $db->query('SELECT * FROM outgoing_webhooks ORDER BY created_at DESC')->fetchAll(),
        ], 'layouts/admin');
    }

    public function apiKeyStore(Request $request): void
    {
        $secret = 'fv_' . bin2hex(random_bytes(32));
        $scopes = $this->normalizeJsonArray((string) $request->input('scopes', '["products:read","orders:read"]'), ['products:read', 'orders:read']);
        Database::connection()->prepare("INSERT INTO api_keys (public_id, name, key_prefix, key_hash, scopes, status, created_by) VALUES (:public_id, :name, :prefix, :hash, :scopes, 'active', :user)")
            ->execute([
                'public_id' => uuid_v4(),
                'name' => (string) $request->input('name', 'ERP'),
                'prefix' => substr($secret, 0, 10),
                'hash' => hash('sha256', $secret),
                'scopes' => json_encode($scopes, JSON_UNESCAPED_UNICODE),
                'user' => user()['id'] ?? null,
            ]);
        Session::flash('success', 'API Key criada. Guarde agora: ' . $secret);
        $this->redirect('/admin/integracoes');
    }

    public function outgoingWebhookStore(Request $request): void
    {
        Database::connection()->prepare("INSERT INTO outgoing_webhooks (public_id, name, event_type, target_url, secret_hash, status, created_by) VALUES (:public_id, :name, :event, :url, :secret, 'active', :user)")
            ->execute([
                'public_id' => uuid_v4(),
                'name' => (string) $request->input('name'),
                'event' => (string) $request->input('event_type'),
                'url' => (string) $request->input('target_url'),
                'secret' => $request->input('secret') ? hash('sha256', (string) $request->input('secret')) : null,
                'user' => user()['id'] ?? null,
            ]);
        $this->redirect('/admin/integracoes', 'Webhook de saida criado.');
    }

    public function incomingWebhookStore(Request $request): void
    {
        $token = bin2hex(random_bytes(24));
        $scopes = $this->normalizeJsonArray((string) $request->input('scopes', '["external:write"]'), ['external:write']);
        Database::connection()->prepare("INSERT INTO incoming_webhooks (public_id, name, source, endpoint_token_hash, scopes, status, created_by) VALUES (:public_id, :name, :source, :hash, :scopes, 'active', :user)")
            ->execute([
                'public_id' => uuid_v4(),
                'name' => (string) $request->input('name'),
                'source' => (string) $request->input('source', 'custom'),
                'hash' => hash('sha256', $token),
                'scopes' => json_encode($scopes, JSON_UNESCAPED_UNICODE),
                'user' => user()['id'] ?? null,
            ]);
        Session::flash('success', 'Webhook de entrada criado: /webhooks/incoming/' . $token);
        $this->redirect('/admin/integracoes');
    }

    public function marketing(Request $request): void
    {
        $db = Database::connection();
        $this->render('admin/marketing', [
            'title' => 'Marketing',
            'coupons' => $db->query('SELECT * FROM coupons ORDER BY created_at DESC')->fetchAll(),
            'promotions' => $db->query('SELECT * FROM promotions ORDER BY created_at DESC')->fetchAll(),
            'banners' => $db->query('SELECT * FROM banners ORDER BY created_at DESC')->fetchAll(),
        ], 'layouts/admin');
    }

    public function couponStore(Request $request): void
    {
        Database::connection()->prepare("INSERT INTO coupons (code, name, description, discount_type, discount_value, minimum_order_value, max_discount_value, usage_limit, usage_limit_per_customer, applies_to, starts_at, ends_at, status, created_by)
            VALUES (:code, :name, :description, :type, :value, :min, :max, :limit_total, :limit_customer, :applies, :starts, :ends, 'active', :user)
            ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), discount_type = VALUES(discount_type), discount_value = VALUES(discount_value), minimum_order_value = VALUES(minimum_order_value), max_discount_value = VALUES(max_discount_value), usage_limit = VALUES(usage_limit), usage_limit_per_customer = VALUES(usage_limit_per_customer), applies_to = VALUES(applies_to), starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), updated_at = NOW()")
            ->execute([
                'code' => strtoupper((string) $request->input('code')),
                'name' => (string) $request->input('name'),
                'description' => (string) $request->input('description'),
                'type' => (string) $request->input('discount_type'),
                'value' => (float) $request->input('discount_value', 0),
                'min' => $request->input('minimum_order_value') !== '' ? (float) $request->input('minimum_order_value') : null,
                'max' => $request->input('max_discount_value') !== '' ? (float) $request->input('max_discount_value') : null,
                'limit_total' => $request->input('usage_limit') !== '' ? (int) $request->input('usage_limit') : null,
                'limit_customer' => $request->input('usage_limit_per_customer') !== '' ? (int) $request->input('usage_limit_per_customer') : null,
                'applies' => (string) $request->input('applies_to', 'all'),
                'starts' => $request->input('starts_at') ?: null,
                'ends' => $request->input('ends_at') ?: null,
                'user' => user()['id'] ?? null,
            ]);
        $this->redirect('/admin/marketing', 'Cupom salvo.');
    }

    public function promotionStore(Request $request): void
    {
        $name = (string) $request->input('name');
        Database::connection()->prepare("INSERT INTO promotions (name, slug, description, promotion_type, discount_type, discount_value, starts_at, ends_at, is_featured, status, created_by)
            VALUES (:name, :slug, :description, :promotion_type, :discount_type, :discount_value, :starts, :ends, :featured, 'active', :user)
            ON DUPLICATE KEY UPDATE description = VALUES(description), promotion_type = VALUES(promotion_type), discount_type = VALUES(discount_type), discount_value = VALUES(discount_value), starts_at = VALUES(starts_at), ends_at = VALUES(ends_at), is_featured = VALUES(is_featured), updated_at = NOW()")
            ->execute([
                'name' => $name,
                'slug' => str_slug($name),
                'description' => (string) $request->input('description'),
                'promotion_type' => (string) $request->input('promotion_type', 'flash'),
                'discount_type' => (string) $request->input('discount_type', 'percent'),
                'discount_value' => (float) $request->input('discount_value', 0),
                'starts' => (string) $request->input('starts_at'),
                'ends' => (string) $request->input('ends_at'),
                'featured' => !empty($request->input('is_featured')) ? 1 : 0,
                'user' => user()['id'] ?? null,
            ]);
        $this->redirect('/admin/marketing', 'Promocao salva.');
    }

    public function bannerStore(Request $request): void
    {
        Database::connection()->prepare("INSERT INTO banners (title, subtitle, image_path, mobile_image_path, target_url, position, display_order, starts_at, ends_at, is_active, created_by)
            VALUES (:title, :subtitle, :image, :mobile, :url, :position, :order, :starts, :ends, 1, :user)")
            ->execute([
                'title' => (string) $request->input('title'),
                'subtitle' => (string) $request->input('subtitle'),
                'image' => (string) $request->input('image_path', '/assets/img/farmavida-hero.png'),
                'mobile' => (string) $request->input('mobile_image_path', ''),
                'url' => (string) $request->input('target_url', '/catalogo'),
                'position' => (string) $request->input('position', 'home_hero'),
                'order' => (int) $request->input('display_order', 0),
                'starts' => $request->input('starts_at') ?: null,
                'ends' => $request->input('ends_at') ?: null,
                'user' => user()['id'] ?? null,
            ]);
        $this->redirect('/admin/marketing', 'Banner salvo.');
    }

    public function reviews(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $this->render('admin/reviews', [
            'title' => 'Avaliacoes',
            'rows' => (new ProductReviewService())->adminList($branchId),
        ], 'layouts/admin');
    }

    public function reviewModerate(Request $request): void
    {
        try {
            (new ProductReviewService())->moderate((int) $request->param('id'), (string) $request->input('status'), (string) $request->input('moderation_note', ''));
            $this->redirect('/admin/avaliacoes', 'Avaliacao moderada.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/avaliacoes');
        }
    }

    public function services(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $service = new AppointmentService();
        $this->render('admin/services', [
            'title' => 'Servicos clinicos',
            'services' => $service->services(false),
            'appointments' => $service->adminAppointments($branchId),
        ], 'layouts/admin');
    }

    public function serviceStore(Request $request): void
    {
        try {
            (new AppointmentService())->saveService($request->all());
            $this->redirect('/admin/servicos', 'Servico salvo.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/servicos');
        }
    }

    public function serviceAppointmentStatus(Request $request): void
    {
        try {
            (new AppointmentService())->updateStatus((int) $request->param('id'), (string) $request->input('status'));
            $this->redirect('/admin/servicos', 'Agendamento atualizado.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/servicos');
        }
    }

    public function delivery(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request);
        $params = [];
        $scope = $branchId === null ? '' : ' WHERE id_filial = :filial';
        if ($branchId !== null) {
            $params['filial'] = $branchId;
        }
        $zones = Database::connection()->prepare('SELECT * FROM delivery_zones' . $scope . ' ORDER BY name');
        $zones->execute($params);
        $people = Database::connection()->prepare('SELECT * FROM delivery_people' . $scope . ' ORDER BY name');
        $people->execute($params);
        $this->render('admin/delivery', [
            'title' => 'Entrega',
            'zones' => $zones->fetchAll(),
            'people' => $people->fetchAll(),
        ], 'layouts/admin');
    }

    public function deliveryZoneStore(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request, false);
        Database::connection()->prepare("INSERT INTO delivery_zones (id_filial, name, zone_type, district, postal_code_start, postal_code_end, city, state, max_distance_km, fee, minimum_order_value, free_shipping_minimum, estimated_minutes, is_active)
            VALUES (:filial, :name, :type, :district, :start, :end, :city, :state, :distance, :fee, :minimum, :free, :minutes, 1)
            ON DUPLICATE KEY UPDATE zone_type = VALUES(zone_type), district = VALUES(district), postal_code_start = VALUES(postal_code_start), postal_code_end = VALUES(postal_code_end), city = VALUES(city), state = VALUES(state), max_distance_km = VALUES(max_distance_km), fee = VALUES(fee), minimum_order_value = VALUES(minimum_order_value), free_shipping_minimum = VALUES(free_shipping_minimum), estimated_minutes = VALUES(estimated_minutes), updated_at = NOW()")
            ->execute([
                'filial' => $branchId,
                'name' => (string) $request->input('name'),
                'type' => (string) $request->input('zone_type', 'district'),
                'district' => (string) $request->input('district'),
                'start' => (string) $request->input('postal_code_start'),
                'end' => (string) $request->input('postal_code_end'),
                'city' => (string) $request->input('city'),
                'state' => strtoupper((string) $request->input('state')),
                'distance' => $request->input('max_distance_km') !== '' ? (float) $request->input('max_distance_km') : null,
                'fee' => (float) $request->input('fee', 0),
                'minimum' => $request->input('minimum_order_value') !== '' ? (float) $request->input('minimum_order_value') : null,
                'free' => $request->input('free_shipping_minimum') !== '' ? (float) $request->input('free_shipping_minimum') : null,
                'minutes' => $request->input('estimated_minutes') !== '' ? (int) $request->input('estimated_minutes') : null,
            ]);
        $this->redirect('/admin/entrega', 'Zona de entrega salva.');
    }

    public function deliveryPersonStore(Request $request): void
    {
        $branchId = (new BranchService())->selectedIdFromRequest($request, false);
        Database::connection()->prepare("INSERT INTO delivery_people (id_filial, name, phone, vehicle_type, vehicle_plate, status) VALUES (:filial, :name, :phone, :vehicle, :plate, 'available')")
            ->execute([
                'filial' => $branchId,
                'name' => (string) $request->input('name'),
                'phone' => (string) $request->input('phone'),
                'vehicle' => (string) $request->input('vehicle_type', 'motorcycle'),
                'plate' => (string) $request->input('vehicle_plate'),
            ]);
        $this->redirect('/admin/entrega', 'Entregador salvo.');
    }

    public function settings(Request $request): void
    {
        $this->render('admin/settings/index', [
            'title' => 'Configuracoes',
            'settings' => Database::connection()->query('SELECT * FROM settings ORDER BY setting_group, setting_key')->fetchAll(),
            'migrations' => Database::connection()->query('SELECT * FROM migrations ORDER BY id DESC LIMIT 50')->fetchAll(),
            'pendingMigrations' => (new MigrationService())->pending(),
        ], 'layouts/admin');
    }

    public function migrationRun(Request $request): void
    {
        $selected = $request->input('migrations', []);
        $selected = is_array($selected) ? $selected : [$selected];
        try {
            $ran = (new MigrationService())->runSelected($selected);
            $this->redirect('/admin/configuracoes', $ran ? 'Migrations executadas: ' . implode(', ', $ran) : 'Nenhuma migration pendente selecionada.');
        } catch (\Throwable $exception) {
            Session::flash('error', $exception->getMessage());
            $this->redirect('/admin/configuracoes');
        }
    }

    public function logs(Request $request): void
    {
        $this->render('admin/logs', [
            'title' => 'Logs',
            'security' => Database::connection()->query('SELECT * FROM security_events ORDER BY created_at DESC LIMIT 50')->fetchAll(),
            'audit' => Database::connection()->query('SELECT * FROM admin_action_logs ORDER BY created_at DESC LIMIT 50')->fetchAll(),
        ], 'layouts/admin');
    }

    public function jobs(Request $request): void
    {
        $rows = Database::connection()->query("SELECT * FROM jobs WHERE status IN ('pendente','falhou','processando') ORDER BY executar_em DESC LIMIT 100")->fetchAll();
        $this->render('admin/jobs', ['title' => 'Jobs', 'rows' => $rows], 'layouts/admin');
    }

    public function danfe(Request $request): void
    {
        $id = (int) $request->param('id');
        $stmt = Database::connection()->prepare('SELECT * FROM invoices WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $invoice = $stmt->fetch();
        $items = [];
        if ($invoice) {
            $itemsStmt = Database::connection()->prepare('SELECT * FROM invoice_items WHERE invoice_id = :id');
            $itemsStmt->execute(['id' => $id]);
            $items = $itemsStmt->fetchAll();
        }
        $this->render('admin/danfe', ['title' => 'DANFE simulada', 'invoice' => $invoice, 'items' => $items], 'layouts/print');
    }

    private function normalizeJsonArray(string $raw, array $default): array
    {
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            $decoded = json_decode(stripslashes($raw), true);
        }
        if (!is_array($decoded)) {
            return $default;
        }
        return array_values($decoded);
    }

    private function flashStockTransferError(\Throwable $exception, string $operation): void
    {
        $message = $exception->getMessage();
        $safeMessages = [
            'Acao invalida.',
            'Acesso negado para esta filial.',
            'Filial origem e destino devem ser diferentes.',
            'Filial origem nao possui saldo suficiente para solicitar transferencia.',
            'Filial invalida ou inativa para transferencia.',
            'Produto e filiais sao obrigatorios.',
            'Produto inexistente no estoque da filial destino.',
            'Produto nao encontrado no estoque da filial origem.',
            'Quantidade de transferencia invalida.',
            'Somente transferencias solicitadas ou aprovadas podem ser canceladas sem estorno.',
            'Transferencia geraria estoque negativo na filial origem.',
            'Transferencia nao esta no status esperado para esta acao.',
            'Transferencia nao encontrada.',
        ];

        if (!in_array($message, $safeMessages, true)) {
            app_log('error', 'Stock transfer admin failure', [
                'operation' => $operation,
                'exception' => $exception::class,
                'message' => $message,
            ]);
            $message = 'Nao foi possivel processar a transferencia. Verifique os dados e tente novamente.';
        }

        Session::flash('error', $message);
    }

    private function manualStockQuantity(int $quantity, string $type): int
    {
        if ($quantity === 0) {
            throw new \RuntimeException('Quantidade de movimentacao invalida.');
        }

        if (in_array($type, ['ajuste_negativo', 'perda', 'vencimento'], true)) {
            return -abs($quantity);
        }

        if (in_array($type, ['ajuste_positivo', 'devolucao'], true)) {
            return abs($quantity);
        }

        return $quantity;
    }

    private function safeStockMovementError(\Throwable $exception): string
    {
        $safe = [
            'Acesso negado para esta filial.',
            'Movimento deixaria estoque negativo.',
            'Produto nao encontrado no estoque da filial.',
            'Quantidade de movimentacao invalida.',
        ];

        if (in_array($exception->getMessage(), $safe, true)) {
            return $exception->getMessage();
        }

        app_log('error', 'Stock movement admin failure', [
            'exception' => $exception::class,
            'message' => $exception->getMessage(),
        ]);

        return 'Nao foi possivel registrar a movimentacao de estoque.';
    }
}
