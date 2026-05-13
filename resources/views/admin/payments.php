<section class="section-head">
  <div>
    <p class="eyebrow">Financeiro</p>
    <h1>Pagamentos</h1>
    <p>Acompanhe metodo, status, provedor e valor dos pagamentos vinculados aos pedidos.</p>
  </div>
</section>

<div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Metodo</th><th>Status</th><th>Valor</th><th>Provedor</th></tr></thead><tbody><?php foreach ($rows as $row): ?><tr><td><strong><?= e($row['order_number']) ?></strong></td><td><?= e(status_label($row['payment_method'])) ?></td><td><?= status_pill($row['status']) ?></td><td><strong><?= money($row['amount']) ?></strong></td><td><?= e($row['provider_payment_id'] ?? 'Aguardando') ?></td></tr><?php endforeach; ?></tbody></table></div>
