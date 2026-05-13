<section class="section-head">
  <div>
    <p class="eyebrow">Catalogo FarmaVida</p>
    <h1>Medicamentos e produtos</h1>
    <p>Busque por nome, principio ativo, laboratorio ou EAN. Produtos com receita exibem aviso antes da compra.</p>
  </div>
</section>

<div class="catalog-shell">
  <details class="filter-drawer" open data-mobile-collapsible>
    <summary>Filtros do catalogo</summary>
    <form class="filters" method="get" aria-label="Filtros do catalogo">
      <strong class="filter-title">Filtros</strong>
      <label>Busca
        <input name="q" value="<?= e($filters['q'] ?? '') ?>" placeholder="Ex.: dipirona, vitamina C, EAN">
      </label>
      <label>Categoria
        <select name="category">
          <option value="">Todas categorias</option>
          <?php foreach ($categories as $category): ?>
            <option value="<?= e($category['slug']) ?>" <?= (($filters['category'] ?? '') === $category['slug']) ? 'selected' : '' ?>><?= e($category['name']) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <label>Laboratorio / marca
        <select name="brand">
          <option value="">Todos laboratorios</option>
          <?php foreach ($brands as $brand): ?>
            <option value="<?= (int) $brand['id'] ?>" <?= ((string) ($filters['brand'] ?? '') === (string) $brand['id']) ? 'selected' : '' ?>><?= e($brand['name']) ?></option>
          <?php endforeach; ?>
        </select>
      </label>
      <div class="field-row">
        <label>Preco min.
          <input name="price_min" type="number" min="0" step="0.01" value="<?= e($filters['price_min'] ?? '') ?>" placeholder="0,00">
        </label>
        <label>Preco max.
          <input name="price_max" type="number" min="0" step="0.01" value="<?= e($filters['price_max'] ?? '') ?>" placeholder="150,00">
        </label>
      </div>
      <label>Receita
        <select name="requires_prescription">
          <option value="" <?= (($filters['requires_prescription'] ?? '') === '') ? 'selected' : '' ?>>Todos</option>
          <option value="0" <?= ((string) ($filters['requires_prescription'] ?? '') === '0') ? 'selected' : '' ?>>Sem receita</option>
          <option value="1" <?= ((string) ($filters['requires_prescription'] ?? '') === '1') ? 'selected' : '' ?>>Com receita</option>
        </select>
      </label>
      <label>Generico
        <select name="generic">
          <option value="" <?= (($filters['generic'] ?? '') === '') ? 'selected' : '' ?>>Todos</option>
          <option value="1" <?= ((string) ($filters['generic'] ?? '') === '1') ? 'selected' : '' ?>>Apenas genericos</option>
          <option value="0" <?= ((string) ($filters['generic'] ?? '') === '0') ? 'selected' : '' ?>>Nao genericos</option>
        </select>
      </label>
      <label>Disponibilidade
        <select name="stock">
          <option value="" <?= (($filters['stock'] ?? '') === '') ? 'selected' : '' ?>>Todos</option>
          <option value="available" <?= (($filters['stock'] ?? '') === 'available') ? 'selected' : '' ?>>Disponivel</option>
          <option value="low" <?= (($filters['stock'] ?? '') === 'low') ? 'selected' : '' ?>>Baixo estoque</option>
          <option value="zero" <?= (($filters['stock'] ?? '') === 'zero') ? 'selected' : '' ?>>Sem estoque</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" name="promotion" value="1" <?= !empty($filters['promotion']) ? 'checked' : '' ?>> Somente promocoes</label>
      <div class="actions">
        <button class="btn primary" type="submit">Aplicar filtros</button>
        <a class="btn" href="/catalogo">Limpar</a>
      </div>
    </form>
  </details>

  <section>
    <div class="section-head">
      <div>
        <h2>Resultados</h2>
        <p><?= count($products) ?> produto<?= count($products) === 1 ? '' : 's' ?> encontrado<?= count($products) === 1 ? '' : 's' ?> nesta pagina.</p>
      </div>
      <span class="tag blue">Compra segura</span>
    </div>
    <?php if (empty($products)): ?>
      <section class="empty-state">
        <h2>Nenhum produto encontrado</h2>
        <p>Ajuste os filtros ou busque pelo principio ativo. Para itens com receita, fale com a farmacia.</p>
        <a class="btn primary" href="/catalogo">Ver todos os produtos</a>
      </section>
    <?php else: ?>
      <div class="product-grid">
        <?php foreach ($products as $product): ?>
          <?= partial('store/product_card', ['product' => $product]) ?>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>
</div>
