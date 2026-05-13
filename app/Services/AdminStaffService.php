<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDO;
use RuntimeException;

final class AdminStaffService
{
    private const MANAGED_ROLES = ['owner', 'admin', 'pharmacist', 'attendant', 'employee'];

    /** @return array<string, string> */
    public function roleOptions(bool $includeOwner = true): array
    {
        $roles = [
            'owner' => 'Dono',
            'admin' => 'Administrador',
            'pharmacist' => 'Farmaceutico',
            'attendant' => 'Atendente',
            'employee' => 'Funcionario comum',
        ];

        if (!$includeOwner) {
            unset($roles['owner']);
        }

        return $roles;
    }

    /** @return array<string, string> */
    public function statusOptions(): array
    {
        return [
            'active' => 'Ativo',
            'inactive' => 'Inativo',
            'blocked' => 'Bloqueado',
        ];
    }

    public function summary(): array
    {
        $db = Database::connection();
        return [
            'total' => (int) $db->query("SELECT COUNT(*) FROM users u INNER JOIN admins a ON a.user_id = u.id WHERE u.deleted_at IS NULL AND a.deleted_at IS NULL")->fetchColumn(),
            'active' => (int) $db->query("SELECT COUNT(*) FROM users u INNER JOIN admins a ON a.user_id = u.id WHERE u.status = 'active' AND a.status = 'active' AND u.deleted_at IS NULL AND a.deleted_at IS NULL")->fetchColumn(),
            'owners' => $this->activeOwnerCount(),
            'pharmacists' => (int) $db->query("SELECT COUNT(*) FROM admins WHERE is_pharmacist = 1 AND deleted_at IS NULL")->fetchColumn(),
        ];
    }

    public function list(array $filters = []): array
    {
        $where = ["u.user_type IN ('admin', 'system')", 'u.deleted_at IS NULL', 'a.deleted_at IS NULL'];
        $params = [];

        $query = trim((string) ($filters['q'] ?? ''));
        if ($query !== '') {
            $where[] = '(u.name LIKE :q OR u.email LIKE :q OR u.phone LIKE :q OR a.display_name LIKE :q OR a.position LIKE :q OR a.employee_code LIKE :q OR a.cpf_masked LIKE :q)';
            $params['q'] = '%' . $query . '%';
        }

        $status = trim((string) ($filters['status'] ?? 'all'));
        if ($status === 'active') {
            $where[] = "u.status = 'active' AND a.status = 'active'";
        } elseif ($status === 'inactive') {
            $where[] = "a.status = 'inactive'";
        } elseif ($status === 'blocked') {
            $where[] = "(u.status = 'blocked' OR a.status = 'suspended')";
        }

        $role = trim((string) ($filters['role'] ?? 'all'));
        if ($role !== '' && $role !== 'all' && in_array($role, self::MANAGED_ROLES, true)) {
            $where[] = "EXISTS (
                SELECT 1
                FROM user_roles ur_filter
                INNER JOIN roles r_filter ON r_filter.id = ur_filter.role_id
                WHERE ur_filter.user_id = u.id AND r_filter.slug = :role
            )";
            $params['role'] = $role;
        }

