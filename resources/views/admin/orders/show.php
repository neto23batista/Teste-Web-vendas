<?php
$decodeJson = static function (mixed $value): array {
    if (is_array($value)) {
        return $value;
    }
    $decoded = json_decode((string) ($value ?? ''), true);
    return is_array($decoded) ? $decoded : [];
};
$formatDate = static function (mixed $value): string {
    if (!$value) {
        return 'Nao informado';
    }
    $time = strtotime((string) $value);
    return $time ? date('d/m/Y H:i', $time) : (string) $value;
};
?>

<?php if (!$order): ?>
  <section class="empty-state">
    <h1>Pedido nao encontrado</h1>
    <a class="btn primary" href="/admin/pedidos">Voltar aos pedidos</a>
  </section>
<?php else: ?>
<?php
$customerSnapshot = $decodeJson($order['customer_snapshot'] ?? null);
$address = $decodeJson($order['delivery_address_snapshot'] ?? null);
$customerName = $order['customer_name'] ?: ($customerSnapshot['name'] ?? 'Cliente avulso');
$customerEmail = $order['customer_email'] ?: ($customerSnapshot['email'] ?? '');
$internalNotes = array_values(array_filter($notes ?? [], static fn (array $note): bool => ($note['visibility'] ?? '') === 'internal'));
$customerNotes = array_values(array_filter($notes ?? [], static fn (array $note): bool => ($note['visibility'] ?? '') === 'customer'));
$warnings = [];
foreach ($statusControls as $group) {
    foreach ($group as $option) {
        if (!empty($option['warning'])) {
            $warnings[$option['warning']] = true;
        }
    }
}
?>

<section class="section-head order-detail-head">
  <div>
    <p class="eyebrow">Pedido</p>
    <h1><?= e($order['order_number']) ?></h1>
    <p><?= e($customerName) ?> - criado em <?= e($formatDate($order['created_at'] ?? null)) ?></p>
  </div>
  <div class="actions">
    <?= status_pill($order['status']) ?>
    <?php if (($order['priority'] ?? 'normal') !== 'normal'): ?>
      <?= status_pill($order['priority']) ?>
    <?php endif; ?>
    <?php if (!empty($order['has_problem'])): ?>
      <span class="tag danger">Problema</span>
    <?php endif; ?>
    <a class="btn" href="/admin/pedidos">Voltar</a>
  </div>
</section>

<div class="metric-grid ops-metrics">
  <div class="metric"><span>Total</span><strong><?= money($order['grand_total']) ?></strong></div>
  <div class="metric <?= status_class($order['payment_status']) ?>"><span>Pagamento</span><strong><?= e(status_label($order['payment_status'])) ?></strong></div>
  <div class="metric <?= status_class($order['clinical_status']) ?>"><span>Clinico</span><strong><?= e(status_label($order['clinical_status'])) ?></strong></div>
  <div class="metric"><span>Entrega</span><strong><?= e(status_label($order['delivery_method'] ?? '')) ?></strong></div>
  <div class="metric"><span>Prioridade</span><strong><?= e(status_label($order['priority'] ?? 'normal')) ?></strong></div>
  <div class="metric <?= !empty($order['has_problem']) ? 'danger' : 'success' ?>"><span>Problema</span><strong><?= !empty($order['has_problem']) ? 'Sim' : 'Nao' ?></strong></div>
</div>

