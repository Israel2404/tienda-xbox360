# Guía de despliegue en Hostinger (hosting compartido)

Estructura final en el servidor:

```text
/home/u123456789/domains/tudominio.com/
├── .env                 ← credenciales (NO dentro de public_html)
├── app/                 ← backend PHP
└── public_html/         ← contenido de la carpeta public_html del proyecto
    ├── index.html
    ├── .htaccess
    ├── api/
    ├── panel/
    ├── assets/
    └── uploads/
```

## 1. Base de datos

1. hPanel → **Sitios web → Administrar → Bases de datos → Administración**.
2. Crea la base (p. ej. `u123456789_retro360`), un usuario y una contraseña segura. Anótalos.
3. Clic en **Ingresar a phpMyAdmin** → selecciona la base → pestaña **Importar**:
   - primero `database/schema.sql`
   - después `database/seed.sql`
4. Verifica que aparezcan 10 tablas.

## 2. Archivos

1. hPanel → **Archivos → Administrador de archivos**.
2. Entra a `domains/tudominio.com/` (la carpeta que **contiene** a `public_html`).
3. Sube `app/` completa ahí (puedes subir un .zip y usar *Extraer*).
4. Crea ahí mismo el archivo `.env` copiando `.env.example` y llenando:
   ```env
   APP_ENV=production
   APP_DEBUG=false
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=u123456789_retro360
   DB_USER=u123456789_admin
   DB_PASSWORD=tu_contraseña
   ```
5. Entra a `public_html/`, borra el `default.php` de Hostinger y sube **el contenido** de la carpeta `public_html/` del proyecto (incluidos los archivos ocultos `.htaccess`; en el Administrador de archivos actívalos con *Mostrar archivos ocultos*).

> ¿No puedes subir fuera de `public_html`? Sube `app/` y `.env` **dentro** de `public_html/app/`. La API detecta ambas ubicaciones y el `.htaccess` bloquea el acceso web a esa carpeta y al `.env`. Aun así, fuera de `public_html` es lo más seguro.

## 3. PHP y SSL

1. **Avanzado → Configuración de PHP** → versión **8.1 o superior** (recomendado 8.2/8.3). Extensiones `pdo_mysql`, `mbstring` y `fileinfo` activas.
2. **Seguridad → SSL** → instala el certificado gratuito. El `.htaccess` fuerza HTTPS y la cookie de sesión se marca `Secure` automáticamente.

## 4. Verificación

| Prueba | Resultado esperado |
|---|---|
| `https://tudominio.com/` | Aparece el selector de juegos |
| `https://tudominio.com/api/catalogo` | JSON con 64 juegos |
| `https://tudominio.com/api/juegos` | `{"error":true,"mensaje":"Debes iniciar sesión.","codigo":401}` |
| `https://tudominio.com/.env` o `/app/bootstrap.php` | 403 / 404 (nunca el contenido) |
| `https://tudominio.com/panel/login.html` | Entra con admin@retro360.test |

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| "Backend no encontrado: sube la carpeta app/" | `app/` no está junto a `public_html` ni dentro de él. |
| "No fue posible completar la operación en la base de datos" | Revisa `DB_*` en `.env`. En Hostinger `DB_HOST` es `localhost` y el nombre/usuario llevan el prefijo `u123456789_`. Detalle del error en `app/storage/logs/php-error.log`. |
| `/api/...` da 404 de Hostinger | Falta `public_html/api/.htaccess` (archivo oculto). |
| "La sesión expiró o el token de seguridad no es válido" | Recarga la página; si persiste, verifica que el sitio abra siempre con el mismo dominio (con o sin `www`). |
| Error al subir portadas | Permisos de `public_html/uploads/portadas` en 755. |
