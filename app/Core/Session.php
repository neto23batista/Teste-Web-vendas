<?php

declare(strict_types=1);

namespace App\Core;

final class Session
{
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $secure = (bool) config('app.session_secure', false);
        session_name((string) config('app.session_name', 'farmavida_session'));
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();

        if (!isset($_SESSION['_started_at'])) {
            $_SESSION['_started_at'] = time();
            $_SESSION['_last_regenerated_at'] = time();
        }

        if (time() - (int) ($_SESSION['_last_regenerated_at'] ?? 0) > 900) {
            session_regenerate_id(true);
            $_SESSION['_last_regenerated_at'] = time();
        }
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function flash(string $key, string $message): void
    {
        $_SESSION['_flash'][$key] = $message;
    }

    public static function pullFlash(): array
    {
        $flash = $_SESSION['_flash'] ?? [];
        unset($_SESSION['_flash']);
        return is_array($flash) ? $flash : [];
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
    }
}

