<?php if (!$order): ?>
  <section class="empty-state">
    <h1>Pedido nao encontrado</h1>
    <p>Confira seu historico ou fale com a farmacia.</p>
    <a class="btn primary" href="/cliente/pedidos">Voltar aos pedidos</a>
  </section>
<?php else: ?>
<section class="section-head">
  <div>
    <p class="eyebrow">Detalhes do pedido</p>
    <h1><?= e($order['order_number']) ?></h1>
  </div>
  <div class="actions">
    <a class="btn" href="/pedido/<?= e($order['public_id']) ?>">Timeline publica</a>
    <a class="btn" href="/cliente/pedidos">Voltar</a>
  </div>
</section>

<div class="metric-grid">
  <div class="metric"><span>Status</span><strong><?= e(status_label($order['status'])) ?></strong></div>
  <div class="metric"><span>Pagamento</span><strong><?= e(status_label($order['payment_status'])) ?></strong></div>
  <div class="metric"><span>Total</span><strong><?= money($order['grand_total']) ?></strong></div>
</div>

<section class="panel">
  <h2>Itens</h2>
  <div class="table-wrap"><table><thead><tr><th>Item</th><th>Qtd</th><th>Total</th></tr></thead><tbody>
  <?php foreach ($items as $item): ?><tr><td><?= e($item['product_name']) ?></td><td><?= (int) $item['quantity'] ?></td><td><?= money($item['line_total']) ?></td></tr><?php endforeach; ?>
  </tbody></table></div>
</section>
<?php endif; ?>
