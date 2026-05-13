<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\Database;
use App\Core\Session;
use App\Core\View;

function config(string $key, mixed $default = null): mixed
{
    return Config::get($key, $default);
}

function env_value(string $key, mixed $default = null): mixed
{
    return App\Core\Env::get($key, $default);
}

function view(string $view, array $data = [], string $layout = 'layouts/app'): string
{
    return View::render($view, $data, $layout);
}

function partial(string $view, array $data = []): string
{
    return View::renderPartial($view, $data);
}

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function money(mixed $value): string
{
    return 'R$ ' . number_format((float) $value, 2, ',', '.');
}

function status_label(?string $status): string
{
    $labels = [
        'pedido_recebido' => 'Pedido recebido',
        'aguardando_pagamento' => 'Aguardando pagamento',
        'pagamento_em_analise' => 'Pagamento em analise',
        'pagamento_confirmado' => 'Pagamento confirmado',
        'aguardando_receita' => 'Aguardando receita',
        'receita_enviada' => 'Receita enviada',
        'receita_em_validacao' => 'Receita em validacao',
        'receita_aprovada' => 'Receita aprovada',
        'receita_rejeitada' => 'Receita rejeitada',
        'liberado_pelo_farmaceutico' => 'Liberado pelo farmaceutico',
        'em_separacao' => 'Em separacao',
        'conferido' => 'Conferido',
        'saiu_para_entrega' => 'Saiu para entrega',
        'pronto_para_retirada' => 'Pronto para retirada',
        'entregue' => 'Entregue',
        'cancelado' => 'Cancelado',
        'aprovado' => 'Aprovado',
        'em_analise' => 'Em analise',
        'recusado' => 'Recusado',
        'estornado' => 'Estornado',
        'expirado' => 'Expirado',
        'divergente' => 'Divergente',
        'out_of_stock' => 'Zerado',
        'low_stock' => 'Estoque baixo',
        'near_expiration' => 'Vencimento proximo',
        'expired' => 'Vencido',
        'pendente' => 'Pendente',
        'pending' => 'Pendente',
        'paid' => 'Pago',
        'approved' => 'Aprovado',
        'failed' => 'Falhou',
        'aguardando' => 'Aguardando',
        'rejeitado' => 'Rejeitado',
        'active' => 'Ativo',
        'inactive' => 'Inativo',
        'blocked' => 'Bloqueado',
        'deleted' => 'Excluido',
        'pending_verification' => 'Verificacao pendente',
        'anonymization_requested' => 'Anonimizacao solicitada',
        'anonymized' => 'Anonimizado',
        'suspended' => 'Suspenso',
        'available' => 'Disponivel',
        'unavailable' => 'Indisponivel',
        'low' => 'Baixo',
        'zero' => 'Zerado',
        'critical' => 'Critico',
        'ok' => 'OK',
        'nao_exige_receita' => 'Nao exige receita',
        'liberado' => 'Liberado',
        'bloqueado_orientacao_farmaceutica' => 'Bloqueado orientacao farmaceutica',
        'normal' => 'Normal',
        'urgent' => 'Urgente',
        'info' => 'Informativo',
        'none' => 'Nao exige',
        'simple' => 'Receita simples',
        'antibiotic' => 'Antibiotico',
        'controlled' => 'Controlado',
        'psychotropic' => 'Psicotropico',
        'pix' => 'Pix',
        'credit_card' => 'Cartao',
        'debit_card' => 'Debito',
        'boleto' => 'Boleto',
        'manual' => 'Manual',
        'unknown' => 'Nao informado',
        'pickup' => 'Retirada',
        'local_delivery' => 'Delivery local',
        'motoboy' => 'Motoboy',
        'carrier' => 'Transportadora',
        'not_required' => 'Nao exigida',
        'assigned' => 'Atribuida',
        'in_transit' => 'Em rota',
        'delivered' => 'Entregue',
        'returned' => 'Devolvida',
        'internal' => 'Interna',
        'customer' => 'Cliente',
        'admin' => 'Admin',
        'system' => 'Sistema',
        'payment_webhook' => 'Webhook de pagamento',
        'api' => 'API',
        'erp' => 'ERP',
        'district' => 'Bairro',
        'postal_code' => 'CEP',
        'distance' => 'Distancia',
        'city' => 'Cidade',
        'motorcycle' => 'Moto',
        'car' => 'Carro',
        'bicycle' => 'Bicicleta',
        'third_party' => 'Terceiro',
        'percent' => 'Percentual',
        'fixed' => 'Valor fixo',
        'free_shipping' => 'Frete gratis',
        'flash' => 'Relampago',
        'category' => 'Categoria',
        'product' => 'Produto',
        'delivery' => 'Entrega',
        'home_hero' => 'Home principal',
        'home_middle' => 'Home meio',
        'checkout' => 'Checkout',
        'high' => 'Alta',
        'medium' => 'Media',
    ];

    $status = trim((string) $status);
    return $labels[$status] ?? ucfirst(str_replace('_', ' ', $status));
}

function status_class(?string $status): string
{
    $status = (string) $status;
    if (in_array($status, ['entregue', 'pagamento_confirmado', 'receita_aprovada', 'aprovado', 'approved', 'paid', 'active', 'available', 'ok', 'liberado_pelo_farmaceutico', 'liberado', 'delivered'], true)) {
        return 'success';
    }
    if (in_array($status, ['cancelado', 'rejeitado', 'receita_rejeitada', 'recusado', 'divergente', 'failed', 'blocked', 'deleted', 'suspended', 'critical', 'zero', 'out_of_stock', 'expired', 'estoque_zerado'], true)) {
        return 'danger';
    }
    if (in_array($status, ['aguardando_pagamento', 'pagamento_em_analise', 'em_analise', 'aguardando_receita', 'receita_em_validacao', 'receita_enviada', 'near_expiration', 'pendente', 'pending', 'urgent', 'low', 'low_stock', 'estoque_baixo'], true)) {
        return 'warning';
    }
    if (str_contains($status, 'pagamento')) {
        return 'payment';
    }
    return 'neutral';
}

