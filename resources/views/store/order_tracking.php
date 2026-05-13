<?php if (!$order): ?>
  <section class="empty-state">
    <h1>Pedido nao encontrado</h1>
    <p>Confira o link recebido por e-mail ou acesse sua conta para ver o historico.</p>
    <a class="btn primary" href="/cliente">Minha conta</a>
  </section>
<?php else: ?>
<section class="section-head">
  <div>
    <p class="eyebrow">Acompanhamento</p>
    <h1>Pedido <?= e($order['order_number']) ?></h1>
  </div>
  <span class="status-pill <?= e(status_class($order['status'])) ?>" data-live-order-pill><?= e(status_label($order['status'])) ?></span>
</section>

<div class="metric-grid">
  <div class="metric"><span>Status do pedido</span><strong><?= e(status_label($order['status'])) ?></strong></div>
  <div class="metric"><span>Pagamento</span><strong><?= e(status_label($order['payment_status'])) ?></strong></div>
  <div class="metric"><span>Total</span><strong><?= money($order['grand_total']) ?></strong></div>
</div>

<?php if ($order['payment_status'] !== 'aprovado' && $order['status'] !== 'cancelado'): ?>
  <section class="panel">
    <?php
      $paymentReady = (bool) (($paymentReadiness['checkout_ready'] ?? true));
      $paymentNotice = trim((string) ($paymentReadiness['summary'] ?? ''));
      $webhookNotice = trim((string) ($paymentReadiness['notification_url']['message'] ?? ''));
    ?>
    <?php if (!$paymentReady): ?>
      <div class="alert error">Pagamento Mercado Pago indisponivel: <?= e($paymentNotice ?: 'configuracao pendente.') ?></div>
    <?php elseif ($webhookNotice !== ''): ?>
      <p class="helper"><?= e($webhookNotice) ?></p>
    <?php endif; ?>
    <div class="section-head">
      <div>
        <h2>Pagamento pendente</h2>
        <p>Finalize o pagamento para liberar a separacao do pedido.</p>
      </div>
      <form action="/pagamento/mercado-pago/<?= e($order['public_id']) ?>" method="post" class="inline">
        <?= csrf_field() ?>
        <button class="btn primary" type="submit" <?= $paymentReady ? '' : 'disabled' ?>>Pagar com Mercado Pago</button>
      </form>
    </div>
  </section>
<?php endif; ?>

<section class="panel">
  <h2>Timeline</h2>
  <div class="timeline" data-order-status="<?= e($order['public_id']) ?>">
    <?php foreach ($history as $event): ?>
      <div><strong><?= e(status_label($event['new_status'])) ?></strong><span><?= e($event['message_to_customer'] ?? '') ?></span><small><?= e($event['created_at']) ?></small></div>
    <?php endforeach; ?>
  </div>
</section>

<section class="panel">
  <h2>Itens do pedido</h2>
  <div class="table-wrap">
    <table><thead><tr><th>Item</th><th>Qtd</th><th>Total</th></tr></thead><tbody>
      <?php foreach ($items as $item): ?><tr><td><?= e($item['product_name']) ?></td><td><?= (int) $item['quantity'] ?></td><td><?= money($item['line_total']) ?></td></tr><?php endforeach; ?>
    </tbody></table>
  </div>
</section>
<?php endif; ?>