<div class="ops-detail-layout">
  <div class="ops-detail-main">
    <form class="form-card ops-command-panel" data-admin-status data-reload-on-success="true" action="/admin/pedidos/<?= (int) $order['id'] ?>/status" method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="redirect_to" value="/admin/pedidos/<?= (int) $order['id'] ?>">
      <h2>Controle operacional</h2>

      <div class="field-row">
        <label>Status
          <select name="status">
            <?php foreach ($statusControls as $group => $options): ?>
              <optgroup label="<?= e($group) ?>">
                <?php foreach ($options as $option): ?>
                  <option value="<?= e($option['status']) ?>" <?= $order['status'] === $option['status'] ? 'selected' : '' ?>>
                    <?= e($option['label'] . (!empty($option['recommended']) ? ' - proximo' : '') . (!empty($option['warning']) ? ' - atencao' : '')) ?>
                  </option>
                <?php endforeach; ?>
              </optgroup>
            <?php endforeach; ?>
          </select>
        </label>

        <label>Prioridade
          <select name="priority">
            <?php foreach ($priorityOptions as $priority): ?>
              <option value="<?= e($priority) ?>" <?= ($order['priority'] ?? 'normal') === $priority ? 'selected' : '' ?>><?= e(status_label($priority)) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
      </div>

      <?php if ($warnings): ?>
        <div class="ops-warning-box">
          <strong>Pontos de controle</strong>
          <?php foreach (array_keys($warnings) as $warning): ?>
            <span><?= e($warning) ?></span>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <fieldset>
        <legend>Urgencia e problema</legend>
        <input type="hidden" name="has_problem" value="0">
        <label class="check">
          <input type="checkbox" name="has_problem" value="1" <?= !empty($order['has_problem']) ? 'checked' : '' ?>>
          Marcar como problema operacional
        </label>
        <label>Motivo do problema
          <input name="problem_reason" value="<?= e($order['problem_reason'] ?? '') ?>" placeholder="Ex.: divergencia de pagamento, falta de lote, cliente sem retorno">
        </label>
      </fieldset>

      <div class="field-row">
        <label>Mensagem ao cliente
          <textarea name="message" placeholder="Atualizacao objetiva que aparecera na timeline do cliente."></textarea>
        </label>
        <label>Nota interna
          <textarea name="internal_note" placeholder="Uso da equipe: separacao, estoque, contato telefonico, orientacao farmaceutica."></textarea>
        </label>
      </div>

      <input type="hidden" name="visible_to_customer" value="0">
      <label class="check">
        <input type="checkbox" name="visible_to_customer" value="1" checked>
        Registrar status/mensagem na timeline do cliente
      </label>

      <button class="btn primary" type="submit">Salvar operacao</button>
    </form>

    <section class="panel">
      <div class="section-head compact">
        <div>
          <h2>Itens do pedido</h2>
          <p>Conferencia para separacao, receita e itens controlados.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Qtd</th><th>Receita</th><th>Risco</th><th>Total</th></tr></thead>
          <tbody>
            <?php foreach ($items as $item): ?>
              <tr>
                <td><strong><?= e($item['product_name']) ?></strong><br><span class="helper"><?= e($item['ean'] ?: $item['product_sku'] ?: 'Sem EAN/SKU') ?></span></td>
                <td><?= (int) $item['quantity'] ?></td>
                <td><?= status_pill($item['prescription_type'] ?? 'none') ?></td>
                <td>
                  <div class="tag-row">
                    <?php if (!empty($item['is_controlled'])): ?><span class="tag danger">Controlado</span><?php endif; ?>
                    <?php if (!empty($item['is_thermosensitive'])): ?><span class="tag warn">Termolabil</span><?php endif; ?>
                    <?php if (empty($item['is_controlled']) && empty($item['is_thermosensitive'])): ?><span class="tag neutral">Padrao</span><?php endif; ?>
                  </div>
                </td>
                <td><strong><?= money($item['line_total']) ?></strong></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="section-head compact">
        <div>
          <h2>Timeline operacional</h2>
          <p>Historico completo com origem, visibilidade e notas internas.</p>
        </div>
      </div>
      <?php if (empty($history)): ?>
        <div class="empty-state"><p>Nenhum evento registrado.</p></div>
      <?php else: ?>
        <div class="timeline ops-timeline">
          <?php foreach ($history as $event): ?>
            <div class="<?= !empty($event['visible_to_customer']) ? 'public-event' : 'internal-event' ?>">
              <strong>
                <?= $event['previous_status'] ? e(status_label($event['previous_status'])) . ' -> ' : '' ?><?= e(status_label($event['new_status'])) ?>
              </strong>
              <span><?= e($formatDate($event['created_at'] ?? null)) ?> - <?= e(status_label($event['source'] ?? 'admin')) ?> - <?= !empty($event['visible_to_customer']) ? 'Cliente ve' : 'Interno' ?></span>
              <?php if (!empty($event['message_to_customer'])): ?>
                <p><b>Cliente:</b> <?= nl2br(e($event['message_to_customer'])) ?></p>
              <?php endif; ?>
              <?php if (!empty($event['internal_note'])): ?>
                <p><b>Equipe:</b> <?= nl2br(e($event['internal_note'])) ?></p>
              <?php endif; ?>
              <?php if (!empty($event['changed_by_name'])): ?>
                <small>Por <?= e($event['changed_by_name']) ?></small>
              <?php endif; ?>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </section>

    <section class="panel">
      <div class="section-head compact">
        <div>
          <h2>Notas</h2>
          <p>Separacao clara entre observacoes internas e comunicacao com cliente.</p>
        </div>
      </div>
      <div class="notes-grid">
        <div>
          <h3>Internas</h3>
          <?php if (!empty($order['internal_note'])): ?>
            <div class="note-item"><strong>Nota atual</strong><p><?= nl2br(e($order['internal_note'])) ?></p></div>
          <?php endif; ?>
          <?php foreach ($internalNotes as $note): ?>
            <div class="note-item"><strong><?= e($formatDate($note['created_at'] ?? null)) ?></strong><p><?= nl2br(e($note['note'])) ?></p></div>
          <?php endforeach; ?>
          <?php if (empty($order['internal_note']) && empty($internalNotes)): ?><p class="helper">Sem notas internas.</p><?php endif; ?>
        </div>
        <div>
          <h3>Cliente</h3>
          <?php if (!empty($order['customer_note'])): ?>
            <div class="note-item"><strong>Observacao do cliente</strong><p><?= nl2br(e($order['customer_note'])) ?></p></div>
          <?php endif; ?>
          <?php if (!empty($order['pharmacy_note_to_customer'])): ?>
            <div class="note-item"><strong>Ultima mensagem da farmacia</strong><p><?= nl2br(e($order['pharmacy_note_to_customer'])) ?></p></div>
          <?php endif; ?>
          <?php foreach ($customerNotes as $note): ?>
            <div class="note-item"><strong><?= e($formatDate($note['created_at'] ?? null)) ?></strong><p><?= nl2br(e($note['note'])) ?></p></div>
          <?php endforeach; ?>
          <?php if (empty($order['customer_note']) && empty($order['pharmacy_note_to_customer']) && empty($customerNotes)): ?><p class="helper">Sem mensagens registradas.</p><?php endif; ?>
        </div>
      </div>
    </section>
  </div>

  <aside class="ops-detail-side">
    <section class="summary-card">
      <h2>Cliente</h2>
      <div class="meta-list">
        <span>Nome</span><strong><?= e($customerName) ?></strong>
        <span>Email</span><strong><?= e($customerEmail ?: 'Nao informado') ?></strong>
        <span>Telefone</span><strong><?= e($order['customer_phone'] ?: 'Nao informado') ?></strong>
        <span>CPF</span><strong><?= e($order['cpf_masked'] ?: ($customerSnapshot['cpf'] ?? 'Nao informado')) ?></strong>
      </div>
    </section>

    <section class="summary-card">
      <h2>Entrega</h2>
      <div class="meta-list">
        <span>Modalidade</span><strong><?= e(status_label($order['delivery_method'] ?? '')) ?></strong>
        <span>Status</span><strong><?= e(status_label($order['delivery_status'] ?? '')) ?></strong>
        <span>Previsao</span><strong><?= e($formatDate($order['estimated_delivery_at'] ?? null)) ?></strong>
        <span>Endereco</span><strong><?= e(trim(($address['street'] ?? '') . ', ' . ($address['number'] ?? ''), ', ')) ?></strong>
        <span>Bairro</span><strong><?= e($address['district'] ?? 'Nao informado') ?></strong>
        <span>Cidade</span><strong><?= e(trim(($address['city'] ?? '') . ' ' . ($address['state'] ?? ''))) ?></strong>
      </div>
    </section>

    <section class="summary-card">
      <h2>Checklist da farmacia</h2>
      <ul class="secure-list ops-checklist">
        <li class="<?= ($order['payment_status'] ?? '') === 'aprovado' ? 'done' : 'pending' ?>">Pagamento <?= e(status_label($order['payment_status'] ?? '')) ?></li>
        <li class="<?= empty($order['requires_prescription']) || ($order['clinical_status'] ?? '') === 'liberado' ? 'done' : 'pending' ?>">Receita <?= e(status_label($order['clinical_status'] ?? '')) ?></li>
        <li class="<?= empty($order['has_controlled_items']) ? 'done' : 'pending' ?>">Controlados <?= empty($order['has_controlled_items']) ? 'nao' : 'sim' ?></li>
        <li class="<?= !empty($order['has_problem']) ? 'pending' : 'done' ?>">Problema <?= !empty($order['has_problem']) ? 'aberto' : 'sem pendencia' ?></li>
      </ul>
      <?php if (!empty($order['problem_reason'])): ?>
        <p class="ops-card-note"><?= e($order['problem_reason']) ?></p>
      <?php endif; ?>
    </section>
  </aside>
</div>
<?php endif; ?>
