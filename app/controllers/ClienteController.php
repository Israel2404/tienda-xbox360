<?php
declare(strict_types=1);

final class ClienteController
{
    private const RULES = [
        'nombre'   => 'required|string|min:3|max:100',
        'email'    => 'email|max:150',
        'telefono' => 'string|max:20',
        'gamertag' => 'string|max:30',
    ];

    /** GET /clientes?q=&estado=&sort=&dir=&page=&limit= */
    public static function index(Request $req): void
    {
        $where = ['1=1']; $p = [];
        if ($q = $req->query('q')) {
            $where[] = '(c.nombre LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.gamertag LIKE ?)';
            array_push($p, "%$q%", "%$q%", "%$q%", "%$q%");
        }
        $e = $req->query('estado', 'activos');
        if ($e === 'activos') $where[] = 'c.activo = 1'; elseif ($e === 'inactivos') $where[] = 'c.activo = 0';
        [$page, $limit] = $req->pagination(10);
        $order = $req->sort(['nombre' => 'c.nombre', 'compras' => 'compras', 'total' => 'total_comprado', 'creado' => 'c.created_at'], 'nombre');
        Response::json(Database::paginate(
            "c.id, c.nombre, c.email, c.telefono, c.gamertag, c.activo, c.usuario_id, c.created_at,
             (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id AND v.estado = 'completada') AS compras,
             (SELECT COALESCE(SUM(v.total),0) FROM ventas v WHERE v.cliente_id = c.id AND v.estado = 'completada') AS total_comprado",
            'FROM clientes c WHERE ' . implode(' AND ', $where), $p, $order, $page, $limit));
    }

    public static function show(Request $req): void
    {
        $c = self::find($req->id());
        $c['ultimas_compras'] = Database::all('SELECT id, folio, total, estado, canal, created_at FROM ventas WHERE cliente_id = ? ORDER BY id DESC LIMIT 10', [$c['id']]);
        Response::json($c);
    }

    public static function store(Request $req): void
    {
        $d = Validator::check($req->body(), self::RULES);
        if (!empty($d['email'])) { $d['email'] = mb_strtolower($d['email']); self::assertEmail($d['email']); }
        $id = Database::insert('INSERT INTO clientes (nombre, email, telefono, gamertag) VALUES (?,?,?,?)',
            [$d['nombre'], $d['email'] ?? null, $d['telefono'] ?? null, $d['gamertag'] ?? null]);
        $c = self::find($id);
        Bitacora::log('crear', 'clientes', $id, null, $c);
        Response::created($c);
    }

    public static function update(Request $req): void
    {
        $antes = self::find($req->id());
        $d = Validator::check($req->body(), self::RULES + ['activo' => 'bool']);
        if (!empty($d['email'])) { $d['email'] = mb_strtolower($d['email']); self::assertEmail($d['email'], $antes['id']); }
        Database::exec('UPDATE clientes SET nombre=?, email=?, telefono=?, gamertag=?, activo=? WHERE id=?',
            [$d['nombre'], $d['email'] ?? null, $d['telefono'] ?? null, $d['gamertag'] ?? null, $d['activo'] ?? $antes['activo'], $antes['id']]);
        $c = self::find($antes['id']);
        Bitacora::log('actualizar', 'clientes', $c['id'], $antes, $c);
        Response::json($c);
    }

    /** DELETE /clientes/{id}: baja lógica (se conserva su historial de compras) */
    public static function destroy(Request $req): void
    {
        $c = self::find($req->id());
        if ($c['id'] === 2 || $c['nombre'] === 'Público en general') throw HttpException::conflict('El cliente "Público en general" no puede darse de baja.');
        if (!$c['activo']) throw HttpException::conflict('El cliente ya está dado de baja.');
        Database::exec('UPDATE clientes SET activo = 0 WHERE id = ?', [$c['id']]);
        Bitacora::log('baja', 'clientes', $c['id'], ['activo' => 1], ['activo' => 0]);
        Response::json(['mensaje' => 'Cliente dado de baja.']);
    }

    private static function find(int $id): array
    {
        $c = Database::one('SELECT * FROM clientes WHERE id = ?', [$id]);
        if (!$c) throw HttpException::notFound('El cliente no existe.');
        return $c;
    }

    private static function assertEmail(string $email, int $except = 0): void
    {
        if (Database::value('SELECT 1 FROM clientes WHERE email = ? AND id <> ?', [$email, $except])) throw HttpException::conflict('Ya existe un cliente con ese correo.');
    }
}
