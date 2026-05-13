<?php
$data = is_array($data ?? null) ? $data : [];
$data = array_replace([
    'today_orders' => 0,
    'today_revenue' => 0,
    'month_orders' => 0,
    'month_revenue' => 0,
    'average_ticket' => 0,
    'pending_orders' => 0,
    'prescription_queue' => 0,
    'low_stock' => 0,
    'out_stock' => 0,
    'near_expiration' => 0,
    'customers' => 0,
    'recent_orders' => [],
    'stock_risk' => [],
    'revenue_series' => [],
    'top_products' => [],
], $data);

$series = array_reverse((array) $data['revenue_series']);
$dashboardCharts = [
    'sales' => [
        'labels' => array_map(static fn (array $row): string => date('d/m', strtotime((string) ($row['sale_date'] ?? 'today'))), $series),
        'revenue' => array_map(static fn (array $row): float => (float) ($row['approved_revenue'] ?? 0), $series),
        'orders' => array_map(static fn (array $row): int => (int) ($row['order_count'] ?? 0), $series),
    ],
    'products' => [
        'labels' => array_map(static fn (array $row): string => (string) ($row['product_name'] ?? 'Produto'), (array) $data['top_products']),
        'quantity' => array_map(static fn (array $row): int => (int) ($row['quantity_sold'] ?? 0), (array) $data['top_products']),
    ],
];
?>

<section class="dashboard-hero" data-dashboard-charts='<?= e(json_encode($dashboardCharts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?>'>
  <div>
    <p class="eyebrow">Centro de comando</p>
    <h2>Operacao FarmaVida</h2>
    <p>Vendas, pagamentos, estoque, receitas e atendimento em uma visao executiva.</p>
  </div>
  <div class="dashboard-hero-card">
    <span>Faturamento do mes</span>
    <strong><?= money($data['month_revenue'] ?? 0) ?></strong>
    <small><?= (int) ($data['month_orders'] ?? 0) ?> pedidos no mes</small>
  </div>
</section>

<div class="metric-grid dashboard-metrics">
  <div class="metric success metric-icon sales"><span>Vendas hoje</span><strong><?= (int) $data['today_orders'] ?></strong><small><?= money($data['today_revenue']) ?> aprovados</small></div>
  <div class="metric success metric-icon revenue"><span>Vendas do mes</span><strong><?= (int) $data['month_orders'] ?></strong><small><?= money($data['month_revenue']) ?></small></div>
  <div class="metric metric-icon ticket"><span>Ticket medio</span><strong><?= money($data['average_ticket']) ?></strong><small>Ultimos 30 dias</small></div>
  <div class="metric warning metric-icon orders"><span>Pedidos pendentes</span><strong><?= (int) $data['pending_orders'] ?></strong><small>Fila operacional aberta</small></div>
  <div class="metric warning metric-icon prescription"><span>Receitas na fila</span><strong><?= (int) $data['prescription_queue'] ?></strong><small>Aguardando validacao</small></div>
  <div class="metric danger metric-icon stock"><span>Produtos zerados</span><strong><?= (int) $data['out_stock'] ?></strong><small><?= (int) $data['low_stock'] ?> abaixo do minimo</small></div>
  <div class="metric warning metric-icon expiry"><span>Proximos do vencimento</span><strong><?= (int) $data['near_expiration'] ?></strong><small>Ate 60 dias</small></div>
  <div class="metric metric-icon customers"><span>Clientes</span><strong><?= (int) $data['customers'] ?></strong><small>Base cadastrada</small></div>
</div>

<div class="dashboard-grid">
  <section class="panel chart-panel dashboard-span-2">
    <div class="section-head compact">
      <div>
        <p class="eyebrow">Vendas</p>
        <h2>Desempenho recente</h2>
      </div>
      <a class="btn small" href="/admin/relatorios">Ver relatorios</a>
    </div>
    <div class="report-chart"><canvas id="dashboardSalesChart" height="320"></canvas></div>
  </section>

  <section class="panel chart-panel">
    <div class="section-head compact">
      <div>
        <p class="eyebrow">Giro</p>
        <h2>Mais vendidos</h2>
      </div>
    </div>
    <div class="report-chart compact-chart"><canvas id="dashboardProductsChart" height="280"></canvas></div>
  </section>

  <section class="panel dashboard-span-2">
    <div class="section-head compact">
      <div>
        <p class="eyebrow">Operacao em tempo real</p>
        <h2>Fila recente</h2>
      </div>
      <div class="actions">
        <a class="btn small" href="/admin/pedidos">Ver pedidos</a>
        <a class="btn small" href="/admin/receitas">Ver receitas</a>
      </div>
    </div>
    <?php if (empty($data['recent_orders'])): ?>
      <section class="empty-state">
        <h2>Nenhum pedido recente</h2>
        <p>Novos pedidos entrarao aqui para separacao, validacao e pagamento.</p>
      </section>
    <?php else: ?>
      <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>
      <?php foreach ((array) $data['recent_orders'] as $order): ?><tr><td><strong><?= e($order['order_number'] ?? 'Pedido') ?></strong></td><td><?= status_pill($order['status'] ?? 'pedido_recebido') ?></td><td><?= money($order['grand_total'] ?? 0) ?></td><td class="table-actions"><a class="btn small" href="/admin/pedidos/<?= (int) ($order['id'] ?? 0) ?>">Abrir</a></td></tr><?php endforeach; ?>
      </tbody></table></div>
    <?php endif; ?>
  </section>

  <section class="panel">
    <div class="section-head compact">
      <div>
        <p class="eyebrow">Alertas inteligentes</p>
        <h2>Prioridades</h2>
      </div>
    </div>
    <div class="report-list">
      <div class="report-list-item"><div><strong>Alertas clinicos</strong><span>Receitas pendentes devem ser avaliadas antes da liberacao do pedido.</span></div><?= status_pill((int) $data['prescription_queue'] > 0 ? 'pending' : 'ok') ?></div>
      <div class="report-list-item"><div><strong>Estoque critico</strong><span>Priorize reposicao de produtos zerados e itens abaixo do minimo.</span></div><?= status_pill((int) $data['out_stock'] > 0 ? 'critical' : 'ok') ?></div>
      <div class="report-list-item"><div><strong>Validade</strong><span>Revise lotes proximos do vencimento e ajuste exposicao.</span></div><?= status_pill((int) $data['near_expiration'] > 0 ? 'near_expiration' : 'ok') ?></div>
    </div>
  </section>
</div>
