<section class="section-head">
  <div>
    <p class="eyebrow">Integracoes</p>
    <h1>APIs e webhooks</h1>
    <p>Conecte ERP, automacoes e eventos externos com escopos controlados.</p>
  </div>
</section>

<div class="admin-grid">
  <section class="panel">
    <h2>Nova API Key</h2>
    <form class="form-grid" method="post" action="/admin/integracoes/api-key">
      <?= csrf_field() ?>
      <input name="name" placeholder="Nome da integracao" required>
      <input name="scopes" value='["products:read","orders:read","stock:read"]' required>
      <button class="btn primary">Criar API Key</button>
    </form>
  </section>
  <section class="panel">
    <h2>Webhook de saida</h2>
    <form class="form-grid" method="post" action="/admin/integracoes/webhook-saida">
      <?= csrf_field() ?>
      <input name="name" placeholder="Nome" required>
      <select name="event_type"><option value="pedido_criado">Pedido criado</option><option value="status_atualizado">Status atualizado</option><option value="pagamento_confirmado">Pagamento confirmado</option><option value="estoque_baixo">Estoque baixo</option><option value="estoque_zerado">Estoque zerado</option><option value="nfe_emitida">NF-e emitida</option><option value="receita_aprovada">Receita aprovada</option><option value="receita_rejeitada">Receita rejeitada</option></select>
      <input name="target_url" placeholder="https://..." required>
      <input name="secret" placeholder="Segredo opcional">
      <button class="btn primary">Salvar webhook</button>
    </form>
  </section>
  <section class="panel">
    <h2>Webhook de entrada</h2>
    <form class="form-grid" method="post" action="/admin/integracoes/webhook-entrada">
      <?= csrf_field() ?>
      <input name="name" placeholder="Nome" required>
      <select name="source"><option value="custom">Custom</option><option value="bling">Bling</option><option value="omie">Omie</option><option value="conta_azul">Conta Azul</option><option value="zapier">Zapier</option><option value="make">Make</option></select>
      <input name="scopes" value='["external:write"]' required>
      <button class="btn primary">Criar endpoint</button>
    </form>
  </section>
</div>

<section class="panel"><h2>API Keys</h2><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Prefixo</th><th>Status</th><th>Ultimo uso</th></tr></thead><tbody><?php foreach ($apiKeys as $key): ?><tr><td><strong><?= e($key['name']) ?></strong></td><td><?= e($key['key_prefix']) ?></td><td><?= status_pill($key['status']) ?></td><td><?= e($key['last_used_at'] ?? 'Nunca') ?></td></tr><?php endforeach; ?></tbody></table></div></section>
<section class="panel"><h2>Webhooks de saida</h2><div class="table-wrap"><table><thead><tr><th>Evento</th><th>URL</th><th>Status</th></tr></thead><tbody><?php foreach ($webhooks as $hook): ?><tr><td><?= e(status_label($hook['event_type'])) ?></td><td><?= e($hook['target_url']) ?></td><td><?= status_pill($hook['status']) ?></td></tr><?php endforeach; ?></tbody></table></div></section>
