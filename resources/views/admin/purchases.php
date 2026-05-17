<section class="section-head">
  <div>
    <p class="eyebrow">Compras</p>
    <h1>Fornecedores e ordens de compra</h1>
    <p>Recebimentos movimentam o estoque da filial selecionada.</p>
  </div>
</section>

<div class="admin-grid">
  <section class="panel">
    <h2>Novo fornecedor</h2>
    <form class="form-grid" method="post" action="/admin/compras/fornecedores">
      <?= csrf_field() ?>
      <input name="razao_social" placeholder="Razao social" required>
      <input name="nome_fantasia" placeholder="Nome fantasia">
      <input name="cnpj" placeholder="CNPJ" required>
      <input name="telefone" placeholder="Telefone">
      <input name="email" type="email" placeholder="E-mail">
      <input name="endereco" placeholder="Endereco">
      <button class="btn primary">Salvar fornecedor</button>
    </form>
  </section>

  <section class="panel">
    <h2>Nova ordem</h2>
    <form class="form-grid" method="post" action="/admin/compras/ordens">
      <?= csrf_field() ?>
      <select name="id_fornecedor" required>
        <option value="">Fornecedor</option>
        <?php foreach ($suppliers as $supplier): ?>
          <option value="<?= (int) $supplier['id'] ?>"><?= e($supplier['nome_fantasia'] ?: $supplier['razao_social']) ?></option>
        <?php endforeach; ?>
      </select>
      <input name="previsao_entrega" type="date">
      <button class="btn primary">Criar ordem</button>
    </form>
  </section>
</div>

<section class="panel">
  <h2>Ordens de compra</h2>
  <div class="table-wrap"><table><thead><tr><th>Filial</th><th>Fornecedor</th><th>Status</th><th>Total</th><th>Previsao</th><th></th></tr></thead><tbody>
    <?php foreach ($orders as $order): ?>
      <tr>
        <td><?= e($order['filial_nome']) ?></td>
        <td><?= e($order['nome_fantasia'] ?: $order['razao_social']) ?></td>
        <td><?= status_pill($order['status']) ?></td>
        <td><?= money($order['valor_total']) ?></td>
        <td><?= e($order['previsao_entrega'] ?? '') ?></td>
        <td><form method="post" action="/admin/compras/ordens/<?= (int) $order['id'] ?>/receber"><?= csrf_field() ?><button class="btn small">Receber</button></form></td>
      </tr>
    <?php endforeach; ?>
    <?php if (empty($orders)): ?><tr><td colspan="6">Sem ordens de compra.</td></tr><?php endif; ?>
  </tbody></table></div>
</section>
