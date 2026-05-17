<?php
$flash = App\Core\Session::pullFlash();
$appName = (string) config('app.name', 'FarmaVida');
$pageTitle = (string) ($title ?? $appName);
$fullTitle = $pageTitle === $appName ? $appName . ' | Farmacia online segura' : $pageTitle . ' | ' . $appName;
$metaDescription = (string) ($description ?? 'FarmaVida e uma farmacia online com compra segura, receitas protegidas, entrega local, retirada na loja e atendimento farmaceutico.');
$canonicalUrl = url($_SERVER['REQUEST_URI'] ?? '/');
$pharmacyName = (string) (($pharmacy['trade_name'] ?? '') ?: $appName);
$currentUser = user();
$isCustomerUser = ($currentUser['user_type'] ?? '') === 'customer';
$isAdminUser = $currentUser !== null && in_array($currentUser['user_type'] ?? '', ['admin', 'system'], true);
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
  <meta name="description" content="<?= e($metaDescription) ?>">
  <meta name="theme-color" content="#0a735f">
  <meta name="color-scheme" content="light dark">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="<?= e($appName) ?>">
  <meta property="og:title" content="<?= e($fullTitle) ?>">
  <meta property="og:description" content="<?= e($metaDescription) ?>">
  <meta property="og:url" content="<?= e($canonicalUrl) ?>">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="<?= e($canonicalUrl) ?>">
  <title><?= e($fullTitle) ?></title>
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/assets/icons/icon.svg" type="image/svg+xml">
  <script>try{document.documentElement.dataset.theme=localStorage.getItem('farmavida-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}</script>
  <link rel="stylesheet" href="/assets/css/app.css">
  <link rel="stylesheet" href="/assets/css/style.css">
  <link rel="stylesheet" href="/assets/css/dashboard.css">
  <link rel="stylesheet" href="/assets/css/responsive.css">
  <script type="application/ld+json">
<?= json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'Pharmacy',
    'name' => $pharmacyName,
    'url' => url('/'),
    'address' => array_filter([
        '@type' => 'PostalAddress',
        'streetAddress' => trim((string) (($pharmacy['address_street'] ?? '') . ' ' . ($pharmacy['address_number'] ?? ''))),
        'addressLocality' => $pharmacy['address_city'] ?? null,
        'addressRegion' => $pharmacy['address_state'] ?? null,
        'postalCode' => $pharmacy['address_postal_code'] ?? null,
        'addressCountry' => 'BR',
    ]),
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>
  </script>
</head>
<body>
  <a class="skip-link" href="#conteudo">Ir para o conteudo</a>
  <header class="topbar">
    <a class="brand" href="/" aria-label="FarmaVida - inicio"><span class="brand-mark" aria-hidden="true"></span><span>FarmaVida</span></a>
    <form class="search" action="/catalogo" method="get" role="search">
      <input type="search" name="q" placeholder="Buscar medicamento, principio ativo, marca ou EAN" autocomplete="off" data-autocomplete aria-label="Buscar produtos">
    </form>
    <nav class="main-nav" aria-label="Navegacao principal">
      <a class="nav-link" href="/catalogo">Catalogo</a>
      <a class="nav-link" href="/faq-clinico">Receitas</a>
      <?php if ($isCustomerUser): ?><a class="nav-link" href="/cliente/servicos">Servicos</a><?php endif; ?>
      <a class="nav-link cart-link" href="/sacola">Sacola <span data-cart-count></span></a>
      <?php if ($isCustomerUser): ?>
        <a class="nav-link" href="/cliente">Minha conta</a>
        <form action="/logout" method="post" class="inline"><?= csrf_field() ?><button type="submit">Sair</button></form>
      <?php elseif ($isAdminUser): ?>
        <a class="nav-link" href="/admin">Admin</a>
        <form action="/logout" method="post" class="inline"><?= csrf_field() ?><button type="submit">Sair</button></form>
      <?php else: ?>
        <a class="nav-link" href="/login">Entrar</a>
      <?php endif; ?>
      <button class="theme-toggle tooltip" type="button" data-theme-toggle data-tooltip="Alternar tema" aria-label="Alternar tema"></button>
    </nav>
  </header>
  <div class="trustbar" aria-label="Garantias FarmaVida">
    <span><strong>Compra segura</strong></span>
    <span><strong>Receitas protegidas</strong></span>
    <span><strong>Pagamento criptografado</strong></span>
    <span><strong>Atendimento farmaceutico</strong></span>
  </div>
  <main id="conteudo" class="page">
    <?php foreach ($flash as $type => $message): ?>
      <div class="alert <?= e($type) ?>"><?= e($message) ?></div>
    <?php endforeach; ?>
    <?= $content ?>
  </main>
  <div id="quick-view-modal" class="modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Visualizacao rapida do produto">
    <div class="modal-backdrop" data-modal-close></div>
    <div class="modal-panel">
      <button class="btn modal-close" type="button" data-modal-close aria-label="Fechar">x</button>
      <article class="quick-view-card">
        <div class="product-image" data-qv-image><span>FV</span></div>
        <div>
          <p class="eyebrow" data-qv-category>Produto FarmaVida</p>
          <h2 data-qv-name>Produto</h2>
          <p data-qv-description></p>
          <p class="alert warning" data-qv-prescription hidden>Este produto exige receita. Envie o arquivo no checkout para validacao farmaceutica.</p>
          <strong class="price" data-qv-price></strong>
          <div class="actions">
            <button class="btn primary add-cart" type="button" data-qv-add data-product-id="">Adicionar a sacola</button>
            <span class="tag warn" data-qv-unavailable hidden>Compra automatica indisponivel</span>
            <a class="btn" href="#" data-qv-detail>Ver pagina completa</a>
          </div>
        </div>
      </article>
    </div>
  </div>
  <nav class="mobile-bottom-nav" aria-label="Navegacao mobile">
    <a href="/" class="mobile-nav-link">Inicio</a>
    <a href="/catalogo" class="mobile-nav-link">Catalogo</a>
    <?php if ($isCustomerUser): ?><a href="/cliente/servicos" class="mobile-nav-link">Servicos</a><?php endif; ?>
    <a href="/sacola" class="mobile-nav-link">Sacola</a>
    <?php if ($isCustomerUser): ?>
      <a href="/cliente" class="mobile-nav-link">Conta</a>
    <?php elseif ($isAdminUser): ?>
      <a href="/admin" class="mobile-nav-link">Admin</a>
    <?php else: ?>
      <a href="/login" class="mobile-nav-link">Entrar</a>
    <?php endif; ?>
  </nav>
  <footer class="footer">
    <div class="footer-inner">
      <div>
        <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span>FarmaVida</span></a>
        <p>Farmacia online com operacao segura, privacidade LGPD e suporte farmaceutico.</p>
      </div>
      <div class="footer-credentials" aria-label="Credenciais da farmacia">
        <span><?= e($pharmacyName) ?></span>
        <span>CNPJ <?= e($pharmacy['cnpj'] ?? 'sob consulta') ?></span>
        <span>Farmaceutico responsavel <?= e($pharmacy['responsible_pharmacist'] ?? 'cadastrado') ?><?= !empty($pharmacy['crf_number']) ? ' - ' . e($pharmacy['crf_number']) : '' ?></span>
      </div>
      <nav class="footer-links" aria-label="Links institucionais">
        <a href="/farmacia">Informacoes da farmacia</a>
        <a href="/privacidade">Privacidade</a>
        <a href="/termos">Termos</a>
        <a href="/admin/login">Admin</a>
      </nav>
      <div class="footer-meta">
        <span>Ambiente protegido para dados pessoais e receitas.</span>
        <span>FarmaVida &copy; <?= date('Y') ?></span>
      </div>
    </div>
  </footer>
  <script src="/assets/js/script.js" defer></script>
  <script src="/assets/js/app.js" defer></script>
</body>
</html>
