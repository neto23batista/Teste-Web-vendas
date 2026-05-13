<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title ?? 'Impressao') ?></title>
  <link rel="stylesheet" href="/assets/css/app.css">
  <style>
    body { background: #fff; }
    .print-page { max-width: 980px; margin: 0 auto; padding: 24px; }
    @media print { .no-print { display: none; } .print-page { padding: 0; } }
  </style>
</head>
<body>
  <main class="print-page"><?= $content ?></main>
</body>
</html>

