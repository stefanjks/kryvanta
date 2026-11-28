/* Детерминированный покадровый рендер ролика «Как прогреть TikTok за 3 дня».
   window.TL (timeline.json) подставляет драйвер; window.render(t) рисует кадр. */
(() => {
const TL = window.TL;
const P = {}; TL.phrases.forEach(p => P[p.id] = p);
const DUR = TL.duration;

/* ---------------- helpers ---------------- */
const $ = (tag, cls, html, css) => { const e = document.createElement(tag); if (cls) e.className = cls;
  if (html != null) e.innerHTML = html; if (css) Object.assign(e.style, css); return e; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pr = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const eo = x => 1 - Math.pow(1 - x, 3);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eb = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const popS = (t, t0, d = .42) => t < t0 ? 0 : eb(pr(t, t0, t0 + d));
const W = (pid, i) => { const w = P[pid].words; return w[Math.min(i, w.length - 1)].s; };
const PE = pid => P[pid].end;
function rnd(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const tf = (e, s) => { e.style.transform = s; };
const op = (e, o) => { e.style.opacity = o; };

/* ---------------- icons ---------------- */
const IC = {
  heart: f => `<path fill="${f}" d="M12 21.2s-7.6-4.7-9.7-9.3C.8 8.5 2.8 4.4 6.7 4.4c2.2 0 3.7 1.2 5.3 3.2 1.6-2 3.1-3.2 5.3-3.2 3.9 0 5.9 4.1 4.4 7.5-2.1 4.6-9.7 9.3-9.7 9.3z"/>`,
  cmt: f => `<path fill="${f}" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.5 6.5L4.8 21.6l4.2-2.1c.9.2 2 .3 3 .3 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/>`,
  save: f => `<path fill="${f}" d="M6.2 2.6h11.6c.7 0 1.2.5 1.2 1.2v17.6l-7-4.7-7 4.7V3.8c0-.7.5-1.2 1.2-1.2z"/>`,
  share: f => `<path fill="${f}" d="M13.6 4.2v4.3C6.6 9.3 3.4 14 3 20.4c2.4-3.6 5.7-5.3 10.6-5.3v4.4l7.9-7.6z"/>`,
  search: f => `<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="${f}" stroke-width="2.6"/><path d="M15.5 15.5l5 5" stroke="${f}" stroke-width="2.8" stroke-linecap="round"/>`,
  check: f => `<path d="M4.5 12.8l4.6 4.6L19.8 6.6" fill="none" stroke="${f}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  x: f => `<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="${f}" stroke-width="3.4" stroke-linecap="round"/>`,
  user: f => `<circle cx="12" cy="8.5" r="4.3" fill="${f}"/><path fill="${f}" d="M3.8 21c.6-4.4 4-7 8.2-7s7.6 2.6 8.2 7z"/>`,
  home: f => `<path fill="${f}" d="M3 11.2l9-7.4 9 7.4v9.1c0 .5-.4.9-.9.9h-5.3v-6.1H9.2v6.1H3.9a.9.9 0 0 1-.9-.9z"/>`,
  inbox: f => `<path fill="${f}" d="M3 5h18v11H14l-2 3-2-3H3z"/>`,
  friends: f => `<circle cx="8.5" cy="8.5" r="3.4" fill="${f}"/><circle cx="16.5" cy="9.5" r="2.8" fill="${f}"/><path fill="${f}" d="M2 19.5c.4-3.6 3.1-5.6 6.5-5.6s6.1 2 6.5 5.6zM15.4 19.5c-.2-1.9-.9-3.4-2-4.5 1-.6 2-.9 3.1-.9 2.7 0 4.8 1.6 5.2 5.4z"/>`,
  send: f => `<path fill="${f}" d="M3 20.5l18-8.5L3 3.5l.1 6.6L15 12 3.1 13.9z"/>`,
  repost: f => `<path d="M7 7h10l-2.6-2.6M17 17H7l2.6 2.6" fill="none" stroke="${f}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 7v4M7 17v-4" stroke="${f}" stroke-width="2.6" stroke-linecap="round"/>`,
  link: f => `<path d="M10 14l4-4M8.5 11.5l-2 2a3.5 3.5 0 0 0 5 5l2-2M15.5 12.5l2-2a3.5 3.5 0 0 0-5-5l-2 2" fill="none" stroke="${f}" stroke-width="2.4" stroke-linecap="round"/>`,
  dots: f => `<circle cx="5" cy="12" r="2.2" fill="${f}"/><circle cx="12" cy="12" r="2.2" fill="${f}"/><circle cx="19" cy="12" r="2.2" fill="${f}"/>`,
  msg: f => `<path fill="${f}" d="M4 4h16v12H8l-4 4z"/>`,
  cam: f => `<path fill="${f}" d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.6" fill="#000" opacity=".35"/>`,
  music: f => `<path fill="${f}" d="M9 18.5a2.5 2.5 0 1 1-1.5-2.3V5l11-2v12.5a2.5 2.5 0 1 1-1.5-2.3V6.1l-8 1.5z"/>`,
  text: f => `<path fill="${f}" d="M5 5h14v3h-2V7h-4v11h2v2H9v-2h2V7H7v1H5z"/>`,
  spark: f => `<path fill="${f}" d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/>`,
  scissors: f => `<circle cx="6" cy="6.5" r="2.8" fill="none" stroke="${f}" stroke-width="2.2"/><circle cx="6" cy="17.5" r="2.8" fill="none" stroke="${f}" stroke-width="2.2"/><path d="M8.3 8.2L20 18M8.3 15.8L20 6" stroke="${f}" stroke-width="2.2" stroke-linecap="round"/>`,
  plus: f => `<path d="M12 5v14M5 12h14" stroke="${f}" stroke-width="3" stroke-linecap="round"/>`,
};
const svg = (n, s, f = '#fff') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${IC[n](f)}</svg>`;

/* ---------------- «видео» (иллюстрации) ---------------- */
function voxel(seed, w = 18, h = 32) {
  const r = rnd(seed); let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">`;
  s += `<defs><linearGradient id="sk${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4ff"/><stop offset="1" stop-color="#bfe6ff"/></linearGradient></defs>`;
  s += `<rect width="${w}" height="${h}" fill="url(#sk${seed})"/>`;
  s += `<rect x="${12 + (seed % 3)}" y="3" width="3" height="3" fill="#fff6b0"/>`;
  for (let c = 0; c < 3; c++) { const cx = Math.floor(r() * (w - 5)), cy = 5 + Math.floor(r() * 6);
    s += `<rect x="${cx}" y="${cy}" width="${4 + Math.floor(r() * 3)}" height="1" fill="#fff" opacity=".9"/><rect x="${cx + 1}" y="${cy - 1}" width="2" height="1" fill="#fff" opacity=".9"/>`; }
  let hgt = 18 + Math.floor(r() * 3);
  const cols = [];
  for (let x = 0; x < w; x++) { hgt += Math.floor(r() * 3) - 1; hgt = Math.max(15, Math.min(22, hgt)); cols.push(hgt); }
  cols.forEach((y, x) => {
    s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${r() > .5 ? '#5dbb3b' : '#4fa832'}"/>`;
    for (let yy = y + 1; yy < h; yy++) {
      const deep = yy > y + 4; const v = r();
      const col = deep ? (v > .9 ? '#e8d36a' : v > .5 ? '#8a8a8a' : '#7a7a7a') : (v > .5 ? '#8b5a2b' : '#7a4e25');
      s += `<rect x="${x}" y="${yy}" width="1" height="1" fill="${col}"/>`;
    }
  });
  for (let k = 0; k < 2; k++) { const tx = 2 + Math.floor(r() * (w - 5)); const ty = cols[tx];
    s += `<rect x="${tx}" y="${ty - 3}" width="1" height="3" fill="#6b4423"/><rect x="${tx - 1}" y="${ty - 6}" width="3" height="3" fill="#2f8f2f"/><rect x="${tx}" y="${ty - 7}" width="1" height="1" fill="#2f8f2f"/>`; }
  // маленький домик
  const hx = 6 + (seed % 5), hy = cols[hx];
  s += `<rect x="${hx}" y="${hy - 3}" width="4" height="3" fill="#c79a5b"/><rect x="${hx + 1}" y="${hy - 2}" width="1" height="2" fill="#5a3a1a"/><rect x="${hx - 1}" y="${hy - 4}" width="6" height="1" fill="#9b2f2f"/><rect x="${hx}" y="${hy - 5}" width="4" height="1" fill="#9b2f2f"/>`;
  return s + '</svg>';
}
const THEMES = {
  mc: s => voxel(s),
  fun: () => `<div class="layer center" style="background:linear-gradient(160deg,#ffb03a,#ff3d77);font-size:200px">😂</div>`,
  edu: () => `<div class="layer center" style="background:linear-gradient(160deg,#2f80ff,#7a3cff);flex-direction:column;gap:10px"><div style="font-size:170px">🎓</div><div style="font-size:50px;font-weight:900;opacity:.9">a²+b²=c²</div></div>`,
  tech: () => `<div class="layer center" style="background:radial-gradient(circle at 50% 40%,#3b1d8f,#0b0b2a);font-size:180px">💻</div>`,
};
const thumb = (k, s = 1) => `<div class="layer">${THEMES[k](s)}</div>`;

/* ---------------- UI builders ---------------- */
function phone(parent) {
  const ph = $('div', 'phone'); const sc = $('div', 'screen');
  ph.appendChild(sc); sc.appendChild($('div', 'notch'));
  parent.appendChild(ph);
  return { ph, sc };
}
function statusBar(sc, dark = false) {
  const c = dark ? '#161823' : '#fff';
  sc.appendChild($('div', 'sb', `<span>9:41</span><span style="display:flex;gap:8px;align-items:center">
    <svg width="26" height="18" viewBox="0 0 26 18"><rect x="0" y="11" width="4" height="7" rx="1" fill="${c}"/><rect x="7" y="7" width="4" height="11" rx="1" fill="${c}"/><rect x="14" y="3" width="4" height="15" rx="1" fill="${c}"/><rect x="21" y="0" width="4" height="18" rx="1" fill="${c}"/></svg>
    <svg width="40" height="20" viewBox="0 0 40 20"><rect x="1" y="1" width="33" height="18" rx="5" fill="none" stroke="${c}" stroke-width="2" opacity=".5"/><rect x="4" y="4" width="25" height="12" rx="3" fill="${c}"/><rect x="36" y="7" width="3" height="6" rx="1" fill="${c}" opacity=".5"/></svg></span>`, { color: c }));
}
function navBar(sc) {
  const n = $('div', 'nav', `<div>${svg('home', 34)}Главная</div><div>${svg('friends', 34, '#bbb')}Друзья</div>
     <div><div class="plusbtn">+</div></div><div>${svg('inbox', 34, '#bbb')}Входящие</div><div>${svg('user', 34, '#bbb')}Профиль</div>`);
  sc.appendChild(n); return n;
}
function feed(sc, o = {}) {
  const L = $('div', 'layer');
  const vid = $('div', 'vid', thumb(o.kind || 'mc', o.seed || 3)); L.appendChild(vid);
  L.appendChild($('div', 'shade'));
  L.appendChild($('div', 'tabs', `<span>Подписки</span><span class="on">Рекомендации</span>`));
  const rail = $('div', 'rail');
  const av = $('div', 'av', `${o.avatar || '🧱'}<div class="avplus">+</div>`);
  const mk = (ic, cnt) => { const b = $('div', 'rb', `${svg(ic, 56)}<span>${cnt}</span>`); rail.appendChild(b); return b; };
  rail.appendChild(av);
  const heart = mk('heart', o.likes || '12,4K'), cmt = mk('cmt', o.cmts || '318'),
        save = mk('save', o.saves || '2104'), share = mk('share', o.shares || '96');
  L.appendChild(rail);
  L.appendChild($('div', 'meta', `<b>${o.user || '@blockmaster'}</b><p>${o.cap || 'Строю уютный дом за 60 секунд 🏠 #minecraft #постройки'}</p><div class="mu">♫ оригинальный звук</div>`));
  const pb = $('div', 'pbar', '<i></i>'); L.appendChild(pb);
  sc.appendChild(L);
  statusBar(sc); navBar(sc);
  return { L, vid, rail, av, heart, cmt, save, share, pb: pb.firstChild };
}
function setIcon(btn, ic, col, scale = 1) {
  const s = btn.querySelector('svg'); s.innerHTML = IC[ic](col); tf(s, `scale(${scale})`);
}
function offsetIn(e, anc) { let x = 0, y = 0; while (e && e !== anc) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
  return { x, y }; }
function centerOf(e, anc) { const o = offsetIn(e, anc); return { x: o.x + e.offsetWidth / 2, y: o.y + e.offsetHeight / 2 }; }
function iconPt(btn, anc) { const c = centerOf(btn, anc); return { x: c.x, y: c.y - 12 }; }

/* палец-тап */
class Finger {
  constructor(parent, taps) { this.taps = taps; this.f = $('div', 'finger'); this.r = $('div', 'ripple');
    parent.appendChild(this.r); parent.appendChild(this.f); }
  update(t) {
    const T = this.taps; let i = -1;
    for (let k = 0; k < T.length; k++) if (t >= T[k].t - .45) i = k;
    if (i < 0) { op(this.f, 0); op(this.r, 0); return; }
    const a = T[i], prev = i > 0 ? T[i - 1] : { x: a.x + 150, y: a.y + 260 };
    const m = eio(pr(t, a.t - .42, a.t - .04));
    const x = lerp(prev.x, a.x, m), y = lerp(prev.y, a.y, m);
    const last = T[T.length - 1];
    const vis = (i === 0 ? pr(t, a.t - .45, a.t - .25) : 1) * (1 - pr(t, last.t + .35, last.t + .6));
    const press = t >= a.t && t < a.t + .13 ? .78 : 1;
    this.f.style.left = x + 'px'; this.f.style.top = y + 'px'; op(this.f, vis); tf(this.f, `scale(${press})`);
    const rp = pr(t, a.t, a.t + .45);
    this.r.style.left = a.x + 'px'; this.r.style.top = a.y + 'px';
    op(this.r, t >= a.t ? (1 - rp) * .9 : 0); tf(this.r, `scale(${.6 + rp * 1.8})`);
  }
}
/* разлёт частиц */
class Burst {
  constructor(parent, x, y, t0, colors, n = 14, seed = 1, dist = 120, size = 16) {
    const r = rnd(seed); this.t0 = t0; this.x = x; this.y = y; this.p = [];
    for (let i = 0; i < n; i++) { const e = $('div', 'part'); const s = size * (.6 + r() * .8);
      Object.assign(e.style, { width: s + 'px', height: s + 'px', marginLeft: -s / 2 + 'px', marginTop: -s / 2 + 'px', background: colors[i % colors.length] });
      parent.appendChild(e); this.p.push({ e, a: (i / n) * 6.283 + r() * .5, d: dist * (.6 + r() * .7) }); }
  }
  update(t) {
    const k = pr(t, this.t0, this.t0 + .65);
    this.p.forEach(q => { const d = q.d * eo(k); q.e.style.left = this.x + Math.cos(q.a) * d + 'px';
      q.e.style.top = this.y + Math.sin(q.a) * d + 'px'; op(q.e, t < this.t0 ? 0 : 1 - k); tf(q.e, `scale(${1 - k * .6})`); });
  }
}
/* конфетти */
class Confetti {
  constructor(parent, t0, n = 70, seed = 9) { const r = rnd(seed); this.t0 = t0; this.p = [];
    const cols = ['#FFE14A', '#3DFF8B', '#25F4EE', '#FE2C55', '#ffffff', '#b07bff'];
    for (let i = 0; i < n; i++) { const e = $('div', 'part'); const w = 14 + r() * 14, h = 8 + r() * 10;
      Object.assign(e.style, { width: w + 'px', height: h + 'px', borderRadius: '3px', background: cols[i % cols.length] });
      parent.appendChild(e);
      this.p.push({ e, x: 540 + (r() - .5) * 200, y: 700, vx: (r() - .5) * 1700, vy: -900 - r() * 1300, rot: r() * 720, vr: (r() - .5) * 1400 }); } }
  update(t) { const dt = t - this.t0;
    this.p.forEach(q => { if (dt < 0) { op(q.e, 0); return; }
      const x = q.x + q.vx * dt * .9, y = q.y + q.vy * dt + 1500 * dt * dt;
      q.e.style.left = x + 'px'; q.e.style.top = y + 'px'; op(q.e, 1 - pr(dt, 1.6, 2.4)); tf(q.e, `rotate(${q.rot + q.vr * dt}deg)`); }); }
}
function typeInto(e, text, t, t0, cps = 26, caret = true) {
  const n = Math.floor(clamp((t - t0) * cps, 0, text.length));
  const blink = caret && (Math.floor(t * 2.5) % 2 === 0 || n < text.length) && t >= t0 - .3;
  e.innerHTML = text.slice(0, n) + (blink ? '<span class="caret"></span>' : '');
  return n;
}
function sticker(parent, html, cls, x, y, rot = -4) {
  const s = $('div', 'sticker ' + (cls || ''), html); parent.appendChild(s);
  s.style.left = x + 'px'; s.style.top = y + 'px'; s._rot = rot; return s;
}
function stickerUpd(s, t, t0, out = 99) {
  const k = popS(t, t0, .45); const o = 1 - pr(t, out, out + .2);
  op(s, t < t0 ? 0 : o); tf(s, `translate(-50%,-50%) rotate(${s._rot + (1 - k) * -14}deg) scale(${k * (1 + .03 * Math.sin(t * 5))})`);
}
function dayChip(day) { return ['', '🎯 ВЫБЕРИ ТЕМАТИКУ', '💬 ОБЩАЙСЯ С АВТОРАМИ', '🌿 ЕСТЕСТВЕННАЯ АКТИВНОСТЬ'][day]; }
function daySlam(parent, day, color) {
  const g = $('div', 'layer');
  const rings = [0, 1, 2].map(() => { const r = $('div', 'abs', '', { left: '540px', top: '620px', width: '300px', height: '300px', margin: '-150px 0 0 -150px',
    borderRadius: '50%', border: `10px solid ${color}` }); g.appendChild(r); return r; });
  const lab = $('div', 'big', 'ДЕНЬ', { top: '330px', fontSize: '170px', color: '#fff' });
  const num = $('div', 'big', String(day), { top: '470px', fontSize: '440px', color, textShadow: `0 0 80px ${color}, 0 18px 0 rgba(0,0,0,.35)` });
  const chip = $('div', 'abs', dayChip(day), { left: '540px', top: '1030px', fontWeight: 800, fontSize: '44px', padding: '18px 34px', borderRadius: '50px',
    background: 'rgba(255,255,255,.1)', border: '2px solid rgba(255,255,255,.25)', whiteSpace: 'nowrap' });
  g.append(lab, num, chip); parent.appendChild(g);
  return (t, tChip) => {
    const k = eo(pr(t, 0, .28));
    tf(num, `scale(${lerp(2.6, 1, k) * (1 + .02 * Math.sin(t * 6))})`); op(num, k);
    tf(lab, `translateY(${(1 - eo(pr(t, .08, .4))) * -80}px)`); op(lab, pr(t, .08, .3));
    rings.forEach((r, i) => { const q = pr(t, .22 + i * .12, .9 + i * .12); tf(r, `scale(${.5 + q * 3})`); op(r, (1 - q) * .8 * (t > .22 + i * .12)); });
    const c = popS(t, tChip, .4); op(chip, t < tChip ? 0 : 1); tf(chip, `translate(-50%,0) scale(${c})`);
    return g;
  };
}

/* ---------------- сцены ---------------- */
const scenes = [];
const S = (from, o) => scenes.push(Object.assign({ from }, o));

// p1 — новый аккаунт
S('p1', { phone: 1, build(st, T0) {
  const { ph, sc } = phone(st); sc.classList.add('light'); statusBar(sc, true);
  const L = $('div', 'layer', `
    <div class="topbar" style="gap:10px">@novichok_2026 <span style="font-size:18px">▾</span></div>
    <div class="abs center" style="left:178px;top:150px;width:160px;height:160px;border-radius:50%;background:linear-gradient(145deg,#e6e6ea,#cfd0d6)">${svg('user', 96, '#9a9ba3')}</div>
    <div class="abs" style="left:0;right:0;top:330px;text-align:center;font-weight:800;font-size:26px">@novichok_2026</div>
    <div class="abs" style="left:30px;right:30px;top:380px;display:flex;justify-content:space-around;text-align:center">
      <div><b class="z" style="font-size:34px">0</b><div style="font-size:18px;color:#8a8b91">Подписки</div></div>
      <div><b class="z" style="font-size:34px">0</b><div style="font-size:18px;color:#8a8b91">Подписчики</div></div>
      <div><b class="z" style="font-size:34px">0</b><div style="font-size:18px;color:#8a8b91">Лайки</div></div></div>
    <div class="abs center" style="left:120px;right:120px;top:478px;height:58px;border-radius:10px;background:#f1f1f2;font-weight:700;font-size:21px">Изменить профиль</div>
    <div class="abs" style="left:0;right:0;top:566px;height:2px;background:#eee"></div>
    <div class="abs" style="left:0;right:0;top:640px;text-align:center;color:#8a8b91"><div style="font-size:70px">📷</div>
      <div style="font-weight:800;font-size:24px;color:#161823;margin-top:10px">Пока нет видео</div></div>`);
  sc.appendChild(L); navBar(sc);
  const stc = sticker(st, '✨ НОВЫЙ АККАУНТ', '', 540, 250, -5);
  const zs = [...L.querySelectorAll('.z')];
  return t => { stickerUpd(stc, t, W('p1', 1) - T0);
    zs.forEach((z, i) => { const k = popS(t, .9 + i * .12, .35); tf(z, `scale(${.6 + .4 * k + .25 * Math.sin(clamp(t - .9 - i * .12, 0, .3) * 10)})`); z.style.display = 'inline-block'; z.style.color = t > 1 + i * .12 ? '#FE2C55' : '#161823'; });
    return ph; };
}, cues: T0 => [{ t: W('p1', 1), type: 'pop' }] });

// p2 — не спеши
S('p2', { build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const card = $('div', 'glass center', '', { left: '190px', top: '300px', width: '700px', height: '700px', flexDirection: 'column', gap: '150px' });
  const btn = $('div', 'plusbtn', '+', { width: '330px', height: '200px', borderRadius: '50px', fontSize: '170px', boxShadow: '-22px 0 0 #25F4EE,22px 0 0 #FE2C55' });
  const lab = $('div', '', 'Опубликовать 50 видео', { fontWeight: 800, fontSize: '46px', opacity: .9 });
  card.append(btn, lab); g.appendChild(card);
  const ban = $('div', 'abs center', `<svg width="440" height="440" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#FF3D63" stroke-width="10"/><path d="M20 20L80 80" stroke="#FF3D63" stroke-width="10"/></svg>`,
    { left: '320px', top: '327px', width: '440px', height: '440px' });
  g.appendChild(ban);
  const stc = sticker(st, '✋ НЕ СПЕШИ!', 'red', 540, 230, 4);
  const tb = W('p2', 1) - T0;
  return t => { const k = eo(pr(t, 0, .3)); tf(card, `scale(${lerp(.8, 1, k)})`); op(card, k);
    const b = pr(t, tb, tb + .22); op(ban, t < tb ? 0 : 1); tf(ban, `scale(${lerp(2.2, 1, eo(b))})`);
    const sh = t > tb && t < tb + .35 ? Math.sin((t - tb) * 90) * 14 * (1 - (t - tb) / .35) : 0;
    tf(g, `translateX(${sh}px)`); stickerUpd(stc, t, tb - .05);
    lab.style.textDecoration = t > tb ? 'line-through' : 'none'; lab.style.color = t > tb ? '#FF3D63' : '#fff';
    return g; };
}, cues: T0 => [{ t: W('p2', 1), type: 'thud' }] });

// p3 — ПРОГРЕЙ АККАУНТ ЗА 3 ДНЯ
S('p3', { build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const fire = $('div', 'abs center', '🔥', { left: '390px', top: '170px', width: '300px', height: '300px', fontSize: '230px' });
  const l1 = $('div', 'big', 'ПРОГРЕЙ', { top: '480px', fontSize: '170px', color: '#FFE14A' });
  const l2 = $('div', 'big', 'АККАУНТ', { top: '650px', fontSize: '150px' });
  const l3 = $('div', 'big', 'ЗА <span style="color:#3DFF8B;font-size:230px">3</span> ДНЯ', { top: '800px', fontSize: '150px' });
  const bar = $('div', 'abs', '<i style="display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,#25F4EE,#FFE14A,#FF6B2C,#FF3D63)"></i>',
    { left: '190px', top: '1080px', width: '700px', height: '34px', borderRadius: '20px', background: 'rgba(255,255,255,.12)' });
  g.append(fire, l1, l2, l3, bar);
  const a = W('p3', 2) - T0, b = W('p3', 4) - T0, c = W('p3', 6) - T0;
  return t => {
    [[l1, a], [l2, b], [l3, c]].forEach(([e, t0]) => { const k = popS(t, t0 - .05, .4); op(e, t < t0 - .05 ? 0 : 1); tf(e, `scale(${k}) rotate(${(1 - k) * -6}deg)`); });
    const f = popS(t, 0, .5); tf(fire, `scale(${f * (1 + .07 * Math.sin(t * 9))}) rotate(${Math.sin(t * 4) * 5}deg)`);
    bar.firstChild.style.width = (eio(pr(t, .2, PE('p3') - T0 + .1)) * 100) + '%';
    return g; };
}, cues: T0 => [{ t: W('p3', 2), type: 'pop' }, { t: W('p3', 4), type: 'pop' }, { t: W('p3', 6), type: 'ding' }] });

// p4 — план: 3 карточки
S('p4', { build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const data = [['👀', 'ДЕНЬ 1', 'Смотрим', '#25F4EE'], ['💬', 'ДЕНЬ 2', 'Общаемся', '#FF5C8A'], ['🎬', 'ДЕНЬ 3', 'Публикуем', '#3DFF8B']];
  const cards = data.map(([e, d, s, c], i) => { const k = $('div', 'glass center', `<div style="font-size:110px">${e}</div><div style="font-weight:900;font-size:50px;color:${c};margin-top:14px">${d}</div><div style="font-weight:700;font-size:34px;opacity:.85;margin-top:6px">${s}</div>`,
    { left: (70 + i * 320) + 'px', top: '420px', width: '300px', height: '470px', flexDirection: 'column', borderColor: c + '88' }); g.appendChild(k); return k; });
  return t => { cards.forEach((k, i) => { const q = popS(t, .05 + i * .22, .45); op(k, q > 0 ? 1 : 0);
    tf(k, `translateY(${(1 - q) * 300 + Math.sin(t * 3 + i) * 10}px) rotate(${(i - 1) * 4 * q}deg) scale(${.6 + .4 * q})`); }); return g; };
}, cues: T0 => [0, 1, 2].map(i => ({ t: T0 + .05 + i * .22, type: 'pop', g: .7 })) });

