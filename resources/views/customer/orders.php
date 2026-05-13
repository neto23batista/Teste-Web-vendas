<section class="section-head">
  <div>
    <p class="eyebrow">Historico</p>
    <h1>Meus pedidos</h1>
  </div>
  <a class="btn" href="/catalogo">Novo pedido</a>
</section>

<?php if (empty($orders)): ?>
  <section class="empty-state">
    <h2>Nenhum pedido encontrado</h2>
    <p>Seu historico de compras ficara disponivel depois do primeiro checkout.</p>
  </section>
<?php else: ?>
  <div class="table-wrap">
    <table><thead><tr><th>Pedido</th><th>Status</th><th>Pagamento</th><th>Total</th><th></th></tr></thead><tbody>
      <?php foreach ($orders as $order): ?><tr><td><strong><?= e($order['order_number']) ?></strong></td><td><?= status_pill($order['status']) ?></td><td><?= status_pill($order['payment_status']) ?></td><td><?= money($order['grand_total']) ?></td><td class="table-actions"><a class="btn small" href="/cliente/pedidos/<?= (int) $order['id'] ?>">Abrir</a></td></tr><?php endforeach; ?>
    </tbody></table>
  </div>
<?php endif; ?>
