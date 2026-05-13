<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Core\Session;

abstract class Controller
{
    protected function render(string $view, array $data = [], string $layout = 'layouts/app'): void
    {
        echo view($view, $data, $layout);
    }

    protected function json(array $data, int $status = 200): void
    {
        Response::json($data, $status);
    }

    protected function redirect(string $path, ?string $message = null, string $type = 'success'): void
    {
        if ($message !== null) {
            Session::flash($type, $message);
        }
        Response::redirect($path);
    }
}

