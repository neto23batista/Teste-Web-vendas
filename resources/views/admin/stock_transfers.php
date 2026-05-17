<section class="section-head">
  <div>
    <p class="eyebrow">Estoque multi-filial</p>
    <h1>Transferencias de estoque</h1>
    <p>Solicite, aprove, envie e conclua transferencias entre lojas com movimentacao nas duas filiais.</p>
  </div>
  <a class="btn" href="/admin/estoque">Voltar ao estoque</a>
</section>

<?php
  $originBranches = $originBranches ?? ($branches ?? []);
  $destinationBranches = $destinationBranches ?? ($branches ?? []);
  $canRequestTransfer = !empty($products) && !empty($originBranches) && count($destinationBranches) > 1;
?>

<?php if (!$canRequestTransfer): ?>
  <section class="alert warning">Cadastre ao menos duas filiais ativas e produtos com estoque por filial antes de solicitar transferencias.</section>
<?php endif; ?>

<form class="form-card" action="/admin/estoque/transferencias" method="post">
  <?= csrf_field() ?>
  <h2>Nova solicitacao</h2>
  <div class="form-grid">
    <label>Produto
      <select name="product_id" required>
        <?php foreach ($products as $product): ?>
          <option value="<?= (int) $product['id'] ?>">#<?= (int) $product['id'] ?> - <?= e($product['name']) ?> (<?= (int) $product['current_stock'] ?> un. disponiveis)</option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Origem
      <select name="id_filial_origem" required>
        <?php foreach ($originBranches as $branch): ?>
          <option value="<?= (int) $branch['id'] ?>"><?= e($branch['nome']) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Destino
      <select name="id_filial_destino" required>
        <?php foreach ($destinationBranches as $branch): ?>
          <option value="<?= (int) $branch['id'] ?>"><?= e($branch['nome']) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Quantidade<input type="number" min="1" name="quantidade" required></label>
    <label>Observacao<input name="observacao" maxlength="255" placeholder="Motivo da transferencia"></label>
  </div>
  <button class="btn primary" type="submit" <?= $canRequestTransfer ? '' : 'disabled' ?>>Solicitar transferencia</button>
</form>

<section class="panel">
  <h2>Historico de transferencias</h2>
  <div class="table-wrap"><table><thead><tr><th>ID</th><th>Produto</th><th>Origem</th><th>Destino</th><th>Qtd</th><th>Status</th><th>Solicitada por</th><th>Atualizacao</th><th>Acoes</th></tr></thead><tbody>
    <?php foreach ($rows as $row): ?>
      <tr>
        <td>#<?= (int) $row['id'] ?></td>
        <td><strong><?= e($row['produto_nome']) ?></strong></td>
        <td><?= e($row['origem_nome']) ?></td>
        <td><?= e($row['destino_nome']) ?></td>
        <td><?= (int) $row['quantidade'] ?></td>
        <td><?= status_pill($row['status']) ?></td>
        <td><?= e($row['solicitado_por_nome'] ?? 'Sistema') ?></td>
        <td><?= e($row['atualizado_em'] ?? $row['criado_em'] ?? '') ?></td>
        <td class="table-actions">
          <?php $actions = $row['acoes_permitidas'] ?? []; ?>
          <?php foreach ($actions as $action => $label): ?>
            <form method="post" action="/admin/estoque/transferencias/<?= (int) $row['id'] ?>" class="inline">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="<?= e($action) ?>">
              <button class="btn small" type="submit"><?= e($label) ?></button>
            </form>
          <?php endforeach; ?>
          <?php if (empty($actions)): ?><span class="tag neutral">Sem acao disponivel</span><?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($rows)): ?><tr><td colspan="9">Nenhuma transferencia registrada.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
