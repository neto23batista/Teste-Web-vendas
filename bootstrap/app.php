<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\Database;
use App\Core\Env;
use App\Core\Router;
use App\Core\Session;

define('BASE_PATH', dirname(__DIR__));
define('APP_PATH', BASE_PATH . DIRECTORY_SEPARATOR . 'app');
define('CONFIG_PATH', BASE_PATH . DIRECTORY_SEPARATOR . 'config');
define('STORAGE_PATH', BASE_PATH . DIRECTORY_SEPARATOR . 'storage');
define('VIEW_PATH', BASE_PATH . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR . 'views');
define('PUBLIC_PATH', BASE_PATH . DIRECTORY_SEPARATOR . 'public');

$vendorAutoload = BASE_PATH . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (is_file($vendorAutoload)) {
    require_once $vendorAutoload;
} else {
    spl_autoload_register(static function (string $class): void {
        $prefix = 'App\\';
        if (str_starts_with($class, $prefix) === false) {
            return;
        }

        $relative = substr($class, strlen($prefix));
        $file = APP_PATH . DIRECTORY_SEPARATOR . str_replace('\\', DIRECTORY_SEPARATOR, $relative) . '.php';
        if (is_file($file)) {
            require_once $file;
        }
    });

    require_once APP_PATH . DIRECTORY_SEPARATOR . 'Helpers' . DIRECTORY_SEPARATOR . 'functions.php';
}

Env::load(BASE_PATH . DIRECTORY_SEPARATOR . '.env');
Config::load(CONFIG_PATH);

date_default_timezone_set((string) config('app.timezone', 'America/Sao_Paulo'));

if ((bool) config('app.debug', false)) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
}

Session::start();

foreach ((array) config('security.headers', []) as $header => $value) {
    if ($header === 'Strict-Transport-Security' && empty($_SERVER['HTTPS'])) {
        continue;
    }
    header($header . ': ' . $value);
}

set_exception_handler(static function (Throwable $exception): void {
    app_log('error', 'Unhandled exception', [
        'message' => $exception->getMessage(),
        'file' => $exception->getFile(),
        'line' => $exception->getLine(),
    ]);

    $debug = (bool) config('app.debug', false);
    http_response_code(500);

    if (is_json_request()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'error' => $debug ? $exception->getMessage() : 'Erro interno do servidor.',
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($debug) {
        echo '<pre>' . e((string) $exception) . '</pre>';
        return;
    }

    echo view('errors/500', ['title' => 'Erro interno']);
});

Database::configure((array) config('database'));

$router = new Router();
require BASE_PATH . DIRECTORY_SEPARATOR . 'routes' . DIRECTORY_SEPARATOR . 'web.php';
require BASE_PATH . DIRECTORY_SEPARATOR . 'routes' . DIRECTORY_SEPARATOR . 'admin.php';
require BASE_PATH . DIRECTORY_SEPARATOR . 'routes' . DIRECTORY_SEPARATOR . 'api.php';

return $router;
