(async function () {
  const user = await Panel.init({ roles: ['admin', 'vendedor'], title: 'Juegos', subtitle: 'Catálogo de títulos de Xbox 360',
    actions: '<button class="btn primary" id="newBtn" hidden>＋ Nuevo juego</button>' });
  const $ = (s, el = document) => el.querySelector(s);
  const esc = Api.esc;
  const isAdmin = Panel.can('admin');
  const st = { q: '', genero: '', clasificacion: '', estado: 'activos', sort: 'titulo', dir: 'asc', page: 1, limit: '10' };
  let generos = [];
  const tbody = $('#rows');

  async function loadGeneros() {
    try { generos = (await Api.get('/generos', { limit: 100 })).datos; } catch (e) { generos = []; }
    $('#fGenero').innerHTML = '<option value="">Todos los géneros</option>' + generos.map((g) => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('');
  }

  async function load() {
    Panel.rowState(tbody, 7, 'loading');
    try {
      const r = await Api.get('/juegos', st);
      if (!r.datos.length) { Panel.rowState(tbody, 7, 'empty', 'No se encontraron juegos con esos filtros.'); Panel.pager($('#pager'), r, go); return; }
      tbody.innerHTML = r.datos.map(row).join('');
      Panel.pager($('#pager'), r, go);
    } catch (e) { Panel.rowState(tbody, 7, 'error', e.message, load); $('#pager').innerHTML = ''; }
  }
  const go = (p) => { st.page = p; load(); };

  function row(j) {
    const stockPill = j.stock == 0 ? 'danger' : j.stock_bajo ? 'warn' : 'ok';
    return `<tr class="${j.activo ? '' : 'inactive'}" data-id="${j.id}">
      <td><div class="cell-game"><div class="mini-cover">${Cover(j)}</div><div>${esc(j.titulo)}<small>${esc(j.sku)} · ${esc(j.desarrollador || '')}</small></div></div></td>
      <td>${esc(j.genero)}</td><td>${j.anio_lanzamiento || '—'}</td><td><span class="pill">${esc(j.clasificacion)}</span></td>
      <td class="num">${Api.money(j.precio)}</td>
      <td class="num"><span class="pill ${stockPill}">${j.stock}</span></td>
      <td><div class="btn-row">
        <button class="btn sm" data-a="ver">Ver</button>
        ${isAdmin ? `<button class="btn sm" data-a="editar">Editar</button><button class="btn sm" data-a="stock">Stock</button>
          ${j.activo ? '<button class="btn sm danger" data-a="baja">Baja</button>' : '<button class="btn sm" data-a="reactivar">Reactivar</button>'}` : ''}
      </div></td></tr>`;
  }

  tbody.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = Number(b.closest('tr').dataset.id);
    const a = b.dataset.a;
    if (a === 'ver') return detail(id);
    if (a === 'editar') return form(id);
    if (a === 'stock') return stockModal(id);
    if (a === 'baja') {
      if (!(await Panel.confirm('Dar de baja', '¿Está seguro de dar de baja este juego? Dejará de mostrarse en la tienda, pero se conserva su historial.', 'Dar de baja', { danger: true }))) return;
      try { const r = await Api.del('/juegos/' + id); Panel.toast(r.mensaje); load(); } catch (err) { Panel.toast(err.message, 'error'); }
    }
    if (a === 'reactivar') {
      try { const j = await Api.get('/juegos/' + id); await Api.put('/juegos/' + id, { ...pick(j), activo: true }); Panel.toast('Juego reactivado.'); load(); }
      catch (err) { Panel.toast(err.message, 'error'); }
    }
  });

  const pick = (j) => ({ sku: j.sku, titulo: j.titulo, genero_id: j.genero_id, desarrollador: j.desarrollador, anio_lanzamiento: j.anio_lanzamiento,
    clasificacion: j.clasificacion, descripcion: j.descripcion, precio: Number(j.precio), stock_minimo: j.stock_minimo });

  async function detail(id) {
    const m = Panel.modal('Detalle del juego', '<div class="state-box"><div class="spinner"></div>Cargando…</div>', { wide: true });
    try {
      const j = await Api.get('/juegos/' + id);
      $('.modal-body', m.el).innerHTML = `
        <div style="display:grid;grid-template-columns:160px 1fr;gap:18px">
          <div style="height:224px">${Cover(j)}</div>
          <dl class="dl">
            <dt>Título</dt><dd><b>${esc(j.titulo)}</b></dd><dt>SKU</dt><dd>${esc(j.sku)}</dd>
            <dt>Género</dt><dd>${esc(j.genero)}</dd><dt>Desarrollador</dt><dd>${esc(j.desarrollador || '—')}</dd>
            <dt>Año / ESRB</dt><dd>${j.anio_lanzamiento || '—'} · ${esc(j.clasificacion)}</dd>
            <dt>Precio</dt><dd>${Api.money(j.precio)} + IVA</dd>
            <dt>Stock</dt><dd>${j.stock} (mínimo ${j.stock_minimo}) ${j.stock_bajo ? '<span class="pill warn">Stock bajo</span>' : ''}</dd>
            <dt>Vendidos</dt><dd>${j.vendidos} unidades</dd><dt>Estado</dt><dd>${Panel.pillEstado(j.activo)}</dd>
            <dt>Descripción</dt><dd>${esc(j.descripcion || '—')}</dd>
          </dl>
        </div>
        <h3 style="margin:18px 0 8px;font-weight:400">Últimos movimientos de inventario</h3>
        <div class="table-wrap"><table class="t"><thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Cant.</th><th class="num">Stock</th><th>Usuario</th><th>Referencia</th></tr></thead>
        <tbody>${j.movimientos.map((mv) => `<tr><td>${Api.date(mv.created_at)}</td><td>${esc(mv.tipo)}</td>
          <td class="num" style="color:${mv.cantidad < 0 ? '#ff8f86' : '#7ed957'}">${mv.cantidad > 0 ? '+' : ''}${mv.cantidad}</td>
          <td class="num">${mv.stock_anterior} → ${mv.stock_nuevo}</td><td>${esc(mv.usuario)}</td><td>${esc(mv.folio || mv.motivo || '')}</td></tr>`).join('')
          || '<tr class="state"><td colspan="6">Sin movimientos.</td></tr>'}</tbody></table></div>
        ${isAdmin ? `<div class="field" style="margin-top:16px"><label>Portada (JPG, PNG o WEBP, máx. 2 MB)</label>
          <div class="btn-row"><input type="file" id="cover" accept="image/jpeg,image/png,image/webp" class="input" style="max-width:320px"><button class="btn" id="upCover">Subir portada</button></div><div class="err" id="coverErr"></div></div>` : ''}`;
      if (isAdmin) $('#upCover', m.el).onclick = async () => {
        const f = $('#cover', m.el).files[0];
        if (!f) { $('#coverErr', m.el).textContent = 'Selecciona una imagen.'; return; }
        if (f.size > 2 * 1024 * 1024) { $('#coverErr', m.el).textContent = 'La imagen supera 2 MB.'; return; }
        const fd = new FormData(); fd.append('portada', f);
        try { await Api.post(`/juegos/${id}/portada`, fd); Panel.toast('Portada actualizada.'); m.close(); load(); }
        catch (err) { $('#coverErr', m.el).textContent = err.errors?.portada || err.message; }
      };
    } catch (e) { Panel.boxState($('.modal-body', m.el), 'error', e.message); }
  }

  async function form(id) {
    let j = { clasificacion: 'T', stock: 0, stock_minimo: 3, activo: 1 };
    if (id) { try { j = await Api.get('/juegos/' + id); } catch (e) { return Panel.toast(e.message, 'error'); } }
    const opt = (v, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${v}</option>`;
    const m = Panel.modal(id ? 'Editar juego' : 'Nuevo juego', `
      <form id="gForm" novalidate class="form-grid">
        <div class="field"><label>SKU <span class="req">*</span></label><input class="input" name="sku" required maxlength="20" pattern="[A-Za-z0-9\\-]+" value="${esc(j.sku || '')}"><div class="err"></div></div>
        <div class="field"><label>Género <span class="req">*</span></label><select class="input" name="genero_id" required>
          <option value="">Selecciona…</option>${generos.map((g) => `<option value="${g.id}" ${g.id === j.genero_id ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select><div class="err"></div></div>
        <div class="field full"><label>Título <span class="req">*</span></label><input class="input" name="titulo" required minlength="2" maxlength="150" value="${esc(j.titulo || '')}"><div class="err"></div></div>
        <div class="field"><label>Desarrollador</label><input class="input" name="desarrollador" maxlength="100" value="${esc(j.desarrollador || '')}"><div class="err"></div></div>
        <div class="field"><label>Año de lanzamiento</label><input class="input" name="anio_lanzamiento" type="number" min="2005" max="2016" value="${j.anio_lanzamiento || ''}"><div class="err"></div></div>
        <div class="field"><label>Clasificación ESRB <span class="req">*</span></label><select class="input" name="clasificacion" required>${['E', 'E10+', 'T', 'M'].map((v) => opt(v, j.clasificacion)).join('')}</select><div class="err"></div></div>
        <div class="field"><label>Precio (MXN, sin IVA) <span class="req">*</span></label><input class="input" name="precio" type="number" required min="1" max="99999" step="0.01" value="${j.precio ?? ''}"><div class="err"></div></div>
        ${id ? '' : `<div class="field"><label>Stock inicial <span class="req">*</span></label><input class="input" name="stock" type="number" required min="0" max="10000" step="1" value="0"><div class="err"></div></div>`}
        <div class="field"><label>Stock mínimo <span class="req">*</span></label><input class="input" name="stock_minimo" type="number" required min="0" max="1000" step="1" value="${j.stock_minimo}"><div class="err"></div></div>
        <div class="field full"><label>Descripción</label><textarea class="input" name="descripcion" maxlength="2000">${esc(j.descripcion || '')}</textarea><div class="err"></div></div>
        ${id ? '<p class="full" style="color:var(--muted);margin:0">El stock se modifica desde el botón <b>Stock</b> para dejar registro del movimiento.</p>' : ''}
      </form>`, { wide: true, foot: '<button class="btn" data-x>Cancelar</button><button class="btn primary" id="save">Guardar</button>' });
    const f = $('#gForm', m.el);
    $('#save', m.el).onclick = async () => {
      if (!Panel.validate(f)) return;
      const data = Panel.formData(f);
      data.genero_id = Number(data.genero_id);
      if (id) data.activo = !!j.activo;
      $('#save', m.el).disabled = true;
      try {
        await (id ? Api.put('/juegos/' + id, data) : Api.post('/juegos', data));
        Panel.toast(id ? 'Juego actualizado.' : 'Juego registrado.'); m.close(); load();
      } catch (e) { Panel.showErrors(f, e); $('#save', m.el).disabled = false; }
    };
  }

  async function stockModal(id) {
    let j; try { j = await Api.get('/juegos/' + id); } catch (e) { return Panel.toast(e.message, 'error'); }
    const m = Panel.modal('Movimiento de inventario', `
      <p><b>${esc(j.titulo)}</b> · stock actual <span class="pill">${j.stock}</span></p>
      <form id="sForm" novalidate class="form-grid">
        <div class="field"><label>Tipo <span class="req">*</span></label><select class="input" name="tipo" id="sTipo">
          <option value="entrada">Entrada (compra a proveedor)</option><option value="salida">Salida (merma / daño)</option><option value="ajuste">Ajuste por conteo físico</option></select><div class="err"></div></div>
        <div class="field"><label id="sLbl">Cantidad <span class="req">*</span></label><input class="input" name="cantidad" type="number" min="1" max="10000" step="1" required><div class="err"></div></div>
        <div class="field full"><label>Motivo <span class="req">*</span></label><input class="input" name="motivo" required minlength="3" maxlength="255" placeholder="Ej. Pedido proveedor #123"><div class="err"></div></div>
        <p class="full" id="sPrev" style="margin:0;color:var(--muted)"></p>
      </form>`, { foot: '<button class="btn" data-x>Cancelar</button><button class="btn primary" id="sOk">Registrar</button>' });
    const f = $('#sForm', m.el), tipo = $('#sTipo', m.el), cant = f.querySelector('[name=cantidad]');
    const prev = () => {
      const c = Number(cant.value || 0);
      const n = tipo.value === 'entrada' ? j.stock + c : tipo.value === 'salida' ? j.stock - c : c;
      $('#sLbl', m.el).innerHTML = (tipo.value === 'ajuste' ? 'Existencia contada' : 'Cantidad') + ' <span class="req">*</span>';
      cant.min = tipo.value === 'ajuste' ? 0 : 1;
      $('#sPrev', m.el).innerHTML = cant.value === '' ? '' : `Stock resultante: <b style="color:${n < 0 ? '#ff8f86' : '#7ed957'}">${n}</b>${n < 0 ? ' — no hay existencias suficientes' : ''}`;
    };
    tipo.onchange = prev; cant.oninput = prev;
    $('#sOk', m.el).onclick = async () => {
      if (!Panel.validate(f)) return;
      try { await Api.patch(`/juegos/${id}/stock`, Panel.formData(f)); Panel.toast('Inventario actualizado.'); m.close(); load(); }
      catch (e) { Panel.showErrors(f, e); }
    };
  }

  if (isAdmin) { $('#newBtn').hidden = false; $('#newBtn').onclick = () => form(null); }
  await loadGeneros();
  Panel.bindFilters(document, st, load);
  Panel.sortable($('#table'), st, load);
  load();
  const qs = new URLSearchParams(location.search);
  if (qs.get('stock') && isAdmin) stockModal(Number(qs.get('stock')));
  if (qs.get('id')) detail(Number(qs.get('id')));
})();
