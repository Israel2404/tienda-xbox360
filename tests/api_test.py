#!/usr/bin/env python3
"""
Pruebas automáticas de la API (casos CP-xx de la matriz de pruebas).
Uso:  python3 tests/api_test.py http://localhost:8000
ADVERTENCIA: crea registros (ventas, juegos, clientes). Úsalo en una BD de prueba.
"""
import json, sys, http.cookiejar, urllib.request, urllib.error, urllib.parse, uuid

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000').rstrip('/') + '/api'
results = []


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = None

    def req(self, method, path, body=None, csrf=True):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(BASE + path, data=data, method=method)
        r.add_header('Accept', 'application/json')
        if data is not None: r.add_header('Content-Type', 'application/json')
        if csrf and self.csrf and method != 'GET': r.add_header('X-CSRF-Token', self.csrf)
        try:
            with self.op.open(r) as resp: code, raw = resp.status, resp.read()
        except urllib.error.HTTPError as e:
            code, raw = e.code, e.read()
        try: js = json.loads(raw)
        except Exception: js = {'_raw': raw[:200].decode(errors='replace')}
        if isinstance(js, dict) and js.get('csrf'): self.csrf = js['csrf']
        return code, js

    def login(self, email, pwd):
        self.req('GET', '/auth/me')
        return self.req('POST', '/auth/login', {'email': email, 'password': pwd})


def check(cid, desc, cond, detail=''):
    results.append((cid, desc, bool(cond)))
    print(f"{'✔' if cond else '✘'} {cid} {desc}" + (f'  → {detail}' if not cond else ''))


anon, admin, vend, cli = Client(), Client(), Client(), Client()

# --- Autenticación ---
c, j = admin.login('admin@retro360.test', 'Admin360!')
check('CP-01', 'Login válido de administrador (200)', c == 200 and j['usuario']['rol'] == 'admin', (c, j))
c, j = anon.login('admin@retro360.test', 'incorrecta1')
check('CP-02', 'Login con contraseña incorrecta → 401', c == 401, (c, j))
c, j = anon.req('POST', '/auth/login', {'email': 'no-es-correo', 'password': ''})
check('CP-03', 'Login con datos inválidos → 422 con errores por campo', c == 422 and 'email' in j.get('errores', {}), (c, j))
c, j = anon.req('GET', '/juegos')
check('CP-04', 'Endpoint protegido sin sesión → 401', c == 401, (c, j))
vend.login('vendedor@retro360.test', 'Vendedor360!')
cli.login('cliente@retro360.test', 'Cliente360!')

# --- RBAC ---
c, j = vend.req('DELETE', '/usuarios/4')
check('CP-05', 'Vendedor intenta DELETE /usuarios → 403', c == 403, (c, j))
c, j = cli.req('GET', '/dashboard')
check('CP-06', 'Cliente intenta ver dashboard → 403', c == 403, (c, j))
c, j = admin.req('POST', '/generos', {'nombre': 'Prueba sin CSRF'}, csrf=False)
check('CP-07', 'Petición sin token CSRF → 403', c == 403, (c, j))

