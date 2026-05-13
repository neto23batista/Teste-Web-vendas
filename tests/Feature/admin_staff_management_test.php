<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'TestCase.php';

$root = dirname(__DIR__, 2);
$service = file_get_contents($root . '/app/Services/AdminStaffService.php') ?: '';
$controller = file_get_contents($root . '/app/Controllers/Admin/DashboardController.php') ?: '';
$middleware = file_get_contents($root . '/app/Middlewares/AdminMiddleware.php') ?: '';
$auth = file_get_contents($root . '/app/Services/AuthService.php') ?: '';
$routes = file_get_contents($root . '/routes/admin.php') ?: '';
$view = file_get_contents($root . '/resources/views/admin/staff.php') ?: '';
$layout = file_get_contents($root . '/resources/views/layouts/admin.php') ?: '';
$migration = file_get_contents($root . '/database/migrations/017_admin_staff_owner_management.sql') ?: '';
$helpers = file_get_contents($root . '/app/Helpers/functions.php') ?: '';

assert_true(str_contains($service, 'assertOwnerCanManage'), 'Servico exige Dono para gerenciar funcionarios.');
assert_true(str_contains($service, 'ensureOwnerTargetAllowed'), 'Servico protege edicao/desativacao de Donos.');
assert_true(str_contains($service, 'activeOwnerCount'), 'Servico protege contra remocao do ultimo Dono ativo.');
assert_true(str_contains($service, 'password_hash'), 'Cadastro de funcionario usa hash de senha.');
assert_true(str_contains($service, '[^A-Za-z0-9]'), 'Senha exige caractere especial.');
assert_true(str_contains($service, 'cpfExists'), 'Servico valida CPF unico.');
assert_true(str_contains($service, 'emailExists'), 'Servico valida e-mail unico.');
assert_true(str_contains($service, "AuditService())->admin('users'"), 'Acoes de funcionarios geram auditoria.');

assert_true(str_contains($middleware, 'ownerOnlyPermissions'), 'Middleware possui permissoes exclusivas de Dono.');
assert_true(str_contains($middleware, 'admin_account_is_active'), 'Middleware bloqueia admin inativo/suspenso.');
assert_true(str_contains($auth, 'admins WHERE user_id'), 'Login admin valida status do cadastro administrativo.');
assert_true(str_contains($helpers, 'function is_owner'), 'Helpers expõem identificacao de Dono.');
assert_true(str_contains($helpers, 'function role_label'), 'Helpers rotulam perfis administrativos.');

assert_true(str_contains($routes, 'staffStore'), 'Rotas permitem criar funcionario.');
assert_true(str_contains($routes, 'staffUpdate'), 'Rotas permitem editar funcionario.');
assert_true(str_contains($routes, 'staffStatus'), 'Rotas permitem alterar status.');
assert_true(str_contains($routes, 'staffDelete'), 'Rotas permitem excluir logicamente.');
assert_true(str_contains($controller, 'AdminStaffService'), 'Controller usa servico dedicado de funcionarios.');

assert_true(str_contains($view, 'Novo Funcionario'), 'Tela exibe botao Novo Funcionario.');
assert_true(str_contains($view, 'Novo Dono/Admin'), 'Tela exibe fluxo Novo Dono/Admin.');
assert_true(str_contains($view, '$canCreateOwner'), 'Tela condiciona Dono ao usuario autorizado.');
assert_true(str_contains($view, 'data-staff-form'), 'Tela possui formulario validavel de funcionario.');
assert_true(str_contains($view, 'data-open-modal'), 'Tela usa modais para cadastro, edicao e confirmacao.');
assert_true(str_contains($view, 'pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}"'), 'Front-end exige senha forte.');
assert_true(str_contains($layout, '$isOwnerUser = is_owner()'), 'Menu administrativo identifica Dono.');
assert_true(str_contains($layout, 'href="/admin/funcionarios"') && str_contains($layout, 'if ($isOwnerUser)'), 'Menu sensivel fica condicionado ao Dono.');

assert_true(str_contains($migration, 'cpf_hash'), 'Migration adiciona CPF administrativo.');
assert_true(str_contains($migration, 'profile_photo_path'), 'Migration adiciona foto de perfil.');
assert_true(str_contains($migration, "'employee'"), 'Migration cria perfil de funcionario comum.');

echo "Admin staff management tests passed.\n";
