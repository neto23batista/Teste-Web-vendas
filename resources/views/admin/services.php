<section class="section-head">
  <div>
    <p class="eyebrow">Clinico</p>
    <h1>Servicos clinicos</h1>
    <p>Configure servicos e acompanhe agenda por filial.</p>
  </div>
</section>

<form class="form-card" method="post" action="/admin/servicos">
  <?= csrf_field() ?>
  <h2>Novo servico</h2>
  <div class="form-grid">
    <label>Nome<input name="nome" required></label>
    <label>Duracao em minutos<input name="duracao_minutos" type="number" min="5" value="30" required></label>
    <label>Preco<input name="preco" type="number" step="0.01" min="0" value="0.00"></label>
    <label>Status<select name="status"><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
    <label>Descricao<input name="descricao" maxlength="255"></label>
  </div>
  <button class="btn primary" type="submit">Salvar servico</button>
</form>

<section class="panel">
  <h2>Servicos cadastrados</h2>
  <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Duracao</th><th>Preco</th><th>Status</th></tr></thead><tbody>
    <?php foreach ($services as $service): ?>
      <tr><td><strong><?= e($service['nome']) ?></strong><br><small><?= e($service['descricao'] ?? '') ?></small></td><td><?= (int) $service['duracao_minutos'] ?> min</td><td><?= money($service['preco']) ?></td><td><?= status_pill($service['status']) ?></td></tr>
    <?php endforeach; ?>
  </tbody></table></div>
</section>

<section class="panel">
  <h2>Agenda</h2>
  <div class="table-wrap"><table><thead><tr><th>Data</th><th>Servico</th><th>Cliente</th><th>Filial</th><th>Status</th><th>Acoes</th></tr></thead><tbody>
    <?php foreach ($appointments as $row): ?>
      <tr>
        <td><?= e($row['data_hora']) ?></td>
        <td><strong><?= e($row['servico_nome']) ?></strong></td>
        <td><?= e($row['cliente_nome'] ?? '-') ?><br><small><?= e($row['cliente_email'] ?? '') ?></small></td>
        <td><?= e($row['filial_nome']) ?></td>
        <td><?= status_pill($row['status']) ?></td>
        <td>
          <form method="post" action="/admin/servicos/agendamentos/<?= (int) $row['id'] ?>" class="inline-form">
            <?= csrf_field() ?>
            <select name="status">
              <?php foreach (['agendado','confirmado','atendido','cancelado','faltou'] as $status): ?>
                <option value="<?= e($status) ?>" <?= $row['status'] === $status ? 'selected' : '' ?>><?= e(status_label($status)) ?></option>
              <?php endforeach; ?>
            </select>
            <button class="btn small" type="submit">Atualizar</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($appointments)): ?><tr><td colspan="6">Nenhum agendamento encontrado.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