// p5 — ДЕНЬ 1
S('p5', { day: 1, flash: 1, build(st, T0) { const u = daySlam(st, 1, '#25F4EE'); const tc = W('p5', 2) - T0; return t => u(t, tc); },
  cues: T0 => [{ t: T0 + .05, type: 'thud' }, { t: W('p5', 2), type: 'pop' }] });

// p6 — тематики
S('p6', { day: 1, build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const items = [['mc', '⛏️ Minecraft', 1], ['fun', '😂 Юмор', 2], ['edu', '🎓 Обучение', 3], ['tech', '💻 Технологии', 5]];
  const tiles = items.map(([k, lab, wi], i) => { const x = 110 + (i % 2) * 440, y = 230 + Math.floor(i / 2) * 470;
    const e = $('div', 'abs', `${thumb(k, 5)}<div class="abs" style="left:0;right:0;bottom:0;padding:22px;font-weight:900;font-size:40px;background:linear-gradient(transparent,rgba(0,0,0,.7))">${lab}</div>
      <div class="ck abs center" style="right:18px;top:18px;width:74px;height:74px;border-radius:50%;background:#3DFF8B">${svg('check', 52, '#0b2a17')}</div>`,
      { left: x + 'px', top: y + 'px', width: '420px', height: '440px', borderRadius: '34px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)', border: '6px solid transparent' });
    g.appendChild(e); return { e, t0: W('p6', wi) - T0 - .05, ck: e.querySelector('.ck') }; });
  const sel = PE('p6') - T0 - .25;
  return t => { tiles.forEach((o, i) => { const k = popS(t, o.t0, .4); op(o.e, o.t0 > t ? 0 : (t > sel && i ? .35 : 1));
      const s = i === 0 && t > sel ? 1 + .06 * eb(pr(t, sel, sel + .35)) : 1;
      tf(o.e, `scale(${k * s}) rotate(${(1 - k) * (i % 2 ? 8 : -8)}deg)`);
      o.e.style.borderColor = i === 0 && t > sel ? '#3DFF8B' : 'transparent';
      const c = popS(t, sel, .35); op(o.ck, i === 0 && t > sel ? 1 : 0); tf(o.ck, `scale(${c})`); });
    return g; };
}, cues: T0 => [1, 2, 3, 5].map(i => ({ t: W('p6', i) - .05, type: 'pop', g: .8 })).concat([{ t: PE('p6') - .25, type: 'ding' }]) });

