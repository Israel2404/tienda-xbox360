<?php
/**
 * SOLO PARA DESARROLLO LOCAL (no se sube a Hostinger):
 *   php -S localhost:8000 -t public_html dev-router.php
 * Emula el .htaccess: /api/* → public_html/api/index.php
 */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api(/.*)?$#', $path, $m)) {
    $_GET['_route'] = $m[1] ?? '/';
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require __DIR__ . '/public_html/api/index.php';
    return true;
}
if (preg_match('#^/(app|database|docs)/#', $path) || str_contains($path, '.env')) { http_response_code(403); return true; }
return false; // archivos estáticos
