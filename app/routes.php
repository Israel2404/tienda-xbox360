<?php
declare(strict_types=1);

/**
 * Tabla de rutas de la API REST.
 * Tercer parámetro = permisos: Router::PUBLIC | null (cualquier usuario autenticado) | [roles]
 */
$A = [Auth::ADMIN];
$S = Auth::STAFF;                                   // admin + vendedor
$ALL = [Auth::ADMIN, Auth::VENDEDOR, Auth::CLIENTE];
$P = Router::PUBLIC;

$r = new Router();

// Autenticación
$r->post('/auth/login',    [AuthController::class, 'login'], $P);
$r->post('/auth/registro', [AuthController::class, 'registro'], $P);
$r->get('/auth/me',        [AuthController::class, 'me'], $P);
$r->post('/auth/logout',   [AuthController::class, 'logout'], $ALL);

// Tienda pública (selector estilo Xbox 360)
$r->get('/catalogo', [JuegoController::class, 'catalogo'], $P);

// Juegos (productos) — CRUD 1
$r->get('/juegos',                [JuegoController::class, 'index'], $S);
$r->get('/juegos/{id}',           [JuegoController::class, 'show'], $S);
$r->post('/juegos',               [JuegoController::class, 'store'], $A);
$r->put('/juegos/{id}',           [JuegoController::class, 'update'], $A);
$r->patch('/juegos/{id}/stock',   [JuegoController::class, 'stock'], $A);
$r->post('/juegos/{id}/portada',  [JuegoController::class, 'portada'], $A);
$r->delete('/juegos/{id}',        [JuegoController::class, 'destroy'], $A);

// Géneros (categorías) — CRUD 2
$r->get('/generos',         [GeneroController::class, 'index'], $S);
$r->get('/generos/{id}',    [GeneroController::class, 'show'], $S);
$r->post('/generos',        [GeneroController::class, 'store'], $A);
$r->put('/generos/{id}',    [GeneroController::class, 'update'], $A);
$r->delete('/generos/{id}', [GeneroController::class, 'destroy'], $A);

// Clientes — CRUD 3
$r->get('/clientes',         [ClienteController::class, 'index'], $S);
$r->get('/clientes/{id}',    [ClienteController::class, 'show'], $S);
$r->post('/clientes',        [ClienteController::class, 'store'], $S);
$r->put('/clientes/{id}',    [ClienteController::class, 'update'], $S);
$r->delete('/clientes/{id}', [ClienteController::class, 'destroy'], $A);

// Usuarios — CRUD 4 (solo administrador)
$r->get('/roles',                  [UsuarioController::class, 'roles'], $A);
$r->get('/usuarios',               [UsuarioController::class, 'index'], $A);
$r->get('/usuarios/{id}',          [UsuarioController::class, 'show'], $A);
$r->post('/usuarios',              [UsuarioController::class, 'store'], $A);
$r->put('/usuarios/{id}',          [UsuarioController::class, 'update'], $A);
$r->patch('/usuarios/{id}/estado', [UsuarioController::class, 'estado'], $A);
$r->delete('/usuarios/{id}',       [UsuarioController::class, 'destroy'], $A);

// Ventas (transaccional)
$r->get('/ventas',                 [VentaController::class, 'index'], $ALL);   // el cliente solo ve las suyas
$r->get('/ventas/{id}',            [VentaController::class, 'show'], $ALL);
$r->post('/ventas',                [VentaController::class, 'store'], $ALL);   // mostrador (staff) u online (cliente)
$r->patch('/ventas/{id}/cancelar', [VentaController::class, 'cancelar'], $A);
$r->delete('/ventas/{id}',         [VentaController::class, 'destroy'], $A);

// Inventario, historial, dashboard, reportes
$r->get('/movimientos',          [MovimientoController::class, 'index'], $S);
$r->get('/bitacora',             [BitacoraController::class, 'index'], $A);
$r->get('/dashboard',            [DashboardController::class, 'index'], $S);
$r->get('/reportes/ventas',      [ReporteController::class, 'ventas'], $S);
$r->get('/reportes/juegos',      [ReporteController::class, 'juegos'], $S);
$r->get('/reportes/inventario',  [ReporteController::class, 'inventario'], $S);

// Perfil y configuración
$r->get('/perfil',            [PerfilController::class, 'show'], $ALL);
$r->put('/perfil',            [PerfilController::class, 'update'], $ALL);
$r->patch('/perfil/password', [PerfilController::class, 'password'], $ALL);
$r->get('/config',            [ConfigController::class, 'show'], $A);
$r->put('/config',            [ConfigController::class, 'update'], $A);

return $r;
