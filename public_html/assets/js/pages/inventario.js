(async function () {
  await Panel.init({ roles: ['admin', 'vendedor'], title: 'Inventario', subtitle: 'Movimientos de entradas, salidas, ventas y ajustes' });
  const $ = (s) => document.querySelector(s);
  const esc = Api.esc;
  const st = { q: '', tipo: '', desde: '', hasta: '', sort: 'fecha', dir: 'desc', page: 1, limit: 15 };
  const tbody = $('#rows');
  const tipos = { entrada: 'ok', salida: 'danger', ajuste: 'warn', venta: 'info', cancelacion: '' };

  async function load() {
    Panel.rowState(tbody, 7, 'loading');
    try {
      const r = await Api.get('/movimientos', st);
      if (!r.datos.length) { Panel.rowState(tbody, 7, 'empty', 'No hay movimientos con esos filtros.'); $('#pager').innerHTML = ''; return; }
      tbody.innerHTML = r.datos.map((m) => `<tr>
        <td>${Api.date(m.created_at)}</td>
        <td><a href="juegos.html?id=${m.juego_id}">${esc(m.titulo)}</a><br><small style="color:var(--muted)">${esc(m.sku)}</small></td>
        <td><span class="pill ${tipos[m.tipo]}">${esc(m.tipo)}</span></td>
        <td class="num" style="color:${m.cantidad < 0 ? '#ff8f86' : '#7ed957'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</td>
        <td class="num">${m.stock_anterior} → <b>${m.stock_nuevo}</b></td>
        <td>${esc(m.usuario)}</td><td>${m.folio ? esc(m.folio) : esc(m.motivo || '')}</td></tr>`).join('');
      Panel.pager($('#pager'), r, (p) => { st.page = p; load(); });
    } catch (e) { Panel.rowState(tbody, 7, 'error', e.message, load); }
  }
  Panel.bindFilters(document, st, load);
  Panel.sortable($('#table'), st, load);
  load();
})();
