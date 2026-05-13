<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;

final class Database
{
    /** @var array<string, mixed> */
    private static array $config = [];

    private static ?PDO $pdo = null;

    /** @param array<string, mixed> $config */
    public static function configure(array $config): void
    {
        self::$config = $config;
    }

    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $host = self::$config['host'] ?? '127.0.0.1';
        $port = self::$config['port'] ?? '3306';
        $database = self::$config['database'] ?? '';
        $charset = self::$config['charset'] ?? 'utf8mb4';
        $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";

        try {
            self::$pdo = new PDO($dsn, (string) self::$config['username'], (string) self::$config['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $exception) {
            app_log('critical', 'Database connection failed', ['message' => $exception->getMessage()]);
            throw $exception;
        }

        return self::$pdo;
    }

    public static function transaction(callable $callback): mixed
    {
        $pdo = self::connection();
        $pdo->beginTransaction();

        try {
            $result = $callback($pdo);
            $pdo->commit();
            return $result;
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }
}

