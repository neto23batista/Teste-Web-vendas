<section class="section-head">
  <div>
    <p class="eyebrow">Sacola</p>
    <h1>Sua compra</h1>
    <p>Revise quantidades, estoque e itens com receita antes de seguir para o checkout.</p>
  </div>
  <a class="btn" href="/catalogo">Continuar comprando</a>
</section>

<?php if (empty($summary['items'])): ?>
  <section class="empty-state">
    <h2>Sacola vazia</h2>
    <p>Adicione medicamentos, perfumaria ou itens de cuidado para iniciar seu pedido.</p>
    <a class="btn primary" href="/catalogo">Ver catalogo</a>
  </section>
<?php else: ?>
  <div class="cart-layout">
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produto</th><th>Qtd</th><th>Total</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($summary['items'] as $item): ?>
          <tr>
            <td>
              <strong><?= e($item['name']) ?></strong>
              <div class="tag-row">
                <?php if ((int) ($item['requires_prescription'] ?? 0) === 1): ?><span class="tag warn">Exige receita</span><?php endif; ?>
                <?php if (($item['remote_sale_policy'] ?? '') === 'blocked'): ?><span class="tag danger">Validacao obrigatoria</span><?php endif; ?>
              </div>
            </td>
            <td><input class="qty-input" data-item-id="<?= (int) $item['id'] ?>" type="number" min="1" max="<?= (int) $item['current_stock'] ?>" value="<?= (int) $item['quantity'] ?>" aria-label="Quantidade de <?= e($item['name']) ?>"></td>
            <td><strong><?= money($item['line_total']) ?></strong></td>
            <td class="table-actions"><button class="btn danger remove-cart small" type="button" data-item-id="<?= (int) $item['id'] ?>">Remover</button></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>

    <aside class="summary-card">
      <h2>Resumo</h2>
      <div class="summary-line"><span>Itens</span><strong><?= (int) ($summary['count'] ?? 0) ?></strong></div>
      <div class="summary-line total"><span>Total</span><strong><?= money($summary['cart']['grand_total'] ?? 0) ?></strong></div>
      <a class="btn primary full" href="/checkout">Ir para checkout</a>
      <ul class="secure-list">
        <li>Precos e estoque sao recalculados ao finalizar.</li>
        <li>Receitas ficam protegidas fora da pasta publica.</li>
        <li>Pedido pode ser entregue ou retirado na farmacia.</li>
      </ul>
    </aside>
  </div>
<?php endif; ?>
