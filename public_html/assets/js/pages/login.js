(function () {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const safeNext = (u) => (u && !/^[a-z]+:|^\/\//i.test(u) ? u : null);   // evita redirecciones abiertas
  const next = safeNext(params.get('next'));

  const goHome = (u) => { location.href = next || (u.rol === 'cliente' ? '../index.html' : 'dashboard.html'); };

  Api.me().then((r) => { if (r.usuario) goHome(r.usuario); }).catch(() => {});

  function tab(t) {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('#loginForm').hidden = t !== 'login'; $('#regForm').hidden = t !== 'registro';
  }
  document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
  if (params.get('registro')) tab('registro');

  document.querySelectorAll('[data-u]').forEach((b) => (b.onclick = () => {
    const [e, p] = b.dataset.u.split(':'); $('#email').value = e; $('#password').value = p;
  }));

  async function submit(form, path) {
    if (!Panel.validate(form)) return;
    const btn = form.querySelector('[type=submit]'); const txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Un momento…';
    try {
      const r = await Api.post(path, Panel.formData(form));
      Panel.toast('¡Bienvenido, ' + r.usuario.nombre + '!');
      setTimeout(() => goHome(r.usuario), 400);
    } catch (e) {
      Panel.showErrors(form, e);
      btn.disabled = false; btn.textContent = txt;
    }
  }
  $('#loginForm').onsubmit = (e) => { e.preventDefault(); submit(e.target, '/auth/login'); };
  $('#regForm').onsubmit = (e) => { e.preventDefault(); submit(e.target, '/auth/registro'); };
})();
