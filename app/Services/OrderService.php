<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Session;
use App\Repositories\CustomerRepository;
use PDO;
use RuntimeException;

final class OrderService
{
    private const ALLOWED_STATUSES = [
        'pedido_recebido',
        'aguardando_pagamento',
        'pagamento_em_analise',
        'pagamento_confirmado',
        'aguardando_receita',
        'receita_enviada',
        'receita_em_validacao',
        'receita_aprovada',
        'receita_rejeitada',
        'liberado_pelo_farmaceutico',
        'em_separacao',
        'conferido',
        'saiu_para_entrega',
        'pronto_para_retirada',
        'entregue',
        'cancelado',
    ];

    private const PRIORITIES = ['normal', 'urgent', 'critical'];

    public static function allowedStatuses(): array
    {
        return self::ALLOWED_STATUSES;
    }

    public static function priorityOptions(): array
    {
        return self::PRIORITIES;
    }

    public static function statusGroups(): array
    {
        return [
            'Entrada' => ['pedido_recebido', 'aguardando_pagamento', 'pagamento_em_analise', 'pagamento_confirmado'],
            'Receita' => ['aguardando_receita', 'receita_enviada', 'receita_em_validacao', 'receita_aprovada', 'receita_rejeitada', 'liberado_pelo_farmaceutico'],
            'Separacao' => ['em_separacao', 'conferido'],
            'Entrega ou retirada' => ['saiu_para_entrega', 'pronto_para_retirada'],
            'Fechamento' => ['entregue', 'cancelado'],
        ];
    }

    public static function statusControlsFor(array $order): array
    {
        $recommended = self::recommendedStatuses((string) ($order['status'] ?? ''), !empty($order['requires_prescription']), (string) ($order['delivery_method'] ?? 'pickup'));
        $controls = [];

        foreach (self::statusGroups() as $group => $statuses) {
            foreach ($statuses as $status) {
                $controls[$group][] = [
                    'status' => $status,
                    'label' => status_label($status),
                    'recommended' => in_array($status, $recommended, true),
                    'warning' => self::statusWarning($order, $status),
                ];
            }
        }

        return $controls;
    }

