/* Cliente HTTP de la API REST — compartido por la tienda y el panel.
   Todas las operaciones pasan por /api (el frontend nunca toca la base de datos). */
(function () {
  const scriptSrc = document.currentScript && document.currentScript.src;
  const ROOT = scriptSrc ? scriptSrc.replace(/assets\/js\/api\.js.*$/, '') : '/';
  const API = ROOT + 'api';
  let csrf = null;
  let direct = false;
  try { direct = sessionStorage.getItem('r360-direct') === '1'; } catch (e) { /* sin storage */ }

  class ApiError extends Error {
    constructor(message, status, errors) { super(message); this.status = status; this.errors = errors || {}; }
  }

  async function ensureCsrf() {
    if (csrf) return csrf;
    const r = await request('GET', '/auth/me');
    return csrf;
  }

  async function request(method, path, body, opts = {}) {
    const headers = { Accept: 'application/json' };
    const init = { method, headers, credentials: 'same-origin' };
    if (method !== 'GET') {
      if (!csrf && path !== '/auth/me') await ensureCsrf();
      headers['X-CSRF-Token'] = csrf || '';
      if (body instanceof FormData) init.body = body;
      else if (body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    }
    // Con mod_rewrite: /api/catalogo. Sin él (Apache con AllowOverride None): /api/index.php/catalogo
    let url = API + (direct ? '/index.php' : '') + path;
    if (opts.query) {
      const q = new URLSearchParams();
      Object.entries(opts.query).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) q.append(k, v); });
      const s = q.toString(); if (s) url += '?' + s;
    }
    let res;
    try { res = await fetch(url, init); }
    catch (e) { throw new ApiError('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.', 0); }
    let data = null;
    try { data = await res.clone().json(); } catch (e) { /* respuesta no JSON */ }
    // 404 que no viene de nuestra API (página de Apache) → el .htaccess no se aplica; reintenta directo a index.php
    if (res.status === 404 && data === null && !direct) {
      direct = true;
      try { sessionStorage.setItem('r360-direct', '1'); } catch (e) { /* sin storage */ }
      return request(method, path, body, opts);
    }
    if (res.ok && data === null) {
      const txt = await res.text().catch(() => '');
      const msg = txt.includes('<?php')
        ? 'Apache no está ejecutando PHP: instala/activa PHP en Apache.'
        : 'El servidor no respondió con datos válidos. Revisa la configuración de PHP.';
      throw new ApiError(msg, 500);
    }
    if (data && data.csrf) csrf = data.csrf;
    if (!res.ok) {
      const msg = (data && data.mensaje) || (res.status >= 500 ? 'El servidor tuvo un problema. Intenta más tarde.' : 'No fue posible completar la operación.');
      if (res.status === 401 && opts.redirectOn401 !== false && window.Panel) window.Panel.sessionExpired();
      throw new ApiError(msg, res.status, data && data.errores);
    }
    return data;
  }

  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.Api = {
    ROOT, ApiError,
    get: (p, query, o) => request('GET', p, undefined, { ...(o || {}), query }),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    patch: (p, b) => request('PATCH', p, b),
    del: (p) => request('DELETE', p),
    me: () => request('GET', '/auth/me', undefined, { redirectOn401: false }),
    money: (n) => money.format(Number(n || 0)),
    esc,
    date: (s, withTime = true) => {
      if (!s) return '—';
      const str = String(s); const d = new Date(str.length === 10 ? str + 'T00:00:00' : str.replace(' ', 'T'));
      return d.toLocaleString('es-MX', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
    },
  };
})();
