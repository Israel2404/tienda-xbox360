<?php
declare(strict_types=1);

final class ReporteController
{
    /** GET /reportes/ventas?desde=&hasta=&agrupar=dia|semana|mes — Reporte 1: ventas por periodo */
    public static function ventas(Request $req): void
    {
        [$desde, $hasta] = Validator::dateRange($req);
        $fmt = match ($req->query('agrupar', 'dia')) {
            'semana' => "DATE_FORMAT(v.created_at, '%x-S%v')",
            'mes'    => "DATE_FORMAT(v.created_at, '%Y-%m')",
            default  => 'DATE(v.created_at)',
        };
        $p = ["$desde 00:00:00", "$hasta 23:59:59"];
        $serie = Database::all(
            "SELECT $fmt AS periodo, COUNT(*) AS ventas, SUM(v.subtotal) AS subtotal, SUM(v.impuesto) AS impuesto, SUM(v.total) AS total
               FROM ventas v WHERE v.estado='completada' AND v.created_at BETWEEN ? AND ? GROUP BY periodo ORDER BY periodo", $p);
        $resumen = Database::one(
            "SELECT COUNT(CASE WHEN estado='completada' THEN 1 END) AS ventas,
                    COUNT(CASE WHEN estado='cancelada' THEN 1 END) AS canceladas,
                    COALESCE(SUM(CASE WHEN estado='completada' THEN total END),0) AS total,
                    COALESCE(SUM(CASE WHEN estado='completada' THEN impuesto END),0) AS impuesto,
                    COALESCE(AVG(CASE WHEN estado='completada' THEN total END),0) AS ticket_promedio
               FROM ventas WHERE created_at BETWEEN ? AND ?", $p);
        $porCanal = Database::all("SELECT canal, COUNT(*) AS ventas, SUM(total) AS total FROM ventas WHERE estado='completada' AND created_at BETWEEN ? AND ? GROUP BY canal", $p);
        $porMetodo = Database::all("SELECT metodo_pago, COUNT(*) AS ventas, SUM(total) AS total FROM ventas WHERE estado='completada' AND created_at BETWEEN ? AND ? GROUP BY metodo_pago", $p);
        $porVendedor = Database::all(
            "SELECT u.nombre AS vendedor, COUNT(*) AS ventas, SUM(v.total) AS total FROM ventas v JOIN usuarios u ON u.id=v.usuario_id
              WHERE v.estado='completada' AND v.created_at BETWEEN ? AND ? GROUP BY u.id ORDER BY total DESC", $p);
        Response::json(compact('desde', 'hasta', 'resumen', 'serie', 'porCanal', 'porMetodo', 'porVendedor'));
    }

    /** GET /reportes/juegos?desde=&hasta=&limite= — Reporte 2: juegos y géneros más vendidos */
    public static function juegos(Request $req): void
    {
        [$desde, $hasta] = Validator::dateRange($req);
        $lim = min(50, max(5, (int) $req->query('limite', '10')));
        $p = ["$desde 00:00:00", "$hasta 23:59:59"];
        $top = Database::all(
            "SELECT j.id, j.sku, j.titulo, g.nombre AS genero, SUM(d.cantidad) AS unidades, SUM(d.cantidad*d.precio_unitario) AS importe
               FROM venta_detalle d JOIN ventas v ON v.id=d.venta_id JOIN juegos j ON j.id=d.juego_id JOIN generos g ON g.id=j.genero_id
              WHERE v.estado='completada' AND v.created_at BETWEEN ? AND ?
              GROUP BY j.id ORDER BY unidades DESC, importe DESC LIMIT $lim", $p);
        $generos = Database::all(
            "SELECT g.nombre AS genero, SUM(d.cantidad) AS unidades, SUM(d.cantidad*d.precio_unitario) AS importe
               FROM venta_detalle d JOIN ventas v ON v.id=d.venta_id JOIN juegos j ON j.id=d.juego_id JOIN generos g ON g.id=j.genero_id
              WHERE v.estado='completada' AND v.created_at BETWEEN ? AND ? GROUP BY g.id ORDER BY unidades DESC", $p);
        $sinVentas = Database::all(
            "SELECT j.id, j.sku, j.titulo, j.stock FROM juegos j WHERE j.activo=1 AND NOT EXISTS (
               SELECT 1 FROM venta_detalle d JOIN ventas v ON v.id=d.venta_id WHERE d.juego_id=j.id AND v.estado='completada' AND v.created_at BETWEEN ? AND ?)
             ORDER BY j.titulo", $p);
        Response::json(compact('desde', 'hasta', 'top', 'generos', 'sinVentas'));
    }

    /** GET /reportes/inventario — Reporte 3: inventario valorizado y alertas */
    public static function inventario(Request $req): void
    {
        $porGenero = Database::all(
            'SELECT g.nombre AS genero, COUNT(j.id) AS titulos, SUM(j.stock) AS unidades, SUM(j.stock*j.precio) AS valor
               FROM juegos j JOIN generos g ON g.id=j.genero_id WHERE j.activo=1 GROUP BY g.id ORDER BY valor DESC');
        $alertas = Database::all(
            "SELECT j.id, j.sku, j.titulo, j.stock, j.stock_minimo, CASE WHEN j.stock=0 THEN 'Agotado' ELSE 'Stock bajo' END AS alerta
               FROM juegos j WHERE j.activo=1 AND j.stock <= j.stock_minimo ORDER BY j.stock, j.titulo");
        $totales = Database::one('SELECT COUNT(*) AS titulos, COALESCE(SUM(stock),0) AS unidades, COALESCE(SUM(stock*precio),0) AS valor FROM juegos WHERE activo=1');
        Response::json(compact('totales', 'porGenero', 'alertas'));
    }
}
