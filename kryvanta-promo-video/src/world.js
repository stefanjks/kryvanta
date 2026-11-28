// Процедурный воксельный мир для ролика KRYVANTA (собственная графика, без ассетов Mojang).
import * as THREE from 'three';

export function rnd(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- шум ---------------- */
const R0 = rnd(1234); const PERM = [...Array(512)].map(() => R0());
function hash2(x, z) { const h = (x * 374761393 + z * 668265263) >>> 0; return PERM[(h ^ (h >>> 13)) & 511]; }
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t); const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(zf) + (a - b - c + d) * s(xf) * s(zf); }
function fbm(x, z) { let v = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { v += a * vnoise(x * f, z * f); a *= .5; f *= 2; } return v; }

/* ---------------- текстуры ---------------- */
function canvasTex(draw, size = 16) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const hex = (h, k = 0) => { const c = new THREE.Color(h); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
function noisy(base, amp, seed) { return (g, n) => { const r = rnd(seed); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
  g.fillStyle = hex(base, (r() - .5) * amp); g.fillRect(x, y, 1, 1); } }; }
function makeTextures() {
  const T = {};
  T.grassTop = canvasTex(noisy('#5f9e3a', .12, 1));
  T.grassSide = canvasTex((g, n) => { noisy('#7a5534', .1, 2)(g, n); const r = rnd(3);
    for (let x = 0; x < n; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) { g.fillStyle = hex('#5f9e3a', (r() - .5) * .12); g.fillRect(x, y, 1, 1); } } });
  T.dirt = canvasTex(noisy('#7a5534', .1, 4));
  T.stone = canvasTex(noisy('#7d7f83', .1, 5));
  T.sand = canvasTex(noisy('#dccb8e', .07, 6));
  T.cobble = canvasTex((g, n) => { noisy('#77797d', .14, 7)(g, n); const r = rnd(8); g.fillStyle = '#4a4b4f';
    for (let i = 0; i < 26; i++) g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1 + Math.floor(r() * 2), 1); });
  T.brick = canvasTex((g, n) => { noisy('#8e9096', .07, 9)(g, n); g.fillStyle = '#5d5f65';
    for (let y = 0; y < n; y += 4) { g.fillRect(0, y, n, 1); const o = (y / 4) % 2 ? 4 : 0; for (let x = o; x < n; x += 8) g.fillRect(x, y, 1, 4); } });
  T.planks = canvasTex((g, n) => { noisy('#a8804c', .08, 10)(g, n); g.fillStyle = '#6e5130';
    for (let y = 3; y < n; y += 4) g.fillRect(0, y, n, 1); for (let k = 0; k < 4; k++) g.fillRect((k * 7 + 3) % n, k * 4, 1, 3); });
  T.logSide = canvasTex((g, n) => { const r = rnd(11); for (let x = 0; x < n; x++) { const b = (r() - .5) * .14;
    for (let y = 0; y < n; y++) { g.fillStyle = hex('#5b4129', b + (r() - .5) * .06); g.fillRect(x, y, 1, 1); } } });
  T.logTop = canvasTex((g, n) => { noisy('#b08a55', .06, 12)(g, n); g.strokeStyle = '#7d5f38'; g.lineWidth = 1;
    for (let r = 2; r < 8; r += 2) g.strokeRect(8 - r + .5, 8 - r + .5, r * 2 - 1, r * 2 - 1); g.strokeStyle = '#5b4129'; g.strokeRect(.5, .5, 15, 15); });
  T.leaves = canvasTex((g, n) => { const r = rnd(13); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = r(); g.fillStyle = v < .14 ? '#1f4a1a' : hex('#3f7f2c', (r() - .5) * .2); g.fillRect(x, y, 1, 1); } });
  T.glass = canvasTex((g, n) => { g.fillStyle = 'rgba(200,230,255,.28)'; g.fillRect(0, 0, n, n); g.fillStyle = 'rgba(235,248,255,.95)';
    g.fillRect(0, 0, n, 1); g.fillRect(0, n - 1, n, 1); g.fillRect(0, 0, 1, n); g.fillRect(n - 1, 0, 1, n); g.fillRect(3, 3, 1, 3); g.fillRect(4, 3, 2, 1); });
  T.lantern = canvasTex((g, n) => { g.fillStyle = '#ffcf6a'; g.fillRect(0, 0, n, n); g.fillStyle = '#fff3c4'; g.fillRect(4, 4, 8, 8);
    g.fillStyle = '#3a2c1c'; g.fillRect(0, 0, n, 2); g.fillRect(0, n - 2, n, 2); g.fillRect(0, 0, 2, n); g.fillRect(n - 2, 0, 2, n); g.fillRect(7, 0, 2, n); });
  T.gold = canvasTex((g, n) => { noisy('#e0b43c', .08, 14)(g, n); g.fillStyle = '#fff0a8'; g.fillRect(1, 1, n - 3, 1); g.fillRect(1, 1, 1, n - 3);
    g.fillStyle = '#9c7414'; g.fillRect(1, n - 2, n - 2, 1); g.fillRect(n - 2, 1, 1, n - 2); });
  T.roof = canvasTex((g, n) => { noisy('#7b3a2e', .1, 15)(g, n); g.fillStyle = '#4d2219'; for (let y = 3; y < n; y += 4) g.fillRect(0, y, n, 1); });
  T.path = canvasTex(noisy('#9a8a63', .14, 16));
  T.ore = canvasTex((g, n) => { noisy('#7d7f83', .1, 17)(g, n); const r = rnd(18);
    for (let i = 0; i < 6; i++) { const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 12); g.fillStyle = '#4fe3d6'; g.fillRect(x, y, 2, 2); g.fillStyle = '#c6fff9'; g.fillRect(x, y, 1, 1); } });
  T.goldOre = canvasTex((g, n) => { noisy('#7d7f83', .1, 19)(g, n); const r = rnd(20);
    for (let i = 0; i < 6; i++) { const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 12); g.fillStyle = '#f2c94c'; g.fillRect(x, y, 2, 2); g.fillStyle = '#fff2b0'; g.fillRect(x, y, 1, 1); } });
  T.flowerR = canvasTex(noisy('#d8343c', .15, 21)); T.flowerY = canvasTex(noisy('#f3d443', .1, 22));
  return T;
}

