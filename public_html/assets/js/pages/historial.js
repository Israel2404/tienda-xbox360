(async function () {
  await Panel.init({ roles: ['admin'], title: 'Historial', subtitle: 'Bitácora de operaciones: quién hizo qué y cuándo' });
  const $ = (s) => document.querySelector(s);
  const esc = Api.esc;
  const st = { accion: '', entidad: '', desde: '', hasta: '', page: 1, limit: 20 };
  const tbody = $('#rows');
  let filtersReady = false;

  const pretty = (json) => {
    if (!json) return '—';
    try { const o = JSON.parse(json); return Object.entries(o).map(([k, v]) => `<b>${esc(k)}</b>: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).slice(0, 8).join('<br>'); }
    catch (e) { return esc(json); }
  };

  async function load() {
    Panel.rowState(tbody, 6, 'loading');
    try {
      const r = await Api.get('/bitacora', st);
      if (!filtersReady) {
        $('#fAccion').innerHTML = '<option value="">Todas las acciones</option>' + r.filtros.acciones.map((a) => `<option>${esc(a)}</option>`).join('');
        $('#fEntidad').innerHTML = '<option value="">Todas las entidades</option>' + r.filtros.entidades.map((a) => `<option>${esc(a)}</option>`).join('');
        filtersReady = true;
      }
      if (!r.datos.length) { Panel.rowState(tbody, 6, 'empty', 'Sin registros en el periodo.'); $('#pager').innerHTML = ''; return; }
      tbody.innerHTML = r.datos.map((b) => `<tr>
        <td>${Api.date(b.created_at)}</td><td>${esc(b.usuario || 'Sistema')}<br><small style="color:var(--muted)">${esc(b.ip || '')}</small></td>
        <td><span class="pill">${esc(b.accion)}</span></td><td>${esc(b.entidad)}${b.entidad_id ? ' #' + b.entidad_id : ''}</td>
        <td style="font-size:12px;max-width:260px">${pretty(b.datos_antes)}</td><td style="font-size:12px;max-width:260px">${pretty(b.datos_despues)}</td></tr>`).join('');
      Panel.pager($('#pager'), r, (p) => { st.page = p; load(); });
    } catch (e) { Panel.rowState(tbody, 6, 'error', e.message, load); }
  }
  Panel.bindFilters(document, st, load);
  load();
})();
