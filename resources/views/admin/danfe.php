<?php if (!$invoice): ?>
  <section class="empty-state"><h1>Nota nao encontrada</h1></section>
<?php else: ?>
<?php $pharmacy = json_decode((string) $invoice['pharmacy_snapshot'], true) ?: []; $customer = json_decode((string) $invoice['customer_snapshot'], true) ?: []; ?>
<button class="btn no-print" onclick="window.print()">Imprimir</button>
<section class="panel">
  <h1>DANFE SIMULADA</h1>
  <p>Documento auxiliar sem valor fiscal. NF-e simulada, sem transmissao para SEFAZ.</p>
  <div class="metric-grid">
    <div class="metric"><span>Numero</span><strong><?= (int) $invoice['invoice_number'] ?></strong></div>
    <div class="metric"><span>Serie</span><strong><?= e($invoice['series']) ?></strong></div>
    <div class="metric"><span>Status</span><strong><?= e($invoice['status']) ?></strong></div>
  </div>
  <p><strong>Chave simulada:</strong> <?= e($invoice['access_key_simulated']) ?></p>
</section>
<section class="panel">
  <h2>Emitente</h2>
  <p><?= e($pharmacy['trade_name'] ?? $pharmacy['legal_name'] ?? '') ?> - CNPJ <?= e($pharmacy['cnpj'] ?? '') ?></p>
  <p><?= e(($pharmacy['address_street'] ?? '') . ', ' . ($pharmacy['address_number'] ?? '')) ?></p>
</section>
<section class="panel">
  <h2>Destinatario</h2>
  <p><?= e($customer['name'] ?? 'Cliente') ?> - CPF <?= e($customer['cpf'] ?? '') ?></p>
</section>
<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead><tbody><?php foreach ($items as $item): ?><tr><td><?= e($item['product_name']) ?></td><td><?= e($item['quantity']) ?></td><td><?= money($item['unit_price']) ?></td><td><?= money($item['line_total']) ?></td></tr><?php endforeach; ?></tbody></table></div>
<section class="panel">
  <div class="summary-line"><span>Produtos</span><strong><?= money($invoice['products_total']) ?></strong></div>
  <div class="summary-line"><span>Entrega</span><strong><?= money($invoice['delivery_fee']) ?></strong></div>
  <div class="summary-line"><span>Descontos</span><strong><?= money($invoice['discount_total']) ?></strong></div>
  <div class="summary-line total"><span>Total</span><strong><?= money($invoice['grand_total']) ?></strong></div>
</section>
<?php endif; ?>

