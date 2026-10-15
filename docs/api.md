# Documentación de la API REST — Retro 360 Store

- **URL base:** `https://tudominio.com/api` (local: `http://localhost:8000/api`)
- **Formato:** JSON (`Content-Type: application/json`), UTF-8. Fechas `AAAA-MM-DD` y `AAAA-MM-DD HH:MM:SS`.
- **Autenticación:** sesión PHP (cookie `R360SESSID`, `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS).
- **CSRF:** toda petición `POST / PUT / PATCH / DELETE` (excepto login y registro) debe enviar el encabezado `X-CSRF-Token` con el token que devuelven `GET /auth/me` y `POST /auth/login`.
- **Autorización (RBAC):** cada ruta declara sus roles en `app/routes.php`; el router verifica *autenticado → rol → permiso* antes de ejecutar el controlador.

## Roles

| Clave | Nombre | Resumen de permisos |
|---|---|---|
| `admin` | Administrador | Todo: catálogo, inventario, usuarios, cancelaciones, bitácora, configuración |
| `vendedor` | Vendedor | Punto de venta, clientes (sin baja), consulta de catálogo/inventario, reportes, dashboard |
| `cliente` | Cliente | Compra en línea desde la tienda, consulta solo sus propias compras, su perfil |

## Formato de error

```json
{ "error": true, "mensaje": "Revisa los datos capturados.", "codigo": 422,
  "errores": { "precio": "Debe ser mayor a 0." } }
```

| Código | Cuándo se usa |
|---|---|
| 200 | Operación correcta |
| 201 | Recurso creado (juego, género, cliente, usuario, venta, registro) |
| 400 | JSON mal formado, identificador inválido |
| 401 | Sin sesión / credenciales incorrectas |
| 403 | Rol sin permiso, token CSRF inválido, cuenta desactivada |
| 404 | Recurso o endpoint inexistente |
| 405 | Método HTTP no permitido para la ruta |
| 409 | Conflicto de negocio: duplicados, stock insuficiente, venta ya cancelada, eliminar lo que tiene historial |
| 422 | Validación de campos |
| 429 | Cuenta bloqueada temporalmente por intentos fallidos |
| 500 | Error interno (mensaje genérico; el detalle solo va al log del servidor) |

## Paginación, búsqueda y orden (listados)

`?page=1&limit=10&q=texto&sort=campo&dir=asc|desc` → respuesta:

```json
{ "pagina": 2, "limite": 10, "total": 64, "totalPaginas": 7, "datos": [ … ] }
```

`limit` máximo 100. `sort` solo acepta los campos de la lista blanca de cada recurso.

---

## 1. Autenticación

| Método | URL | Body | Respuesta | Códigos | Permiso |
|---|---|---|---|---|---|
| GET | `/auth/me` | — | `{usuario \| null, csrf}` | 200 | Público |
| POST | `/auth/login` | `{email, password}` | `{usuario, csrf}` | 200, 401, 403, 422, 429 | Público |
| POST | `/auth/registro` | `{nombre, email, password, gamertag?, telefono?}` | `{usuario, csrf}` | 201, 409, 422 | Público (crea rol cliente) |
| POST | `/auth/logout` | — | `{mensaje, csrf}` | 200, 401 | Autenticado |

Ejemplo:

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@retro360.test", "password": "Admin360!" }
```
```json
{ "usuario": { "id": 1, "nombre": "Israel Admin", "email": "admin@retro360.test", "rol": "admin",
  "rol_nombre": "Administrador", "cliente_id": null }, "csrf": "9f2c…" }
```

## 2. Catálogo público (tienda / selector)

| Método | URL | Parámetros | Respuesta | Permiso |
|---|---|---|---|---|
| GET | `/catalogo` | `q`, `genero` | `{tienda, tasa_iva, total, generos[], datos[]}` juegos activos **ordenados A-Z**, con `existencia` = `disponible \| pocas \| agotado` (no expone el stock exacto) | Público |

## 3. Juegos (CRUD)

| Método | URL | Parámetros / Body | Respuesta | Códigos | Permiso |
|---|---|---|---|---|---|
| GET | `/juegos` | `q` (título, SKU, desarrollador, ID), `genero`, `clasificacion`, `estado` = `activos\|inactivos\|stock_bajo\|agotados\|todos`, `sort` = `titulo\|precio\|stock\|anio\|genero\|sku\|creado`, `dir`, `page`, `limit` | Página de juegos | 200 | admin, vendedor |
| GET | `/juegos/{id}` | — | Juego + últimos 10 `movimientos` + `vendidos` | 200, 404 | admin, vendedor |
| POST | `/juegos` | `{sku, titulo, genero_id, clasificacion, precio, stock, stock_minimo, desarrollador?, anio_lanzamiento?, descripcion?}` | Juego creado | 201, 409 (SKU), 422 | admin |
| PUT | `/juegos/{id}` | Igual que POST sin `stock`, más `activo` | Juego actualizado | 200, 404, 409, 422 | admin |
| PATCH | `/juegos/{id}/stock` | `{tipo: entrada\|salida\|ajuste, cantidad, motivo}` | Juego con stock nuevo | 200, 404, 409 (stock negativo), 422 | admin |
| POST | `/juegos/{id}/portada` | `multipart/form-data`, campo `portada` (JPG/PNG/WEBP ≤ 2 MB) | Juego con `portada_url` | 200, 404, 422 | admin |
| DELETE | `/juegos/{id}` | — | `{mensaje}` — **baja lógica** (`activo = 0`) | 200, 404, 409 | admin |

## 4. Géneros (CRUD)

| Método | URL | Body | Códigos | Permiso |
|---|---|---|---|---|
| GET | `/generos?q=&estado=&sort=nombre\|juegos\|id` | — | 200 | admin, vendedor |
| GET | `/generos/{id}` | — | 200, 404 | admin, vendedor |
| POST | `/generos` | `{nombre, descripcion?}` | 201, 409, 422 | admin |
| PUT | `/generos/{id}` | `{nombre, descripcion?, activo?}` | 200, 404, 409, 422 | admin |
| DELETE | `/generos/{id}` | — (sin historial: se elimina; con historial: se desactiva; con juegos activos: 409) | 200, 404, 409 | admin |

## 5. Clientes (CRUD)

| Método | URL | Body | Códigos | Permiso |
|---|---|---|---|---|
| GET | `/clientes?q=&estado=&sort=nombre\|compras\|total\|creado` | — | 200 | admin, vendedor |
| GET | `/clientes/{id}` | — (incluye `ultimas_compras`) | 200, 404 | admin, vendedor |
| POST | `/clientes` | `{nombre, email?, telefono?, gamertag?}` | 201, 409, 422 | admin, vendedor |
| PUT | `/clientes/{id}` | `{nombre, email?, telefono?, gamertag?, activo?}` | 200, 404, 409, 422 | admin, vendedor |
| DELETE | `/clientes/{id}` | — baja lógica | 200, 404, 409 | admin |

## 6. Usuarios y roles (CRUD, solo administrador)

| Método | URL | Body | Códigos |
|---|---|---|---|
| GET | `/roles` | — | 200 |
| GET | `/usuarios?q=&rol=&estado=&sort=nombre\|email\|rol\|acceso` | — | 200 |
| GET | `/usuarios/{id}` | — | 200, 404 |
| POST | `/usuarios` | `{nombre, email, password, rol_id}` | 201, 409, 422 |
| PUT | `/usuarios/{id}` | `{nombre, email, rol_id, password?}` | 200, 404, 409, 422 |
| PATCH | `/usuarios/{id}/estado` | `{activo: true\|false}` | 200, 404, 409 |
| DELETE | `/usuarios/{id}` | — baja lógica | 200, 404, 409 |

## 7. Ventas (operación transaccional)

| Método | URL | Parámetros / Body | Códigos | Permiso |
|---|---|---|---|---|
| GET | `/ventas` | `q` (folio/cliente), `desde`, `hasta`, `estado`, `canal`, `metodo`, `vendedor`, `sort` = `fecha\|total\|folio\|cliente`, `dir`, `page`, `limit` → página + `resumen {ventas, importe}` | 200, 422 | admin, vendedor; cliente (solo las suyas) |
| GET | `/ventas/{id}` | Venta + `detalle[]` | 200, 404 | admin, vendedor; cliente (solo las suyas) |
| POST | `/ventas` | `{items: [{juego_id, cantidad}], metodo_pago, cliente_id?}` | 201, 404, 409, 422 | admin, vendedor (mostrador); cliente (online) |
| PATCH | `/ventas/{id}/cancelar` | `{motivo}` | 200, 404, 409, 422 | admin |
| DELETE | `/ventas/{id}` | Siempre 409: las ventas no se eliminan | 404, 409 | admin |

Ejemplo de venta:

```http
POST /api/ventas
X-CSRF-Token: 9f2c…
Content-Type: application/json

{ "metodo_pago": "efectivo", "cliente_id": 3,
  "items": [ { "juego_id": 32, "cantidad": 1 }, { "juego_id": 34, "cantidad": 2 } ] }
```
```json
{ "id": 185, "folio": "R360-260930-000185", "canal": "mostrador", "metodo_pago": "efectivo",
  "tasa_impuesto": "0.1600", "subtotal": "1057.00", "impuesto": "169.12", "total": "1226.12",
  "estado": "completada", "cliente": "Ana López", "vendedor": "Carla Vendedora",
  "detalle": [ { "juego_id": 32, "titulo": "Grand Theft Auto V", "cantidad": 1, "precio_unitario": "499.00", "importe": "499.00" } … ] }
```

Error típico de regla de negocio:

```json
{ "error": true, "codigo": 409,
  "mensaje": "El producto \"Bayonetta\" no tiene existencias suficientes (disponibles: 1)." }
```

## 8. Inventario, historial, dashboard y reportes

| Método | URL | Parámetros | Descripción | Permiso |
|---|---|---|---|---|
| GET | `/movimientos` | `q`, `tipo`, `juego`, `desde`, `hasta`, `sort` = `fecha\|juego\|cantidad\|tipo`, `page`, `limit` | Kardex de entradas, salidas, ajustes, ventas y cancelaciones | admin, vendedor |
| GET | `/bitacora` | `accion`, `entidad`, `usuario`, `desde`, `hasta`, `page`, `limit` | Historial de operaciones con estado anterior/nuevo | admin |
| GET | `/dashboard` | — | KPIs, ventas 30 días, ventas por género, stock bajo, top 5, últimas ventas, actividad | admin, vendedor |
| GET | `/reportes/ventas` | `desde`, `hasta` (máx. 1 año), `agrupar` = `dia\|semana\|mes` | **Reporte 1:** serie por periodo, resumen, por canal, por método de pago, por vendedor | admin, vendedor |
| GET | `/reportes/juegos` | `desde`, `hasta`, `limite` (5-50) | **Reporte 2:** top juegos, ventas por género, juegos sin ventas | admin, vendedor |
| GET | `/reportes/inventario` | — | **Reporte 3:** inventario valorizado por género y alertas | admin, vendedor |

## 9. Perfil y configuración

| Método | URL | Body | Códigos | Permiso |
|---|---|---|---|---|
| GET | `/perfil` | — | 200 | Autenticado |
| PUT | `/perfil` | `{nombre}` | 200, 422 | Autenticado |
| PATCH | `/perfil/password` | `{actual, nueva}` | 200, 422 | Autenticado |
| GET | `/config` | — | 200 | admin |
| PUT | `/config` | `{nombre_tienda, tasa_iva (0–0.30), stock_minimo_default, max_unidades_por_linea}` | 200, 422 | admin |

**Total: 45 endpoints funcionales** (definidos en `app/routes.php`).
