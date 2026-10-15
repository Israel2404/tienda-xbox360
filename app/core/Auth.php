<?php
declare(strict_types=1);

/** Autenticación por sesión + autorización por roles (RBAC) + token CSRF. */
final class Auth
{
    public const ADMIN = 'admin';
    public const VENDEDOR = 'vendedor';
    public const CLIENTE = 'cliente';
    public const STAFF = [self::ADMIN, self::VENDEDOR];

    private static ?array $user = null;

    /** Usuario autenticado (se revalida contra la BD en cada petición: si lo desactivan, pierde acceso). */
    public static function user(): ?array
    {
        if (self::$user) return self::$user;
        $id = $_SESSION['uid'] ?? null;
        if (!$id) return null;
        $u = Database::one(
            'SELECT u.id, u.nombre, u.email, u.activo, r.clave AS rol, r.nombre AS rol_nombre, c.id AS cliente_id
               FROM usuarios u JOIN roles r ON r.id = u.rol_id
               LEFT JOIN clientes c ON c.usuario_id = u.id
              WHERE u.id = ?', [$id]);
        if (!$u || !$u['activo']) { self::logout(); return null; }
        unset($u['activo']);
        return self::$user = $u;
    }

    public static function id(): int { return (int) self::user()['id']; }

    /**
     * Verifica: autenticado → rol → permiso. Si $roles es null basta con estar autenticado.
     */
    public static function require(?array $roles = null): array
    {
        $u = self::user();
        if (!$u) throw HttpException::unauthorized();
        if ($roles !== null && !in_array($u['rol'], $roles, true)) throw HttpException::forbidden();
        return $u;
    }

    public static function login(array $user): void
    {
        session_regenerate_id(true);           // evita fijación de sesión
        $_SESSION['uid'] = (int) $user['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        self::$user = null;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) session_regenerate_id(true);
        self::$user = null;
    }

    public static function csrfToken(): string
    {
        if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
        return $_SESSION['csrf'];
    }

    /** Toda petición que modifica datos debe traer el encabezado X-CSRF-Token. */
    public static function verifyCsrf(): void
    {
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!$sent || empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
            throw new HttpException('La sesión expiró o el token de seguridad no es válido. Recarga la página.', 403);
        }
    }
}
