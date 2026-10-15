<?php
declare(strict_types=1);

final class VentaController
{
    private const DIAS_MAX_CANCELACION = 30;

    /**
     * POST /ventas — registra una venta en UNA transacción:
     * validar stock → crear venta → crear detalle → descontar inventario → registrar movimientos → bitácora.
     * Precios, impuestos y totales se calculan SIEMPRE en el servidor.
     * Body: { items: [{juego_id, cantidad}], cliente_id?, metodo_pago }
     */
    public static function store(Request $req): void
    {
        $user = Auth::user();
        $body = $req->body();
        $esCliente = $user['rol'] === Auth::CLIENTE;

        $d = Validator::check($body, [
            'metodo_pago' => $esCliente ? 'required|in:tarjeta,transferencia' : 'required|in:efectivo,tarjeta,transferencia',
            'cliente_id'  => 'int|min:1',
        ]);
        $items = $body['items'] ?? null;
        if (!is_array($items) || !$items) throw HttpException::validation(['items' => 'El carrito está vacío.']);
        if (count($items) > 20) throw HttpException::validation(['items' => 'Máximo 20 productos distintos por venta.']);

        $maxLinea = (int) Config::get('max_unidades_por_linea', '10');
        $lineas = [];   // juego_id => cantidad (agrupa duplicados)
        foreach ($items as $i => $it) {
            $jid = filter_var($it['juego_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            $cant = filter_var($it['cantidad'] ?? null, FILTER_VALIDATE_INT);
            if (!$jid) throw HttpException::validation(["items.$i.juego_id" => 'Producto inválido.']);
            if ($cant === false || $cant <= 0) throw HttpException::validation(["items.$i.cantidad" => 'La cantidad debe ser mayor a 0.']);
            $lineas[$jid] = ($lineas[$jid] ?? 0) + $cant;
            if ($lineas[$jid] > $maxLinea) throw HttpException::validation(["items.$i.cantidad" => "Máximo $maxLinea unidades del mismo juego por venta."]);
        }

        // Cliente de la venta
        if ($esCliente) {
            if (!$user['cliente_id']) throw HttpException::conflict('Tu cuenta no tiene un perfil de cliente asociado.');
            $clienteId = (int) $user['cliente_id'];
            $canal = 'online';
        } else {
            $clienteId = $d['cliente_id'] ?? (int) Database::value("SELECT id FROM clientes WHERE nombre = 'Público en general' LIMIT 1");
            $canal = 'mostrador';
            if (!Database::value('SELECT 1 FROM clientes WHERE id = ? AND activo = 1', [$clienteId])) {
                throw HttpException::validation(['cliente_id' => 'El cliente no existe o está dado de baja.']);
            }
        }

        $iva = Config::iva();
        ksort($lineas); // bloqueo en orden de id para evitar interbloqueos

        $venta = Database::transaction(function () use ($lineas, $clienteId, $canal, $d, $iva, $user) {
            $ph = implode(',', array_fill(0, count($lineas), '?'));
            $juegos = [];
            foreach (Database::all("SELECT id, titulo, precio, stock, activo FROM juegos WHERE id IN ($ph) ORDER BY id FOR UPDATE", array_keys($lineas)) as $j) {
                $juegos[$j['id']] = $j;
            }
            $subtotal = 0.0;
            foreach ($lineas as $jid => $cant) {
                $j = $juegos[$jid] ?? null;
                if (!$j) throw HttpException::notFound("El producto #$jid no existe.");
                if (!$j['activo']) throw HttpException::conflict("\"{$j['titulo']}\" ya no está a la venta.");
                if ($j['stock'] < $cant) {
                    throw HttpException::conflict("El producto \"{$j['titulo']}\" no tiene existencias suficientes (disponibles: {$j['stock']}).");
                }
                $subtotal += round((float) $j['precio'] * $cant, 2);
            }
            $subtotal = round($subtotal, 2);
            $impuesto = round($subtotal * $iva, 2);
            $total = round($subtotal + $impuesto, 2);

            $ventaId = Database::insert(
                'INSERT INTO ventas (folio, usuario_id, cliente_id, canal, metodo_pago, tasa_impuesto, subtotal, impuesto, total) VALUES (?,?,?,?,?,?,?,?,?)',
                ['TMP-' . bin2hex(random_bytes(8)), $user['id'], $clienteId, $canal, $d['metodo_pago'], $iva, $subtotal, $impuesto, $total]);
            $folio = 'R360-' . date('ymd') . '-' . str_pad((string) $ventaId, 6, '0', STR_PAD_LEFT);   // folio único
            Database::exec('UPDATE ventas SET folio = ? WHERE id = ?', [$folio, $ventaId]);

            foreach ($lineas as $jid => $cant) {
                $j = $juegos[$jid];
                Database::exec('INSERT INTO venta_detalle (venta_id, juego_id, cantidad, precio_unitario) VALUES (?,?,?,?)', [$ventaId, $jid, $cant, $j['precio']]);
                $nuevo = $j['stock'] - $cant;
                Database::exec('UPDATE juegos SET stock = ? WHERE id = ?', [$nuevo, $jid]);
                Database::exec("INSERT INTO movimientos_inventario (juego_id, usuario_id, venta_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo) VALUES (?,?,?,'venta',?,?,?,?)",
                    [$jid, $user['id'], $ventaId, -$cant, $j['stock'], $nuevo, "Venta $folio"]);
            }
            Bitacora::log('crear', 'ventas', $ventaId, null, ['folio' => $folio, 'total' => $total, 'canal' => $canal, 'lineas' => count($lineas)]);
            return $ventaId;
        });

        Response::created(self::find($venta));
    }

    /** GET /ventas?q=&desde=&hasta=&estado=&canal=&metodo=&vendedor=&sort=&dir=&page=&limit= */
    public static function index(Request $req): void
    {
        $user = Auth::user();
        $where = ['1=1']; $p = [];
        if ($user['rol'] === Auth::CLIENTE) { $where[] = 'v.cliente_id = ?'; $p[] = (int) $user['cliente_id']; }
        if ($q = $req->query('q')) { $where[] = '(v.folio LIKE ? OR c.nombre LIKE ?)'; array_push($p, "%$q%", "%$q%"); }
        if ($desde = $req->query('desde')) {
            if (!Validator::isDate($desde)) throw HttpException::validation(['desde' => 'Fecha inválida.']);
            $where[] = 'v.created_at >= ?'; $p[] = "$desde 00:00:00";
        }
        if ($hasta = $req->query('hasta')) {
            if (!Validator::isDate($hasta)) throw HttpException::validation(['hasta' => 'Fecha inválida.']);
            $where[] = 'v.created_at <= ?'; $p[] = "$hasta 23:59:59";
        }
        foreach (['estado' => 'v.estado', 'canal' => 'v.canal', 'metodo' => 'v.metodo_pago'] as $k => $col) {
            if ($val = $req->query($k)) { $where[] = "$col = ?"; $p[] = $val; }
        }
        if ($vend = $req->query('vendedor')) { $where[] = 'v.usuario_id = ?'; $p[] = (int) $vend; }

        $from = 'FROM ventas v JOIN usuarios u ON u.id = v.usuario_id LEFT JOIN clientes c ON c.id = v.cliente_id WHERE ' . implode(' AND ', $where);
        [$page, $limit] = $req->pagination(10);
        $order = $req->sort(['fecha' => 'v.created_at', 'total' => 'v.total', 'folio' => 'v.folio', 'cliente' => 'c.nombre'], 'fecha', 'desc');
        $res = Database::paginate(
            'v.id, v.folio, v.canal, v.metodo_pago, v.subtotal, v.impuesto, v.total, v.estado, v.created_at, u.nombre AS vendedor, c.nombre AS cliente,
             (SELECT SUM(d.cantidad) FROM venta_detalle d WHERE d.venta_id = v.id) AS articulos',
            $from, $p, $order, $page, $limit);
        $res['resumen'] = Database::one("SELECT COUNT(*) AS ventas, COALESCE(SUM(CASE WHEN v.estado='completada' THEN v.total END),0) AS importe $from", $p);
        Response::json($res);
    }

    /** GET /ventas/{id} */
    public static function show(Request $req): void
    {
        $v = self::find($req->id());
        $user = Auth::user();
        if ($user['rol'] === Auth::CLIENTE && (int) $v['cliente_id'] !== (int) $user['cliente_id']) throw HttpException::notFound('La venta no existe.');
        Response::json($v);
    }

    /**
     * PATCH /ventas/{id}/cancelar — solo administrador. Transacción: marca cancelada + devuelve stock + movimientos.
     * Reglas: no se cancela dos veces, solo dentro de 30 días, motivo obligatorio. Las ventas nunca se eliminan.
     */
    public static function cancelar(Request $req): void
    {
        $id = $req->id();
        $d = Validator::check($req->body(), ['motivo' => 'required|string|min:5|max:255']);
        Database::transaction(function () use ($id, $d) {
            $v = Database::one('SELECT id, folio, estado, created_at FROM ventas WHERE id = ? FOR UPDATE', [$id]);
            if (!$v) throw HttpException::notFound('La venta no existe.');
            if ($v['estado'] === 'cancelada') throw HttpException::conflict('La venta ya estaba cancelada.');
            if (strtotime($v['created_at']) < strtotime('-' . self::DIAS_MAX_CANCELACION . ' days')) {
                throw HttpException::conflict('Solo se pueden cancelar ventas de los últimos ' . self::DIAS_MAX_CANCELACION . ' días.');
            }
            $lineas = Database::all('SELECT d.juego_id, d.cantidad, j.stock FROM venta_detalle d JOIN juegos j ON j.id = d.juego_id WHERE d.venta_id = ? ORDER BY d.juego_id FOR UPDATE', [$id]);
            foreach ($lineas as $l) {
                $nuevo = $l['stock'] + $l['cantidad'];
                Database::exec('UPDATE juegos SET stock = ? WHERE id = ?', [$nuevo, $l['juego_id']]);
                Database::exec("INSERT INTO movimientos_inventario (juego_id, usuario_id, venta_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo) VALUES (?,?,?,'cancelacion',?,?,?,?)",
                    [$l['juego_id'], Auth::id(), $id, $l['cantidad'], $l['stock'], $nuevo, "Cancelación {$v['folio']}"]);
            }
            Database::exec("UPDATE ventas SET estado = 'cancelada', cancelada_por = ?, motivo_cancelacion = ?, cancelada_at = NOW() WHERE id = ?", [Auth::id(), $d['motivo'], $id]);
            Bitacora::log('cancelar', 'ventas', $id, ['estado' => 'completada'], ['estado' => 'cancelada', 'motivo' => $d['motivo']]);
        });
        Response::json(self::find($id));
    }

    /** DELETE /ventas/{id} — regla de negocio: una venta registrada nunca se elimina */
    public static function destroy(Request $req): void
    {
        self::find($req->id());
        throw HttpException::conflict('Las ventas no pueden eliminarse. Usa la cancelación para revertirlas.');
    }

    private static function find(int $id): array
    {
        $v = Database::one(
            'SELECT v.*, u.nombre AS vendedor, c.nombre AS cliente, c.gamertag, uc.nombre AS cancelada_por_nombre
               FROM ventas v JOIN usuarios u ON u.id = v.usuario_id LEFT JOIN clientes c ON c.id = v.cliente_id
               LEFT JOIN usuarios uc ON uc.id = v.cancelada_por WHERE v.id = ?', [$id]);
        if (!$v) throw HttpException::notFound('La venta no existe.');
        $v['detalle'] = Database::all(
            'SELECT d.juego_id, j.sku, j.titulo, d.cantidad, d.precio_unitario, ROUND(d.cantidad * d.precio_unitario, 2) AS importe
               FROM venta_detalle d JOIN juegos j ON j.id = d.juego_id WHERE d.venta_id = ? ORDER BY j.titulo', [$id]);
        return $v;
    }
}
