<section class="section-head">
  <div>
    <p class="eyebrow">Fiscal</p>
    <h1>NF-e</h1>
    <p>Preparado para provedor fiscal real. Sem credenciais, registra homologacao/simulacao explicita sem valor fiscal.</p>
  </div>
</section>

<?php $ready = $fiscalReadiness ?? []; ?>
<section class="alert <?= !empty($ready['configured']) ? 'success' : 'warning' ?>">
  Provedor: <?= e($ready['provider'] ?? 'homologacao_interna') ?>. Ambiente: <?= e($ready['environment'] ?? 'homologacao') ?>. <?= e($ready['message'] ?? '') ?>
</section>

<form class="form-card" method="post" action="/admin/nfe/emitir">
  <?= csrf_field() ?>
  <h2>Solicitar emissao</h2>
  <div class="form-grid">
    <label>ID Pedido<input name="order_id" type="number" min="1" required></label>
    <button class="btn primary" type="submit">Solicitar</button>
  </div>
</form>

<div class="table-wrap"><table><thead><tr><th>Numero</th><th>Pedido</th><th>Chave simulada</th><th>Status legado</th><th>Status fiscal</th><th>Total</th><th></th></tr></thead><tbody><?php foreach ($rows as $row): ?><tr><td><?= (int) $row['invoice_number'] ?></td><td><strong><?= e($row['order_number']) ?></strong></td><td><?= e($row['access_key_simulated']) ?></td><td><?= status_pill($row['status']) ?></td><td><?= status_pill($row['fiscal_status'] ?? 'homologacao_simulada') ?><br><span class="helper"><?= e($row['fiscal_erro'] ?? '') ?></span></td><td><?= money($row['grand_total']) ?></td><td class="table-actions"><a class="btn small" href="/admin/nfe/<?= (int) $row['id'] ?>/danfe">DANFE</a></td></tr><?php endforeach; ?></tbody></table></div>
