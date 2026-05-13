<section class="auth-page">
  <form class="auth-card" action="/login" method="post">
    <?= csrf_field() ?>
    <p class="eyebrow">Acesso do cliente</p>
    <h1>Entrar</h1>
    <p>Acompanhe pedidos, historico de compras e solicitacoes de privacidade.</p>
    <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
    <label>Senha<input type="password" name="password" required autocomplete="current-password"></label>
    <button class="btn primary" type="submit">Entrar</button>
    <div class="auth-links">
      <a href="/esqueci-senha">Esqueci minha senha</a>
      <a href="/cadastro">Criar conta</a>
    </div>
  </form>
</section>