function status_pill(?string $status): string
{
    return '<span class="status-pill ' . e(status_class($status)) . '">' . e(status_label($status)) . '</span>';
}

function url(string $path = ''): string
{
    return rtrim((string) config('app.url', ''), '/') . '/' . ltrim($path, '/');
}

function redirect(string $path): void
{
    header('Location: ' . $path, true, 302);
}

function csrf_token(): string
{
    $token = Session::get('_csrf_token');
    if (!is_string($token) || $token === '') {
        $token = bin2hex(random_bytes(32));
        Session::put('_csrf_token', $token);
    }
    return $token;
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function user(): ?array
{
    $user = Session::get('user');
    return is_array($user) ? $user : null;
}

function is_admin(): bool
{
    $user = user();
    return $user !== null && in_array($user['user_type'] ?? '', ['admin', 'system'], true);
}

function user_roles(?int $userId = null): array
{
    $user = user();
    $userId ??= $user['id'] ?? null;
    if (!$userId) {
        return [];
    }

    static $cache = [];
    if (isset($cache[$userId])) {
        return $cache[$userId];
    }

    $stmt = Database::connection()->prepare('SELECT r.slug
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = :user_id');
    $stmt->execute(['user_id' => $userId]);
    $cache[$userId] = array_values(array_filter(array_map('strval', $stmt->fetchAll(\PDO::FETCH_COLUMN))));
    return $cache[$userId];
}

function has_role(string $role, ?int $userId = null): bool
{
    return in_array($role, user_roles($userId), true);
}

function is_owner(?int $userId = null): bool
{
    $user = user();
    if (($user['user_type'] ?? '') === 'system') {
        return true;
    }
    return has_role('owner', $userId);
}

function admin_account_is_active(?int $userId = null): bool
{
    $user = user();
    $userId ??= $user['id'] ?? null;
    if (!$userId) {
        return false;
    }
    if (($user['user_type'] ?? '') === 'system') {
        return true;
    }

    $stmt = Database::connection()->prepare("SELECT COUNT(*)
        FROM admins a
        INNER JOIN users u ON u.id = a.user_id
        WHERE a.user_id = :user_id
          AND a.deleted_at IS NULL
          AND u.deleted_at IS NULL
          AND u.status = 'active'
          AND a.status = 'active'");
    $stmt->execute(['user_id' => $userId]);
    return (int) $stmt->fetchColumn() > 0;
}

function role_label(?string $role): string
{
    return [
        'owner' => 'Dono',
        'admin' => 'Administrador',
        'pharmacist' => 'Farmaceutico',
        'attendant' => 'Atendente',
        'employee' => 'Funcionario comum',
        'stockist' => 'Estoquista',
        'delivery' => 'Entregador',
    ][(string) $role] ?? status_label($role);
}

function role_class(?string $role): string
{
    return [
        'owner' => 'owner',
        'admin' => 'blue',
        'pharmacist' => 'success',
        'attendant' => 'neutral',
        'employee' => 'neutral',
        'stockist' => 'warn',
        'delivery' => 'blue',
    ][(string) $role] ?? 'neutral';
}

function is_json_request(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    return str_contains((string) $accept, 'application/json') || str_contains((string) $contentType, 'application/json') || str_starts_with($_SERVER['REQUEST_URI'] ?? '', '/api/');
}

function app_log(string $level, string $message, array $context = []): void
{
    $dir = STORAGE_PATH . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'app';
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    $context = sanitize_log_context($context);
    $line = json_encode([
        'time' => date('c'),
        'level' => $level,
        'message' => $message,
        'context' => $context,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    file_put_contents($dir . DIRECTORY_SEPARATOR . date('Y-m-d') . '.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function sanitize_log_context(array $context): array
{
    $blocked = ['password', 'token', 'secret', 'access_token', 'cpf', 'document', 'card', 'authorization'];
    foreach ($context as $key => $value) {
        foreach ($blocked as $needle) {
            if (str_contains(strtolower((string) $key), $needle)) {
                $context[$key] = '[redacted]';
                continue 2;
            }
        }
        if (is_array($value)) {
            $context[$key] = sanitize_log_context($value);
        }
    }
    return $context;
}

function str_slug(string $value): string
{
    $value = iconv('UTF-8', 'ASCII//TRANSLIT', $value) ?: $value;
    $value = preg_replace('/[^A-Za-z0-9]+/', '-', $value) ?? $value;
    return strtolower(trim($value, '-'));
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function only_digits(string $value): string
{
    return preg_replace('/\D+/', '', $value) ?? '';
}

function mask_cpf(string $cpf): string
{
    $cpf = only_digits($cpf);
    if (strlen($cpf) !== 11) {
        return '';
    }
    return substr($cpf, 0, 3) . '.***.***-' . substr($cpf, -2);
}

function valid_cpf(string $cpf): bool
{
    $cpf = only_digits($cpf);
    if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf)) {
        return false;
    }

    for ($t = 9; $t < 11; $t++) {
        $sum = 0;
        for ($i = 0; $i < $t; $i++) {
            $sum += (int) $cpf[$i] * (($t + 1) - $i);
        }
        $digit = ((10 * $sum) % 11) % 10;
        if ((int) $cpf[$t] !== $digit) {
            return false;
        }
    }
    return true;
}
