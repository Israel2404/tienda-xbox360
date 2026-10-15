<?php
declare(strict_types=1);

final class ConfigController
{
    private const RULES = [
        'nombre_tienda'          => 'required|string|min:3|max:60',
        'tasa_iva'               => 'required|number|min:0|max:0.30',
        'stock_minimo_default'   => 'required|int|min:0|max:100',
        'max_unidades_por_linea' => 'required|int|min:1|max:50',
    ];

    public static function show(Request $req): void
    {
        Response::json(Database::all('SELECT clave, valor, descripcion, updated_at FROM configuracion ORDER BY clave'));
    }

    /** PUT /config */
    public static function update(Request $req): void
    {
        $d = Validator::check($req->body(), self::RULES);
        $antes = Config::all();
        Database::transaction(function () use ($d) {
            foreach ($d as $k => $v) Database::exec('UPDATE configuracion SET valor = ? WHERE clave = ?', [(string) $v, $k]);
        });
        Config::clear();
        Bitacora::log('actualizar', 'configuracion', null, $antes, Config::all());
        self::show($req);
    }
}
