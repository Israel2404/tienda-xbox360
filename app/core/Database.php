<?php
declare(strict_types=1);

/** Conexión PDO única con consultas parametrizadas (protección contra SQL Injection). */
final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo) return self::$pdo;
        if (!Env::get('DB_NAME')) {
            throw new HttpException('Falta configurar la base de datos: crea el archivo .env (copia de .env.example) junto a la carpeta app/.', 500);
        }
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            Env::get('DB_HOST', 'localhost'),
            Env::get('DB_PORT', '3306'),
            Env::get('DB_NAME', '')
        );
        self::$pdo = new PDO($dsn, Env::get('DB_USER', ''), Env::get('DB_PASSWORD', ''), [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_STRINGIFY_FETCHES  => false,
        ]);
        self::$pdo->exec("SET time_zone = '" . date('P') . "'");
        return self::$pdo;
    }

    public static function all(string $sql, array $params = []): array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        $row = $st->fetch();
        return $row === false ? null : $row;
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->fetchColumn();
    }

    public static function exec(string $sql, array $params = []): int
    {
        $st = self::pdo()->prepare($sql);
        $st->execute($params);
        return $st->rowCount();
    }

    public static function insert(string $sql, array $params = []): int
    {
        self::exec($sql, $params);
        return (int) self::pdo()->lastInsertId();
    }

    /** Ejecuta $fn dentro de una transacción: COMMIT si todo sale bien, ROLLBACK si algo falla. */
    public static function transaction(callable $fn): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $fn($pdo);
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Paginación estándar: devuelve {pagina, limite, total, totalPaginas, datos}.
     * $from incluye FROM + JOIN + WHERE; $order ya viene validado por lista blanca.
     */
    public static function paginate(string $select, string $from, array $params, string $order, int $page, int $limit): array
    {
        $total = (int) self::value("SELECT COUNT(*) $from", $params);
        $pages = max(1, (int) ceil($total / $limit));
        $page  = min($page, $pages);
        $offset = ($page - 1) * $limit;
        $rows = self::all("SELECT $select $from ORDER BY $order LIMIT $limit OFFSET $offset", $params);
        return ['pagina' => $page, 'limite' => $limit, 'total' => $total, 'totalPaginas' => $pages, 'datos' => $rows];
    }
}
