<?php
declare(strict_types=1);

final class DashboardController
{
    /** GET /dashboard — todos los indicadores salen de la BD */
    public static function index(Request $req): void
    {
        $hoy = date('Y-m-d');
        $mes = date('Y-m-01');
        $kpis = Database::one(
            "SELECT
               (SELECT COUNT(*) FROM ventas WHERE estado='completada' AND created_at >= ?) AS ventas_hoy,
               (SELECT COALESCE(SUM(total),0) FROM ventas WHERE estado='completada' AND created_at >= ?) AS ingresos_hoy,
               (SELECT COALESCE(SUM(total),0) FROM ventas WHERE estado='completada' AND created_at >= ?) AS ingresos_mes,
               (SELECT COUNT(*) FROM ventas WHERE estado='completada' AND created_at >= ?) AS ventas_mes,
               (SELECT COUNT(*) FROM ventas WHERE estado='cancelada' AND created_at >= ?) AS canceladas_mes,
               (SELECT COUNT(*) FROM juegos WHERE activo=1) AS juegos_activos,
               (SELECT COALESCE(SUM(stock),0) FROM juegos WHERE activo=1) AS unidades_inventario,
               (SELECT COUNT(*) FROM juegos WHERE activo=1 AND stock <= stock_minimo) AS stock_bajo,
               (SELECT COUNT(*) FROM juegos WHERE activo=1 AND stock = 0) AS agotados,
               (SELECT COUNT(*) FROM clientes WHERE activo=1) AS clientes,
               (SELECT COUNT(*) FROM usuarios WHERE activo=1) AS usuarios",
            ["$hoy 00:00:00", "$hoy 00:00:00", "$mes 00:00:00", "$mes 00:00:00", "$mes 00:00:00"]);
        $kpis['ticket_promedio'] = $kpis['ventas_mes'] ? round($kpis['ingresos_mes'] / $kpis['ventas_mes'], 2) : 0;

        $serie = Database::all(
            "SELECT DATE(created_at) AS fecha, COUNT(*) AS ventas, SUM(total) AS total
               FROM ventas WHERE estado='completada' AND created_at >= ? GROUP BY DATE(created_at) ORDER BY fecha",
            [date('Y-m-d', strtotime('-29 days')) . ' 00:00:00']);
        $porGenero = Database::all(
            "SELECT g.nombre AS genero, SUM(d.cantidad) AS unidades, SUM(d.cantidad*d.precio_unitario) AS importe
               FROM venta_detalle d JOIN ventas v ON v.id=d.venta_id JOIN juegos j ON j.id=d.juego_id JOIN generos g ON g.id=j.genero_id
              WHERE v.estado='completada' AND v.created_at >= ? GROUP BY g.id ORDER BY unidades DESC",
            [date('Y-m-d', strtotime('-29 days')) . ' 00:00:00']);
        $stockBajo = Database::all(
            'SELECT id, sku, titulo, stock, stock_minimo FROM juegos WHERE activo=1 AND stock <= stock_minimo ORDER BY stock, titulo LIMIT 8');
        $top = Database::all(
            "SELECT j.titulo, SUM(d.cantidad) AS unidades FROM venta_detalle d JOIN ventas v ON v.id=d.venta_id JOIN juegos j ON j.id=d.juego_id
              WHERE v.estado='completada' AND v.created_at >= ? GROUP BY j.id ORDER BY unidades DESC LIMIT 5",
            [date('Y-m-d', strtotime('-29 days')) . ' 00:00:00']);
        $ultimas = Database::all(
            'SELECT v.id, v.folio, v.total, v.estado, v.canal, v.created_at, c.nombre AS cliente FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id ORDER BY v.id DESC LIMIT 6');
        $actividad = Auth::user()['rol'] === Auth::ADMIN ? Database::all(
            'SELECT b.accion, b.entidad, b.entidad_id, b.created_at, u.nombre AS usuario FROM bitacora b LEFT JOIN usuarios u ON u.id=b.usuario_id ORDER BY b.id DESC LIMIT 8') : [];

        // Serie completa de 30 días (rellena días sin ventas con 0)
        $map = array_column($serie, null, 'fecha');
        $dias = [];
        for ($i = 29; $i >= 0; $i--) {
            $f = date('Y-m-d', strtotime("-$i days"));
            $dias[] = ['fecha' => $f, 'ventas' => (int) ($map[$f]['ventas'] ?? 0), 'total' => (float) ($map[$f]['total'] ?? 0)];
        }

        Response::json([
            'kpis' => $kpis, 'ventas_30_dias' => $dias, 'ventas_por_genero' => $porGenero,
            'stock_bajo' => $stockBajo, 'top_juegos' => $top, 'ultimas_ventas' => $ultimas, 'actividad' => $actividad,
        ]);
    }
}
