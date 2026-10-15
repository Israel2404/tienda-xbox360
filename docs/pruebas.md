# Matriz de pruebas

Las pruebas **CP-01 a CP-36** son automáticas: `python3 tests/api_test.py http://localhost:8000` (resultado en la última ejecución: **36/36 aprobadas**). Las CP-37 en adelante son manuales de interfaz.

> Ejecuta las pruebas automáticas sobre una BD de prueba: crean ventas y registros. Para dejar todo como al inicio vuelve a importar `seed.sql`.

| ID | Caso | Entrada | Resultado esperado | Tipo |
|---|---|---|---|---|
| CP-01 | Login válido | admin@retro360.test / Admin360! | 200, sesión y token CSRF | Caso exitoso |
| CP-02 | Contraseña incorrecta | contraseña errónea | 401 "Correo o contraseña incorrectos" | Datos inválidos |
| CP-03 | Campos inválidos en login | email mal formado, password vacío | 422 con error por campo | Datos inválidos |
| CP-04 | Endpoint protegido sin sesión | GET /juegos | 401 | Permisos |
| CP-05 | Vendedor elimina usuario | DELETE /usuarios/4 | 403 | Permisos insuficientes |
| CP-06 | Cliente abre dashboard | GET /dashboard | 403 | Permisos insuficientes |
| CP-07 | Petición sin CSRF | POST sin X-CSRF-Token | 403 | Seguridad |
| CP-08 | Registro inexistente | GET /juegos/999999 | 404 | Registro inexistente |
| CP-09 | SKU duplicado | POST /juegos con SKU existente | 409 | Duplicidad |
| CP-10 | Precio/stock negativos, ESRB inválida | POST /juegos | 422 con errores | Validación backend |
| CP-11 | Crear juego | datos válidos | 201 | CRUD |
| CP-12 | Editar juego | PUT precio nuevo | 200 | CRUD |
| CP-13 | Búsqueda + orden + paginación | q=halo, sort=precio desc, limit=5 | Solo "halo", ordenado, 5 por página | Buscador/orden |
| CP-14 | Vender más que el stock | cantidad 5, stock 2 | 409 existencias insuficientes | Regla crítica |
| CP-15 | Cantidad 0 | cantidad 0 | 422 | Validación |
| CP-16 | Carrito vacío | items [] | 422 | Validación |
| CP-17 | Venta correcta | 2 unidades | 201, folio R360-…, total = subtotal × 1.16 | Caso exitoso |
| CP-18 | Descuento de inventario | tras CP-17 | stock −2 y movimiento "venta" | Transacción |
| CP-19 | ROLLBACK | venta con 1 línea válida y 1 sin stock | 409 y el stock de la línea válida **no cambia** | Transacción |
| CP-20 | Vendedor cancela venta | PATCH /ventas/{id}/cancelar | 403 | Permisos |
| CP-21 | Admin cancela venta | motivo válido | 200, stock restituido | Regla crítica |
| CP-22 | Cancelar dos veces | misma venta | 409 | Regla |
| CP-23 | Eliminar venta | DELETE /ventas/{id} | 409 | Regla |
| CP-24 | Compra en línea (cliente) | POST /ventas | 201 canal online | Caso exitoso |
| CP-25 | Cliente ve solo sus compras | GET /ventas | solo su cliente | Permisos |
| CP-26 | Cliente ve venta ajena | GET /ventas/1 | 404 | Permisos |
| CP-27 | Salida mayor al stock | PATCH stock salida 50 | 409 | Regla |
| CP-28 | Baja lógica | DELETE /juegos/{id} | ya no sale en /catalogo | Baja lógica |
| CP-29 | Admin se desactiva | PATCH /usuarios/1/estado | 409 | Regla |
| CP-30 | Borrar género con juegos | DELETE /generos/1 | 409 | Integridad |
| CP-31 | Rango de fechas invertido | desde > hasta | 422 | Validación |
| CP-32 | Reporte por periodo | 01/09–30/09 | serie y resumen reales | Reportes |
| CP-33 | SQL Injection | q=`' OR 1=1 --` | 200 con 0 resultados | Seguridad |
| CP-34 | Endpoint inexistente | GET /no-existe | 404 JSON | Errores |
| CP-35 | Bitácora | tras CP-21 | existe registro "cancelar" | Historial |
| CP-36 | Cerrar sesión | POST /auth/logout | siguiente petición 401 | Sesión |
| CP-37 | Error de conexión | apagar servidor/BD y recargar | Mensaje "No hay conexión…" o "El servidor tuvo un problema" + botón Reintentar, nunca pantalla en blanco ni SQLSTATE | Manual |
| CP-38 | Responsivo | 1440 px, 1024 px (tablet), 390 px (celular) | Selector y panel se adaptan sin romperse | Manual |
| CP-39 | Selector A-Z | teclas ← → Enter, letra "G", rueda del mouse, swipe | Navega en orden alfabético, salta a la letra | Manual |
| CP-40 | Confirmaciones | Vaciar ticket, cobrar, dar de baja, cancelar venta | Siempre pide confirmación | Manual |
| CP-41 | Bloqueo por intentos | 5 contraseñas erróneas | Cuenta bloqueada 15 min (429) | Manual |
| CP-42 | Subir portada inválida | archivo .txt renombrado a .jpg | 422 "Formato no permitido" | Manual |
