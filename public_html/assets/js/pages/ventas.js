(async function () {
  const user = await Panel.init({ roles: ['admin', 'vendedor', 'cliente'], title: 'Ventas', subtitle: 'Consulta, filtros y cancelaciones' });
  const $ = (s, el = document) => el.querySelector(s);
  const esc = Api.esc;
  const isCliente = user.rol === 'cliente';
  if (isCliente) { document.querySelector('.page-head h1').textContent = 'mis compras'; document.querySelector('.page-head p').textContent = 'Historial de tus compras en línea'; }
  const st = { q: '', desde: '', hasta: '', estado: '', canal: '', metodo: '', sort: 'fecha', dir: 'desc', page: 1, limit: 10 };
  const tbody = $('#rows');
  if (isCliente) document.querySelectorAll('.staff-only').forEach((e) => e.remove());

  async function load() {
    const cols = isCliente ? 6 : 8;
    Panel.rowState(tbody, cols, 'loading');
    if (st.desde && st.hasta && st.desde > st.hasta) { Panel.rowState(tbody, cols, 'error', 'La fecha inicial no puede ser mayor que la final.'); return; }
    try {
      const r = await Api.get('/ventas', st);
      $('#resumen').textContent = `${r.resumen.ventas} venta(s) · ${Api.money(r.resumen.importe)} en ventas completadas`;
      if (!r.datos.length) { Panel.rowState(tbody, cols, 'empty', isCliente ? 'Aún no tienes compras. ¡Visita la tienda!' : 'No hay ventas con esos filtros.'); $('#pager').innerHTML = ''; return; }
      tbody.innerHTML = r.datos.map((v) => `<tr data-id="${v.id}">
        <td><b>${esc(v.folio)}</b></td><td>${Api.date(v.created_at)}</td>
        ${isCliente ? '' : `<td>${esc(v.cliente || '—')}</td><td>${esc(v.vendedor)}</td>`}
        <td><span class="pill ${v.canal === 'online' ? 'info' : 'ok'}">${esc(v.canal)}</span> ${esc(v.metodo_pago)}</td>
        <td class="num">${v.articulos}</td><td class="num">${Api.money(v.total)}</td>
        <td>${v.estado === 'cancelada' ? '<span class="pill danger">Cancelada</span>' : '<span class="pill ok">Completada</span>'}
          <button class="btn sm" data-a="ver" style="margin-left:6px">Ver</button></td></tr>`).join('');
      Panel.pager($('#pager'), r, (p) => { st.page = p; load(); });
    } catch (e) { Panel.rowState(tbody, cols, 'error', e.message, load); }
  }

  tbody.addEventListener('click', (e) => { const b = e.target.closest('[data-a="ver"]'); if (b) detail(Number(b.closest('tr').dataset.id)); });

  async function detail(id) {
    const m = Panel.modal('Detalle de venta', '<div class="state-box"><div class="spinner"></div>Cargando…</div>', { wide: true });
    try {
      const v = await Api.get('/ventas/' + id);
      const canCancel = Panel.can('admin') && v.estado === 'completada';
      $('.modal-body', m.el).innerHTML = `
        <dl class="dl"><dt>Folio</dt><dd><b>${esc(v.folio)}</b></dd><dt>Fecha</dt><dd>${Api.date(v.created_at)}</dd>
          <dt>Cliente</dt><dd>${esc(v.cliente || '—')} ${v.gamertag ? '(' + esc(v.gamertag) + ')' : ''}</dd>
          <dt>Registró</dt><dd>${esc(v.vendedor)} · canal ${esc(v.canal)}</dd><dt>Pago</dt><dd>${esc(v.metodo_pago)}</dd>
          <dt>Estado</dt><dd>${v.estado === 'cancelada' ? `<span class="pill danger">Cancelada</span> por ${esc(v.cancelada_por_nombre)} el ${Api.date(v.cancelada_at)}<br><i>${esc(v.motivo_cancelacion)}</i>` : '<span class="pill ok">Completada</span>'}</dd></dl>
        <div class="table-wrap" style="margin-top:14px"><table class="t"><thead><tr><th>SKU</th><th>Juego</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
          <tbody>${v.detalle.map((d) => `<tr><td>${esc(d.sku)}</td><td>${esc(d.titulo)}</td><td class="num">${d.cantidad}</td><td class="num">${Api.money(d.precio_unitario)}</td><td class="num">${Api.money(d.importe)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4" class="num">Subtotal</td><td class="num">${Api.money(v.subtotal)}</td></tr>
          <tr><td colspan="4" class="num">IVA (${Math.round(v.tasa_impuesto * 100)}%)</td><td class="num">${Api.money(v.impuesto)}</td></tr>
          <tr><td colspan="4" class="num"><b>Total</b></td><td class="num"><b>${Api.money(v.total)}</b></td></tr></tfoot></table></div>`;
      const foot = document.createElement('div'); foot.className = 'modal-foot';
      foot.innerHTML = `<button class="btn" onclick="window.print()">Imprimir</button>${canCancel ? '<button class="btn danger" id="cancelV">Cancelar venta</button>' : ''}`;
      m.el.appendChild(foot);
      if (canCancel) $('#cancelV', m.el).onclick = async () => {
        const motivo = await Panel.confirm('Cancelar venta', `¿Desea cancelar la venta <b>${esc(v.folio)}</b>? Las unidades regresarán al inventario.`, 'Cancelar venta', { danger: true, input: 'Motivo de la cancelación' });
        if (!motivo) return;
        try { await Api.patch(`/ventas/${id}/cancelar`, { motivo }); Panel.toast('Venta cancelada e inventario restituido.'); m.close(); load(); }
        catch (e) { Panel.toast(e.message, 'error'); }
      };
    } catch (e) { Panel.boxState($('.modal-body', m.el), 'error', e.message); }
  }

  Panel.bindFilters(document, st, load);
  Panel.sortable($('#table'), st, load);
  load();
  const qid = new URLSearchParams(location.search).get('id');
  if (qid) detail(Number(qid));
})();
