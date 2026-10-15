# Base de datos

| Archivo | Uso |
|---|---|
| `schema.sql` | Crea las 10 tablas desde cero (borra las existentes). |
| `seed.sql` | Datos de prueba: roles, usuarios, 64 juegos de Xbox 360, clientes y ~180 ventas históricas. |

**Local:**

```bash
mysql -u root -e "CREATE DATABASE retro360 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root retro360 < database/schema.sql
mysql -u root retro360 < database/seed.sql
```

**Hostinger:** hPanel → *Bases de datos* → *phpMyAdmin* → selecciona tu BD → pestaña **Importar** → primero `schema.sql`, luego `seed.sql`.

Detalle del modelo, diagrama ER y diccionario de datos: [`docs/database.md`](../docs/database.md).
