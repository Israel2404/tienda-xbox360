<?php
declare(strict_types=1);

/** Lector mínimo de archivos .env (sin dependencias, compatible con hosting compartido). */
final class Env
{
    private static array $vars = [];

    public static function load(array $paths): void
    {
        foreach ($paths as $path) {
            if (!is_file($path)) continue;
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
                [$k, $v] = array_map('trim', explode('=', $line, 2));
                if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[-1] === $v[0]) $v = substr($v, 1, -1);
                self::$vars[$k] = $v;
            }
            return;
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::$vars[$key] ?? (getenv($key) !== false ? getenv($key) : $default);
    }
}
