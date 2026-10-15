(async function () {
  await Panel.init({ roles: ['admin'], title: 'Configuración', subtitle: 'Parámetros del sistema que aplican las reglas de negocio' });
  const $ = (s) => document.querySelector(s);
  const f = $('#fCfg');

  async function load() {
    try {
      const rows = await Api.get('/config');
      rows.forEach((r) => { const i = f.querySelector(`[name="${r.clave}"]`); if (i) i.value = r.valor; });
      $('#upd').textContent = 'Última modificación: ' + Api.date(rows.reduce((a, r) => (r.updated_at > a ? r.updated_at : a), ''));
    } catch (e) { Panel.toast(e.message, 'error'); }
  }
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!Panel.validate(f)) return;
    if (!(await Panel.confirm('Guardar configuración', 'Los cambios aplicarán a las nuevas ventas. ¿Deseas continuar?', 'Guardar'))) return;
    try { await Api.put('/config', Panel.formData(f)); Panel.toast('Configuración guardada.'); load(); } catch (err) { Panel.showErrors(f, err); }
  };
  load();
})();
