<?php
declare(strict_types=1);

final class JuegoController
{
    private const SELECT = "j.id, j.sku, j.titulo, j.genero_id, g.nombre AS genero, j.desarrollador, j.anio_lanzamiento,
        j.clasificacion, j.descripcion, j.precio, j.stock, j.stock_minimo, j.portada_url, j.activo,
        (j.stock <= j.stock_minimo) AS stock_bajo, j.created_at, j.updated_at";

    private const SORT = [
        'titulo' => 'j.titulo', 'precio' => 'j.precio', 'stock' => 'j.stock', 'anio' => 'j.anio_lanzamiento',
        'genero' => 'g.nombre', 'sku' => 'j.sku', 'creado' => 'j.created_at',
    ];

    private const RULES = [
        'sku'              => 'required|string|max:20',
        'titulo'           => 'required|string|min:2|max:150',
        'genero_id'        => 'required|int|min:1',
        'desarrollador'    => 'string|max:100',
        'anio_lanzamiento' => 'int|min:2005|max:2016',
        'clasificacion'    => 'required|in:E,E10+,T,M',
        'descripcion'      => 'string|max:2000',
        'precio'           => 'required|number|positive|max:99999',
        'stock_minimo'     => 'required|int|min:0|max:1000',
    ];

    // ---------------- Catálogo público (tienda / selector) ----------------