# --- CRUD y validaciones ---
c, j = admin.req('GET', '/juegos/999999')
check('CP-08', 'Registro inexistente → 404', c == 404, (c, j))
c, j = admin.req('POST', '/juegos', {'sku': 'X360-0001', 'titulo': 'Duplicado', 'genero_id': 1, 'clasificacion': 'T', 'precio': 100, 'stock': 1, 'stock_minimo': 1})
check('CP-09', 'SKU duplicado → 409', c == 409, (c, j))
c, j = admin.req('POST', '/juegos', {'sku': 'T-1', 'titulo': 'X', 'genero_id': 1, 'clasificacion': 'Z', 'precio': -5, 'stock': -1, 'stock_minimo': 0})
check('CP-10', 'Precio negativo / stock negativo / ESRB inválida → 422', c == 422 and {'precio', 'stock', 'clasificacion'} <= set(j.get('errores', {})), (c, j))
sku = 'T-' + uuid.uuid4().hex[:6].upper()
c, nuevo = admin.req('POST', '/juegos', {'sku': sku, 'titulo': 'Juego de Prueba 360', 'genero_id': 1, 'clasificacion': 'T', 'precio': 199.9, 'stock': 2, 'stock_minimo': 1, 'anio_lanzamiento': 2010})
check('CP-11', 'Crear juego → 201', c == 201 and nuevo.get('sku') == sku, (c, nuevo))
jid = nuevo.get('id')
c, j = admin.req('PUT', f'/juegos/{jid}', {**{k: nuevo[k] for k in ('sku', 'titulo', 'genero_id', 'clasificacion', 'stock_minimo')}, 'precio': 249.5, 'activo': True})
check('CP-12', 'Actualizar juego (PUT) → 200 y precio nuevo', c == 200 and float(j['precio']) == 249.5, (c, j))
c, j = vend.req('GET', '/juegos', None)
c2, j2 = vend.req('GET', '/juegos?q=halo&sort=precio&dir=desc&page=1&limit=5')
check('CP-13', 'Búsqueda + orden + paginación', c2 == 200 and j2['limite'] == 5 and all('halo' in x['titulo'].lower() for x in j2['datos'])
      and [float(x['precio']) for x in j2['datos']] == sorted([float(x['precio']) for x in j2['datos']], reverse=True), (c2, j2))

# --- Reglas de negocio de venta ---
c, j = vend.req('POST', '/ventas', {'metodo_pago': 'efectivo', 'items': [{'juego_id': jid, 'cantidad': 5}]})
check('CP-14', 'Vender más unidades que el stock → 409 (regla: sin existencia no se vende)', c == 409, (c, j))
c, j = vend.req('POST', '/ventas', {'metodo_pago': 'efectivo', 'items': [{'juego_id': jid, 'cantidad': 0}]})
check('CP-15', 'Cantidad 0 o negativa → 422', c == 422, (c, j))
c, j = vend.req('POST', '/ventas', {'metodo_pago': 'efectivo', 'items': []})
check('CP-16', 'Carrito vacío → 422', c == 422, (c, j))
c, v = vend.req('POST', '/ventas', {'metodo_pago': 'efectivo', 'items': [{'juego_id': jid, 'cantidad': 1}, {'juego_id': jid, 'cantidad': 1}]})
ok_total = c == 201 and abs(float(v['subtotal']) - 499.0) < 0.01 and abs(float(v['total']) - round(499.0 * 1.16, 2)) < 0.01
check('CP-17', 'Venta correcta → 201, folio único y total calculado por el servidor', ok_total and v['folio'].startswith('R360-'), (c, v))
c, j = admin.req('GET', f'/juegos/{jid}')
check('CP-18', 'La venta descuenta inventario y registra movimiento', j['stock'] == 0 and j['movimientos'][0]['tipo'] == 'venta', j)
_, antes = admin.req('GET', '/juegos/1')
c, j = vend.req('POST', '/ventas', {'metodo_pago': 'efectivo', 'items': [{'juego_id': 1, 'cantidad': 1}, {'juego_id': jid, 'cantidad': 1}]})
_, despues = admin.req('GET', '/juegos/1')
check('CP-19', 'Transacción: si una línea falla, no se descuenta NADA (ROLLBACK)', c == 409 and antes['stock'] == despues['stock'], (c, antes['stock'], despues['stock']))
c, j = vend.req('PATCH', f"/ventas/{v['id']}/cancelar", {'motivo': 'Prueba de permisos'})
check('CP-20', 'Vendedor no puede cancelar ventas → 403', c == 403, (c, j))
c, j = admin.req('PATCH', f"/ventas/{v['id']}/cancelar", {'motivo': 'Prueba automatizada'})
c2, jj = admin.req('GET', f'/juegos/{jid}')
check('CP-21', 'Admin cancela venta → stock restituido', c == 200 and j['estado'] == 'cancelada' and jj['stock'] == 2, (c, j, jj.get('stock')))
c, j = admin.req('PATCH', f"/ventas/{v['id']}/cancelar", {'motivo': 'Otra vez'})
check('CP-22', 'Cancelar dos veces → 409', c == 409, (c, j))
c, j = admin.req('DELETE', f"/ventas/{v['id']}")
check('CP-23', 'Las ventas no se eliminan → 409', c == 409, (c, j))

