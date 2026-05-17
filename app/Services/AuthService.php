<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use App\Core\Session;
use App\Middlewares\RateLimitMiddleware;
use App\Validators\Validator;
use PDO;
use PDOException;
use RuntimeException;

final class AuthService
{
    public function registerCustomer(array $data, Request $request): int
    {
        $validator = (new Validator())
            ->required($data, ['name', 'email', 'cpf', 'password', 'lgpd_accept'])
            ->email($data, 'email')
            ->cpf($data, 'cpf')
            ->password($data, 'password');

        if ($validator->fails()) {
            throw new RuntimeException(implode(' ', $validator->errors()));
        }

        $email = strtolower(trim((string) $data['email']));
        $cpf = only_digits((string) $data['cpf']);
        $cpfHash = hash('sha256', $cpf . (string) config('app.key'));
        $this->assertCustomerUnique($email, $cpfHash);

        try {
            return (int) Database::transaction(function (PDO $pdo) use ($data, $request, $email, $cpf, $cpfHash): int {
            $stmt = $pdo->prepare("INSERT INTO users (public_id, user_type, name, email, phone, password_hash, status, created_ip, created_user_agent)
                VALUES (:public_id, 'customer', :name, :email, :phone, :password_hash, 'active', :ip, :ua)");
            $stmt->execute([
                'public_id' => uuid_v4(),
                'name' => trim((string) $data['name']),
                'email' => $email,
                'phone' => trim((string) ($data['phone'] ?? '')),
                'password_hash' => password_hash((string) $data['password'], PASSWORD_BCRYPT),
                'ip' => $request->ip(),
                'ua' => $request->userAgent(),
            ]);
            $userId = (int) $pdo->lastInsertId();

            $pdo->prepare("INSERT INTO customers (user_id, cpf_hash, cpf_masked, cpf_last4, accepts_lgpd, lgpd_accepted_at, lgpd_accepted_ip, lgpd_accepted_user_agent, marketing_opt_in, marketing_opt_in_at, account_status)
                VALUES (:user_id, :cpf_hash, :cpf_masked, :cpf_last4, 1, NOW(), :ip, :ua, :marketing, IF(:marketing_for_date = 1, NOW(), NULL), 'active')")
                ->execute([
                    'user_id' => $userId,
                    'cpf_hash' => $cpfHash,
                    'cpf_masked' => mask_cpf($cpf),
                    'cpf_last4' => substr($cpf, -4),
                    'ip' => $request->ip(),
                    'ua' => $request->userAgent(),
                    'marketing' => !empty($data['marketing_opt_in']) ? 1 : 0,
                    'marketing_for_date' => !empty($data['marketing_opt_in']) ? 1 : 0,
                ]);
            $customerId = (int) $pdo->lastInsertId();

            $pdo->prepare("INSERT INTO lgpd_consents (user_id, customer_id, consent_type, version, accepted, ip_address, user_agent, legal_basis, purpose)
                VALUES (:user_id, :customer_id, 'privacy_policy', :version, 1, :ip, :ua, 'consentimento', 'Cadastro e operacao da conta')")
                ->execute([
                    'user_id' => $userId,
                    'customer_id' => $customerId,
                    'version' => (string) config('lgpd.privacy_policy_version', '1.0.0'),
                    'ip' => $request->ip(),
                    'ua' => $request->userAgent(),
                ]);

            $pdo->prepare('INSERT INTO loyalty_points (customer_id) VALUES (:customer_id)')->execute(['customer_id' => $customerId]);
            return $userId;
            });
        } catch (PDOException $exception) {
            if ($exception->getCode() === '23000') {
                throw new RuntimeException('E-mail ou CPF ja cadastrado.');
            }
            throw $exception;
        }
    }

    public function login(string $email, string $password, Request $request, bool $adminOnly = false): bool
    {
        $context = $adminOnly ? 'admin_login' : 'customer_login';
        $rate = new RateLimitMiddleware();
        $rate->hit($context, strtolower($email), $request, (int) config('security.login_max_attempts', 5), 15);

        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['email' => strtolower(trim($email))]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($password, (string) $user['password_hash'])) {
            $this->securityEvent('login_failed', $user['id'] ?? null, $email, $request);
            return false;
        }

        if ($adminOnly && !in_array($user['user_type'], ['admin', 'system'], true)) {
            $this->securityEvent('permission_denied', (int) $user['id'], $email, $request);
            return false;
        }

        if (!$adminOnly && $user['user_type'] !== 'customer') {
            $this->securityEvent('permission_denied', (int) $user['id'], $email, $request);
            return false;
        }

        if ($adminOnly && $user['user_type'] !== 'system') {
            $adminStmt = Database::connection()->prepare("SELECT status FROM admins WHERE user_id = :user_id AND deleted_at IS NULL LIMIT 1");
            $adminStmt->execute(['user_id' => $user['id']]);
            if ($adminStmt->fetchColumn() !== 'active') {
                $this->securityEvent('permission_denied', (int) $user['id'], $email, $request);
                return false;
            }
        }

        if ($user['status'] !== 'active') {
            return false;
        }

        session_regenerate_id(true);
        Session::forget('customer_id');
        Session::forget('selected_filial_id');
        Session::put('user', [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'user_type' => $user['user_type'],
            'id_filial' => $user['id_filial'] !== null ? (int) $user['id_filial'] : null,
            'session_version' => (int) $user['session_version'],
        ]);
        if ($user['user_type'] === 'customer') {
            $customerStmt = Database::connection()->prepare('SELECT id, account_status FROM customers WHERE user_id = :user_id AND deleted_at IS NULL LIMIT 1');
            $customerStmt->execute(['user_id' => $user['id']]);
            $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
            if (!$customer || in_array((string) $customer['account_status'], ['deleted', 'anonymized'], true)) {
                Session::destroy();
                $this->securityEvent('permission_denied', (int) $user['id'], $email, $request);
                return false;
            }
            Session::put('customer_id', (int) $customer['id']);
        }

        Database::connection()->prepare('UPDATE users SET last_login_at = NOW(), last_login_ip = :ip WHERE id = :id')
            ->execute(['ip' => $request->ip(), 'id' => $user['id']]);
        $rate->clear($context, strtolower($email), $request->ip());
        $this->securityEvent('login_success', (int) $user['id'], $email, $request);
        return true;
    }

    public function logout(): void
    {
        Session::destroy();
    }

    public function requestPasswordReset(string $email, Request $request): void
    {
        $stmt = Database::connection()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => strtolower(trim($email))]);
        $user = $stmt->fetch();
        if (!$user) {
            return;
        }

        $token = bin2hex(random_bytes(32));
        Database::connection()->prepare('INSERT INTO password_resets (user_id, email, token_hash, requester_ip, requester_user_agent, expires_at) VALUES (:user_id, :email, :hash, :ip, :ua, DATE_ADD(NOW(), INTERVAL 1 HOUR))')
            ->execute([
                'user_id' => $user['id'],
                'email' => strtolower(trim($email)),
                'hash' => hash('sha256', $token),
                'ip' => $request->ip(),
                'ua' => $request->userAgent(),
            ]);

        (new EmailService())->queue('password_reset', strtolower(trim($email)), 'Recuperacao de senha FarmaVida', 'emails/password_reset', [
            'reset_url' => url('/redefinir-senha?token=' . $token),
        ]);
    }

