<section class="section-head">
  <div>
    <p class="eyebrow">Auditoria</p>
    <h1>Logs e auditoria</h1>
    <p>Eventos de seguranca e acoes administrativas para rastreabilidade operacional.</p>
  </div>
</section>

<section class="panel"><h2>Seguranca</h2><div class="table-wrap"><table><thead><tr><th>Evento</th><th>Severidade</th><th>IP</th><th>Data</th></tr></thead><tbody><?php foreach ($security as $row): ?><tr><td><strong><?= e(status_label($row['event_type'])) ?></strong></td><td><?= status_pill($row['severity']) ?></td><td><?= e($row['ip_address'] ?? '') ?></td><td><?= e($row['created_at']) ?></td></tr><?php endforeach; ?></tbody></table></div></section>
<section class="panel"><h2>Administrativo</h2><div class="table-wrap"><table><thead><tr><th>Modulo</th><th>Acao</th><th>Entidade</th><th>Data</th></tr></thead><tbody><?php foreach ($audit as $row): ?><tr><td><?= e(status_label($row['module'])) ?></td><td><strong><?= e(status_label($row['action'])) ?></strong></td><td><?= e($row['entity_type'] ?? '') ?></td><td><?= e($row['created_at']) ?></td></tr><?php endforeach; ?></tbody></table></div></section>