// p7 — поиск + досмотр
S('p7', { day: 1, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st);
  const A = $('div', 'layer light'); sc.appendChild(A); statusBar(A, true);
  const sb = $('div', 'search', `${svg('search', 30, '#8a8b91')}<span class="q"></span>`); A.appendChild(sb);
  const grid = $('div', 'grid2'); A.appendChild(grid);
  const cells = [1, 2, 3, 4].map(i => { const c = $('div', 'cell', `${thumb('mc', 10 + i)}<div class="views">▶ ${[184, 92, 311, 57][i - 1]}K</div>`); grid.appendChild(c); return c; });
  const B = $('div', 'layer'); sc.appendChild(B); const F = feed(B, { seed: 11 });
  const toast = $('div', 'toast', `${svg('check', 30, '#3DFF8B')} Досмотрено до конца`, { top: '420px' }); B.appendChild(toast);
  const sw = W('p7', 7) - T0 - .1;
  const q = A.querySelector('.q');
  return t => { typeInto(q, 'майнкрафт постройки', t, .15, 22);
    cells.forEach((c, i) => { const k = popS(t, 1.1 + i * .08, .35); op(c, k > 0 ? 1 : 0); tf(c, `scale(${.7 + .3 * k})`); });
    const s = eio(pr(t, sw, sw + .3)); tf(A, `translateX(${-s * 100}%)`); tf(B, `translateX(${(1 - s) * 100}%)`);
    const fill = eio(pr(t, sw + .2, PE('p7') - T0 - .05)); F.pb.style.width = fill * 100 + '%';
    const tk = popS(t, PE('p7') - T0 - .05, .35); op(toast, fill >= 1 ? 1 : 0); tf(toast, `translateX(-50%) scale(${tk})`);
    return ph; };
}, cues: T0 => { const a = []; for (let i = 0; i < 19; i++) a.push({ t: T0 + .15 + i / 22, type: 'type', g: .8 }); a.push({ t: W('p7', 7) - .1, type: 'whoosh', g: .7 }, { t: PE('p7') - .05, type: 'ding', g: .8 }); return a; } });

