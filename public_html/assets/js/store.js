/* Tienda Retro 360: selector de juegos estilo biblioteca de Xbox 360 (A-Z) + carrito + compra en línea.
   Todos los datos vienen de la API (/api/catalogo, /api/ventas). */
(function () {
  const $ = (s) => document.querySelector(s);
  const state = {
    all: [], list: [], idx: 0, genero: '', q: '', user: null, iva: 0.16,
    cart: loadCart(), sound: localGet('r360-sound') !== 'off', els: [],
  };

  // ---------------- utilidades ----------------
  function localGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function localSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado */ } }
  function loadCart() { try { return JSON.parse(localStorage.getItem('r360-cart') || '[]'); } catch (e) { return []; } }
  function saveCart() { localSet('r360-cart', JSON.stringify(state.cart)); renderCartPill(); }
  function toast(msg, error) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (error ? ' error' : '');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3500);
  }
  let actx;
  function tick(freq = 880, dur = 0.05) {
    if (!state.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0.06, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
    } catch (e) { /* sin audio */ }
  }
  const letterOf = (t) => { const c = t.trim()[0].toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };

  // ---------------- reloj ----------------
  function clock() {
    const d = new Date();
    $('#clock').textContent = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') + ' ' +
      d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  clock(); setInterval(clock, 15000);

  // ---------------- sesión ----------------
  async function loadUser() {
    try {
      const r = await Api.me();
      state.user = r.usuario;
    } catch (e) { state.user = null; }
    const u = state.user, gc = $('#gamercard');
    if (u) {
      $('#gcAvatar').textContent = u.nombre.trim()[0].toUpperCase();
      $('#gcName').textContent = u.nombre;
      $('#gcSub').textContent = u.rol === 'cliente' ? 'Ver mi perfil y compras' : u.rol_nombre;
      gc.href = u.rol === 'cliente' ? 'panel/perfil.html' : 'panel/dashboard.html';
      $('#panelLink').hidden = false;
      $('#panelLink').textContent = u.rol === 'cliente' ? 'Mis compras' : 'Panel';
      $('#panelLink').href = u.rol === 'cliente' ? 'panel/ventas.html' : 'panel/dashboard.html';
    }
  }

  // ---------------- catálogo ----------------
  async function loadCatalog() {
    const st = $('#shelfState');
    st.className = 'shelf-state'; st.innerHTML = '<div class="ring"></div><p>Cargando biblioteca…</p>';
    try {
      const r = await Api.get('/catalogo');
      state.all = r.datos; state.iva = r.tasa_iva;
      $('#brandName').textContent = r.tienda; document.title = r.tienda;
      renderTabs(r.generos);
      // Limpia del carrito juegos que ya no existen
      state.cart = state.cart.filter((c) => state.all.some((g) => g.id === c.juego_id));
      saveCart();
      applyFilter(true);
    } catch (e) {
      st.className = 'shelf-state error';
      st.innerHTML = `<p>${Api.esc(e.message)}</p><button id="retry">Reintentar</button>`;
      $('#retry').onclick = loadCatalog;
    }
  }

  function renderTabs(generos) {
    const tabs = $('#genreTabs');
    tabs.innerHTML = [{ id: '', nombre: 'todos los juegos' }, ...generos]
      .map((g) => `<button class="blade-tab" role="tab" data-g="${g.id}" aria-selected="${String(g.id) === state.genero}">${Api.esc(g.nombre)}</button>`).join('');
    tabs.onclick = (e) => {
      const b = e.target.closest('.blade-tab'); if (!b) return;
      state.genero = b.dataset.g;
      tabs.querySelectorAll('.blade-tab').forEach((t) => t.setAttribute('aria-selected', t === b));
      tick(660); applyFilter();
    };
  }

  function applyFilter(first) {
    const q = state.q.toLowerCase();
    const current = state.list[state.idx];
    state.list = state.all
      .filter((g) => !state.genero || String(g.genero_id) === state.genero)
      .filter((g) => !q || g.titulo.toLowerCase().includes(q) || (g.desarrollador || '').toLowerCase().includes(q))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }));   // orden alfabético
    const keep = current ? state.list.findIndex((g) => g.id === current.id) : -1;
    state.idx = keep >= 0 ? keep : 0;
    if (first) {
      const hashId = Number(location.hash.replace('#juego-', ''));
      const i = state.list.findIndex((g) => g.id === hashId);
      if (i >= 0) state.idx = i;
    }
    buildShelf(); renderAZ();
  }

  function buildShelf() {
    const shelf = $('#shelf');
    shelf.querySelectorAll('.cover').forEach((c) => c.remove());
    const st = $('#shelfState');
    if (!state.list.length) {
      st.className = 'shelf-state error'; st.hidden = false;
      st.innerHTML = '<p>No hay juegos que coincidan con tu búsqueda.</p><button id="clearF">Ver todos</button>';
      $('#clearF').onclick = () => { $('#search').value = ''; state.q = ''; state.genero = '';
        document.querySelectorAll('.blade-tab').forEach((t, i) => t.setAttribute('aria-selected', i === 0)); applyFilter(); };
      $('#npTitle').textContent = '—'; $('#npCount').textContent = '0 de 0';
      return;
    }
    st.hidden = true;
    state.els = state.list.map((g, i) => {
      const el = document.createElement('div');
      el.className = 'cover'; el.dataset.i = i;
      el.innerHTML = Cover(g) + (g.existencia !== 'disponible' ? `<span class="badge ${g.existencia}">${g.existencia === 'agotado' ? 'Agotado' : 'Últimas piezas'}</span>` : '');
      el.addEventListener('click', () => { if (i === state.idx) openDetail(); else go(i); });
      shelf.appendChild(el);
      return el;
    });
    layout();
  }

  function layout() {
    const w = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cover-w')) || $('#shelf .cover')?.offsetWidth || 220;
    const mobile = window.innerWidth < 640;
    const visible = mobile ? 3 : 6;
    state.els.forEach((el, i) => {
      const o = i - state.idx, a = Math.abs(o), s = Math.sign(o);
      let t;
      if (o === 0) t = 'translate3d(0,0,90px) scale(1)';
      else t = `translate3d(${s * (w * (mobile ? 0.8 : 0.7) + (a - 1) * w * (mobile ? 0.22 : 0.36))}px,0,${-60 - a * 14}px) rotateY(${-s * (mobile ? 35 : 26)}deg) scale(${mobile ? .72 : .82})`;
      el.style.transform = t;
      el.style.zIndex = 200 - a;
      el.style.opacity = a > visible ? 0 : 1;
      el.style.pointerEvents = a > visible ? 'none' : '';
      el.classList.toggle('center', o === 0);
      el.classList.toggle('side', o !== 0);
    });
    const g = state.list[state.idx];
    $('#npTitle').textContent = g.titulo;
    $('#npCount').textContent = `${state.idx + 1} de ${state.list.length}`;
    history.replaceState(null, '', '#juego-' + g.id);
    const L = letterOf(g.titulo);
    document.querySelectorAll('#az button').forEach((b) => b.classList.toggle('on', b.dataset.l === L));
  }

  function renderAZ() {
    const letters = new Set(state.list.map((g) => letterOf(g.titulo)));
    $('#az').innerHTML = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((l) =>
      `<button data-l="${l}" class="${letters.has(l) ? 'has' : ''}" ${letters.has(l) ? '' : 'disabled'} aria-label="Saltar a ${l}">${l}</button>`).join('');
    if (state.list.length) layout();
  }
  $('#az').addEventListener('click', (e) => { const b = e.target.closest('button.has'); if (b) jumpTo(b.dataset.l); });

  function jumpTo(letter) {
    const i = state.list.findIndex((g) => letterOf(g.titulo) === letter);
    if (i >= 0) go(i);
  }

  function go(i) {
    if (!state.list.length) return;
    const n = Math.max(0, Math.min(state.list.length - 1, i));
    if (n === state.idx) return;
    state.idx = n; tick(); layout();
    if ($('#detail').classList.contains('open')) openDetail();
  }

  // ---------------- navegación: teclado, rueda, táctil ----------------
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea') || $('#dialog').open) return;
    const panelOpen = $('#detail').classList.contains('open') || $('#cart').classList.contains('open');
    if (e.key === 'Escape' || e.key === 'Backspace') { if (panelOpen) { closePanels(); e.preventDefault(); } return; }
    if (e.key === 'ArrowRight') { go(state.idx + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { go(state.idx - 1); e.preventDefault(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(state.list.length - 1);
    else if (e.key === 'PageDown') go(state.idx + 5);
    else if (e.key === 'PageUp') go(state.idx - 5);
    else if (e.key === 'Enter' && !panelOpen) { openDetail(); e.preventDefault(); }
    else if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !panelOpen) jumpTo(e.key.toUpperCase());
  });
  let wheelLock = 0;
  $('#shelf').addEventListener('wheel', (e) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 4 || Date.now() - wheelLock < 110) return;
    wheelLock = Date.now(); go(state.idx + (d > 0 ? 1 : -1)); e.preventDefault();
  }, { passive: false });
  let touchX = null;
  $('#shelf').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#shelf').addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 30) go(state.idx + (dx < 0 ? 1 : -1) * (Math.abs(dx) > 180 ? 3 : 1));
  });
  $('#prevBtn').onclick = () => go(state.idx - 1);
  $('#nextBtn').onclick = () => go(state.idx + 1);
  let searchT;
  $('#search').addEventListener('input', (e) => { clearTimeout(searchT); searchT = setTimeout(() => { state.q = e.target.value.trim(); applyFilter(); }, 180); });
  window.addEventListener('resize', () => state.els.length && layout());
  $('#soundBtn').setAttribute('aria-pressed', state.sound);
  $('#soundBtn').textContent = state.sound ? '🔊' : '🔈';
  $('#soundBtn').onclick = () => {
    state.sound = !state.sound; localSet('r360-sound', state.sound ? 'on' : 'off');
    $('#soundBtn').setAttribute('aria-pressed', state.sound); $('#soundBtn').textContent = state.sound ? '🔊' : '🔈'; tick(990);
  };

  // ---------------- paneles ----------------
  function openPanel(id) {
    closePanels(true);
    $(id).classList.add('open'); $(id).setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false; tick(520, 0.08);
  }
  function closePanels(silent) {
    ['#detail', '#cart'].forEach((id) => { $(id).classList.remove('open'); $(id).setAttribute('aria-hidden', 'true'); });
    $('#scrim').hidden = true; if (!silent) tick(400, 0.06);
    $('#shelf').focus({ preventScroll: true });
  }
  $('#scrim').onclick = () => closePanels();
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => closePanels()));

  function inCart(id) { return state.cart.find((c) => c.juego_id === id)?.cantidad || 0; }

  function openDetail() {
    const g = state.list[state.idx]; if (!g) return;
    let qty = 1;
    const stockTxt = { disponible: ['ok', 'Disponible'], pocas: ['low', 'Últimas piezas disponibles'], agotado: ['out', 'Agotado'] }[g.existencia];
    $('#detailBody').innerHTML = `
      <div class="detail-top">
        <div class="case-holder">${Cover(g)}</div>
        <div>
          <h2>${Api.esc(g.titulo)}</h2>
          <div class="meta">
            <span class="chip">${Api.esc(g.genero)}</span>
            ${g.anio_lanzamiento ? `<span class="chip">${g.anio_lanzamiento}</span>` : ''}
            <span class="chip">ESRB ${Api.esc(g.clasificacion)}</span>
          </div>
          <div style="font-size:13px;color:#555">${Api.esc(g.desarrollador || '')}</div>
          <p class="price">${Api.money(g.precio)}<small>+ IVA</small></p>
          <p class="stock-line ${stockTxt[0]}">● ${stockTxt[1]}</p>
        </div>
      </div>
      <p class="desc">${Api.esc(g.descripcion || 'Clásico de la generación Xbox 360.')}</p>
      <p style="font-size:12px;color:#666">SKU ${Api.esc(g.sku)}</p>
      <div class="actions-row">
        <div class="qty" ${g.disponible ? '' : 'hidden'}>
          <button type="button" id="qMinus" aria-label="Menos">−</button><span id="qVal">1</span><button type="button" id="qPlus" aria-label="Más">+</button>
        </div>
        <button class="x-btn" id="addCart" ${g.disponible ? '' : 'disabled'}><b class="btn-a" style="width:20px;height:20px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;background:rgba(255,255,255,.25)">A</b> Agregar al carrito</button>
      </div>
      ${inCart(g.id) ? `<p class="note">Ya tienes ${inCart(g.id)} en tu carrito.</p>` : ''}`;
    if (g.disponible) {
      $('#qMinus').onclick = () => { qty = Math.max(1, qty - 1); $('#qVal').textContent = qty; tick(700); };
      $('#qPlus').onclick = () => { qty = Math.min(10, qty + 1); $('#qVal').textContent = qty; tick(760); };
      $('#addCart').onclick = () => { addToCart(g, qty); closePanels(true); openCart(); };
    }
    openPanel('#detail');
    setTimeout(() => $('#addCart')?.focus(), 350);
  }

  // ---------------- carrito ----------------
  function addToCart(g, qty) {
    const line = state.cart.find((c) => c.juego_id === g.id);
    if (line) line.cantidad = Math.min(10, line.cantidad + qty); else state.cart.push({ juego_id: g.id, cantidad: qty });
    saveCart(); tick(1040, 0.09); toast(`"${g.titulo}" agregado al carrito`);
  }

  function renderCartPill() {
    const n = state.cart.reduce((s, c) => s + c.cantidad, 0);
    $('#cartLabel').textContent = n ? `Carrito: ${n} elemento(s)` : 'Carrito vacío';
    $('#cartSpin').hidden = !n;
  }
  $('#cartBtn').onclick = () => openCart();

  function openCart() {
    renderCart(); openPanel('#cart');
  }

  function renderCart() {
    const body = $('#cartBody');
    if (!state.cart.length) {
      body.innerHTML = '<div class="empty"><p>Tu carrito está vacío.</p><p>Elige un juego del selector y presiona <b>A</b>.</p></div>';
      return;
    }
    let sub = 0;
    const rows = state.cart.map((c) => {
      const g = state.all.find((x) => x.id === c.juego_id); if (!g) return '';
      const imp = Number(g.precio) * c.cantidad; sub += imp;
      return `<div class="cart-item" data-id="${g.id}">
        <div class="mini">${Cover(g)}</div>
        <div><h4>${Api.esc(g.titulo)}</h4><div class="sub">${Api.money(g.precio)} c/u</div>
          <div class="qty" style="margin-top:6px;transform:scale(.85);transform-origin:left">
            <button type="button" data-a="minus">−</button><span>${c.cantidad}</span><button type="button" data-a="plus">+</button></div>
          <div><button class="rm" data-a="rm">Quitar</button></div></div>
        <strong>${Api.money(imp)}</strong></div>`;
    }).join('');
    const iva = Math.round(sub * state.iva * 100) / 100;
    const u = state.user;
    const canBuy = u && u.rol === 'cliente';
    body.innerHTML = rows + `
      <div class="totals">
        <div><span>Subtotal</span><span>${Api.money(sub)}</span></div>
        <div><span>IVA (${Math.round(state.iva * 100)}%)</span><span>${Api.money(iva)}</span></div>
        <div class="grand"><span>Total</span><span>${Api.money(sub + iva)}</span></div>
      </div>
      ${canBuy ? `
        <label class="field">Método de pago (simulado)
          <select id="payMethod"><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option></select>
        </label>
        <div class="actions-row"><button class="x-btn" id="checkout">Finalizar compra</button><button class="x-btn ghost" id="emptyCart">Vaciar</button></div>
        <p class="note">El total definitivo lo calcula el servidor con los precios y existencias vigentes.</p>`
      : u ? `<p class="note">Estás conectado como <b>${Api.esc(u.rol_nombre)}</b>. Las ventas de mostrador se registran desde el <a href="panel/pos.html">punto de venta</a>.</p>`
      : `<p class="note">Para comprar necesitas una cuenta de cliente.</p>
         <div class="actions-row"><a class="x-btn" href="panel/login.html?next=../index.html">Iniciar sesión</a>
         <a class="x-btn ghost" href="panel/login.html?registro=1&next=../index.html">Crear cuenta</a></div>`}`;

    body.querySelectorAll('.cart-item').forEach((row) => {
      const id = Number(row.dataset.id);
      row.onclick = (e) => {
        const a = e.target.dataset.a; if (!a) return;
        const line = state.cart.find((c) => c.juego_id === id);
        if (a === 'plus') line.cantidad = Math.min(10, line.cantidad + 1);
        if (a === 'minus') line.cantidad = Math.max(1, line.cantidad - 1);
        if (a === 'rm') state.cart = state.cart.filter((c) => c.juego_id !== id);
        tick(720); saveCart(); renderCart();
      };
    });
    $('#emptyCart') && ($('#emptyCart').onclick = async () => {
      if (await confirmDlg('Vaciar carrito', '¿Deseas quitar todos los juegos del carrito?', 'Vaciar')) { state.cart = []; saveCart(); renderCart(); }
    });
    $('#checkout') && ($('#checkout').onclick = checkout);
  }

  async function checkout() {
    const total = $('.totals .grand span:last-child').textContent;
    if (!(await confirmDlg('Finalizar compra', `¿Deseas finalizar la compra por <b>${total}</b>?`, 'Comprar'))) return;
    const btn = $('#checkout'); btn.disabled = true; btn.textContent = 'Procesando…';
    try {
      const v = await Api.post('/ventas', { metodo_pago: $('#payMethod').value, items: state.cart });
      state.cart = []; saveCart(); closePanels(true);
      tick(1200, 0.15); setTimeout(() => tick(1500, 0.2), 120);
      showDialog('¡Compra realizada!', `
        <div class="ticket">
          <div><b>Folio:</b> ${Api.esc(v.folio)}</div>
          <div><b>Fecha:</b> ${Api.date(v.created_at)}</div><hr>
          ${v.detalle.map((d) => `<div>${d.cantidad} × ${Api.esc(d.titulo)} — ${Api.money(d.importe)}</div>`).join('')}
          <hr><div>Subtotal ${Api.money(v.subtotal)} · IVA ${Api.money(v.impuesto)}</div>
          <div style="font-size:16px"><b>Total ${Api.money(v.total)}</b></div>
        </div>`, [['Ver mis compras', 'panel/ventas.html'], ['Seguir explorando', null]]);
      loadCatalog();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Finalizar compra';
      toast(e.message, true);
      if (e.status === 409 || e.status === 404) loadCatalog();
    }
  }

  // ---------------- diálogos ----------------
  function showDialog(title, html, actions) {
    const d = $('#dialog');
    $('#dlgTitle').textContent = title; $('#dlgBody').innerHTML = html;
    $('#dlgActions').innerHTML = actions.map(([t, href], i) => href
      ? `<a class="x-btn ${i ? 'ghost' : ''}" href="${href}">${t}</a>` : `<button class="x-btn ${i ? 'ghost' : ''}" value="${i}">${t}</button>`).join('');
    d.showModal();
  }
  function confirmDlg(title, html, okText) {
    return new Promise((resolve) => {
      const d = $('#dialog');
      $('#dlgTitle').textContent = title; $('#dlgBody').innerHTML = `<p>${html}</p>`;
      $('#dlgActions').innerHTML = `<button class="x-btn ghost" value="no">Cancelar</button><button class="x-btn" value="ok">${okText}</button>`;
      d.onclose = () => { resolve(d.returnValue === 'ok'); d.onclose = null; };
      d.returnValue = ''; d.showModal();
    });
  }

  // ---------------- inicio ----------------
  const logo = $('#brandLogo');
  if (logo) { const ok = () => logo.naturalWidth && logo.closest('.brand').classList.add('has-logo'); logo.complete ? ok() : logo.addEventListener('load', ok); }
  renderCartPill();
  loadUser().then(loadCatalog);
  $('#shelf').focus({ preventScroll: true });
})();
