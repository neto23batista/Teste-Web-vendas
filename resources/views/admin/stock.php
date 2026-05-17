<section class="section-head">
  <div>
    <p class="eyebrow">Estoque</p>
    <h1>Controle de estoque</h1>
    <p>Registre movimentacoes com motivo claro e acompanhe baixo estoque, vencimento e risco.</p>
  </div>
  <a class="btn" href="/admin/estoque/transferencias">Transferencias</a>
</section>

<form class="form-card" action="/admin/estoque/movimentar" method="post">
  <?= csrf_field() ?>
  <h2>Nova movimentacao</h2>
  <div class="form-grid">
    <label>ID Produto<input name="product_id" type="number" min="1" required></label>
    <label>Quantidade (+/-)<input name="quantity" type="number" required></label>
    <label>Tipo<select name="movement_type"><option value="ajuste_positivo">Ajuste positivo</option><option value="ajuste_negativo">Ajuste negativo</option><option value="perda">Perda</option><option value="devolucao">Devolucao</option><option value="inventario">Inventario</option></select></label>
    <label>Motivo<input name="reason" required placeholder="Ex.: inventario mensal, perda por avaria"></label>
  </div>
  <button class="btn primary" type="submit">Registrar movimentacao</button>
</form>

<section class="panel">
  <div class="section-head">
    <h2>Mapa de risco</h2>
    <span class="tag warn">Priorize baixo estoque e validade proxima</span>
  </div>
  <div class="table-wrap"><table><thead><tr><th>Filial</th><th>ID</th><th>Produto</th><th>Estoque</th><th>Minimo</th><th>Validade</th><th>Risco</th></tr></thead><tbody><?php foreach ($rows as $row): ?><tr><td><?= e($row['filial_nome'] ?? '') ?></td><td><?= (int) $row['product_id'] ?></td><td><strong><?= e($row['product_name']) ?></strong></td><td><?= (int) $row['current_stock'] ?></td><td><?= (int) $row['minimum_stock'] ?></td><td><?= e($row['nearest_expiration_date'] ?? 'Nao informado') ?></td><td><?= status_pill($row['risk_status']) ?></td></tr><?php endforeach; ?></tbody></table></div>
</section>
