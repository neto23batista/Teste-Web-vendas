<section class="section-head">
  <div>
    <p class="eyebrow">Catalogo</p>
    <h1>Avaliacoes de produtos</h1>
    <p>Modere comentarios antes de exibir no catalogo publico.</p>
  </div>
</section>

<section class="panel">
  <div class="table-wrap"><table><thead><tr><th>Produto</th><th>Cliente</th><th>Filial</th><th>Nota</th><th>Comentario</th><th>Status</th><th>Acoes</th></tr></thead><tbody>
    <?php foreach ($rows as $row): ?>
      <tr>
        <td><strong><?= e($row['product_name']) ?></strong><br><small><?= e($row['order_number'] ?? '') ?></small></td>
        <td><?= e($row['customer_name']) ?></td>
        <td><?= e($row['filial_nome'] ?? '-') ?></td>
        <td><?= (int) $row['rating'] ?>/5</td>
        <td><?= e($row['comment'] ?? '') ?></td>
        <td><?= status_pill($row['status']) ?></td>
        <td>
          <form method="post" action="/admin/avaliacoes/<?= (int) $row['id'] ?>/moderar" class="form-grid">
            <?= csrf_field() ?>
            <select name="status">
              <option value="approved">Aprovar</option>
              <option value="rejected">Rejeitar</option>
            </select>
            <input name="moderation_note" placeholder="Nota interna">
            <button class="btn small" type="submit">Salvar</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($rows)): ?><tr><td colspan="7">Nenhuma avaliacao encontrada.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
