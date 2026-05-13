<section class="auth-page">
  <form class="auth-card" action="/cadastro" method="post">
    <?= csrf_field() ?>
    <p class="eyebrow">Cadastro seguro</p>
    <h1>Criar conta</h1>
    <p>Use seus dados para compras, acompanhamento de pedidos e solicitacoes LGPD.</p>
    <label>Nome completo<input name="name" required autocomplete="name"></label>
    <label>CPF<input name="cpf" required inputmode="numeric" data-mask="cpf" placeholder="000.000.000-00"></label>
    <label>E-mail<input type="email" name="email" required autocomplete="email"></label>
    <label>Telefone<input name="phone" autocomplete="tel" data-mask="phone" placeholder="(00) 00000-0000"></label>
    <label>Senha<input type="password" name="password" required autocomplete="new-password"></label>
    <label class="check"><input type="checkbox" name="lgpd_accept" value="1" required> Aceito a politica de privacidade e os termos.</label>
    <label class="check"><input type="checkbox" name="marketing_opt_in" value="1"> Quero receber comunicacoes permitidas.</label>
    <button class="btn primary" type="submit">Cadastrar</button>
    <a href="/login">Ja tenho conta</a>
  </form>
</section>
