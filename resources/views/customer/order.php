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

<?php if (($order['status'] ?? '') === 'entregue' || ($order['payment_status'] ?? '') === 'aprovado'): ?>
<section class="panel">
  <h2>Avaliar produtos</h2>
  <div class="table-wrap"><table><thead><tr><th>Produto</th><th>Avaliacao</th></tr></thead><tbody>
    <?php foreach ($items as $item): ?>
      <?php $review = $existingReviews[(int) $item['product_id']] ?? null; ?>
      <tr>
        <td><strong><?= e($item['product_name']) ?></strong></td>
        <td>
          <?php if ($review): ?>
            <?= status_pill($review['status']) ?>
          <?php else: ?>
            <form method="post" action="/cliente/avaliacoes" class="inline-form">
              <?= csrf_field() ?>
              <input type="hidden" name="order_id" value="<?= (int) $order['id'] ?>">
              <input type="hidden" name="product_id" value="<?= (int) $item['product_id'] ?>">
              <select name="rating" required>
                <option value="5">5 estrelas</option>
                <option value="4">4 estrelas</option>
                <option value="3">3 estrelas</option>
                <option value="2">2 estrelas</option>
                <option value="1">1 estrela</option>
              </select>
              <input name="comment" maxlength="500" placeholder="Comentario opcional">
              <button class="btn small" type="submit">Enviar</button>
            </form>
          <?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
  </tbody></table></div>
</section>
<?php endif; ?>
<?php endif; ?>
