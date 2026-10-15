# Base de datos — Retro 360 Store

Motor: **MySQL 8 / MariaDB 10.4+** (InnoDB, `utf8mb4`). Scripts: [`database/schema.sql`](../database/schema.sql) (estructura desde cero) y [`database/seed.sql`](../database/seed.sql) (datos de prueba).

## Diagrama entidad-relación

```mermaid
erDiagram
    roles ||--o{ usuarios : "tiene"
    usuarios ||--o| clientes : "cuenta en línea"
    generos ||--o{ juegos : "clasifica"
    usuarios ||--o{ ventas : "registra"
    usuarios ||--o{ ventas : "cancela"
    clientes ||--o{ ventas : "compra"
    ventas ||--|{ venta_detalle : "contiene"
    juegos ||--o{ venta_detalle : "se vende en"
    juegos ||--o{ movimientos_inventario : "afecta"
    usuarios ||--o{ movimientos_inventario : "realiza"
    ventas ||--o{ movimientos_inventario : "origina"
    usuarios ||--o{ bitacora : "genera"

    roles { tinyint id PK; varchar clave UK; varchar nombre; varchar descripcion }
    usuarios { int id PK; tinyint rol_id FK; varchar nombre; varchar email UK; varchar password_hash; bool activo; tinyint intentos_fallidos; datetime bloqueado_hasta; datetime ultimo_acceso }
    generos { smallint id PK; varchar nombre UK; varchar descripcion; bool activo }
    juegos { int id PK; varchar sku UK; varchar titulo; smallint genero_id FK; varchar desarrollador; smallint anio_lanzamiento; enum clasificacion; decimal precio; int stock; int stock_minimo; varchar portada_url; bool activo }
    clientes { int id PK; int usuario_id FK_UK; varchar nombre; varchar email UK; varchar telefono; varchar gamertag; bool activo }
    ventas { int id PK; varchar folio UK; int usuario_id FK; int cliente_id FK; enum canal; enum metodo_pago; decimal tasa_impuesto; decimal subtotal; decimal impuesto; decimal total; enum estado; int cancelada_por FK; varchar motivo_cancelacion; datetime cancelada_at }
    venta_detalle { int id PK; int venta_id FK; int juego_id FK; int cantidad; decimal precio_unitario }
    movimientos_inventario { int id PK; int juego_id FK; int usuario_id FK; int venta_id FK; enum tipo; int cantidad; int stock_anterior; int stock_nuevo; varchar motivo }
    bitacora { bigint id PK; int usuario_id FK; varchar accion; varchar entidad; int entidad_id; longtext datos_antes; longtext datos_despues; varchar ip }
    configuracion { varchar clave PK; varchar valor; varchar descripcion }
```

> GitHub y VS Code muestran este diagrama automáticamente. Para el PDF puedes exportarlo desde https://mermaid.live o dibujarlo en draw.io / MySQL Workbench (Database → Reverse Engineer).

## Cardinalidades principales

| Relación | Cardinalidad | Regla referencial |
|---|---|---|
| roles → usuarios | 1 : N | `ON DELETE RESTRICT` |
| usuarios → clientes | 1 : 0..1 | `ON DELETE SET NULL` (el cliente conserva sus compras) |
| generos → juegos | 1 : N | `RESTRICT` |
| clientes → ventas | 1 : N | `RESTRICT` |
| ventas → venta_detalle | 1 : 1..N | `RESTRICT` (las ventas no se borran) |
| juegos → venta_detalle | 1 : N | `RESTRICT` |
| juegos / ventas / usuarios → movimientos_inventario | 1 : N | `RESTRICT` |
| usuarios → bitacora | 1 : N | `SET NULL` |

## Normalización (3FN)

