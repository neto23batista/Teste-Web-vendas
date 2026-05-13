<?php
$orders = $orders ?? [];
$summary = $summary ?? [];
$filters = $filters ?? [];
$statusGroups = $statusGroups ?? [];
$priorityOptions = $priorityOptions ?? ['normal', 'urgent', 'critical'];
$summaryValue = static fn (string $key): int => (int) ($summary[$key] ?? 0);
$ageLabel = static function (mixed $minutes): string {
    $minutes = max(0, (int) $minutes);
    if ($minutes < 60) {
        return $minutes . ' min';
    }
    $hours = intdiv($minutes, 60);
    if ($hours < 24) {
        return $hours . ' h';
    }
    return intdiv($hours, 24) . ' d';
};
$cleanFilters = array_filter($filters, static fn (mixed $value): bool => $value !== '' && $value !== 'all');
$boardUrl = '/admin/pedidos' . ($cleanFilters ? '?' . http_build_query($cleanFilters) : '');
$lanes = [
    'Atencao' => ['caption' => 'Urgentes, criticos ou com problema', 'orders' => []],
    'Entrada e pagamento' => ['caption' => 'Recebidos e aguardando confirmacao', 'orders' => []],
    'Receita' => ['caption' => 'Pedidos que dependem do farmaceutico', 'orders' => []],
    'Separacao' => ['caption' => 'Liberados para separar e conferir', 'orders' => []],
    'Expedicao' => ['caption' => 'Entrega, motoboy ou retirada', 'orders' => []],
    'Finalizados' => ['caption' => 'Entregues ou cancelados', 'orders' => []],
];

foreach ($orders as $order) {
    $status = (string) ($order['status'] ?? '');
    if (!empty($order['has_problem']) || in_array((string) ($order['priority'] ?? 'normal'), ['urgent', 'critical'], true) || $status === 'receita_rejeitada') {
        $lanes['Atencao']['orders'][] = $order;
    } elseif (in_array($status, ['pedido_recebido', 'aguardando_pagamento', 'pagamento_em_analise', 'pagamento_confirmado'], true)) {
        $lanes['Entrada e pagamento']['orders'][] = $order;
    } elseif (in_array($status, ['aguardando_receita', 'receita_enviada', 'receita_em_validacao', 'receita_aprovada', 'liberado_pelo_farmaceutico'], true)) {
        $lanes['Receita']['orders'][] = $order;
    } elseif (in_array($status, ['em_separacao', 'conferido'], true)) {
        $lanes['Separacao']['orders'][] = $order;
    } elseif (in_array($status, ['saiu_para_entrega', 'pronto_para_retirada'], true)) {
        $lanes['Expedicao']['orders'][] = $order;
    } else {
        $lanes['Finalizados']['orders'][] = $order;
    }
}
?>

<section class="section-head">
  <div>
    <p class="eyebrow">Operacao</p>
    <h1>Fila de pedidos</h1>
    <p>Priorize atendimento, validacao farmaceutica, separacao, expedicao e comunicacao com cliente.</p>
  </div>
  <div class="actions">
    <a class="btn" href="/admin/receitas">Receitas</a>
    <a class="btn" href="/admin/pagamentos">Pagamentos</a>
  </div>
</section>

<div class="metric-grid ops-metrics">
  <div class="metric"><span>Abertos</span><strong><?= $summaryValue('open_orders') ?></strong></div>
  <div class="metric warning"><span>Aguardando pagamento</span><strong><?= $summaryValue('waiting_payment') ?></strong></div>
  <div class="metric warning"><span>Receitas na fila</span><strong><?= $summaryValue('prescription_queue') ?></strong></div>
  <div class="metric"><span>Separacao</span><strong><?= $summaryValue('fulfillment_queue') ?></strong></div>
  <div class="metric"><span>Expedicao</span><strong><?= $summaryValue('dispatch_queue') ?></strong></div>
  <div class="metric danger"><span>Problemas</span><strong><?= $summaryValue('problem_orders') ?></strong></div>
</div>

<section class="panel ops-filter-panel">
  <form class="filters inline-filters" method="get" action="/admin/pedidos">
    <label>Buscar
      <input name="q" value="<?= e($filters['q'] ?? '') ?>" placeholder="Pedido, cliente ou email">
    </label>
    <label>Status
      <select name="status">
        <option value="all">Todos</option>
        <?php foreach ($statusGroups as $group => $statuses): ?>
          <optgroup label="<?= e($group) ?>">
            <?php foreach ($statuses as $status): ?>
              <option value="<?= e($status) ?>" <?= ($filters['status'] ?? 'all') === $status ? 'selected' : '' ?>><?= e(status_label($status)) ?></option>
            <?php endforeach; ?>
          </optgroup>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Prioridade
      <select name="priority">
        <option value="all">Todas</option>
        <?php foreach ($priorityOptions as $priority): ?>
          <option value="<?= e($priority) ?>" <?= ($filters['priority'] ?? 'all') === $priority ? 'selected' : '' ?>><?= e(status_label($priority)) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Problema
      <select name="problem">
        <option value="all">Todos</option>
        <option value="problem" <?= ($filters['problem'] ?? 'all') === 'problem' ? 'selected' : '' ?>>Com problema</option>
        <option value="clear" <?= ($filters['problem'] ?? 'all') === 'clear' ? 'selected' : '' ?>>Sem problema</option>
      </select>
    </label>
    <label>Entrega
      <select name="delivery_method">
        <option value="all">Todas</option>
        <?php foreach (['pickup', 'local_delivery', 'motoboy', 'carrier'] as $method): ?>
          <option value="<?= e($method) ?>" <?= ($filters['delivery_method'] ?? 'all') === $method ? 'selected' : '' ?>><?= e(status_label($method)) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <div class="actions">
      <button class="btn primary" type="submit">Filtrar</button>
      <a class="btn" href="/admin/pedidos">Limpar</a>
    </div>
  </form>
