<section class="section-head">
  <div>
    <p class="eyebrow">Crescimento</p>
    <h1>Marketing</h1>
    <p>Gerencie cupons, promocoes e banners sem prejudicar regras de privacidade de dados sensiveis.</p>
  </div>
</section>

<div class="admin-grid">
  <section class="panel">
    <h2>Novo cupom</h2>
    <form class="form-grid" method="post" action="/admin/marketing/cupons">
      <?= csrf_field() ?>
      <input name="code" placeholder="CODIGO" required>
      <input name="name" placeholder="Nome" required>
      <select name="discount_type"><option value="percent">Percentual</option><option value="fixed">Valor fixo</option><option value="free_shipping">Frete gratis</option></select>
      <input name="discount_value" type="number" step="0.01" placeholder="Valor">
      <input name="minimum_order_value" type="number" step="0.01" placeholder="Minimo">
      <input name="max_discount_value" type="number" step="0.01" placeholder="Desconto maximo">
      <input name="usage_limit" type="number" placeholder="Limite total">
      <input name="usage_limit_per_customer" type="number" placeholder="Limite por cliente">
      <select name="applies_to"><option value="all">Todos</option><option value="category">Categoria</option><option value="product">Produto</option><option value="delivery">Entrega</option></select>
      <input name="starts_at" type="datetime-local">
      <input name="ends_at" type="datetime-local">
      <input name="description" placeholder="Descricao">
      <button class="btn primary">Salvar cupom</button>
    </form>
  </section>

  <section class="panel">
    <h2>Nova promocao</h2>
    <form class="form-grid" method="post" action="/admin/marketing/promocoes">
      <?= csrf_field() ?>
      <input name="name" placeholder="Nome" required>
      <select name="promotion_type"><option value="flash">Relampago</option><option value="category">Categoria</option><option value="product">Produto</option><option value="free_shipping">Frete gratis</option><option value="kit">Kit</option></select>
      <select name="discount_type"><option value="percent">Percentual</option><option value="fixed">Valor fixo</option><option value="none">Sem desconto</option></select>
      <input name="discount_value" type="number" step="0.01" placeholder="Valor">
      <input name="starts_at" type="datetime-local" required>
      <input name="ends_at" type="datetime-local" required>
      <input name="description" placeholder="Descricao">
      <label class="check"><input type="checkbox" name="is_featured" value="1"> Destaque</label>
      <button class="btn primary">Salvar promocao</button>
    </form>
  </section>

  <section class="panel">
    <h2>Novo banner</h2>
    <form class="form-grid" method="post" action="/admin/marketing/banners">
      <?= csrf_field() ?>
      <input name="title" placeholder="Titulo" required>
      <input name="subtitle" placeholder="Subtitulo">
      <input name="image_path" placeholder="/assets/img/farmavida-hero.png" value="/assets/img/farmavida-hero.png">
      <input name="target_url" placeholder="/catalogo" value="/catalogo">
      <select name="position"><option value="home_hero">Home hero</option><option value="home_middle">Home meio</option><option value="category">Categoria</option><option value="checkout">Checkout</option></select>
      <input name="display_order" type="number" value="0">
      <button class="btn primary">Salvar banner</button>
    </form>
  </section>
</div>

<section class="panel">
  <h2>Cupons</h2>
  <div class="table-wrap"><table><thead><tr><th>Codigo</th><th>Nome</th><th>Tipo</th><th>Status</th></tr></thead><tbody><?php foreach ($coupons as $c): ?><tr><td><strong><?= e($c['code']) ?></strong></td><td><?= e($c['name']) ?></td><td><?= e(status_label($c['discount_type'])) ?></td><td><?= status_pill($c['status']) ?></td></tr><?php endforeach; ?></tbody></table></div>
</section>
<section class="panel">
  <h2>Promocoes</h2>
  <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Status</th><th>Periodo</th></tr></thead><tbody><?php foreach ($promotions as $p): ?><tr><td><strong><?= e($p['name']) ?></strong></td><td><?= e(status_label($p['promotion_type'])) ?></td><td><?= status_pill($p['status']) ?></td><td><?= e($p['starts_at']) ?> ate <?= e($p['ends_at']) ?></td></tr><?php endforeach; ?></tbody></table></div>
</section>
<section class="panel">
  <h2>Banners</h2>
  <div class="table-wrap"><table><thead><tr><th>Titulo</th><th>Posicao</th><th>URL</th><th>Ativo</th></tr></thead><tbody><?php foreach ($banners as $b): ?><tr><td><strong><?= e($b['title']) ?></strong></td><td><?= e(status_label($b['position'])) ?></td><td><?= e($b['target_url']) ?></td><td><?= !empty($b['is_active']) ? '<span class="tag success">Sim</span>' : '<span class="tag danger">Nao</span>' ?></td></tr><?php endforeach; ?></tbody></table></div>
</section>
