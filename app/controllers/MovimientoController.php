<?php
declare(strict_types=1);

final class MovimientoController
{
    /** GET /movimientos?q=&tipo=&desde=&hasta=&juego=&sort=&dir=&page=&limit= */
    public static function index(Request $req): void
    {
        $where = ['1=1']; $p = [];
        if ($q = $req->query('q')) { $where[] = '(j.titulo LIKE ? OR j.sku LIKE ? OR m.motivo LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); }
        if ($t = $req->query('tipo')) { $where[] = 'm.tipo = ?'; $p[] = $t; }
        if ($jid = $req->query('juego')) { $where[] = 'm.juego_id = ?'; $p[] = (int) $jid; }
        if ($req->query('desde') || $req->query('hasta')) {
            [$desde, $hasta] = Validator::dateRange($req);
            $where[] = 'm.created_at BETWEEN ? AND ?'; array_push($p, "$desde 00:00:00", "$hasta 23:59:59");
        }
        [$page, $limit] = $req->pagination(15);
        $order = $req->sort(['fecha' => 'm.created_at', 'juego' => 'j.titulo', 'cantidad' => 'm.cantidad', 'tipo' => 'm.tipo'], 'fecha', 'desc') . ', m.id DESC';
        Response::json(Database::paginate(
            'm.id, m.tipo, m.cantidad, m.stock_anterior, m.stock_nuevo, m.motivo, m.created_at, j.id AS juego_id, j.sku, j.titulo, u.nombre AS usuario, v.folio',
            'FROM movimientos_inventario m JOIN juegos j ON j.id=m.juego_id JOIN usuarios u ON u.id=m.usuario_id LEFT JOIN ventas v ON v.id=m.venta_id WHERE ' . implode(' AND ', $where),
            $p, $order, $page, $limit));
    }
}
