<?php
$priceValue = $product['promotional_price'] ?: $product['sale_price'];
$hasPromo = !empty($product['promotional_price']) && (float) $product['promotional_price'] < (float) $product['sale_price'];
$requiresPrescription = (int) ($product['requires_prescription'] ?? 0) === 1;
$isGeneric = (int) ($product['is_generic'] ?? 0) === 1;
$stock = (int) ($product['current_stock'] ?? 0);
$policy = (string) ($product['remote_sale_policy'] ?? 'allowed');
$canBuy = $stock > 0 && !in_array($policy, ['blocked', 'pickup_only'], true);
$description = trim((string) ($product['short_description'] ?? ''));
?>
<article class="product-card">
  <a class="product-card-link" href="/produto/<?= e($product['slug']) ?>">
    <div class="product-image">
      <?= !empty($product['main_image_path']) ? '<img src="' . e($product['main_image_path']) . '" alt="' . e($product['name']) . '">' : '<span>FV</span>' ?>
    </div>
    <div>
      <div class="product-card-meta">
        <?php if (!empty($product['category_name'])): ?><span class="tag neutral"><?= e($product['category_name']) ?></span><?php endif; ?>
        <?php if ($isGeneric): ?><span class="tag success">Generico</span><?php endif; ?>
        <?php if ($hasPromo): ?><span class="tag blue">Promocao</span><?php endif; ?>
      </div>
      <h3><?= e($product['name']) ?></h3>
    </div>
  </a>

  <?php if ($description): ?>
    <p><?= e(mb_strimwidth($description, 0, 96, '...')) ?></p>
  <?php else: ?>
    <p><?= e($product['brand_name'] ?? 'Produto FarmaVida') ?></p>
  <?php endif; ?>

  <div class="tag-row">
    <?php if ($requiresPrescription): ?><span class="tag warn">Exige receita</span><?php endif; ?>
    <?php if ($stock <= 0): ?><span class="tag danger">Indisponivel</span><?php elseif ($stock <= (int) ($product['minimum_stock'] ?? 0)): ?><span class="tag warn">Ultimas unidades</span><?php else: ?><span class="tag success">Disponivel</span><?php endif; ?>
  </div>

  <strong class="price"><?= money($priceValue) ?><?php if ($hasPromo): ?><small>oferta</small><?php endif; ?></strong>

  <div class="product-actions">
    <button
      class="btn"
      type="button"
      data-quick-view
      data-product-id="<?= (int) $product['id'] ?>"
      data-name="<?= e($product['name']) ?>"
      data-category="<?= e(trim(($product['brand_name'] ?? '') . ' ' . ($product['category_name'] ?? ''))) ?>"
      data-description="<?= e($description) ?>"
      data-price="<?= e(money($priceValue)) ?>"
      data-image="<?= e($product['main_image_path'] ?? '') ?>"
      data-url="/produto/<?= e($product['slug']) ?>"
      data-prescription="<?= $requiresPrescription ? '1' : '0' ?>"
      data-can-buy="<?= $canBuy ? '1' : '0' ?>"
    >Detalhes</button>
    <?php if ($canBuy): ?>
      <button class="btn primary add-cart" type="button" data-product-id="<?= (int) $product['id'] ?>">Adicionar</button>
    <?php elseif ($stock <= 0): ?>
      <button class="btn" type="button" disabled>Sem estoque</button>
    <?php else: ?>
      <a class="btn" href="/faq-clinico">Orientacao</a>
    <?php endif; ?>
  </div>
</article>