    /** GET /catalogo  — juegos activos en orden alfabético (A-Z) para el selector estilo 360 */
    public static function catalogo(Request $req): void
    {
        $where = ['j.activo = 1', 'g.activo = 1'];
        $p = [];
        if ($q = $req->query('q')) { $where[] = '(j.titulo LIKE ? OR j.desarrollador LIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
        if ($g = $req->query('genero')) { $where[] = 'j.genero_id = ?'; $p[] = (int) $g; }
        $rows = Database::all(
            "SELECT j.id, j.sku, j.titulo, g.nombre AS genero, j.genero_id, j.desarrollador, j.anio_lanzamiento, j.clasificacion,
                    j.descripcion, j.precio, j.portada_url, (j.stock > 0) AS disponible,
                    CASE WHEN j.stock = 0 THEN 'agotado' WHEN j.stock <= j.stock_minimo THEN 'pocas' ELSE 'disponible' END AS existencia
               FROM juegos j JOIN generos g ON g.id = j.genero_id
              WHERE " . implode(' AND ', $where) . ' ORDER BY j.titulo ASC', $p);
        $generos = Database::all('SELECT g.id, g.nombre FROM generos g WHERE g.activo = 1
                                   AND EXISTS (SELECT 1 FROM juegos j WHERE j.genero_id = g.id AND j.activo = 1) ORDER BY g.nombre');
        Response::json([
            'tienda' => Config::get('nombre_tienda', 'Retro 360 Store'),
            'tasa_iva' => Config::iva(),
            'total' => count($rows),
            'generos' => $generos,
            'datos' => $rows,
        ]);
    }

    // ---------------- Administración ----------------

    /** GET /juegos?q=&genero=&estado=activos|inactivos|stock_bajo|agotados&sort=&dir=&page=&limit= */
    public static function index(Request $req): void
    {
        $where = ['1=1']; $p = [];
        if ($q = $req->query('q')) {
            $where[] = '(j.titulo LIKE ? OR j.sku LIKE ? OR j.desarrollador LIKE ? OR j.id = ?)';
            array_push($p, "%$q%", "%$q%", "%$q%", ctype_digit($q) ? (int) $q : 0);
        }
        if ($g = $req->query('genero')) { $where[] = 'j.genero_id = ?'; $p[] = (int) $g; }
        if ($c = $req->query('clasificacion')) { $where[] = 'j.clasificacion = ?'; $p[] = $c; }
        match ($req->query('estado', 'activos')) {
            'activos'    => $where[] = 'j.activo = 1',
            'inactivos'  => $where[] = 'j.activo = 0',
            'stock_bajo' => $where[] = 'j.activo = 1 AND j.stock <= j.stock_minimo',
            'agotados'   => $where[] = 'j.activo = 1 AND j.stock = 0',
            default      => null, // todos
        };
        [$page, $limit] = $req->pagination(10);
        $order = $req->sort(self::SORT, 'titulo') . ', j.id';
        Response::json(Database::paginate(self::SELECT, 'FROM juegos j JOIN generos g ON g.id = j.genero_id WHERE ' . implode(' AND ', $where), $p, $order, $page, $limit));
    }

    /** GET /juegos/{id} — incluye últimos movimientos y ventas del juego */
    public static function show(Request $req): void
    {
        $j = self::find($req->id());
        $j['movimientos'] = Database::all(
            'SELECT m.id, m.tipo, m.cantidad, m.stock_anterior, m.stock_nuevo, m.motivo, m.created_at, u.nombre AS usuario, v.folio
               FROM movimientos_inventario m JOIN usuarios u ON u.id = m.usuario_id LEFT JOIN ventas v ON v.id = m.venta_id
              WHERE m.juego_id = ? ORDER BY m.id DESC LIMIT 10', [$j['id']]);
        $j['vendidos'] = (int) Database::value(
            "SELECT COALESCE(SUM(d.cantidad),0) FROM venta_detalle d JOIN ventas v ON v.id = d.venta_id WHERE d.juego_id = ? AND v.estado = 'completada'", [$j['id']]);
        Response::json($j);
    }

    /** POST /juegos */
    public static function store(Request $req): void
    {
        $d = Validator::check($req->body(), self::RULES + ['stock' => 'required|int|min:0|max:10000']);
        $d['sku'] = strtoupper($d['sku']);
        self::assertGenero($d['genero_id']);
        self::assertSkuLibre($d['sku']);
        $id = Database::transaction(function () use ($d) {
            $id = Database::insert(
                'INSERT INTO juegos (sku, titulo, genero_id, desarrollador, anio_lanzamiento, clasificacion, descripcion, precio, stock, stock_minimo)
                 VALUES (?,?,?,?,?,?,?,?,?,?)',
                [$d['sku'], $d['titulo'], $d['genero_id'], $d['desarrollador'] ?? null, $d['anio_lanzamiento'] ?? null,
                 $d['clasificacion'], $d['descripcion'] ?? null, $d['precio'], $d['stock'], $d['stock_minimo']]);
            if ($d['stock'] > 0) {
                Database::exec("INSERT INTO movimientos_inventario (juego_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
                                VALUES (?,?,'entrada',?,0,?,'Alta de producto')", [$id, Auth::id(), $d['stock'], $d['stock']]);
            }
            return $id;
        });
        $nuevo = self::find($id);
        Bitacora::log('crear', 'juegos', $id, null, $nuevo);
        Response::created($nuevo);
    }

    /** PUT /juegos/{id} — actualización completa (el stock NO se edita aquí; se usa /stock para trazabilidad) */
    public static function update(Request $req): void
    {
        $antes = self::find($req->id());
        $d = Validator::check($req->body(), self::RULES + ['activo' => 'bool']);
        $d['sku'] = strtoupper($d['sku']);
        self::assertGenero($d['genero_id']);
        self::assertSkuLibre($d['sku'], $antes['id']);
        Database::exec(
            'UPDATE juegos SET sku=?, titulo=?, genero_id=?, desarrollador=?, anio_lanzamiento=?, clasificacion=?, descripcion=?,
                    precio=?, stock_minimo=?, activo=? WHERE id=?',
            [$d['sku'], $d['titulo'], $d['genero_id'], $d['desarrollador'] ?? null, $d['anio_lanzamiento'] ?? null,
             $d['clasificacion'], $d['descripcion'] ?? null, $d['precio'], $d['stock_minimo'], $d['activo'] ?? $antes['activo'], $antes['id']]);
        $despues = self::find($antes['id']);
        Bitacora::log('actualizar', 'juegos', $antes['id'], $antes, $despues);
        Response::json($despues);
    }

    /** PATCH /juegos/{id}/stock — entrada, salida o ajuste de inventario (transacción + movimiento) */
    public static function stock(Request $req): void
    {
        $id = $req->id();
        $d = Validator::check($req->body(), [
            'tipo'     => 'required|in:entrada,salida,ajuste',
            'cantidad' => 'required|int|min:0|max:10000',
            'motivo'   => 'required|string|min:3|max:255',
        ]);
        if ($d['tipo'] !== 'ajuste' && $d['cantidad'] < 1) throw HttpException::validation(['cantidad' => 'Debe ser mayor a 0.']);

        $res = Database::transaction(function () use ($id, $d) {
            $j = Database::one('SELECT id, titulo, stock, activo FROM juegos WHERE id = ? FOR UPDATE', [$id]);
            if (!$j) throw HttpException::notFound('El juego no existe.');
            $ant = (int) $j['stock'];
            $nuevo = match ($d['tipo']) {
                'entrada' => $ant + $d['cantidad'],
                'salida'  => $ant - $d['cantidad'],
                'ajuste'  => $d['cantidad'],          // en ajuste la cantidad es el conteo físico
            };
            if ($nuevo < 0) throw HttpException::conflict("No hay existencias suficientes: stock actual $ant.");
            if ($nuevo === $ant) throw HttpException::conflict('El ajuste no modifica el stock.');
            Database::exec('UPDATE juegos SET stock = ? WHERE id = ?', [$nuevo, $id]);
            Database::exec('INSERT INTO movimientos_inventario (juego_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo) VALUES (?,?,?,?,?,?,?)',
                [$id, Auth::id(), $d['tipo'], $nuevo - $ant, $ant, $nuevo, $d['motivo']]);
            return ['antes' => $ant, 'despues' => $nuevo];
        });
        Bitacora::log('inventario_' . $d['tipo'], 'juegos', $id, ['stock' => $res['antes']], ['stock' => $res['despues'], 'motivo' => $d['motivo']]);
        Response::json(self::find($id));
    }

    /** DELETE /juegos/{id} — baja lógica (activo = 0). Nunca se borra un juego con historial. */
    public static function destroy(Request $req): void
    {
        $antes = self::find($req->id());
        if (!$antes['activo']) throw HttpException::conflict('El juego ya está dado de baja.');
        Database::exec('UPDATE juegos SET activo = 0 WHERE id = ?', [$antes['id']]);
        Bitacora::log('baja', 'juegos', $antes['id'], ['activo' => 1], ['activo' => 0]);
        Response::json(['mensaje' => 'Juego dado de baja. Puedes reactivarlo editándolo.']);
    }

    /** POST /juegos/{id}/portada (multipart, campo "portada") — JPG/PNG/WEBP máx. 2 MB */
    public static function portada(Request $req): void
    {
        $j = self::find($req->id());
        $f = $_FILES['portada'] ?? null;
        if (!$f || $f['error'] !== UPLOAD_ERR_OK) throw HttpException::validation(['portada' => 'Selecciona una imagen válida.']);
        if ($f['size'] > 2 * 1024 * 1024) throw HttpException::validation(['portada' => 'La imagen no debe superar 2 MB.']);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        if (!$ext || !getimagesize($f['tmp_name'])) throw HttpException::validation(['portada' => 'Formato no permitido (JPG, PNG o WEBP).']);

        $dir = self::uploadsDir();
        $name = 'juego-' . $j['id'] . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) throw new RuntimeException('No se pudo guardar la portada');
        if ($j['portada_url'] && str_starts_with($j['portada_url'], 'uploads/portadas/')) @unlink(dirname($dir, 2) . '/' . $j['portada_url']);
        $url = "uploads/portadas/$name";
        Database::exec('UPDATE juegos SET portada_url = ? WHERE id = ?', [$url, $j['id']]);
        Bitacora::log('portada', 'juegos', $j['id'], ['portada_url' => $j['portada_url']], ['portada_url' => $url]);
        Response::json(self::find($j['id']));
    }

    // ---------------- helpers ----------------

    public static function find(int $id): array
    {
        $j = Database::one('SELECT ' . self::SELECT . ' FROM juegos j JOIN generos g ON g.id = j.genero_id WHERE j.id = ?', [$id]);
        if (!$j) throw HttpException::notFound('El juego no existe.');
        return $j;
    }

    private static function assertGenero(int $id): void
    {
        if (!Database::value('SELECT 1 FROM generos WHERE id = ? AND activo = 1', [$id])) {
            throw HttpException::validation(['genero_id' => 'El género no existe o está inactivo.']);
        }
    }

    private static function assertSkuLibre(string $sku, int $exceptId = 0): void
    {
        if (Database::value('SELECT 1 FROM juegos WHERE sku = ? AND id <> ?', [$sku, $exceptId])) {
            throw HttpException::conflict("Ya existe un juego con el SKU $sku.");
        }
    }

    private static function uploadsDir(): string
    {
        $dir = Env::get('UPLOADS_DIR') ?: ($GLOBALS['PUBLIC_DIR'] . '/uploads/portadas');
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        return $dir;
    }
}
