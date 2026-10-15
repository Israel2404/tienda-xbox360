<?php
/**
 * Punto de entrada único de la API REST  →  /api/...
 * Localiza la carpeta app/ (backend):
 *   1) Recomendado en Hostinger: fuera de public_html   (…/domains/tudominio.com/app)
 *   2) Alternativa: dentro de public_html               (public_html/app, protegida por .htaccess)
 */
declare(strict_types=1);

$PUBLIC_DIR = dirname(__DIR__);
foreach ([dirname($PUBLIC_DIR) . '/app', $PUBLIC_DIR . '/app'] as $candidate) {
    if (is_file("$candidate/bootstrap.php")) { $APP_DIR = $candidate; break; }
}
if (empty($APP_DIR)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => true, 'mensaje' => 'Backend no encontrado: sube la carpeta app/.', 'codigo' => 500]);
    exit;
}
require "$APP_DIR/bootstrap.php";

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

// Ruta solicitada relativa a /api
$uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
$path = $_GET['_route'] ?? (str_starts_with($uri, $base) ? substr($uri, strlen($base)) : $uri);
$path = preg_replace('#^/index\.php#', '', $path);

$router = require "$APP_DIR/routes.php";
$router->dispatch(new Request($path));
