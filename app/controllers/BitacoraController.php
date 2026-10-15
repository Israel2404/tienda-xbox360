<?php
declare(strict_types=1);

final class BitacoraController
{
    /** GET /bitacora?accion=&entidad=&usuario=&desde=&hasta=&page=&limit= (solo administrador) */
    public static function index(Request $req): void
    {
        $where = ['1=1']; $p = [];
        if ($a = $req->query('accion')) { $where[] = 'b.accion = ?'; $p[] = $a; }
        if ($e = $req->query('entidad')) { $where[] = 'b.entidad = ?'; $p[] = $e; }
        if ($u = $req->query('usuario')) { $where[] = 'b.usuario_id = ?'; $p[] = (int) $u; }
        if ($req->query('desde') || $req->query('hasta')) {
            [$desde, $hasta] = Validator::dateRange($req);
            $where[] = 'b.created_at BETWEEN ? AND ?'; array_push($p, "$desde 00:00:00", "$hasta 23:59:59");
        }
        [$page, $limit] = $req->pagination(20);
        $order = $req->sort(['fecha' => 'b.created_at'], 'fecha', 'desc') . ', b.id DESC';
        $res = Database::paginate(
            'b.id, b.accion, b.entidad, b.entidad_id, b.datos_antes, b.datos_despues, b.ip, b.created_at, u.nombre AS usuario',
            'FROM bitacora b LEFT JOIN usuarios u ON u.id=b.usuario_id WHERE ' . implode(' AND ', $where), $p, $order, $page, $limit);
        $res['filtros'] = [
            'acciones'  => array_column(Database::all('SELECT DISTINCT accion FROM bitacora ORDER BY accion'), 'accion'),
            'entidades' => array_column(Database::all('SELECT DISTINCT entidad FROM bitacora ORDER BY entidad'), 'entidad'),
        ];
        Response::json($res);
    }
}
