<?php
$items = $summary['items'] ?? [];
$hasPrescription = array_sum(array_map(static fn (array $item): int => (int) ($item['requires_prescription'] ?? 0), $items)) > 0;
?>
<section class="section-head">
  <div>
    <p class="eyebrow">Checkout seguro</p>
    <h1>Finalizar pedido</h1>
    <p>Preencha os dados para entrega ou retirada. Itens com receita serao validados antes da liberacao.</p>
  </div>
</section>

<?php if (empty($items)): ?>
  <section class="empty-state">
    <h2>Sacola vazia</h2>
    <p>Adicione produtos antes de iniciar o checkout.</p>
    <a class="btn primary" href="/catalogo">Ver catalogo</a>
  </section>
<?php else: ?>
<div class="checkout-layout">
  <form action="/checkout" method="post" enctype="multipart/form-data" class="checkout-flow">
    <?= csrf_field() ?>

    <fieldset class="checkout-step">
      <div class="checkout-step-header">
        <span class="step-number">1</span>
        <div>
          <legend>Dados do cliente</legend>
          <p class="helper">Use os mesmos dados do titular do pedido para evitar atraso na validacao.</p>
        </div>
      </div>
      <div class="form-grid">
        <label>Nome completo<input name="name" required autocomplete="name" value="<?= e(user()['name'] ?? '') ?>"></label>
        <label>CPF<input name="cpf" required inputmode="numeric" autocomplete="off" data-mask="cpf" placeholder="000.000.000-00"></label>
        <label>E-mail<input name="email" type="email" required autocomplete="email" value="<?= e(user()['email'] ?? '') ?>"></label>
        <label>Telefone<input name="phone" autocomplete="tel" data-mask="phone" placeholder="(00) 00000-0000"></label>
      </div>
    </fieldset>

    <fieldset class="checkout-step">
      <div class="checkout-step-header">
        <span class="step-number">2</span>
        <div>
          <legend>Endereco</legend>
          <p class="helper">Informe o endereco para calcular entrega local. Para retirada, o endereco ajuda na identificacao do cliente.</p>
        </div>
      </div>
      <div class="form-grid">
        <label>CEP<input name="postal_code" required data-mask="cep" inputmode="numeric" placeholder="00000-000"></label>
        <label>Rua<input name="street" required autocomplete="address-line1"></label>
        <label>Numero<input name="number" required autocomplete="address-line2"></label>
        <label>Bairro<input name="district" required></label>
        <label>Cidade<input name="city" required autocomplete="address-level2"></label>
        <label>Estado<input name="state" maxlength="2" required autocomplete="address-level1" placeholder="UF"></label>
        <label>Complemento<input name="complement"></label>
      </div>
    </fieldset>

    <fieldset class="checkout-step">
      <div class="checkout-step-header">
        <span class="step-number">3</span>
        <div>
          <legend>Entrega e pagamento</legend>
          <p class="helper">O total final pode incluir frete e descontos de cupom.</p>
        </div>
      </div>
      <div class="form-grid">
        <label>Modalidade
          <select name="delivery_method">
            <option value="pickup">Retirada na loja</option>
            <option value="local_delivery">Delivery local</option>
            <option value="motoboy">Motoboy</option>
          </select>
        </label>
        <label>Pagamento
          <select name="payment_method">
            <option value="pix">Pix</option>
            <option value="credit_card">Cartao</option>
          </select>
        </label>
        <label>Cupom<input name="coupon_code" autocomplete="off" placeholder="Ex.: SAUDE10"></label>
        <?php if (!empty($loyalty['available_points'])): ?>
          <label>Pontos de fidelidade
            <input name="loyalty_points" type="number" min="0" step="<?= (int) ($loyalty['points_per_real'] ?? 10) ?>" max="<?= (int) ($loyalty['max_points'] ?? 0) ?>" placeholder="Max. <?= (int) ($loyalty['max_points'] ?? 0) ?>">
            <span class="field-help"><?= (int) $loyalty['available_points'] ?> ponto(s) disponiveis. <?= (int) ($loyalty['points_per_real'] ?? 10) ?> pontos = R$ 1,00.</span>
          </label>
        <?php elseif (!user()): ?>
          <p class="helper">Entre na conta para resgatar pontos de fidelidade no checkout.</p>
        <?php endif; ?>
      </div>
      <?php if ($hasPrescription): ?>
        <div class="alert warning">Sua sacola contem medicamento com receita. Envie PDF, JPG ou PNG para concluir o pedido.</div>
      <?php endif; ?>
      <label>Receita, se necessario<input type="file" name="prescription" accept=".pdf,.jpg,.jpeg,.png" <?= $hasPrescription ? 'required' : '' ?>><span class="field-help">Arquivo usado apenas para validacao farmaceutica.</span></label>
      <label>Observacoes<textarea name="customer_note" placeholder="Informe preferencias de entrega, retirada ou orientacao."></textarea></label>
      <label class="check"><input type="checkbox" name="lgpd_accept" value="1" required> Li e aceito a politica de privacidade e o tratamento de dados para processar este pedido.</label>
      <button class="btn primary" type="submit">Finalizar pedido</button>
    </fieldset>
  </form>

  <aside class="summary-card">
    <h2>Resumo</h2>
    <?php foreach ($items as $item): ?>
      <div class="summary-line"><span><?= e($item['name']) ?> x<?= (int) $item['quantity'] ?></span><strong><?= money($item['line_total']) ?></strong></div>
    <?php endforeach; ?>
    <div class="summary-line"><span>Produtos</span><strong><?= money($summary['cart']['subtotal'] ?? 0) ?></strong></div>
    <?php if (!empty($loyalty['max_discount'])): ?>
      <div class="summary-line"><span>Desconto max. por pontos</span><strong><?= money($loyalty['max_discount']) ?></strong></div>
    <?php endif; ?>
    <div class="summary-line total"><span>Total inicial</span><strong><?= money($summary['cart']['grand_total'] ?? 0) ?></strong></div>
    <ul class="secure-list">
      <li>Ambiente com CSRF e sessao protegida.</li>
      <li>Pagamento processado por provedor integrado.</li>
      <li>Voce acompanha o pedido apos finalizar.</li>
    </ul>
  </aside>
</div>
<?php endif; ?>
