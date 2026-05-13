<?php

declare(strict_types=1);

namespace App\Core;

final class Request
{
    /** @param array<string, string> $params */
    public function __construct(private array $params = [])
    {
    }

    public function method(): string
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'POST' && isset($_POST['_method'])) {
            return strtoupper((string) $_POST['_method']);
        }
        return $method;
    }

    public function path(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $script = dirname($_SERVER['SCRIPT_NAME'] ?? '');
        if ($script !== '/' && $script !== '\\' && str_starts_with($uri, $script)) {
            $uri = substr($uri, strlen($script));
        }
        return '/' . trim($uri, '/');
    }

    public function param(string $key, mixed $default = null): mixed
    {
        return $this->params[$key] ?? $default;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $_POST[$key] ?? $_GET[$key] ?? $default;
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        return array_merge($_GET, $_POST);
    }

    /** @return array<string, mixed> */
    public function json(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    public function file(string $key): ?array
    {
        return $_FILES[$key] ?? null;
    }

    public function ip(): string
    {
        $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $trustedProxies = (array) config('security.trusted_proxies', []);
        if ($remote !== '' && in_array($remote, $trustedProxies, true)) {
            $forwarded = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
            foreach (explode(',', $forwarded) as $candidate) {
                $candidate = trim($candidate);
                if (filter_var($candidate, FILTER_VALIDATE_IP)) {
                    return $candidate;
                }
            }
        }

        return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : '0.0.0.0';
    }

    public function userAgent(): string
    {
        return substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255);
    }

    /** @param array<string, string> $params */
    public function withParams(array $params): self
    {
        return new self($params);
    }
}
