<?php
declare(strict_types=1);

final class AuthController
{
    private const MAX_INTENTOS = 5;
    private const BLOQUEO_MIN = 15;

    /** POST /auth/login */
    public static function login(Request $req): void
    {
        $d = Validator::check($req->body(), [
            'email'    => 'required|email|max:150',
            'password' => 'required|string|max:100',
        ]);
        $u = Database::one(
            'SELECT u.*, r.clave AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.email = ?',
            [mb_strtolower($d['email'])]
        );
        // Mismo mensaje para usuario inexistente o contraseña errónea (no revela qué correos existen)
        $generic = 'Correo o contraseña incorrectos.';
        if (!$u) { password_verify($d['password'], '$2y$12$jfDfs8WZ9l0CwInssrewRuckBvnbiwGt6kc2VJmfugI5h13bowEqO'); throw HttpException::unauthorized($generic); }

        // Regla de negocio: bloqueo temporal tras 5 intentos fallidos
        if ($u['bloqueado_hasta'] && strtotime($u['bloqueado_hasta']) > time()) {
            $min = (int) ceil((strtotime($u['bloqueado_hasta']) - time()) / 60);
            throw new HttpException("Cuenta bloqueada temporalmente por intentos fallidos. Intenta en $min minuto(s).", 429);
        }
        if (!password_verify($d['password'], $u['password_hash'])) {
            $intentos = $u['intentos_fallidos'] + 1;
            $bloqueo = $intentos >= self::MAX_INTENTOS ? date('Y-m-d H:i:s', time() + self::BLOQUEO_MIN * 60) : null;
            Database::exec('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?',
                [$bloqueo ? 0 : $intentos, $bloqueo, $u['id']]);
            if ($bloqueo) Bitacora::log('bloqueo', 'usuarios', (int) $u['id'], null, ['motivo' => 'intentos fallidos'], (int) $u['id']);
            throw HttpException::unauthorized($generic);
        }
        if (!$u['activo']) throw HttpException::forbidden('Tu cuenta está desactivada. Contacta al administrador.');

        if (password_needs_rehash($u['password_hash'], PASSWORD_BCRYPT)) {
            Database::exec('UPDATE usuarios SET password_hash = ? WHERE id = ?', [password_hash($d['password'], PASSWORD_BCRYPT), $u['id']]);
        }
        Database::exec('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW() WHERE id = ?', [$u['id']]);
        Auth::login($u);
        Bitacora::log('login', 'usuarios', (int) $u['id']);
        Response::json(['usuario' => Auth::user(), 'csrf' => Auth::csrfToken()]);
    }

    /** POST /auth/logout */
    public static function logout(Request $req): void
    {
        Bitacora::log('logout', 'usuarios', Auth::id());
        Auth::logout();
        Response::json(['mensaje' => 'Sesión cerrada.', 'csrf' => Auth::csrfToken()]);
    }

    /** GET /auth/me  (público: devuelve usuario null si no hay sesión, y siempre el token CSRF) */
    public static function me(Request $req): void
    {
        Response::json(['usuario' => Auth::user(), 'csrf' => Auth::csrfToken()]);
    }

    /** POST /auth/registro — alta de cliente para comprar en línea (transacción usuario + cliente) */
    public static function registro(Request $req): void
    {
        $d = Validator::check($req->body(), [
            'nombre'   => 'required|string|min:3|max:100',
            'email'    => 'required|email|max:150',
            'password' => 'required|string|password|max:100',
            'gamertag' => 'string|max:30',
            'telefono' => 'string|max:20',
        ]);
        $email = mb_strtolower($d['email']);
        if (Database::value('SELECT 1 FROM usuarios WHERE email = ?', [$email])) {
            throw HttpException::conflict('Ya existe una cuenta con ese correo.');
        }
        $uid = Database::transaction(function () use ($d, $email) {
            $rol = (int) Database::value("SELECT id FROM roles WHERE clave = 'cliente'");
            $uid = Database::insert('INSERT INTO usuarios (rol_id, nombre, email, password_hash) VALUES (?,?,?,?)',
                [$rol, $d['nombre'], $email, password_hash($d['password'], PASSWORD_BCRYPT)]);
            // Si ya era cliente de mostrador con ese correo, se vincula la cuenta
            $cid = Database::value('SELECT id FROM clientes WHERE email = ? AND usuario_id IS NULL', [$email]);
            if ($cid) {
                Database::exec('UPDATE clientes SET usuario_id = ?, gamertag = COALESCE(?, gamertag) WHERE id = ?', [$uid, $d['gamertag'] ?? null, $cid]);
            } else {
                Database::insert('INSERT INTO clientes (usuario_id, nombre, email, telefono, gamertag) VALUES (?,?,?,?,?)',
                    [$uid, $d['nombre'], $email, $d['telefono'] ?? null, $d['gamertag'] ?? null]);
            }
            return $uid;
        });
        Bitacora::log('registro', 'usuarios', $uid, null, ['nombre' => $d['nombre'], 'email' => $email], $uid);
        Auth::login(['id' => $uid]);
        Response::created(['usuario' => Auth::user(), 'csrf' => Auth::csrfToken()]);
    }
}
