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
    public function dashboard(): array
    {
        $db = Database::connection();
        return [
            'today_orders' => (int) $db->query('SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE')->fetchColumn(),
            'today_revenue' => (float) $db->query("SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE DATE(created_at) = CURRENT_DATE AND payment_status = 'aprovado'")->fetchColumn(),
            'month_orders' => (int) $db->query('SELECT COUNT(*) FROM orders WHERE created_at >= DATE_FORMAT(CURRENT_DATE, "%Y-%m-01")')->fetchColumn(),
            'month_revenue' => (float) $db->query("SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AND payment_status = 'aprovado'")->fetchColumn(),
            'average_ticket' => (float) $db->query("SELECT COALESCE(AVG(grand_total),0) FROM orders WHERE payment_status = 'aprovado' AND created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)")->fetchColumn(),
            'pending_orders' => (int) $db->query("SELECT COUNT(*) FROM orders WHERE status NOT IN ('entregue','cancelado')")->fetchColumn(),
            'prescription_queue' => (int) $db->query("SELECT COUNT(*) FROM prescriptions WHERE status IN ('receita_enviada','em_validacao')")->fetchColumn(),
            'low_stock' => (int) $db->query('SELECT COUNT(*) FROM products WHERE current_stock <= minimum_stock AND current_stock > 0 AND deleted_at IS NULL')->fetchColumn(),
            'out_stock' => (int) $db->query('SELECT COUNT(*) FROM products WHERE current_stock <= 0 AND deleted_at IS NULL')->fetchColumn(),
            'near_expiration' => (int) $db->query("SELECT COUNT(DISTINCT p.id) FROM products p INNER JOIN product_batches pb ON pb.product_id = p.id WHERE p.deleted_at IS NULL AND pb.status IN ('available','reserved') AND pb.expiration_date <= DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY)")->fetchColumn(),
            'customers' => (int) $db->query('SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL')->fetchColumn(),
            'recent_orders' => $db->query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8')->fetchAll(),
            'stock_risk' => $db->query('SELECT * FROM v_stock_risk WHERE risk_status <> "normal" LIMIT 8')->fetchAll(),
            'revenue_series' => $db->query('SELECT sale_date, approved_revenue, order_count FROM v_daily_revenue ORDER BY sale_date DESC LIMIT 14')->fetchAll(),
            'top_products' => $db->query('SELECT product_name, quantity_sold, revenue_total FROM v_product_sales_summary ORDER BY quantity_sold DESC LIMIT 6')->fetchAll(),
        ];
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
            'stockRisk' => $this->stockRisk(),
            'prescriptionOutcomes' => $this->prescriptionOutcomes($filters),
            'prescriptionTypes' => $this->prescriptionTypes($filters),
            'topProducts' => $this->topProducts($filters),
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
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);

        $previous = $this->singleRow("SELECT
                COUNT(*) AS order_count,
                COALESCE(SUM(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE 0 END), 0) AS approved_revenue
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at", [
            'start_at' => $filters['previous_start_at'],
            'end_at' => $filters['previous_end_at'],
        ]);

        $current['conversion_rate'] = (int) $current['order_count'] > 0
            ? ((float) $current['approved_revenue'] / max((float) $current['gross_total'], 0.01)) * 100
            : 0.0;
        $current['order_change_pct'] = $this->changePercent((float) $current['order_count'], (float) $previous['order_count']);
        $current['revenue_change_pct'] = $this->changePercent((float) $current['approved_revenue'], (float) $previous['approved_revenue']);

        return $current;
    }

    private function orderSeries(array $filters): array
    {
        $rows = $this->rows("SELECT
                DATE(created_at) AS sale_date,
                COUNT(*) AS order_count,
                COALESCE(SUM(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE 0 END), 0) AS approved_revenue,
                COALESCE(AVG(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE NULL END), 0) AS average_ticket,
                COALESCE(SUM(status = 'cancelado'), 0) AS cancelled_orders,
                COALESCE(SUM(requires_prescription = 1), 0) AS prescription_orders
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at
            GROUP BY DATE(created_at)
            ORDER BY sale_date", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);

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
        return $this->rows("SELECT
                status,
                COUNT(*) AS total_orders,
                COALESCE(SUM(grand_total), 0) AS gross_total,
                COALESCE(SUM(CASE WHEN payment_status = 'aprovado' THEN grand_total ELSE 0 END), 0) AS approved_revenue,
                MIN(created_at) AS oldest_order_at
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at
            GROUP BY status
            ORDER BY FIELD(status, 'pedido_recebido', 'aguardando_pagamento', 'pagamento_em_analise', 'pagamento_confirmado', 'aguardando_receita', 'receita_enviada', 'receita_em_validacao', 'receita_aprovada', 'receita_rejeitada', 'liberado_pelo_farmaceutico', 'em_separacao', 'conferido', 'saiu_para_entrega', 'pronto_para_retirada', 'entregue', 'cancelado'), status", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);
    }

    private function paymentMix(array $filters): array
    {
        return $this->rows("SELECT
                p.payment_method,
                COUNT(*) AS payment_count,
                COALESCE(SUM(p.amount), 0) AS total_amount,
                COALESCE(SUM(p.status = 'aprovado'), 0) AS approved_count,
                COALESCE(SUM(p.status IN ('recusado', 'cancelado', 'estornado', 'expirado', 'divergente')), 0) AS exception_count
            FROM payments p
            INNER JOIN orders o ON o.id = p.order_id
            WHERE o.deleted_at IS NULL AND p.created_at >= :start_at AND p.created_at < :end_at
            GROUP BY p.payment_method
            ORDER BY payment_count DESC, total_amount DESC", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);
    }

    private function paymentStatus(array $filters): array
    {
        return $this->rows("SELECT
                payment_status,
                COUNT(*) AS order_count,
                COALESCE(SUM(grand_total), 0) AS gross_total
            FROM orders
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at
            GROUP BY payment_status
            ORDER BY order_count DESC, gross_total DESC", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);
    }

    private function stockRisk(): array
    {
        $riskRows = $this->rows("SELECT * FROM v_stock_risk
            WHERE risk_status <> 'normal'
            ORDER BY FIELD(risk_status, 'out_of_stock', 'low_stock', 'expired', 'near_expiration'), product_name
            LIMIT 12");

        $summary = $this->rows("SELECT risk_status, COUNT(*) AS product_count
            FROM v_stock_risk
            GROUP BY risk_status
            ORDER BY FIELD(risk_status, 'out_of_stock', 'low_stock', 'expired', 'near_expiration', 'normal'), risk_status");

        return ['rows' => $riskRows, 'summary' => $summary];
    }

    private function prescriptionOutcomes(array $filters): array
    {
        return $this->rows("SELECT
                status,
                COUNT(*) AS total_prescriptions,
                COALESCE(AVG(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(validated_at, CURRENT_TIMESTAMP))), 0) AS avg_minutes
            FROM prescriptions
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at
            GROUP BY status
            ORDER BY FIELD(status, 'aguardando_receita', 'receita_enviada', 'em_validacao', 'liberado', 'rejeitado', 'bloqueado_orientacao_farmaceutica'), status", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);
    }

    private function prescriptionTypes(array $filters): array
    {
        return $this->rows("SELECT
                prescription_type,
                COUNT(*) AS total_prescriptions,
                COALESCE(SUM(status = 'liberado'), 0) AS approved_count,
                COALESCE(SUM(status IN ('rejeitado', 'bloqueado_orientacao_farmaceutica')), 0) AS blocked_count
            FROM prescriptions
            WHERE deleted_at IS NULL AND created_at >= :start_at AND created_at < :end_at
            GROUP BY prescription_type
            ORDER BY total_prescriptions DESC, prescription_type", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);
    }

    private function topProducts(array $filters): array
    {
        return $this->rows("SELECT
                oi.product_name,
                COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
                COALESCE(SUM(oi.line_total), 0) AS revenue_total,
                MAX(o.created_at) AS last_sold_at
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE o.deleted_at IS NULL AND o.created_at >= :start_at AND o.created_at < :end_at
            GROUP BY oi.product_name
            ORDER BY quantity_sold DESC, revenue_total DESC
            LIMIT 8", [
            'start_at' => $filters['start_at'],
            'end_at' => $filters['end_at'],
        ]);
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

    private function prepare(string $sql, array $params): \PDOStatement
    {
        $stmt = Database::connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->execute();
        return $stmt;
    }

    private function changePercent(float $current, float $previous): ?float
    {
        if ($previous <= 0.0) {
            return $current > 0.0 ? null : 0.0;
        }

        return (($current - $previous) / $previous) * 100;
    }
}
