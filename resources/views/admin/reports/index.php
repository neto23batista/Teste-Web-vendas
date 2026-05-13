<?php
$filters = $filters ?? [];
$summary = $summary ?? [];
$orderSeries = $orderSeries ?? [];
$statusDistribution = $statusDistribution ?? [];
$paymentMix = $paymentMix ?? [];
$paymentStatus = $paymentStatus ?? [];
$stockRisk = $stockRisk ?? ['rows' => [], 'summary' => []];
$prescriptionOutcomes = $prescriptionOutcomes ?? [];
$prescriptionTypes = $prescriptionTypes ?? [];
$topProducts = $topProducts ?? [];

$asInt = static fn (array $row, string $key): int => (int) ($row[$key] ?? 0);
$asFloat = static fn (array $row, string $key): float => (float) ($row[$key] ?? 0);
$formatPct = static function (mixed $value): string {
    if ($value === null) {
        return 'Novo periodo';
    }
    $number = (float) $value;
    return ($number > 0 ? '+' : '') . number_format($number, 1, ',', '.') . '%';
};
$formatDate = static function (mixed $value): string {
    if (!$value) {
        return 'Nao informado';
    }
    $time = strtotime((string) $value);
    return $time ? date('d/m/Y', $time) : (string) $value;
};

$chartPayload = [
    'series' => [
        'labels' => array_map(static fn (array $row): string => date('d/m', strtotime((string) $row['sale_date'])), $orderSeries),
        'orders' => array_map(static fn (array $row): int => (int) $row['order_count'], $orderSeries),
        'revenue' => array_map(static fn (array $row): float => (float) $row['approved_revenue'], $orderSeries),
        'cancelled' => array_map(static fn (array $row): int => (int) $row['cancelled_orders'], $orderSeries),
        'prescriptions' => array_map(static fn (array $row): int => (int) $row['prescription_orders'], $orderSeries),
    ],
    'payments' => [
        'labels' => array_map(static fn (array $row): string => status_label($row['payment_method'] ?? ''), $paymentMix),
        'counts' => array_map(static fn (array $row): int => (int) $row['payment_count'], $paymentMix),
        'amounts' => array_map(static fn (array $row): float => (float) $row['total_amount'], $paymentMix),
    ],
    'statuses' => [
        'labels' => array_map(static fn (array $row): string => status_label($row['status'] ?? ''), $statusDistribution),
        'counts' => array_map(static fn (array $row): int => (int) $row['total_orders'], $statusDistribution),
    ],
    'prescriptions' => [
        'labels' => array_map(static fn (array $row): string => status_label($row['status'] ?? ''), $prescriptionOutcomes),
        'counts' => array_map(static fn (array $row): int => (int) $row['total_prescriptions'], $prescriptionOutcomes),
    ],
];
?>

<section class="section-head reports-head">
  <div>
    <p class="eyebrow">Relatorios</p>
    <h1>Painel de decisao</h1>
    <p>Pedidos, pagamentos, estoque e receitas no intervalo selecionado.</p>
  </div>
  <a class="btn" href="/admin">Dashboard</a>
</section>

<section class="panel report-filter-panel">
  <form class="filters inline-filters" method="get" action="/admin/relatorios">
    <label>Periodo
      <select name="preset">
        <?php foreach (['today' => 'Hoje', '7d' => '7 dias', '30d' => '30 dias', '90d' => '90 dias', 'month' => 'Mes atual', 'custom' => 'Personalizado'] as $value => $label): ?>
          <option value="<?= e($value) ?>" <?= ($filters['preset'] ?? '30d') === $value ? 'selected' : '' ?>><?= e($label) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Inicio
      <input type="date" name="start_date" value="<?= e($filters['start_date'] ?? '') ?>">
    </label>
    <label>Fim
      <input type="date" name="end_date" value="<?= e($filters['end_date'] ?? '') ?>">
    </label>
    <div class="actions">
      <button class="btn primary" type="submit">Atualizar</button>
      <a class="btn" href="/admin/relatorios">Limpar</a>
    </div>
  </form>
