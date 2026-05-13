<section class="hero">
  <div class="hero-content">
    <p class="eyebrow">Farmacia online segura</p>
    <h1>FarmaVida</h1>
    <p>Medicamentos, perfumaria e cuidado diario com compra protegida, orientacao farmaceutica, entrega local e retirada na loja.</p>
    <div class="actions">
      <a class="btn primary" href="/catalogo">Comprar agora</a>
      <a class="btn" href="/faq-clinico">Enviar receita</a>
    </div>
    <div class="hero-badges" aria-label="Diferenciais FarmaVida">
      <span><strong>Receita protegida</strong><small>Upload restrito e validacao farmaceutica.</small></span>
      <span><strong>Estoque conferido</strong><small>Disponibilidade recalculada no carrinho.</small></span>
      <span><strong>Pagamento seguro</strong><small>Pix e cartao com provedor integrado.</small></span>
    </div>
  </div>
</section>

<section class="section-head">
  <div>
    <p class="eyebrow">Compra rapida</p>
    <h2>Produtos em destaque</h2>
  </div>
  <a class="btn" href="/catalogo">Ver catalogo</a>
</section>
<div class="product-grid">
  <?php foreach ($products as $product): ?>
    <?= partial('store/product_card', ['product' => $product]) ?>
  <?php endforeach; ?>
</div>

<section class="info-band">
  <div><strong>Atendimento farmaceutico</strong><span>Produtos com receita entram em fila de validacao antes da liberacao.</span></div>
  <div><strong>Privacidade LGPD</strong><span>Dados pessoais e documentos sao tratados apenas para processar o pedido.</span></div>
  <div><strong>Entrega organizada</strong><span>Retirada, delivery local e acompanhamento de status em tempo real.</span></div>
  <div><strong>Operacao auditavel</strong><span>Pedidos, estoque, receitas e pagamentos ficam rastreados no painel.</span></div>
</section>

<section class="benefit-grid" aria-label="Areas de cuidado">
  <article class="benefit-card">
    <p class="eyebrow">Medicamentos</p>
    <h3>Compra com orientacao e avisos clinicos</h3>
    <p>Produtos controlados ou com restricao deixam claro quando exigem receita, validacao ou contato com o farmaceutico.</p>
  </article>
  <article class="benefit-card">
    <p class="eyebrow">Bem-estar</p>
    <h3>Catalogo facil para rotina da familia</h3>
    <p>Busca por nome, principio ativo, marca ou EAN ajuda clientes com pouca familiaridade digital a encontrar o item certo.</p>
  </article>
  <article class="benefit-card">
    <p class="eyebrow">Gestao</p>
    <h3>Painel pronto para operacao diaria</h3>
    <p>O administrativo centraliza pedidos, produtos, estoque, receitas, pagamentos, marketing, entregas e auditoria.</p>
  </article>
</section>