// p8 — лайк + сохранение
S('p8', { day: 1, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st); const F = feed(sc, { seed: 21 });
  const toast = $('div', 'toast', `${svg('save', 28, '#FFE14A')} Добавлено в Избранное`, { top: '420px' }); sc.appendChild(toast);
  const th = W('p8', 1) - T0 + .05, ts = W('p8', 3) - T0 + .05;
  const hp = iconPt(F.heart, sc), sp = iconPt(F.save, sc);
  const fg = new Finger(sc, [{ t: th, ...hp }, { t: ts, ...sp }]);
  const b1 = new Burst(sc, hp.x, hp.y, th, ['#FE2C55', '#ff7a9a', '#FFE14A'], 14, 3, 90, 14);
  const b2 = new Burst(sc, sp.x, sp.y, ts, ['#FFE14A', '#fff3a0', '#ffffff'], 14, 4, 90, 14);
  return t => { F.pb.style.width = (pr(t, 0, 4) * 60) + '%';
    const hk = popS(t, th, .45); setIcon(F.heart, 'heart', t >= th ? '#FE2C55' : '#fff', t >= th ? .4 + .6 * hk : 1);
    F.heart.querySelector('span').textContent = t >= th ? '12,4K' : '12,4K';
    const sk = popS(t, ts, .45); setIcon(F.save, 'save', t >= ts ? '#FFE14A' : '#fff', t >= ts ? .4 + .6 * sk : 1);
    F.save.querySelector('span').textContent = t >= ts ? '2105' : '2104';
    op(toast, t >= ts + .1 ? 1 : 0); tf(toast, `translateX(-50%) scale(${popS(t, ts + .1, .35)})`);
    fg.update(t); b1.update(t); b2.update(t); return ph; };
}, cues: T0 => [{ t: W('p8', 1) + .05, type: 'tap' }, { t: W('p8', 1) + .05, type: 'pop' }, { t: W('p8', 3) + .05, type: 'tap' }, { t: W('p8', 3) + .05, type: 'pop' }] });

// p9 — комментарий по делу
const C1 = 'Крутая крыша! Из каких блоков? 🔥';
S('p9', { day: 1, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st); feed(sc, { seed: 21 });
  const dim = $('div', 'layer', '', { background: 'rgba(0,0,0,.45)' }); sc.appendChild(dim);
  const sh = $('div', 'sheet', `<h4>318 комментариев</h4>
    <div class="cm new"><div class="ca" style="background:#d9f7ff">🙂</div><div><div class="cn">Вы · сейчас</div><div class="ct">${C1}</div></div></div>
    <div class="cm"><div class="ca">🦊</div><div><div class="cn">fox_builds</div><div class="ct">Повторил, получилось 😍</div></div></div>
    <div class="cm"><div class="ca">🐻</div><div><div class="cn">misha.craft</div><div class="ct">Сколько заняло времени?</div></div></div>
    <div class="inp"><div class="box"></div><div class="send">${svg('send', 30)}</div></div>`, { height: '640px', paddingBottom: '40px' });
  sc.appendChild(sh);
  const nw = sh.querySelector('.new'), box = sh.querySelector('.box');
  const stc = sticker(st, '✅ ПО ДЕЛУ', 'green', 815, 300, 6);
  const tsend = .3 + C1.length / 26 + .15;
  const sendP = centerOf(sh.querySelector('.send'), sc);
  const fg = new Finger(sc, [{ t: tsend, ...sendP }]);
  return t => { const k = eo(pr(t, 0, .3)); tf(sh, `translateY(${(1 - k) * 100}%)`); op(dim, k);
    const sent = t >= tsend; typeInto(box, sent ? '' : C1, t, .3, 26, !sent); if (sent) box.innerHTML = '<span style="color:#8a8b91">Добавить комментарий…</span>';
    nw.style.display = sent ? 'flex' : 'none'; nw.style.background = sent ? `rgba(61,255,139,${.25 * (1 - pr(t, tsend + .4, tsend + 1.2))})` : ''; nw.style.borderRadius = '14px';
    tf(nw, `scale(${sent ? popS(t, tsend, .35) : 0})`);
    stickerUpd(stc, t, W('p9', 2) - T0); fg.update(t); return ph; };
}, cues: T0 => { const a = []; for (let i = 0; i < C1.length; i += 2) a.push({ t: T0 + .3 + i / 26, type: 'type', g: .8 }); a.push({ t: T0 + .3 + C1.length / 26 + .15, type: 'pop' }); return a; } });

