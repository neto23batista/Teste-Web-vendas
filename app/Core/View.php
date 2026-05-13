<?php

declare(strict_types=1);

namespace App\Core;

final class View
{
    /** @param array<string, mixed> $data */
    public static function render(string $view, array $data = [], string $layout = 'layouts/app'): string
    {
        $content = self::renderFile($view, $data);
        return self::renderFile($layout, array_merge($data, ['content' => $content]));
    }

    /** @param array<string, mixed> $data */
    public static function renderPartial(string $view, array $data = []): string
    {
        return self::renderFile($view, $data);
    }

    /** @param array<string, mixed> $data */
    private static function renderFile(string $view, array $data): string
    {
        $relative = str_replace('/', DIRECTORY_SEPARATOR, $view) . '.php';
        $file = VIEW_PATH . DIRECTORY_SEPARATOR . $relative;
        if (!is_file($file)) {
            $file = BASE_PATH . DIRECTORY_SEPARATOR . 'resources' . DIRECTORY_SEPARATOR . $relative;
        }
        if (!is_file($file)) {
            throw new \RuntimeException("View not found: {$view}");
        }

        extract($data, EXTR_SKIP);
        ob_start();
        require $file;
        return (string) ob_get_clean();
    }
}
