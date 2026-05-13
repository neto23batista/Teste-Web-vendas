<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    /** @var array<int, array{method:string,path:string,action:mixed,middleware:array<int,string>}> */
    private array $routes = [];

    public function get(string $path, mixed $action, array $middleware = []): void
    {
        $this->add('GET', $path, $action, $middleware);
    }

    public function post(string $path, mixed $action, array $middleware = []): void
    {
        $this->add('POST', $path, $action, $middleware);
    }

    public function put(string $path, mixed $action, array $middleware = []): void
    {
        $this->add('PUT', $path, $action, $middleware);
    }

    public function delete(string $path, mixed $action, array $middleware = []): void
    {
        $this->add('DELETE', $path, $action, $middleware);
    }

    public function add(string $method, string $path, mixed $action, array $middleware = []): void
    {
        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => '/' . trim($path, '/'),
            'action' => $action,
            'middleware' => $middleware,
        ];
    }

    public function dispatch(Request $request): void
    {
        foreach ($this->routes as $route) {
            $params = $this->match($route['path'], $request->path());
            if ($params === null || $route['method'] !== $request->method()) {
                continue;
            }

            $request = $request->withParams($params);
            foreach ($route['middleware'] as $middleware) {
                $class = str_contains($middleware, '\\') ? $middleware : 'App\\Middlewares\\' . $middleware;
                (new $class())->handle($request);
            }

            $this->call($route['action'], $request);
            return;
        }

        http_response_code(404);
        echo view('errors/404', ['title' => 'Pagina nao encontrada']);
    }

    /** @return array<string, string>|null */
    private function match(string $routePath, string $requestPath): ?array
    {
        $pattern = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $routePath);
        $pattern = '#^' . $pattern . '$#';
        if (!preg_match($pattern, $requestPath, $matches)) {
            return null;
        }

        $params = [];
        foreach ($matches as $key => $value) {
            if (is_string($key)) {
                $params[$key] = $value;
            }
        }
        return $params;
    }

    private function call(mixed $action, Request $request): void
    {
        if (is_callable($action)) {
            $action($request);
            return;
        }

        [$class, $method] = explode('@', (string) $action, 2);
        if (!str_contains($class, '\\')) {
            $class = 'App\\Controllers\\' . $class;
        }
        (new $class())->{$method}($request);
    }
}

