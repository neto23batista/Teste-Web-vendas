<section class="section-head">
  <div>
    <p class="eyebrow">Operacao tecnica</p>
    <h1>Jobs assincronos</h1>
    <p>E-mails, WhatsApp, webhooks e NF-e ficam fora do fluxo sincrono de pedidos.</p>
  </div>
</section>

<section class="panel">
  <div class="table-wrap"><table><thead><tr><th>ID</th><th>Tipo</th><th>Status</th><th>Tentativas</th><th>Executar em</th><th>Erro</th></tr></thead><tbody>
    <?php foreach ($rows as $row): ?>
      <tr><td><?= (int) $row['id'] ?></td><td><?= e($row['tipo']) ?></td><td><?= status_pill($row['status']) ?></td><td><?= (int) $row['tentativas'] ?></td><td><?= e($row['executar_em']) ?></td><td><?= e($row['erro'] ?? '') ?></td></tr>
    <?php endforeach; ?>
    <?php if (empty($rows)): ?><tr><td colspan="6">Sem jobs pendentes ou falhos.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
