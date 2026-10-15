# Retro 360 Store 🎮

Tienda web de videojuegos de **Xbox 360** con selector de juegos estilo biblioteca de la consola (coverflow en orden alfabético), punto de venta, inventario, reportes y panel administrativo con roles.

> Proyecto Final de Software — Ingeniería en Informática, ITESI.
> Tienda simulada con fines académicos. Xbox y Xbox 360 son marcas de Microsoft; este proyecto no está afiliado.

## Objetivo

Digitalizar la operación de una tienda de juegos retro de Xbox 360: vender en mostrador y en línea con control real de inventario, trazabilidad de cada operación y estadísticas para la toma de decisiones.

## Integrantes

| Nombre | Rol en el equipo | Usuario de Git |
|---|---|---|
| _(completar)_ | Backend / BD | |
| _(completar)_ | Frontend / UX | |
| _(completar)_ | Pruebas / Documentación | |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3 (container queries, 3D transforms), JavaScript (ES2020, sin frameworks), Chart.js 4 (local) |
| Backend | PHP 8.1+ (PDO, sesiones, `password_hash` bcrypt), API REST JSON |
| Base de datos | MySQL 8 / MariaDB 10.4+ |
| Servidor | Apache / LiteSpeed con `.htaccess` (Hostinger) |
| Pruebas | Script Python `tests/api_test.py` (36 casos) |

## Funcionalidades

- **Tienda** (`index.html`): selector 3D estilo Xbox 360 en orden A-Z, salto por letra, filtros por género, buscador, teclado/rueda/swipe, sonidos del menú, detalle del juego, carrito y compra en línea para clientes registrados.
- **Panel** (`panel/`): Dashboard con KPIs y gráficas, Punto de venta, Ventas (filtros por fecha, cancelación), Juegos (CRUD + stock + portadas), Géneros (CRUD), Clientes (CRUD), Inventario (kardex), Reportes con rango de fechas y CSV, Historial (bitácora), Usuarios (CRUD + roles), Configuración y Perfil.

## Estructura

```text
retro360-store/
├── app/                    ← BACKEND (subir FUERA de public_html)
│   ├── bootstrap.php       ← .env, errores, sesión segura, autoload
│   ├── routes.php          ← 45 endpoints con sus permisos
│   ├── core/               ← Router, Request, Response, Auth, Validator, Database, Bitacora, Config
│   └── controllers/        ← Auth, Juego, Genero, Cliente, Usuario, Venta, Movimiento, Bitacora, Dashboard, Reporte, Perfil, Config
├── public_html/            ← FRONTEND (contenido de public_html en Hostinger)
│   ├── index.html          ← tienda / selector estilo Xbox 360
│   ├── api/index.php       ← punto de entrada de la API (/api/...)
│   ├── panel/              ← 13 páginas del panel
│   ├── assets/css|js|img|vendor
│   ├── uploads/            ← portadas subidas (sin ejecución de PHP)
│   └── .htaccess
├── database/  schema.sql · seed.sql · README.md
├── docs/      api.md · database.md · arquitectura.md · reglas-negocio.md · pruebas.md · hostinger.md
├── tests/     api_test.py
├── dev-router.php          ← solo para correr local con php -S
├── .env.example
└── .gitignore
```

## Requisitos

- PHP **8.1 o superior** con extensiones `pdo_mysql`, `mbstring`, `fileinfo` (Hostinger las trae activas).
- MySQL 8 o MariaDB 10.4+.
- Para pruebas: Python 3.

## Instalación local

```bash
git clone <URL-del-repo> retro360-store && cd retro360-store
cp .env.example .env            # edita DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
mysql -u root -e "CREATE DATABASE retro360 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root retro360 < database/schema.sql
mysql -u root retro360 < database/seed.sql
php -S localhost:8000 -t public_html dev-router.php
```

Abrir <http://localhost:8000> (tienda) y <http://localhost:8000/panel/login.html> (panel).
Con XAMPP/Laragon: copia `public_html/` como carpeta del sitio y `app/` junto a ella; el `.htaccess` hace el resto.

## Despliegue en Hostinger

Resumen (guía detallada en [`docs/hostinger.md`](docs/hostinger.md)):

