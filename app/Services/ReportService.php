<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use DateInterval;
use DatePeriod;
use DateTimeImmutable;
use PDO;

final class ReportService
{
    public function dashboard(array $input = []): array
    {
        $db = Database::connection();
        $branchId = $this->branchIdFromInput($input);
        return (new FileCacheService())->remember('dashboard:' . md5(json_encode($input)), 30, function () use ($db, $branchId): array {
            $params = [];
            $orderScope = $this->scope('orders', $branchId, $params);
            $prescriptionScope = $this->scope('prescriptions', $branchId, $params);
            $stockScope = $this->scope('v_stock_risk', $branchId, $params);
            $dailyScope = $this->scope('v_daily_revenue', $branchId, $params);
            $salesScope = $this->scope('v_product_sales_summary', $branchId, $params);
            return [
                'id_filial' => $branchId,
                'filial_nome' => (new BranchService())->branchName($branchId),
                'today_orders' => (int) $this->scalar("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE{$orderScope}", $params),
                'today_revenue' => (float) $this->scalar("SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND payment_status = 'aprovado'{$orderScope}", $params),
                'month_orders' => (int) $this->scalar("SELECT COUNT(*) FROM orders WHERE created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'){$orderScope}", $params),
                'month_revenue' => (float) $this->scalar("SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AND payment_status = 'aprovado'{$orderScope}", $params),
                'average_ticket' => (float) $this->scalar("SELECT COALESCE(AVG(grand_total),0) FROM orders WHERE payment_status = 'aprovado' AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY){$orderScope}", $params),
                'pending_orders' => (int) $this->scalar("SELECT COUNT(*) FROM orders WHERE status NOT IN ('entregue','cancelado'){$orderScope}", $params),
                'prescription_queue' => (int) $this->scalar("SELECT COUNT(*) FROM prescriptions WHERE status IN ('receita_enviada','em_validacao'){$prescriptionScope}", $params),
                'low_stock' => (int) $this->scalar("SELECT COUNT(*) FROM v_stock_risk WHERE risk_status = 'low_stock'{$stockScope}", $params),
                'out_stock' => (int) $this->scalar("SELECT COUNT(*) FROM v_stock_risk WHERE risk_status = 'out_of_stock'{$stockScope}", $params),
                'near_expiration' => (int) $this->scalar("SELECT COUNT(*) FROM v_stock_risk WHERE risk_status IN ('expired','near_expiration'){$stockScope}", $params),
                'customers' => (int) $db->query('SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL')->fetchColumn(),
                'recent_orders' => $this->rows("SELECT * FROM orders WHERE deleted_at IS NULL{$orderScope} ORDER BY created_at DESC LIMIT 8", $params),
                'stock_risk' => $this->rows("SELECT * FROM v_stock_risk WHERE risk_status <> 'normal'{$stockScope} LIMIT 8", $params),
                'revenue_series' => $this->rows("SELECT sale_date, approved_revenue, order_count FROM v_daily_revenue WHERE 1=1{$dailyScope} ORDER BY sale_date DESC LIMIT 14", $params),
                'top_products' => $this->rows("SELECT product_name, quantity_sold, revenue_total FROM v_product_sales_summary WHERE 1=1{$salesScope} ORDER BY quantity_sold DESC LIMIT 6", $params),
            ];
        }, $branchId);
    }

    public function decisionDashboard(array $input = []): array
    {
        $filters = $this->normalizeFilters($input);

        return [
            'filters' => $filters,
            'summary' => $this->summary($filters),
            'orderSeries' => $this->orderSeries($filters),
            'statusDistribution' => $this->statusDistribution($filters),
            'paymentMix' => $this->paymentMix($filters),
            'paymentStatus' => $this->paymentStatus($filters),
            'stockRisk' => $this->stockRisk($filters),
            'prescriptionOutcomes' => $this->prescriptionOutcomes($filters),
            'prescriptionTypes' => $this->prescriptionTypes($filters),
            'topProducts' => $this->topProducts($filters),
            'branchComparison' => $this->branchComparison($filters),
        ];
    }

