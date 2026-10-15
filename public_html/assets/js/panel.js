/* Núcleo del panel: sesión, menú por rol, modales, confirmaciones, toasts, tablas y paginación. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = Api.esc;

  const MENU = [
    ['Principal', [
      ['dashboard.html', '▦', 'Dashboard', ['admin', 'vendedor']],
      ['pos.html', '🛒', 'Punto de venta', ['admin', 'vendedor']],
      ['ventas.html', '🧾', 'Ventas', ['admin', 'vendedor']],
      ['ventas.html', '🧾', 'Mis compras', ['cliente']],
    ]],
    ['Catálogo', [
      ['juegos.html', '🎮', 'Juegos', ['admin', 'vendedor']],
      ['generos.html', '🏷', 'Géneros', ['admin', 'vendedor']],
      ['inventario.html', '📦', 'Inventario', ['admin', 'vendedor']],
      ['clientes.html', '👥', 'Clientes', ['admin', 'vendedor']],
    ]],
    ['Análisis', [
      ['reportes.html', '📈', 'Reportes', ['admin', 'vendedor']],
      ['historial.html', '🕘', 'Historial', ['admin']],
    ]],
    ['Administración', [
      ['usuarios.html', '🔐', 'Usuarios', ['admin']],
      ['config.html', '⚙', 'Configuración', ['admin']],
    ]],
    ['Cuenta', [
      ['perfil.html', '👤', 'Mi perfil', ['admin', 'vendedor', 'cliente']],
      ['../index.html', '◉', 'Ir a la tienda', ['admin', 'vendedor', 'cliente']],
    ]],
  ];

  const Panel = {
    user: null,

    /** Verifica sesión y rol; construye el layout. Devuelve el usuario o redirige. */
    async init({ roles, title, subtitle, actions = '' }) {
      let me;
      try { me = await Api.me(); } catch (e) { return this.fatal(e.message); }
      if (!me.usuario) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return new Promise(() => {}); }
      this.user = me.usuario;
      this.buildLayout(title, subtitle, actions);
      if (roles && !roles.includes(this.user.rol)) {
        $('#content').innerHTML = `<div class="card state-box error"><h2>403 · Acceso restringido</h2><p>Tu rol (${esc(this.user.rol_nombre)}) no tiene permiso para esta sección.</p>
          <a class="btn" href="${this.user.rol === 'cliente' ? 'ventas.html' : 'dashboard.html'}">Volver</a></div>`;
        return new Promise(() => {});
      }
      return this.user;
    },

    buildLayout(title, subtitle, actions) {
      const page = location.pathname.split('/').pop() || 'dashboard.html';
      const u = this.user;
      const content = $('#page') ? $('#page').innerHTML : '';
      document.body.innerHTML = `
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <a class="side-brand" href="../index.html"><span class="orb">360</span><b>retro 360 store</b></a>
          <nav class="nav">${MENU.map(([g, items]) => {
            const vis = items.filter((i) => i[3].includes(u.rol));
            return vis.length ? `<div class="nav-group">${g}</div>` + vis.map(([href, ic, label]) =>
              `<a href="${href}" class="${href === page ? 'active' : ''}"><span class="ic">${ic}</span>${label}</a>`).join('') : '';
          }).join('')}</nav>
          <div class="side-foot">
            <div class="side-user"><span class="avatar">${esc(u.nombre.trim()[0].toUpperCase())}</span>
              <div><strong>${esc(u.nombre)}</strong><small>${esc(u.rol_nombre)}</small></div></div>
            <button class="btn logout" id="logoutBtn">Cerrar sesión</button>
          </div>
        </aside>
        <main class="main">
          <div class="page-head">
            <div><button class="btn menu-btn" id="menuBtn" aria-label="Menú">☰</button>
              <h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
            <div class="btn-row" id="headActions">${actions}</div>
          </div>
          <div id="content">${content}</div>
        </main>
      </div>
      <div class="toast-stack" id="toasts" aria-live="polite"></div>`;
      document.title = `${title} · Retro 360`;
      $('#menuBtn').onclick = (e) => { e.stopPropagation(); document.body.classList.toggle('menu-open'); };
      $('.main').addEventListener('click', () => document.body.classList.remove('menu-open'));
      $('#logoutBtn').onclick = async () => {
        if (!(await this.confirm('Cerrar sesión', '¿Deseas cerrar tu sesión?', 'Cerrar sesión'))) return;
        try { await Api.post('/auth/logout'); } catch (e) { /* ya cerrada */ }
        location.href = 'login.html';
      };
    },

    fatal(msg) {
      document.body.innerHTML = `<div class="auth"><div class="card state-box error"><h2>No fue posible cargar el panel</h2><p>${esc(msg)}</p>
        <button class="btn" onclick="location.reload()">Reintentar</button></div></div>`;
      return new Promise(() => {});
    },

    sessionExpired() {
      if (this._expired || !this.user) return; this._expired = true;
      this.toast('Tu sesión expiró. Vuelve a iniciar sesión.', 'warn');
      setTimeout(() => { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop()); }, 1400);
    },

    can(...roles) { return this.user && roles.includes(this.user.rol); },

    toast(msg, type = 'ok') {
      const t = document.createElement('div');
      t.className = 'toast ' + type; t.textContent = msg;
      ($('#toasts') || document.body).appendChild(t);
      setTimeout(() => t.remove(), 4200);
    },

    /** Modal genérico. Devuelve {el, close}. */
    modal(title, body, { wide = false, foot = '' } = {}) {
      const d = document.createElement('dialog');
      d.className = 'modal' + (wide ? ' wide' : '');
      d.innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3><button class="btn sm" data-x aria-label="Cerrar">✕</button></div>
        <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}`;
      document.body.appendChild(d);
      const close = () => { d.close(); d.remove(); };
      d.querySelectorAll('[data-x]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); close(); }));
      d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
      d.showModal();
      return { el: d, close };
    },

    /** Confirmación. Con {input:true} pide un texto (p. ej. motivo) y lo devuelve. */
    confirm(title, message, okText = 'Aceptar', { danger = false, input = null } = {}) {
      return new Promise((resolve) => {
        const m = this.modal(title, `<p>${message}</p>${input ? `<div class="field"><label>${esc(input)} <span class="req">*</span></label>
          <textarea class="input" id="cInput" maxlength="255"></textarea><div class="err" id="cErr"></div></div>` : ''}`,
          { foot: `<button class="btn" data-x>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cOk">${esc(okText)}</button>` });
        let done = false;
        const finish = (v) => { if (done) return; done = true; resolve(v); };
        m.el.addEventListener('close', () => finish(false));
        $('#cOk', m.el).onclick = () => {
          if (input) {
            const v = $('#cInput', m.el).value.trim();
            if (v.length < 5) { $('#cErr', m.el).textContent = 'Escribe al menos 5 caracteres.'; return; }
            finish(v);
          } else finish(true);
          m.close();
        };
        setTimeout(() => (input ? $('#cInput', m.el) : $('#cOk', m.el)).focus(), 50);
      });
    },

    /** Muestra errores 422 del backend junto a cada campo del formulario. */
    showErrors(form, err) {
      form.querySelectorAll('.err').forEach((e) => (e.textContent = ''));
      form.querySelectorAll('.invalid').forEach((e) => e.classList.remove('invalid'));
      if (err && err.errors) {
        Object.entries(err.errors).forEach(([k, v]) => {
          const inp = form.querySelector(`[name="${k}"]`);
          if (inp) { inp.classList.add('invalid'); const e = inp.closest('.field')?.querySelector('.err'); if (e) e.textContent = v; }
        });
      }
      if (err) this.toast(err.message, 'error');
    },

    /** Validación básica del lado cliente (el backend vuelve a validar todo). */
    validate(form) {
      let ok = true;
      form.querySelectorAll('.err').forEach((e) => (e.textContent = ''));
      form.querySelectorAll('[name]').forEach((inp) => {
        inp.classList.remove('invalid');
        if (!inp.checkValidity()) {
          ok = false; inp.classList.add('invalid');
          const e = inp.closest('.field')?.querySelector('.err'); if (e) e.textContent = inp.validationMessage;
        }
      });
      if (!ok) this.toast('Revisa los campos marcados.', 'warn');
      return ok;
    },

    formData(form) {
      const o = {};
      form.querySelectorAll('[name]').forEach((i) => {
        if (i.type === 'checkbox') o[i.name] = i.checked;
        else if (i.type === 'number') o[i.name] = i.value === '' ? null : Number(i.value);
        else o[i.name] = i.value.trim();
      });
      return o;
    },

    /** Estados de interfaz dentro de un <tbody> */
    rowState(tbody, cols, type, msg, retry) {
      const html = type === 'loading' ? `<div class="spinner"></div>${msg || 'Cargando…'}`
        : type === 'error' ? `⚠ ${esc(msg)} ${retry ? '<br><button class="btn sm" style="margin-top:8px">Reintentar</button>' : ''}`
        : esc(msg || 'Sin resultados.');
      tbody.innerHTML = `<tr class="state"><td colspan="${cols}">${html}</td></tr>`;
      if (type === 'error' && retry) tbody.querySelector('button').onclick = retry;
    },
    boxState(el, type, msg, retry) {
      el.innerHTML = type === 'loading' ? `<div class="state-box"><div class="spinner"></div>${msg || 'Cargando…'}</div>`
        : `<div class="state-box ${type === 'error' ? 'error' : ''}">${type === 'error' ? '⚠ ' : ''}${esc(msg)}${retry ? '<br><button class="btn sm" style="margin-top:8px">Reintentar</button>' : ''}</div>`;
      if (retry) el.querySelector('button').onclick = retry;
    },

    /** Encabezados ordenables: <th data-sort="campo"> */
    sortable(table, state, onChange) {
      const paint = () => table.querySelectorAll('th[data-sort]').forEach((th) => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === state.sort) th.classList.add(state.dir);
      });
      table.querySelectorAll('th[data-sort]').forEach((th) => {
        th.tabIndex = 0;
        const go = () => {
          if (state.sort === th.dataset.sort) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
          else { state.sort = th.dataset.sort; state.dir = 'asc'; }
          state.page = 1; paint(); onChange();
        };
        th.onclick = go; th.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      });
      paint();
    },

    pager(el, res, onPage) {
      if (!res || !res.total) { el.innerHTML = ''; return; }
      const { pagina, totalPaginas, total, limite } = res;
      const from = (pagina - 1) * limite + 1, to = Math.min(total, pagina * limite);
      const nums = [];
      for (let i = 1; i <= totalPaginas; i++) if (i === 1 || i === totalPaginas || Math.abs(i - pagina) <= 2) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
      el.innerHTML = `<span>Mostrando ${from}–${to} de ${total}</span><div class="pages">
        <button class="btn sm" data-p="${pagina - 1}" ${pagina <= 1 ? 'disabled' : ''}>‹</button>
        ${nums.map((n) => n === '…' ? '<span style="padding:4px">…</span>' : `<button class="btn sm ${n === pagina ? 'on' : ''}" data-p="${n}">${n}</button>`).join('')}
        <button class="btn sm" data-p="${pagina + 1}" ${pagina >= totalPaginas ? 'disabled' : ''}>›</button></div>`;
      el.querySelectorAll('button[data-p]').forEach((b) => (b.onclick = () => onPage(Number(b.dataset.p))));
    },

    debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },

    /** Conecta inputs de filtro (data-filter="clave") con el estado y recarga */
    bindFilters(root, state, reload) {
      const deb = this.debounce(() => { state.page = 1; reload(); }, 300);
      root.querySelectorAll('[data-filter]').forEach((inp) => {
        const k = inp.dataset.filter;
        if (state[k] !== undefined && state[k] !== null) inp.value = state[k];
        inp.addEventListener(inp.tagName === 'SELECT' || inp.type === 'date' ? 'change' : 'input', () => { state[k] = inp.value; inp.type === 'search' || inp.type === 'text' ? deb() : (state.page = 1, reload()); });
      });
    },

    pillEstado(activo) { return activo ? '<span class="pill ok">Activo</span>' : '<span class="pill danger">Inactivo</span>'; },

    /** Exporta filas a CSV (reportes) */
    csv(filename, headers, rows) {
      const line = (r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      const blob = new Blob(['﻿' + [line(headers), ...rows.map(line)].join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
  window.Panel = Panel;
})();
