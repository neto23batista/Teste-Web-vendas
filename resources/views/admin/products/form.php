<?php
$p = $product ?? [];
$isEdit = !empty($p);
$checked = static function (string $key, bool $default = false) use ($p): string {
    $value = array_key_exists($key, $p) ? !empty($p[$key]) : $default;
    return $value ? 'checked' : '';
};
?>
<form class="product-admin-form" action="<?= $isEdit ? '/admin/produtos/' . (int) $p['id'] : '/admin/produtos' ?>" method="post" enctype="multipart/form-data">
  <?= csrf_field() ?>

  <section class="section-head">
    <div>
      <p class="eyebrow">Cadastro de produto</p>
      <h1><?= $isEdit ? 'Editar produto' : 'Novo produto' ?></h1>
      <p>Padronize informacoes comerciais, clinicas, estoque e exibicao para reduzir erros na loja.</p>
    </div>
    <a class="btn" href="/admin/produtos">Voltar</a>
  </section>

  <fieldset class="checkout-step">
    <legend>Identificacao</legend>
    <div class="form-grid">
      <label>Nome<input name="name" required value="<?= e($p['name'] ?? '') ?>"></label>
      <label>Slug<input name="slug" value="<?= e($p['slug'] ?? '') ?>" placeholder="gerado automaticamente se vazio"></label>
      <label>Codigo interno<input name="internal_code" required value="<?= e($p['internal_code'] ?? '') ?>"></label>
      <label>EAN<input name="ean" value="<?= e($p['ean'] ?? '') ?>"></label>
      <label>SKU<input name="sku" value="<?= e($p['sku'] ?? '') ?>"></label>
      <label>Categoria<select name="category_id"><option value="">Selecione</option><?php foreach ($categories as $cat): ?><option value="<?= (int) $cat['id'] ?>" <?= ((int) ($p['category_id'] ?? 0) === (int) $cat['id']) ? 'selected' : '' ?>><?= e($cat['name']) ?></option><?php endforeach; ?></select></label>
      <label>Laboratorio / marca<select name="brand_id"><option value="">Selecione</option><?php foreach ($brands as $brand): ?><option value="<?= (int) $brand['id'] ?>" <?= ((int) ($p['brand_id'] ?? 0) === (int) $brand['id']) ? 'selected' : '' ?>><?= e($brand['name']) ?></option><?php endforeach; ?></select></label>
      <label>Imagem principal<input type="file" name="main_image" accept=".jpg,.jpeg,.png,.webp"><span class="field-help">JPG, PNG ou WebP ate 4MB.</span></label>
    </div>
  </fieldset>

  <fieldset class="checkout-step">
    <legend>Preco e estoque</legend>
    <div class="form-grid">
      <label>Preco venda<input name="sale_price" type="number" step="0.01" min="0" required value="<?= e($p['sale_price'] ?? '0.00') ?>"></label>
      <label>Preco promocional<input name="promotional_price" type="number" step="0.01" min="0" value="<?= e($p['promotional_price'] ?? '') ?>"></label>
      <label>Custo<input name="cost_price" type="number" step="0.01" min="0" value="<?= e($p['cost_price'] ?? '') ?>"></label>
      <label>Estoque atual<input name="current_stock" type="number" min="0" value="<?= e($p['current_stock'] ?? 0) ?>"></label>
      <label>Estoque minimo<input name="minimum_stock" type="number" min="0" value="<?= e($p['minimum_stock'] ?? 0) ?>"></label>
      <label>Estoque maximo<input name="maximum_stock" type="number" min="0" value="<?= e($p['maximum_stock'] ?? '') ?>"></label>
      <label>Localizacao<input name="physical_location" value="<?= e($p['physical_location'] ?? '') ?>" placeholder="Ex.: Loja matriz"></label>
      <label>Corredor<input name="aisle" value="<?= e($p['aisle'] ?? '') ?>"></label>
      <label>Prateleira<input name="shelf" value="<?= e($p['shelf'] ?? '') ?>"></label>
      <label>Gaveta<input name="drawer" value="<?= e($p['drawer'] ?? '') ?>"></label>
      <label>Setor<input name="sector" value="<?= e($p['sector'] ?? '') ?>"></label>
    </div>
  </fieldset>

  <fieldset class="checkout-step">
    <legend>Informacoes farmaceuticas</legend>
    <div class="form-grid">
      <label>Principio ativo<input name="active_ingredient" value="<?= e($p['active_ingredient'] ?? '') ?>"></label>
      <label>Apresentacao<input name="presentation" value="<?= e($p['presentation'] ?? '') ?>" placeholder="Ex.: 500mg com 20 comprimidos"></label>
      <label>Registro Anvisa<input name="anvisa_registration" value="<?= e($p['anvisa_registration'] ?? '') ?>"></label>
      <label>Detentor registro<input name="registration_holder" value="<?= e($p['registration_holder'] ?? '') ?>"></label>
      <label>Tipo receita<select name="prescription_type">
        <?php foreach (['none','simple','antibiotic','controlled','psychotropic'] as $type): ?><option value="<?= e($type) ?>" <?= (($p['prescription_type'] ?? 'none') === $type) ? 'selected' : '' ?>><?= e(status_label($type)) ?></option><?php endforeach; ?>
      </select></label>
      <label>Temp. min<input name="temperature_min_c" type="number" step="0.1" value="<?= e($p['temperature_min_c'] ?? '') ?>"></label>
      <label>Temp. max<input name="temperature_max_c" type="number" step="0.1" value="<?= e($p['temperature_max_c'] ?? '') ?>"></label>
    </div>
  </fieldset>

  <fieldset class="checkout-step">
    <legend>Descricao e visibilidade</legend>
    <label>Descricao curta<textarea name="short_description"><?= e($p['short_description'] ?? '') ?></textarea></label>
    <label>Descricao completa<textarea name="full_description"><?= e($p['full_description'] ?? '') ?></textarea></label>
    <div class="checks">
      <label class="check"><input type="checkbox" name="is_generic" value="1" <?= $checked('is_generic') ?>> Generico</label>
      <label class="check"><input type="checkbox" name="is_thermosensitive" value="1" <?= $checked('is_thermosensitive') ?>> Termossensivel</label>
      <label class="check"><input type="checkbox" name="allows_delivery" value="1" <?= $checked('allows_delivery', true) ?>> Delivery</label>
      <label class="check"><input type="checkbox" name="allows_pickup" value="1" <?= $checked('allows_pickup', true) ?>> Retirada</label>
      <label class="check"><input type="checkbox" name="is_featured" value="1" <?= $checked('is_featured') ?>> Destaque</label>
      <label class="check"><input type="checkbox" name="is_active" value="1" <?= $checked('is_active', true) ?>> Ativo</label>
    </div>
  </fieldset>

  <div class="actions">
    <button class="btn primary" type="submit">Salvar produto</button>
    <a class="btn" href="/admin/produtos">Cancelar</a>
  </div>
</form>