/* ---------------- типы блоков ---------------- */
const TYPES = ['grass', 'dirt', 'stone', 'sand', 'cobble', 'brick', 'planks', 'log', 'leaves', 'glass', 'lantern', 'gold', 'roof', 'path', 'ore', 'goldOre', 'flowerR', 'flowerY'];
function materialsFor(T) {
  const L = (map, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ map }, o));
  const M = {};
  const six = (side, top, bottom) => [side, side, top, bottom || top, side, side];
  M.grass = six(L(T.grassSide), L(T.grassTop), L(T.dirt));
  M.dirt = L(T.dirt); M.stone = L(T.stone); M.sand = L(T.sand); M.cobble = L(T.cobble); M.brick = L(T.brick);
  M.planks = L(T.planks); M.log = six(L(T.logSide), L(T.logTop)); M.leaves = L(T.leaves);
  M.glass = L(T.glass, { transparent: true, depthWrite: false });
  M.lantern = L(T.lantern, { emissive: new THREE.Color('#ffb54a'), emissiveMap: T.lantern, emissiveIntensity: 1.6 });
  M.gold = L(T.gold, { emissive: new THREE.Color('#5a3d00'), emissiveIntensity: .25 });
  M.roof = L(T.roof); M.path = L(T.path); M.ore = L(T.ore, { emissive: new THREE.Color('#0a6b63'), emissiveIntensity: .35 });
  M.goldOre = L(T.goldOre); M.flowerR = L(T.flowerR); M.flowerY = L(T.flowerY);
  return M;
}

/* ---------------- мир ---------------- */
export const N = 128, C = 64, WL = 20; // размер, центр, уровень воды (вода над y<WL)
export const FLOOR = 22; // уровень пола спавна (верх = 23)
const key = (x, y, z) => (x * 512 + z) * 128 + y;

export class World {
  constructor(scene) {
    this.scene = scene; this.blocks = new Map(); this.dyn = []; this.H = new Int16Array(N * N);
    this.T = makeTextures(); this.M = materialsFor(this.T); this.lanterns = [];
    this.gen();
  }
  set(x, y, z, t) { if (x < 0 || z < 0 || x >= N || z >= N || y < 0 || y > 120) return; if (t) this.blocks.set(key(x, y, z), t); else this.blocks.delete(key(x, y, z)); }
  get(x, y, z) { return this.blocks.get(key(x, y, z)); }
  h(x, z) { x = Math.max(0, Math.min(N - 1, Math.round(x))); z = Math.max(0, Math.min(N - 1, Math.round(z))); return this.H[x * N + z]; }
  top(x, z) { return this.h(x, z) + 1; } // y верхней поверхности