    public function resetPassword(string $token, string $password): bool
    {
        $hash = hash('sha256', $token);
        $stmt = Database::connection()->prepare('SELECT * FROM password_resets WHERE token_hash = :hash AND used_at IS NULL AND expires_at > NOW() LIMIT 1');
        $stmt->execute(['hash' => $hash]);
        $reset = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$reset) {
            return false;
        }

        $validator = (new Validator())->password(['password' => $password], 'password');
        if ($validator->fails()) {
            throw new RuntimeException(implode(' ', $validator->errors()));
        }

        Database::transaction(function (PDO $pdo) use ($reset, $password): void {
            $pdo->prepare('UPDATE users SET password_hash = :hash, password_changed_at = NOW(), session_version = session_version + 1 WHERE id = :id')
                ->execute(['hash' => password_hash($password, PASSWORD_BCRYPT), 'id' => $reset['user_id']]);
            $pdo->prepare('UPDATE password_resets SET used_at = NOW() WHERE id = :id')
                ->execute(['id' => $reset['id']]);
        });
        return true;
    }

    private function securityEvent(string $type, ?int $userId, string $identifier, Request $request): void
    {
        Database::connection()->prepare('INSERT INTO security_events (event_type, user_id, identifier, ip_address, user_agent) VALUES (:type, :user_id, :identifier, :ip, :ua)')
            ->execute([
                'type' => $type,
                'user_id' => $userId,
                'identifier' => $identifier,
                'ip' => $request->ip(),
                'ua' => $request->userAgent(),
            ]);
    }

    private function assertCustomerUnique(string $email, string $cpfHash): void
    {
        $stmt = Database::connection()->prepare('SELECT COUNT(*) FROM users WHERE email = :email AND deleted_at IS NULL');
        $stmt->execute(['email' => $email]);
        if ((int) $stmt->fetchColumn() > 0) {
            throw new RuntimeException('E-mail ou CPF ja cadastrado.');
        }

        $stmt = Database::connection()->prepare('SELECT COUNT(*) FROM customers WHERE cpf_hash = :cpf_hash AND deleted_at IS NULL');
        $stmt->execute(['cpf_hash' => $cpfHash]);
        if ((int) $stmt->fetchColumn() > 0) {
            throw new RuntimeException('E-mail ou CPF ja cadastrado.');
        }
    }
}
