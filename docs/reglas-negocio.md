# Reglas de negocio implementadas

Todas se validan en el **backend** (el frontend solo las anticipa para mejorar la experiencia).

| ID | Regla | Dónde se implementa | Respuesta si se viola |
|---|---|---|---|
| RN-01 | No se vende un juego sin existencias suficientes. El stock se bloquea (`SELECT … FOR UPDATE`) durante la venta para evitar vender la misma pieza dos veces. | `VentaController::store` | 409 |
| RN-02 | Cantidades siempre mayores a 0 y máximo *N* unidades del mismo juego por venta (`max_unidades_por_linea`, configurable). | `VentaController::store` | 422 |
| RN-03 | Precios, IVA y total se calculan **en el servidor** con el precio vigente; el cliente no puede mandar precios. | `VentaController::store` | — |
| RN-04 | Cada venta genera un **folio único** `R360-AAMMDD-000123`. | `VentaController::store` | — |
| RN-05 | Una venta es **transaccional**: venta + detalle + descuento de inventario + movimientos + bitácora; si algo falla → `ROLLBACK`. | `Database::transaction` | 409/500 sin cambios en BD |
| RN-06 | Las ventas **nunca se eliminan**; solo el administrador puede **cancelarlas**, con motivo, una sola vez y dentro de 30 días. La cancelación devuelve el stock (también en transacción). | `VentaController::cancelar/destroy` | 403 / 409 / 422 |
| RN-07 | El stock solo cambia mediante movimientos trazables (entrada, salida, ajuste, venta, cancelación); nunca puede quedar negativo. | `JuegoController::stock` + `CHECK` | 409 |
| RN-08 | Alerta de stock bajo cuando `stock <= stock_minimo` (dashboard, reportes y tienda muestra "Últimas piezas"). | Dashboard / Reportes / Catálogo | — |
| RN-09 | Baja lógica: juegos, clientes y usuarios con historial se desactivan, no se borran. Un juego dado de baja desaparece de la tienda. | Controladores `destroy` | — |
| RN-10 | SKU, correo de usuario, correo de cliente y nombre de género son únicos. | Controladores + `UNIQUE` | 409 |
| RN-11 | No se puede eliminar/desactivar un género con juegos activos. | `GeneroController` | 409 |
| RN-12 | Debe existir siempre al menos un administrador activo; un admin no puede desactivarse ni quitarse el rol a sí mismo. | `UsuarioController` | 409 |
| RN-13 | Seguridad de acceso: 5 intentos fallidos bloquean la cuenta 15 minutos. | `AuthController::login` | 429 |
| RN-14 | Un cliente solo compra en canal *online* con tarjeta o transferencia y solo puede consultar **sus** compras. | `VentaController` | 404 / 422 |
| RN-15 | La tienda pública nunca expone el stock exacto, solo *disponible / últimas piezas / agotado*. | `JuegoController::catalogo` | — |
