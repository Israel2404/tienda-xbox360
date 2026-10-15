(async function () {
  await Panel.init({ roles: ['admin', 'vendedor'], title: 'Géneros', subtitle: 'Categorías del catálogo',
    actions: '<button class="btn primary" id="newBtn" hidden>＋ Nuevo género</button>' });
  const $ = (s, el = document) => el.querySelector(s);
  const esc = Api.esc;
  const isAdmin = Panel.can('admin');
  const st = { q: '', estado: 'activos', sort: 'nombre', dir: 'asc', page: 1, limit: 20 };
  const tbody = $('#rows');

  async function load() {
    Panel.rowState(tbody, 5, 'loading');
    try {
      const r = await Api.get('/generos', st);
      if (!r.datos.length) { Panel.rowState(tbody, 5, 'empty', 'No hay géneros que coincidan.'); $('#pager').innerHTML = ''; return; }
      tbody.innerHTML = r.datos.map((g) => `<tr class="${g.activo ? '' : 'inactive'}" data-id="${g.id}">
        <td>${g.id}</td><td><b>${esc(g.nombre)}</b><br><small style="color:var(--muted)">${esc(g.descripcion || '')}</small></td>
        <td class="num">${g.juegos}</td><td>${Panel.pillEstado(g.activo)}</td>
        <td>${isAdmin ? `<div class="btn-row"><button class="btn sm" data-a="edit">Editar</button><button class="btn sm danger" data-a="del">Eliminar</button></div>` : '—'}</td></tr>`).join('');
      Panel.pager($('#pager'), r, (p) => { st.page = p; load(); });
    } catch (e) { Panel.rowState(tbody, 5, 'error', e.message, load); }
  }

  tbody.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = Number(b.closest('tr').dataset.id);
    if (b.dataset.a === 'edit') return form(id);
    if (!(await Panel.confirm('Eliminar género', '¿Está seguro de eliminar este registro? Si tiene historial se desactivará en lugar de borrarse.', 'Eliminar', { danger: true }))) return;
    try { const r = await Api.del('/generos/' + id); Panel.toast(r.mensaje); load(); } catch (err) { Panel.toast(err.message, 'error'); }
  });

  async function form(id) {
    let g = { nombre: '', descripcion: '', activo: 1 };
    if (id) { try { g = await Api.get('/generos/' + id); } catch (e) { return Panel.toast(e.message, 'error'); } }
    const m = Panel.modal(id ? 'Editar género' : 'Nuevo género', `
      <form id="f" novalidate>
        <div class="field"><label>Nombre <span class="req">*</span></label><input class="input" name="nombre" required minlength="3" maxlength="60" value="${esc(g.nombre)}"><div class="err"></div></div>
        <div class="field" style="margin-top:10px"><label>Descripción</label><textarea class="input" name="descripcion" maxlength="255">${esc(g.descripcion || '')}</textarea><div class="err"></div></div>
        ${id ? `<label style="display:flex;gap:8px;margin-top:10px;align-items:center"><input type="checkbox" name="activo" ${g.activo ? 'checked' : ''}> Activo</label>` : ''}
      </form>`, { foot: '<button class="btn" data-x>Cancelar</button><button class="btn primary" id="ok">Guardar</button>' });
    const f = $('#f', m.el);
    $('#ok', m.el).onclick = async () => {
      if (!Panel.validate(f)) return;
      try { await (id ? Api.put('/generos/' + id, Panel.formData(f)) : Api.post('/generos', Panel.formData(f))); Panel.toast('Género guardado.'); m.close(); load(); }
      catch (e) { Panel.showErrors(f, e); }
    };
  }

  if (isAdmin) { $('#newBtn').hidden = false; $('#newBtn').onclick = () => form(null); }
  Panel.bindFilters(document, st, load);
  Panel.sortable($('#table'), st, load);
  load();
})();
