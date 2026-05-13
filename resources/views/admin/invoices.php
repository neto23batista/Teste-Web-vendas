<section class="section-head">
  <div>
    <p class="eyebrow">Fiscal</p>
    <h1>NF-e simulada</h1>
    <p>Emissao simulada para conferencia interna. Nao substitui transmissao fiscal real.</p>
  </div>
</section>

<form class="form-card" method="post" action="/admin/nfe/emitir">
  <?= csrf_field() ?>
  <h2>Emitir simulada</h2>
  <div class="form-grid">
    <label>ID Pedido<input name="order_id" type="number" min="1" required></label>
    <button class="btn primary" type="submit">Emitir simulada</button>
  </div>
</form>

<div class="table-wrap"><table><thead><tr><th>Numero</th><th>Pedido</th><th>Chave simulada</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody><?php foreach ($rows as $row): ?><tr><td><?= (int) $row['invoice_number'] ?></td><td><strong><?= e($row['order_number']) ?></strong></td><td><?= e($row['access_key_simulated']) ?></td><td><?= status_pill($row['status']) ?></td><td><?= money($row['grand_total']) ?></td><td class="table-actions"><a class="btn small" href="/admin/nfe/<?= (int) $row['id'] ?>/danfe">DANFE</a></td></tr><?php endforeach; ?></tbody></table></div>
