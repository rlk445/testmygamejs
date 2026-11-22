/* Exterior estilo bairro dos EUA: céu procedural (aurora, dia, tarde, poente, noite), gramado, calçada, rua, caixa de correio,
   vizinhos, árvores, postes, carros. Substitui a antiga imagem de panorama. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, scene = VR.scene, H = VR.house, P = VR.phys, damp = VR.damp;
const out = VR.outdoor = { built: false, group: null };
const YG = H.YG, YS = YG - 0.14, pano = VR.pano;
const clamp01 = v => Math.max(0, Math.min(1, v));

// ====================================================== CÉU ======================================================
const TOD = {
  dawn:   { n: 'Aurora',     top: [.20, .28, .52], mid: [.58, .50, .68], hor: [1, .64, .40],   gnd: [.20, .22, .16], sunCol: [1, .74, .45], cloud: [1, .70, .62],   hemiC: [1, .82, .70],   hemiG: [.34, .30, .26], sunLC: [1, .72, .48],   sun: [.92, .10, -.38],  light: [.92, .10, -.38],  glow: 1.0,  sunV: 1, stars: .12, cover: .45, hemiI: .46, sunI: .60, moonI: 0, dark: .45 },
  day:    { n: 'Dia',        top: [.16, .42, .86], mid: [.40, .66, .95], hor: [.74, .87, .98], gnd: [.30, .46, .24], sunCol: [1, .97, .88], cloud: [1, 1, 1],       hemiC: [1, .95, .88],   hemiG: [.48, .42, .35], sunLC: [1, .95, .85],   sun: [.35, .85, -.40],  light: [.35, .85, -.40],  glow: .45,  sunV: 1, stars: 0,   cover: .50, hemiI: .62, sunI: .85, moonI: 0, dark: 0 },
  aft:    { n: 'Tarde',      top: [.22, .44, .80], mid: [.52, .70, .90], hor: [.92, .86, .74], gnd: [.34, .44, .22], sunCol: [1, .90, .68], cloud: [1, .95, .88],   hemiC: [1, .92, .80],   hemiG: [.46, .40, .32], sunLC: [1, .88, .66],   sun: [-.65, .45, -.55], light: [-.65, .45, -.55], glow: .75,  sunV: 1, stars: 0,   cover: .50, hemiI: .56, sunI: .80, moonI: 0, dark: .08 },
  sunset: { n: 'Pôr do sol', top: [.16, .20, .44], mid: [.52, .36, .56], hor: [1, .44, .18],   gnd: [.18, .16, .14], sunCol: [1, .46, .20], cloud: [1, .50, .40],   hemiC: [1, .66, .50],   hemiG: [.26, .21, .22], sunLC: [1, .52, .30],   sun: [-.93, .07, -.36], light: [-.93, .07, -.36], glow: 1.25, sunV: 1, stars: .10, cover: .50, hemiI: .42, sunI: .62, moonI: 0, dark: .50 },
  night:  { n: 'Noite',      top: [.01, .02, .07], mid: [.04, .07, .17], hor: [.10, .14, .27], gnd: [.03, .05, .04], sunCol: [.2, .2, .3],  cloud: [.14, .17, .26], hemiC: [.17, .23, .37], hemiG: [.08, .07, .07], sunLC: [.50, .60, .95], sun: [-.95, -.25, -.2], light: [-.34, .55, -.76], glow: 0,    sunV: 0, stars: 1,   cover: .30, hemiI: .30, sunI: .20, moonI: 1, dark: 1 }
};
const ORDER = ['dawn', 'day', 'aft', 'sunset', 'night'];
const cp = o => JSON.parse(JSON.stringify(o));
let todId = TOD[S.tod] ? S.tod : 'day'; S.tod = todId; S.night = todId === 'night';
let tgt = TOD[todId]; const cs = cp(tgt);
const cfg = { hemiC: new T.Color(), hemiG: new T.Color(), sunLC: new T.Color(), lightPos: new T.Vector3(), hemiI: .6, sunI: .8, dark: 0 };
const sky = VR.sky = { cfg, id: () => todId, name: () => TOD[todId].n };

const VERT = 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = [
  'precision highp float; varying vec3 vD;',
  'uniform vec3 uTop, uMid, uHor, uGnd, uSunCol, uCloud, uSun, uMoon;',
  'uniform float uGlow, uSunV, uMoonI, uStars, uCover, uTime;',
  'float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
  'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), f.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), f.x), f.y); }',
  'float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }',
  'void main(){',
  '  vec3 d = normalize(vD); float h = d.y;',
  '  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.22, h)); col = mix(col, uTop, smoothstep(0.12, 0.8, h));',
  '  col = mix(col, uGnd, 1.0 - smoothstep(-0.5, 0.0, h));',
  '  float sd = max(dot(d, uSun), 0.0);',
  '  col += uSunCol * (pow(sd, 5.0) * 0.30 + pow(sd, 48.0) * 0.55) * uGlow * uSunV;',
  '  col = mix(col, uSunCol * 1.6 + 0.2, smoothstep(0.9990, 0.9994, sd) * uSunV * smoothstep(-0.015, 0.01, h));',
  '  if (uMoonI > 0.01) { float md = dot(d, uMoon); float disc = smoothstep(0.99945, 0.9997, md); col += vec3(0.5, 0.6, 0.9) * pow(max(md, 0.0), 80.0) * 0.22 * uMoonI; col = mix(col, vec3(0.95, 0.95, 0.86) * (0.82 + 0.18 * vn(d.xz * 40.0)), disc * uMoonI); }',
  '  if (uStars > 0.01 && h > 0.0) { vec3 sp = d * 150.0; vec3 ip = floor(sp); vec3 fp = fract(sp) - 0.5; float r = h3(ip); float s = step(0.992, r) * smoothstep(0.34, 0.0, length(fp)) * (0.65 + 0.35 * sin(uTime * 2.0 + r * 80.0)); col += vec3(0.9, 0.95, 1.0) * s * uStars * smoothstep(0.02, 0.2, h); }',
  '  if (h > 0.0) { vec2 cuv = d.xz / (h + 0.22) * 1.5 + vec2(uTime * 0.004, 0.0); float f = fbm(cuv); float t = 0.78 - uCover * 0.5; float cl = smoothstep(t, t + 0.2, f) * smoothstep(0.0, 0.14, h); vec3 cc = uCloud * (1.0 - 0.28 * smoothstep(0.5, 0.85, fbm(cuv * 1.8 + 3.0))); col = mix(col, cc, cl * 0.92); }',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');
const v3 = () => ({ value: new T.Vector3() });
const skyM = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, depthTest: false, fog: false, vertexShader: VERT, fragmentShader: FRAG,
  uniforms: { uTop: v3(), uMid: v3(), uHor: v3(), uGnd: v3(), uSunCol: v3(), uCloud: v3(), uSun: v3(), uMoon: { value: new T.Vector3(-.34, .55, -.76).normalize() }, uGlow: { value: 1 }, uSunV: { value: 1 }, uMoonI: { value: 0 }, uStars: { value: 0 }, uCover: { value: .5 }, uTime: { value: 0 } } });
const dome = new T.Mesh(new T.SphereGeometry(80, 40, 24), skyM); dome.renderOrder = -20; dome.frustumCulled = false; dome.visible = false; scene.add(dome); pano.mesh = dome;

function apply(t) {
  const u = skyM.uniforms, C = T.SRGBColorSpace;
  u.uTop.value.set(cs.top[0], cs.top[1], cs.top[2]); u.uMid.value.set(cs.mid[0], cs.mid[1], cs.mid[2]); u.uHor.value.set(cs.hor[0], cs.hor[1], cs.hor[2]); u.uGnd.value.set(cs.gnd[0], cs.gnd[1], cs.gnd[2]);
  u.uSunCol.value.set(cs.sunCol[0], cs.sunCol[1], cs.sunCol[2]); u.uCloud.value.set(cs.cloud[0], cs.cloud[1], cs.cloud[2]); u.uSun.value.set(cs.sun[0], cs.sun[1], cs.sun[2]).normalize();
  u.uGlow.value = cs.glow; u.uSunV.value = clamp01(cs.sunV); u.uMoonI.value = clamp01(cs.moonI); u.uStars.value = clamp01(cs.stars); u.uCover.value = cs.cover; u.uTime.value = t * 0.001;
  pano.fog.setRGB(cs.hor[0], cs.hor[1], cs.hor[2], C);
  cfg.hemiC.setRGB(cs.hemiC[0], cs.hemiC[1], cs.hemiC[2], C); cfg.hemiG.setRGB(cs.hemiG[0], cs.hemiG[1], cs.hemiG[2], C); cfg.sunLC.setRGB(cs.sunLC[0], cs.sunLC[1], cs.sunLC[2], C);
  cfg.lightPos.set(cs.light[0], cs.light[1], cs.light[2]).normalize().multiplyScalar(10); cfg.hemiI = cs.hemiI; cfg.sunI = cs.sunI; cfg.dark = clamp01(cs.dark);
}
function lerpState(k) { for (const key in tgt) { if (key === 'n') continue; const a = cs[key], b = tgt[key]; if (Array.isArray(a)) for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * k; else cs[key] += (b - a) * k; } }
sky.snap = () => { const c = cp(tgt); for (const key in c) cs[key] = c[key]; apply(performance.now()); };
sky.set = (id, instant, toast) => { if (!TOD[id]) return; todId = id; tgt = TOD[id]; S.tod = id; S.night = id === 'night'; VR.save(); if (instant) sky.snap(); if (toast) { try { VR.ui.toast('Horário: ' + TOD[id].n, 1800); } catch (e) {} } };
sky.next = () => sky.set(ORDER[(ORDER.indexOf(todId) + 1) % ORDER.length], false, true);
apply(0); VR.env && VR.env.refresh();

// ====================================================== MUNDO ======================================================
const rnd = H.rnd;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; };
const mkTex = (c, rx, ry) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; };
const lmDSc = {}, lmDS = c => lmDSc[c] || (lmDSc[c] = new T.MeshLambertMaterial({ color: c, side: T.DoubleSide }));

const WIN_A = new T.MeshBasicMaterial({ color: 0x6b8499 }), WIN_B = new T.MeshBasicMaterial({ color: 0x6b8499 });     // janelas dos vizinhos: acendem à noite
const LAMP_M = new T.MeshBasicMaterial({ color: 0x9aa0a6 });
const glowC = (() => { const k = cv(128, 128), g = k.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return k.c; })();
const GLOW_M = new T.SpriteMaterial({ map: new T.CanvasTexture(glowC), color: 0xffd9a0, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 });
const POOL_M = new T.MeshBasicMaterial({ map: new T.CanvasTexture(glowC), color: 0xffcf8a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
const mail = { door: { v: 0, t: 0 }, flag: { v: 0, t: 0 } };
const fog = new T.Fog(0x8899aa, 85, 250);

out.build = parent => {
  if (out.built) return; out.built = true;
  const grp = out.group = new T.Group(); parent.add(grp);
  const B = H.Batch(), lm = H.lm, WHT = H.WHT, gable = H.gable, ob = H.ob;
  const CONC = lm(0xbdbab2), BRK = lm(0x8c4a3a), BRK2 = lm(0x8c8479), TRUNK = lm(0x5b4129), LEAF1 = lm(0x4f8f3a), LEAF2 = lm(0x3e7a2f), LEAF3 = lm(0x5e9d43), BUSH = lm(0x2f6b2e), BUSH2 = lm(0x3d7d36), GLASS = lm(0x1b2631), TIRE = lm(0x15171a), DARK = lm(0x30343a), YEL = lm(0xe6b800);
  const flat = (w, d, cx, cz, y, mat) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz); grp.add(m); return m; };
  // texturas
  const grass = (() => { const k = cv(256, 256), g = k.g, r = rnd(3); g.fillStyle = '#5a9a3c'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 26; i++) { const x = r() * 256, y = r() * 256, rr = 20 + r() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, r() < .5 ? 'rgba(40,100,30,.25)' : 'rgba(130,190,80,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 2600; i++) { const x = r() * 256, y = r() * 256, l = 3 + r() * 6; g.strokeStyle = r() < .5 ? 'rgba(40,96,30,.55)' : 'rgba(120,185,80,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y - l); g.stroke(); } return k.c; })();
  const asph = (() => { const k = cv(256, 256), g = k.g, r = rnd(9); g.fillStyle = '#3b3e43'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 3200; i++) { g.fillStyle = r() < .5 ? 'rgba(20,20,22,.5)' : 'rgba(120,122,128,.35)'; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); } return k.c; })();
  const conc = (() => { const k = cv(256, 256), g = k.g, r = rnd(4); g.fillStyle = '#bdbab2'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 1500; i++) { g.fillStyle = r() < .5 ? 'rgba(90,88,80,.14)' : 'rgba(255,255,255,.12)'; g.fillRect(r() * 256, r() * 256, 2, 2); } g.fillStyle = 'rgba(70,68,62,.55)'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 0, 3, 256); return k.c; })();
  const lawnM = (w, d) => new T.MeshLambertMaterial({ map: mkTex(grass, w / 3, d / 3) });
  const concM = (w, d) => new T.MeshLambertMaterial({ map: mkTex(conc, w / 1.5, d / 1.5) });
  // chão: gramado dos dois lados, asfalto no meio, meio-fio, calçadas, caminho até a porta, entrada de carros
  flat(320, 73.5, 0, 23.25, YG, lawnM(320, 73.5)); flat(320, 136.5, 0, -91.75, YG, lawnM(320, 136.5));
  flat(182, 10, -31, -18.5, YS, new T.MeshLambertMaterial({ map: mkTex(asph, 45.5, 2.5) }));      // a rua termina no estacionamento do mercado (x = 60)
  flat(182, 0.1, -31, -18.44, YS + 0.012, lm(0xe6b800)); flat(182, 0.1, -31, -18.58, YS + 0.012, lm(0xe6b800));
  B.box(182, 0.15, 0.2, -31, YS + 0.075, -13.4, CONC); B.box(182, 0.15, 0.2, -31, YS + 0.075, -23.6, CONC);
  flat(282, 1.5, 19, -10.25, YG + 0.03, concM(282, 1.5)); flat(282, 1.5, 19, -26.75, YG + 0.03, concM(282, 1.5));
  flat(1.0, 4.8, 4.7, -7.1, YG + 0.025, concM(1.0, 4.8)); flat(3.5, 19.3, 12.45, -3.65, YG + 0.02, concM(3.5, 19.3));
  flat(5.75, 0.84, 0.075, -2.88, YG + 0.012, lm(0x4a3220)); flat(3.8, 0.84, 8.4, -2.88, YG + 0.012, lm(0x4a3220));
  [-2.2, -1.1, 1.0, 2.2, 7.0, 8.2, 9.4].forEach((x, i) => B.sph(0.42, x, YG + 0.34, -2.9, i % 2 ? BUSH : BUSH2, 1, 0.85, 1));
  [-1.6, 1.6, 7.6, 8.8].forEach((x, i) => B.sph(0.1, x, YG + 0.1, -3.2, [lm(0xe05a8a), lm(0xf2c94c), lm(0xf5f5f5), lm(0xc94c4c)][i], 1, 1, 1));
  // árvores
  const tree = (x, z, s, y) => { y = y == null ? YG : y; B.cyl(0.14 * s, 0.2 * s, 2.6 * s, x, y + 1.3 * s, z, TRUNK, 8); [[0, 3.4, 0, 1.5], [0.9, 3.0, 0.4, 1.1], [-0.8, 3.1, -0.5, 1.2], [0.2, 4.3, -0.2, 1.0], [-0.3, 3.0, 0.9, 1.0]].forEach(([a, b, c, r], i) => B.sph(r * s, x + a * s, y + b * s, z + c * s, [LEAF1, LEAF2, LEAF3][i % 3], 1, 0.9, 1)); ob('down', x - 0.35, x + 0.35, z - 0.35, z + 0.35); };
  tree(-6.5, -8.0, 1.5); tree(17, -7.5, 1.3); [-14, 1.5, 20, 34, -26, 46, -50, -62, -74, -86, -98, -110].forEach(x => tree(x, -12.3, 1.0)); [-20, -2, 18, 38, 58, -40, -52, -64, -76, -88, -100, -112].forEach(x => tree(x, -24.9, 1.0));
  for (let i = -8; i <= 11; i++) { const x = i * 14 + ((i * 37) % 7); B.sph(3.4, x, YG + 3.6, -72 - (i * 5) % 9, i % 2 ? LEAF2 : LEAF1, 1, 0.8, 1); B.sph(3.4, x + 7, YG + 3.2, 38 + (i * 3) % 7, i % 2 ? LEAF1 : LEAF3, 1, 0.8, 1); }
  // postes de luz (acendem de noite), poste de energia com fios, hidrante
  const lampPost = (x, z, dz) => { B.cyl(0.07, 0.09, 6.2, x, YG + 3.1, z, DARK, 8); B.box(0.07, 0.07, 1.6, x, YG + 6.15, z + dz * 0.8, DARK); B.box(0.5, 0.12, 0.26, x, YG + 6.12, z + dz * 1.6, DARK); B.add(B.xf(new T.BoxGeometry(0.4, 0.04, 0.2), x, YG + 6.04, z + dz * 1.6), LAMP_M);
    const sp = new T.Sprite(GLOW_M); sp.scale.set(4, 4, 1); sp.position.set(x, YG + 5.9, z + dz * 1.6); grp.add(sp); const pl = flat(8, 8, x, z + dz * 3.2, YS + 0.02, POOL_M); pl.renderOrder = 2; ob('down', x - 0.25, x + 0.25, z - 0.25, z + 0.25); };
  [-9, 15, 39, -33, -57, -81, -105].forEach(x => lampPost(x, -12.4, -1)); [-21, 3, 27, 51, -45, -69, -93, -117].forEach(x => lampPost(x, -24.8, 1));
  [[-14, -25.4], [36, -25.4], [-64, -25.4], [-114, -25.4]].forEach(([x, z]) => { B.box(0.22, 9.2, 0.22, x, YG + 4.6, z, lm(0x5b4a38)); B.box(2.4, 0.12, 0.12, x, YG + 8.6, z, lm(0x5b4a38)); B.box(1.2, 0.1, 0.1, x, YG + 7.7, z, lm(0x5b4a38)); ob('down', x - 0.3, x + 0.3, z - 0.3, z + 0.3); });
  [[-14, 36], [-64, -14], [-114, -64]].forEach(([a, b]) => { const pts = []; [-0.9, 0, 0.9].forEach(dx => { for (let i = 0; i < 24; i++) { const t0 = i / 24, t1 = (i + 1) / 24, f = t => YG + 8.55 - 1.4 * (1 - Math.pow(2 * t - 1, 2)); pts.push(a + (b - a) * t0 + dx, f(t0), -25.4, a + (b - a) * t1 + dx, f(t1), -25.4); } });
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); grp.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x1b1b1b }))); });
  B.cyl(0.11, 0.11, 0.5, 8.6, YG + 0.3, -12.5, lm(0xc0392b), 10); B.cyl(0.14, 0.14, 0.06, 8.6, YG + 0.58, -12.5, lm(0xc0392b), 10); B.sph(0.1, 8.6, YG + 0.6, -12.5, lm(0xc0392b), 1, 1, 1); B.box(0.34, 0.08, 0.08, 8.6, YG + 0.4, -12.5, lm(0xc0392b)); ob('down', 8.3, 8.9, -12.8, -12.2);
  // CAIXA DE CORREIO na calçada (porta abre, bandeirinha levanta)
  { const mx = 5.9, mz = -12.6, my = YG + 1.1, mm = new T.MeshLambertMaterial({ color: 0x2f3338, side: T.DoubleSide });
    B.box(0.1, 1.1, 0.1, mx, YG + 0.55, mz, WHT); B.box(0.1, 0.06, 0.34, mx, YG + 1.04, mz, WHT);
    const mg = new T.CylinderGeometry(0.11, 0.11, 0.5, 16, 1, false, 0, Math.PI); mg.rotateX(Math.PI / 2); mg.rotateZ(Math.PI / 2); mg.translate(mx, my, mz); B.add(mg, mm); B.box(0.22, 0.02, 0.5, mx, my - 0.01, mz, lm(0x2f3338));
    const dm = new T.Mesh(new T.CircleGeometry(0.11, 16, 0, Math.PI), new T.MeshLambertMaterial({ color: 0x3a3f45, side: T.DoubleSide })), dp = new T.Group(); dp.position.set(mx, my, mz - 0.25); dp.add(dm); grp.add(dp);
    const fm = new T.Mesh(new T.BoxGeometry(0.015, 0.15, 0.07), new T.MeshLambertMaterial({ color: 0xc8272d })), fp = new T.Group(); fm.position.set(0, 0.075, 0); fp.position.set(mx + 0.12, my + 0.02, mz + 0.05); fp.add(fm); grp.add(fp);
    { const k = cv(128, 48), g = k.g; g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 48); g.fillStyle = '#111'; g.font = '700 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1427', 64, 26); const pm = new T.Mesh(new T.PlaneGeometry(0.2, 0.075), new T.MeshBasicMaterial({ map: new T.CanvasTexture(k.c) })); pm.position.set(mx + 0.114, my + 0.06, mz); pm.rotation.y = Math.PI / 2; grp.add(pm); }
    const sf = (f, d) => { try { VR.ui.sfx(f, d); } catch (e) {} };
    H.inter([dm], () => { mail.door.t = mail.door.t ? 0 : 1; sf(mail.door.t ? 300 : 240, 0.1); }, ['lawn', 'steps']); H.inter([fm], () => { mail.flag.t = mail.flag.t ? 0 : 1; sf(520, 0.06); }, ['lawn', 'steps']);
    out._mail = { dp, fp }; ob('down', mx - 0.3, mx + 0.3, mz - 0.3, mz + 0.3); }
  // modelo de carro (sem nenhum carro colocado no jogo: removidos a pedido)
  const car = (x, y, z, ry, col, BB) => { (BB || B).at(x, y, z, ry, b => { const cm = lm(col); b.box(4.5, 0.6, 1.85, 0, 0.62, 0, cm); b.box(2.5, 0.55, 1.65, -0.2, 1.17, 0, GLASS); b.box(2.2, 0.06, 1.7, -0.2, 1.47, 0, cm); b.box(1.2, 0.08, 1.8, 1.6, 0.94, 0, cm);
    [[1.4, 0.88], [1.4, -0.88], [-1.4, 0.88], [-1.4, -0.88]].forEach(([a, c]) => b.cyl(0.33, 0.33, 0.22, a, 0.33, c, TIRE, 14, Math.PI / 2)); b.box(0.06, 0.14, 0.4, 2.26, 0.75, 0.6, lm(0xfff2c0)); b.box(0.06, 0.14, 0.4, 2.26, 0.75, -0.6, lm(0xfff2c0)); b.box(0.06, 0.14, 0.4, -2.26, 0.75, 0.6, lm(0xb01818)); b.box(0.06, 0.14, 0.4, -2.26, 0.75, -0.6, lm(0xb01818)); }); };
  out.car = car;
  // aro de basquete na entrada de carros
  B.cyl(0.06, 0.06, 3.1, 14.5, YG + 1.55, -4.2, DARK, 8); B.box(1.0, 0.65, 0.04, 14.5, YG + 3.0, -4.55, WHT); B.box(0.5, 0.03, 0.5, 14.5, YG + 2.85, -4.8, lm(0xe0602a)); B.box(0.04, 0.04, 0.4, 14.5, YG + 3.0, -4.35, DARK); ob('down', 14.2, 14.8, -4.5, -3.9);
  // vizinhança: casas ao lado (viradas para a rua) e do outro lado da rua
  const NGLASS = new T.MeshLambertMaterial({ color: 0xaed9ee, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
  const INW = lm(0xeee6d6), FLM = lm(0xb58b5b), CEIM = lm(0xf4f1ea), RUG = lm(0x8a4b3d), SOFA = lm(0x5b6f8a), WD = lm(0x8a5a33), TVM = lm(0x15171a), BEDM = lm(0xdfe6ef), PIL = lm(0xffffff), CTR = lm(0xe9e3d6), FRIDGE = lm(0xdfe3e6);
  const GH = 2.8, FL = 0.15, FLY = YG + FL + 0.02;
  // parede com vãos (eixo x ou z); mIn = lado de dentro, mOut = lado de fora, so = +1 se o lado de fora é o +; ops = vãos [{c,w,y0,y1}]
  const nw = (b, ax, c, a0, a1, y0, y1, mIn, mOut, so, ops) => { ops = (ops || []).slice().sort((p, q) => p.c - q.c);
    const seg = (s0, s1, ya, yb) => { if (s1 - s0 < 0.004 || yb - ya < 0.004) return; const L = s1 - s0, m = (s0 + s1) / 2, h = yb - ya, ym = (ya + yb) / 2;
      if (ax === 'x') { b.box(L, h, 0.05, m, ym, c + so * 0.035, mOut); b.box(L, h, 0.07, m, ym, c - so * 0.025, mIn); } else { b.box(0.05, h, L, c + so * 0.035, ym, m, mOut); b.box(0.07, h, L, c - so * 0.025, ym, m, mIn); } };
    let p = a0; ops.forEach(o => { const s0 = o.c - o.w / 2, s1 = o.c + o.w / 2; seg(p, s0, y0, y1); seg(s0, s1, y0, o.y0); if (o.y1 < y1) seg(s0, s1, o.y1, y1); p = s1; }); seg(p, a1, y0, y1); };
  let nbN = 0;
  const nb = (cx, zf, face, w, d, floors, wallC, roofC, garage, seed) => {
    const id = nbN++, room = 'nb' + id, pk = room + 'p', bh = floors === 2 ? 5.0 : GH, wm = lm(wallC), wds = lmDS(wallC), rm = lm(roofC), sh = lm([0x23364d, 0x2f4f3a, 0x5b2a2a, 0x222222][seed % 4]), dcol = [0x8f1d22, 0x2b4a6f, 0x3d6b4a, 0x7a4b2a][seed % 4];
    const gx = garage * (w / 2 - 2.0), drx = garage ? -garage * (w / 2 - 2.0) * 0.8 : 0, pgx = w * 0.3 * (seed % 2 ? 1 : -1), Wd = (lx, lz) => face > 0 ? [cx + lx, zf + lz] : [cx - lx, zf - lz];
    const rect = (x0, x1, z0, z1) => { const a = Wd(x0, z0), c = Wd(x1, z1); ob('down', Math.min(a[0], c[0]), Math.max(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[1], c[1])); };
    const dist = (x, g) => Math.abs(x - drx) > 1.6 && (!garage || Math.abs(x - gx) > 2.5);
    const wxs = [-w * 0.36, -w * 0.2, w * 0.2, w * 0.36].filter(x => dist(x) && Math.abs(x) < w / 2 - 0.9);
    const wops = wxs.map(x => ({ c: x, w: 1.0, y0: 1.15, y1: 2.35 }));
    B.at(cx, YG, zf, face > 0 ? 0 : Math.PI, b => {
      b.box(w + 0.1, FL, d + 0.1, 0, FL / 2, d / 2, BRK2);                                                                   // base
      b.box(w - 0.2, 0.04, d - 0.2, 0, FL, d / 2, FLM); b.box(w - 0.2, 0.06, d - 0.2, 0, GH - 0.03, d / 2, CEIM);              // piso e forro
      nw(b, 'x', 0.06, -w / 2, w / 2, FL, GH, INW, wm, -1, wops.concat([{ c: drx, w: 1.0, y0: FL + 0.02, y1: FL + 2.12 }]));    // frente (porta + janelas)
      nw(b, 'x', d - 0.06, -w / 2, w / 2, FL, GH, INW, wm, 1, [{ c: 0, w: 1.4, y0: 1.15, y1: 2.35 }]);                         // fundos
      nw(b, 'z', -w / 2 + 0.06, 0, d, FL, GH, INW, wm, -1); nw(b, 'z', w / 2 - 0.06, 0, d, FL, GH, INW, wm, 1);                // laterais
      nw(b, 'x', d * 0.5, -w / 2 + 0.12, w / 2 - 0.12, FL, GH, INW, INW, 1, [{ c: pgx, w: 1.3, y0: FL + 0.02, y1: FL + 2.12 }]);   // divisória com porta aberta
      if (floors === 2) b.box(w, bh - GH, d, 0, (GH + bh) / 2, d / 2, wm);                                                      // andar de cima (maciço, só visual)
      gable(b, { x: 0, z: d / 2, y0: bh, rise: d * 0.22, W: d, L: w, ovF: 0.5, ovB: 0.5, e0: 0.4, e1: 0.4, roof: rm, wall: wds });
      const frame = (x, y, ww, hh) => { b.box(ww + 0.16, 0.08, 0.04, x, y + hh / 2 + 0.04, -0.02, WHT); b.box(ww + 0.16, 0.08, 0.04, x, y - hh / 2 - 0.04, -0.02, WHT); b.box(0.08, hh, 0.04, x - ww / 2 - 0.04, y, -0.02, WHT); b.box(0.08, hh, 0.04, x + ww / 2 + 0.04, y, -0.02, WHT); };
      wxs.forEach(x => { frame(x, 1.75, 1.0, 1.2); b.box(1.0, 1.2, 0.02, x, 1.75, 0.07, NGLASS); [-1, 1].forEach(sg => b.box(0.3, 1.2, 0.04, x + sg * 0.74, 1.75, -0.03, sh)); });
      b.box(0.08, 2.2, 0.04, drx - 0.54, FL + 1.12, -0.02, WHT); b.box(0.08, 2.2, 0.04, drx + 0.54, FL + 1.12, -0.02, WHT); b.box(1.2, 0.08, 0.04, drx, FL + 2.2, -0.02, WHT);
      b.box(1.8, FL + 0.02, 1.0, drx, (FL + 0.02) / 2, -0.5, CONC); b.box(2.3, 0.1, 1.2, drx, 2.65, -0.6, rm); b.box(0.1, 2.5, 0.1, drx - 0.95, 1.42, -1.0, WHT); b.box(0.1, 2.5, 0.1, drx + 0.95, 1.42, -1.0, WHT);
      if (garage) { b.box(3.2, 2.2, 0.06, gx, 1.3, -0.03, lm(0xe9e6df)); [0.5, 1.0, 1.5, 2.0].forEach(y => b.box(3.2, 0.03, 0.07, gx, 0.3 + y * 0.9, -0.04, lm(0xbab6ad))); }
      if (floors === 2) [-w * 0.3, 0, w * 0.3].forEach(x => { const lit = ((Math.floor(x * 10) + seed) % 3) === 0; b.box(1.08, 1.28, 0.04, x, 3.9, -0.02, WHT); b.box(0.9, 1.2, 0.05, x, 3.9, -0.035, lit ? WIN_A : WIN_B); [-1, 1].forEach(sg => b.box(0.3, 1.2, 0.04, x + sg * 0.74, 3.9, -0.03, sh)); });
      b.box(0.7, bh + d * 0.22 + 0.6, 0.9, w / 2 + 0.3, (bh + d * 0.22 + 0.6) / 2, d / 2, BRK);                                  // chaminé por fora da parede
      [-w * 0.4, -w * 0.18, w * 0.18, w * 0.4].forEach((x, i) => { if (Math.abs(x - drx) > 1.3 && (!garage || Math.abs(x - gx) > 2.2)) b.sph(0.4, x, 0.55, -0.7, i % 2 ? BUSH : BUSH2, 1, 0.85, 1); });
      // móveis simples: sala na frente; quarto (seed ímpar) ou cozinha/jantar atrás
      const y = FL + 0.02;
      b.box(2.6, 0.01, 1.8, -w * 0.05, y + 0.005, d * 0.25, RUG);
      b.box(0.9, 0.45, 2.0, -w * 0.18, y + 0.225, d * 0.25, SOFA); b.box(0.2, 0.5, 2.0, -w * 0.18 - 0.5, y + 0.6, d * 0.25, SOFA); b.box(0.6, 0.4, 1.1, w * 0.08, y + 0.2, d * 0.25, WD);
      b.box(0.4, 0.5, 1.5, w / 2 - 0.35, y + 0.25, d * 0.25, WD); b.box(0.08, 0.7, 1.2, w / 2 - 0.2, y + 1.1, d * 0.25, TVM);
      if (seed % 2) { b.box(2.0, 0.45, 1.6, -w * 0.28, y + 0.225, d * 0.8, BEDM); b.box(0.1, 0.9, 1.7, -w * 0.28 - 1.0, y + 0.45, d * 0.8, WD); b.box(0.4, 0.12, 0.6, -w * 0.28 - 0.7, y + 0.51, d * 0.8, PIL); b.box(0.5, 0.5, 0.5, -w * 0.28 - 0.4, y + 0.25, d * 0.8 + 1.0, WD); b.box(1.6, 2.0, 0.5, w * 0.12, y + 1.0, d - 0.45, WD); }
      else { b.box(3.0, 0.9, 0.6, -w * 0.25, y + 0.45, d - 0.45, CTR); b.box(0.8, 1.8, 0.7, w * 0.3, y + 0.9, d - 0.45, FRIDGE); b.box(1.4, 0.75, 0.9, -w * 0.05, y + 0.375, d * 0.74, WD); b.box(0.4, 0.45, 0.4, -w * 0.05 - 1.0, y + 0.225, d * 0.74, WD); b.box(0.4, 0.45, 0.4, -w * 0.05 + 1.0, y + 0.225, d * 0.74, WD); }
    });
    // física/colisão no mundo: móveis e divisória
    rect(-w * 0.18 - 0.7, -w * 0.18 + 0.5, d * 0.25 - 1.1, d * 0.25 + 1.1); rect(w / 2 - 0.55, w / 2, d * 0.25 - 0.8, d * 0.25 + 0.8); rect(w * 0.08 - 0.35, w * 0.08 + 0.35, d * 0.25 - 0.6, d * 0.25 + 0.6);
    if (seed % 2) { rect(-w * 0.28 - 1.1, -w * 0.28 + 1.0, d * 0.8 - 0.9, d * 0.8 + 0.9); rect(w * 0.12 - 0.8, w * 0.12 + 0.8, d - 0.7, d - 0.1); } else { rect(-w * 0.25 - 1.5, -w * 0.25 + 1.5, d - 0.8, d - 0.1); rect(w * 0.3 - 0.4, w * 0.3 + 0.4, d - 0.85, d - 0.1); rect(-w * 0.05 - 0.9, -w * 0.05 + 0.9, d * 0.74 - 0.55, d * 0.74 + 0.55); }
    rect(-w / 2 + 0.12, pgx - 0.65, d * 0.5 - 0.06, d * 0.5 + 0.06); rect(pgx + 0.65, w / 2 - 0.12, d * 0.5 - 0.06, d * 0.5 + 0.06);
    // zonas: interior, passagem da porta (só com a porta aberta), abertura automática; luz do teto acende à noite
    const i0 = Wd(-w / 2 + 0.25, 0.3), i1 = Wd(w / 2 - 0.25, d - 0.3), dw = Wd(drx, 0.06);
    H.ZY[room] = FLY; H.ZY[pk] = FLY; H.AMB[room] = 0.95; H.AMB[pk] = 1;
    H.zn(room, 'down', Math.min(i0[0], i1[0]), Math.max(i0[0], i1[0]), Math.min(i0[1], i1[1]), Math.max(i0[1], i1[1]));
    H.zn(pk, 'down', dw[0] - 0.45, dw[0] + 0.45, dw[1] - 0.5, dw[1] + 0.5, () => H.doors[pk] && H.doors[pk].v > 0.35);
    H.doors[pk] = H.mkDoor(grp, { ax: 'x', c: dw[1], a: dw[0], w: 1.0, h: 2.1, y0: FLY, hinge: face > 0 ? 1 : -1, ang: -1.75, col: dcol, zones: [room, pk, 'lawn', 'lawn2'] });
    H.NEAR.push({ d: pk, lvl: 'down', x0: dw[0] - 0.7, x1: dw[0] + 0.7, z0: face > 0 ? dw[1] - 1.3 : dw[1] - 0.5, z1: face > 0 ? dw[1] + 0.5 : dw[1] + 1.3 });
    { const lm2 = H.own(0xfff6dd), lp = Wd(0, d * 0.3), ls = new T.Mesh(new T.SphereGeometry(0.14, 12, 9), lm2); ls.position.set(lp[0], YG + GH - 0.3, lp[1]); grp.add(ls);
      H.light({ p: [lp[0], YG + GH - 0.5, lp[1]], auto: () => cfg.dark > 0.35 && (seed % 3) !== 0, zones: [room, pk], k: 0.75, dist: 8, decay: 1.2, col: 0xffe2b0, emis: [{ m: lm2, c: 0xffe9b0 }] }); }
    if (garage) { const wx = cx + (face > 0 ? gx : -gx); flat(3.4, face > 0 ? Math.abs(zf + 13.3) : Math.abs(zf + 23.9), wx, face > 0 ? (zf - 13.3) / 2 : (zf - 23.9) / 2, YG + 0.02, concM(3.4, 10)); }
  };
  [[-17, -2.4, 1, 12, 9, 2, 0xe9e2d0, 0x4a4f58, 1, 1], [27, -2.4, 1, 12.5, 9.5, 2, 0xc9d3bf, 0x5a4a44, -1, 2], [-39, -2.4, 1, 11, 8.5, 1, 0xf0ddb0, 0x6b5444, 1, 3], [49, -2.4, 1, 12, 9, 2, 0xd8d8d8, 0x3c3f46, -1, 4]].forEach(a => nb.apply(null, a));
  [[-30, -37, -1, 11, 9, 2, 0xf2f2ee, 0x4a4f58, 1, 5], [-9, -37, -1, 12, 8.5, 1, 0x8fa3b8, 0x3c3f46, -1, 6], [14, -37, -1, 12, 9, 2, 0xd9c7a3, 0x5b4a44, 1, 7], [37, -37, -1, 11.5, 9, 1, 0xa4543f, 0x3f3f44, -1, 8], [60, -37, -1, 12, 9, 2, 0xb9cfa8, 0x4a4f58, 1, 9]].forEach(a => nb.apply(null, a));
  [[-62, -2.4, 1, 12, 9, 2, 0xd9c7a3, 0x4a4f58, 1, 10], [-85, -2.4, 1, 11.5, 9, 1, 0xb9cfa8, 0x5b4a44, -1, 11], [-108, -2.4, 1, 12, 9, 2, 0xf0ddb0, 0x3c3f46, 1, 12]].forEach(a => nb.apply(null, a));
  [[-53, -37, -1, 12, 9, 1, 0xc9d3bf, 0x4a4f58, -1, 13], [-76, -37, -1, 11.5, 9, 2, 0xe9e2d0, 0x5a4a44, 1, 14], [-99, -37, -1, 12, 9, 2, 0x8fa3b8, 0x3c3f46, -1, 15]].forEach(a => nb.apply(null, a));
  [-30, 20, 5, 41].forEach(x => tree(x, -30, 1.4)); [-22, 38].forEach(x => tree(x, -7, 1.3));
  B.flush(grp);
  // física do gramado (objetos jogados para fora caem no chão)
  try { P.staticBox(-30, YG - 0.5, -10, 180, 0.5, 70); } catch (e) {}
};

// zonas por onde se anda (os degraus e o porch ficam em house.js)
H.ZY.lawn = YG; H.ZY.lawn2 = YG; H.ZY.street = YS;
H.zn('lawn', 'down', -122, 60, -13.5, -2.5); H.zn('street', 'down', -122, 60, -23.5, -13.5); H.zn('lawn2', 'down', -122, 60, -36.5, -23.5);

// ====================================================== ATUALIZAÇÃO ======================================================
VR.hook(52, (dt, t) => {
  lerpState(damp(1.6, dt)); apply(t);
  const G = H.group, inHouse = !!(G && G.visible && H.active);
  if (inHouse) { scene.fog = fog; fog.color.copy(pano.fog); } else if (scene.fog === fog) scene.fog = null;
  if (!out.built) return;
  const d = cfg.dark, on = clamp01((d - 0.35) * 3), lit = clamp01((d - 0.3) * 2), C = T.SRGBColorSpace;
  LAMP_M.color.setRGB(0.6 + 0.4 * on, 0.62 + 0.3 * on, 0.65 + 0.05 * on, C); GLOW_M.opacity = on * 0.9; POOL_M.opacity = on * 0.55;
  WIN_A.color.setRGB(0.42 + 0.58 * lit, 0.52 + 0.32 * lit, 0.62 - 0.07 * lit, C); WIN_B.color.setRGB(0.42 - 0.34 * d, 0.52 - 0.42 * d, 0.62 - 0.48 * d, C);
  const m = out._mail; if (m) { const k = damp(6, dt); mail.door.v += (mail.door.t - mail.door.v) * k; mail.flag.v += (mail.flag.t - mail.flag.v) * k; m.dp.rotation.x = -mail.door.v * 1.5; m.fp.rotation.z = -1.45 * (1 - mail.flag.v); }
});
})();
