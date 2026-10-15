/* Genera portadas estilo "estuche" para juegos sin imagen (sin usar arte con derechos).
   Si el juego tiene portada_url (subida por el admin) se usa esa imagen. */
(function () {
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const palettes = [
    ['#1b3a1b', '#0a1a0a'], ['#3a1414', '#140606'], ['#14263a', '#060d18'], ['#3a2c12', '#171005'],
    ['#2c1a3a', '#0f0716'], ['#12333a', '#051417'], ['#3a1a2f', '#160711'], ['#262626', '#0b0b0b'],
  ];
  window.Cover = function (g, opts = {}) {
    const esc = window.Api ? Api.esc : (s) => s;
    if (g.portada_url) {
      return `<div class="case has-img"><img src="${esc(Api.ROOT + g.portada_url)}" alt="${esc(g.titulo)}" loading="lazy" draggable="false"></div>`;
    }
    const h = hash(g.titulo);
    const [a, b] = palettes[h % palettes.length];
    const angle = 120 + (h % 90);
    const shape = h % 3;
    const words = String(g.titulo).split(/[:\-]/)[0];
    const sub = String(g.titulo).includes(':') ? String(g.titulo).split(':').slice(1).join(':').trim() : '';
    const size = words.length > 22 ? 'sm' : words.length > 12 ? 'md' : 'lg';
    return `
      <div class="case" style="--c1:${a};--c2:${b};--ang:${angle}deg">
        <div class="case-band"><span>${esc(g.genero || 'Juego')}</span><span class="case-band-sku">${esc(g.sku || '')}</span></div>
        <div class="case-art shape-${shape}">
          <div class="case-title ${size}">${esc(words)}</div>
          ${sub ? `<div class="case-sub">${esc(sub)}</div>` : ''}
        </div>
        <div class="case-foot">
          <span class="esrb">${esc(g.clasificacion || 'T')}</span>
          <span class="case-dev">${esc(g.desarrollador || '')}</span>
          <span class="case-year">${esc(g.anio_lanzamiento || '')}</span>
        </div>
      </div>`;
  };
})();
