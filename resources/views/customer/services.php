<section class="section-head">
  <div>
    <p class="eyebrow">Agenda</p>
    <h1>Servicos da farmacia</h1>
    <p>Agende atendimento clinico por filial.</p>
  </div>
  <a class="btn" href="/cliente">Minha conta</a>
</section>

<form class="form-card" method="post" action="/cliente/servicos">
  <?= csrf_field() ?>
  <h2>Novo agendamento</h2>
  <div class="form-grid">
    <label>Filial
      <select name="id_filial" required>
        <?php foreach ($branches as $branch): ?>
          <option value="<?= (int) $branch['id'] ?>"><?= e($branch['nome']) ?> - <?= e($branch['cidade'] ?? '') ?>/<?= e($branch['estado'] ?? '') ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Servico
      <select name="id_servico" required>
        <?php foreach ($services as $service): ?>
          <option value="<?= (int) $service['id'] ?>"><?= e($service['nome']) ?> - <?= (int) $service['duracao_minutos'] ?> min - <?= money($service['preco']) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Data e hora<input type="datetime-local" name="data_hora" required></label>
    <label>Observacao<input name="observacao" maxlength="255" placeholder="Preferencia ou informacao relevante"></label>
  </div>
  <button class="btn primary" type="submit">Agendar</button>
</form>

<section class="panel">
  <h2>Meus agendamentos</h2>
  <div class="table-wrap"><table><thead><tr><th>Servico</th><th>Filial</th><th>Data</th><th>Status</th><th>Observacao</th></tr></thead><tbody>
    <?php foreach ($appointments as $row): ?>
      <tr><td><strong><?= e($row['servico_nome']) ?></strong></td><td><?= e($row['filial_nome']) ?></td><td><?= e($row['data_hora']) ?></td><td><?= status_pill($row['status']) ?></td><td><?= e($row['observacao'] ?? '') ?></td></tr>
    <?php endforeach; ?>
    <?php if (empty($appointments)): ?><tr><td colspan="5">Nenhum agendamento encontrado.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