    public function checkout(array $data, array $file = null): int
    {
        $cartService = new CartService();
        $summary = $cartService->summary();
        $cart = $summary['cart'];
        $items = $summary['items'];
        $branchId = (int) ($cart['id_filial'] ?? (new BranchService())->currentId());
        (new BranchService())->assertCanAccess($branchId);

        if (!$items) {
            throw new RuntimeException('Carrinho vazio.');
        }

        foreach ($items as $item) {
            if ((int) $item['current_stock'] < (int) $item['quantity']) {
                throw new RuntimeException('Estoque insuficiente para ' . $item['name']);
            }
            if ($item['remote_sale_policy'] === 'blocked') {
                throw new RuntimeException('Pedido contem medicamento controlado bloqueado para venda automatica.');
            }
        }

        $hasPrescription = array_sum(array_map(static fn (array $i): int => (int) $i['requires_prescription'], $items)) > 0;
        if ($hasPrescription && (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK)) {
            throw new RuntimeException('Envie a receita para concluir este pedido.');
        }

        $customerId = Session::get('customer_id');
        $address = [
            'recipient_name' => $data['name'] ?? '',
            'postal_code' => $data['postal_code'] ?? '',
            'street' => $data['street'] ?? '',
            'number' => $data['number'] ?? '',
            'district' => $data['district'] ?? '',
            'city' => $data['city'] ?? '',
            'state' => $data['state'] ?? '',
            'complement' => $data['complement'] ?? '',
        ];
        $delivery = (new DeliveryService())->calculate((string) ($data['delivery_method'] ?? 'pickup'), $address, (float) $cart['subtotal'], $branchId);
        if (!empty($delivery['error'])) {
            throw new RuntimeException((string) $delivery['error']);
        }
        $coupon = (new CouponService())->apply((string) ($data['coupon_code'] ?? ''), (float) $cart['subtotal'], (float) $delivery['fee']);
        $eligibleForLoyalty = max(0.0, (float) $cart['subtotal'] - (float) $coupon['discount']);
        $requestedLoyaltyPoints = (int) ($data['loyalty_points'] ?? 0);
        $loyalty = ['points' => 0, 'discount' => 0.0, 'coupon_code' => null];
        if ($requestedLoyaltyPoints > 0) {
            if (!$customerId) {
                throw new RuntimeException('Entre na conta para resgatar pontos.');
            }
            $loyalty = (new LoyaltyService())->previewRedemption((int) $customerId, $requestedLoyaltyPoints, $eligibleForLoyalty);
        }
        $discount = $coupon['discount'] + $coupon['delivery_discount'] + $loyalty['discount'];
        $grandTotal = max(0, (float) $cart['subtotal'] + (float) $delivery['fee'] - $discount);

        return (int) Database::transaction(function (PDO $pdo) use ($cart, $items, $customerId, $data, $address, $delivery, $coupon, $loyalty, $eligibleForLoyalty, $requestedLoyaltyPoints, $discount, $grandTotal, $hasPrescription, $file, $branchId): int {
            $number = 'FV' . date('YmdHis') . random_int(100, 999);
            $status = $hasPrescription ? 'aguardando_receita' : 'aguardando_pagamento';
            $clinical = $hasPrescription ? 'aguardando_receita' : 'nao_exige_receita';

            $pdo->prepare("INSERT INTO orders (
                public_id, id_filial, order_number, customer_id, cart_id, status, payment_status, clinical_status,
                delivery_method, requires_prescription, has_controlled_items, subtotal, discount_total,
                coupon_discount, loyalty_points_redeemed, loyalty_discount, delivery_fee, grand_total, coupon_code, customer_note, delivery_address_snapshot,
                customer_snapshot, created_ip, created_user_agent
            ) VALUES (
                :public_id, :filial, :number, :customer_id, :cart_id, :status, 'aguardando_pagamento', :clinical,
                :delivery_method, :requires_prescription, :controlled, :subtotal, :discount,
                :coupon_discount, :loyalty_points, :loyalty_discount, :delivery_fee, :grand_total, :coupon_code, :note, :address,
                :customer, :ip, :ua
            )")->execute([
                'public_id' => uuid_v4(),
                'filial' => $branchId,
                'number' => $number,
                'customer_id' => $customerId ?: null,
                'cart_id' => $cart['id'],
                'status' => $status,
                'clinical' => $clinical,
                'delivery_method' => $data['delivery_method'] ?? 'pickup',
                'requires_prescription' => $hasPrescription ? 1 : 0,
                'controlled' => $this->hasControlled($items) ? 1 : 0,
                'subtotal' => $cart['subtotal'],
                'discount' => $discount,
                'coupon_discount' => $coupon['discount'],
                'loyalty_points' => $loyalty['points'],
                'loyalty_discount' => $loyalty['discount'],
                'delivery_fee' => $delivery['fee'],
                'grand_total' => $grandTotal,
                'coupon_code' => $coupon['coupon']['code'] ?? null,
                'note' => $data['customer_note'] ?? null,
                'address' => json_encode($address, JSON_UNESCAPED_UNICODE),
                'customer' => json_encode(['name' => $data['name'] ?? null, 'email' => $data['email'] ?? null, 'cpf' => mask_cpf((string) ($data['cpf'] ?? ''))], JSON_UNESCAPED_UNICODE),
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ]);
            $orderId = (int) $pdo->lastInsertId();

            if ($requestedLoyaltyPoints > 0 && $customerId) {
                $redemption = (new LoyaltyService())->consumeForOrder($pdo, (int) $customerId, $orderId, (int) $cart['id'], $requestedLoyaltyPoints, $eligibleForLoyalty);
                $pdo->prepare('UPDATE orders SET loyalty_redemption_id = :redemption, loyalty_points_redeemed = :points, loyalty_discount = :discount WHERE id = :id')
                    ->execute([
                        'redemption' => $redemption['id'],
                        'points' => $redemption['points'],
                        'discount' => $redemption['discount'],
                        'id' => $orderId,
                    ]);
            }

            foreach ($items as $item) {
                $pdo->prepare("INSERT INTO order_items (
                    order_id, product_id, batch_id, product_name, product_sku, ean, active_ingredient,
                    anvisa_registration, quantity, unit_price, promotional_unit_price, discount_total, line_total,
                    cost_unit_price, requires_prescription, prescription_type, is_controlled, is_thermosensitive, product_snapshot
                ) VALUES (
                    :order_id, :product_id, :batch_id, :name, :sku, :ean, :active, :anvisa, :qty, :unit, :promo,
                    :discount, :line, :cost, :requires, :type, :controlled, :thermo, :snapshot
                )")->execute([
                    'order_id' => $orderId,
                    'product_id' => $item['product_id'],
                    'batch_id' => $item['batch_id'],
                    'name' => $item['name'],
                    'sku' => $item['product_id'],
                    'ean' => null,
                    'active' => null,
                    'anvisa' => null,
                    'qty' => $item['quantity'],
                    'unit' => $item['unit_price'],
                    'promo' => $item['promotional_unit_price'],
                    'discount' => $item['discount_total'],
                    'line' => $item['line_total'],
                    'cost' => null,
                    'requires' => $item['requires_prescription'],
                    'type' => $item['prescription_type'],
                    'controlled' => in_array($item['prescription_type'], ['controlled', 'psychotropic'], true) ? 1 : 0,
                    'thermo' => 0,
                    'snapshot' => json_encode($item, JSON_UNESCAPED_UNICODE),
                ]);
            }

            $pdo->prepare("INSERT INTO order_status_history (order_id, new_status, new_clinical_status, visible_to_customer, message_to_customer, source) VALUES (:id, :status, :clinical, 1, 'Pedido recebido pela FarmaVida.', 'customer')")
                ->execute(['id' => $orderId, 'status' => $status, 'clinical' => $clinical]);

            $pdo->prepare("UPDATE carts SET status = 'converted', converted_order_id = :order_id WHERE id = :cart_id")
                ->execute(['order_id' => $orderId, 'cart_id' => $cart['id']]);
            Session::forget('cart_id');

            if ($hasPrescription && $file) {
                (new PrescriptionService())->store($orderId, $customerId ? (int) $customerId : null, $file);
            }

            (new PaymentService())->createPending($orderId, $grandTotal, (string) ($data['payment_method'] ?? 'pix'));
            (new EmailService())->queue('order_confirmation', (string) ($data['email'] ?? ''), 'Pedido recebido - FarmaVida', 'emails/order_confirmation', ['order_number' => $number, 'total' => $grandTotal], $orderId);
            (new WebhookService())->dispatch('pedido_criado', 'order', $orderId);
            return $orderId;
        });
    }

    public function updateStatus(int $orderId, string $status, ?string $message = null, array $options = []): void
    {
        if (!in_array($status, self::ALLOWED_STATUSES, true)) {
            throw new RuntimeException('Status de pedido invalido.');
        }

        Database::transaction(function (PDO $pdo) use ($orderId, $status, $message, $options): void {
            $stmt = $pdo->prepare('SELECT id_filial, status, payment_status, clinical_status, requires_prescription, delivery_method, priority, has_problem, problem_reason, internal_note, pharmacy_note_to_customer FROM orders WHERE id = :id AND deleted_at IS NULL LIMIT 1 FOR UPDATE');
            $stmt->execute(['id' => $orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$order) {
                throw new RuntimeException('Pedido nao encontrado.');
            }
            (new BranchService())->assertCanAccess((int) $order['id_filial']);

            $oldStatus = (string) $order['status'];
            $warning = self::statusWarning($order, $status);
            if ($warning !== null && in_array($status, ['em_separacao', 'conferido', 'saiu_para_entrega', 'pronto_para_retirada', 'entregue'], true)) {
                throw new RuntimeException($warning);
            }
            $oldPriority = (string) ($order['priority'] ?? 'normal');
            $oldHasProblem = (int) ($order['has_problem'] ?? 0);
            $oldProblemReason = (string) ($order['problem_reason'] ?? '');

            $priority = $this->normalizePriority((string) ($options['priority'] ?? $oldPriority));
            $hasProblem = $this->boolOption($options, 'has_problem', $oldHasProblem === 1) ? 1 : 0;
            $problemReason = trim((string) ($options['problem_reason'] ?? $oldProblemReason));
            if ($hasProblem === 0) {
                $problemReason = '';
            }

            $customerMessage = trim((string) ($message ?? ''));
            $internalNote = trim((string) ($options['internal_note'] ?? ''));
            $visibleToCustomer = $this->boolOption($options, 'visible_to_customer', $status !== $oldStatus || $customerMessage !== '');
            if ($status === $oldStatus && $customerMessage === '' && $internalNote !== '') {
                $visibleToCustomer = false;
            }

            $sets = [
                'status = :status',
                'priority = :priority',
                'has_problem = :has_problem',
                'problem_reason = :problem_reason',
                'updated_at = NOW()',
            ];
            $params = [
                'id' => $orderId,
                'status' => $status,
                'priority' => $priority,
                'has_problem' => $hasProblem,
                'problem_reason' => $problemReason !== '' ? $problemReason : null,
            ];

            if ($customerMessage !== '') {
                $sets[] = 'pharmacy_note_to_customer = :pharmacy_note_to_customer';
                $params['pharmacy_note_to_customer'] = $customerMessage;
            }

            if ($internalNote !== '') {
                $sets[] = 'internal_note = :internal_note';
                $params['internal_note'] = $internalNote;
            }

            if ($status === 'saiu_para_entrega') {
                $sets[] = "delivery_status = 'in_transit'";
            } elseif ($status === 'entregue') {
                $sets[] = "delivery_status = 'delivered'";
                $sets[] = 'delivered_at = IF(delivered_at IS NULL, NOW(), delivered_at)';
            } elseif ($status === 'cancelado') {
                $sets[] = 'cancelled_at = IF(cancelled_at IS NULL, NOW(), cancelled_at)';
                if ($problemReason !== '') {
                    $sets[] = 'cancel_reason = :cancel_reason';
                    $params['cancel_reason'] = $problemReason;
                }
            }

            $pdo->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($params);

            $operationChanges = $this->operationChangeLines($oldPriority, $priority, $oldHasProblem, $hasProblem, $oldProblemReason, $problemReason);
            if ($internalNote !== '') {
                $operationChanges[] = 'Nota interna: ' . $internalNote;
            }

            $shouldCreateHistory = $status !== $oldStatus || $customerMessage !== '' || $operationChanges !== [];
            if ($shouldCreateHistory) {
                $pdo->prepare('INSERT INTO order_status_history (order_id, previous_status, new_status, visible_to_customer, message_to_customer, internal_note, changed_by, source, ip_address, user_agent) VALUES (:id, :old, :new, :visible, :message, :internal, :user, :source, :ip, :ua)')
                    ->execute([
                        'id' => $orderId,
                        'old' => $oldStatus,
                        'new' => $status,
                        'visible' => $visibleToCustomer ? 1 : 0,
                        'message' => $customerMessage !== '' ? $customerMessage : null,
                        'internal' => $operationChanges !== [] ? implode("\n", $operationChanges) : null,
                        'user' => user()['id'] ?? null,
                        'source' => is_admin() ? 'admin' : 'system',
                        'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                        'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
                    ]);
            }

            if ($internalNote !== '') {
                $pdo->prepare("INSERT INTO order_internal_notes (order_id, note, visibility, created_by) VALUES (:id, :note, 'internal', :user)")
                    ->execute(['id' => $orderId, 'note' => $internalNote, 'user' => user()['id'] ?? null]);
            }

            if ($customerMessage !== '') {
                $pdo->prepare('INSERT INTO order_internal_notes (order_id, note, visibility, created_by) VALUES (:id, :note, :visibility, :user)')
                    ->execute([
                        'id' => $orderId,
                        'note' => $customerMessage,
                        'visibility' => $visibleToCustomer ? 'customer' : 'internal',
                        'user' => user()['id'] ?? null,
                    ]);
            }

            (new AuditService())->admin('orders', 'status_updated', 'order', $orderId, [
                'status' => $oldStatus,
                'priority' => $oldPriority,
                'has_problem' => $oldHasProblem,
                'problem_reason' => $oldProblemReason,
            ], [
                'status' => $status,
                'priority' => $priority,
                'has_problem' => $hasProblem,
                'problem_reason' => $problemReason,
            ]);
        });
    }

    private function hasControlled(array $items): bool
    {
        foreach ($items as $item) {
            if (in_array($item['prescription_type'], ['controlled', 'psychotropic'], true)) {
                return true;
            }
        }
        return false;
    }

    private static function recommendedStatuses(string $currentStatus, bool $requiresPrescription, string $deliveryMethod): array
    {
        $map = [
            'pedido_recebido' => ['aguardando_pagamento', 'aguardando_receita', 'cancelado'],
            'aguardando_pagamento' => ['pagamento_em_analise', 'pagamento_confirmado', 'cancelado'],
            'pagamento_em_analise' => ['pagamento_confirmado', 'cancelado'],
            'pagamento_confirmado' => $requiresPrescription ? ['aguardando_receita', 'receita_enviada', 'receita_em_validacao'] : ['em_separacao'],
            'aguardando_receita' => ['receita_enviada', 'receita_em_validacao', 'cancelado'],
            'receita_enviada' => ['receita_em_validacao', 'cancelado'],
            'receita_em_validacao' => ['receita_aprovada', 'liberado_pelo_farmaceutico', 'receita_rejeitada'],
            'receita_aprovada' => ['liberado_pelo_farmaceutico'],
            'receita_rejeitada' => ['aguardando_receita', 'cancelado'],
            'liberado_pelo_farmaceutico' => ['em_separacao'],
            'em_separacao' => ['conferido', 'cancelado'],
            'conferido' => $deliveryMethod === 'pickup' ? ['pronto_para_retirada'] : ['saiu_para_entrega'],
            'saiu_para_entrega' => ['entregue'],
            'pronto_para_retirada' => ['entregue'],
        ];

        return $map[$currentStatus] ?? [];
    }

    private static function statusWarning(array $order, string $targetStatus): ?string
    {
        $fulfillmentStatuses = ['em_separacao', 'conferido', 'saiu_para_entrega', 'pronto_para_retirada', 'entregue'];
        if (in_array($targetStatus, $fulfillmentStatuses, true) && ($order['payment_status'] ?? '') !== 'aprovado') {
            return 'Pagamento ainda nao consta como aprovado.';
        }

        $clinicalReleased = in_array((string) ($order['clinical_status'] ?? ''), ['liberado', 'nao_exige_receita'], true)
            || in_array((string) ($order['status'] ?? ''), ['receita_aprovada', 'liberado_pelo_farmaceutico'], true);
        if (!empty($order['requires_prescription']) && in_array($targetStatus, $fulfillmentStatuses, true) && !$clinicalReleased) {
            return 'Receita ainda nao foi liberada pelo farmaceutico.';
        }

        if ($targetStatus === 'saiu_para_entrega' && ($order['delivery_method'] ?? '') === 'pickup') {
            return 'Pedido configurado para retirada.';
        }

        if ($targetStatus === 'pronto_para_retirada' && ($order['delivery_method'] ?? '') !== 'pickup') {
            return 'Pedido configurado para entrega.';
        }

        return null;
    }

    private function normalizePriority(string $priority): string
    {
        return in_array($priority, self::PRIORITIES, true) ? $priority : 'normal';
    }

    private function boolOption(array $options, string $key, bool $default): bool
    {
        if (!array_key_exists($key, $options)) {
            return $default;
        }

        $value = $options[$key];
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower((string) $value), ['1', 'on', 'true', 'yes', 'sim'], true);
    }

    private function operationChangeLines(string $oldPriority, string $priority, int $oldHasProblem, int $hasProblem, string $oldProblemReason, string $problemReason): array
    {
        $lines = [];
        if ($oldPriority !== $priority) {
            $lines[] = 'Prioridade alterada de ' . status_label($oldPriority) . ' para ' . status_label($priority) . '.';
        }
        if ($oldHasProblem !== $hasProblem) {
            $lines[] = $hasProblem === 1 ? 'Pedido marcado com problema.' : 'Problema removido do pedido.';
        }
        if (trim($oldProblemReason) !== trim($problemReason)) {
            $lines[] = $problemReason !== '' ? 'Motivo do problema: ' . $problemReason : 'Motivo do problema limpo.';
        }

        return $lines;
    }
}
