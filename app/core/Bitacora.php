<?php
declare(strict_types=1);

/** Historial de operaciones importantes (quién, qué, cuándo, antes y después). */
final class Bitacora
{
    public static function log(string $accion, string $entidad, ?int $entidadId = null, ?array $antes = null, ?array $despues = null, ?int $usuarioId = null): void
    {
        $uid = $usuarioId ?? (Auth::user()['id'] ?? null);
        foreach (['password_hash', 'password'] as $k) { unset($antes[$k], $despues[$k]); }
        Database::exec(
            'INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, datos_antes, datos_despues, ip) VALUES (?,?,?,?,?,?,?)',
            [
                $uid, $accion, $entidad, $entidadId,
                $antes ? json_encode($antes, JSON_UNESCAPED_UNICODE) : null,
                $despues ? json_encode($despues, JSON_UNESCAPED_UNICODE) : null,
                Request::ip(),
            ]
        );
    }
}
