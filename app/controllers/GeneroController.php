<?php
declare(strict_types=1);

final class GeneroController
{
    private const RULES = ['nombre' => 'required|string|min:3|max:60', 'descripcion' => 'string|max:255'];

    /** GET /generos?q=&estado=&sort=&dir= */
    public static function index(Request $req): void
    {
        $where = ['1=1']; $p = [];
        if ($q = $req->query('q')) { $where[] = 'g.nombre LIKE ?'; $p[] = "%$q%"; }
        $e = $req->query('estado', 'activos');
        if ($e === 'activos') $where[] = 'g.activo = 1'; elseif ($e === 'inactivos') $where[] = 'g.activo = 0';
        [$page, $limit] = $req->pagination(20);
        $order = $req->sort(['nombre' => 'g.nombre', 'juegos' => 'juegos', 'id' => 'g.id'], 'nombre');
        Response::json(Database::paginate(
            'g.id, g.nombre, g.descripcion, g.activo, g.created_at, (SELECT COUNT(*) FROM juegos j WHERE j.genero_id = g.id AND j.activo = 1) AS juegos',
            'FROM generos g WHERE ' . implode(' AND ', $where), $p, $order, $page, $limit));
    }

    public static function show(Request $req): void { Response::json(self::find($req->id())); }

    public static function store(Request $req): void
    {
        $d = Validator::check($req->body(), self::RULES);
        self::assertUnico($d['nombre']);
        $id = Database::insert('INSERT INTO generos (nombre, descripcion) VALUES (?,?)', [$d['nombre'], $d['descripcion'] ?? null]);
        $g = self::find($id);
        Bitacora::log('crear', 'generos', $id, null, $g);
        Response::created($g);
    }

    public static function update(Request $req): void
    {
        $antes = self::find($req->id());
        $d = Validator::check($req->body(), self::RULES + ['activo' => 'bool']);
        self::assertUnico($d['nombre'], $antes['id']);
        $activo = $d['activo'] ?? $antes['activo'];
        if (!$activo && $antes['juegos'] > 0) throw HttpException::conflict('No puedes desactivar un género con juegos activos.');
        Database::exec('UPDATE generos SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?', [$d['nombre'], $d['descripcion'] ?? null, $activo, $antes['id']]);
        $g = self::find($antes['id']);
        Bitacora::log('actualizar', 'generos', $g['id'], $antes, $g);
        Response::json($g);
    }

    /** DELETE /generos/{id}: si nunca se usó se elimina; si tiene juegos se rechaza (409) */
    public static function destroy(Request $req): void
    {
        $g = self::find($req->id());
        $usados = (int) Database::value('SELECT COUNT(*) FROM juegos WHERE genero_id = ?', [$g['id']]);
        if ($usados > 0) {
            if ($g['juegos'] > 0) throw HttpException::conflict("No se puede eliminar: el género tiene {$g['juegos']} juego(s) activo(s).");
            Database::exec('UPDATE generos SET activo = 0 WHERE id = ?', [$g['id']]);
            Bitacora::log('baja', 'generos', $g['id'], ['activo' => 1], ['activo' => 0]);
            Response::json(['mensaje' => 'El género tiene historial; se desactivó en lugar de eliminarse.']);
        }
        Database::exec('DELETE FROM generos WHERE id = ?', [$g['id']]);
        Bitacora::log('eliminar', 'generos', $g['id'], $g, null);
        Response::json(['mensaje' => 'Género eliminado.']);
    }

    private static function find(int $id): array
    {
        $g = Database::one('SELECT g.*, (SELECT COUNT(*) FROM juegos j WHERE j.genero_id = g.id AND j.activo = 1) AS juegos FROM generos g WHERE g.id = ?', [$id]);
        if (!$g) throw HttpException::notFound('El género no existe.');
        return $g;
    }

    private static function assertUnico(string $nombre, int $except = 0): void
    {
        if (Database::value('SELECT 1 FROM generos WHERE nombre = ? AND id <> ?', [$nombre, $except])) throw HttpException::conflict('Ya existe un género con ese nombre.');
    }
}
