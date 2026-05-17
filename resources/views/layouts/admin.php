<?php
$flash = App\Core\Session::pullFlash();
$currentUser = user() ?: [];
$userName = (string) ($currentUser['name'] ?? 'Admin FarmaVida');
$initials = strtoupper(substr(trim($userName), 0, 1) ?: 'F');
$pageTitle = (string) ($title ?? 'Admin FarmaVida');
$isOwnerUser = is_owner();
$branchService = new App\Services\BranchService();
$branches = is_admin_geral() ? $branchService->all() : [];
$currentBranchLabel = is_admin_geral() ? $branchService->branchName(App\Core\Session::get('selected_filial_id')) : $branchService->branchName(user_filial_id());
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
  <meta name="color-scheme" content="light dark">
  <title><?= e($pageTitle) ?></title>
  <script>try{document.documentElement.dataset.theme=localStorage.getItem('farmavida-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}</script>
  <link rel="stylesheet" href="/assets/css/app.css">
  <link rel="stylesheet" href="/assets/css/style.css">
  <link rel="stylesheet" href="/assets/css/dashboard.css">
  <link rel="stylesheet" href="/assets/css/responsive.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
  <script src="/assets/js/script.js" defer></script>
  <script src="/assets/js/charts.js" defer></script>
  <script src="/assets/js/admin.js" defer></script>
</head>
<body class="admin-shell">
  <a class="skip-link" href="#admin-conteudo">Ir para o conteudo</a>
  <aside class="sidebar">
    <div class="sidebar-header">
      <a class="brand" href="/admin"><span class="brand-mark" aria-hidden="true"></span><span>FarmaVida</span></a>
      <button class="sidebar-toggle tooltip" type="button" data-sidebar-toggle data-tooltip="Recolher menu" aria-label="Recolher menu"></button>
    </div>
    <span class="nav-group-title">Operacao</span>
    <a href="/admin" data-icon="dashboard"><span>Dashboard</span></a>
    <a href="/admin/pedidos" data-icon="orders"><span>Pedidos</span></a>
    <a href="/admin/receitas" data-icon="rx"><span>Receitas</span></a>
    <a href="/admin/estoque" data-icon="stock"><span>Estoque</span></a>
    <a href="/admin/estoque/transferencias" data-icon="stock"><span>Transferencias</span></a>
    <a href="/admin/caixa" data-icon="money"><span>Caixa</span></a>
    <a href="/admin/compras" data-icon="orders"><span>Compras</span></a>
    <a href="/admin/clientes" data-icon="customers"><span>Clientes</span></a>
    <?php if ($isOwnerUser): ?>
      <a href="/admin/funcionarios" data-icon="customers"><span>Funcionarios</span></a>
    <?php endif; ?>
    <span class="nav-group-title">Catalogo</span>
    <a href="/admin/produtos" data-icon="stock"><span>Produtos</span></a>
    <a href="/admin/marketing" data-icon="dashboard"><span>Marketing</span></a>
    <a href="/admin/avaliacoes" data-icon="dashboard"><span>Avaliacoes</span></a>
    <a href="/admin/servicos" data-icon="orders"><span>Servicos</span></a>
    <a href="/admin/entrega" data-icon="orders"><span>Entrega</span></a>
    <span class="nav-group-title">Financeiro</span>
    <a href="/admin/pagamentos" data-icon="money"><span>Pagamentos</span></a>
    <a href="/admin/nfe" data-icon="orders"><span>NF-e simulada</span></a>
    <a href="/admin/relatorios" data-icon="dashboard"><span>Relatorios</span></a>
    <span class="nav-group-title">Sistema</span>
    <a href="/admin/integracoes" data-icon="dashboard"><span>Integracoes</span></a>
    <?php if ($isOwnerUser): ?>
      <a href="/admin/configuracoes" data-icon="stock"><span>Configuracoes</span></a>
    <?php endif; ?>
    <a href="/admin/jobs" data-icon="dashboard"><span>Jobs</span></a>
    <a href="/admin/logs" data-icon="orders"><span>Logs</span></a>
  </aside>

  <main id="admin-conteudo" class="admin-main">
    <header class="admin-topbar">
      <div class="admin-topbar-left">
        <button class="sidebar-toggle tooltip" type="button" data-sidebar-toggle data-tooltip="Abrir menu" aria-label="Abrir menu"></button>
        <form class="admin-search" action="/admin/pedidos" method="get" role="search">
          <input name="q" placeholder="Buscar pedido, cliente, produto ou status" aria-label="Busca global administrativa">
        </form>
      </div>
      <div class="admin-topbar-actions">
        <?php if (is_admin_geral()): ?>
          <form class="branch-switcher" method="get" action="<?= e(parse_url($_SERVER['REQUEST_URI'] ?? '/admin', PHP_URL_PATH) ?: '/admin') ?>">
            <select name="id_filial" onchange="this.form.submit()" aria-label="Filial">
              <option value="all">Todas as filiais</option>
              <?php foreach ($branches as $branch): ?>
                <option value="<?= (int) $branch['id'] ?>" <?= (int) App\Core\Session::get('selected_filial_id') === (int) $branch['id'] ? 'selected' : '' ?>><?= e($branch['nome']) ?></option>
              <?php endforeach; ?>
            </select>
          </form>
        <?php else: ?>
          <span class="tag neutral"><?= e($currentBranchLabel) ?></span>
        <?php endif; ?>
        <button class="icon-btn notification-dot tooltip" type="button" data-notification-demo data-tooltip="Notificacoes" aria-label="Notificacoes"></button>
        <button class="theme-toggle tooltip" type="button" data-theme-toggle data-tooltip="Alternar tema" aria-label="Alternar tema"></button>
        <div class="admin-user-chip">
          <span class="avatar" aria-hidden="true"><?= e($initials) ?></span>
          <div><span>Usuario</span><strong><?= e($userName) ?></strong></div>
        </div>
        <form action="/logout" method="post"><?= csrf_field() ?><button class="btn" type="submit">Sair</button></form>
      </div>
    </header>

    <header class="admin-header">
      <div>
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/admin">Admin</a><span>/</span><span><?= e($pageTitle) ?></span></nav>
        <p class="eyebrow">Painel operacional</p>
        <h1><?= e($pageTitle) ?></h1>
        <p>Visao para vendas, estoque, receitas, pagamentos, clientes e auditoria.</p>
      </div>
    </header>

    <?php foreach ($flash as $type => $message): ?>
      <div class="alert <?= e($type) ?>"><?= e($message) ?></div>
    <?php endforeach; ?>
    <?= $content ?>
  </main>
</body>
</html>