- **1FN:** todos los atributos son atómicos; las líneas de una venta están en `venta_detalle` (no hay listas dentro de un campo).
- **2FN:** `venta_detalle` tiene PK propia y la dupla (`venta_id`, `juego_id`) es única; ningún atributo depende de solo una parte de ella.
- **3FN:** el nombre del género, del rol o del cliente no se repiten en otras tablas; se obtienen por llave foránea.
- **Decisiones deliberadas (documentadas):**
  - `venta_detalle.precio_unitario` guarda el precio **histórico** (el precio del juego puede cambiar después). No es redundancia: es un dato distinto.
  - `ventas.subtotal/impuesto/total` y `tasa_impuesto` son una **fotografía contable** del momento de la venta; si cambia la tasa de IVA, las ventas pasadas no deben recalcularse.
  - El importe de cada línea **no** se guarda (se calcula `cantidad × precio_unitario`).
  - `stock_anterior/stock_nuevo` en movimientos funcionan como kardex auditable.

## Restricciones de integridad

- `CHECK`: `precio > 0`, `stock >= 0`, `stock_minimo >= 0`, `cantidad > 0`, `total >= 0`, `stock_nuevo >= 0`, año entre 2005 y 2016 (generación Xbox 360).
- `UNIQUE`: `roles.clave`, `usuarios.email`, `generos.nombre`, `juegos.sku`, `clientes.email`, `clientes.usuario_id`, `ventas.folio`, (`venta_id`, `juego_id`).
- `ENUM` para dominios cerrados: clasificación ESRB, canal, método de pago, estado de venta, tipo de movimiento.
- **Índices:** título, género y estado de juegos; fecha y estado de ventas; fecha, juego y tipo de movimientos; fecha y entidad de bitácora (consultas de reportes, filtros y búsquedas).

## Diccionario de datos

### roles
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | TINYINT UNSIGNED PK AI | No | Identificador |
| clave | VARCHAR(20) UK | No | `admin`, `vendedor`, `cliente` (se usa en el código para permisos) |
| nombre | VARCHAR(50) | No | Nombre visible |
| descripcion | VARCHAR(255) | Sí | Qué puede hacer el rol |

### usuarios
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | INT UNSIGNED PK AI | No | Identificador |
| rol_id | TINYINT UNSIGNED FK→roles | No | Rol del usuario |
| nombre | VARCHAR(100) | No | Nombre completo |
| email | VARCHAR(150) UK | No | Usuario de acceso (minúsculas) |
| password_hash | VARCHAR(255) | No | Hash **bcrypt** (`password_hash`) — nunca texto plano |
| activo | TINYINT(1) | No | Baja lógica (1 activo / 0 inactivo) |
| intentos_fallidos | TINYINT UNSIGNED | No | Contador para bloqueo |
| bloqueado_hasta | DATETIME | Sí | Fin del bloqueo temporal (15 min tras 5 fallos) |
| ultimo_acceso | DATETIME | Sí | Último inicio de sesión |
| created_at / updated_at | DATETIME | No | Auditoría |

### generos
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | SMALLINT UNSIGNED PK AI | No | Identificador |
| nombre | VARCHAR(60) UK | No | Acción, Disparos, Rol… |
| descripcion | VARCHAR(255) | Sí | |
| activo | TINYINT(1) | No | Baja lógica |
| created_at / updated_at | DATETIME | No | |

### juegos
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | INT UNSIGNED PK AI | No | Identificador |
| sku | VARCHAR(20) UK | No | Código de producto (X360-0001) |
| titulo | VARCHAR(150) | No | Nombre del juego (orden alfabético en la tienda) |
| genero_id | SMALLINT UNSIGNED FK→generos | No | Categoría |
| desarrollador | VARCHAR(100) | Sí | Estudio |
| anio_lanzamiento | SMALLINT UNSIGNED | Sí | 2005–2016 |
| clasificacion | ENUM('E','E10+','T','M') | No | ESRB |
| descripcion | TEXT | Sí | Sinopsis |
| precio | DECIMAL(10,2) | No | Precio sin IVA, > 0 |
| stock | INT | No | Existencias, ≥ 0 |
| stock_minimo | INT | No | Umbral de alerta |
| portada_url | VARCHAR(255) | Sí | Ruta de la portada subida (si no hay, la tienda genera una) |
| activo | TINYINT(1) | No | Baja lógica |
| created_at / updated_at | DATETIME | No | |