        $sql = "SELECT
                u.id AS user_id,
                u.name,
                u.email,
                u.phone,
                u.user_type,
                u.status AS user_status,
                u.created_at,
                u.updated_at,
                a.employee_code,
                a.display_name,
                a.position,
                a.crf_number,
                a.is_pharmacist,
                a.can_validate_prescriptions,
                a.status AS admin_status,
                a.cpf_masked,
                a.cpf_last4,
                a.profile_photo_path,
                role_stats.role_slugs,
                role_stats.role_names
            FROM users u
            INNER JOIN admins a ON a.user_id = u.id
            LEFT JOIN (
                SELECT
                    ur.user_id,
                    GROUP_CONCAT(DISTINCT r.slug ORDER BY FIELD(r.slug, 'owner', 'admin', 'pharmacist', 'attendant', 'employee', 'stockist', 'delivery') SEPARATOR ',') AS role_slugs,
                    GROUP_CONCAT(DISTINCT r.name ORDER BY FIELD(r.slug, 'owner', 'admin', 'pharmacist', 'attendant', 'employee', 'stockist', 'delivery') SEPARATOR ', ') AS role_names
                FROM user_roles ur
                INNER JOIN roles r ON r.id = ur.role_id
                GROUP BY ur.user_id
            ) role_stats ON role_stats.user_id = u.id
            WHERE " . implode(' AND ', $where) . "
            ORDER BY
                FIELD(SUBSTRING_INDEX(COALESCE(role_stats.role_slugs, 'employee'), ',', 1), 'owner', 'admin', 'pharmacist', 'attendant', 'employee') ASC,
                u.name ASC
            LIMIT 200";