// p10 — подписки на авторов
S('p10', { day: 1, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st); sc.classList.add('light'); statusBar(sc, true);
  const L = $('div', 'layer'); sc.appendChild(L);
  L.appendChild($('div', 'topbar', 'Авторы по теме ⛏️'));
  const list = $('div', 'abs', '', { top: '150px', left: 0, right: 0 }); L.appendChild(list);
  const A = [['🧱', '@blockmaster', '1,2M', '#ffe8c2'], ['🏰', '@castle.ideas', '540K', '#dfe9ff'], ['⚙️', '@redstone_pro', '310K', '#e9e9e9'], ['🌲', '@survival.daily', '95K', '#dff7e1'], ['🗺️', '@map.builder', '48K', '#fde2ea']];
  const btns = A.map(([e, n, f, c]) => { const r = $('div', 'arow', `<div class="aa" style="background:${c}">${e}</div><div class="an"><b>${n}</b><span>${f} подписчиков</span></div><div class="fbtn">Подписаться</div>`); list.appendChild(r); return r.querySelector('.fbtn'); });
  navBar(sc);
  const t0 = W('p10', 1) - T0;
  const taps = [0, 1, 2].map(i => ({ t: t0 + .1 + i * .55, ...centerOf(btns[i], sc) }));
  const fg = new Finger(sc, taps);
  return t => { btns.forEach((b, i) => { const on = i < 3 && t >= taps[i].t; b.className = 'fbtn' + (on ? ' done' : ''); b.textContent = on ? '✓ Вы подписаны' : 'Подписаться';
      tf(b, `scale(${on ? .9 + .1 * eb(pr(t, taps[i].t, taps[i].t + .3)) : 1})`); });
    fg.update(t); return ph; };
}, cues: T0 => [0, 1, 2].flatMap(i => [{ t: W('p10', 1) + .1 + i * .55, type: 'tap' }, { t: W('p10', 1) + .1 + i * .55, type: 'pop', g: .6 }]) });

// p11 — ДЕНЬ 2 + лента
S('p11', { day: 2, flash: 1, build(st, T0) {
  const u = daySlam(st, 2, '#FF5C8A'); const tc = W('p11', 1) - T0 + .15; const tsw = W('p11', 2) - T0 - .1;
  const wrap = $('div', 'layer'); st.appendChild(wrap);
  const { ph, sc } = phone(wrap);
  const strip = $('div', 'layer'); sc.appendChild(strip);
  const kinds = [7, 8, 9, 10];
  const pages = kinds.map((s, i) => { const p = $('div', 'layer', '', { top: i * 100 + '%', bottom: 'auto', height: '100%' }); strip.appendChild(p);
    feed(p, { seed: s, user: ['@blockmaster', '@castle.ideas', '@redstone_pro', '@survival.daily'][i], avatar: ['🧱', '🏰', '⚙️', '🌲'][i],
      cap: ['Ферма за 5 минут 🌾 #minecraft', 'Замок в горах 🏰 #постройки', 'Механизм двери ⚙️ #redstone', 'Выживание: день 100 🌲'][i] }); return p; });
  return t => { const g = u(t, tc); const out = eio(pr(t, tsw, tsw + .35));
    tf(g, `scale(${1 + out * .6})`); op(g, 1 - out);
    op(wrap, out); tf(ph, `translateY(${(1 - out) * 300}px) scale(${.9 + .1 * out})`);
    const lt = t - tsw - .5; const step = Math.max(0, lt) / .85; const n = Math.floor(step); const f = step - n;
    const pos = Math.min(3, n + eio(clamp((f - .55) / .45)));
    tf(strip, `translateY(${-pos * 100}%)`); return null; };
}, cues: T0 => { const a = [{ t: T0 + .05, type: 'thud' }, { t: W('p11', 1) + .15, type: 'pop' }, { t: W('p11', 2) - .1, type: 'whoosh' }];
  for (let k = 1; k <= 3; k++) { const tt = W('p11', 2) - .1 + .5 + (k - 1) * .85 + .85 * .55; if (tt < PE('p11')) a.push({ t: tt + .1, type: 'whoosh', g: .45 }); } return a; } });

// p12 — общение с автором
const C2 = 'Как собрал механизм? Очень понятно объяснил 👍', R2 = 'Спасибо! Скоро выложу туториал 🙌';
S('p12', { day: 2, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st); feed(sc, { seed: 9, user: '@redstone_pro', avatar: '⚙️', cap: 'Механизм двери ⚙️ #redstone' });
  const dim = $('div', 'layer', '', { background: 'rgba(0,0,0,.45)' }); sc.appendChild(dim);
  const sh = $('div', 'sheet', `<h4>96 комментариев</h4>
    <div class="cm mine"><div class="ca" style="background:#d9f7ff">🙂</div><div><div class="cn">Вы · сейчас</div><div class="ct"></div></div></div>
    <div class="cm rep" style="margin-left:66px"><div class="ca" style="background:#e9e9e9">⚙️</div><div><div class="cn">redstone_pro<span class="badge">Автор</span></div><div class="ct">${R2}</div></div></div>
    <div class="cm"><div class="ca">🐼</div><div><div class="cn">panda_mine</div><div class="ct">А на бедроке работает?</div></div></div>`, { height: '600px' });
  sc.appendChild(sh);
  const mine = sh.querySelector('.mine .ct'), rep = sh.querySelector('.rep');
  const tr = W('p12', 5) - T0;
  const stc = sticker(st, '🤝 ДИАЛОГ', 'cyan', 260, 300, -6);
  return t => { const k = eo(pr(t, 0, .3)); tf(sh, `translateY(${(1 - k) * 100}%)`); op(dim, k);
    typeInto(mine, C2, t, .25, 30, t < tr);
    rep.style.display = t >= tr ? 'flex' : 'none'; tf(rep, `scale(${popS(t, tr, .4)})`); rep.style.transformOrigin = '0 0';
    stickerUpd(stc, t, tr + .1); return ph; };
}, cues: T0 => { const a = []; for (let i = 0; i < C2.length; i += 2) a.push({ t: T0 + .25 + i / 30, type: 'type', g: .7 }); a.push({ t: W('p12', 5), type: 'ding', g: .8 }); return a; } });

// p13 — большие кнопки лайк/сохранить
S('p13', { day: 2, build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const mk = (ic, x, lab) => { const b = $('div', 'abs center', svg(ic, 210), { left: x + 'px', top: '420px', width: '360px', height: '360px', borderRadius: '50%',
    background: 'rgba(255,255,255,.08)', border: '3px solid rgba(255,255,255,.18)', flexDirection: 'column' });
    const l = $('div', 'abs', lab, { left: x + 'px', width: '360px', top: '820px', textAlign: 'center', fontWeight: 900, fontSize: '56px' });
    g.append(b, l); return { b, l }; };
  const H = mk('heart', 120, 'ЛАЙК'), Sv = mk('save', 600, 'СОХРАНИТЬ');
  const th = W('p13', 1) - T0, ts = W('p13', 3) - T0;
  const b1 = new Burst(g, 300, 600, th, ['#FE2C55', '#ff8aa6', '#FFE14A'], 18, 5, 260, 30);
  const b2 = new Burst(g, 780, 600, ts, ['#FFE14A', '#fff3a0', '#3DFF8B'], 18, 6, 260, 30);
  return t => { [[H, th, 'heart', '#FE2C55'], [Sv, ts, 'save', '#FFE14A']].forEach(([o, t0, ic, c], i) => {
      const k = popS(t, i * .12, .4); const on = t >= t0; const pk = on ? 1 + .25 * Math.sin(pr(t, t0, t0 + .3) * Math.PI) : 1;
      tf(o.b, `scale(${k * pk})`); op(o.b, k > 0 ? 1 : 0); op(o.l, k > 0 ? 1 : 0);
      o.b.innerHTML = svg(ic, 210, on ? c : '#fff'); o.b.style.boxShadow = on ? `0 0 90px ${c}88` : 'none'; o.l.style.color = on ? c : '#fff'; });
    b1.update(t); b2.update(t); return g; };
}, cues: T0 => [{ t: W('p13', 1), type: 'pop' }, { t: W('p13', 3), type: 'pop' }] });

// p14 — репост
S('p14', { day: 2, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st); feed(sc, { seed: 8, user: '@castle.ideas', avatar: '🏰', cap: 'Замок в горах 🏰 #постройки' });
  const dim = $('div', 'layer', '', { background: 'rgba(0,0,0,.45)' }); sc.appendChild(dim);
  const ppl = ['🦊', '🐻', '🐼', '🐯', '🐸'].map((e, i) => `<div style="text-align:center"><div class="ca" style="width:80px;height:80px;border-radius:50%;background:#f1f1f2;display:flex;align-items:center;justify-content:center;font-size:42px">${e}</div><div style="font-size:15px;margin-top:6px;color:#555">${['Аня', 'Миша', 'Даня', 'Лиза', 'Кирилл'][i]}</div></div>`).join('');
  const act = [['repost', 'Репост', '#FFE14A', '#14102a'], ['msg', 'Сообщение', '#25F4EE', '#06222a'], ['link', 'Ссылка', '#e9e9ee', '#161823'], ['dots', 'Ещё', '#e9e9ee', '#161823']]
    .map(([ic, l, bg, fg], i) => `<div style="text-align:center"><div class="ac${i}" style="width:80px;height:80px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center">${svg(ic, 44, fg)}</div><div style="font-size:16px;margin-top:6px;font-weight:600">${l}</div></div>`).join('');
  const sh = $('div', 'sheet', `<h4>Поделиться</h4><div style="display:flex;justify-content:space-between;margin-bottom:26px">${ppl}</div>
    <div style="height:1px;background:#eee;margin-bottom:22px"></div><div style="display:flex;justify-content:space-around">${act}</div>`, { height: '420px' });
  sc.appendChild(sh);
  const toast = $('div', 'toast', `${svg('repost', 30, '#FFE14A')} Вы сделали репост`, { top: '360px' }); sc.appendChild(toast);
  const tt = W('p14', 2) - T0 + .05;
  const rp = centerOf(sh.querySelector('.ac0'), sc);
  const fg = new Finger(sc, [{ t: tt, ...rp }]);
  const stc = sticker(st, '💛 ТОЛЬКО ТО, ЧТО НРАВИТСЯ', '', 540, 270, -4); stc.style.fontSize = '50px';
  const b = new Burst(sc, rp.x, rp.y, tt, ['#FFE14A', '#fff'], 12, 8, 90, 12);
  return t => { const k = eo(pr(t, 0, .3)); tf(sh, `translateY(${(1 - k) * 100}%)`); op(dim, k);
    const done = t >= tt + .15; tf(sh, `translateY(${(1 - k) * 100 + eio(pr(t, tt + .2, tt + .5)) * 100}%)`); op(dim, k * (1 - pr(t, tt + .2, tt + .5)));
    op(toast, done ? 1 : 0); tf(toast, `translateX(-50%) scale(${popS(t, tt + .15, .35)})`);
    stickerUpd(stc, t, W('p14', 5) - T0); fg.update(t); b.update(t); return ph; };
}, cues: T0 => [{ t: W('p14', 2) + .05, type: 'tap' }, { t: W('p14', 2) + .2, type: 'success', g: .7 }] });

