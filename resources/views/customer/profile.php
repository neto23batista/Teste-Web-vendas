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
      <dt>Nome</dt><dd><?= e($customer['name'] ?? '') ?></dd>
      <dt>E-mail</dt><dd><?= e($customer['email'] ?? '') ?></dd>
      <dt>CPF</dt><dd><?= e($customer['cpf_masked'] ?? '') ?></dd>
      <dt>Status LGPD</dt><dd><?= e(status_label($customer['account_status'] ?? '')) ?></dd>
    </dl>
    <a class="btn" href="/cliente/lgpd/exportar">Exportar meus dados</a>
  </section>

  <form class="form-card" action="/cliente/perfil" method="post">
    <?= csrf_field() ?>
    <h2>Editar perfil</h2>
    <div class="form-grid">
      <label>Nome completo
        <input name="name" required maxlength="160" value="<?= e($customer['name'] ?? '') ?>">
      </label>
      <label>E-mail
        <input type="email" name="email" required maxlength="190" value="<?= e($customer['email'] ?? '') ?>">
      </label>
      <label>Telefone
        <input name="phone" maxlength="30" data-mask="phone" value="<?= e($customer['phone'] ?? '') ?>">
      </label>
      <label>Data de nascimento
        <input type="date" name="birth_date" value="<?= e($customer['birth_date'] ?? '') ?>">
      </label>
      <label>Genero
        <select name="gender">
          <?php $gender = (string) ($customer['gender'] ?? 'not_informed'); ?>
          <option value="not_informed" <?= $gender === 'not_informed' ? 'selected' : '' ?>>Prefiro nao informar</option>
          <option value="female" <?= $gender === 'female' ? 'selected' : '' ?>>Feminino</option>
          <option value="male" <?= $gender === 'male' ? 'selected' : '' ?>>Masculino</option>
          <option value="non_binary" <?= $gender === 'non_binary' ? 'selected' : '' ?>>Nao binario</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" name="marketing_opt_in" value="1" <?= !empty($customer['marketing_opt_in']) ? 'checked' : '' ?>> Receber ofertas e lembretes</label>
    </div>
    <button class="btn primary" type="submit">Salvar perfil</button>
  </form>

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
