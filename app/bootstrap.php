<?php
/**
 * Arranque del backend: variables de entorno, errores, sesión y autoload.
 * Este directorio (app/) NUNCA debe ser accesible desde el navegador.
 */
declare(strict_types=1);

define('APP_ROOT', __DIR__);

spl_autoload_register(function (string $class): void {
    foreach (['core', 'controllers'] as $dir) {
        $file = APP_ROOT . "/$dir/$class.php";
        if (is_file($file)) { require $file; return; }
    }
});

// .env: se busca primero fuera de public_html (recomendado en Hostinger) y luego junto a app/
Env::load([dirname(APP_ROOT) . '/.env', APP_ROOT . '/.env']);

date_default_timezone_set(Env::get('APP_TIMEZONE', 'America/Mexico_City'));

$debug = Env::get('APP_DEBUG', 'false') === 'true';
ini_set('display_errors', '0');          // nunca mostrar errores internos al usuario
ini_set('log_errors', '1');
@mkdir(APP_ROOT . '/storage/logs', 0750, true);
ini_set('error_log', APP_ROOT . '/storage/logs/php-error.log');
error_reporting(E_ALL);

set_error_handler(function (int $no, string $msg, string $file, int $line): bool {
    throw new ErrorException($msg, 0, $no, $file, $line);
});

set_exception_handler(function (Throwable $e) use ($debug): void {
    if ($e instanceof HttpException) {
        Response::error($e->getMessage(), $e->status, $e->errors);
    }
    error_log('[' . date('c') . '] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if ($e instanceof PDOException) {
        Response::error('No fue posible completar la operación en la base de datos. Intenta de nuevo.', 500);
    }
    Response::error($debug ? $e->getMessage() : 'Ocurrió un error interno. Intenta más tarde.', 500);
});

// ---- Sesión segura ----
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
      || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('R360SESSID');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $https,
    'httponly' => true,
    'samesite' => 'Lax',
]);
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_start();

// Expiración por inactividad
$ttl = (int) Env::get('SESSION_TTL_MIN', '120') * 60;
if (isset($_SESSION['last_seen']) && time() - $_SESSION['last_seen'] > $ttl) {
    $_SESSION = [];
    session_regenerate_id(true);
}
$_SESSION['last_seen'] = time();