// p15 — ДЕНЬ 3 + ровная активность
S('p15', { day: 3, flash: 1, build(st, T0) {
  const u = daySlam(st, 3, '#3DFF8B'); const tc = W('p15', 1) - T0 + .15; const tsw = W('p15', 2) - T0 - .05;
  const card = $('div', 'glass', '', { left: '140px', top: '300px', width: '800px', height: '760px', padding: '50px' }); st.appendChild(card);
  card.innerHTML = `<div style="font-weight:900;font-size:50px">📈 Активность</div><div style="font-weight:600;font-size:30px;opacity:.7;margin-top:8px">ровно и каждый день</div>
    <div class="bars" style="position:absolute;left:60px;right:60px;bottom:150px;height:380px;display:flex;align-items:flex-end;gap:22px"></div>
    <div class="abs" style="left:0;right:0;bottom:50px;text-align:center;font-weight:900;font-size:44px;color:#3DFF8B">✓ ЕСТЕСТВЕННО</div>`;
  const bars = card.querySelector('.bars'); const H = [.5, .62, .55, .7, .6, .74, .66, .72];
  const bs = H.map(h => { const b = $('div', '', '', { flex: 1, height: h * 100 + '%', borderRadius: '16px 16px 6px 6px', background: 'linear-gradient(#3DFF8B,#25F4EE)', transformOrigin: '50% 100%' }); bars.appendChild(b); return b; });
  return t => { const g = u(t, tc); const out = eio(pr(t, tsw, tsw + .35)); tf(g, `scale(${1 + out * .6})`); op(g, 1 - out);
    op(card, out); tf(card, `translateY(${(1 - out) * 200}px)`);
    bs.forEach((b, i) => tf(b, `scaleY(${eb(pr(t, tsw + .2 + i * .08, tsw + .6 + i * .08)) * (1 + .03 * Math.sin(t * 4 + i))})`)); return null; };
}, cues: T0 => [{ t: T0 + .05, type: 'thud' }, { t: W('p15', 1) + .15, type: 'pop' }, { t: W('p15', 2) - .05, type: 'whoosh' }] });

// p16 — смотри тему, общайся
S('p16', { day: 3, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st); const F = feed(sc, { seed: 31, user: '@survival.daily', avatar: '🌲', cap: 'Выживание: день 100 🌲 #minecraft' });
  const th = .55; const hp = iconPt(F.heart, sc), cp = iconPt(F.cmt, sc);
  const tc = W('p16', 6) - T0;
  const fg = new Finger(sc, [{ t: th, ...hp }, { t: tc, ...cp }]);
  const bubble = $('div', 'toast', `💬 «Лучшая серия! Жду продолжения»`, { top: '440px', fontSize: '20px' }); sc.appendChild(bubble);
  const b = new Burst(sc, hp.x, hp.y, th, ['#FE2C55', '#ff8aa6'], 12, 11, 80, 12);
  return t => { F.pb.style.width = pr(t, 0, 3) * 80 + '%';
    setIcon(F.heart, 'heart', t >= th ? '#FE2C55' : '#fff', t >= th ? .4 + .6 * popS(t, th, .4) : 1);
    F.cmt.querySelector('span').textContent = t >= tc + .2 ? '210' : '209';
    op(bubble, t >= tc + .2 ? 1 : 0); tf(bubble, `translateX(-50%) scale(${popS(t, tc + .2, .35)})`);
    tf(F.vid, `scale(${1.05 + t * .02})`);
    fg.update(t); b.update(t); return ph; };
}, cues: T0 => [{ t: T0 + .55, type: 'tap' }, { t: T0 + .55, type: 'pop', g: .7 }, { t: W('p16', 6), type: 'tap' }, { t: W('p16', 6) + .2, type: 'pop', g: .7 }] });

// p17 — съёмка и монтаж
S('p17', { day: 3, phone: 1, build(st, T0) {
  const { ph, sc } = phone(st);
  const A = $('div', 'layer'); sc.appendChild(A);
  A.innerHTML = `<div class="layer" style="filter:saturate(1.1)">${voxel(41)}</div>
    <div class="layer" style="background-image:linear-gradient(rgba(255,255,255,.18) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,.18) 2px,transparent 2px);background-size:172px 318px;background-position:-2px -2px"></div>
    <div class="abs center" style="top:76px;left:0;right:0;font-weight:700;font-size:21px;gap:8px">${svg('music', 24)} Добавить звук</div>
    <div class="abs" style="right:22px;top:150px;display:flex;flex-direction:column;gap:30px;align-items:center;font-size:15px;font-weight:600">
      <div>${svg('cam', 40)}</div><div>${svg('spark', 40)}</div><div>${svg('text', 40)}</div></div>
    <div class="tm abs" style="left:0;right:0;top:120px;text-align:center;font-weight:800;font-size:26px"></div>
    <div class="abs center" style="left:50%;bottom:120px;width:130px;height:130px;margin-left:-65px;border-radius:50%;border:8px solid rgba(255,255,255,.85)">
      <div class="rec" style="width:96px;height:96px;border-radius:50%;background:#FE2C55"></div></div>`;
  statusBar(A);
  const rec = A.querySelector('.rec'), tm = A.querySelector('.tm');
  const B = $('div', 'layer', '', { background: '#111' }); sc.appendChild(B); statusBar(B);
  B.innerHTML += `<div class="abs" style="left:30px;right:30px;top:100px;height:420px;border-radius:18px;overflow:hidden">${voxel(41)}</div>
    <div class="abs" style="left:0;right:0;top:545px;text-align:center;font-weight:800;font-size:22px;opacity:.8">00:08 / 00:24</div>
    <div class="clips abs" style="left:20px;right:20px;top:600px;height:90px;display:flex;gap:6px"></div>
    <div class="abs" style="left:20px;right:20px;top:700px;height:40px;border-radius:8px;background:repeating-linear-gradient(90deg,#3DFF8B 0 4px,transparent 4px 9px);opacity:.75"></div>
    <div class="ph abs" style="top:590px;width:4px;height:160px;background:#fff;border-radius:2px"></div>
    <div class="abs" style="left:0;right:0;bottom:60px;display:flex;justify-content:space-around;font-size:16px;font-weight:600;text-align:center">
      <div>${svg('scissors', 40)}<div>Обрезать</div></div><div>${svg('text', 40)}<div>Текст</div></div><div>${svg('music', 40)}<div>Звук</div></div><div>${svg('spark', 40)}<div>Эффекты</div></div></div>`;
  const clips = B.querySelector('.clips'), phd = B.querySelector('.ph');
  const cl = ['#5dbb3b', '#5fb4ff', '#c79a5b', '#9b2f2f', '#7a3cff'].map(c => { const e = $('div', '', '', { flex: 1, borderRadius: '10px', background: `linear-gradient(135deg,${c},#222)`, border: '3px solid #FFE14A55' }); clips.appendChild(e); return e; });
  const trec = W('p17', 1) - T0, tsw = W('p17', 3) - T0;
  const stc = sticker(st, '✨ КАЧЕСТВО', '', 540, 260, -5);
  return t => { const on = t >= trec; rec.style.borderRadius = on ? '18px' : '50%'; tf(rec, `scale(${on ? .55 : 1})`);
    const sec = on ? Math.floor((t - trec) * 6) : 0; tm.textContent = on ? `● 00:${String(Math.min(sec, 59)).padStart(2, '0')}` : ''; tm.style.color = '#FE2C55';
    const s = eio(pr(t, tsw, tsw + .3)); tf(A, `translateX(${-s * 100}%)`); tf(B, `translateX(${(1 - s) * 100}%)`);
    cl.forEach((c, i) => { const k = popS(t, tsw + .2 + i * .1, .35); tf(c, `scaleY(${k})`); });
    phd.style.left = (20 + 476 * pr(t, tsw + .5, PE('p17') - T0 + .2)) + 'px';
    stickerUpd(stc, t, W('p17', 4) - T0); return ph; };
}, cues: T0 => [{ t: W('p17', 1), type: 'shutter' }, { t: W('p17', 3), type: 'whoosh', g: .7 }, { t: W('p17', 4), type: 'pop' }] });

