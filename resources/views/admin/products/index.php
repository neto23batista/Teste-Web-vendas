<section class="section-head">
  <div>
    <p class="eyebrow">Catalogo</p>
    <h1>Produtos</h1>
    <p>Gerencie precos, estoque, receita, laboratorio e disponibilidade para venda.</p>
  </div>
  <a class="btn primary" href="/admin/produtos/novo">Novo produto</a>
</section>

<form class="filters inline-filters" method="get">
  <label>Buscar produto<input name="q" value="<?= e($filters['q'] ?? '') ?>" placeholder="Nome, principio ativo, EAN ou laboratorio"></label>
  <label>Status de estoque
    <select name="stock">
      <option value="">Todos</option>
      <option value="available" <?= (($filters['stock'] ?? '') === 'available') ? 'selected' : '' ?>>Disponivel</option>
      <option value="low" <?= (($filters['stock'] ?? '') === 'low') ? 'selected' : '' ?>>Baixo</option>
      <option value="zero" <?= (($filters['stock'] ?? '') === 'zero') ? 'selected' : '' ?>>Zerado</option>
    </select>
  </label>
  <label>Receita
    <select name="requires_prescription">
      <option value="">Todos</option>
      <option value="0" <?= ((string) ($filters['requires_prescription'] ?? '') === '0') ? 'selected' : '' ?>>Sem receita</option>
      <option value="1" <?= ((string) ($filters['requires_prescription'] ?? '') === '1') ? 'selected' : '' ?>>Com receita</option>
    </select>
  </label>
  <button class="btn" type="submit">Buscar</button>
</form>

<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Estoque</th><th>Preco</th><th>Receita</th><th>Status</th><th></th></tr></thead><tbody>
<?php foreach ($products as $product): ?>
<tr>
  <td><strong><?= e($product['name']) ?></strong><br><span class="helper"><?= e($product['brand_name'] ?? '') ?></span></td>
  <td><?= (int) $product['current_stock'] <= 0 ? '<span class="tag danger">Zerado</span>' : ((int) $product['current_stock'] <= (int) ($product['minimum_stock'] ?? 0) ? '<span class="tag warn">Baixo: ' . (int) $product['current_stock'] . '</span>' : '<span class="tag success">' . (int) $product['current_stock'] . ' un.</span>') ?></td>
  <td><strong><?= money($product['promotional_price'] ?: $product['sale_price']) ?></strong></td>
  <td><?= (int) $product['requires_prescription'] ? '<span class="tag warn">' . e(status_label($product['prescription_type'])) . '</span>' : '<span class="tag success">Nao exige</span>' ?></td>
  <td><?= !empty($product['is_active']) ? '<span class="tag success">Ativo</span>' : '<span class="tag danger">Inativo</span>' ?></td>
  <td class="table-actions"><a class="btn small" href="/admin/produtos/<?= (int) $product['id'] ?>/editar">Editar</a></td>
</tr>
<?php endforeach; ?>
</tbody></table></div>
