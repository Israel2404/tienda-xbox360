-- =============================================================
--  Retro 360 Store — Esquema de base de datos
--  Motor: MySQL 8.0+ / MariaDB 10.4+   Charset: utf8mb4
--  Crea la base desde cero. Ejecutar antes de seed.sql
--  (En Hostinger: phpMyAdmin > seleccionar la BD > Importar)
-- =============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS bitacora;
DROP TABLE IF EXISTS movimientos_inventario;
DROP TABLE IF EXISTS venta_detalle;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS juegos;
DROP TABLE IF EXISTS generos;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS configuracion;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------- Roles (RBAC) ----------
CREATE TABLE roles (
  id          TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  clave       VARCHAR(20)  NOT NULL,
  nombre      VARCHAR(50)  NOT NULL,
  descripcion VARCHAR(255) NULL,
  CONSTRAINT uq_roles_clave UNIQUE (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Usuarios ----------
CREATE TABLE usuarios (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rol_id            TINYINT UNSIGNED NOT NULL,
  nombre            VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  activo            TINYINT(1)   NOT NULL DEFAULT 1,
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME NULL,
  ultimo_acceso     DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_usuarios_rol (rol_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Géneros (categorías) ----------
CREATE TABLE generos (
  id          SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(60)  NOT NULL,
  descripcion VARCHAR(255) NULL,
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_generos_nombre UNIQUE (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Juegos (productos) ----------
CREATE TABLE juegos (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku              VARCHAR(20)  NOT NULL,
  titulo           VARCHAR(150) NOT NULL,
  genero_id        SMALLINT UNSIGNED NOT NULL,
  desarrollador    VARCHAR(100) NULL,
  anio_lanzamiento SMALLINT UNSIGNED NULL,
  clasificacion    ENUM('E','E10+','T','M') NOT NULL DEFAULT 'T',
  descripcion      TEXT NULL,
  precio           DECIMAL(10,2) NOT NULL,
  stock            INT NOT NULL DEFAULT 0,
  stock_minimo     INT NOT NULL DEFAULT 3,
  portada_url      VARCHAR(255) NULL,
  activo           TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_juegos_sku UNIQUE (sku),
  CONSTRAINT fk_juegos_genero FOREIGN KEY (genero_id) REFERENCES generos(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT ck_juegos_precio CHECK (precio > 0),
  CONSTRAINT ck_juegos_stock  CHECK (stock >= 0),
  CONSTRAINT ck_juegos_min    CHECK (stock_minimo >= 0),
  CONSTRAINT ck_juegos_anio   CHECK (anio_lanzamiento IS NULL OR anio_lanzamiento BETWEEN 2005 AND 2016),
  INDEX idx_juegos_titulo (titulo),
  INDEX idx_juegos_genero (genero_id),
  INDEX idx_juegos_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Clientes ----------
CREATE TABLE clientes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED NULL,             -- cuenta de acceso (si compra en línea)
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NULL,
  telefono    VARCHAR(20)  NULL,
  gamertag    VARCHAR(30)  NULL,
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_clientes_usuario UNIQUE (usuario_id),
  CONSTRAINT uq_clientes_email   UNIQUE (email),
  CONSTRAINT fk_clientes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_clientes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Ventas (encabezado) ----------
-- subtotal/impuesto/total se guardan como "fotografía contable" del momento
-- de la venta (la tasa de IVA o el precio pueden cambiar después).
CREATE TABLE ventas (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  folio              VARCHAR(30) NOT NULL,
  usuario_id         INT UNSIGNED NOT NULL,       -- quien registró la venta
  cliente_id         INT UNSIGNED NULL,
  canal              ENUM('mostrador','online') NOT NULL DEFAULT 'mostrador',
  metodo_pago        ENUM('efectivo','tarjeta','transferencia') NOT NULL,
  tasa_impuesto      DECIMAL(5,4) NOT NULL,
  subtotal           DECIMAL(12,2) NOT NULL,
  impuesto           DECIMAL(12,2) NOT NULL,
  total              DECIMAL(12,2) NOT NULL,
  estado             ENUM('completada','cancelada') NOT NULL DEFAULT 'completada',
  cancelada_por      INT UNSIGNED NULL,
  motivo_cancelacion VARCHAR(255) NULL,
  cancelada_at       DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ventas_folio UNIQUE (folio),
  CONSTRAINT fk_ventas_usuario   FOREIGN KEY (usuario_id)    REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ventas_cliente   FOREIGN KEY (cliente_id)    REFERENCES clientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ventas_cancelo   FOREIGN KEY (cancelada_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_ventas_total CHECK (total >= 0 AND subtotal >= 0 AND impuesto >= 0),
  INDEX idx_ventas_fecha  (created_at),
  INDEX idx_ventas_estado (estado),
  INDEX idx_ventas_cliente (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Detalle de venta ----------
CREATE TABLE venta_detalle (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  venta_id        INT UNSIGNED NOT NULL,
  juego_id        INT UNSIGNED NOT NULL,
  cantidad        INT UNSIGNED NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,   -- precio histórico al momento de vender
  CONSTRAINT fk_detalle_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_detalle_juego FOREIGN KEY (juego_id) REFERENCES juegos(id) ON DELETE RESTRICT,
  CONSTRAINT uq_detalle_linea UNIQUE (venta_id, juego_id),
  CONSTRAINT ck_detalle_cant CHECK (cantidad > 0),
  CONSTRAINT ck_detalle_prec CHECK (precio_unitario > 0),
  INDEX idx_detalle_juego (juego_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Movimientos de inventario ----------
CREATE TABLE movimientos_inventario (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  juego_id       INT UNSIGNED NOT NULL,
  usuario_id     INT UNSIGNED NOT NULL,
  venta_id       INT UNSIGNED NULL,
  tipo           ENUM('entrada','salida','ajuste','venta','cancelacion') NOT NULL,
  cantidad       INT NOT NULL,              -- con signo: + entra, - sale
  stock_anterior INT NOT NULL,
  stock_nuevo    INT NOT NULL,
  motivo         VARCHAR(255) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_juego   FOREIGN KEY (juego_id)   REFERENCES juegos(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_mov_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mov_venta   FOREIGN KEY (venta_id)   REFERENCES ventas(id)   ON DELETE RESTRICT,
  CONSTRAINT ck_mov_stock CHECK (stock_nuevo >= 0),
  INDEX idx_mov_fecha (created_at),
  INDEX idx_mov_juego (juego_id),
  INDEX idx_mov_tipo  (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Bitácora / historial de operaciones ----------
CREATE TABLE bitacora (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT UNSIGNED NULL,
  accion        VARCHAR(40)  NOT NULL,   -- crear, actualizar, baja, cancelar, login...
  entidad       VARCHAR(40)  NOT NULL,   -- juegos, ventas, usuarios...
  entidad_id    INT UNSIGNED NULL,
  datos_antes   LONGTEXT NULL,           -- JSON
  datos_despues LONGTEXT NULL,           -- JSON
  ip            VARCHAR(45)  NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_bitacora_fecha (created_at),
  INDEX idx_bitacora_entidad (entidad, entidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Configuración del sistema ----------
CREATE TABLE configuracion (
  clave       VARCHAR(40)  PRIMARY KEY,
  valor       VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