// p18 — публикация
S('p18', { day: 3, build(st, T0) {
  const wrap = $('div', 'layer'); st.appendChild(wrap);
  const { ph, sc } = phone(wrap); sc.classList.add('light'); statusBar(sc, true);
  sc.appendChild($('div', 'topbar', 'Публикация'));
  sc.appendChild($('div', 'abs', `<div style="display:flex;gap:18px"><div style="width:150px;height:200px;border-radius:12px;overflow:hidden;flex:none;position:relative">${voxel(41)}</div>
    <div style="font-size:21px;line-height:1.35;color:#161823;font-weight:500">Мой первый дом в выживании 🏠 Делюсь, как построить за вечер! #minecraft #постройки</div></div>`, { left: '26px', right: '26px', top: '150px' }));
  sc.appendChild($('div', 'abs', `<div style="padding:18px 0;border-bottom:1px solid #eee">📍 Добавить место</div><div style="padding:18px 0;border-bottom:1px solid #eee">👥 Кто может смотреть: все</div><div style="padding:18px 0">💬 Комментарии: вкл.</div>`, { left: '26px', right: '26px', top: '400px', fontSize: '21px', fontWeight: 600 }));
  const prog = $('div', 'abs', '<i style="display:block;height:100%;background:#FE2C55;border-radius:8px;width:0"></i>', { left: '26px', right: '26px', top: '720px', height: '14px', borderRadius: '8px', background: '#eee' });
  const plab = $('div', 'abs', '', { left: 0, right: 0, top: '745px', textAlign: 'center', fontWeight: 800, fontSize: '22px', color: '#161823' });
  const pbtn = $('div', 'abs center', 'Опубликовать', { left: '26px', right: '26px', bottom: '60px', height: '76px', borderRadius: '12px', background: '#FE2C55', color: '#fff', fontWeight: 800, fontSize: '26px' });
  sc.append(prog, plab, pbtn);
  const tp = .45; const bp = centerOf(pbtn, sc); const fg = new Finger(sc, [{ t: tp, ...bp }]);
  const tb = W('p18', 3) - T0 - .05;
  const big = $('div', 'abs center', '<div style="background:#3DFF8B;color:#0b2a17;padding:30px 50px;border-radius:36px;font-weight:900;font-size:96px;line-height:1;text-align:center;letter-spacing:-2px;box-shadow:0 0 120px rgba(61,255,139,.6)">ПОРА<br>ПУБЛИКОВАТЬ! 🚀</div>', { left: 0, right: 0, top: '420px' });
  const cf = new Confetti(st, tb + .05);
  st.appendChild(big);
  return t => { const p = eio(pr(t, tp + .1, tb - .05)); prog.firstChild.style.width = p * 100 + '%'; plab.textContent = t > tp ? (p >= 1 ? '✓ Опубликовано' : `Загрузка… ${Math.round(p * 100)}%`) : '';
    plab.style.color = p >= 1 ? '#16a34a' : '#161823'; fg.update(t);
    const k = popS(t, tb, .5); op(big, t >= tb ? 1 : 0); tf(big, `scale(${k}) rotate(${(1 - k) * -10 + Math.sin(t * 4) * 1.5}deg)`);
    tf(ph, `scale(${1 - .08 * eo(pr(t, tb, tb + .4))})`); op(wrap, 1 - .6 * pr(t, tb, tb + .4)); cf.update(t); return null; };
}, cues: T0 => [{ t: T0 + .45, type: 'tap' }, { t: T0 + .55, type: 'riser' }, { t: W('p18', 3) - .05, type: 'success' }, { t: W('p18', 3) - .05, type: 'pop' }] });

// p19 + p20 — чего НЕ делать
S('p19', { build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const hd = sticker(g, '⚠️ ЗАПОМНИ', 'red', 540, 270, -3);
  const rows = [['❤️ ×100 подряд', W('p19', 5)], ['📋 Одинаковые комментарии', W('p20', 1)], ['➕ Подписки на всех подряд', W('p20', 4)]].map(([txt, ta], i) => {
    const r = $('div', 'glass', `<div style="display:flex;align-items:center;gap:30px;height:100%;padding:0 40px"><div style="width:90px;height:90px;border-radius:50%;background:#FF3D63;flex:none;display:flex;align-items:center;justify-content:center">${svg('x', 62)}</div>
      <div class="tx" style="font-weight:800;font-size:46px;position:relative;white-space:nowrap">${txt}<div class="ln" style="position:absolute;left:0;top:50%;height:7px;margin-top:-3px;background:#FF3D63;border-radius:4px;width:0"></div></div></div>`,
      { left: '80px', width: '920px', top: (420 + i * 200) + 'px', height: '170px', borderRadius: '34px' });
    g.appendChild(r); return { r, t0: ta - T0 - .05, ln: r.querySelector('.ln') }; });
  const stamp = $('div', 'abs center', '<div style="border:14px solid #FF3D63;color:#FF3D63;padding:16px 46px;border-radius:30px;font-weight:900;font-size:130px;letter-spacing:-2px;background:rgba(20,10,30,.85)">НЕ СПАМИТЬ</div>', { left: 0, right: 0, top: '560px' });
  g.appendChild(stamp);
  const ts = PE('p20') - T0 - .35;
  return t => { stickerUpd(hd, t, .05);
    rows.forEach((o, i) => { const k = eo(pr(t, o.t0, o.t0 + .3)); op(o.r, k); tf(o.r, `translateX(${(1 - k) * (i % 2 ? 300 : -300)}px)`);
      o.ln.style.width = eio(pr(t, o.t0 + .35, o.t0 + .7)) * 100 + '%'; op(o.r.querySelector('.tx'), t > o.t0 + .7 ? .75 : 1); });
    const s = pr(t, ts, ts + .2); op(stamp, t >= ts ? 1 : 0); tf(stamp, `scale(${lerp(2.4, 1, eo(s))}) rotate(-8deg)`);
    const sh = t > ts + .2 && t < ts + .5 ? Math.sin((t - ts) * 80) * 10 * (1 - (t - ts - .2) / .3) : 0; tf(g, `translate(${sh}px,${sh * .5}px)`);
    return g; };
}, cues: T0 => [{ t: T0 + .05, type: 'pop' }, { t: W('p19', 5) - .05, type: 'pop', g: .7 }, { t: W('p20', 1) - .05, type: 'pop', g: .7 }, { t: W('p20', 4) - .05, type: 'pop', g: .7 }, { t: PE('p20') - .35, type: 'thud' }] });

// p21 — итог-чеклист
S('p21', { build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const hd = sticker(g, '🏆 ГЛАВНОЕ', 'green', 540, 270, 3);
  const items = [['3 ДНЯ АКТИВНОСТИ', '#25F4EE', W('p21', 0) + .2], ['НЕ СПАМИТЬ', '#FF5C8A', W('p21', 2)], ['КАЧЕСТВЕННЫЙ КОНТЕНТ', '#FFE14A', W('p21', 5)]];
  const rows = items.map(([txt, c, ta], i) => { const r = $('div', 'glass', `<div style="display:flex;align-items:center;gap:30px;height:100%;padding:0 40px"><div class="cb" style="width:96px;height:96px;border-radius:24px;border:6px solid ${c};flex:none;display:flex;align-items:center;justify-content:center"></div>
      <div style="font-weight:900;font-size:${txt.length > 14 ? 50 : 58}px;letter-spacing:-1px;white-space:nowrap">${txt}</div></div>`,
      { left: '80px', width: '920px', top: (420 + i * 210) + 'px', height: '180px', borderRadius: '34px' }); g.appendChild(r);
    return { r, c, t0: ta - T0, cb: r.querySelector('.cb') }; });
  return t => { stickerUpd(hd, t, .05);
    rows.forEach((o, i) => { const k = eo(pr(t, o.t0 - .25, o.t0 + .05)); op(o.r, k); tf(o.r, `translateY(${(1 - k) * 80}px)`);
      const on = t >= o.t0 + .1; o.cb.style.background = on ? o.c : 'transparent'; o.cb.innerHTML = on ? svg('check', 70, '#14102a') : '';
      tf(o.cb, `scale(${on ? popS(t, o.t0 + .1, .35) : 1})`); o.r.style.borderColor = on ? o.c + 'aa' : 'rgba(255,255,255,.14)'; });
    return g; };
}, cues: T0 => [{ t: T0 + .05, type: 'pop', g: .7 }, { t: W('p21', 0) + .3, type: 'ding', g: .7 }, { t: W('p21', 2) + .1, type: 'ding', g: .7 }, { t: W('p21', 5) + .1, type: 'ding', g: .7 }] });

