<?php
$address = trim(implode(', ', array_filter([
    $pharmacy['address_street'] ?? '',
    $pharmacy['address_number'] ?? '',
])));
$cityState = trim(implode(' / ', array_filter([
    $pharmacy['address_city'] ?? '',
    $pharmacy['address_state'] ?? '',
])));
$responsible = trim((string) ($pharmacy['responsible_pharmacist'] ?? ''));
$crf = trim((string) ($pharmacy['crf_number'] ?? ''));
?>

<section class="legal-page">
  <div class="section-head legal-hero">
    <div>
      <p class="eyebrow">Transparencia FarmaVida</p>
      <h1>Informacoes institucionais</h1>
      <p>Dados publicos da farmacia, responsavel tecnico, licencas e canais oficiais para que o cliente compre com seguranca.</p>
    </div>
    <span class="tag success">Operacao identificada</span>
  </div>

  <div class="credential-grid" aria-label="Dados cadastrais da farmacia">
    <article class="credential-item">
      <span>Razao social</span>
      <strong><?= e($pharmacy['legal_name'] ?? 'Nao informado') ?></strong>
    </article>
    <article class="credential-item">
      <span>Nome fantasia</span>
      <strong><?= e($pharmacy['trade_name'] ?? 'FarmaVida') ?></strong>
    </article>
    <article class="credential-item">
      <span>CNPJ</span>
      <strong><?= e($pharmacy['cnpj'] ?? 'Sob consulta') ?></strong>
    </article>
    <article class="credential-item">
      <span>Endereco</span>
      <strong><?= e($address ?: 'Endereco nao informado') ?></strong>
      <?php if ($cityState !== ''): ?>
        <small><?= e($cityState) ?><?= !empty($pharmacy['address_postal_code']) ? ' - CEP ' . e($pharmacy['address_postal_code']) : '' ?></small>
      <?php endif; ?>
    </article>
    <article class="credential-item">
      <span>Farmaceutico responsavel</span>
      <strong><?= e($responsible ?: 'Responsavel cadastrado') ?></strong>
      <small><?= e($crf ?: 'CRF sob consulta') ?></small>
    </article>
    <article class="credential-item">
      <span>Canal farmaceutico</span>
      <strong><?= e($pharmacy['pharmaceutical_guidance_channel'] ?? 'Atendimento pelo painel FarmaVida') ?></strong>
    </article>
  </div>

  <div class="compliance-grid">
    <article class="compliance-card">
      <p class="eyebrow">Licenca sanitaria</p>
      <h2><?= e($pharmacy['sanitary_license'] ?? 'Nao informado') ?></h2>
      <p>Referencia usada pela operacao para atendimento sanitariamente responsavel.</p>
    </article>
    <article class="compliance-card">
      <p class="eyebrow">Autorizacao Anvisa</p>
      <h2>AFE <?= e($pharmacy['anvisa_afe'] ?? 'Nao informado') ?></h2>
      <p>Medicamentos e produtos seguem regras de venda, estoque e rastreabilidade.</p>
    </article>
    <article class="compliance-card">
      <p class="eyebrow">Autorizacao especial</p>
      <h2>AE <?= e($pharmacy['anvisa_ae'] ?? 'Nao aplicavel') ?></h2>
      <p>Produtos controlados possuem fluxo restrito, validacao e orientacao farmaceutica.</p>
    </article>
  </div>
</section>
