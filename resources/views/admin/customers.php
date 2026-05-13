<section class="section-head">
  <div>
    <p class="eyebrow">Relacionamento</p>
    <h1>Clientes</h1>
    <p>Consulta operacional de clientes cadastrados, consentimento LGPD e ultimo pedido.</p>
  </div>
</section>

<?php if (empty($rows)): ?>
  <section class="empty-state">
    <h2>Nenhum cliente cadastrado</h2>
    <p>Clientes criados pelo cadastro ou checkout autenticado aparecerao aqui.</p>
  </section>
<?php else: ?>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Cliente</th><th>Contato</th><th>CPF</th><th>LGPD</th><th>Status</th><th>Ultimo pedido</th></tr></thead>
      <tbody>
      <?php foreach ($rows as $row): ?>
        <tr>
          <td><strong><?= e($row['name']) ?></strong></td>
          <td><?= e($row['email']) ?><br><span class="helper"><?= e($row['phone'] ?? '') ?></span></td>
          <td><?= e($row['cpf_masked'] ?? '') ?></td>
          <td><?= !empty($row['accepts_lgpd']) ? '<span class="tag success">Aceito</span>' : '<span class="tag warn">Pendente</span>' ?></td>
          <td><?= status_pill($row['account_status'] ?? $row['user_status']) ?></td>
          <td><?= e($row['last_order_at'] ?? 'Sem compras') ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
<?php endif; ?>
