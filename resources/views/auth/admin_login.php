<section class="auth-page">
  <form class="auth-card" action="/admin/login" method="post">
    <?= csrf_field() ?>
    <p class="eyebrow">Painel administrativo</p>
    <h1>Admin FarmaVida</h1>
    <p>Acesso restrito para operacao da farmacia, estoque, pedidos, receitas e auditoria.</p>
    <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
    <label>Senha<input type="password" name="password" required autocomplete="current-password"></label>
    <button class="btn primary" type="submit">Entrar no painel</button>
    <a href="/">Voltar para loja</a>
  </form>
</section>