  gen() {
    const r = rnd(77);
    // рельеф
    for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
      let h = 22 + (fbm(x / 34, z / 34) - .5) * 14;
      const dh = Math.hypot(x - 64, z - 20); h += 11 * Math.exp(-(dh * dh) / (2 * 13 * 13));            // холм с башней (север)
      const dl = Math.hypot(x - 96, z - 92); h -= 9 * Math.exp(-(dl * dl) / (2 * 15 * 15));             // озеро (юго-восток)
      const dm = Math.hypot(x - 20, z - 96); h += 9 * Math.exp(-(dm * dm) / (2 * 16 * 16));             // гора (юго-запад)
      const dc = Math.hypot(x - C, z - C); const f = Math.min(1, Math.max(0, (dc - 30) / 12)); const fs = f * f * (3 - 2 * f);
      h = FLOOR * (1 - fs) + h * fs;
      this.H[x * N + z] = Math.max(10, Math.round(h));
    }
    // столбцы
    for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
      const h = this.H[x * N + z]; let mn = h;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < N && zz < N) mn = Math.min(mn, this.H[xx * N + zz]); }
      const sandy = h <= WL + 1;
      this.set(x, h, z, sandy ? 'sand' : 'grass');
      for (let y = h - 1; y >= Math.min(h - 3, mn - 1); y--) this.set(x, y, z, y > h - 4 ? (sandy ? 'sand' : 'dirt') : 'stone');
    }
    this.spawn(); this.paths();
    // дома деревни
    this.houses = [[C - 26, C - 4, 'E'], [C + 20, C - 4, 'W'], [C + 5, C + 20, 'W'], [C - 24, C - 24, 'E'], [C + 18, C + 18, 'W'], [C + 18, C - 26, 'S']];
    for (const [x, z, f] of this.houses) this.house(x, z, 9, 8, f);
    this.tower(61, 17);
    // деревья
    let placed = 0;
    for (let i = 0; i < 900 && placed < 110; i++) {
      const x = 3 + Math.floor(r() * (N - 6)), z = 3 + Math.floor(r() * (N - 6));
      if (Math.hypot(x - C, z - C) < 33) continue; if (Math.hypot(x - 64, z - 20) < 11) continue;
      if (this.h(x, z) <= WL + 1) continue; if (this.get(x, this.h(x, z) + 1, z)) continue;
      if (Math.abs(x - C) < 3 || Math.abs(z - C) < 3) continue;
      this.tree(x, this.h(x, z) + 1, z, 4 + Math.floor(r() * 3)); placed++;
    }
    // цветы
    for (let i = 0; i < 260; i++) { const x = Math.floor(r() * N), z = Math.floor(r() * N); const y = this.h(x, z);
      if (this.get(x, y, z) === 'grass' && !this.get(x, y + 1, z) && Math.hypot(x - C, z - C) > 14) this.flowers.push([x, y + 1, z, r() > .5 ? 'flowerR' : 'flowerY']); }
    this.quarry(C - 46, C + 24);
  }
  spawn() {
    this.flowers = [];
    for (let x = C - 15; x <= C + 15; x++) for (let z = C - 15; z <= C + 15; z++) {
      const d = Math.hypot(x - C + .5, z - C + .5);
      if (d < 13.5) this.set(x, FLOOR, z, d > 12.3 ? 'cobble' : ((Math.abs(x - C) + Math.abs(z - C)) % 6 === 0 ? 'cobble' : 'brick'));
    }
    // золотая эмблема-ромб вокруг фонтана
    for (let x = C - 7; x <= C + 7; x++) for (let z = C - 7; z <= C + 7; z++) { const m = Math.abs(x - C) + Math.abs(z - C); if (m === 7) this.set(x, FLOOR, z, 'gold'); }
    // фонтан
    for (let x = C - 3; x <= C + 3; x++) for (let z = C - 3; z <= C + 3; z++) {
      const edge = Math.abs(x - C) === 3 || Math.abs(z - C) === 3; if (edge) this.set(x, FLOOR + 1, z, 'brick');
    }
    for (let y = FLOOR + 1; y <= FLOOR + 4; y++) this.set(C, y, C, 'brick');
    this.set(C, FLOOR + 5, C, 'gold'); this.set(C, FLOOR + 6, C, 'lantern'); this.lanterns.push([C, FLOOR + 6, C]);
    this.fountain = { x: C, z: C, y: FLOOR + 1.8 };
    // фонари по кругу
    for (const [dx, dz] of [[9, 9], [-9, 9], [9, -9], [-9, -9]]) { const x = C + dx, z = C + dz;
      for (let y = FLOOR + 1; y <= FLOOR + 3; y++) this.set(x, y, z, 'log'); this.set(x, FLOOR + 4, z, 'lantern'); this.lanterns.push([x, FLOOR + 4, z]); }
  }
  paths() {
    for (let k = 14; k < 58; k++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let w = -1; w <= 1; w++) {
      const x = C + dx * k + (dz ? w : 0), z = C + dz * k + (dx ? w : 0); if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) continue;
      const y = this.h(x, z); if (y <= WL) continue; if (this.get(x, y, z) === 'grass') this.set(x, y, z, 'path');
      if (w === 0 && k % 9 === 0 && k < 40) { const lx = x + (dz ? 2 : 0), lz = z + (dx ? 2 : 0); const ly = this.h(lx, lz);
        for (let yy = ly + 1; yy <= ly + 2; yy++) this.set(lx, yy, lz, 'log'); this.set(lx, ly + 3, lz, 'lantern'); this.lanterns.push([lx, ly + 3, lz]); }
    }
  }
  house(x0, z0, w, d, facing) {
    const y0 = FLOOR;
    for (let x = x0 - 1; x <= x0 + w; x++) for (let z = z0 - 1; z <= z0 + d; z++) { this.set(x, y0, z, 'cobble'); for (let y = y0 + 1; y < y0 + 12; y++) this.set(x, y, z, null); }
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) {
      const ex = x === x0 || x === x0 + w - 1, ez = z === z0 || z === z0 + d - 1; if (!ex && !ez) continue;
      for (let y = y0 + 1; y <= y0 + 4; y++) {
        let t = ex && ez ? 'log' : 'planks';
        const mid = ex ? (z - z0 === Math.floor(d / 2) || z - z0 === Math.floor(d / 2) - 1) : (x - x0 === Math.floor(w / 2) || x - x0 === Math.floor(w / 2) - 1);
        const midW = ex ? (z - z0 === 2 || z - z0 === d - 3) : (x - x0 === 2 || x - x0 === w - 3);
        if (t === 'planks' && midW && (y === y0 + 2 || y === y0 + 3)) t = 'glass';
        const door = (facing === 'E' && x === x0 + w - 1) || (facing === 'W' && x === x0) || (facing === 'N' && z === z0) || (facing === 'S' && z === z0 + d - 1);
        if (door && mid && y <= y0 + 2 && t !== 'log') t = null;
        this.set(x, y, z, t);
      }
      this.set(x, y0 + 5, z, 'log');
    }
    // двускатная крыша вдоль x
    for (let k = 0; k <= Math.ceil(d / 2); k++) for (let x = x0 - 1; x <= x0 + w; x++) {
      const za = z0 - 1 + k, zb = z0 + d - k; if (za > zb) continue;
      this.set(x, y0 + 6 + k, za, 'roof'); this.set(x, y0 + 6 + k, zb, 'roof');
      if (x === x0 - 1 || x === x0 + w) for (let z = za + 1; z < zb; z++) this.set(x, y0 + 6 + k, z, 'planks');
    }
    const lx = facing === 'E' ? x0 + w : facing === 'W' ? x0 - 1 : x0 + Math.floor(w / 2) + 1;
    const lz = facing === 'N' ? z0 - 1 : facing === 'S' ? z0 + d : z0 + Math.floor(d / 2) + 1;
    this.set(lx, y0 + 3, lz, 'lantern'); this.lanterns.push([lx, y0 + 3, lz]);
  }
  tower(x0, z0) {
    const s = 7; let base = 0; for (let x = x0; x < x0 + s; x++) for (let z = z0; z < z0 + s; z++) base = Math.max(base, this.h(x, z));
    for (let x = x0 - 1; x <= x0 + s; x++) for (let z = z0 - 1; z <= z0 + s; z++) for (let y = this.h(x, z); y <= base; y++) this.set(x, y, z, 'brick');
    const top = base + 20;
    for (let x = x0; x < x0 + s; x++) for (let z = z0; z < z0 + s; z++) {
      const e = x === x0 || x === x0 + s - 1 || z === z0 || z === z0 + s - 1; if (!e) continue;
      const corner = (x === x0 || x === x0 + s - 1) && (z === z0 || z === z0 + s - 1);
      for (let y = base + 1; y <= top; y++) { let t = corner ? 'cobble' : 'brick';
        if (!corner && (y - base) % 5 === 3 && (x - x0 === 3 || z - z0 === 3)) t = 'glass'; this.set(x, y, z, t); }
    }
    for (let x = x0 - 1; x <= x0 + s; x++) for (let z = z0 - 1; z <= z0 + s; z++) {
      this.set(x, top + 1, z, 'brick'); const e = x === x0 - 1 || x === x0 + s || z === z0 - 1 || z === z0 + s;
      if (e && (x + z) % 2 === 0) this.set(x, top + 2, z, 'brick'); }
    for (let y = top + 2; y <= top + 4; y++) this.set(x0 + 3, y, z0 + 3, 'gold');
    this.set(x0 + 3, top + 5, z0 + 3, 'lantern'); this.lanterns.push([x0 + 3, top + 5, z0 + 3]);
    this.towerPos = { x: x0 + 3.5, y: base + 12, z: z0 + 3.5, top };
  }
  tree(x, y, z, hgt) {
    for (let i = 0; i < hgt; i++) this.set(x, y + i, z, 'log');
    for (let dy = hgt - 3; dy <= hgt; dy++) { const rr = dy >= hgt - 1 ? 1 : 2;
      for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
        if (Math.abs(dx) === rr && Math.abs(dz) === rr && (dy === hgt || hash2(x + dx * 7, z + dz * 13 + dy) > .5)) continue;
        if (!this.get(x + dx, y + dy, z + dz)) this.set(x + dx, y + dy, z + dz, 'leaves'); } }
    this.set(x, y + hgt, z, 'leaves');
  }
  quarry(x0, z0) {
    // карьер 8x8 глубиной 4 с рудой в стенах; часть руды «добывается» в кадре
    for (let x = x0 - 12; x <= x0 + 20; x++) for (let z = z0 - 12; z <= z0 + 20; z++) for (let y = this.h(x, z) + 1; y < this.h(x, z) + 10; y++) { const t = this.get(x, y, z); if (t === 'log' || t === 'leaves') this.set(x, y, z, null); }
    let top = 0; for (let x = x0 - 1; x <= x0 + 8; x++) for (let z = z0 - 1; z <= z0 + 8; z++) top = Math.max(top, this.h(x, z));
    const y0 = Math.max(WL + 1, top - 4); this.quarryPos = { x: x0 + 4, y: y0 + 1, z: z0 + 4 };
    for (let x = x0; x < x0 + 8; x++) for (let z = z0; z < z0 + 8; z++) { for (let y = y0 + 1; y <= this.h(x, z) + 1; y++) this.set(x, y, z, null); this.set(x, y0, z, 'stone'); }
    for (let x = x0 - 1; x <= x0 + 8; x++) for (let z = z0 - 1; z <= z0 + 8; z++) {
      const e = x === x0 - 1 || x === x0 + 8 || z === z0 - 1 || z === z0 + 8; if (!e) continue;
      for (let y = y0 - 1; y <= top; y++) this.set(x, y, z, y >= top - 1 ? 'grass' : y >= top - 2 ? 'dirt' : 'stone'); }
    const r = rnd(31); this.ores = [];
    for (let x = x0; x < x0 + 8; x++) for (let y = y0 + 1; y <= y0 + 3; y++) { const z = x % 3 === 0 ? z0 - 1 : z0 - 1;
      if (r() < .45) { const t = r() > .5 ? 'ore' : 'goldOre'; this.set(x, y, z, null); this.ores.push([x, y, z, t]); } }
    for (let z = z0; z < z0 + 8; z++) for (let y = y0 + 1; y <= y0 + 3; y++) if (r() < .35) { const t = r() > .5 ? 'ore' : 'goldOre'; this.set(x0 - 1, y, z, null); this.ores.push([x0 - 1, y, z, t]); }
  }
  // площадка, которая строится по ходу ролика
  siteBlocks(x0, z0, w, d) {
    const L = []; const y0 = FLOOR;
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) for (let y = y0 + 1; y < y0 + 10; y++) this.set(x, y, z, null);
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) L.push([x, y0, z, 'planks']);
    for (let y = y0 + 1; y <= y0 + 4; y++) {
      const ring = []; for (let x = x0; x < x0 + w; x++) ring.push([x, z0]); for (let z = z0 + 1; z < z0 + d; z++) ring.push([x0 + w - 1, z]);
      for (let x = x0 + w - 2; x >= x0; x--) ring.push([x, z0 + d - 1]); for (let z = z0 + d - 2; z > z0; z--) ring.push([x0, z]);
      for (const [x, z] of ring) { const corner = (x === x0 || x === x0 + w - 1) && (z === z0 || z === z0 + d - 1);
        const win = !corner && (y === y0 + 2 || y === y0 + 3) && ((x - x0) % 3 === 2 || (z - z0) % 3 === 2);
        const door = z === z0 + d - 1 && x === x0 + Math.floor(w / 2) && y <= y0 + 2;
        if (!door) L.push([x, y, z, corner ? 'log' : win ? 'glass' : 'cobble']); } }
    for (let k = 0; k <= Math.ceil(d / 2); k++) for (let x = x0 - 1; x <= x0 + w; x++) {
      const za = z0 - 1 + k, zb = z0 + d - k; if (za > zb) continue;
      L.push([x, y0 + 5 + k, za, 'roof']); if (zb !== za) L.push([x, y0 + 5 + k, zb, 'roof']); }
    return L;
  }

  build() {
    // dyn-блоки считаются воздухом при отсечении граней
    this.siteA = this.siteBlocks(C - 13, C + 17, 7, 7);
    this.siteB = this.siteBlocks(C - 26, C + 8, 9, 7);
    const dynKeys = new Set([...this.siteA, ...this.siteB, ...this.ores].map(([x, y, z]) => key(x, y, z)));
    const opaque = (x, y, z) => { const t = this.get(x, y, z); return !!t && t !== 'glass' && t !== 'leaves' && t !== 'lantern' && !dynKeys.has(key(x, y, z)); };
    const occl = (x, y, z) => { const t = this.get(x, y, z); return !!t && t !== 'glass' && t !== 'lantern' && !dynKeys.has(key(x, y, z)); };
    const visibleFace = (t, x, y, z) => { const n = this.get(x, y, z); if (!n || dynKeys.has(key(x, y, z))) return true;
      if (n === 'glass' || n === 'lantern') return n !== t; if (n === 'leaves') return t !== 'leaves'; return false; };
    // текстура грани
    const texKey = (t, f) => t === 'grass' ? (f === 2 ? 'grassTop' : f === 3 ? 'dirt' : 'grassSide') : t === 'log' ? (f === 2 || f === 3 ? 'logTop' : 'logSide') : t;
    const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(n => {
      const ax = n.findIndex(v => v !== 0), [a1, a2] = [0, 1, 2].filter(i => i !== ax); const side = n[ax] > 0 ? 1 : 0;
      let cs = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => { const c = [0, 0, 0]; c[ax] = side; c[a1] = u; c[a2] = v; return c; });
      const e1 = cs[1].map((v, i) => v - cs[0][i]), e2 = cs[2].map((v, i) => v - cs[0][i]);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) cs = [cs[0], cs[3], cs[2], cs[1]];
      return { n, ax, a1, a2, cs }; });
    const uvOf = (f, c) => { const F = FACES[f]; if (F.ax === 1) return [c[0], c[2]]; if (F.ax === 0) return [F.n[0] > 0 ? 1 - c[2] : c[2], c[1]]; return [F.n[2] > 0 ? c[0] : 1 - c[0], c[1]]; };
    const AOL = [.42, .62, .82, 1];
    const CH = 32; const buckets = new Map();
    for (const [k, t] of this.blocks) {
      if (dynKeys.has(k)) continue;
      const y = k % 128, xz = (k - y) / 128, z = xz % 512, x = (xz - z) / 512;
      for (let f = 0; f < 6; f++) { const F = FACES[f]; const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
        if (!visibleFace(t, nx, ny, nz)) continue;
        const tk = texKey(t, f); const bk = `${Math.floor(x / CH)}_${Math.floor(z / CH)}_${tk}`;
        let B = buckets.get(bk); if (!B) { B = { tk, pos: [], uv: [], col: [], nor: [], idx: [] }; buckets.set(bk, B); }
        const ao = F.cs.map(c => { const d = [0, 0, 0]; d[F.a1] = c[F.a1] ? 1 : -1; const e = [0, 0, 0]; e[F.a2] = c[F.a2] ? 1 : -1;
          const s1 = occl(nx + d[0], ny + d[1], nz + d[2]) ? 1 : 0, s2 = occl(nx + e[0], ny + e[1], nz + e[2]) ? 1 : 0;
          const cc = occl(nx + d[0] + e[0], ny + d[1] + e[1], nz + d[2] + e[2]) ? 1 : 0; return s1 && s2 ? 0 : 3 - (s1 + s2 + cc); });
        const base = B.pos.length / 3;
        F.cs.forEach((c, i) => { B.pos.push(x + c[0], y + c[1], z + c[2]); B.uv.push(...uvOf(f, c)); const l = t === 'lantern' ? 1 : AOL[ao[i]];
          B.col.push(l, l, l); B.nor.push(...F.n); });
        if (ao[0] + ao[2] >= ao[1] + ao[3]) B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        else B.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base); }
    }
    const matCache = {};
    const matFor = tk => { if (matCache[tk]) return matCache[tk]; const src = { grassTop: this.M.grass[2], grassSide: this.M.grass[0], logTop: this.M.log[2], logSide: this.M.log[0] }[tk] || this.M[tk];
      const m = src.clone(); m.vertexColors = true; return matCache[tk] = m; };
    this.faceCount = 0;
    for (const B of buckets.values()) { const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
      g.setIndex(B.idx); g.computeBoundingSphere(); this.faceCount += B.idx.length / 6;
      const mesh = new THREE.Mesh(g, matFor(B.tk)); mesh.castShadow = B.tk !== 'glass'; mesh.receiveShadow = true; this.scene.add(mesh); }
    // цветы
    const fgeo = new THREE.BoxGeometry(.3, .5, .3); const m4 = new THREE.Matrix4();
    for (const ft of ['flowerR', 'flowerY']) { const L = this.flowers.filter(f => f[3] === ft); const mesh = new THREE.InstancedMesh(fgeo, this.M[ft], L.length);
      L.forEach((p, i) => { m4.makeTranslation(p[0] + .5, p[1] + .25, p[2] + .5); mesh.setMatrixAt(i, m4); }); mesh.castShadow = true; this.scene.add(mesh); }
    this.dynSets = { A: this.makeDyn(this.siteA), B: this.makeDyn(this.siteB), O: this.makeDyn(this.ores.slice().reverse()) };
    // вода
    const wg = new THREE.PlaneGeometry(N * 3, N * 3); wg.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshPhongMaterial({ color: '#2d6fb4', transparent: true, opacity: .82, shininess: 90, specular: new THREE.Color('#9fd0ff') });
    const water = new THREE.Mesh(wg, this.waterMat); water.position.set(C, WL + .85, C); water.receiveShadow = true; this.scene.add(water);
    const fw = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), this.waterMat); fw.position.set(C + .5, FLOOR + 1.75, C + .5); this.scene.add(fw);
    // облака
    this.clouds = new THREE.Group(); const cm = this.cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: .85, emissive: '#ffffff', emissiveIntensity: .15 });
    const r = rnd(5);
    for (let i = 0; i < 26; i++) { const g = new THREE.Group(); const n = 2 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(8 + r() * 10, 2.5, 6 + r() * 8), cm); b.position.set(k * 6 + r() * 3, 0, r() * 6); g.add(b); }
      g.position.set(-120 + r() * 380, 70 + r() * 8, -120 + r() * 380); this.clouds.add(g); }
    this.scene.add(this.clouds);
  }
  makeDyn(L) {
    const byT = {}; L.forEach((p, i) => { (byT[p[3]] = byT[p[3]] || []).push([p, i]); });
    const geo = new THREE.BoxGeometry(1, 1, 1); const m4 = new THREE.Matrix4(); const meshes = [];
    for (const t in byT) { const arr = byT[t]; const mesh = new THREE.InstancedMesh(geo, this.M[t], arr.length);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      arr.forEach(([p], i) => { m4.makeTranslation(p[0] + .5, p[1] + .5, p[2] + .5); mesh.setMatrixAt(i, m4); });
      this.scene.add(mesh); meshes.push({ mesh, idx: arr.map(a => a[1]), pos: arr.map(a => a[0]) }); }
    return { meshes, total: L.length };
  }
  // показать первые n блоков набора (с «выпрыгиванием» последнего)
  setDyn(name, n) {
    const D = this.dynSets[name]; const m4 = new THREE.Matrix4(); const s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    for (const o of D.meshes) { let c = 0; o.idx.forEach(i => { if (i < n) c++; }); o.mesh.count = c;
      // анимация появления: последние ~6 блоков масштабируются
      o.idx.forEach((i, j) => { if (j >= c) return; const k = Math.min(1, n - i); const sc = k >= 1 ? 1 : .2 + .8 * k;
        const P = o.pos[j]; p.set(P[0] + .5, P[1] + .5, P[2] + .5); s.set(sc, sc, sc); m4.compose(p, q, s); o.mesh.setMatrixAt(j, m4); });
      o.mesh.instanceMatrix.needsUpdate = true; }
  }
}

