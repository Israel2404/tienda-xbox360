<?php
declare(strict_types=1);

final class UsuarioController
{
    private const SELECT = 'u.id, u.nombre, u.email, u.activo, u.ultimo_acceso, u.created_at, u.rol_id, r.clave AS rol, r.nombre AS rol_nombre';

    /** GET /usuarios?q=&rol=&estado= */
    public static function index(Request $req): void
    {
        $where = ['1=1']; $p = [];
        if ($q = $req->query('q')) { $where[] = '(u.nombre LIKE ? OR u.email LIKE ?)'; array_push($p, "%$q%", "%$q%"); }
        if ($r = $req->query('rol')) { $where[] = 'r.clave = ?'; $p[] = $r; }
        $e = $req->query('estado', 'todos');
        if ($e === 'activos') $where[] = 'u.activo = 1'; elseif ($e === 'inactivos') $where[] = 'u.activo = 0';
        [$page, $limit] = $req->pagination(10);
        $order = $req->sort(['nombre' => 'u.nombre', 'email' => 'u.email', 'rol' => 'r.nombre', 'acceso' => 'u.ultimo_acceso'], 'nombre');
        Response::json(Database::paginate(self::SELECT, 'FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE ' . implode(' AND ', $where), $p, $order, $page, $limit));
    }

    public static function roles(Request $req): void
    {
        Response::json(Database::all('SELECT id, clave, nombre, descripcion FROM roles ORDER BY id'));
    }

    public static function show(Request $req): void { Response::json(self::find($req->id())); }

    public static function store(Request $req): void
    {
        $d = Validator::check($req->body(), [
            'nombre' => 'required|string|min:3|max:100', 'email' => 'required|email|max:150',
            'password' => 'required|string|password|max:100', 'rol_id' => 'required|int|min:1',
        ]);
        $d['email'] = mb_strtolower($d['email']);
        self::assertRol($d['rol_id']);
        if (Database::value('SELECT 1 FROM usuarios WHERE email = ?', [$d['email']])) throw HttpException::conflict('Ya existe un usuario con ese correo.');
        $id = Database::insert('INSERT INTO usuarios (rol_id, nombre, email, password_hash) VALUES (?,?,?,?)',
            [$d['rol_id'], $d['nombre'], $d['email'], password_hash($d['password'], PASSWORD_BCRYPT)]);
        $u = self::find($id);
        Bitacora::log('crear', 'usuarios', $id, null, $u);
        Response::created($u);
    }

    /** PUT /usuarios/{id} — password opcional (si viene, se reemplaza) */
    public static function update(Request $req): void
    {
        $antes = self::find($req->id());
        $d = Validator::check($req->body(), [
            'nombre' => 'required|string|min:3|max:100', 'email' => 'required|email|max:150',
            'password' => 'string|password|max:100', 'rol_id' => 'required|int|min:1',
        ]);
        $d['email'] = mb_strtolower($d['email']);
        self::assertRol($d['rol_id']);
        if (Database::value('SELECT 1 FROM usuarios WHERE email = ? AND id <> ?', [$d['email'], $antes['id']])) throw HttpException::conflict('Ya existe un usuario con ese correo.');
        // Regla: no puedes quitarte a ti mismo el rol de administrador ni dejar el sistema sin administradores
        if ($antes['rol'] === Auth::ADMIN && $d['rol_id'] !== $antes['rol_id']) {
            if ($antes['id'] === Auth::id()) throw HttpException::conflict('No puedes cambiar tu propio rol de administrador.');
            self::assertOtroAdmin($antes['id']);
        }
        $sql = 'UPDATE usuarios SET nombre=?, email=?, rol_id=?' . (!empty($d['password']) ? ', password_hash=?' : '') . ' WHERE id=?';
        $p = [$d['nombre'], $d['email'], $d['rol_id']];
        if (!empty($d['password'])) $p[] = password_hash($d['password'], PASSWORD_BCRYPT);
        $p[] = $antes['id'];
        Database::exec($sql, $p);
        $u = self::find($antes['id']);
        Bitacora::log('actualizar', 'usuarios', $u['id'], $antes, $u + (!empty($d['password']) ? ['password_cambiada' => true] : []));
        Response::json($u);
    }

    /** PATCH /usuarios/{id}/estado  {activo: true|false} */
    public static function estado(Request $req): void
    {
        $u = self::find($req->id());
        $d = Validator::check($req->body(), ['activo' => 'required|bool']);
        if ($u['id'] === Auth::id()) throw HttpException::conflict('No puedes desactivar tu propia cuenta.');
        if (!$d['activo'] && $u['rol'] === Auth::ADMIN) self::assertOtroAdmin($u['id']);
        Database::exec('UPDATE usuarios SET activo = ? WHERE id = ?', [$d['activo'], $u['id']]);
        Bitacora::log($d['activo'] ? 'activar' : 'desactivar', 'usuarios', $u['id'], ['activo' => $u['activo']], ['activo' => $d['activo']]);
        Response::json(self::find($u['id']));
    }

    /** DELETE /usuarios/{id} — baja lógica: un usuario con operaciones nunca desaparece */
    public static function destroy(Request $req): void
    {
        $u = self::find($req->id());
        if ($u['id'] === Auth::id()) throw HttpException::conflict('No puedes eliminar tu propia cuenta.');
        if ($u['rol'] === Auth::ADMIN) self::assertOtroAdmin($u['id']);
        if (!$u['activo']) throw HttpException::conflict('El usuario ya está dado de baja.');
        Database::exec('UPDATE usuarios SET activo = 0 WHERE id = ?', [$u['id']]);
        Bitacora::log('baja', 'usuarios', $u['id'], ['activo' => 1], ['activo' => 0]);
        Response::json(['mensaje' => 'Usuario dado de baja (se conserva su historial).']);
    }

    private static function find(int $id): array
    {
        $u = Database::one('SELECT ' . self::SELECT . ' FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?', [$id]);
        if (!$u) throw HttpException::notFound('El usuario no existe.');
        return $u;
    }

    private static function assertRol(int $id): void
    {
        if (!Database::value('SELECT 1 FROM roles WHERE id = ?', [$id])) throw HttpException::validation(['rol_id' => 'Rol inválido.']);
    }

    private static function assertOtroAdmin(int $exceptId): void
    {
        $n = (int) Database::value("SELECT COUNT(*) FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE r.clave = 'admin' AND u.activo = 1 AND u.id <> ?", [$exceptId]);
        if ($n === 0) throw HttpException::conflict('Debe existir al menos un administrador activo.');
    }
}
