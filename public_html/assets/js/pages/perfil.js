(async function () {
  const u = await Panel.init({ roles: ['admin', 'vendedor', 'cliente'], title: 'Mi perfil', subtitle: 'Datos de tu cuenta y seguridad' });
  const $ = (s) => document.querySelector(s);
  const esc = Api.esc;

  async function load() {
    Panel.boxState($('#info'), 'loading');
    try {
      const p = await Api.get('/perfil');
      const s = p.estadisticas;
      $('#info').innerHTML = `<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><span class="avatar" style="width:56px;height:56px;font-size:22px">${esc(p.nombre[0].toUpperCase())}</span>
        <div><b style="font-size:18px">${esc(p.nombre)}</b><br><span class="pill">${esc(p.rol_nombre)}</span></div></div>
        <dl class="dl"><dt>Correo</dt><dd>${esc(p.email)}</dd><dt>Miembro desde</dt><dd>${Api.date(p.created_at, false)}</dd><dt>Último acceso</dt><dd>${Api.date(p.ultimo_acceso)}</dd>
        <dt>${p.rol === 'cliente' ? 'Compras' : 'Ventas registradas'}</dt><dd>${s.compras ?? s.ventas} · ${Api.money(s.total)}</dd></dl>`;
      $('#nombre').value = p.nombre;
    } catch (e) { Panel.boxState($('#info'), 'error', e.message, load); }
  }

  $('#fNombre').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    if (!Panel.validate(f)) return;
    try { await Api.put('/perfil', Panel.formData(f)); Panel.toast('Perfil actualizado.'); load(); } catch (err) { Panel.showErrors(f, err); }
  };
  $('#fPass').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    if (!Panel.validate(f)) return;
    const d = Panel.formData(f);
    if (d.nueva !== d.confirmar) { Panel.showErrors(f, { message: 'Las contraseñas no coinciden.', errors: { confirmar: 'No coincide con la nueva contraseña.' } }); return; }
    try { await Api.patch('/perfil/password', { actual: d.actual, nueva: d.nueva }); Panel.toast('Contraseña actualizada.'); f.reset(); } catch (err) { Panel.showErrors(f, err); }
  };
  load();
})();