</section>

<?php if (empty($orders)): ?>
  <section class="empty-state">
    <h2>Nenhum pedido encontrado</h2>
    <p>Ajuste os filtros ou aguarde novos pedidos criados na loja.</p>
  </section>
<?php else: ?>
  <section class="ops-board" aria-label="Fila operacional de pedidos">
    <?php foreach ($lanes as $laneName => $lane): ?>
      <article class="ops-lane">
        <header class="ops-lane-head">
          <div>
            <h2><?= e($laneName) ?></h2>
            <span><?= e($lane['caption']) ?></span>
          </div>
          <strong><?= count($lane['orders']) ?></strong>
        </header>

        <div class="ops-lane-list">
          <?php if (empty($lane['orders'])): ?>
            <div class="ops-empty">Fila vazia</div>
          <?php endif; ?>

          <?php foreach ($lane['orders'] as $order): ?>
            <article class="ops-order-card <?= !empty($order['has_problem']) ? 'has-problem' : '' ?>">
              <div class="ops-order-head">
                <div>
                  <a href="/admin/pedidos/<?= (int) $order['id'] ?>"><strong><?= e($order['order_number']) ?></strong></a>
                  <span><?= e($order['customer_name'] ?: 'Cliente avulso') ?></span>
                </div>
                <?= status_pill($order['status']) ?>
              </div>

              <div class="ops-order-meta">
                <span><?= money($order['grand_total']) ?></span>
                <span><?= $ageLabel($order['age_minutes'] ?? 0) ?></span>
                <span><?= (int) ($order['item_count'] ?? 0) ?> itens</span>
              </div>

              <div class="tag-row">
                <?= status_pill($order['payment_status'] ?? '') ?>
                <?= status_pill($order['delivery_method'] ?? '') ?>
                <?php if (($order['priority'] ?? 'normal') !== 'normal'): ?>
                  <?= status_pill($order['priority']) ?>
                <?php endif; ?>
                <?php if (!empty($order['requires_prescription'])): ?>
                  <span class="tag warn">Receita</span>
                <?php endif; ?>
                <?php if (!empty($order['controlled_item_count'])): ?>
                  <span class="tag danger">Controlado</span>
                <?php endif; ?>
                <?php if (!empty($order['has_problem'])): ?>
                  <span class="tag danger">Problema</span>
                <?php endif; ?>
                <?php if (!empty($order['internal_note_count'])): ?>
                  <span class="tag neutral"><?= (int) $order['internal_note_count'] ?> internas</span>
                <?php endif; ?>
              </div>

              <?php if (!empty($order['problem_reason'])): ?>
                <p class="ops-card-note"><?= e($order['problem_reason']) ?></p>
              <?php elseif (!empty($order['customer_note'])): ?>
                <p class="ops-card-note">Cliente: <?= e($order['customer_note']) ?></p>
              <?php endif; ?>

              <form class="ops-card-actions" data-admin-status data-reload-on-success="true" action="/admin/pedidos/<?= (int) $order['id'] ?>/status" method="post">
                <?= csrf_field() ?>
                <input type="hidden" name="redirect_to" value="<?= e($boardUrl) ?>">
                <input type="hidden" name="visible_to_customer" value="1">
                <select name="status" aria-label="Status do pedido <?= e($order['order_number']) ?>">
                  <?php foreach ($statusGroups as $group => $statuses): ?>
                    <optgroup label="<?= e($group) ?>">
                      <?php foreach ($statuses as $status): ?>
                        <option value="<?= e($status) ?>" <?= $order['status'] === $status ? 'selected' : '' ?>><?= e(status_label($status)) ?></option>
                      <?php endforeach; ?>
                    </optgroup>
                  <?php endforeach; ?>
                </select>
                <button class="btn primary small" type="submit">Salvar</button>
                <a class="btn small" href="/admin/pedidos/<?= (int) $order['id'] ?>">Abrir</a>
              </form>
            </article>
          <?php endforeach; ?>
        </div>
      </article>
    <?php endforeach; ?>
  </section>
<?php endif; ?>
