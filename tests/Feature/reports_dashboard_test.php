<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$service = file_get_contents(dirname(__DIR__, 2) . '/app/Services/ReportService.php') ?: '';
$view = file_get_contents(dirname(__DIR__, 2) . '/resources/views/admin/reports/index.php') ?: '';
$migration = file_get_contents(dirname(__DIR__, 2) . '/database/migrations/016_admin_reporting_decision_views.sql') ?: '';

assert_true(str_contains($service, 'decisionDashboard'), 'Relatorios possuem dashboard de decisao.');
assert_true(str_contains($service, 'paymentMix'), 'Relatorios agregam mix de pagamentos.');
assert_true(str_contains($service, 'prescriptionOutcomes'), 'Relatorios agregam desfechos de receitas.');
assert_true(str_contains($service, 'normalizeFilters'), 'Relatorios possuem filtros de data.');
assert_true(str_contains($view, 'reportVolumeChart'), 'Tela renderiza grafico de volume.');
assert_true(str_contains($view, 'paymentMixChart'), 'Tela renderiza grafico de pagamentos.');
assert_true(str_contains($view, 'statusDistributionChart'), 'Tela renderiza distribuicao de status.');
assert_true(str_contains($view, 'Estoque em risco'), 'Tela exibe estoque em risco.');
assert_true(str_contains($migration, 'v_report_payment_mix_daily'), 'Migration cria view diaria de pagamentos.');
assert_true(str_contains($migration, 'v_report_prescription_outcomes_daily'), 'Migration cria view diaria de receitas.');