    public function revenueSeries(): array
    {
        return $this->orderSeries($this->normalizeFilters(['preset' => '30d']));
    }

    private function normalizeFilters(array $input): array
    {
        $today = new DateTimeImmutable('today');
        $preset = (string) ($input['preset'] ?? '30d');
        $allowedPresets = ['today', '7d', '30d', '90d', 'month', 'custom'];
        if (!in_array($preset, $allowedPresets, true)) {
            $preset = '30d';
        }

        $start = match ($preset) {
            'today' => $today,
            '7d' => $today->sub(new DateInterval('P6D')),
            '90d' => $today->sub(new DateInterval('P89D')),
            'month' => $today->modify('first day of this month'),
            'custom' => $this->parseDate((string) ($input['start_date'] ?? ''), $today->sub(new DateInterval('P29D'))),
            default => $today->sub(new DateInterval('P29D')),
        };

        $end = $preset === 'custom'
            ? $this->parseDate((string) ($input['end_date'] ?? ''), $today)
            : $today;

        if ($start > $end) {
            [$start, $end] = [$end, $start];
        }

        $days = ((int) $start->diff($end)->format('%a')) + 1;
        if ($days > 366) {
            $start = $end->sub(new DateInterval('P365D'));
            $days = 366;
        }

        $previousEnd = $start->sub(new DateInterval('P1D'));
        $previousStart = $previousEnd->sub(new DateInterval('P' . ($days - 1) . 'D'));

        return [
            'preset' => $preset,
            'id_filial' => $this->branchIdFromInput($input),
            'start_date' => $start->format('Y-m-d'),
            'end_date' => $end->format('Y-m-d'),
            'start_at' => $start->format('Y-m-d 00:00:00'),
            'end_at' => $end->modify('+1 day')->format('Y-m-d 00:00:00'),
            'days' => $days,
            'previous_start_at' => $previousStart->format('Y-m-d 00:00:00'),
            'previous_end_at' => $previousEnd->modify('+1 day')->format('Y-m-d 00:00:00'),
        ];
    }

