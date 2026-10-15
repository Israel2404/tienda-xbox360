(async function () {
  const me = await Panel.init({ roles: ['admin'], title: 'Usuarios', subtitle: 'Cuentas del sistema y roles (RBAC)',
    actions: '<button class="btn primary" id="newBtn">＋ Nuevo usuario</button>' });
  const $ = (s, el = document) => el.querySelector(s);
  const esc = Api.esc;
  const st = { q: '', rol: '', estado: 'todos', sort: 'nombre', dir: 'asc', page: 1, limit: 10 };
  const tbody = $('#rows');
  let roles = [];

  async function load() {
    Panel.rowState(tbody, 6, 'loading');
    try {
      const r = await Api.get('/usuarios', st);
      if (!r.datos.length) { Panel.rowState(tbody, 6, 'empty', 'Sin usuarios con esos filtros.'); $('#pager').innerHTML = ''; return; }
      tbody.innerHTML = r.datos.map((u) => `<tr class="${u.activo ? '' : 'inactive'}" data-id="${u.id}" data-activo="${u.activo}">
        <td><b>${esc(u.nombre)}</b>${u.id === me.id ? ' <span class="pill info">tú</span>' : ''}</td><td>${esc(u.email)}</td>
        <td><span class="pill ${u.rol === 'admin' ? 'warn' : u.rol === 'vendedor' ? 'ok' : 'info'}">${esc(u.rol_nombre)}</span></td>
        <td>${Api.date(u.ultimo_acceso)}</td><td>${Panel.pillEstado(u.activo)}</td>
        <td><div class="btn-row"><button class="btn sm" data-a="edit">Editar</button>
          ${u.id !== me.id ? `<button class="btn sm ${u.activo ? 'danger' : ''}" data-a="toggle">${u.activo ? 'Desactivar' : 'Activar'}</button>` : ''}</div></td></tr>`).join('');
      Panel.pager($('#pager'), r, (p) => { st.page = p; load(); });
    } catch (e) { Panel.rowState(tbody, 6, 'error', e.message, load); }
  }

  tbody.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const tr = b.closest('tr'); const id = Number(tr.dataset.id);
    if (b.dataset.a === 'edit') return form(id);
    const activar = tr.dataset.activo === '0';
    if (!(await Panel.confirm(activar ? 'Activar usuario' : 'Desactivar usuario',
      activar ? '¿Deseas reactivar el acceso de este usuario?' : '¿Está seguro de desactivar este usuario? No podrá iniciar sesión, pero su historial se conserva.',
      activar ? 'Activar' : 'Desactivar', { danger: !activar }))) return;
    try { await Api.patch(`/usuarios/${id}/estado`, { activo: activar }); Panel.toast('Estado actualizado.'); load(); } catch (err) { Panel.toast(err.message, 'error'); }
  });

  async function form(id) {
    let u = { nombre: '', email: '', rol_id: 2 };
    if (id) { try { u = await Api.get('/usuarios/' + id); } catch (e) { return Panel.toast(e.message, 'error'); } }
    const m = Panel.modal(id ? 'Editar usuario' : 'Nuevo usuario', `
      <form id="f" novalidate class="form-grid">
        <div class="field full"><label>Nombre <span class="req">*</span></label><input class="input" name="nombre" required minlength="3" maxlength="100" value="${esc(u.nombre)}"><div class="err"></div></div>
        <div class="field"><label>Correo <span class="req">*</span></label><input class="input" name="email" type="email" required maxlength="150" value="${esc(u.email)}"><div class="err"></div></div>
        <div class="field"><label>Rol <span class="req">*</span></label><select class="input" name="rol_id" required>
          ${roles.map((r) => `<option value="${r.id}" ${r.id === u.rol_id ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}</select><div class="err"></div></div>
        <div class="field full"><label>Contraseña ${id ? '(dejar vacío para no cambiarla)' : '<span class="req">*</span>'}</label>
          <input class="input" name="password" type="password" ${id ? '' : 'required'} minlength="8" maxlength="100" pattern="(?=.*[A-Za-z])(?=.*\\d).{8,}" title="Mínimo 8 caracteres con letras y números" autocomplete="new-password"><div class="err"></div></div>
        <p class="full" style="margin:0;color:var(--muted);font-size:12px">${roles.map((r) => `<b>${esc(r.nombre)}:</b> ${esc(r.descripcion)}`).join('<br>')}</p>
      </form>`, { wide: true, foot: '<button class="btn" data-x>Cancelar</button><button class="btn primary" id="ok">Guardar</button>' });
    const f = $('#f', m.el);
    $('#ok', m.el).onclick = async () => {
      if (!Panel.validate(f)) return;
      const d = Panel.formData(f); d.rol_id = Number(d.rol_id); if (!d.password) delete d.password;
      try { await (id ? Api.put('/usuarios/' + id, d) : Api.post('/usuarios', d)); Panel.toast('Usuario guardado.'); m.close(); load(); }
      catch (e) { Panel.showErrors(f, e); }
    };
  }

  try { roles = await Api.get('/roles'); } catch (e) { roles = []; }
  $('#fRol').innerHTML = '<option value="">Todos los roles</option>' + roles.map((r) => `<option value="${r.clave}">${esc(r.nombre)}</option>`).join('');
  $('#newBtn').onclick = () => form(null);
  Panel.bindFilters(document, st, load);
  Panel.sortable($('#table'), st, load);
  load();
})();
