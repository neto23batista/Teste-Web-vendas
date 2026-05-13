<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Core\Request;
use App\Core\Response;
use App\Core\Session;

final class CsrfMiddleware
{
    public function handle(Request $request): void
    {
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return;
        }

        $token = (string) ($request->input('_csrf') ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        $sessionToken = (string) Session::get('_csrf_token', '');

        if ($sessionToken === '' || $token === '' || !hash_equals($sessionToken, $token)) {
            app_log('warning', 'CSRF validation failed', ['path' => $request->path(), 'ip' => $request->ip()]);
            if (is_json_request()) {
                Response::json(['ok' => false, 'error' => 'Token CSRF invalido.'], 419);
                exit;
            }
            http_response_code(419);
            echo view('errors/419', ['title' => 'Sessao expirada']);
            exit;
        }
    }
}

