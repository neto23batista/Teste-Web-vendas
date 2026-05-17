<section class="section-head">
  <div>
    <p class="eyebrow">Clinico</p>
    <h1>Receitas</h1>
    <p>Valide receitas com decisao, observacao e rastreabilidade para o pedido.</p>
  </div>
</section>

<?php if (empty($rows)): ?>
  <section class="empty-state">
    <h2>Nenhuma receita na fila</h2>
    <p>Pedidos com medicamento sujeito a receita aparecerao aqui para avaliacao.</p>
  </section>
<?php else: ?>
  <div class="table-wrap"><table><thead><tr><th>Filial</th><th>Pedido</th><th>Tipo</th><th>Status</th><th>Fila</th><th>Arquivo</th><th>Acao</th></tr></thead><tbody>
  <?php foreach ($rows as $row): ?><tr><td><?= e($row['filial_nome'] ?? '') ?></td><td><strong><?= e($row['order_number']) ?></strong></td><td><?= e(status_label($row['prescription_type'])) ?></td><td><?= status_pill($row['status']) ?></td><td><?= (int) $row['minutes_in_queue'] ?> min</td><td><a class="btn small" href="/admin/receitas/<?= (int) $row['prescription_id'] ?>/arquivo" target="_blank" rel="noopener">Ver arquivo</a></td><td><form class="form-grid" method="post" action="/admin/receitas/<?= (int) $row['prescription_id'] ?>/validar"><?= csrf_field() ?><select name="decision"><option value="approve">Aprovar</option><option value="reject">Rejeitar</option><option value="block">Bloquear</option></select><input name="note" placeholder="Observacao obrigatoria se rejeitar"><button class="btn primary small" type="submit">Salvar</button></form></td></tr><?php endforeach; ?>
  </tbody></table></div>
<?php endif; ?>
