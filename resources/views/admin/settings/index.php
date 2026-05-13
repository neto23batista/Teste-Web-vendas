<section class="section-head">
  <div>
    <p class="eyebrow">Sistema</p>
    <h1>Configuracoes e migrations</h1>
    <p>Revise parametros, dados sensiveis protegidos e migrations pendentes antes de publicar.</p>
  </div>
</section>

<section class="panel">
  <h2>Migrations pendentes</h2>
  <form method="post" action="/admin/configuracoes/migrations">
    <?= csrf_field() ?>
    <?php if (empty($pendingMigrations)): ?>
      <div class="alert success">Nenhuma migration pendente.</div>
    <?php else: ?>
      <div class="checks">
        <?php foreach ($pendingMigrations as $m): ?>
          <label class="check"><input type="checkbox" name="migrations[]" value="<?= e($m['name']) ?>"> <?= e($m['name']) ?></label>
        <?php endforeach; ?>
      </div>
      <button class="btn primary" type="submit">Executar selecionadas</button>
    <?php endif; ?>
  </form>
</section>

<section class="panel"><h2>Configuracoes</h2><div class="table-wrap"><table><thead><tr><th>Grupo</th><th>Chave</th><th>Valor</th><th>Sensivel</th></tr></thead><tbody><?php foreach ($settings as $s): ?><tr><td><?= e($s['setting_group']) ?></td><td><strong><?= e($s['setting_key']) ?></strong></td><td><?= $s['is_sensitive'] ? '[protegido]' : e($s['setting_value']) ?></td><td><?= (int) $s['is_sensitive'] ? '<span class="tag warn">Sim</span>' : '<span class="tag success">Nao</span>' ?></td></tr><?php endforeach; ?></tbody></table></div></section>
<section class="panel"><h2>Migrations executadas</h2><div class="table-wrap"><table><thead><tr><th>Migration</th><th>Modulo</th><th>Status</th><th>Executada</th></tr></thead><tbody><?php foreach ($migrations as $m): ?><tr><td><strong><?= e($m['migration']) ?></strong></td><td><?= e($m['module']) ?></td><td><?= status_pill($m['status']) ?></td><td><?= e($m['finished_at'] ?? '') ?></td></tr><?php endforeach; ?></tbody></table></div></section>
