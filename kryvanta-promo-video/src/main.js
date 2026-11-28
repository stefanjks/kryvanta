// Режиссура ролика: камера, свет, время суток, персонажи, оверлеи. window.render(t) — детерминированный кадр.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, Char, C, FLOOR, rnd } from './world.js';

const TL = window.TL; const P = {}; TL.phrases.forEach(p => P[p.id] = p); const DUR = TL.duration;
const W = 1080, H = 1920, RS = window.RENDER_SCALE || 1;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pr = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const es = x => x * x * (3 - 2 * x);
const eo = x => 1 - Math.pow(1 - x, 3);
const eb = x => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const ST = id => P[id].start, EN = id => P[id].end;
const WS = (id, i) => { const w = P[id].words; return w[Math.min(i, w.length - 1)].s; };

/* ---------------- рендерер ---------------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !!window.AA, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W * RS, H * RS, false);
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, .1, 900);

/* небо */
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 1 }, stars: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize; uniform float stars; varying vec3 vD;
   float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
   void main(){ float y = clamp(vD.y,-.2,1.); vec3 c = mix(hor, top, pow(clamp(y,0.,1.), .55)); c = mix(c, hor*.6, clamp(-y*5.,0.,1.));
     float d = max(dot(vD, normalize(sunDir)), 0.); c += sunCol * (pow(d, 900./sunSize)*6. + pow(d, 12.)*.35 + pow(d,3.)*.12);
     vec3 q = floor(vD*260.); float s = step(.9975, h(q)) * stars * clamp(y*3.,0.,1.); c += vec3(s);
     gl_FragColor = vec4(c,1.); }` }));
scene.add(sky);
scene.fog = new THREE.Fog(0x000000, 60, 260);
const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true;
sun.shadow.mapSize.set(window.SHADOW || 2048, window.SHADOW || 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = .04;
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 300 });
scene.add(sun); scene.add(sun.target);

const world = new World(scene); world.build();
const lampLights = [];
for (const [x, y, z] of world.lanterns.filter(l => Math.hypot(l[0] - C, l[2] - C) < 30).slice(0, 7)) {
  const l = new THREE.PointLight(0xffb55a, 0, 16, 1.6); l.position.set(x + .5, y + .5, z + .5); scene.add(l); lampLights.push(l); }

/* персонажи */
const cast = {
  hero: new Char(scene, { skin: '#e3b08c', hair: '#3a281c', shirt: '#2f4a7a', pants: '#2a2c3a', eye: '#4a7ad8' }),
  a: new Char(scene, { skin: '#f0c7a5', hair: '#e2c27a', shirt: '#c94f4f', pants: '#3b4a6b', eye: '#3a8f5a' }),
  b: new Char(scene, { skin: '#9c6b4a', hair: '#1c1c1c', shirt: '#4fa36a', pants: '#3d3226', eye: '#5a3a1a' }),
  c: new Char(scene, { skin: '#e8b996', hair: '#a0522d', shirt: '#e0a33c', pants: '#2f3a52', eye: '#2e6fc4' }),
  d: new Char(scene, { skin: '#f1cfb4', hair: '#d8d8e0', shirt: '#8a5cc9', pants: '#2b2b38', eye: '#7a3fc9' }),
  e: new Char(scene, { skin: '#c98d6a', hair: '#5a3a22', shirt: '#36b3c4', pants: '#3a2f2f', eye: '#2a2a2a' }),
};
const Y0 = FLOOR + 1;

/* постобработка */
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W * RS, H * RS);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W * RS / 2, H * RS / 2), .6, .55, .82); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, tint: { value: new THREE.Color(1, 1, 1) }, sat: { value: 1 }, con: { value: 1 }, vig: { value: .3 }, seed: { value: 0 }, lift: { value: new THREE.Color(0, 0, 0) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 tint; uniform float sat; uniform float con; uniform float vig; uniform float seed; uniform vec3 lift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed)*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
      c = (c - .5) * con + .5; c = c * tint + lift * (1. - c);
      vec2 q = vUv - .5; q.x *= .65; c *= 1. - vig * smoothstep(.25, .75, length(q)*1.35);
      c += (h(vUv*1000.) - .5) * .035; gl_FragColor = vec4(clamp(c,0.,1.), 1.); }` });
