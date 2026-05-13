<section class="auth-page">
  <form class="auth-card" action="/redefinir-senha" method="post">
    <?= csrf_field() ?>
    <p class="eyebrow">Nova senha</p>
    <h1>Redefinir senha</h1>
    <p>Escolha uma senha forte para proteger seus pedidos e dados pessoais.</p>
    <input type="hidden" name="token" value="<?= e($token ?? '') ?>">
    <label>Nova senha<input type="password" name="password" required autocomplete="new-password"></label>
    <button class="btn primary" type="submit">Salvar nova senha</button>
  </form>
</section>
