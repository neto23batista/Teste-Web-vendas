<?php
$points = $data['points'] ?? [];
$rules = $data['rules'] ?? [];
?>
<section class="section-head">
  <div>
    <p class="eyebrow">Fidelidade</p>
    <h1>Pontos de fidelidade</h1>
    <p>Use pontos no checkout para gerar desconto no pedido.</p>
  </div>
  <a class="btn" href="/catalogo">Comprar</a>
</section>

<div class="metric-grid">
  <div class="metric success"><span>Disponiveis</span><strong><?= (int) ($points['available_points'] ?? 0) ?></strong></div>
  <div class="metric"><span>Resgatados</span><strong><?= (int) ($points['redeemed_points'] ?? 0) ?></strong></div>
  <div class="metric"><span>Expirados</span><strong><?= (int) ($points['expired_points'] ?? 0) ?></strong></div>
  <div class="metric"><span>Total acumulado</span><strong><?= (int) ($points['lifetime_points'] ?? 0) ?></strong></div>
</div>

<section class="panel">
  <h2>Regra de conversao</h2>
  <p><?= (int) ($rules['points_per_real'] ?? 10) ?> pontos equivalem a R$ 1,00 de desconto. O resgate minimo e de <?= (int) ($rules['min_redeem_points'] ?? 10) ?> pontos e e validado novamente no backend durante o checkout.</p>
</section>

<section class="panel">
  <h2>Resgates</h2>
  <div class="table-wrap"><table><thead><tr><th>Codigo</th><th>Pedido</th><th>Pontos</th><th>Desconto</th><th>Status</th><th>Criado em</th></tr></thead><tbody>
    <?php foreach (($data['redemptions'] ?? []) as $row): ?>
      <tr><td><?= e($row['coupon_code'] ?? '-') ?></td><td><?= e($row['order_number'] ?? '-') ?></td><td><?= (int) $row['points'] ?></td><td><?= money($row['discount_amount']) ?></td><td><?= status_pill($row['status']) ?></td><td><?= e($row['created_at']) ?></td></tr>
    <?php endforeach; ?>
    <?php if (empty($data['redemptions'])): ?><tr><td colspan="6">Nenhum resgate ainda.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>

<section class="panel">
  <h2>Historico de pontos</h2>
  <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Pontos</th><th>Status</th><th>Descricao</th><th>Data</th></tr></thead><tbody>
    <?php foreach (($data['movements'] ?? []) as $row): ?>
      <tr><td><?= e(status_label($row['movement_type'])) ?></td><td><?= (int) $row['points'] ?></td><td><?= status_pill($row['status']) ?></td><td><?= e($row['description']) ?></td><td><?= e($row['created_at']) ?></td></tr>
    <?php endforeach; ?>
    <?php if (empty($data['movements'])): ?><tr><td colspan="5">Sem movimentacoes de fidelidade.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