composer.addPass(grade);

/* ---------------- время суток / настроение ---------------- */
// ключи: m, верх неба, горизонт, цвет «солнца», интенсивность, высота солнца, азимут, полусфера (небо, земля, инт), экспозиция, звёзды, фонари
const MOODS = [
  [0.00, '#070d24', '#22335a', '#a9bdff', 1.15, 34, 60, '#4a62a8', '#141a2c', 1.25, 1.3, 1, 1],
  [0.25, '#16285a', '#56699e', '#b4c2ff', 1.2, 22, 70, '#5a70b4', '#1c2030', 1.2, 1.25, .5, .8],
  [0.45, '#2f5ea6', '#ffad85', '#ffb07a', 1.6, 6, 95, '#8aa6dc', '#3a2c24', .85, 1.05, 0, .25],
  [0.70, '#3a86dc', '#ffd9a8', '#fff0d2', 2.6, 28, 120, '#a9c8f0', '#5a4a36', 1.0, 1.05, 0, 0],
  [0.90, '#4a8fe0', '#ffe2b8', '#fff1d8', 2.8, 38, 210, '#b0cdf2', '#5e4c38', 1.05, 1.08, 0, 0],
  [1.00, '#355aa8', '#ffa45c', '#ffb36b', 2.4, 12, 250, '#8fa7d8', '#5a3c28', .95, 1.05, 0, .2],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function mixC(a, b, k) { cA.set(a); cB.set(b); return cA.clone().lerp(cB, k); }
function moodParams(m) {
  let i = 0; while (i < MOODS.length - 2 && m > MOODS[i + 1][0]) i++;
  const A = MOODS[i], B = MOODS[i + 1], k = es(pr(m, A[0], B[0]));
  const f = j => lerp(A[j], B[j], k);
  return { top: mixC(A[1], B[1], k), hor: mixC(A[2], B[2], k), sunC: mixC(A[3], B[3], k), sunI: f(4), elev: f(5), az: f(6),
    hSky: mixC(A[7], B[7], k), hGnd: mixC(A[8], B[8], k), hI: f(9), exp: f(10), stars: f(11), lamps: f(12) };
}
function moodAt(t) {
  const k = [[0, 0], [ST('b1'), 0], [EN('b5'), .22], [ST('c1'), .3], [EN('c4'), .62], [ST('d1') - .3, .74], [EN('d6'), .9], [ST('e1'), .96], [DUR, 1]];
  for (let i = 0; i < k.length - 1; i++) if (t <= k[i + 1][0]) return lerp(k[i][1], k[i + 1][1], pr(t, k[i][0], k[i + 1][0]));
  return 1;
}
const focus = new THREE.Vector3(C, Y0, C);
function applyMood(m, t) {
  const p = moodParams(m);
  skyU.top.value.copy(p.top); skyU.hor.value.copy(p.hor); skyU.sunCol.value.copy(p.sunC).multiplyScalar(m < .2 ? .25 : 1); skyU.stars.value = p.stars;
  skyU.sunSize.value = m < .2 ? .6 : 1.4;
  const el = THREE.MathUtils.degToRad(p.elev), az = THREE.MathUtils.degToRad(p.az);
  const dir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(dir);
  sun.color.copy(p.sunC); sun.intensity = p.sunI;
  sun.position.copy(focus).addScaledVector(dir, 120); sun.target.position.copy(focus);
  hemi.color.copy(p.hSky); hemi.groundColor.copy(p.hGnd); hemi.intensity = p.hI;
  scene.fog.color.copy(p.hor).multiplyScalar(.85); scene.fog.near = lerp(30, 90, clamp(m * 2)); scene.fog.far = lerp(170, 330, clamp(m * 1.6));
  renderer.toneMappingExposure = p.exp;
  lampLights.forEach((l, i) => l.intensity = p.lamps * (22 + 3 * Math.sin(t * 7 + i)));
  world.M.lantern.emissiveIntensity = .5 + 1.6 * p.lamps;
  bloom.strength = .35 + .55 * p.lamps + .15 * clamp((m - .4) * 2);
  // грейдинг: холодный → тёплый
  const cold = 1 - clamp(m * 1.4);
  grade.uniforms.tint.value.setRGB(lerp(1.03, .86, cold), lerp(1.0, .93, cold), lerp(.94, 1.1, cold));
  grade.uniforms.sat.value = lerp(1.18, .72, cold); grade.uniforms.con.value = lerp(1.06, 1.1, cold);
  grade.uniforms.vig.value = lerp(.28, .55, cold); grade.uniforms.lift.value.setRGB(lerp(.02, 0, cold), lerp(.01, .01, cold), lerp(0, .04, cold));
  world.waterMat.color.set(m < .3 ? '#1b3e72' : '#2d6fb4');
  world.clouds.children.forEach((g, i) => { g.position.x = ((g.userData.x0 ??= g.position.x) + t * (m < .25 && t > ST('b1') ? 9 : 1.6) + 200) % 400 - 140; });
  world.cloudMat.opacity = lerp(.35, .9, clamp(m * 2));
  world.cloudMat.color.copy(p.hor).lerp(new THREE.Color('#ffffff'), .6); world.cloudMat.emissive.copy(p.hor).multiplyScalar(.25);
}

/* ---------------- камера ---------------- */
const tv = new THREE.Vector3();
function cam(p, tg, fov = 45) { camera.position.set(...p); tv.set(...tg); camera.lookAt(tv); camera.fov = fov; camera.updateProjectionMatrix(); focus.copy(tv); }
function dolly(k, A, B, fov = [45, 45]) { const q = A.map((v, i) => lerp(v, B[i] ?? v, k)); return q; }
function shake(t, a = .03) { return [Math.sin(t * 1.7) * a, Math.sin(t * 2.3 + 1) * a * .7, Math.cos(t * 1.3) * a]; }
const add = (a, b) => a.map((v, i) => v + b[i]);

/* ---------------- планы ---------------- */
const hide = () => Object.values(cast).forEach(c => c.g.visible = false);
const shots = [];
const SH = (from, f) => shots.push({ from, f });
const HERO = { x: C + 3, y: Y0, z: C + 7.5 };
// 1. Одинокий игрок на спавне — со спины
SH('a1', (L, t, d) => { const k = es(L / d);
  cam(add(dolly(k, [C + 5.5, 25.6, C + 19], [C + 4.6, 25.4, C + 14.5]), shake(t)), [C + 1.5, 25.4, C - 4], 46);
  cast.hero.pose({ ...HERO, ry: Math.PI, look: Math.sin(t * .6) * .35 }); });
// 2. Пустая улица с фонарями
SH('a2', (L, t, d) => { const k = es(L / d);
  cam(add(dolly(k, [C - 13, 24.6, C - 7], [C - 13, 24.9, C + 1]), shake(t)), [C + 8, 24.4, C + 5], 50); });
// 3. Облёт фонтана
SH('a3', (L, t, d) => { const a = lerp(.4, 1.25, es(L / d)); const r = 10;
  cam([C + .5 + Math.cos(a) * r, 25.6 + L * .2, C + .5 + Math.sin(a) * r], [C + .5, 25.5, C + .5], 46);
  cast.hero.pose({ ...HERO, ry: Math.PI, look: -.3 }); });
// 4. Кран вверх — пустой сервер
SH('a4', (L, t, d) => { const k = es(L / d);
  cam(dolly(k, [C + .5, 25.5, C + 12.5], [C + .5, 46, C + 30]), [C + .5, Y0 + 1, C + 6], 46);
  cast.hero.pose({ ...HERO, ry: Math.PI, look: Math.sin(L * 1.3) * .6, lookUp: -.1 }); });
// 5. Таймлапс стройки в одиночку
SH('b1', (L, t, d) => { const k = L / d; const sA = world.dynSets.A.total;
  world.setDyn('A', Math.floor(lerp(0, sA, Math.min(1, k * 1.08))) + (k * 1.08 % 1));
  cam(add(dolly(es(k), [C + 1, 30, C + 10], [C - 1, 28.5, C + 12]), shake(t, .02)), [C - 9.5, 25.5, C + 20.5], 50);
  const ang = k * 7; cast.hero.pose({ x: C - 9.5 + Math.cos(ang) * 5.2, y: Y0, z: C + 20.5 + Math.sin(ang) * 5.2, ry: -ang - Math.PI / 2 + Math.PI, swing: t * 3.2 }); });
// 6. Башня — облёт снизу вверх
SH('b2', (L, t, d) => { const k = es(L / d); const T = world.towerPos; const a = lerp(-.9, .3, k);
  cam([T.x + Math.cos(a) * 26, lerp(T.y - 6, T.top + 8, k), T.z + Math.sin(a) * 26 + 6], [T.x, lerp(T.y, T.top, k), T.z], 50); });
// 7. Панорама мира
SH('b3', (L, t, d) => { const k = es(L / d);
  cam(dolly(k, [C - 46, 62, C + 64], [C + 38, 66, C + 70]), [C, 24, C - 6], 50); });
// 8. Одиночество у фонтана
SH('b4', (L, t, d) => { const k = es(L / d);
  cast.hero.pose({ x: C + .5, y: Y0 + 1, z: C + 4.15, ry: 0, sit: 1, lookUp: .32 });
  cam(dolly(k, [C + 2.3, 25.4, C + 10.5], [C + 4.5, 27.4, C + 17]), [C + .5, 25, C + 4], 44); });
// 9. Игрок обращается к зрителю
SH('c1', (L, t, d) => { const k = es(L / d);
  cast.hero.pose({ x: C + .5, y: Y0, z: C + 6, ry: 0, look: Math.sin(L * .8) * .08, lookUp: .08 });
  cam(add(dolly(k, [C + 1.6, 25.4, C + 11], [C + 1.2, 25.3, C + 9.6]), shake(t, .015)), [C + .5, 25.1, C + 6.2], 38); });
// 10. Игроки приходят на спавн
const walkers = [['a', -1.2, 0], ['b', 1.3, 1.6], ['c', -.2, 3.4]];
SH('c2', (L, t, d) => { const k = es(L / d);
  walkers.forEach(([n, ox, oz], i) => { const z = C + 27 + oz - L * 2.4; cast[n].pose({ x: C + .5 + ox, y: world.top(C + ox, z), z, ry: Math.PI, walk: L * 2.6 + i * .4, walkAmt: 1, look: Math.sin(L + i) * .2 }); });
  cam(dolly(k, [C - 3, 24.9, C + 11], [C - 3.6, 25.2, C + 9.5]), [C + .5, 24.6, C + 22 - L * 1.4], 46); });
// 11. Встреча: машут друг другу
SH('c4', (L, t, d) => { const k = es(L / d);
  cast.hero.pose({ x: C + .5, y: Y0, z: C + 7, ry: 0, wave: L > .4 ? L * 1.6 : 0 });
  walkers.forEach(([n, ox, oz], i) => { const z = Math.max(C + 11.5 + Math.abs(ox) * .4, C + 20 + oz - L * 3.2);
    const arrived = z <= C + 11.5 + Math.abs(ox) * .4 + .01; cast[n].pose({ x: C + .5 + ox * 1.6, y: Y0, z, ry: Math.PI, walk: L * 2.6 + i, walkAmt: arrived ? 0 : 1, wave: arrived && i === 0 ? L * 1.7 : 0 }); });
  cam(dolly(k, [C - 7, 26.4, C + 17], [C - 5, 25.8, C + 18.5]), [C + .5, 24.6, C + 10], 48); });
// 12. Логотип — кран над спавном
SH('d1', (L, t, d) => { const k = eo(L / d);
  cam(dolly(k, [C + .5, 26, C + 16], [C + .5, 52, C + 34]), [C + .5, 24, C + .5], 48);
  ['hero', 'a', 'b', 'c'].forEach((n, i) => cast[n].pose({ x: C + .5 + (i - 1.5) * 1.6, y: Y0, z: C + 8.5, ry: 0, look: (i - 1.5) * -.15 })); });
// 13. Совместное строительство
SH('d2', (L, t, d) => { const k = L / d; const sB = world.dynSets.B.total;
  world.setDyn('B', lerp(sB * .08, sB, Math.min(1, k * 1.05)));
  const cx = C - 21.5, cz = C + 11.5;
  [['hero', -5.5, 0], ['a', 5.5, 0], ['b', 0, -4.8], ['c', 0, 4.8]].forEach(([n, ox, oz], i) => cast[n].pose({ x: cx + ox, y: Y0, z: cz + oz, ry: Math.atan2(-ox, -oz), swing: t * 3 + i * .3 }));
  const a = lerp(.9, 1.9, es(k)); cam([cx + Math.cos(a) * 17, 30, cz + Math.sin(a) * 17], [cx, 25, cz], 46); });
// 14. Добыча в карьере
SH('d4', (L, t, d) => { const k = L / d; const Q = world.quarryPos; const total = world.dynSets.O.total;
  world.setDyn('O', Math.round(lerp(total, total * .45, k)));
  [['b', -2, -1.5, Math.PI], ['d', 1.5, -2, Math.PI], ['e', -2.6, 1.5, -Math.PI / 2]].forEach(([n, ox, oz, ry], i) =>
    cast[n].pose({ x: Q.x + ox, y: Q.y, z: Q.z + oz, ry, swing: t * 3.4 + i * .4, lookUp: .2 }));
  cam(dolly(es(k), [Q.x + 3, Q.y + 12, Q.z + 8], [Q.x + 2, Q.y + 10, Q.z + 6.5]), [Q.x - 1, Q.y + .8, Q.z - 1.5], 50); });
// 15. Пролёт над деревней с игроками
SH('d6', (L, t, d) => { const k = es(L / d);
  [['hero', 0, 0], ['a', 1.4, -1], ['c', -1.4, -1.8], ['e', .2, -3.4]].forEach(([n, ox, oz], i) => { const x = C + 18 - L * 3.1 + oz; cast[n].pose({ x, y: world.top(x, C + 4), z: C + 4 + ox, ry: -Math.PI / 2, walk: L * 2.6 + i * .5, walkAmt: 1 }); });
  cam(dolly(k, [C + 30, 40, C + 30], [C + 12, 34, C + 26]), [C + 4 - L * 1.5, 24, C + 2], 50); });
// 16. Все вместе у фонтана на закате
const GROUP = [['b', -4.2], ['a', -2.5], ['hero', -.8], ['c', .9], ['d', 2.6], ['e', 4.3]];
SH('e1', (L, t, d) => { const k = es(L / d);
  GROUP.forEach(([n, ox], i) => cast[n].pose({ x: C + .5 + ox, y: Y0, z: C + 6.5 + Math.abs(ox) * .25, ry: -ox * .05, look: Math.sin(L * .7 + i) * .15, wave: n === 'a' && L > 1.2 && L < 3.2 ? L * 1.6 : 0 }));
  cam(add(dolly(k, [C + .5, 26, C + 22], [C + .5, 25.6, C + 18.5]), shake(t, .015)), [C + .5, 24.8, C + 6], 50); });
// 17. Финал: отъезд и заставка
SH('e3', (L, t, d) => { const k = es(clamp(L / 6));
  GROUP.forEach(([n, ox], i) => cast[n].pose({ x: C + .5 + ox, y: Y0, z: C + 6.5 + Math.abs(ox) * .25, ry: -ox * .05, wave: L * 1.5 + i * .3 }));
  cam(dolly(k, [C + .5, 26, C + 16], [C + .5, 40, C + 40]), [C + .5, lerp(25, 30, k), C + 3], 46); });

shots.forEach((s, i) => { s.start = i === 0 ? 0 : ST(s.from) - .18; });
shots.forEach((s, i) => { s.end = i < shots.length - 1 ? shots[i + 1].start : DUR + 1; });

/* ---------------- оверлеи ---------------- */
const $ = id => document.getElementById(id);
const dip = $('dip'), flash = $('flash');
const titles = [
  { el: $('t1'), a: .6, b: ST('a3') - .1 },
  { el: $('t2'), a: ST('b1') + .3, b: ST('b2') - .1 },
  { el: $('t3'), a: ST('b2') + .2, b: ST('b3') - .1 },
  { el: $('t4'), a: ST('b4') + .1, b: ST('c1') - .2 },
  { el: $('t5'), a: WS('c4', 4), b: ST('d1') - .15 },
];
titles.forEach(o => { o.words = [...o.el.querySelectorAll('span')]; });
function renderTitles(t) {
  titles.forEach(o => { const vis = t >= o.a && t < o.b; o.el.style.display = vis ? 'block' : 'none'; if (!vis) return;
    const out = pr(t, o.b - .35, o.b);
    o.words.forEach((w, i) => { const k = pr(t, o.a + i * .14, o.a + i * .14 + .55); w.style.opacity = es(k) * (1 - out);
      w.style.filter = `blur(${(1 - k) * 12}px)`; w.style.transform = `translateY(${(1 - eo(k)) * 26}px)`; }); });
}
const logo = $('logo'), chips = [...document.querySelectorAll('.chip')], endc = $('end');
const chipT = [[WS('d2', 2), ST('d4') - .2], [WS('d2', 4), ST('d4') - .2], [WS('d4', 2), ST('d6') - .2], [WS('d5', 4), ST('d6') - .2]];
function renderInfo(t) {
  const la = ST('d1'), lb = ST('d2') - .1;
  const lk = pr(t, la, la + .5); const lo = 1 - pr(t, lb - .3, lb);
  logo.style.display = t >= la && t < lb ? 'flex' : 'none';
  logo.style.opacity = lk * lo; logo.style.transform = `scale(${.7 + .3 * eb(lk)})`;
  chips.forEach((c, i) => { const [a, b] = chipT[i]; const vis = t >= a && t < b; c.style.display = vis ? 'flex' : 'none';
    const k = pr(t, a, a + .4), o = 1 - pr(t, b - .25, b); c.style.opacity = k * o; c.style.transform = `translateX(${(1 - eo(k)) * (i % 2 ? 120 : -120)}px)`; });
  // финальная заставка
  const ea = ST('e3') - .1; const ek = pr(t, ea, ea + .7);
  endc.style.display = t >= ea ? 'flex' : 'none'; endc.style.opacity = ek;
  const parts = [...endc.querySelectorAll('.ep')]; const ipT = WS('e3', 5);
  parts.forEach((p, i) => { const a = i === 2 ? ipT : ea + i * .25 + (i > 2 ? 1.1 : 0); const k = pr(t, a, a + .5);
    p.style.opacity = k; p.style.transform = `translateY(${(1 - eo(k)) * 30}px) scale(${i === 2 ? .8 + .2 * eb(k) : 1})`; });
  $('ip').style.textShadow = `0 0 ${30 + 18 * Math.sin(t * 3)}px rgba(255,200,80,.75), 0 6px 0 rgba(0,0,0,.5)`;
}
/* субтитры */
const chunks = [];
TL.phrases.forEach(p => { let cur = []; const fl = () => { if (cur.length) chunks.push({ words: cur }); cur = []; };
  p.words.forEach((w, i) => { cur.push(w); const len = cur.map(x => x.w).join(' ').length; const nx = p.words[i + 1];
    if (/[.!?…]$/.test(w.w) || (/[,—:]$/.test(w.w) && len > 14) || cur.length >= 6 || (nx && len + nx.w.length + 1 > 30)) fl(); }); fl(); });
chunks.forEach((c, i) => { c.s = c.words[0].s - .05; const nx = chunks[i + 1]; const le = c.words[c.words.length - 1].e;
  c.e = nx ? Math.min(nx.words[0].s - .05, le + .7) : le + .9; });
window.getSRT = () => { const f = x => { const ms = Math.round(x * 1000); const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  return chunks.map((c, i) => `${i + 1}\n${f(Math.max(0, c.s))} --> ${f(c.e)}\n${c.words.map(w => w.w).join(' ')}\n`).join('\n'); };
const subs = $('subs'); let cur = -1, wEls = [];
function renderSubs(t) {
  let idx = -1; chunks.forEach((c, i) => { if (t >= c.s && t < c.e) idx = i; });
  if (t >= ST('e3') - .1) idx = -1; // на финальной заставке субтитры убираем — текст в заставке
  if (idx !== cur) { subs.innerHTML = ''; wEls = []; cur = idx;
    if (idx >= 0) { const box = document.createElement('div'); box.className = 'chunk';
      chunks[idx].words.forEach(w => { const s = document.createElement('span'); s.className = 'w' + (w.hl ? ' hl' : ''); s.textContent = w.w; box.appendChild(s); wEls.push(s); });
      subs.appendChild(box); let fs = 68; box.style.fontSize = fs + 'px'; while (box.offsetHeight > fs * 1.18 * 2 + 6 && fs > 44) { fs -= 3; box.style.fontSize = fs + 'px'; } } }
  if (idx < 0) return; const c = chunks[idx]; const out = 1 - pr(t, c.e - .12, c.e);
  c.words.forEach((w, i) => { const k = pr(t, w.s - .06, w.s + .16); const e = wEls[i];
    e.style.opacity = (k > 0 ? .25 + .75 * es(k) : 0) * out; e.style.transform = `translateY(${(1 - eo(k)) * 18}px) scale(${1 + .06 * Math.sin(Math.PI * k)})`; });
}

/* ---------------- кадр ---------------- */
window.render = t => {
  hide(); world.setDyn('A', t > ST('b1') ? world.dynSets.A.total : 0); world.setDyn('B', t > ST('d2') ? world.dynSets.B.total : 0);
  world.setDyn('O', world.dynSets.O.total);
  let si = shots.findIndex(s => t >= s.start && t < s.end); if (si < 0) si = shots.length - 1;
  const s = shots[si]; s.f(t - s.start, t, s.end - s.start);
  const m = moodAt(t); applyMood(m, t);
  grade.uniforms.seed.value = (t * 30) % 97;
  composer.render();
  // переходы: затемнение на стыках планов (в грустной части дольше)
  const sad = t < ST('c1'); const dd = sad ? .32 : .16;
  let dk = 0; shots.forEach((q, i) => { if (i === 0) return; const x = Math.abs(t - q.start); if (x < dd) dk = Math.max(dk, 1 - x / dd); });
  dip.style.opacity = Math.max(dk * (sad ? 1 : .8), 1 - pr(t, 0, .9));
  flash.style.opacity = Math.max(0, 1 - pr(t, ST('d1') - .05, ST('d1') + .45)) * (t > ST('d1') - .05 ? .8 : 0);
  if (window.NOOV) { dip.style.opacity = 0; flash.style.opacity = 0; return; }
  renderTitles(t); renderInfo(t); renderSubs(t);
};
window.SHOTS = shots.map(s => ({ from: s.from, start: s.start, end: s.end }));
window.ready = true;