### clientes
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | INT UNSIGNED PK AI | No | Identificador |
| usuario_id | INT UNSIGNED FK→usuarios UK | Sí | Cuenta para comprar en línea |
| nombre | VARCHAR(100) | No | |
| email | VARCHAR(150) UK | Sí | |
| telefono | VARCHAR(20) | Sí | |
| gamertag | VARCHAR(30) | Sí | Gamertag de Xbox |
| activo | TINYINT(1) | No | Baja lógica |
| created_at / updated_at | DATETIME | No | |

### ventas
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | INT UNSIGNED PK AI | No | Identificador |
| folio | VARCHAR(30) UK | No | `R360-AAMMDD-000123`, generado por el servidor |
| usuario_id | INT UNSIGNED FK→usuarios | No | Quién registró la venta |
| cliente_id | INT UNSIGNED FK→clientes | Sí | Comprador (por defecto "Público en general") |
| canal | ENUM('mostrador','online') | No | Punto de venta o tienda web |
| metodo_pago | ENUM('efectivo','tarjeta','transferencia') | No | Simulado |
| tasa_impuesto | DECIMAL(5,4) | No | IVA aplicado (0.16) |
| subtotal, impuesto, total | DECIMAL(12,2) | No | Calculados en el servidor |
| estado | ENUM('completada','cancelada') | No | |
| cancelada_por | INT UNSIGNED FK→usuarios | Sí | Administrador que canceló |
| motivo_cancelacion | VARCHAR(255) | Sí | Obligatorio al cancelar |
| cancelada_at | DATETIME | Sí | |
| created_at | DATETIME | No | Fecha de la venta |

### venta_detalle
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | INT UNSIGNED PK AI | No | |
| venta_id | INT UNSIGNED FK→ventas | No | |
| juego_id | INT UNSIGNED FK→juegos | No | |
| cantidad | INT UNSIGNED | No | > 0 |
| precio_unitario | DECIMAL(10,2) | No | Precio histórico |

### movimientos_inventario
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | INT UNSIGNED PK AI | No | |
| juego_id | FK→juegos | No | |
| usuario_id | FK→usuarios | No | Responsable |
| venta_id | FK→ventas | Sí | Si el movimiento lo originó una venta o cancelación |
| tipo | ENUM('entrada','salida','ajuste','venta','cancelacion') | No | |
| cantidad | INT | No | Con signo (+ entra, − sale) |
| stock_anterior / stock_nuevo | INT | No | Kardex |
| motivo | VARCHAR(255) | Sí | |
| created_at | DATETIME | No | |

### bitacora
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| id | BIGINT UNSIGNED PK AI | No | |
| usuario_id | FK→usuarios | Sí | Quién hizo la operación |
| accion | VARCHAR(40) | No | crear, actualizar, baja, cancelar, login, bloqueo… |
| entidad / entidad_id | VARCHAR(40) / INT | No / Sí | Registro afectado |
| datos_antes / datos_despues | LONGTEXT (JSON) | Sí | Estado anterior y nuevo |
| ip | VARCHAR(45) | Sí | IP de origen |
| created_at | DATETIME | No | |

### configuracion
| Campo | Tipo | Nulo | Descripción |
|---|---|---|---|
| clave | VARCHAR(40) PK | No | `nombre_tienda`, `tasa_iva`, `stock_minimo_default`, `max_unidades_por_linea` |
| valor | VARCHAR(255) | No | |
| descripcion | VARCHAR(255) | Sí | |
| updated_at | DATETIME | No | |

## Datos de prueba (seed.sql)

- 3 roles, 4 usuarios (contraseñas con bcrypt), 12 géneros, **64 juegos de Xbox 360**, 8 clientes.
- ~180 ventas distribuidas en los últimos 100 días (algunas canceladas) con su detalle y **movimientos de inventario consistentes** con el stock final, para que el dashboard y los reportes muestren datos reales.
