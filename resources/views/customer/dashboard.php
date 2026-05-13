<section class="section-head">
  <div>
    <p class="eyebrow">Area do cliente</p>
    <h1>Minha conta</h1>
    <p>Acompanhe pedidos, privacidade e historico de compras.</p>
  </div>
  <div class="actions">
    <a class="btn" href="/cliente/pedidos">Meus pedidos</a>
    <a class="btn" href="/cliente/perfil">Perfil</a>
  </div>
</section>

<div class="metric-grid">
  <div class="metric"><span>Pedidos recentes</span><strong><?= count($orders) ?></strong></div>
  <div class="metric success"><span>Privacidade</span><strong>LGPD</strong></div>
  <div class="metric"><span>Atendimento</span><strong>Farmacia</strong></div>
</div>

<section class="panel">
  <div class="section-head">
    <h2>Pedidos recentes</h2>
    <a class="btn small" href="/catalogo">Comprar novamente</a>
  </div>
  <?php if (empty($orders)): ?>
    <section class="empty-state">
      <h2>Nenhum pedido ainda</h2>
      <p>Quando voce finalizar uma compra, ela aparecera aqui com status e detalhes.</p>
      <a class="btn primary" href="/catalogo">Ver catalogo</a>
    </section>
  <?php else: ?>
    <div class="table-wrap">
      <table><thead><tr><th>Pedido</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>
        <?php foreach ($orders as $order): ?><tr><td><strong><?= e($order['order_number']) ?></strong></td><td><?= status_pill($order['status']) ?></td><td><?= money($order['grand_total']) ?></td><td class="table-actions"><a class="btn small" href="/cliente/pedidos/<?= (int) $order['id'] ?>">Detalhes</a></td></tr><?php endforeach; ?>
      </tbody></table>
    </div>
  <?php endif; ?>
</section>