        $stmt = Database::connection()->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value);
        }
        $stmt->execute();

        return array_map(fn (array $row): array => $this->hydrateRow($row), $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    public function find(int $userId): ?array
    {
        $stmt = Database::connection()->prepare("SELECT
                u.id AS user_id,
                u.name,
                u.email,
                u.phone,
                u.user_type,
                u.status AS user_status,
                u.created_at,
                u.updated_at,
                a.employee_code,
                a.display_name,
                a.position,
                a.crf_number,
                a.is_pharmacist,
                a.can_validate_prescriptions,
                a.status AS admin_status,
                a.cpf_masked,
                a.cpf_last4,
                a.profile_photo_path,
                role_stats.role_slugs,
                role_stats.role_names
            FROM users u
            INNER JOIN admins a ON a.user_id = u.id
            LEFT JOIN (
                SELECT
                    ur.user_id,
                    GROUP_CONCAT(DISTINCT r.slug ORDER BY FIELD(r.slug, 'owner', 'admin', 'pharmacist', 'attendant', 'employee', 'stockist', 'delivery') SEPARATOR ',') AS role_slugs,
                    GROUP_CONCAT(DISTINCT r.name ORDER BY FIELD(r.slug, 'owner', 'admin', 'pharmacist', 'attendant', 'employee', 'stockist', 'delivery') SEPARATOR ', ') AS role_names
                FROM user_roles ur
                INNER JOIN roles r ON r.id = ur.role_id
                GROUP BY ur.user_id
            ) role_stats ON role_stats.user_id = u.id
            WHERE u.id = :id AND u.deleted_at IS NULL AND a.deleted_at IS NULL
            LIMIT 1");
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->hydrateRow($row) : null;
    }

    public function create(array $input, ?array $photo, Request $request): int
    {
        $this->assertOwnerCanManage();
        $data = $this->validatedData($input, true);
        $status = $this->splitStatus((string) $data['status']);
        $photoPath = $this->storeProfilePhoto($photo);
        $actorId = (int) (user()['id'] ?? 0);

        return (int) Database::transaction(function (PDO $pdo) use ($data, $status, $photoPath, $actorId, $request): int {
            $stmt = $pdo->prepare("INSERT INTO users (public_id, user_type, name, email, phone, password_hash, status, created_ip, created_user_agent)
                VALUES (:public_id, 'admin', :name, :email, :phone, :password_hash, :status, :ip, :ua)");
            $stmt->execute([
                'public_id' => uuid_v4(),
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password_hash' => password_hash((string) $data['password'], PASSWORD_BCRYPT),
                'status' => $status['user'],
                'ip' => $request->ip(),
                'ua' => $request->userAgent(),
            ]);
            $userId = (int) $pdo->lastInsertId();

            $pdo->prepare("INSERT INTO admins (user_id, employee_code, display_name, position, crf_number, cpf_hash, cpf_masked, cpf_last4, is_pharmacist, can_validate_prescriptions, profile_photo_path, status, created_by, updated_by)
                VALUES (:user_id, :employee_code, :display_name, :position, :crf_number, :cpf_hash, :cpf_masked, :cpf_last4, :is_pharmacist, :can_validate, :photo, :status, :created_by, :updated_by)")
                ->execute([
                    'user_id' => $userId,
                    'employee_code' => $this->nextEmployeeCode($pdo),
                    'display_name' => $data['name'],
                    'position' => $data['position'],
                    'crf_number' => $data['crf_number'],
                    'cpf_hash' => $data['cpf_hash'],
                    'cpf_masked' => $data['cpf_masked'],
                    'cpf_last4' => $data['cpf_last4'],
                    'is_pharmacist' => $data['role'] === 'pharmacist' ? 1 : 0,
                    'can_validate' => $data['role'] === 'pharmacist' || !empty($data['can_validate_prescriptions']) ? 1 : 0,
                    'photo' => $photoPath,
                    'status' => $status['admin'],
                    'created_by' => $actorId ?: null,
                    'updated_by' => $actorId ?: null,
                ]);

            $this->assignManagedRole($pdo, $userId, (string) $data['role'], $actorId);
            (new AuditService())->admin('users', 'created', 'user', $userId, [], $this->auditPayload($data, $status));
            return $userId;
        });
    }

    public function update(int $userId, array $input, ?array $photo, Request $request): void
    {
        $this->assertOwnerCanManage();
        $before = $this->requireStaff($userId);
        $data = $this->validatedData($input, false, $userId);
        $status = $this->splitStatus((string) $data['status']);
        $this->ensureOwnerTargetAllowed($userId, (string) $data['role'], (string) $data['status'], false);

        $photoPath = $this->storeProfilePhoto($photo);
        $actorId = (int) (user()['id'] ?? 0);

        Database::transaction(function (PDO $pdo) use ($userId, $data, $status, $photoPath, $actorId, $before): void {
            $userData = [
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'status' => $status['user'],
                'id' => $userId,
            ];
            $passwordSql = '';
            if ((string) ($data['password'] ?? '') !== '') {
                $passwordSql = ', password_hash = :password_hash, password_changed_at = NOW(), session_version = session_version + 1';
                $userData['password_hash'] = password_hash((string) $data['password'], PASSWORD_BCRYPT);
            }

            $pdo->prepare("UPDATE users SET name = :name, email = :email, phone = :phone, status = :status{$passwordSql} WHERE id = :id")
                ->execute($userData);

            $adminData = [
                'display_name' => $data['name'],
                'position' => $data['position'],
                'crf_number' => $data['crf_number'],
                'cpf_hash' => $data['cpf_hash'],
                'cpf_masked' => $data['cpf_masked'],
                'cpf_last4' => $data['cpf_last4'],
                'is_pharmacist' => $data['role'] === 'pharmacist' ? 1 : 0,
                'can_validate' => $data['role'] === 'pharmacist' || !empty($data['can_validate_prescriptions']) ? 1 : 0,
                'status' => $status['admin'],
                'updated_by' => $actorId ?: null,
                'user_id' => $userId,
            ];
            $photoSql = '';
            if ($photoPath !== null) {
                $photoSql = ', profile_photo_path = :photo';
                $adminData['photo'] = $photoPath;
            }

            $pdo->prepare("UPDATE admins SET display_name = :display_name, position = :position, crf_number = :crf_number, cpf_hash = :cpf_hash, cpf_masked = :cpf_masked, cpf_last4 = :cpf_last4, is_pharmacist = :is_pharmacist, can_validate_prescriptions = :can_validate, status = :status, updated_by = :updated_by{$photoSql} WHERE user_id = :user_id")
                ->execute($adminData);

            $this->assignManagedRole($pdo, $userId, (string) $data['role'], $actorId);
            (new AuditService())->admin('users', 'updated', 'user', $userId, $before, $this->auditPayload($data, $status));
        });
    }

    public function changeStatus(int $userId, string $status): void
    {
        $this->assertOwnerCanManage();
        $before = $this->requireStaff($userId);
        $status = $this->normalizeStatus($status);
        $this->ensureOwnerTargetAllowed($userId, (string) $before['primary_role'], $status, false);
        $split = $this->splitStatus($status);
        $actorId = (int) (user()['id'] ?? 0);

        Database::transaction(function (PDO $pdo) use ($userId, $split, $status, $actorId, $before): void {
            $pdo->prepare('UPDATE users SET status = :status, session_version = session_version + 1 WHERE id = :id')
                ->execute(['status' => $split['user'], 'id' => $userId]);
            $pdo->prepare('UPDATE admins SET status = :status, updated_by = :updated_by WHERE user_id = :id')
                ->execute(['status' => $split['admin'], 'updated_by' => $actorId ?: null, 'id' => $userId]);
            (new AuditService())->admin('users', 'status_changed', 'user', $userId, $before, ['status' => $status]);
        });
    }

    public function delete(int $userId): void
    {
        $this->assertOwnerCanManage();
        $before = $this->requireStaff($userId);
        $this->ensureOwnerTargetAllowed($userId, (string) $before['primary_role'], 'deleted', true);
        $actorId = (int) (user()['id'] ?? 0);

        Database::transaction(function (PDO $pdo) use ($userId, $actorId, $before): void {
            $pdo->prepare("UPDATE users SET status = 'deleted', deleted_at = NOW(), session_version = session_version + 1 WHERE id = :id")
                ->execute(['id' => $userId]);
            $pdo->prepare("UPDATE admins SET status = 'inactive', deleted_at = NOW(), updated_by = :updated_by WHERE user_id = :id")
                ->execute(['updated_by' => $actorId ?: null, 'id' => $userId]);
            (new AuditService())->admin('users', 'deleted', 'user', $userId, $before, ['deleted' => true]);
        });
    }

    private function validatedData(array $input, bool $create, ?int $ignoreUserId = null): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $cpf = only_digits((string) ($input['cpf'] ?? ''));
        $role = trim((string) ($input['role'] ?? $input['user_role'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $passwordConfirmation = (string) ($input['password_confirmation'] ?? '');
        $status = $this->normalizeStatus((string) ($input['status'] ?? 'active'));
        $position = trim((string) ($input['position'] ?? '')) ?: $this->roleOptions(true)[$role] ?? 'Funcionario';
        $crfNumber = trim((string) ($input['crf_number'] ?? '')) ?: null;

        $errors = [];
        if ($name === '') {
            $errors[] = 'Nome completo e obrigatorio.';
        }
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'E-mail valido e obrigatorio.';
        } elseif ($this->emailExists($email, $ignoreUserId)) {
            $errors[] = 'E-mail ja cadastrado no sistema.';
        }
        if ($cpf === '' || !valid_cpf($cpf)) {
            $errors[] = 'CPF valido e obrigatorio.';
        } elseif ($this->cpfExists($cpf, $ignoreUserId)) {
            $errors[] = 'CPF ja cadastrado no sistema.';
        }
        if (!in_array($role, self::MANAGED_ROLES, true)) {
            $errors[] = 'Tipo de usuario obrigatorio.';
        }
        if ($role === 'owner' && !is_owner()) {
            $errors[] = 'Apenas um Dono pode criar ou editar outro Dono.';
        }
        if ($create || $password !== '') {
            $passwordErrors = $this->passwordErrors($password);
            if ($passwordErrors !== []) {
                $errors = array_merge($errors, $passwordErrors);
            }
            if (!hash_equals($password, $passwordConfirmation)) {
                $errors[] = 'Confirmacao de senha nao confere.';
            }
        }

        if ($errors !== []) {
            throw new RuntimeException(implode(' ', $errors));
        }

        return [
            'name' => $name,
            'email' => $email,
            'phone' => trim((string) ($input['phone'] ?? '')),
            'cpf_hash' => hash('sha256', $cpf . (string) config('app.key')),
            'cpf_masked' => mask_cpf($cpf),
            'cpf_last4' => substr($cpf, -4),
            'position' => $position,
            'role' => $role,
            'status' => $status,
            'password' => $password,
            'crf_number' => $crfNumber,
            'can_validate_prescriptions' => !empty($input['can_validate_prescriptions']) ? 1 : 0,
        ];
    }

    /** @return array<int, string> */
    private function passwordErrors(string $password): array
    {
        $errors = [];
        if (strlen($password) < 8) {
            $errors[] = 'Senha deve ter no minimo 8 caracteres.';
        }
        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'Senha deve ter letra maiuscula.';
        }
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = 'Senha deve ter letra minuscula.';
        }
        if (!preg_match('/\d/', $password)) {
            $errors[] = 'Senha deve ter numero.';
        }
        if (!preg_match('/[^A-Za-z0-9]/', $password)) {
            $errors[] = 'Senha deve ter caractere especial.';
        }
        return $errors;
    }

    private function assertOwnerCanManage(): void
    {
        if (!is_owner()) {
            throw new RuntimeException('Apenas usuarios com perfil Dono podem gerenciar funcionarios administrativos.');
        }
    }

    private function ensureOwnerTargetAllowed(int $userId, string $newRole, string $newStatus, bool $deleting): void
    {
        $isOwnerTarget = $this->targetHasRole($userId, 'owner');
        if (($isOwnerTarget || $newRole === 'owner') && !is_owner()) {
            throw new RuntimeException('Apenas um Dono pode alterar dados de outro Dono.');
        }

        $willRemainActiveOwner = !$deleting && $newRole === 'owner' && $newStatus === 'active';
        if ($isOwnerTarget && !$willRemainActiveOwner && $this->activeOwnerCount() <= 1) {
            throw new RuntimeException('Nao e permitido remover, bloquear ou desativar o ultimo Dono ativo do sistema.');
        }
    }

    private function emailExists(string $email, ?int $ignoreUserId): bool
    {
        $sql = 'SELECT COUNT(*) FROM users WHERE email = :email AND deleted_at IS NULL';
        $params = ['email' => $email];
        if ($ignoreUserId !== null) {
            $sql .= ' AND id <> :id';
            $params['id'] = $ignoreUserId;
        }
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn() > 0;
    }

    private function cpfExists(string $cpf, ?int $ignoreUserId): bool
    {
        $sql = 'SELECT COUNT(*) FROM admins WHERE cpf_hash = :cpf_hash AND deleted_at IS NULL';
        $params = ['cpf_hash' => hash('sha256', $cpf . (string) config('app.key'))];
        if ($ignoreUserId !== null) {
            $sql .= ' AND user_id <> :id';
            $params['id'] = $ignoreUserId;
        }
        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn() > 0;
    }

    private function normalizeStatus(string $status): string
    {
        return in_array($status, ['active', 'inactive', 'blocked'], true) ? $status : 'active';
    }

    /** @return array{user:string, admin:string} */
    private function splitStatus(string $status): array
    {
        return match ($this->normalizeStatus($status)) {
            'inactive' => ['user' => 'active', 'admin' => 'inactive'],
            'blocked' => ['user' => 'blocked', 'admin' => 'suspended'],
            default => ['user' => 'active', 'admin' => 'active'],
        };
    }

    private function targetHasRole(int $userId, string $role): bool
    {
        $stmt = Database::connection()->prepare("SELECT COUNT(*)
            FROM user_roles ur
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = :user_id AND r.slug = :role");
        $stmt->execute(['user_id' => $userId, 'role' => $role]);
        return (int) $stmt->fetchColumn() > 0;
    }

    private function activeOwnerCount(): int
    {
        return (int) Database::connection()->query("SELECT COUNT(DISTINCT u.id)
            FROM users u
            INNER JOIN admins a ON a.user_id = u.id
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE r.slug = 'owner'
              AND u.status = 'active'
              AND a.status = 'active'
              AND u.deleted_at IS NULL
              AND a.deleted_at IS NULL")->fetchColumn();
    }

    private function assignManagedRole(PDO $pdo, int $userId, string $role, int $actorId): void
    {
        $roleStmt = $pdo->prepare('SELECT id FROM roles WHERE slug = :slug LIMIT 1');
        $roleStmt->execute(['slug' => $role]);
        $roleId = (int) $roleStmt->fetchColumn();
        if ($roleId <= 0) {
            throw new RuntimeException('Perfil de usuario indisponivel.');
        }

        $placeholders = implode(',', array_fill(0, count(self::MANAGED_ROLES), '?'));
        $deleteParams = array_merge([$userId], self::MANAGED_ROLES);
        $pdo->prepare("DELETE ur
            FROM user_roles ur
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = ? AND r.slug IN ({$placeholders})")
            ->execute($deleteParams);

        $pdo->prepare('INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (:user_id, :role_id, :assigned_by)')
            ->execute(['user_id' => $userId, 'role_id' => $roleId, 'assigned_by' => $actorId ?: null]);
    }

    private function nextEmployeeCode(PDO $pdo): string
    {
        do {
            $code = 'FV-' . date('ym') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM admins WHERE employee_code = :code');
            $stmt->execute(['code' => $code]);
        } while ((int) $stmt->fetchColumn() > 0);

        return $code;
    }

    private function storeProfilePhoto(?array $file): ?string
    {
        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('Falha no upload da foto de perfil.');
        }
        if ((int) ($file['size'] ?? 0) > 2 * 1024 * 1024) {
            throw new RuntimeException('Foto de perfil deve ter ate 2MB.');
        }

        $mime = mime_content_type((string) $file['tmp_name']) ?: (string) ($file['type'] ?? '');
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowed[$mime])) {
            throw new RuntimeException('Foto de perfil deve ser JPG, PNG ou WebP.');
        }

        $dir = PUBLIC_PATH . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'profiles';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $name = uuid_v4() . '.' . $allowed[$mime];
        $target = $dir . DIRECTORY_SEPARATOR . $name;
        if (!move_uploaded_file((string) $file['tmp_name'], $target) && !rename((string) $file['tmp_name'], $target)) {
            throw new RuntimeException('Nao foi possivel salvar a foto de perfil.');
        }

        return '/assets/img/profiles/' . $name;
    }

    private function requireStaff(int $userId): array
    {
        $row = $this->find($userId);
        if (!$row) {
            throw new RuntimeException('Funcionario nao encontrado.');
        }
        return $row;
    }

    private function hydrateRow(array $row): array
    {
        $roles = array_values(array_filter(explode(',', (string) ($row['role_slugs'] ?? ''))));
        $primary = 'employee';
        foreach (self::MANAGED_ROLES as $role) {
            if (in_array($role, $roles, true)) {
                $primary = $role;
                break;
            }
        }

        $row['roles'] = $roles;
        $row['primary_role'] = $primary;
        $row['role_label'] = role_label($primary);
        $row['role_class'] = role_class($primary);
        $row['account_status'] = $this->displayStatus((string) ($row['user_status'] ?? ''), (string) ($row['admin_status'] ?? ''));
        return $row;
    }

    private function displayStatus(string $userStatus, string $adminStatus): string
    {
        if ($userStatus === 'blocked' || $adminStatus === 'suspended') {
            return 'blocked';
        }
        if ($adminStatus === 'inactive') {
            return 'inactive';
        }
        if ($userStatus === 'active' && $adminStatus === 'active') {
            return 'active';
        }
        return $userStatus ?: $adminStatus;
    }

    private function auditPayload(array $data, array $status): array
    {
        return [
            'name' => $data['name'] ?? null,
            'email' => $data['email'] ?? null,
            'cpf_masked' => $data['cpf_masked'] ?? null,
            'position' => $data['position'] ?? null,
            'role' => $data['role'] ?? null,
            'status' => $data['status'] ?? null,
            'user_status' => $status['user'] ?? null,
            'admin_status' => $status['admin'] ?? null,
        ];
    }
}
