<section class="section-head">
  <div>
    <p class="eyebrow">Privacidade</p>
    <h1>Perfil e LGPD</h1>
    <p>Consulte dados mascarados, exporte informacoes ou solicite tratamento de conta.</p>
  </div>
</section>

<div class="checkout-layout">
  <section class="panel">
    <h2>Dados da conta</h2>
    <dl class="meta">
      <dt>CPF</dt><dd><?= e($customer['cpf_masked'] ?? '') ?></dd>
      <dt>Status LGPD</dt><dd><?= e(status_label($customer['account_status'] ?? '')) ?></dd>
    </dl>
    <a class="btn" href="/cliente/lgpd/exportar">Exportar meus dados</a>
  </section>

  <form class="form-card" action="/cliente/lgpd/solicitar" method="post">
    <?= csrf_field() ?>
    <h2>Solicitacao LGPD</h2>
    <label>Tipo
      <select name="request_type">
        <option value="export">Exportacao</option>
        <option value="anonymize">Anonimizacao</option>
        <option value="delete">Exclusao</option>
      </select>
    </label>
    <label>Descricao<textarea name="description" placeholder="Descreva sua solicitacao."></textarea></label>
    <button class="btn primary" type="submit">Enviar solicitacao</button>
  </form>
</div>