</section>

<div class="report-dashboard" data-report-charts='<?= e(json_encode($chartPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>'>
  <div class="metric-grid report-kpis">
    <div class="metric">
      <span>Pedidos</span>
      <strong><?= $asInt($summary, 'order_count') ?></strong>
      <small><?= e($formatPct($summary['order_change_pct'] ?? 0)) ?> vs periodo anterior</small>
    </div>
    <div class="metric success">
      <span>Receita aprovada</span>
      <strong><?= money($summary['approved_revenue'] ?? 0) ?></strong>
      <small><?= e($formatPct($summary['revenue_change_pct'] ?? 0)) ?> vs periodo anterior</small>
    </div>
    <div class="metric">
      <span>Ticket medio</span>
      <strong><?= money($summary['average_ticket'] ?? 0) ?></strong>
      <small><?= number_format((float) ($summary['conversion_rate'] ?? 0), 1, ',', '.') ?>% do total bruto aprovado</small>
    </div>
    <div class="metric warning">
      <span>Pedidos abertos</span>
      <strong><?= $asInt($summary, 'open_orders') ?></strong>
      <small><?= $asInt($summary, 'problem_orders') ?> com problema operacional</small>
    </div>
    <div class="metric warning">
      <span>Com receita</span>
      <strong><?= $asInt($summary, 'prescription_orders') ?></strong>
      <small><?= count($prescriptionOutcomes) ?> status clinicos no periodo</small>
    </div>
    <div class="metric danger">
      <span>Cancelados</span>
      <strong><?= $asInt($summary, 'cancelled_orders') ?></strong>
      <small><?= money($summary['gross_total'] ?? 0) ?> bruto no intervalo</small>
    </div>
  </div>

  <section class="panel chart-panel report-span-2">
    <div class="section-head compact">
      <div>
        <h2>Volume e receita</h2>
        <p><?= e($formatDate($filters['start_date'] ?? '')) ?> ate <?= e($formatDate($filters['end_date'] ?? '')) ?></p>
      </div>
    </div>
    <div class="report-chart"><canvas id="reportVolumeChart" height="320"></canvas></div>
  </section>

  <section class="panel chart-panel">
    <div class="section-head compact">
      <div>
        <h2>Mix de pagamento</h2>
        <p>Metodos usados nos pagamentos criados.</p>
      </div>
    </div>
    <div class="report-chart compact-chart"><canvas id="paymentMixChart" height="270"></canvas></div>
  </section>

  <section class="panel chart-panel">
    <div class="section-head compact">
      <div>
        <h2>Status dos pedidos</h2>
        <p>Distribuicao operacional do intervalo.</p>
      </div>
    </div>
    <div class="report-chart"><canvas id="statusDistributionChart" height="300"></canvas></div>
  </section>

  <section class="panel chart-panel">
    <div class="section-head compact">
      <div>
        <h2>Receitas</h2>
        <p>Resultado clinico e tempo medio de fila.</p>
      </div>
    </div>
    <div class="report-chart compact-chart"><canvas id="prescriptionOutcomeChart" height="270"></canvas></div>
  </section>

  <section class="panel report-span-2">
    <div class="section-head compact">
      <div>
        <h2>Pagamentos</h2>
        <p>Metodo, volume aprovado e excecoes para conciliacao.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Metodo</th><th>Pagamentos</th><th>Aprovados</th><th>Excecoes</th><th>Total</th></tr></thead>
        <tbody>
          <?php foreach ($paymentMix as $row): ?>
            <tr>
              <td><strong><?= e(status_label($row['payment_method'] ?? '')) ?></strong></td>
              <td><?= $asInt($row, 'payment_count') ?></td>
              <td><?= $asInt($row, 'approved_count') ?></td>
              <td><?= $asInt($row, 'exception_count') ?></td>
              <td><strong><?= money($row['total_amount'] ?? 0) ?></strong></td>
            </tr>
          <?php endforeach; ?>
          <?php if (empty($paymentMix)): ?><tr><td colspan="5">Sem pagamentos no periodo.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
    <div class="tag-row">
      <?php foreach ($paymentStatus as $row): ?>
        <span class="tag <?= e(status_class($row['payment_status'] ?? '')) ?>"><?= e(status_label($row['payment_status'] ?? '')) ?>: <?= $asInt($row, 'order_count') ?></span>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="panel">
    <div class="section-head compact">
      <div>
        <h2>Estoque em risco</h2>
        <p>Reposicao e vencimento por prioridade.</p>
      </div>
      <a class="btn small" href="/admin/estoque">Abrir estoque</a>
    </div>
    <div class="stock-risk-summary">
      <?php foreach (($stockRisk['summary'] ?? []) as $row): ?>
        <span class="tag <?= e(status_class($row['risk_status'] ?? '')) ?>"><?= e(status_label($row['risk_status'] ?? '')) ?>: <?= $asInt($row, 'product_count') ?></span>
      <?php endforeach; ?>
    </div>
    <div class="report-list">
      <?php foreach (($stockRisk['rows'] ?? []) as $row): ?>
        <div class="report-list-item">
          <div>
            <strong><?= e($row['product_name'] ?? '') ?></strong>
            <span><?= e($row['internal_code'] ?? '') ?> - <?= e($row['ean'] ?? 'Sem EAN') ?></span>
          </div>
          <div>
            <?= status_pill($row['risk_status'] ?? '') ?>
            <span><?= (int) ($row['current_stock'] ?? 0) ?> / min <?= (int) ($row['minimum_stock'] ?? 0) ?></span>
          </div>
        </div>
      <?php endforeach; ?>
      <?php if (empty($stockRisk['rows'])): ?><p class="helper">Sem produtos em risco.</p><?php endif; ?>
    </div>
  </section>

  <section class="panel report-span-2">
    <div class="section-head compact">
      <div>
        <h2>Resultados de receita</h2>
        <p>Status, tipos e tempo medio em fila.</p>
      </div>
      <a class="btn small" href="/admin/receitas">Abrir receitas</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Status</th><th>Receitas</th><th>Tempo medio</th></tr></thead>
        <tbody>
          <?php foreach ($prescriptionOutcomes as $row): ?>
            <tr>
              <td><?= status_pill($row['status'] ?? '') ?></td>
              <td><?= $asInt($row, 'total_prescriptions') ?></td>
              <td><?= (int) round($asFloat($row, 'avg_minutes')) ?> min</td>
            </tr>
          <?php endforeach; ?>
          <?php if (empty($prescriptionOutcomes)): ?><tr><td colspan="3">Sem receitas no periodo.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
    <div class="report-type-grid">
      <?php foreach ($prescriptionTypes as $row): ?>
        <div>
          <span><?= e(status_label($row['prescription_type'] ?? '')) ?></span>
          <strong><?= $asInt($row, 'total_prescriptions') ?></strong>
          <small><?= $asInt($row, 'approved_count') ?> liberadas - <?= $asInt($row, 'blocked_count') ?> bloqueadas/rejeitadas</small>
        </div>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="panel">
    <div class="section-head compact">
      <div>
        <h2>Produtos vendidos</h2>
        <p>Itens com maior giro no intervalo.</p>
      </div>
    </div>
    <div class="report-list compact">
      <?php foreach ($topProducts as $row): ?>
        <div class="report-list-item">
          <div>
            <strong><?= e($row['product_name'] ?? '') ?></strong>
            <span>Ultima venda: <?= e($formatDate($row['last_sold_at'] ?? null)) ?></span>
          </div>
          <div>
            <strong><?= (int) ($row['quantity_sold'] ?? 0) ?> un</strong>
            <span><?= money($row['revenue_total'] ?? 0) ?></span>
          </div>
        </div>
      <?php endforeach; ?>
      <?php if (empty($topProducts)): ?><p class="helper">Sem itens vendidos no periodo.</p><?php endif; ?>
    </div>
  </section>
</div>
