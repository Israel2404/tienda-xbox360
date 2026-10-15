(async function () {
  await Panel.init({ roles: ['admin', 'vendedor'], title: 'Reportes', subtitle: 'Ventas, juegos más vendidos e inventario (datos de la base de datos)',
    actions: '<button class="btn" onclick="window.print()">🖨 Imprimir</button>' });
  const $ = (s) => document.querySelector(s);
  const esc = Api.esc;
  Chart.defaults.color = '#9fb09f'; Chart.defaults.borderColor = 'rgba(255,255,255,.08)';
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date(); const ago = new Date(Date.now() - 29 * 864e5);
  $('#desde').value = iso(ago); $('#hasta').value = iso(today); $('#hasta').max = iso(today);
  let charts = {}, last = {};
  const palette = ['#7ed957', '#56b6ff', '#ffc83d', '#ff8a65', '#b388ff', '#4dd0e1', '#f06292', '#aed581', '#90a4ae', '#3fae1f', '#ffd54f', '#81c784'];
  const chart = (id, cfg) => { charts[id]?.destroy(); charts[id] = new Chart($('#' + id), cfg); };

  async function generar() {
    const q = { desde: $('#desde').value, hasta: $('#hasta').value, agrupar: $('#agrupar').value };
    $('#rErr').textContent = '';
    if (!q.desde || !q.hasta) { $('#rErr').textContent = 'Selecciona ambas fechas.'; return; }
    if (q.desde > q.hasta) { $('#rErr').textContent = 'La fecha inicial no puede ser mayor que la final.'; return; }
    ['#resumen', '#tTop', '#tVend', '#tInv'].forEach((s) => Panel.boxState($(s), 'loading'));
    try {
      const [v, j, inv] = await Promise.all([Api.get('/reportes/ventas', q), Api.get('/reportes/juegos', { ...q, limite: 10 }), Api.get('/reportes/inventario')]);
      last = { v, j, inv };
      renderVentas(v); renderJuegos(j); renderInv(inv);
      $('#periodo').textContent = `Periodo: ${Api.date(v.desde, false)} – ${Api.date(v.hasta, false)}`;
    } catch (e) {
      $('#rErr').textContent = e.errors ? Object.values(e.errors).join(' ') : e.message;
      ['#resumen', '#tTop', '#tVend', '#tInv'].forEach((s) => Panel.boxState($(s), 'error', e.message));
    }
  }

  function renderVentas(v) {
    const r = v.resumen;
    const k = (l, val, cls = '') => `<div class="card kpi ${cls}"><div class="label">${l}</div><div class="value">${val}</div></div>`;
    $('#resumen').innerHTML = `<div class="grid kpis" style="margin:0">${k('Ventas', r.ventas)}${k('Ingresos', Api.money(r.total), 'info')}${k('IVA cobrado', Api.money(r.impuesto))}
      ${k('Ticket promedio', Api.money(r.ticket_promedio))}${k('Canceladas', r.canceladas, r.canceladas ? 'danger' : '')}</div>`;
    chart('cSerie', { type: 'line', data: { labels: v.serie.map((s) => s.periodo), datasets: [
      { label: 'Ingresos', data: v.serie.map((s) => Number(s.total)), borderColor: '#7ed957', backgroundColor: 'rgba(93,194,30,.2)', fill: true, tension: .3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + Api.money(c.raw) } } },
        scales: { y: { ticks: { callback: (x) => '$' + x.toLocaleString('es-MX') } } } } });
    chart('cCanal', { type: 'pie', data: { labels: v.porMetodo.map((m) => m.metodo_pago), datasets: [{ data: v.porMetodo.map((m) => Number(m.total)), backgroundColor: palette, borderColor: '#0f1a10' }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${Api.money(c.raw)}` } } } } });
    $('#tVend').innerHTML = `<div class="table-wrap"><table class="t" style="min-width:0"><thead><tr><th>Vendedor / canal</th><th class="num">Ventas</th><th class="num">Total</th></tr></thead><tbody>
      ${v.porVendedor.map((x) => `<tr><td>${esc(x.vendedor)}</td><td class="num">${x.ventas}</td><td class="num">${Api.money(x.total)}</td></tr>`).join('')}
      ${v.porCanal.map((x) => `<tr><td><span class="pill ${x.canal === 'online' ? 'info' : 'ok'}">${esc(x.canal)}</span></td><td class="num">${x.ventas}</td><td class="num">${Api.money(x.total)}</td></tr>`).join('')}
      ${!v.porVendedor.length ? '<tr class="state"><td colspan="3">Sin ventas en el periodo.</td></tr>' : ''}</tbody></table></div>`;
  }

  function renderJuegos(j) {
    chart('cTop', { type: 'bar', data: { labels: j.top.map((t) => t.titulo.length > 22 ? t.titulo.slice(0, 21) + '…' : t.titulo),
      datasets: [{ label: 'Unidades', data: j.top.map((t) => Number(t.unidades)), backgroundColor: '#5dc21e', borderRadius: 4 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } } } } });
    chart('cGenero', { type: 'doughnut', data: { labels: j.generos.map((g) => g.genero), datasets: [{ data: j.generos.map((g) => Number(g.unidades)), backgroundColor: palette, borderColor: '#0f1a10' }] },
      options: { maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } } });
    $('#tTop').innerHTML = j.top.length ? `<div class="table-wrap"><table class="t" style="min-width:0"><thead><tr><th>#</th><th>Juego</th><th>Género</th><th class="num">Unidades</th><th class="num">Importe</th></tr></thead><tbody>
      ${j.top.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.titulo)}</td><td>${esc(t.genero)}</td><td class="num">${t.unidades}</td><td class="num">${Api.money(t.importe)}</td></tr>`).join('')}</tbody></table></div>
      <p style="color:var(--muted);margin:10px 0 0">${j.sinVentas.length} juego(s) activos sin ventas en el periodo.</p>` : '<div class="state-box">Sin ventas en el periodo.</div>';
  }

  function renderInv(inv) {
    const t = inv.totales;
    $('#tInv').innerHTML = `<p>${t.titulos} títulos · ${t.unidades} unidades · valor a precio de venta <b>${Api.money(t.valor)}</b></p>
      <div class="grid cols-2e"><div class="table-wrap"><table class="t" style="min-width:0"><thead><tr><th>Género</th><th class="num">Títulos</th><th class="num">Unidades</th><th class="num">Valor</th></tr></thead><tbody>
      ${inv.porGenero.map((g) => `<tr><td>${esc(g.genero)}</td><td class="num">${g.titulos}</td><td class="num">${g.unidades}</td><td class="num">${Api.money(g.valor)}</td></tr>`).join('')}</tbody></table></div>
      <div class="table-wrap"><table class="t" style="min-width:0"><thead><tr><th>Alerta</th><th>Juego</th><th class="num">Stock</th><th class="num">Mín.</th></tr></thead><tbody>
      ${inv.alertas.map((a) => `<tr><td><span class="pill ${a.stock == 0 ? 'danger' : 'warn'}">${a.alerta}</span></td><td>${esc(a.titulo)}</td><td class="num">${a.stock}</td><td class="num">${a.stock_minimo}</td></tr>`).join('')
        || '<tr class="state"><td colspan="4">Sin alertas.</td></tr>'}</tbody></table></div></div>`;
  }

  $('#gen').onclick = generar;
  document.querySelectorAll('[data-range]').forEach((b) => (b.onclick = () => {
    const d = Number(b.dataset.range);
    $('#desde').value = iso(new Date(Date.now() - (d - 1) * 864e5)); $('#hasta').value = iso(new Date()); generar();
  }));
  $('#csvVentas').onclick = () => last.v && Panel.csv(`ventas_${last.v.desde}_${last.v.hasta}.csv`, ['Periodo', 'Ventas', 'Subtotal', 'IVA', 'Total'],
    last.v.serie.map((s) => [s.periodo, s.ventas, s.subtotal, s.impuesto, s.total]));
  $('#csvJuegos').onclick = () => last.j && Panel.csv(`top_juegos_${last.j.desde}_${last.j.hasta}.csv`, ['SKU', 'Juego', 'Género', 'Unidades', 'Importe'],
    last.j.top.map((t) => [t.sku, t.titulo, t.genero, t.unidades, t.importe]));
  $('#csvInv').onclick = () => last.inv && Panel.csv('inventario.csv', ['Género', 'Títulos', 'Unidades', 'Valor'], last.inv.porGenero.map((g) => [g.genero, g.titulos, g.unidades, g.valor]));
  generar();
})();
