<section class="section-head">
  <div>
    <p class="eyebrow">Logistica</p>
    <h1>Entrega</h1>
    <p>Configure zonas, taxas, prazos e entregadores para delivery local.</p>
  </div>
</section>

<div class="admin-grid">
  <section class="panel">
    <h2>Zona de entrega</h2>
    <form class="form-grid" method="post" action="/admin/entrega/zonas">
      <?= csrf_field() ?>
      <input name="name" placeholder="Nome" required>
      <select name="zone_type"><option value="district">Bairro</option><option value="postal_code">CEP</option><option value="distance">Distancia</option><option value="city">Cidade</option></select>
      <input name="district" placeholder="Bairro">
      <input name="postal_code_start" placeholder="CEP inicial" data-mask="cep">
      <input name="postal_code_end" placeholder="CEP final" data-mask="cep">
      <input name="city" placeholder="Cidade">
      <input name="state" maxlength="2" placeholder="UF">
      <input name="max_distance_km" type="number" step="0.1" placeholder="Distancia km">
      <input name="fee" type="number" step="0.01" placeholder="Taxa" required>
      <input name="minimum_order_value" type="number" step="0.01" placeholder="Pedido minimo">
      <input name="free_shipping_minimum" type="number" step="0.01" placeholder="Frete gratis acima de">
      <input name="estimated_minutes" type="number" placeholder="Minutos">
      <button class="btn primary">Salvar zona</button>
    </form>
  </section>

  <section class="panel">
    <h2>Entregador</h2>
    <form class="form-grid" method="post" action="/admin/entrega/entregadores">
      <?= csrf_field() ?>
      <input name="name" placeholder="Nome" required>
      <input name="phone" placeholder="Telefone" data-mask="phone">
      <select name="vehicle_type"><option value="motorcycle">Moto</option><option value="car">Carro</option><option value="bicycle">Bicicleta</option><option value="third_party">Terceiro</option></select>
      <input name="vehicle_plate" placeholder="Placa">
      <button class="btn primary">Salvar entregador</button>
    </form>
  </section>
</div>

<section class="panel">
  <h2>Zonas cadastradas</h2>
  <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Taxa</th><th>Minimo</th><th>Prazo</th></tr></thead><tbody><?php foreach ($zones as $z): ?><tr><td><strong><?= e($z['name']) ?></strong></td><td><?= e(status_label($z['zone_type'])) ?></td><td><?= money($z['fee']) ?></td><td><?= money($z['minimum_order_value'] ?? 0) ?></td><td><?= e($z['estimated_minutes'] ?? '') ?> min</td></tr><?php endforeach; ?></tbody></table></div>
</section>
<section class="panel">
  <h2>Entregadores</h2>
  <div class="table-wrap"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Veiculo</th><th>Status</th></tr></thead><tbody><?php foreach ($people as $p): ?><tr><td><strong><?= e($p['name']) ?></strong></td><td><?= e($p['phone']) ?></td><td><?= e(status_label($p['vehicle_type'])) ?></td><td><?= status_pill($p['status']) ?></td></tr><?php endforeach; ?></tbody></table></div>
</section>