/* ---------------- персонажи ---------------- */
function faceTex(skin, hair, eye) {
  return canvasTex((g, n) => { g.fillStyle = skin; g.fillRect(0, 0, n, n); g.fillStyle = hair; g.fillRect(0, 0, n, 4); g.fillRect(0, 4, 2, 3); g.fillRect(n - 2, 4, 2, 3);
    g.fillStyle = '#ffffff'; g.fillRect(3, 8, 3, 2); g.fillRect(10, 8, 3, 2); g.fillStyle = eye; g.fillRect(4, 8, 2, 2); g.fillRect(11, 8, 2, 2);
    g.fillStyle = hex(skin, -.12); g.fillRect(6, 12, 4, 1); });
}
export class Char {
  constructor(scene, o) {
    const L = c => new THREE.MeshLambertMaterial({ color: c });
    const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; };
    const u = 1 / 16; this.g = new THREE.Group();
    const skin = L(o.skin), shirt = L(o.shirt), pants = L(o.pants), shoe = L('#2b2b30');
    const hairM = L(o.hair);
    const headMats = [skin, skin, hairM, skin, new THREE.MeshLambertMaterial({ map: faceTex(o.skin, o.hair, o.eye || '#3a6fd8') }), skin];
    // голова сзади — волосы
    headMats[5] = hairM; headMats[0] = new THREE.MeshLambertMaterial({ map: canvasTex((g, n) => { g.fillStyle = o.skin; g.fillRect(0, 0, n, n); g.fillStyle = o.hair; g.fillRect(0, 0, n, 6); }) });
    headMats[1] = headMats[0];
    this.head = new THREE.Group(); const hm = box(8 * u, 8 * u, 8 * u, headMats); hm.position.y = 4 * u; this.head.add(hm);
    this.head.position.y = 24 * u;
    const body = box(8 * u, 12 * u, 4 * u, shirt); body.position.y = 18 * u;
    const limb = (mat, mat2, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); const a = box(4 * u, 12 * u, 4 * u, mat); a.position.y = -6 * u; p.add(a);
      if (mat2) { const b = box(4.05 * u, 3 * u, 4.05 * u, mat2); b.position.y = -10.5 * u; p.add(b); } return p; };
    this.armL = limb(shirt, skin, -6 * u, 24 * u); this.armR = limb(shirt, skin, 6 * u, 24 * u);
    this.legL = limb(pants, shoe, -2 * u, 12 * u); this.legR = limb(pants, shoe, 2 * u, 12 * u);
    this.g.add(this.head, body, this.armL, this.armR, this.legL, this.legR);
    if (o.cape) { const cp = box(8 * u, 14 * u, 1 * u, L(o.cape)); cp.position.set(0, 17 * u, -2.6 * u); cp.rotation.x = .08; this.g.add(cp); }
    this.g.scale.setScalar(1.12); scene.add(this.g); this.g.visible = false;
  }
  pose({ x, y, z, ry = 0, walk = 0, walkAmt = 0, swing = 0, wave = 0, look = 0, lookUp = 0, sit = 0, vis = true }) {
    this.g.visible = vis; if (!vis) return;
    const bob = walkAmt ? Math.abs(Math.sin(walk * Math.PI)) * .06 : 0;
    this.g.position.set(x, y + bob - sit * .55, z); this.g.rotation.y = ry;
    const a = Math.sin(walk * Math.PI) * .75 * walkAmt;
    this.legL.rotation.x = a - sit * 1.5; this.legR.rotation.x = -a - sit * 1.5; this.armL.rotation.x = -a * .9; this.armR.rotation.x = a * .9;
    this.armL.rotation.z = 0; this.armR.rotation.z = 0;
    if (swing) { const s = (Math.sin(swing * Math.PI * 2) * .5 + .5); this.armR.rotation.x = -1.1 - s * 1.0; this.armR.rotation.z = -.1; }
    if (wave) { this.armR.rotation.z = 2.5 + Math.sin(wave * Math.PI * 2) * .35; this.armR.rotation.x = 0; }
    this.head.rotation.y = look; this.head.rotation.x = -lookUp;
  }
}
