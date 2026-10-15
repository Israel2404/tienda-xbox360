(async function () {
  await Panel.init({ roles: ['admin', 'vendedor'], title: 'Clientes', subtitle: 'Clientes de mostrador y en línea',
    actions: '<button class="btn primary" id="newBtn">＋ Nuevo cliente</button>' });
  const $ = (s, el = document) => el.querySelector(s);
  const esc = Api.esc;
  const st = { q: '', estado: 'activos', sort: 'nombre', dir: 'asc', page: 1, limit: 10 };
  const tbody = $('#rows');

  async function load() {
    Panel.rowState(tbody, 7, 'loading');
    try {
      const r = await Api.get('/clientes', st);
      if (!r.datos.length) { Panel.rowState(tbody, 7, 'empty', 'No hay clientes que coincidan con la búsqueda.'); $('#pager').innerHTML = ''; return; }
      tbody.innerHTML = r.datos.map((c) => `<tr class="${c.activo ? '' : 'inactive'}" data-id="${c.id}">
        <td><b>${esc(c.nombre)}</b>${c.usuario_id ? ' <span class="pill info">cuenta en línea</span>' : ''}<br><small style="color:var(--muted)">${esc(c.gamertag || '')}</small></td>
        <td>${esc(c.email || '—')}</td><td>${esc(c.telefono || '—')}</td>
        <td class="num">${c.compras}</td><td class="num">${Api.money(c.total_comprado)}</td><td>${Panel.pillEstado(c.activo)}</td>
        <td><div class="btn-row"><button class="btn sm" data-a="ver">Ver</button><button class="btn sm" data-a="edit">Editar</button>
        ${Panel.can('admin') && c.activo ? '<button class="btn sm danger" data-a="del">Baja</button>' : ''}</div></td></tr>`).join('');
      Panel.pager($('#pager'), r, (p) => { st.page = p; load(); });
    } catch (e) { Panel.rowState(tbody, 7, 'error', e.message, load); }
  }

  tbody.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = Number(b.closest('tr').dataset.id);
    if (b.dataset.a === 'edit') return form(id);
    if (b.dataset.a === 'ver') return ver(id);
    if (!(await Panel.confirm('Dar de baja cliente', '¿Está seguro de dar de baja este cliente? Su historial de compras se conserva.', 'Dar de baja', { danger: true }))) return;
    try { const r = await Api.del('/clientes/' + id); Panel.toast(r.mensaje); load(); } catch (err) { Panel.toast(err.message, 'error'); }
  });

  async function ver(id) {
    try {
      const c = await Api.get('/clientes/' + id);
      Panel.modal('Cliente', `<dl class="dl"><dt>Nombre</dt><dd>${esc(c.nombre)}</dd><dt>Gamertag</dt><dd>${esc(c.gamertag || '—')}</dd>
        <dt>Correo</dt><dd>${esc(c.email || '—')}</dd><dt>Teléfono</dt><dd>${esc(c.telefono || '—')}</dd><dt>Alta</dt><dd>${Api.date(c.created_at)}</dd></dl>
        <h3 style="font-weight:400;margin:16px 0 8px">Últimas compras</h3>
        <div class="table-wrap"><table class="t" style="min-width:0"><tbody>${c.ultimas_compras.map((v) => `<tr><td><a href="ventas.html?id=${v.id}">${esc(v.folio)}</a></td><td>${Api.date(v.created_at)}</td>
          <td class="num">${Api.money(v.total)}</td><td>${v.estado === 'cancelada' ? '<span class="pill danger">Cancelada</span>' : '<span class="pill ok">Completada</span>'}</td></tr>`).join('')
          || '<tr class="state"><td>Sin compras.</td></tr>'}</tbody></table></div>`);
    } catch (e) { Panel.toast(e.message, 'error'); }
  }

  async function form(id) {
    let c = { nombre: '', email: '', telefono: '', gamertag: '', activo: 1 };
    if (id) { try { c = await Api.get('/clientes/' + id); } catch (e) { return Panel.toast(e.message, 'error'); } }
    const m = Panel.modal(id ? 'Editar cliente' : 'Nuevo cliente', `
      <form id="f" novalidate class="form-grid">
        <div class="field full"><label>Nombre <span class="req">*</span></label><input class="input" name="nombre" required minlength="3" maxlength="100" value="${esc(c.nombre)}"><div class="err"></div></div>
        <div class="field"><label>Correo</label><input class="input" name="email" type="email" maxlength="150" value="${esc(c.email || '')}"><div class="err"></div></div>
        <div class="field"><label>Teléfono</label><input class="input" name="telefono" maxlength="20" pattern="[0-9 +\\-]{7,20}" value="${esc(c.telefono || '')}"><div class="err"></div></div>
        <div class="field"><label>Gamertag</label><input class="input" name="gamertag" maxlength="30" value="${esc(c.gamertag || '')}"><div class="err"></div></div>
        ${id ? `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="activo" ${c.activo ? 'checked' : ''}> Activo</label>` : ''}
      </form>`, { foot: '<button class="btn" data-x>Cancelar</button><button class="btn primary" id="ok">Guardar</button>' });
    const f = $('#f', m.el);
    $('#ok', m.el).onclick = async () => {
      if (!Panel.validate(f)) return;
      try { await (id ? Api.put('/clientes/' + id, Panel.formData(f)) : Api.post('/clientes', Panel.formData(f))); Panel.toast('Cliente guardado.'); m.close(); load(); }
      catch (e) { Panel.showErrors(f, e); }
    };
  }

  $('#newBtn').onclick = () => form(null);
  Panel.bindFilters(document, st, load);
  Panel.sortable($('#table'), st, load);
  load();
})();