1. hPanel → **Bases de datos** → crea BD y usuario → phpMyAdmin → importa `schema.sql` y luego `seed.sql`.
2. Administrador de archivos → en `domains/tudominio.com/` sube la carpeta **`app/`** y el archivo **`.env`** (junto a `public_html`, no dentro).
3. Sube el **contenido** de `public_html/` dentro de `domains/tudominio.com/public_html/`.
4. hPanel → **Avanzado → Configuración de PHP**: PHP 8.1+.
5. Activa el **SSL** gratuito; el `.htaccess` redirige a HTTPS.

## Variables de entorno

| Variable | Ejemplo | Descripción |
|---|---|---|
| `APP_ENV` | production | Entorno |
| `APP_DEBUG` | false | `true` solo en local: muestra el mensaje real de errores 500 |
| `APP_TIMEZONE` | America/Mexico_City | Zona horaria de fechas y reportes |
| `SESSION_TTL_MIN` | 120 | Minutos de inactividad antes de cerrar sesión |
| `DB_HOST` / `DB_PORT` | localhost / 3306 | Servidor MySQL |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | u123_retro360 … | Credenciales (nunca en el código) |
| `UPLOADS_DIR` | _(vacío)_ | Ruta alterna para portadas |

`.env` está en `.gitignore`; en el repositorio solo va `.env.example`.

## Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@retro360.test | Admin360! |
| Vendedor | vendedor@retro360.test | Vendedor360! |
| Cliente | cliente@retro360.test | Cliente360! |

⚠ Cambia estas contraseñas (Mi perfil) después de publicar en Hostinger.

## Endpoints principales

| Método | Endpoint | Rol |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/registro` · `/api/auth/logout` | Público / autenticado |
| GET | `/api/catalogo` | Público |
| GET·POST·PUT·DELETE | `/api/juegos` · `/api/generos` · `/api/clientes` · `/api/usuarios` | según rol |
| PATCH | `/api/juegos/{id}/stock` | admin |
| POST | `/api/ventas` (transacción) | admin, vendedor, cliente |
| PATCH | `/api/ventas/{id}/cancelar` | admin |
| GET | `/api/dashboard` · `/api/reportes/ventas` · `/api/reportes/juegos` · `/api/reportes/inventario` | admin, vendedor |
| GET | `/api/movimientos` · `/api/bitacora` | admin, vendedor / admin |

Documentación completa: [`docs/api.md`](docs/api.md).

## Pruebas

```bash
python3 tests/api_test.py http://localhost:8000      # 36 casos: auth, RBAC, CRUD, reglas, transacción, seguridad
mysql -u root retro360 < database/seed.sql           # restaurar datos después
```

## Cumplimiento de requerimientos

| Requerimiento | Mínimo | En el proyecto |
|---|---|---|
| Tablas relacionadas | 6 | 10 (3FN, PK/FK, UNIQUE, CHECK, índices) |
| CRUD principales | 3 | 4: Juegos, Géneros, Clientes, Usuarios |
| Endpoints | 12 | 45 |
| Roles | 2 | 3 con permisos verificados en backend |
| Reglas de negocio | 5 | 15 ([docs/reglas-negocio.md](docs/reglas-negocio.md)) |
| Reportes | 2 | 3 (ventas por periodo, juegos/géneros, inventario) con rango de fechas y CSV |
| Gráficas dinámicas | 2 | 6 (dashboard + reportes, datos de la API) |
| Transacciones | 1 | Venta, cancelación, ajuste de stock, registro de cliente, configuración |
| Buscador / filtros / orden / paginación | Sí | En todas las tablas |
| Historial | 1 | Bitácora + kardex de inventario |
| Baja lógica | Sí | Juegos, clientes, usuarios, géneros |
| Seguridad | Sí | bcrypt, sesiones seguras, CSRF, RBAC, PDO parametrizado, `.env`, bloqueo por intentos, errores sin detalles internos |

## Capturas

_(Agregar capturas de: tienda/selector, carrito, login, dashboard, punto de venta, reportes, versión móvil.)_

## Logotipo

El sitio muestra un emblema "360" propio. Para usar tu logotipo coloca `public_html/assets/img/logo.png` y se mostrará automáticamente.

## Git: flujo sugerido para el equipo

Cada integrante trabaja en su rama y hace commits pequeños durante todo el desarrollo:

```text
feat: agrega esquema de base de datos
feat: agrega autenticación con sesiones y bcrypt
feat: agrega CRUD de juegos
feat: agrega venta transaccional
feat: agrega selector estilo Xbox 360
fix: corrige validación de stock
docs: documenta endpoints
```