    private function parseDate(string $value, DateTimeImmutable $fallback): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $date instanceof DateTimeImmutable ? $date : $fallback;
    }

    private function summary(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('orders', $filters['id_filial'], $params);
        $current = $this->singleRow("SELECT
                COUNT(*) AS order_count,
                COALESCE(SUM(grand_total), 0) AS gross_total,
                COALESCE(SUM(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE 0 END), 0) AS approved_revenue,
                COALESCE(AVG(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE NULL END), 0) AS average_ticket,
                COALESCE(SUM(status = 'cancelado'), 0) AS cancelled_orders,
                COALESCE(SUM(status NOT IN ('entregue', 'cancelado')), 0) AS open_orders,
                COALESCE(SUM(has_problem = 1), 0) AS problem_orders,
                COALESCE(SUM(requires_prescription = 1), 0) AS prescription_orders
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at{$scope}", $params);

        $previousParams = [
            'start_at' => $filters['previous_start_at'],
            'end_at' => $filters['previous_end_at'],
        ];
        $previousScope = $this->scope('orders', $filters['id_filial'], $previousParams);
        $previous = $this->singleRow("SELECT
                COUNT(*) AS order_count,
                COALESCE(SUM(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE 0 END), 0) AS approved_revenue
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at{$previousScope}", $previousParams);

        $current['conversion_rate'] = (int) $current['order_count'] > 0
            ? ((float) $current['approved_revenue'] / max((float) $current['gross_total'], 0.01)) * 100
            : 0.0;
        $current['order_change_pct'] = $this->changePercent((float) $current['order_count'], (float) $previous['order_count']);
        $current['revenue_change_pct'] = $this->changePercent((float) $current['approved_revenue'], (float) $previous['approved_revenue']);

        return $current;
    }

    private function orderSeries(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('orders', $filters['id_filial'], $params);
        $rows = $this->rows("SELECT
                DATE(created_at) AS sale_date,
                COUNT(*) AS order_count,
                COALESCE(SUM(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE 0 END), 0) AS approved_revenue,
                COALESCE(AVG(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE NULL END), 0) AS average_ticket,
                COALESCE(SUM(status = 'cancelado'), 0) AS cancelled_orders,
                COALESCE(SUM(requires_prescription = 1), 0) AS prescription_orders
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at{$scope}
            GROUP BY DATE(created_at)
            ORDER BY sale_date", $params);

        $byDate = [];
        foreach ($rows as $row) {
            $byDate[(string) $row['sale_date']] = $row;
        }

        $series = [];
        $period = new DatePeriod(
            new DateTimeImmutable($filters['start_date']),
            new DateInterval('P1D'),
            (new DateTimeImmutable($filters['end_date']))->modify('+1 day')
        );
        foreach ($period as $date) {
            $key = $date->format('Y-m-d');
            $series[] = $byDate[$key] ?? [
                'sale_date' => $key,
                'order_count' => 0,
                'approved_revenue' => 0,
                'average_ticket' => 0,
                'cancelled_orders' => 0,
                'prescription_orders' => 0,
            ];
        }

        return $series;
    }

    private function statusDistribution(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('orders', $filters['id_filial'], $params);
        return $this->rows("SELECT
                status,
                COUNT(*) AS total_orders,
                COALESCE(SUM(grand_total), 0) AS gross_total,
                COALESCE(SUM(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE 0 END), 0) AS approved_revenue,
                MIN(created_at) AS oldest_order_at
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at{$scope}
            GROUP BY status
            ORDER BY FIELD(status, 'pedido_recebido', 'aguardando_pagamento', 'pagamento_em_analise', 'pagamento_confirmado', 'aguardando_receita', 'receita_enviada', 'receita_em_validacao', 'receita_aprovada', 'receita_rejeitada', 'liberado_pelo_farmaceutico', 'em_separacao', 'conferido', 'saiu_para_entrega', 'pronto_para_retirada', 'entregue', 'cancelado'), status", [
            ...$params,
        ]);
    }

    private function paymentMix(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('p', $filters['id_filial'], $params);
        return $this->rows("SELECT
                p.payment_method,
                COUNT(*) AS payment_count,
                COALESCE(SUM(p.amount), 0) AS total_amount,
                COALESCE(SUM(p.status = 'aprovado'), 0) AS approved_count,
                COALESCE(SUM(p.status IN ('recusado', 'cancelado', 'estornado', 'expirado', 'divergente')), 0) AS exception_count
            FROM payments p
            INNER JOIN orders o ON o.id = p.order_id
            WHERE o.deleted_at IS NULL AND p.created_at >= :start_at AND p.created_at < :end_at{$scope}
            GROUP BY p.payment_method
            ORDER BY payment_count DESC, total_amount DESC", $params);
    }

    private function paymentStatus(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('orders', $filters['id_filial'], $params);
        return $this->rows("SELECT
                payment_status,
                COUNT(*) AS order_count,
                COALESCE(SUM(grand_total), 0) AS gross_total
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at{$scope}
            GROUP BY payment_status
            ORDER BY order_count DESC, gross_total DESC", $params);
    }

    private function stockRisk(array $filters): array
    {
        $params = [];
        $scope = $this->scope('v_stock_risk', $filters['id_filial'], $params);
        $riskRows = $this->rows("SELECT * FROM v_stock_risk
            WHERE risk_status <> 'normal'{$scope}
            ORDER BY FIELD(risk_status, 'out_of_stock', 'low_stock', 'expired', 'near_expiration'), product_name
            LIMIT 12", $params);

        $summaryParams = [];
        $summaryScope = $this->scope('v_stock_risk', $filters['id_filial'], $summaryParams);
        $summary = $this->rows("SELECT risk_status, COUNT(*) AS product_count
            FROM v_stock_risk
            WHERE 1=1{$summaryScope}
            GROUP BY risk_status
            ORDER BY FIELD(risk_status, 'out_of_stock', 'low_stock', 'expired', 'near_expiration', 'normal'), risk_status", $summaryParams);

        return ['rows' => $riskRows, 'summary' => $summary];
    }

    private function prescriptionOutcomes(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('prescriptions', $filters['id_filial'], $params);
        return $this->rows("SELECT
                status,
                COUNT(*) AS total_prescriptions,
                COALESCE(AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(validated_at, CURRENT_TIMESTAMP))), 0) AS avg_minutes
            FROM prescriptions
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at{$scope}
            GROUP BY status
            ORDER BY FIELD(status, 'aguardando_receita', 'receita_enviada', 'em_validacao', 'liberado', 'rejeitado', 'bloqueado_orientacao_farmaceutica'), status", $params);
    }

    private function prescriptionTypes(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('prescriptions', $filters['id_filial'], $params);
        return $this->rows("SELECT
                prescription_type,
                COUNT(*) AS total_prescriptions,
                COALESCE(SUM(status = 'liberado'), 0) AS approved_count,
                COALESCE(SUM(status IN ('rejeitado', 'bloqueado_orientacao_farmaceutica')), 0) AS blocked_count
            FROM prescriptions
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at{$scope}
            GROUP BY prescription_type
            ORDER BY total_prescriptions DESC, prescription_type", $params);
    }

    private function topProducts(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = $this->scope('o', $filters['id_filial'], $params);
        return $this->rows("SELECT
                oi.product_name,
                COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
                COALESCE(SUM(oi.line_total), 0) AS revenue_total,
                MAX(o.created_at) AS last_sold_at
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE o.deleted_at IS NULL AND o.created_at >= :start_at AND o.created_at < :end_at{$scope}
            GROUP BY oi.product_name
            ORDER BY quantity_sold DESC, revenue_total DESC
            LIMIT 8", $params);
    }

    private function branchComparison(array $filters): array
    {
        $params = [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ];
        $scope = '';
        if ($filters['id_filial'] !== null) {
            $scope = ' AND f.id = :id_filial';
            $params['id_filial'] = $filters['id_filial'];
        }
        return $this->rows("SELECT
                f.id AS id_filial,
                f.nome AS filial_nome,
                COUNT(o.id) AS order_count,
                COALESCE(SUM(CASE WHEN o.payment_status = 'aprovado' THEN o.grand_total ELSE 0 END), 0) AS approved_revenue,
                COALESCE(AVG(CASE WHEN o.payment_status = 'aprovado' THEN o.grand_total ELSE NULL END), 0) AS average_ticket,
                COALESCE(SUM(o.status = 'cancelado'), 0) AS cancelled_orders
            FROM filiais f
            LEFT JOIN orders o ON o.id_filial = f.id AND o.deleted_at IS NULL AND o.created_at >= :start_at AND o.created_at < :end_at
            WHERE f.status = 'ativa'{$scope}
            GROUP BY f.id, f.nome
            ORDER BY approved_revenue DESC, order_count DESC", $params);
    }

    private function singleRow(string $sql, array $params): array
    {
        $stmt = $this->prepare($sql, $params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : [];
    }

    private function rows(string $sql, array $params = []): array
    {
        return $this->prepare($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
    }

    private function scalar(string $sql, array $params = []): mixed
    {
        return $this->prepare($sql, $params)->fetchColumn();
    }

    private function prepare(string $sql, array $params): \PDOStatement
    {
        $stmt = Database::connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->execute();
        return $stmt;
    }

    private function scope(string $alias, ?int $branchId, array &$params): string
    {
        if ($branchId === null) {
            return '';
        }
        $params['id_filial'] = $branchId;
        return " AND {$alias}.id_filial = :id_filial";
    }

    private function branchIdFromInput(array $input): ?int
    {
        if (is_admin_geral()) {
            $raw = $input['id_filial'] ?? $input['filial'] ?? 'all';
            if ($raw === 'all' || $raw === '' || $raw === null) {
                return null;
            }
            $branchId = (int) $raw;
            (new BranchService())->assertCanAccess($branchId);
            return $branchId;
        }

        return (new BranchService())->currentId();
    }

    private function changePercent(float $current, float $previous): ?float
    {
        if ($previous <= 0.0) {
            return $current > 0.0 ? null : 0.0;
        }

        return (($current - $previous) / $previous) * 100;
    }
}