# --- Cliente en línea ---
c, v2 = cli.req('POST', '/ventas', {'metodo_pago': 'tarjeta', 'items': [{'juego_id': jid, 'cantidad': 1}]})
check('CP-24', 'Cliente compra en línea → canal online y su cliente_id', c == 201 and v2['canal'] == 'online' and v2['cliente'] == 'Josh KRX', (c, v2))
c, j = cli.req('GET', '/ventas')
check('CP-25', 'Cliente solo ve sus propias compras', c == 200 and all(x['cliente'] == 'Josh KRX' for x in j['datos']), (c, j.get('datos', [])[:1]))
c, j = cli.req('GET', '/ventas/1')
check('CP-26', 'Cliente no puede ver venta ajena → 404', c == 404 or (c == 200 and j.get('cliente') == 'Josh KRX'), (c, j))

# --- Inventario, baja lógica, usuarios ---
c, j = admin.req('PATCH', f'/juegos/{jid}/stock', {'tipo': 'salida', 'cantidad': 50, 'motivo': 'Merma'})
check('CP-27', 'Salida mayor al stock → 409', c == 409, (c, j))
c, j = admin.req('DELETE', f'/juegos/{jid}')
c2, j2 = anon.req('GET', '/catalogo')
check('CP-28', 'Baja lógica: el juego ya no aparece en la tienda pero existe', c == 200 and all(x['id'] != jid for x in j2['datos']), (c, j))
c, j = admin.req('PATCH', '/usuarios/1/estado', {'activo': False})
check('CP-29', 'Admin no puede desactivarse a sí mismo → 409', c == 409, (c, j))
c, j = admin.req('DELETE', '/generos/1')
check('CP-30', 'No eliminar género con juegos activos → 409', c == 409, (c, j))

# --- Reportes y fechas ---
c, j = admin.req('GET', '/reportes/ventas?desde=2026-09-30&hasta=2026-09-01')
check('CP-31', 'Rango de fechas invertido → 422', c == 422, (c, j))
c, j = admin.req('GET', '/reportes/ventas?desde=2026-09-01&hasta=2026-09-30')
check('CP-32', 'Reporte de ventas por periodo con datos reales', c == 200 and 'serie' in j and 'resumen' in j, (c, list(j)[:5]))
c, j = admin.req('GET', '/juegos?q=' + urllib.parse.quote("' OR 1=1 --"))
check('CP-33', 'Intento de SQL Injection en búsqueda no rompe ni filtra de más', c == 200 and j['total'] == 0, (c, j.get('total')))
c, j = admin.req('GET', '/no-existe')
check('CP-34', 'Endpoint inexistente → 404 JSON', c == 404 and j.get('error') is True, (c, j))
c, j = admin.req('GET', '/bitacora?entidad=ventas&accion=cancelar')
check('CP-35', 'La cancelación quedó en el historial (bitácora)', c == 200 and j['total'] >= 1, (c, j.get('total')))

c, j = admin.req('POST', '/auth/logout')
c2, j2 = admin.req('GET', '/dashboard')
check('CP-36', 'Cierre de sesión invalida el acceso', c == 200 and c2 == 401, (c, c2))

ok = sum(1 for r in results if r[2])
print(f'\n{ok}/{len(results)} pruebas aprobadas')
sys.exit(0 if ok == len(results) else 1)
