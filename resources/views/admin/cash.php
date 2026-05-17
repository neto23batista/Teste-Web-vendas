<section class="section-head">
  <div>
    <p class="eyebrow">Financeiro</p>
    <h1>Caixa por filial</h1>
    <p>Abertura, movimentacoes, fechamento e divergencias ficam vinculados a filial selecionada.</p>
  </div>
</section>

<?php if ($current): ?>
  <section class="panel">
    <h2>Caixa aberto</h2>
    <div class="metric-grid">
      <div class="metric"><span>Abertura</span><strong><?= money($current['valor_abertura']) ?></strong></div>
      <div class="metric success"><span>Esperado</span><strong><?= money($current['valor_esperado']) ?></strong></div>
      <div class="metric"><span>Aberto em</span><strong><?= e($current['aberto_em']) ?></strong></div>
    </div>
    <form class="form-grid" method="post" action="/admin/caixa/movimentar">
      <?= csrf_field() ?>
      <input type="hidden" name="id_caixa" value="<?= (int) $current['id'] ?>">
      <select name="tipo"><option value="sangria">Sangria</option><option value="suprimento">Suprimento</option><option value="ajuste">Ajuste</option></select>
      <select name="forma_pagamento"><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="cartao_balcao">Cartao balcao</option><option value="mercado_pago">Mercado Pago</option><option value="pagamento_entrega">Pagamento entrega</option></select>
      <input name="valor" type="number" step="0.01" required placeholder="Valor positivo ou negativo">
      <input name="descricao" placeholder="Descricao">
      <button class="btn primary">Registrar</button>
    </form>
    <form class="form-grid" method="post" action="/admin/caixa/<?= (int) $current['id'] ?>/fechar">
      <?= csrf_field() ?>
      <input name="valor_fechamento" type="number" step="0.01" required placeholder="Valor contado no fechamento">
      <button class="btn danger">Fechar caixa</button>
    </form>
  </section>
<?php else: ?>
  <form class="form-card" method="post" action="/admin/caixa/abrir">
    <?= csrf_field() ?>
    <h2>Abrir caixa</h2>
    <label>Valor de abertura<input name="valor_abertura" type="number" step="0.01" value="0.00" required></label>
    <button class="btn primary">Abrir caixa</button>
  </form>
<?php endif; ?>

<section class="panel">
  <h2>Historico de caixas</h2>
  <div class="table-wrap"><table><thead><tr><th>Filial</th><th>Status</th><th>Abertura</th><th>Fechamento</th><th>Esperado</th><th>Divergencia</th></tr></thead><tbody>
    <?php foreach ($rows as $row): ?>
      <tr><td><?= e($row['filial_nome']) ?></td><td><?= status_pill($row['status']) ?></td><td><?= money($row['valor_abertura']) ?></td><td><?= money($row['valor_fechamento'] ?? 0) ?></td><td><?= money($row['valor_esperado']) ?></td><td><?= money($row['divergencia']) ?></td></tr>
    <?php endforeach; ?>
    <?php if (empty($rows)): ?><tr><td colspan="6">Sem caixas registrados.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