// p22 — сохрани видео
S('p22', { build(st, T0) {
  const g = $('div', 'layer'); st.appendChild(g);
  const btn = $('div', 'abs center', svg('save', 230), { left: '340px', top: '380px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(255,255,255,.08)', border: '4px solid rgba(255,255,255,.2)' });
  g.appendChild(btn);
  const t1 = $('div', 'big', 'СОХРАНИ', { top: '830px', fontSize: '150px', color: '#FFE14A' });
  const t2 = $('div', 'big', 'ЭТО ВИДЕО 👉', { top: '980px', fontSize: '88px' });
  g.append(t1, t2);
  const tt = W('p22', 0) - T0 + .35;
  const fg = new Finger(g, [{ t: tt, x: 560, y: 600 }]);
  const b = new Burst(g, 540, 580, tt, ['#FFE14A', '#fff3a0', '#ffffff', '#3DFF8B'], 22, 12, 320, 34);
  const arrow = $('div', 'abs', '➜', { right: '30px', top: '560px', fontSize: '110px', color: '#FFE14A', fontWeight: 900 }); g.appendChild(arrow);
  return t => { const k = popS(t, 0, .45); const on = t >= tt; const pulse = 1 + .05 * Math.sin(t * 6);
    tf(btn, `scale(${k * (on ? 1 + .22 * Math.sin(pr(t, tt, tt + .35) * Math.PI) : pulse)})`);
    btn.innerHTML = svg('save', 230, on ? '#FFE14A' : '#fff'); btn.style.boxShadow = on ? '0 0 140px rgba(255,225,74,.7)' : 'none'; btn.style.borderColor = on ? '#FFE14A' : 'rgba(255,255,255,.2)';
    const a = popS(t, .15, .4), c = popS(t, .3, .4); tf(t1, `scale(${a})`); tf(t2, `scale(${c})`); op(t1, a > 0 ? 1 : 0); op(t2, c > 0 ? 1 : 0);
    op(arrow, t > tt + .4 ? 1 : 0); tf(arrow, `translateX(${Math.sin(t * 7) * 16}px)`);
    fg.update(t); b.update(t); return g; };
}, cues: T0 => [{ t: W('p22', 0) + .35, type: 'tap' }, { t: W('p22', 0) + .35, type: 'success' }] });

/* тайминг сцен */
scenes.forEach((s, i) => { s.start = i === 0 ? 0 : P[s.from].start - .14; });
scenes.forEach((s, i) => { s.end = i < scenes.length - 1 ? scenes[i + 1].start : DUR + 1; });

/* ---------------- субтитры ---------------- */
const chunks = [];
TL.phrases.forEach(p => {
  let cur = [];
  const flush = () => { if (cur.length) chunks.push({ words: cur, pid: p.id }); cur = []; };
  p.words.forEach((w, i) => { cur.push(w); const len = cur.map(x => x.w).join(' ').length;
    const nxt = p.words[i + 1]; const punct = /[,.!?:—]$/.test(w.w);
    if (punct || cur.length >= 3 || (nxt && len + nxt.w.length + 1 > 20)) flush(); });
  flush();
});
chunks.forEach((c, i) => { c.s = c.words[0].s - .04; const nx = chunks[i + 1];
  const lastE = c.words[c.words.length - 1].e;
  c.e = nx ? Math.min(nx.words[0].s - .04, lastE + .5) : lastE + .8; });
window.getSRT = () => {
  const f = x => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  return chunks.map((c, i) => `${i + 1}\n${f(Math.max(0, c.s))} --> ${f(c.e)}\n${c.words.map(w => w.w).join(' ')}\n`).join('\n');
};
const subs = document.getElementById('subs');
let curChunk = -1, chunkEl = null, wEls = [];
function renderSubs(t) {
  let idx = -1; for (let i = 0; i < chunks.length; i++) if (t >= chunks[i].s && t < chunks[i].e) idx = i;
  if (idx !== curChunk) { subs.innerHTML = ''; curChunk = idx; wEls = [];
    if (idx >= 0) { chunkEl = $('div', 'chunk'); chunks[idx].words.forEach(w => { const e = $('span', 'w' + (w.hl ? ' ' + w.hl : ''), w.w); chunkEl.appendChild(e); wEls.push(e); });
      subs.appendChild(chunkEl);
      let fs = 82; chunkEl.style.fontSize = fs + 'px';
      while (chunkEl.offsetHeight > fs * 1.04 * 2 + 4 && fs > 50) { fs -= 4; chunkEl.style.fontSize = fs + 'px'; } } }
  if (idx < 0) return;
  const c = chunks[idx]; const k = eb(pr(t, c.s, c.s + .16));
  tf(chunkEl, `scale(${.82 + .18 * k})`); op(chunkEl, pr(t, c.s, c.s + .06) * (1 - pr(t, c.e - .06, c.e)));
  c.words.forEach((w, i) => { const act = t >= w.s - .03 && t < (c.words[i + 1] ? c.words[i + 1].s - .03 : c.e);
    const kk = act ? eb(pr(t, w.s - .03, w.s + .12)) : 0;
    tf(wEls[i], `scale(${1 + .09 * kk}) translateY(${-6 * kk}px)`);
    wEls[i].style.opacity = t >= w.s - .03 ? 1 : .7;
    if (!w.hl) wEls[i].style.color = act ? '#ffffff' : '#f2f2f2'; });
}

/* ---------------- фон и HUD ---------------- */
const b1 = document.getElementById('b1'), b2 = document.getElementById('b2');
const TINT = { hook: ['#ff2d6f', '#25F4EE'], d1: ['#19b8ff', '#25F4EE'], d2: ['#ff3d8a', '#a24bff'], d3: ['#3DFF8B', '#19c9ff'], fin: ['#ffb02e', '#ff3d63'] };
function renderBG(t, sec) {
  const [c1, c2] = TINT[sec] || TINT.hook;
  b1.style.background = `radial-gradient(circle, ${c1}55 0%, ${c1}00 62%)`;
  b2.style.background = `radial-gradient(circle, ${c2}44 0%, ${c2}00 62%)`;
  tf(b1, `translate(${-500 + Math.sin(t * .35) * 160}px, ${-420 + Math.cos(t * .27) * 140}px)`);
  tf(b2, `translate(${180 + Math.cos(t * .3) * 160}px, ${820 + Math.sin(t * .22) * 160}px)`);
  document.getElementById('grid').style.backgroundPosition = `0 ${(t * 14) % 54}px`;
}
const hud = document.getElementById('hud');
const pills = [1, 2, 3].map(d => { const e = $('div', 'dp', `ДЕНЬ ${d}`); hud.appendChild(e); return e; });
function renderHUD(t, day) {
  const show = day ? 1 : 0; op(hud, show);
  pills.forEach((p, i) => { p.className = 'dp' + (day === i + 1 ? ' on' : day > i + 1 ? ' done' : ''); });
}

/* ---------------- главный цикл ---------------- */
const stage = document.getElementById('stage');
const flash = document.getElementById('flash');
let curScene = -1, upd = null;
const ENTER = ['zoom', 'slideL', 'up', 'slideR'];
function sectionAt(t) { let s = 'hook'; TL.phrases.forEach(p => { if (t >= p.start - .14) s = p.sec; }); return s; }

window.render = t => {
  let si = scenes.findIndex(s => t >= s.start && t < s.end); if (si < 0) si = scenes.length - 1;
  const sc = scenes[si];
  if (si !== curScene) { stage.innerHTML = ''; const holder = $('div', 'layer'); stage.appendChild(holder); upd = sc.build(holder, sc.start); curScene = si; sc.holder = holder; }
  const L = t - sc.start;
  upd(L);
  // переход (вход сцены)
  const prev = scenes[si - 1];
  const keepPhone = sc.phone && prev && prev.phone;
  const e = eo(pr(L, 0, .3));
  const kind = ENTER[si % ENTER.length];
  const h = sc.holder;
  if (si === 0) { const ph = h.querySelector('.phone'); if (ph) tf(ph, `translateY(${(1 - eb(pr(L, 0, .55))) * 900}px) rotate(${(1 - eo(pr(L, 0, .55))) * 10}deg)`); h.style.opacity = 1; }
  else if (keepPhone) { const scr = h.querySelector('.screen'); if (scr) { scr.style.transform = `translateX(${(1 - e) * 100}%)`; } h.style.opacity = 1; }
  else {
    const m = 1 - e; let s = '';
    if (kind === 'zoom') s = `scale(${1 + m * .25})`; else if (kind === 'slideL') s = `translateX(${m * 260}px)`;
    else if (kind === 'up') s = `translateY(${m * 260}px)`; else s = `translateX(${-m * 260}px)`;
    tf(h, s); h.style.opacity = e; h.style.filter = m > .01 ? `blur(${m * 10}px)` : 'none';
  }
  // «живая» камера: лёгкий наезд и покачивание
  stage.style.transform = `scale(${1 + .015 * Math.sin(t * .8)}) rotate(${Math.sin(t * .6) * .4}deg)`;
  op(flash, sc.flash ? (1 - pr(L, 0, .22)) * .55 : 0);
  const sec = sectionAt(t); renderBG(t, sec); renderHUD(t, sc.day || 0); renderSubs(t);
};
window.getCues = () => { const out = []; scenes.forEach((s, i) => { if (i > 0) out.push({ t: s.start, type: 'whoosh', g: s.flash ? .9 : .6 });
  (s.cues ? s.cues(s.start) : []).forEach(c => out.push(c)); }); return out.sort((a, b) => a.t - b.t); };
window.SCENES = scenes.map(s => ({ from: s.from, start: s.start, end: s.end }));
window.DUR = DUR;
})();
