<?php
$priceValue = $product['promotional_price'] ?: $product['sale_price'];
$hasPromo = !empty($product['promotional_price']) && (float) $product['promotional_price'] < (float) $product['sale_price'];
$requiresPrescription = (int) $product['requires_prescription'] === 1;
$stock = (int) $product['current_stock'];
$policy = (string) ($product['remote_sale_policy'] ?? 'allowed');
$canBuy = $stock > 0 && !in_array($policy, ['blocked', 'pickup_only'], true);
?>
<article class="product-detail">
  <div class="product-photo">
    <?= !empty($product['main_image_path']) ? '<img src="' . e($product['main_image_path']) . '" alt="' . e($product['name']) . '">' : '<span>FarmaVida</span>' ?>
  </div>
  <div class="product-detail-info">
    <div>
      <p class="eyebrow"><?= e(trim(($product['brand_name'] ?? '') . ' ' . ($product['category_name'] ?? ''))) ?></p>
      <h1><?= e($product['name']) ?></h1>
      <p><?= e($product['short_description'] ?? '') ?></p>
      <div class="tag-row">
        <?php if ((int) ($product['is_generic'] ?? 0) === 1): ?><span class="tag success">Generico</span><?php endif; ?>
        <?php if ($hasPromo): ?><span class="tag blue">Promocao ativa</span><?php endif; ?>
        <?php if ($requiresPrescription): ?><span class="tag warn">Exige receita</span><?php endif; ?>
        <?= $stock > 0 ? '<span class="tag success">Disponivel</span>' : '<span class="tag danger">Sem estoque</span>' ?>
      </div>
    </div>

    <?php if ($requiresPrescription): ?>
      <div class="alert warning">Este produto exige receita. O arquivo deve ser enviado no checkout e passara por validacao farmaceutica antes da liberacao.</div>
    <?php endif; ?>
    <?php if ((int) ($product['is_generic'] ?? 0) !== 1 && !empty($product['active_ingredient'])): ?>
      <div class="alert">Sugestao de generico: procure no catalogo pelo principio ativo <?= e($product['active_ingredient']) ?> ou consulte as recomendacoes abaixo.</div>
    <?php endif; ?>
    <?php if ($policy === 'blocked'): ?>
      <div class="alert warning">Medicamento controlado: compra automatica bloqueada. Fale com o farmaceutico para orientacao e retirada conforme regras aplicaveis.</div>
    <?php endif; ?>

    <dl class="meta">
      <dt>Principio ativo</dt><dd><?= e($product['active_ingredient'] ?? 'Nao informado') ?></dd>
      <dt>Apresentacao</dt><dd><?= e($product['presentation'] ?? 'Nao informado') ?></dd>
      <dt>Registro Anvisa</dt><dd><?= e($product['anvisa_registration'] ?? 'Nao informado') ?></dd>
      <dt>Estoque</dt><dd><?= $stock > 0 ? e((string) $stock) . ' unidade(s)' : 'Indisponivel' ?></dd>
      <dt>Receita</dt><dd><?= $requiresPrescription ? e(status_label($product['prescription_type'])) : 'Nao exige' ?></dd>
      <dt>Entrega</dt><dd><?= !empty($product['allows_delivery']) ? 'Delivery local disponivel' : 'Retirada na loja' ?></dd>
    </dl>

    <section class="purchase-panel panel">
      <div>
        <p class="eyebrow">Resumo da compra</p>
        <strong class="price"><?= money($priceValue) ?><?php if ($hasPromo): ?><small>preco promocional</small><?php endif; ?></strong>
      </div>
      <ul class="secure-list">
        <li>Pagamento por Pix ou cartao com provedor seguro.</li>
        <li>Dados pessoais tratados conforme politica de privacidade.</li>
        <li>Pedido acompanha status desde pagamento ate entrega ou retirada.</li>
      </ul>
      <div class="actions">
        <?php if ($canBuy): ?>
          <button class="btn primary add-cart" type="button" data-product-id="<?= (int) $product['id'] ?>">Adicionar a sacola</button>
        <?php elseif ($stock <= 0): ?>
          <button class="btn" type="button" disabled>Produto indisponivel</button>
        <?php else: ?>
          <a class="btn primary" href="/faq-clinico">Falar sobre receita</a>
        <?php endif; ?>
        <a class="btn" href="/catalogo">Continuar comprando</a>
      </div>
    </section>
  </div>
</article>

<?php if (!empty($product['recommendations'])): ?>
<section class="section-head">
  <div>
    <p class="eyebrow">Relacionados</p>
    <h2>Recomendacoes e possiveis alternativas</h2>
  </div>
</section>
<div class="product-grid">
  <?php foreach ($product['recommendations'] as $related): ?>
    <?= partial('store/product_card', ['product' => $related]) ?>
  <?php endforeach; ?>
</div>
<?php endif; ?>
