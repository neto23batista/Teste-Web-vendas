<section class="auth-page">
  <form class="auth-card" action="/esqueci-senha" method="post">
    <?= csrf_field() ?>
    <p class="eyebrow">Recuperacao de acesso</p>
    <h1>Recuperar senha</h1>
    <p>Enviaremos um link seguro para o e-mail cadastrado.</p>
    <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
    <button class="btn primary" type="submit">Enviar link seguro</button>
    <a href="/login">Voltar para login</a>
  </form>
</section>
