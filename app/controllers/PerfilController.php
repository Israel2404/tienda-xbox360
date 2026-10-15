<?php
declare(strict_types=1);

final class PerfilController
{
    /** GET /perfil */
    public static function show(Request $req): void
    {
        $u = Auth::user();
        $extra = Database::one('SELECT created_at, ultimo_acceso FROM usuarios WHERE id = ?', [$u['id']]);
        $stats = $u['rol'] === Auth::CLIENTE
            ? Database::one("SELECT COUNT(*) AS compras, COALESCE(SUM(total),0) AS total FROM ventas WHERE cliente_id = ? AND estado='completada'", [(int) $u['cliente_id']])
            : Database::one("SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS total FROM ventas WHERE usuario_id = ? AND estado='completada'", [$u['id']]);
        Response::json($u + $extra + ['estadisticas' => $stats]);
    }

    /** PUT /perfil — nombre */
    public static function update(Request $req): void
    {
        $d = Validator::check($req->body(), ['nombre' => 'required|string|min:3|max:100']);
        Database::exec('UPDATE usuarios SET nombre = ? WHERE id = ?', [$d['nombre'], Auth::id()]);
        Bitacora::log('actualizar', 'perfil', Auth::id(), null, ['nombre' => $d['nombre']]);
        Response::json(['mensaje' => 'Perfil actualizado.']);
    }

    /** PATCH /perfil/password {actual, nueva} */
    public static function password(Request $req): void
    {
        $d = Validator::check($req->body(), ['actual' => 'required|string|max:100', 'nueva' => 'required|string|password|max:100']);
        $hash = Database::value('SELECT password_hash FROM usuarios WHERE id = ?', [Auth::id()]);
        if (!password_verify($d['actual'], $hash)) throw HttpException::validation(['actual' => 'La contraseña actual no es correcta.']);
        if ($d['actual'] === $d['nueva']) throw HttpException::validation(['nueva' => 'La nueva contraseña debe ser diferente.']);
        Database::exec('UPDATE usuarios SET password_hash = ? WHERE id = ?', [password_hash($d['nueva'], PASSWORD_BCRYPT), Auth::id()]);
        Bitacora::log('cambiar_password', 'usuarios', Auth::id());
        Response::json(['mensaje' => 'Contraseña actualizada.']);
    }
}
