<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Core\Request;
use App\Core\Response;

final class AuthMiddleware
{
    public function handle(Request $request): void
    {
        if (user() !== null) {
            return;
        }

        if (is_json_request()) {
            Response::json(['ok' => false, 'error' => 'Autenticacao obrigatoria.'], 401);
            exit;
        }

        Response::redirect('/login');
        exit;
    }
}

