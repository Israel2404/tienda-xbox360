<?php
declare(strict_types=1);

final class Config
{
    private static ?array $cache = null;

    public static function all(): array
    {
        if (self::$cache === null) {
            self::$cache = [];
            foreach (Database::all('SELECT clave, valor FROM configuracion') as $r) self::$cache[$r['clave']] = $r['valor'];
        }
        return self::$cache;
    }

    public static function get(string $key, string $default = ''): string
    {
        return self::all()[$key] ?? $default;
    }

    public static function iva(): float { return (float) self::get('tasa_iva', '0.16'); }

    public static function clear(): void { self::$cache = null; }
}
