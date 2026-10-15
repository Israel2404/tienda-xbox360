(async function () {
  const u = await Panel.init({ roles: ['admin', 'vendedor'], title: 'Dashboard', subtitle: 'Resumen de la tienda en tiempo real',
    actions: '<a class="btn primary" href="pos.html">🛒 Nueva venta</a><button class="btn" id="refresh">↻ Actualizar</button>' });
  const $ = (s) => document.querySelector(s);
  const esc = Api.esc;
  let charts = [];
  Chart.defaults.color = '#9fb09f'; Chart.defaults.borderColor = 'rgba(255,255,255,.08)'; Chart.defaults.font.family = 'Segoe UI, Open Sans, sans-serif';

  async function load() {
    Panel.boxState($('#kpis'), 'loading', 'Cargando indicadores…');
    try {
      const d = await Api.get('/dashboard');
      render(d);
    } catch (e) { Panel.boxState($('#kpis'), 'error', e.message, load); }
  }

  function render(d) {
    const k = d.kpis;
    const kpi = (label, value, hint, cls = '') => `<div class="card kpi ${cls}"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>`;
    $('#kpis').innerHTML =
      kpi('Ventas de hoy', k.ventas_hoy, Api.money(k.ingresos_hoy)) +
      kpi('Ingresos del mes', Api.money(k.ingresos_mes), `${k.ventas_mes} ventas · ticket ${Api.money(k.ticket_promedio)}`, 'info') +
      kpi('Juegos activos', k.juegos_activos, `${k.unidades_inventario} unidades en inventario`) +
      kpi('Stock bajo', k.stock_bajo, `${k.agotados} agotado(s)`, k.stock_bajo ? 'warn' : '') +
      kpi('Clientes', k.clientes, `${k.usuarios} usuarios del sistema`) +
      kpi('Cancelaciones (mes)', k.canceladas_mes, 'ventas revertidas', k.canceladas_mes ? 'danger' : '');

    charts.forEach((c) => c.destroy()); charts = [];
    const days = d.ventas_30_dias;
    charts.push(new Chart($('#chartVentas'), {
      type: 'line',
      data: { labels: days.map((x) => x.fecha.slice(5).split('-').reverse().join('/')),
        datasets: [{ label: 'Ingresos', data: days.map((x) => x.total), borderColor: '#7ed957', backgroundColor: 'rgba(93,194,30,.18)', fill: true, tension: .35, pointRadius: 2, yAxisID: 'y' },
                   { label: 'Ventas', data: days.map((x) => x.ventas), type: 'bar', backgroundColor: 'rgba(86,182,255,.35)', yAxisID: 'y1' }] },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: { y: { ticks: { callback: (v) => '$' + v.toLocaleString('es-MX') } }, y1: { position: 'right', grid: { display: false }, ticks: { precision: 0 } } },
        plugins: { tooltip: { callbacks: { label: (c) => c.dataset.label === 'Ingresos' ? ' ' + Api.money(c.raw) : ` ${c.raw} ventas` } } } },
    }));
    const palette = ['#7ed957', '#3fae1f', '#56b6ff', '#ffc83d', '#ff8a65', '#b388ff', '#4dd0e1', '#f06292', '#aed581', '#90a4ae', '#ffd54f', '#81c784'];
    if (d.ventas_por_genero.length) {
      charts.push(new Chart($('#chartGeneros'), {
        type: 'doughnut',
        data: { labels: d.ventas_por_genero.map((g) => g.genero), datasets: [{ data: d.ventas_por_genero.map((g) => Number(g.unidades)), backgroundColor: palette, borderColor: '#0f1a10', borderWidth: 2 }] },
        options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } },
      }));
    } else Panel.boxState($('#chartGeneros').parentElement, 'empty', 'Sin ventas en los últimos 30 días.');

    $('#stockBajo').innerHTML = d.stock_bajo.length ? d.stock_bajo.map((j) => `<tr>
        <td>${esc(j.titulo)}<br><small style="color:var(--muted)">${esc(j.sku)}</small></td>
        <td class="num"><span class="pill ${j.stock == 0 ? 'danger' : 'warn'}">${j.stock}</span></td><td class="num">${j.stock_minimo}</td>
        <td>${Panel.can('admin') ? `<a class="btn sm" href="juegos.html?stock=${j.id}">Surtir</a>` : ''}</td></tr>`).join('')
      : '<tr class="state"><td colspan="4">✔ Todo el inventario está por encima del mínimo.</td></tr>';

    $('#topJuegos').innerHTML = d.top_juegos.length ? d.top_juegos.map((j, i) => `<tr><td>${i + 1}. ${esc(j.titulo)}</td><td class="num">${j.unidades}</td></tr>`).join('')
      : '<tr class="state"><td colspan="2">Sin ventas recientes.</td></tr>';

    $('#ultimas').innerHTML = d.ultimas_ventas.map((v) => `<tr><td><a href="ventas.html?id=${v.id}">${esc(v.folio)}</a><br><small style="color:var(--muted)">${esc(v.cliente || '')}</small></td>
      <td>${Api.date(v.created_at)}</td><td class="num">${Api.money(v.total)}</td>
      <td>${v.estado === 'cancelada' ? '<span class="pill danger">Cancelada</span>' : `<span class="pill ${v.canal === 'online' ? 'info' : 'ok'}">${v.canal}</span>`}</td></tr>`).join('')
      || '<tr class="state"><td colspan="4">Aún no hay ventas.</td></tr>';

    if (d.actividad.length) {
      $('#actividadCard').hidden = false;
      $('#actividad').innerHTML = d.actividad.map((a) => `<tr><td>${Api.date(a.created_at)}</td><td>${esc(a.usuario || 'Sistema')}</td>
        <td><span class="pill">${esc(a.accion)}</span> ${esc(a.entidad)}${a.entidad_id ? ' #' + a.entidad_id : ''}</td></tr>`).join('');
    }
  }

  $('#refresh').onclick = load;
  load();
})();
