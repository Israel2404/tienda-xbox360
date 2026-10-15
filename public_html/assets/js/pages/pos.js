(async function () {
  await Panel.init({ roles: ['admin', 'vendedor'], title: 'Punto de venta', subtitle: 'Venta de mostrador' });
  const $ = (s, el = document) => el.querySelector(s);
  const esc = Api.esc;
  let juegos = [], iva = 0.16;
  const cart = new Map(); // juego_id -> {juego, cantidad}

  async function loadGames() {
    Panel.boxState($('#grid'), 'loading', 'Cargando catálogo…');
    try {
      // Se pide todo el catálogo activo en páginas de 100
      let page = 1, all = [];
      for (;;) {
        const r = await Api.get('/juegos', { estado: 'activos', limit: 100, page, sort: 'titulo' });
        all = all.concat(r.datos); if (page >= r.totalPaginas) break; page++;
      }
      juegos = all; renderGrid();
    } catch (e) { Panel.boxState($('#grid'), 'error', e.message, loadGames); }
  }

  function renderGrid() {
    const q = $('#q').value.trim().toLowerCase();
    const list = juegos.filter((j) => !q || j.titulo.toLowerCase().includes(q) || j.sku.toLowerCase().includes(q));
    if (!list.length) { Panel.boxState($('#grid'), 'empty', 'Sin resultados.'); return; }
    $('#grid').innerHTML = list.map((j) => {
      const inCart = cart.get(j.id)?.cantidad || 0;
      const disp = j.stock - inCart;
      return `<button class="pos-item" data-id="${j.id}" ${disp <= 0 ? 'disabled' : ''} title="${esc(j.titulo)}">
        <div class="cv">${Cover(j)}</div><b>${esc(j.titulo)}</b>
        <span>${Api.money(j.precio)} · ${disp <= 0 ? '<span style="color:#ff8f86">sin stock</span>' : `stock ${disp}`}</span></button>`;
    }).join('');
  }

  $('#grid').addEventListener('click', (e) => {
    const b = e.target.closest('.pos-item'); if (!b) return;
    const j = juegos.find((x) => x.id === Number(b.dataset.id));
    const line = cart.get(j.id) || { juego: j, cantidad: 0 };
    if (line.cantidad >= j.stock) return Panel.toast('No hay más existencias de este juego.', 'warn');
    line.cantidad++; cart.set(j.id, line); renderCart(); renderGrid();
  });
  $('#q').addEventListener('input', Panel.debounce(renderGrid, 150));
  $('#q').addEventListener('keydown', (e) => {   // lector de código: SKU exacto + Enter
    if (e.key !== 'Enter') return;
    const j = juegos.find((x) => x.sku.toLowerCase() === e.target.value.trim().toLowerCase());
    if (j) { $(`.pos-item[data-id="${j.id}"]`)?.click(); e.target.value = ''; renderGrid(); }
  });

  function totals() {
    let sub = 0; cart.forEach((l) => (sub += Number(l.juego.precio) * l.cantidad));
    sub = Math.round(sub * 100) / 100; const imp = Math.round(sub * iva * 100) / 100;
    return { sub, imp, total: Math.round((sub + imp) * 100) / 100 };
  }

  function renderCart() {
    const box = $('#ticket');
    if (!cart.size) { box.innerHTML = '<div class="state-box">Agrega juegos desde el catálogo.</div>'; }
    else box.innerHTML = [...cart.values()].map((l) => `<div class="ticket-line" data-id="${l.juego.id}">
      <div><b>${esc(l.juego.titulo)}</b><br><small style="color:var(--muted)">${Api.money(l.juego.precio)} c/u</small></div>
      <div class="qty-ctl"><button data-a="-" aria-label="Menos">−</button><span>${l.cantidad}</span><button data-a="+" aria-label="Más">+</button></div>
      <div style="text-align:right">${Api.money(l.juego.precio * l.cantidad)}<br><button class="btn sm" data-a="x" style="margin-top:4px">Quitar</button></div></div>`).join('');
    const t = totals();
    $('#tSub').textContent = Api.money(t.sub); $('#tIva').textContent = Api.money(t.imp); $('#tTotal').textContent = Api.money(t.total);
    $('#ivaPct').textContent = Math.round(iva * 100);
    $('#pay').disabled = !cart.size;
  }

  $('#ticket').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = Number(b.closest('.ticket-line').dataset.id); const l = cart.get(id);
    if (b.dataset.a === '+') { if (l.cantidad >= l.juego.stock) return Panel.toast('Sin existencias suficientes.', 'warn'); l.cantidad++; }
    if (b.dataset.a === '-') { l.cantidad--; if (l.cantidad <= 0) cart.delete(id); }
    if (b.dataset.a === 'x') cart.delete(id);
    renderCart(); renderGrid();
  });

  $('#clear').onclick = async () => {
    if (!cart.size) return;
    if (await Panel.confirm('Cancelar operación', '¿Desea cancelar esta operación y vaciar el ticket?', 'Vaciar', { danger: true })) { cart.clear(); renderCart(); renderGrid(); }
  };

  $('#pay').onclick = async () => {
    const t = totals();
    if (!(await Panel.confirm('Finalizar venta', `¿Desea finalizar esta venta por <b>${Api.money(t.total)}</b>?`, 'Cobrar'))) return;
    $('#pay').disabled = true;
    try {
      const v = await Api.post('/ventas', {
        cliente_id: $('#cliente').value ? Number($('#cliente').value) : null,
        metodo_pago: $('#metodo').value,
        items: [...cart.values()].map((l) => ({ juego_id: l.juego.id, cantidad: l.cantidad })),
      });
      cart.clear(); renderCart();
      Panel.modal('Venta registrada', `<div style="font-family:ui-monospace,Consolas,monospace">
        <p style="font-size:18px">Folio <b>${esc(v.folio)}</b></p><p>${Api.date(v.created_at)} · ${esc(v.cliente)} · ${esc(v.metodo_pago)}</p>
        ${v.detalle.map((d) => `<div>${d.cantidad} × ${esc(d.titulo)} <span style="float:right">${Api.money(d.importe)}</span></div>`).join('')}
        <hr><div>Subtotal <span style="float:right">${Api.money(v.subtotal)}</span></div><div>IVA <span style="float:right">${Api.money(v.impuesto)}</span></div>
        <div style="font-size:18px"><b>Total <span style="float:right">${Api.money(v.total)}</span></b></div></div>`,
        { foot: `<button class="btn" onclick="window.print()">Imprimir</button><a class="btn" href="ventas.html?id=${v.id}">Ver venta</a><button class="btn primary" data-x>Nueva venta</button>` });
      loadGames();
    } catch (e) {
      Panel.toast(e.message, 'error'); $('#pay').disabled = false;
      if (e.status === 409) loadGames();
    }
  };

  async function loadClientes() {
    try {
      const r = await Api.get('/clientes', { limit: 100, estado: 'activos', sort: 'nombre' });
      $('#cliente').innerHTML = '<option value="">Público en general</option>' + r.datos.filter((c) => c.nombre !== 'Público en general')
        .map((c) => `<option value="${c.id}">${esc(c.nombre)}${c.gamertag ? ' (' + esc(c.gamertag) + ')' : ''}</option>`).join('');
    } catch (e) { /* se usa público en general */ }
  }

  try { const cfg = await Api.get('/catalogo'); iva = cfg.tasa_iva; } catch (e) { /* por defecto 16% */ }
  renderCart(); loadClientes(); loadGames();
  $('#q').focus();
})();
