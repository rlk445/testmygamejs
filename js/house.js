/* Casa: corredor, escada, banheiro (andar de cima) + sala, sala de jantar, cozinha e varanda (térreo). Expansão do quarto (room.js). */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, P = VR.phys, damp = VR.damp, clamp = VR.clamp, PL = VR.PL;
const house = VR.house = { ints: [], cur: { lvl: 'up', room: 'bed' }, active: false, y: 0, a: 1, roomF: 1, group: null }, cur = house.cur;
// FY: chão do térreo. Escada: 15 degraus (14 pisos de 22 cm), desce no sentido +x, de x=3,0 até x=6,08. Pé direito: 2,7 m nos dois andares.
const FY = -2.9, H = 2.7, RISE = 2.9 / 15, TREAD = 0.22, XS0 = 3.0, XS1 = XS0 + 14 * TREAD, YG = FY - 0.36;   // YG: nível do gramado (o porch fica 36 cm acima, com 2 degraus)
house.FY = FY; house.YG = YG;
const sfx = (f, d, v) => { try { VR.ui.sfx(f, d, v); } catch (e) {} };
const toast = m => { try { VR.ui.toast(m, 2500); } catch (e) {} };

// ---------- materiais, texturas e utilidades ----------
const mc = {}, lm = c => mc[c] || (mc[c] = new T.MeshLambertMaterial({ color: c }));          // material compartilhado (entra no merge)
const own = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));         // material próprio (peças animadas/clicáveis)
const glassM = () => own(0xaed9ee, { transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
function cvs(w, h, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return { c, g: c.getContext('2d'), t }; }
function rnd(s) { s = s | 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 4294967296; }; }
const plank = (tones, rep) => { const k = cvs(512, 512, rep), g = k.g; for (let i = 0; i < 8; i++) { g.fillStyle = tones[i % tones.length]; g.fillRect(0, i * 64, 512, 64); g.fillStyle = 'rgba(60,35,15,.5)'; g.fillRect(0, i * 64, 512, 2); const o = (i * 173) % 512; g.fillRect(o, i * 64, 2, 64); g.fillStyle = 'rgba(255,255,255,.05)'; for (let n = 0; n < 9; n++) g.fillRect((n * 97 + i * 31) % 512, i * 64 + 10 + (n * 13) % 44, 70, 2); } return k.t; };
const tiles = (c1, c2, gr, rep) => { const k = cvs(256, 256, rep), g = k.g; g.fillStyle = gr; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? c1 : c2; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(i * 128 + 3, j * 128 + 3, 122, 46); } return k.t; };
const streak = () => { const k = cvs(32, 128, [1, 1]), g = k.g, r = rnd(7); for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.35 + r() * 0.5).toFixed(2) + ')'; g.fillRect(r() * 30, r() * 128, 1.5 + r() * 2, 20 + r() * 60); } return k.t; };
function fl(par, x0, x1, z0, z1, y, mk, u) { const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), new T.MeshLambertMaterial({ map: mk([(x1 - x0) / u, (z1 - z0) / u]) })); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); par.add(m); return m; }
function cl(par, x0, x1, z0, z1, y, mat) { const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), mat); m.rotation.x = Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); par.add(m); return m; }
function vplane(par, w, h, x, y, z, ry, mat) { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; par.add(m); return m; }   // plano vertical (azulejo, espelho, quadro): normal local +z

// ---------- lote de geometria: junta tudo por material (poucas chamadas de desenho) ----------
function merge(gs) {
  let nv = 0, ni = 0; gs.forEach(g => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let vo = 0, io = 0;
  gs.forEach(g => { const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv; pos.set(p.array, vo * 3); nor.set(n.array, vo * 3); uv.set(u.array, vo * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; } else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count; g.dispose(); });
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); m.setIndex(new T.BufferAttribute(idx, 1)); return m;
}
function Batch() {
  const map = new Map(); let fr = null;
  const B = {
    add(g, mat) { let a = map.get(mat); if (!a) map.set(mat, a = []); a.push(g); },
    xf(g, x, y, z, ry, rx, rz) { if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z); if (fr) { g.rotateY(fr.ry); g.translate(fr.x, fr.y, fr.z); } return g; },
    box(w, h, d, x, y, z, mat, ry, rx, rz) { B.add(B.xf(new T.BoxGeometry(w, h, d), x, y, z, ry, rx, rz), mat); },
    cyl(r0, r1, h, x, y, z, mat, seg, rx, rz) { B.add(B.xf(new T.CylinderGeometry(r0, r1, h, seg || 14), x, y, z, 0, rx, rz), mat); },
    sph(r, x, y, z, mat, sx, sy, sz) { const g = new T.SphereGeometry(r, 12, 9); if (sx) g.scale(sx, sy, sz); B.add(B.xf(g, x, y, z), mat); },
    col(w, h, d, x, y, z) { const f = fr || { x: 0, y: 0, z: 0, ry: 0 }, c = Math.cos(f.ry), s = Math.sin(f.ry); return P.staticBox(f.x + x * c + z * s, f.y + y, f.z - x * s + z * c, w / 2, h / 2, d / 2, f.ry); },
    at(x, y, z, ry, fn) { const o = fr; fr = { x, y, z, ry: ry || 0 }; fn(B); fr = o; },
    flush(par) { map.forEach((gs, mat) => par.add(new T.Mesh(merge(gs), mat))); map.clear(); }
  };
  return B;
}
const bx = (B, ax, a, p, da, h, dp, y, mat) => ax === 'x' ? B.box(da, h, dp, a, y, p, mat) : B.box(dp, h, da, p, y, a, mat);   // caixa alinhada à parede: a = ao longo, p = perpendicular

// UV em metros no mundo (a textura de madeira/tijolo continua entre peças e não estica)
const worldUV = (g, ox, oy, oz) => { const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz, fx = Math.abs(n.getX(i)) > 0.5, fz = Math.abs(n.getZ(i)) > 0.5; uv.setXY(i, fx ? z : x, (fx || fz) ? y : z); } return g; };
const wbox = (B, w, h, d, x, y, z, mat) => B.add(B.xf(worldUV(new T.BoxGeometry(w, h, d), x, y, z), x, y, z), mat);
const bm = (B, w, h, d, x, y, z, mat) => mat.userData.wuv ? wbox(B, w, h, d, x, y, z, mat) : B.box(w, h, d, x, y, z, mat);
function tri(B, mat, p0, p1, p2, n, uvs) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([].concat(p0, p1, p2), 3)); g.setAttribute('normal', new T.Float32BufferAttribute([].concat(n, n, n), 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); B.add(B.xf(g, 0, 0, 0), mat); }
// telhado de duas águas (cumeeira no eixo x local): y0 = topo da parede; W = vão (largura entre paredes); L = comprimento; rise = altura da cumeeira
function gable(B, o) {
  const y0 = o.y0, rise = o.rise, W = o.W, L = o.L, t = o.t || 0.1, ox = o.x || 0, oz = o.z || 0, oF = o.ovF == null ? 0.45 : o.ovF, oB = o.ovB == null ? 0.45 : o.ovB, e0 = o.e0 == null ? 0.35 : o.e0, e1 = o.e1 == null ? 0.35 : o.e1;
  const m = rise / (W / 2), th = Math.atan(m), cs = Math.cos(th), lift = t / cs, LL = L + e0 + e1, cx = ox + (e1 - e0) / 2;
  [[-1, oF], [1, oB]].forEach(([sg, ov]) => { const run = W / 2 + ov, Sl = run / cs, yc = y0 + lift + rise - m * run / 2 - t / (2 * cs), g = new T.BoxGeometry(LL, t, Sl), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * LL, uv.getY(i) * Sl);
    B.add(B.xf(g, cx, yc, oz + sg * run / 2, 0, sg * th), o.roof); });
  const rg = new T.BoxGeometry(LL + 0.04, 0.09, 0.2), ru = rg.attributes.uv; for (let i = 0; i < ru.count; i++) ru.setXY(i, ru.getX(i) * LL, ru.getY(i) * 0.2);
  B.add(B.xf(rg, cx, y0 + lift + rise - 0.01, oz), o.roof);
  if (o.wall) [[-1, o.c0], [1, o.c1]].forEach(([sg, on]) => { if (on === 0 || on === false) return; const x = ox + sg * L / 2;
    tri(B, o.wall, [x, y0, oz - W / 2], [x, y0, oz + W / 2], [x, y0 + rise, oz], [sg, 0, 0], [-W / 2, y0, W / 2, y0, 0, y0 + rise]); });
}

// ---------- paredes com vãos (cada lado com a sua tinta) ----------
function wall(B, ax, c, a0, a1, y0, y1, mp, mn, ops) {
  ops = (ops || []).slice().sort((p, q) => p.c - q.c);
  const seg = (s0, s1, ya, yb) => { if (s1 - s0 < 0.004 || yb - ya < 0.004) return; const L = s1 - s0, m = (s0 + s1) / 2, h = yb - ya, ym = (ya + yb) / 2;
    if (ax === 'x') { bm(B, L, h, 0.05, m, ym, c + 0.025, mp); bm(B, L, h, 0.05, m, ym, c - 0.025, mn); P.staticBox(m, ym, c, L / 2, h / 2, 0.05); }
    else { bm(B, 0.05, h, L, c + 0.025, ym, m, mp); bm(B, 0.05, h, L, c - 0.025, ym, m, mn); P.staticBox(c, ym, m, 0.05, h / 2, L / 2); } };
  let p = a0;
  ops.forEach(o => { const s0 = o.c - o.w / 2, s1 = o.c + o.w / 2; seg(p, s0, y0, y1); seg(s0, s1, y0, o.y0); if (o.y1 < y1) seg(s0, s1, o.y1, y1); p = s1; });
  seg(p, a1, y0, y1);
}
const WHT = lm(0xf5f2ec);
function win(B, ax, c, a, w, y0, y1) {                                        // moldura, divisórias e peitoril
  const h = y1 - y0, ym = (y0 + y1) / 2;
  bx(B, ax, a, c, w + 0.14, 0.06, 0.16, y1 + 0.03, WHT); bx(B, ax, a, c, w + 0.24, 0.04, 0.26, y0 - 0.02, WHT);
  bx(B, ax, a - w / 2 - 0.03, c, 0.06, h, 0.16, ym, WHT); bx(B, ax, a + w / 2 + 0.03, c, 0.06, h, 0.16, ym, WHT);
  bx(B, ax, a, c, 0.04, h, 0.05, ym, WHT); bx(B, ax, a, c, w, 0.04, 0.05, ym, WHT);
}
function trim(B, ax, c, a, w, h, y0, sides) {                                 // batente da porta
  (sides || [1, -1]).forEach(s => { const p = c + s * 0.065;
    bx(B, ax, a - w / 2 - 0.03, p, 0.06, h + 0.03, 0.03, y0 + (h + 0.03) / 2, WHT); bx(B, ax, a + w / 2 + 0.03, p, 0.06, h + 0.03, 0.03, y0 + (h + 0.03) / 2, WHT); bx(B, ax, a, p, w + 0.12, 0.06, 0.03, y0 + h + 0.03, WHT); });
}
function base(B, ax, c, a0, a1, s, y, gaps) {                                 // rodapé (gaps: vãos de porta, em ordem)
  const pts = [a0].concat([].concat.apply([], gaps || []), [a1]);
  for (let i = 0; i + 1 < pts.length; i += 2) { const s0 = pts[i], s1 = pts[i + 1]; if (s1 - s0 > 0.01) bx(B, ax, (s0 + s1) / 2, c + s * 0.012, s1 - s0, 0.1, 0.024, y + 0.05, WHT); }
}
// ---------- exterior estilo EUA: lambril (siding), tijolo, telhas de asfalto ----------
const SIDING = new T.MeshLambertMaterial({ map: (() => { const k = cvs(256, 256, [1, 1]), g = k.g; for (let i = 0; i < 5; i++) { const y = i * 51.2; g.fillStyle = '#b9c9da'; g.fillRect(0, y, 256, 52); g.fillStyle = '#cbd9e7'; g.fillRect(0, y, 256, 6); g.fillStyle = '#a2b3c6'; g.fillRect(0, y + 42, 256, 9); g.fillStyle = 'rgba(40,55,75,.45)'; g.fillRect(0, y + 50, 256, 2); } return k.t; })() });
SIDING.userData.wuv = true;
const SIDING_DS = new T.MeshLambertMaterial({ map: SIDING.map, side: T.DoubleSide }); SIDING_DS.userData.wuv = true;
const BRICK = new T.MeshLambertMaterial({ map: (() => { const k = cvs(256, 256, [1, 1]), g = k.g, r = rnd(5); g.fillStyle = '#c4bcb0'; g.fillRect(0, 0, 256, 256); for (let row = 0; row < 13; row++) { const y = row * 19.7, off = (row % 2) * 32; for (let i = -1; i < 5; i++) { const sh = 0.82 + r() * 0.32; g.fillStyle = 'rgb(' + ((150 * sh) | 0) + ',' + ((80 * sh) | 0) + ',' + ((62 * sh) | 0) + ')'; g.fillRect(i * 64 + off + 2, y + 2, 60, 16.5); } } return k.t; })() });
BRICK.userData.wuv = true;
const ROOFM = new T.MeshLambertMaterial({ map: (() => { const k = cvs(256, 256, [1, 1]), g = k.g, r = rnd(11); g.fillStyle = '#3d4047'; g.fillRect(0, 0, 256, 256); for (let row = 0; row < 8; row++) { const y = row * 32, off = (row % 2) * 32; for (let i = -1; i < 5; i++) { const sh = 0.8 + r() * 0.35; g.fillStyle = 'rgb(' + ((78 * sh) | 0) + ',' + ((81 * sh) | 0) + ',' + ((90 * sh) | 0) + ')'; g.fillRect(i * 64 + off + 1, y + 1, 62, 29); } g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, y + 29, 256, 3); } return k.t; })() });
const PAINT = { hall: lm(0xefe6d8), ext: SIDING, bath: lm(0xd3e6ea), sala: lm(0xdcd3c4), coz: lm(0xf0e2b4), jan: lm(0xe6dac8), gar: lm(0xd9d7d1) };

// ---------- interação ----------
const PASS = { pbed: ['bed', 'hall'], pbath: ['hall', 'bath'], parch: ['sala', 'jantar'], pcoz: ['jantar', 'coz'], pfront: ['jantar', 'porch'], pfoot: ['foot', 'jantar'], stairs: ['hall', 'foot'] };
const AMB = { bed: 1, pbed: 0.85, hall: 0.6, pbath: 0.55, bath: 0.5, stairs: 0.6, foot: 0.6, pfoot: 0.7, sala: 0.8, parch: 0.8, pcoz: 0.75, coz: 0.75, jantar: 0.8, pfront: 0.9, porch: 1, steps: 1 };
const ROOMF = { bed: 1, pbed: 0.9, hall: 0.3, pbath: 0.2 };                  // quanto das luzes do quarto chega no cômodo atual
const zm = zones => !zones || zones.indexOf(cur.room) >= 0 || (PASS[cur.room] && PASS[cur.room].some(r => zones.indexOf(r) >= 0));
house.skip = zones => !zm(zones);
house.amb = () => AMB[cur.room] || 1;
function inter(meshes, click, zones) {
  meshes.forEach(m => { if (m.material) m.userData.c0 = m.material.color.clone(); });
  const it = { meshes, click, zones, skip: () => !zm(zones), hover: on => { meshes.forEach(m => { if (m.material && m.userData.c0) m.material.color.copy(m.userData.c0).multiplyScalar(on ? 1.28 : 1); }); } };
  house.ints.push(it); return it;
}
const anims = [];
function sw(G, x, y, z, ry, fn, zones) { const m = new T.Mesh(new T.BoxGeometry(0.09, 0.13, 0.016), own(0xf2f2f2)); m.position.set(x, y, z); m.rotation.y = ry; G.add(m); inter([m], fn, zones); return m; }   // interruptor de parede

// ---------- som (água, descarga) ----------
const snd = (() => {
  let ctx = null, buf = null; const flows = {};
  const get = () => { if (ctx) return ctx; const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { ctx = new A(); } catch (e) { return null; } return ctx; };
  const unlock = () => { const c = get(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
  ['click', 'touchend', 'pointerup', 'keydown'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
  const mk = (hp, lp) => { const c = get(); if (!c) return null; if (c.state === 'suspended') c.resume().catch(() => {});
    if (!buf) { const n = (c.sampleRate * 1.5) | 0; buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f1 = c.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp; const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; const g = c.createGain(); g.gain.value = 0;
    s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(c.destination); s.start(); return { s, g, c }; };
  return {
    flow(name, on, room, hp, lp, vol) { let f = flows[name];
      if (on) { if (!f) { f = mk(hp, lp); if (!f) return; f.room = room; f.vol = vol; flows[name] = f; } f.g.gain.setTargetAtTime(vol, f.c.currentTime, 0.08); }
      else if (f) { f.g.gain.setTargetAtTime(0, f.c.currentTime, 0.12); const s = f.s; setTimeout(() => { try { s.stop(); } catch (e) {} }, 800); delete flows[name]; } },
    burst(dur, hp, lp, vol) { const f = mk(hp, lp); if (!f) return; const t = f.c.currentTime; f.g.gain.setValueAtTime(0.0001, t); f.g.gain.linearRampToValueAtTime(vol, t + 0.2); f.g.gain.setValueAtTime(vol, t + dur * 0.55); f.g.gain.exponentialRampToValueAtTime(0.0001, t + dur); setTimeout(() => { try { f.s.stop(); } catch (e) {} }, dur * 1000 + 200); },
    tick() { for (const n in flows) { const f = flows[n]; f.g.gain.setTargetAtTime(f.vol * (zm(f.room) ? 1 : 0.18), f.c.currentTime, 0.2); } },
    stopAll() { for (const n in flows) { const f = flows[n], s = f.s; try { s.stop(); } catch (e) {} delete flows[n]; } }
  };
})();

// ---------- luzes: poucas PointLights reaproveitadas, sempre nas fontes mais próximas ----------
const srcs = []; let pool = []; const POOL = 3;
house.initLights = root => { pool = []; for (let i = 0; i < POOL; i++) { const L = new T.PointLight(0xffffff, 0, 5, 1.3); root.add(L); pool.push({ L, src: null, f: 0, want: 0 }); } };
house.light = o => { const s = Object.assign({ v: 0, kk: 0, st: o.st !== false, dist: 5, decay: 1.3, col: 0xfff0d8, k: 0.8, emis: [], zones: null }, o); s.p = new T.Vector3(o.p[0], o.p[1], o.p[2]); srcs.push(s); return s; };
function updLights(dt) {
  const k = damp(7, dt), hd = VR.HEAD;
  srcs.forEach(s => { const on = s.auto ? s.auto() : s.st; s.kk = typeof s.k === 'function' ? s.k() : s.k; s.v += ((on ? s.kk : 0) - s.v) * k; if (!on && s.v < 0.004) s.v = 0; s.sc = s.v > 0.01 ? s.p.distanceTo(hd) + (zm(s.zones) ? 0 : 3) : 1e9; });
  const act = srcs.filter(s => s.sc < 1e9).sort((a, b) => a.sc - b.sc).slice(0, pool.length);
  pool.forEach(pl => { pl.want = pl.src && act.indexOf(pl.src) >= 0 ? 1 : 0; });
  act.forEach(s => { if (pool.some(pl => pl.src === s)) return; const f = pool.find(pl => !pl.want && pl.f < 0.03); if (f) { f.src = s; f.want = 1; f.L.position.copy(s.p); f.L.color.setHex(s.col); f.L.distance = s.dist; f.L.decay = s.decay; } });
  pool.forEach(pl => { pl.f += (pl.want - pl.f) * damp(9, dt); if (!pl.want && pl.f < 0.03) { pl.src = null; pl.f = 0; } pl.L.intensity = pl.src ? pl.src.v * pl.f : 0; });
  srcs.forEach(s => { const e = s.kk > 0 ? clamp(s.v / s.kk, 0, 1) : 0; s.emis.forEach(o => o.m.emissive.setHex(o.c).multiplyScalar(e)); });
}
house.snapLights = () => { pool.forEach(pl => { pl.src = null; pl.f = 0; }); srcs.forEach(s => { s.v = 0; }); updLights(5); updLights(5); };
const lampSt = house.lamps = {};                                                                  // interruptores compartilhados (vários interruptores/lâmpadas por chave)
const toggle = k => { lampSt[k] = !lampSt[k]; sfx(lampSt[k] ? 820 : 560, 0.06); };

// ---------- portas ----------
const D = house.doors = {};
D.bed = { get v() { return VR.room.st.door; }, get t() { return VR.room.st.door0; }, set t(x) { VR.room.st.door0 = x; }, near: false };   // a porta do quarto é do room.js
function mkDoor(G, o) {                                                           // ax: eixo da parede; c: posição da parede; a: centro do vão; hinge: lado da dobradiça (+1/-1)
  const d = { v: 0, t: 0, ang: o.ang, near: false, o };
  const hx = o.ax === 'x' ? o.a + o.hinge * o.w / 2 : o.c, hz = o.ax === 'x' ? o.c : o.a + o.hinge * o.w / 2;
  const piv = new T.Group(); piv.position.set(hx, o.y0, hz);
  const lw = o.w - 0.02, off = -o.hinge * (lw / 2 + 0.01), lh = o.h - 0.02;
  const leaf = new T.Mesh(o.ax === 'x' ? new T.BoxGeometry(lw, lh, 0.045) : new T.BoxGeometry(0.045, lh, lw), own(o.col || 0xc9a27a));
  leaf.position.set(o.ax === 'x' ? off : 0, lh / 2, o.ax === 'x' ? 0 : off); piv.add(leaf);
  if (o.knob !== false) { const kn = lm(0xc7ccd1), al = -o.hinge * (lw - 0.07);
    [-1, 1].forEach(s => { const k = new T.Mesh(new T.SphereGeometry(0.028, 10, 8), kn); k.position.set(o.ax === 'x' ? al : s * 0.045, 1.0, o.ax === 'x' ? s * 0.045 : al); piv.add(k); }); }
  G.add(piv); d.piv = piv; d.leaf = leaf;
  inter([leaf], () => { d.t = d.t ? 0 : 1; sfx(d.t ? 420 : 340, 0.12); if (o.onToggle) o.onToggle(d.t); }, o.zones);
  d.body = o.ax === 'x' ? P.staticBox(o.a, o.y0 + o.h / 2, o.c, o.w / 2, o.h / 2, 0.03) : P.staticBox(o.c, o.y0 + o.h / 2, o.a, 0.03, o.h / 2, o.w / 2);
  anims.push(dt => { d.v += (d.t - d.v) * damp(5, dt); if (Math.abs(d.t - d.v) < 0.002) d.v = d.t; piv.rotation.y = d.v * d.ang; });
  return d;
}
const NEAR = [{ d: 'bed', lvl: 'up', x0: 0.75, x1: 1.85, z0: 1.4, z1: 3.1 }, { d: 'bath', lvl: 'up', x0: -1.6, x1: -0.4, z0: 3.3, z1: 4.6 }, { d: 'front', lvl: 'down', x0: 4.05, x1: 5.35, z0: -3.3, z1: -1.3 }];
function autoOpen() {                                                              // a porta abre sozinha quando você chega perto (clique fecha/abre de novo)
  NEAR.forEach(n => { const d = D[n.d]; if (!d) return; const inn = cur.lvl === n.lvl && PL.x >= n.x0 && PL.x <= n.x1 && PL.z >= n.z0 && PL.z <= n.z1;
    if (inn && !d.near && !d.t) { d.t = 1; sfx(420, 0.12); } d.near = inn; });
}
function setBody(b, on) { b.collisionFilterGroup = on ? P.G.STATIC : 0; b.collisionFilterMask = on ? -1 : 0; }
function bodiesTick() {                                                            // porta fechada bloqueia objetos; aberta, deixa passar
  if (house.bedBody) setBody(house.bedBody, D.bed.v < 0.12);
  ['bath', 'front', 'fridge'].forEach(k => { const d = D[k]; if (d && d.body) setBody(d.body, d.v < 0.12); });
}

// ---------- onde o jogador pode andar (retângulos por andar), obstáculos e altura do chão ----------
const Z = [], OB = [];
const zn = (room, lvl, x0, x1, z0, z1, gate) => Z.push({ room, lvl, x0, x1, z0, z1, gate });
const ob = (lvl, x0, x1, z0, z1, act) => OB.push({ lvl, x0, x1, z0, z1, act });   // act (opcional): só bloqueia enquanto devolver true (portões)
const inR = (z, x, y) => x >= z.x0 && x <= z.x1 && y >= z.z0 && y <= z.z1, okZ = z => !z.gate || z.gate();
const compat = (a, b) => a === b || a === 'stairs' || b === 'stairs';
const blocked = (x, y, lvl) => OB.some(o => o.lvl === lvl && (!o.act || o.act()) && x > o.x0 - 0.18 && x < o.x1 + 0.18 && y > o.z0 - 0.18 && y < o.z1 + 0.18);
function zoneAt(x, y, lvl) { let best = null; for (const z of Z) { if (okZ(z) && inR(z, x, y) && compat(z.lvl, lvl) && !blocked(x, y, z.lvl)) { if (z.lvl === lvl) return z; if (!best) best = z; } } return best; }
function nearest(x, y, lvl) { let b = null, bd = 1e9; for (const z of Z) { if (!okZ(z) || !compat(z.lvl, lvl)) continue; const cx = clamp(x, z.x0, z.x1), cy = clamp(y, z.z0, z.z1), d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; b = { z, x: cx, y: cy }; } } return b; }
const open = k => () => D[k] && D[k].v > 0.35;
const ZY = house.ZY = { porch: FY, steps: FY - 0.18 };                         // altura do chão nos cômodos de fora (o resto vem do andar)
house.zn = zn; house.ob = ob;
// andar de cima
zn('bed', 'up', -2.0, 1.9, -1.4, 2.2); zn('pbed', 'up', 0.9, 1.7, 2.1, 2.6, open('bed'));
zn('hall', 'up', -2.3, 3.0, 2.5, 3.7); zn('pbath', 'up', -1.4, -0.6, 3.65, 4.15, open('bath')); zn('bath', 'up', -2.3, 0.3, 4.1, 5.9);
zn('stairs', 'stairs', 2.95, 6.1, 2.5, 3.7);
// térreo
zn('foot', 'down', 6.0, 6.9, 2.5, 3.7); zn('pfoot', 'down', 6.25, 6.9, 2.1, 2.6);
zn('jantar', 'down', 2.7, 6.8, -2.1, 2.25); zn('parch', 'down', 2.2, 2.8, -0.85, 0.85); zn('sala', 'down', -2.3, 2.35, -2.1, 2.2);
zn('pcoz', 'down', 6.7, 7.4, -0.5, 0.5); zn('coz', 'down', 7.3, 9.8, -2.1, 2.1);
zn('pfront', 'down', 4.25, 5.15, -2.65, -2.0, open('front')); zn('porch', 'down', 3.35, 6.05, -4.2, -2.55); zn('steps', 'down', 3.9, 5.5, -4.7, -4.2);
// móveis grandes (não dá para atravessar)
ob('up', -2.5, -1.85, 3.15, 3.8);                                                                   // aparador do corredor
ob('up', -0.85, -0.15, 5.35, 6.0); ob('up', -0.05, 0.5, 4.15, 5.1); ob('up', -2.5, -1.5, 4.95, 5.05);  // vaso, pia, chuveiro
ob('down', 0.45, 1.4, -1.15, 1.15); ob('down', -1.0, -0.4, -0.45, 0.45); ob('down', -2.5, -2.0, -1.0, 1.0); ob('down', -1.5, 0.3, 1.85, 2.3); ob('down', -2.5, -1.9, -2.3, -1.7);   // sala
ob('down', 4.0, 5.6, -1.2, 1.2); ob('down', 3.2, 5.4, 1.85, 2.3); ob('down', 6.3, 6.9, -2.3, -1.7);                                                                                    // jantar
ob('down', 7.1, 9.4, -2.3, -1.65); ob('down', 9.34, 10.0, -2.3, -1.6); ob('down', 7.95, 9.45, -0.05, 0.75);                                                                           // cozinha
ob('down', 2.95, 3.2, -4.45, -2.4); ob('down', 6.2, 6.45, -4.45, -2.4); ob('down', 2.95, 4.0, -4.45, -4.2); ob('down', 5.4, 6.45, -4.45, -4.2);   // guarda-corpo do porch (o vão do meio são os degraus)
house.zoneInfo = (x, z, lvl) => { const zz = zoneAt(x, z, lvl || 'down'); if (!zz) return null; return { room: zz.room, lvl: zz.lvl, y: ZY[zz.room] !== undefined ? ZY[zz.room] : zz.lvl === 'up' ? 0 : FY }; };   // usado pelo ZHOPPE: onde um bicho pode pisar e a altura do chão ali
house.walk = (ox, oz, nx, nz) => {
  let z = zoneAt(nx, nz, cur.lvl);
  if (!z) { z = zoneAt(nx, oz, cur.lvl); if (z) nz = oz; else { z = zoneAt(ox, nz, cur.lvl); if (z) nx = ox; else { nx = ox; nz = oz; z = zoneAt(ox, oz, cur.lvl); } } }
  if (!z) { const n = nearest(ox, oz, cur.lvl); if (n) { z = n.z; nx = n.x; nz = n.y; } }                   // preso (porta fechou em cima de você): leva ao ponto livre mais próximo
  if (z) { cur.lvl = z.lvl; cur.room = z.room; }
  return [nx, nz];
};
house.groundY = () => ZY[cur.room] !== undefined ? ZY[cur.room] : cur.lvl === 'up' ? 0 : cur.lvl === 'down' ? FY : -clamp(Math.ceil((PL.x - XS0) / TREAD), 0, 14) * RISE;   // na escada: altura do degrau sob os pés

// ---------- construção ----------
const G = new T.Group(); G.visible = false; house.group = G; VR.scene.add(G);
let built = false;
function build() {
  built = true; house.initLights(G);
  const B = Batch(), GL = glassM(), F = FY, CT = F + H;                                 // F: chão do térreo; CT: teto do térreo
  const M = { wood: lm(0x8a5a33), dwood: lm(0x4b3626), oak: lm(0xc49a6c), blk: lm(0x1d1f24), steel: lm(0xc7ccd1), dsteel: lm(0x8d949b), sofa: lm(0x5b6f8a), cush: lm(0x6d83a1), cush2: lm(0xe9c46a), cush3: lm(0xe76f51),
    leaf: lm(0x3f9a4a), leaf2: lm(0x2f7d3a), pot: lm(0xb5651d), cer: lm(0xeef2f4), cabW: lm(0xe9e3d6), cabB: lm(0x546a7a), top: lm(0x3a3a40), marble: lm(0xe6e3dc), riser: lm(0xe6dccb), tread: lm(0xb48a5c), rail: lm(0x3a2a1c),
    ceil: lm(0xf4f1ea), curt: lm(0xb98560), fab: lm(0x8e9aa8), red: lm(0xc0392b), grn: lm(0x2e8b57), blu: lm(0x2980b9), yel: lm(0xf1c40f) };
  const WOOD = ['#b58b5b', '#a97f50', '#bb9262', '#a27848', '#b0865a', '#ad8355', '#b88f60', '#a67c4d'], WOOD2 = ['#c9a77c', '#bf9d70', '#d0af85', '#b8956a', '#c5a278', '#bb9a6f', '#cdab80', '#c0a074'], DECK = ['#8a6a4a', '#7d5f41', '#93724f', '#7a5c3e'];
  const rb = (ax, c, a0, a1, s, y, gaps) => base(B, ax, c + s * 0.05, a0, a1, s, y, gaps);          // rodapé encostado na face da parede
  const rug = (x, z, w, d, y, c1, c2) => { const k = cvs(256, Math.round(256 * d / w)), g = k.g, hh = k.c.height; g.fillStyle = c1; g.fillRect(0, 0, 256, hh); g.strokeStyle = c2; g.lineWidth = 8; g.strokeRect(12, 12, 232, hh - 24); g.lineWidth = 3; g.strokeRect(28, 28, 200, hh - 56);
    const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshLambertMaterial({ map: k.t })); m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.012, z); G.add(m); };
  const art = (w, h, x, y, z, ry, seed) => { const k = cvs(256, Math.round(256 * h / w)), g = k.g, hh = k.c.height, pal = [['#2b3a67', '#e07a5f'], ['#f2a65a', '#3d405b'], ['#6a994e', '#f2e8cf'], ['#264653', '#e9c46a']][seed % 4];
    const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, 256, hh); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(80 + seed * 30 % 100, hh * 0.38, 38, 0, 7); g.fill(); g.fillStyle = 'rgba(20,25,40,.8)'; g.beginPath(); g.moveTo(0, hh); g.lineTo(60, hh * 0.6); g.lineTo(130, hh * 0.8); g.lineTo(200, hh * 0.55); g.lineTo(256, hh); g.fill();
    vplane(G, w, h, x, y, z, ry, new T.MeshBasicMaterial({ map: k.t })); const s = Math.sin(ry), c = Math.cos(ry); B.box(w + 0.06, h + 0.06, 0.02, x - s * 0.012, y, z - c * 0.012, M.blk, ry); };
  const window_ = (ax, c, a, w, y0, y1) => { win(B, ax, c, a, w, y0, y1); if (ax === 'x') vplane(G, w, y1 - y0, a, (y0 + y1) / 2, c, 0, GL); else vplane(G, w, y1 - y0, c, (y0 + y1) / 2, a, Math.PI / 2, GL); };
  const lamp = (key, p, zones, o) => house.light(Object.assign({ auto: () => !!lampSt[key], zones }, o, { p }));
  const plafon = (key, x, cy, z, zones, o) => { const m = own(0xfff6dd), mesh = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.05, 20), m); mesh.position.set(x, cy - 0.025, z); G.add(mesh); inter([mesh], () => toggle(key), zones);
    lamp(key, [x, cy - 0.3, z], zones, Object.assign({ k: 0.9, dist: 6.5, decay: 1.2, emis: [{ m, c: 0xffe9b0 }] }, o)); };
  const pendant = (key, x, cy, y, z, zones, o) => { const m = own(0xfff6dd), mesh = new T.Mesh(new T.SphereGeometry(0.15, 18, 12), m); mesh.position.set(x, y, z); G.add(mesh); B.cyl(0.008, 0.008, cy - y, x, (cy + y) / 2, z, M.blk, 6); inter([mesh], () => toggle(key), zones);
    lamp(key, [x, y - 0.1, z], zones, Object.assign({ k: 0.9, dist: 6.5, decay: 1.2, emis: [{ m, c: 0xffe9b0 }] }, o)); };
  const plant = (x, y, z, s) => { B.cyl(0.15 * s, 0.11 * s, 0.26 * s, x, y + 0.13 * s, z, M.pot, 14); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, g = new T.SphereGeometry(0.11 * s, 8, 6); g.scale(0.8, 1.6, 0.5); g.rotateZ(Math.cos(a) * 0.5); g.rotateX(Math.sin(a) * 0.5); g.rotateY(a); g.translate(x + Math.cos(a) * 0.13 * s, y + (0.55 + (i % 3) * 0.14) * s, z + Math.sin(a) * 0.13 * s); B.add(g, i % 2 ? M.leaf : M.leaf2); } };
  const chair = (x, y, z, ry, m) => B.at(x, y, z, ry, b => { b.box(0.44, 0.04, 0.44, 0, 0.45, 0, m); b.box(0.44, 0.45, 0.04, 0, 0.7, -0.2, m); [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([a, c]) => b.box(0.04, 0.43, 0.04, a, 0.215, c, M.dwood)); });
  const shelf = (x, y, z, w, h, d, ry) => B.at(x, y, z, ry, b => {
    b.box(0.04, h, d, -w / 2 + 0.02, h / 2, 0, M.dwood); b.box(0.04, h, d, w / 2 - 0.02, h / 2, 0, M.dwood); b.box(w, h, 0.02, 0, h / 2, d / 2 - 0.01, M.dwood); const n = 5;
    for (let i = 0; i <= n; i++) b.box(w - 0.08, 0.03, d, 0, 0.02 + i * (h - 0.04) / n, 0, M.dwood);
    const bc = [M.red, M.blu, M.grn, M.yel, lm(0x8e44ad), lm(0x16a085), lm(0xd35400), lm(0x34495e)];
    for (let r = 0; r < n; r++) { let xx = -w / 2 + 0.08; for (let i = 0; i < 14 && xx < w / 2 - 0.15; i++) { const bw = 0.03 + ((i * 7 + r * 3) % 4) * 0.012, bh = 0.18 + ((i * 5 + r) % 5) * 0.03; b.box(bw, bh, d * 0.65, xx + bw / 2, 0.035 + r * (h - 0.04) / n + bh / 2 + 0.015, 0, bc[(i + r * 3) % bc.length]); xx += bw + 0.004; } } });

  // ===== pisos e tetos =====
  fl(G, -2.5, 3.0, 2.4, 3.9, 0, r => plank(WOOD, r), 1.1); fl(G, -2.5, 0.5, 3.9, 6.0, 0, r => tiles('#e4eef0', '#cfe0e6', '#9db3ba', r), 0.6);
  fl(G, -2.5, 2.5, -2.3, 2.3, F, r => plank(WOOD2, r), 1.1); fl(G, 2.5, 7.0, -2.3, 2.3, F, r => plank(WOOD, r), 1.1); fl(G, 7.05, 10.0, -2.3, 2.3, F, r => tiles('#efe6cf', '#e0d3b4', '#a89f88', r), 0.6);
  fl(G, 6.08, 7.0, 2.4, 3.8, F, r => plank(WOOD, r), 1.1);
  // soleiras: o piso parava nas faces da parede e deixava um vão sob cada porta (aparecia o cenário de fundo)
  fl(G, 0.8, 1.8, 2.29, 2.41, 0, r => plank(WOOD, r), 1.1); fl(G, 6.15, 7.0, 2.29, 2.41, F, r => plank(WOOD, r), 1.1); fl(G, 6.99, 7.06, -0.6, 0.6, F, r => plank(WOOD, r), 1.1); fl(G, 4.2, 5.2, -2.41, -2.29, F, r => plank(DECK, r), 1.0);
  cl(G, -2.5, 3.0, 2.4, 3.9, H, M.ceil); cl(G, -2.5, 0.5, 3.9, 6.0, H, M.ceil); cl(G, 3.0, 7.0, 2.4, 3.8, H, M.ceil);
  cl(G, -2.5, 2.5, -2.3, 2.3, CT, M.ceil); cl(G, 2.5, 7.0, -2.3, 2.3, CT, M.ceil); cl(G, 7.05, 10.0, -2.3, 2.3, CT, M.ceil);
  // lajes (física): sem elas os objetos atravessariam o chão, já que o plano do chão é desligado dentro da casa
  P.staticBox(0.15, -0.15, 0.7, 2.85, 0.15, 3.3); P.staticBox(-1.0, -0.15, 5.0, 1.7, 0.15, 1.2); P.staticBox(3.8, F - 0.15, 0.8, 6.4, 0.15, 3.3); P.staticBox(4.7, F - 0.15, -3.35, 1.7, 0.15, 0.95); P.staticBox(4.7, YG + 0.08, -4.45, 0.75, 0.08, 0.15);

  // ===== paredes do andar de cima: corredor e banheiro =====
  wall(B, 'x', 3.85, -2.55, 0.55, 0, H, PAINT.bath, PAINT.hall, [{ c: -1.0, w: 0.9, y0: 0, y1: 2.05 }]); wall(B, 'x', 3.85, 0.55, 3.0, 0, H, PAINT.ext, PAINT.hall); wall(B, 'x', 3.85, 3.0, 7.05, F, H, PAINT.ext, PAINT.hall);
  wall(B, 'z', -2.55, 2.35, 3.85, 0, H, PAINT.hall, PAINT.ext, [{ c: 3.1, w: 0.9, y0: 0.9, y1: 2.0 }]); wall(B, 'z', -2.55, 3.85, 6.05, 0, H, PAINT.bath, PAINT.ext, [{ c: 4.7, w: 0.6, y0: 1.3, y1: 1.9 }]);
  wall(B, 'z', 0.55, 3.85, 6.05, 0, H, PAINT.ext, PAINT.bath); wall(B, 'x', 6.05, -2.55, 0.55, 0, H, PAINT.ext, PAINT.bath);
  wall(B, 'x', 2.35, 2.6, 7.05, F, H, PAINT.hall, PAINT.jan, [{ c: 6.575, w: 0.85, y0: F, y1: F + 2.1 }]); wall(B, 'z', 7.05, 2.35, 3.9, F, H, PAINT.ext, PAINT.hall);
  window_('z', -2.55, 3.1, 0.9, 0.9, 2.0); window_('z', -2.55, 4.7, 0.6, 1.3, 1.9);
  trim(B, 'x', 3.85, -1.0, 0.9, 2.05, 0); trim(B, 'x', 2.35, 1.3, 1.0, 2.1, 0, [1]);                                  // batente da porta do banheiro e da porta do quarto (lado do corredor)
  rb('x', 2.35, -2.5, 3.0, 1, 0, [[0.8, 1.8]]); rb('x', 3.85, -2.5, 3.0, -1, 0, [[-1.45, -0.55]]); rb('z', -2.55, 2.4, 3.85, 1, 0); rb('x', 3.85, -2.5, 0.5, 1, 0, [[-1.45, -0.55]]); rb('z', -2.55, 3.9, 6.0, 1, 0); rb('z', 0.55, 3.9, 6.0, -1, 0); rb('x', 6.05, -2.5, 0.5, -1, 0);
  // ===== paredes do térreo =====
  wall(B, 'x', -2.35, -2.55, 2.5, F, CT, PAINT.sala, PAINT.ext, [{ c: 0, w: 1.8, y0: F + 0.9, y1: F + 2.1 }]);
  wall(B, 'x', -2.35, 2.5, 7.05, F, CT, PAINT.jan, PAINT.ext, [{ c: 3.4, w: 0.9, y0: F + 0.9, y1: F + 2.1 }, { c: 4.7, w: 1.0, y0: F, y1: F + 2.1 }, { c: 6.0, w: 0.9, y0: F + 0.9, y1: F + 2.1 }]);
  wall(B, 'x', -2.35, 7.05, 10.05, F, CT, PAINT.coz, PAINT.ext);
  wall(B, 'x', 2.35, -2.55, 2.6, F, 0, PAINT.ext, PAINT.sala); wall(B, 'x', 2.35, 7.05, 10.05, F, CT, PAINT.ext, PAINT.coz);
  wall(B, 'z', -2.55, -2.35, 2.35, F, CT, PAINT.sala, PAINT.ext); wall(B, 'z', 2.5, -2.35, 2.35, F, CT, PAINT.jan, PAINT.sala, [{ c: 0, w: 2.0, y0: F, y1: F + 2.3 }]);
  wall(B, 'z', 7.05, -2.35, 2.35, F, CT, PAINT.coz, PAINT.jan, [{ c: 0, w: 1.2, y0: F, y1: F + 2.1 }]); wall(B, 'z', 10.05, -2.35, 2.35, F, CT, PAINT.ext, PAINT.coz, [{ c: 0.4, w: 1.2, y0: F + 1.0, y1: F + 2.0 }, { c: 1.5, w: 0.9, y0: F, y1: F + 2.1 }]);   // janela + porta para a garagem
  window_('x', -2.35, 0, 1.8, F + 0.9, F + 2.1); window_('x', -2.35, 3.4, 0.9, F + 0.9, F + 2.1); window_('x', -2.35, 6.0, 0.9, F + 0.9, F + 2.1); window_('z', 10.05, 0.4, 1.2, F + 1.0, F + 2.0);
  trim(B, 'x', -2.35, 4.7, 1.0, 2.1, F); trim(B, 'z', 2.5, 0, 2.0, 2.3, F); trim(B, 'z', 7.05, 0, 1.2, 2.1, F); trim(B, 'x', 2.35, 6.575, 0.85, 2.1, F);
  rb('x', -2.35, -2.5, 2.5, 1, F); rb('z', -2.55, -2.3, 2.3, 1, F); rb('x', 2.35, -2.5, 2.5, -1, F); rb('z', 2.5, -2.3, 2.3, -1, F, [[-1.0, 1.0]]);
  rb('x', -2.35, 2.5, 7.0, 1, F, [[4.2, 5.2]]); rb('x', 2.35, 2.5, 6.15, -1, F); rb('z', 2.5, -2.3, 2.3, 1, F, [[-1.0, 1.0]]); rb('z', 7.05, -2.3, 2.3, -1, F, [[-0.6, 0.6]]);
  // ===== escada: degraus maciços (do chão do térreo até o piso de cada degrau) =====
  for (let i = 1; i <= 14; i++) { const top = -i * RISE, xc = XS0 + (i - 0.5) * TREAD;
    B.box(TREAD, top - F, 1.4, xc, (top + F) / 2, 3.1, M.riser); B.box(TREAD + 0.025, 0.035, 1.4, xc + 0.0125, top - 0.0135, 3.1, M.tread); P.staticBox(xc, (top + F) / 2, 3.1, TREAD / 2, (top - F) / 2, 0.7); }
  // frontão do patamar (antes havia um vão aberto sob o piso do corredor: via-se o cenário de fundo) + espessura das lajes do andar de cima
  B.box(0.1, -F - 0.005, 1.4, XS0 - 0.05, F / 2 - 0.0025, 3.1, M.riser); B.box(0.145, 0.035, 1.4, XS0 - 0.0275, -0.0225, 3.1, M.tread); P.staticBox(XS0 - 0.05, F / 2, 3.1, 0.05, -F / 2, 0.7);
  B.box(5.5, 0.2, 1.5, 0.25, -0.105, 3.15, M.ceil); B.box(3.0, 0.2, 2.1, -1.0, -0.105, 4.95, M.ceil);
  { const x0 = XS0, y0 = 0.93, x1 = XS1, y1 = -14 * RISE + 0.93, len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(-(x1 - x0), y1 - y0);          // corrimão
    B.cyl(0.025, 0.025, len, (x0 + x1) / 2, (y0 + y1) / 2, 3.72, M.rail, 8, 0, ang); for (let i = 0; i <= 4; i++) { const x = x0 + (x1 - x0) * i / 4, y = y0 + (y1 - y0) * i / 4; B.box(0.04, 0.05, 0.1, x, y - 0.04, 3.76, M.dsteel); } }
  // ===== CORREDOR =====
  plafon('hall', -0.8, H, 3.15, ['hall', 'pbed', 'pbath']); plafon('hall', 1.9, H, 3.15, ['hall', 'pbed', 'stairs']);
  plafon('stairs', 4.5, H, 3.1, ['stairs', 'hall', 'foot'], { dist: 8 });
  { const m = own(0xfff6dd), mesh = new T.Mesh(new T.BoxGeometry(0.12, 0.22, 0.1), m); mesh.position.set(6.5, F + 1.9, 3.74); G.add(mesh); inter([mesh], () => toggle('stairs'), ['stairs', 'foot']); lamp('stairs', [6.5, F + 1.9, 3.5], ['stairs', 'foot', 'pfoot'], { k: 0.7, dist: 4.5, emis: [{ m, c: 0xffe9b0 }] }); }
  sw(G, 0.55, 1.25, 2.408, 0, () => toggle('hall'), ['hall', 'pbed']); sw(G, -0.35, 1.25, 3.792, 0, () => toggle('hall'), ['hall', 'pbath']); sw(G, 2.8, 1.25, 2.408, 0, () => toggle('stairs'), ['hall', 'stairs']); sw(G, 6.992, F + 1.25, 3.1, Math.PI / 2, () => toggle('stairs'), ['foot', 'stairs']);
  rug(0.3, 3.15, 4.2, 0.8, 0, '#7b3f4a', '#e7d3a8'); art(0.6, 0.8, -1.5, 1.5, 2.412, 0, 0); art(0.7, 0.5, -0.1, 1.55, 2.412, 0, 1); art(0.9, 0.6, 1.6, 1.55, 3.788, Math.PI, 2);
  B.box(0.34, 0.04, 0.6, -2.3, 0.75, 3.5, M.dwood); [[-2.43, 3.25], [-2.17, 3.25], [-2.43, 3.75], [-2.17, 3.75]].forEach(([x, z]) => B.box(0.04, 0.73, 0.04, x, 0.365, z, M.dwood)); B.cyl(0.06, 0.04, 0.2, -2.3, 0.87, 3.5, M.cer, 12); plant(-2.3, 0.77, 3.35, 0.45); B.col(0.34, 0.8, 0.6, -2.3, 0.4, 3.5);
  // ===== BANHEIRO =====
  plafon('bath', -1.0, H, 4.95, ['bath', 'pbath']); sw(G, -0.35, 1.25, 3.908, 0, () => toggle('bath'), ['bath', 'pbath']);
  const CER = new T.MeshLambertMaterial({ color: 0xf1f4f5, side: T.DoubleSide }), CERW = new T.MeshLambertMaterial({ color: 0xe6ecee, side: T.DoubleSide }), CHR = lm(0xc7ccd1);
  const WCL = ['bath', 'pbath'];
  const waterM = (op, side) => own(0xcfeaff, { transparent: true, opacity: op, depthWrite: false, side: side || T.FrontSide });
  // ---- espelho: reflexo real (câmera virtual espelhada), com a imagem estática de antes como reserva ----
  { const W = 0.7, Hh = 0.85, my = 1.55, mz = 4.65;
    B.box(0.03, 0.04, W + 0.08, 0.485, my + Hh / 2 + 0.02, mz, M.blk); B.box(0.03, 0.04, W + 0.08, 0.485, my - Hh / 2 - 0.02, mz, M.blk);
    B.box(0.03, Hh, 0.04, 0.485, my, mz + W / 2 + 0.02, M.blk); B.box(0.03, Hh, 0.04, 0.485, my, mz - W / 2 - 0.02, M.blk); B.box(0.01, Hh + 0.08, W + 0.08, 0.495, my, mz, M.blk);
    const k = cvs(128, 160), g = k.g, gr = g.createLinearGradient(0, 0, 128, 160); gr.addColorStop(0, '#dff1fa'); gr.addColorStop(0.5, '#b9d9ea'); gr.addColorStop(1, '#e8f6fc'); g.fillStyle = gr; g.fillRect(0, 0, 128, 160); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(14, 0, 18, 160);
    const mesh = new T.Mesh(new T.PlaneGeometry(W, Hh), new T.MeshBasicMaterial({ map: k.t })); mesh.rotation.y = -Math.PI / 2; mesh.position.set(0.488, my, mz); G.add(mesh);
    try {
      const rt = new T.WebGLRenderTarget(320, 384); rt.texture.generateMipmaps = false; rt.texture.minFilter = T.LinearFilter;
      const mat = new T.ShaderMaterial({ uniforms: { tex: { value: rt.texture }, tm: { value: new T.Matrix4() } },
        vertexShader: 'uniform mat4 tm; varying vec4 vUv; void main(){ vUv = tm * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D tex; varying vec4 vUv; void main(){ vec3 c = texture2DProj(tex, vUv).rgb * vec3(0.93, 0.97, 0.98); gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }' });
      const pl = new T.Plane(), nrm = new T.Vector3(), rp = new T.Vector3(), cp = new T.Vector3(), rot = new T.Matrix4(), look = new T.Vector3(), clip = new T.Vector4(), view = new T.Vector3(), tgt = new T.Vector3(), q4 = new T.Vector4(), tmx = new T.Matrix4(), vc = new T.PerspectiveCamera(); let ok = true, tried = false;
      mesh.onBeforeRender = function (renderer, scene, camera) {
        if (!ok || !zm(WCL)) return;
        rp.setFromMatrixPosition(mesh.matrixWorld); cp.setFromMatrixPosition(camera.matrixWorld); if (rp.distanceTo(cp) > 4.5) return;
        rot.extractRotation(mesh.matrixWorld); nrm.set(0, 0, 1).applyMatrix4(rot); view.subVectors(rp, cp); if (view.dot(nrm) > 0) return;
        const cRT = renderer.getRenderTarget(), cXR = renderer.xr.enabled, cSh = renderer.shadowMap.autoUpdate;
        try {
          view.reflect(nrm).negate().add(rp); rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp);
          tgt.subVectors(rp, look).reflect(nrm).negate().add(rp); vc.position.copy(view); vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(nrm); vc.lookAt(tgt); vc.far = camera.far; vc.updateMatrixWorld(); vc.projectionMatrix.copy(camera.projectionMatrix);
          tmx.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1); tmx.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse).multiply(mesh.matrixWorld); mat.uniforms.tm.value.copy(tmx);
          pl.setFromNormalAndCoplanarPoint(nrm, rp).applyMatrix4(vc.matrixWorldInverse); clip.set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant);
          const P4 = vc.projectionMatrix.elements; q4.x = (Math.sign(clip.x) + P4[8]) / P4[0]; q4.y = (Math.sign(clip.y) + P4[9]) / P4[5]; q4.z = -1; q4.w = (1 + P4[10]) / P4[14]; clip.multiplyScalar(2 / clip.dot(q4));
          P4[2] = clip.x; P4[6] = clip.y; P4[10] = clip.z + 1 - 0.003; P4[14] = clip.w;
          mesh.visible = false; renderer.xr.enabled = false; renderer.shadowMap.autoUpdate = false; renderer.setRenderTarget(rt); renderer.render(scene, vc);
          renderer.xr.enabled = cXR; renderer.shadowMap.autoUpdate = cSh; renderer.setRenderTarget(cRT); mesh.visible = true;
          if (!tried) { tried = true; mesh.material = mat; }
        } catch (e) { ok = false; mesh.visible = true; renderer.xr.enabled = cXR; renderer.setRenderTarget(cRT); VR.log && VR.log('espelho: ' + e.message); }
      };
    } catch (e) { VR.log && VR.log('espelho: ' + e.message); } }
  // ---- gabinete + bancada com cuba embutida (cuba de verdade, paredes inclinadas, ralo) ----
  { const mz = 4.65;
    B.box(0.46, 0.02, 0.86, 0.25, 0.09, mz, M.cabB); B.box(0.02, 0.72, 0.9, 0.49, 0.44, mz, M.cabB); B.box(0.5, 0.72, 0.02, 0.25, 0.44, mz - 0.44, M.cabB); B.box(0.5, 0.72, 0.02, 0.25, 0.44, mz + 0.44, M.cabB); B.box(0.44, 0.08, 0.88, 0.23, 0.04, mz, M.blk);
    [-1, 1].forEach(s => { B.box(0.02, 0.7, 0.435, 0.01, 0.44, mz + s * 0.2225, M.cabB); B.box(0.014, 0.16, 0.014, -0.012, 0.64, mz + s * 0.03, M.dsteel); });
    B.box(0.08, 0.04, 0.94, 0.02, 0.82, mz, M.marble); B.box(0.12, 0.04, 0.94, 0.46, 0.82, mz, M.marble); B.box(0.34, 0.04, 0.25, 0.23, 0.82, mz - 0.345, M.marble); B.box(0.34, 0.04, 0.25, 0.23, 0.82, mz + 0.345, M.marble);
    B.box(0.29, 0.015, 0.39, 0.23, 0.6425, mz, CER);
    [[0.0725, 0, -0.156, 0.42], [0.3875, 0, 0.156, 0.42]].forEach(([x, , rz, L]) => B.box(0.014, 0.162, L, x, 0.72, mz, CER, 0, 0, rz));
    [[mz - 0.2075, -0.156], [mz + 0.2075, 0.156]].forEach(([z, rx]) => B.box(0.32, 0.162, 0.014, 0.23, 0.72, z, CER, 0, rx, 0));
    B.box(0.36, 0.006, 0.01, 0.23, 0.803, mz - 0.222, CER); B.box(0.36, 0.006, 0.01, 0.23, 0.803, mz + 0.222, CER); B.cyl(0.03, 0.03, 0.006, 0.23, 0.653, mz, M.dsteel, 20); B.cyl(0.018, 0.018, 0.008, 0.23, 0.655, mz, M.blk, 14); B.cyl(0.04, 0.045, 0.012, 0.46, 0.846, mz, CHR, 22);
    B.col(0.54, 0.84, 0.94, 0.25, 0.42, mz);
    const fm = own(0xc7ccd1), body = new T.Mesh(new T.CylinderGeometry(0.016, 0.02, 0.15, 14), fm); body.position.set(0.46, 0.927, mz);
    const sp = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.14, 12), fm); sp.rotation.z = Math.PI / 2; sp.position.set(0.39, 0.99, mz);
    const nz = new T.Mesh(new T.CylinderGeometry(0.014, 0.011, 0.035, 12), fm); nz.position.set(0.322, 0.972, mz);
    const lev = new T.Mesh(new T.BoxGeometry(0.014, 0.014, 0.085), fm); lev.position.set(0.46, 0.965, mz + 0.045); const jt = new T.Mesh(new T.SphereGeometry(0.02, 12, 8), fm); jt.position.set(0.46, 0.99, mz);
    const hit = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), new T.MeshBasicMaterial({ visible: false })); hit.position.set(0.4, 0.97, mz); G.add(body, sp, nz, lev, jt, hit);
    const st = streak(), wt = new T.Mesh(new T.CylinderGeometry(0.0055, 0.0045, 0.31, 10, 1, true), own(0xcfeaff, { transparent: true, opacity: 0.7, map: st, depthWrite: false })); wt.position.set(0.322, 0.8, mz); wt.visible = false; G.add(wt);
    const rip = new T.Mesh(new T.CircleGeometry(0.05, 20), waterM(0.35)); rip.rotation.x = -Math.PI / 2; rip.position.set(0.322, 0.652, mz); rip.visible = false; G.add(rip);
    let on = false, rt_ = 0;
    const set = v => { on = v; wt.visible = rip.visible = v; sfx(v ? 700 : 500, 0.07); snd.flow('pia', v, WCL, 1800, 9000, 0.16); };
    inter([body, sp, nz, lev, jt, hit], () => set(!on), ['bath']); anims.push(dt => { if (on) { st.offset.y -= dt * 1.6; rt_ += dt; rip.scale.setScalar(1 + 0.25 * Math.abs(Math.sin(rt_ * 9))); } });
    house._water = house._water || []; house._water.push(() => { on = false; wt.visible = rip.visible = false; }); }
  // ---- vaso sanitário: bolha oval torneada, assento, tampa que abre para cima, caixa acoplada, descarga ----
  { const cx = -0.5, bz = 5.58, SZ = 1.22, ptsB = [[0.0, 0.0], [0.07, 0.0], [0.11, 0.12], [0.15, 0.24], [0.178, 0.34], [0.19, 0.41], [0.182, 0.425], [0.158, 0.418], [0.15, 0.37], [0.125, 0.3], [0.08, 0.255], [0.0, 0.245]].map(p => new T.Vector2(p[0], p[1]));
    const bowl = new T.LatheGeometry(ptsB, 32); bowl.scale(1, 1, SZ); B.add(B.xf(bowl, cx, 0, bz), CER);
    B.cyl(0.12, 0.15, 0.12, cx, 0.06, bz + 0.1, CER, 24); B.cyl(0.19, 0.2, 0.04, cx, 0.02, bz + 0.1, CERW, 24);
    const seat = new T.LatheGeometry([[0.128, 0.428], [0.2, 0.428], [0.2, 0.452], [0.128, 0.452], [0.128, 0.428]].map(p => new T.Vector2(p[0], p[1])), 32); seat.scale(1, 1, SZ); B.add(B.xf(seat, cx, 0, bz), CERW);
    B.cyl(0.02, 0.02, 0.02, cx - 0.12, 0.44, bz + 0.2, M.dsteel, 10); B.cyl(0.02, 0.02, 0.02, cx + 0.12, 0.44, bz + 0.2, M.dsteel, 10);
    B.box(0.44, 0.38, 0.19, cx, 0.62, 5.895, CER); B.box(0.46, 0.03, 0.21, cx, 0.825, 5.895, CERW); B.box(0.2, 0.1, 0.12, cx, 0.31, 5.93, CER); B.cyl(0.012, 0.012, 0.16, cx, 0.1, 5.96, M.steel, 8);
    B.col(0.45, 0.85, 0.65, cx, 0.42, 5.68);
    const lid = new T.Group(); lid.position.set(cx, 0.455, 5.8); const lg = new T.CylinderGeometry(0.205, 0.205, 0.022, 32); lg.scale(1, 1, SZ); const lm_ = new T.Mesh(lg, own(0xf4f7f8)); lm_.position.set(0, 0.011, bz - 5.8); lid.add(lm_); G.add(lid);
    let lo = 0, lv = 0; inter([lm_], () => { lo = lo ? 0 : 1; sfx(lo ? 500 : 380, 0.08); }, ['bath']); anims.push(dt => { lv += (lo - lv) * damp(7, dt); lid.rotation.x = lv * 1.62; });
    const bm = own(0xe9f2f5), btn = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.018, 16), bm); btn.position.set(cx, 0.849, 5.895); G.add(btn);
    const wk = cvs(128, 128), wg = wk.g; wg.fillStyle = '#9fd0e8'; wg.fillRect(0, 0, 128, 128); wg.strokeStyle = 'rgba(255,255,255,.7)'; wg.lineWidth = 6; for (let i = 0; i < 3; i++) { wg.beginPath(); wg.arc(64, 64, 18 + i * 16, i * 2, i * 2 + 3.4); wg.stroke(); }
    const wg2 = new T.CircleGeometry(0.115, 24); wg2.scale(1, 1, 1); const wtr = new T.Mesh(wg2, own(0xffffff, { map: wk.t, transparent: true, opacity: 0.85 })); wtr.rotation.x = -Math.PI / 2; wtr.scale.set(1, SZ, 1); wtr.position.set(cx, 0.3, bz); G.add(wtr); let fT = 0;
    inter([btn], () => { if (fT > 0) return; fT = 2.8; sfx(650, 0.08); snd.burst(2.8, 250, 2600, 0.2); btn.position.y = 0.842; }, ['bath']);
    anims.push(dt => { if (fT > 0) { fT -= dt; const k = Math.max(fT, 0) / 2.8, e = 1 - k; wtr.rotation.z += dt * 10 * k; wtr.position.y = 0.3 - 0.05 * Math.sin(Math.min(1, e * 1.6) * Math.PI) * (e < 0.62 ? 1 : 0.4 * (1 - e) / 0.38 + 0.0); if (fT <= 0) { btn.position.y = 0.849; wtr.position.y = 0.3; } } }); }
  // ---- box do chuveiro: bandeja com ralo, vidro que embaça, ducha de parede, registro e gotas ----
  { const sx = -2.0, sz = 5.5, hz = 5.78, yh = 2.2, GLs = own(0xaed9ee, { transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
    B.box(1.0, 0.06, 1.0, -2.0, 0.03, 5.5, lm(0xeef2f4)); B.cyl(0.05, 0.05, 0.006, sx, 0.062, sz, M.dsteel, 20); B.cyl(0.03, 0.03, 0.008, sx, 0.064, sz, M.blk, 14);
    const g2 = new T.Mesh(new T.PlaneGeometry(1.0, 2.0), GLs); g2.position.set(-2.0, 1.06, 5.0); G.add(g2);
    B.box(0.03, 2.06, 0.03, -1.5, 1.03, 5.0, M.steel); B.box(1.0, 0.03, 0.03, -2.0, 2.06, 5.0, M.steel); B.box(1.0, 0.025, 0.03, -2.0, 0.07, 5.0, M.steel); B.box(0.03, 0.03, 0.06, -1.5, 0.06, 5.05, M.steel);
    B.cyl(0.011, 0.011, 1.05, sx, 1.675, 5.985, M.steel, 10); B.cyl(0.011, 0.011, 0.2, sx, yh, 5.885, M.steel, 10, Math.PI / 2); B.cyl(0.026, 0.026, 0.02, sx, 1.15, 5.99, M.steel, 20, Math.PI / 2); B.cyl(0.022, 0.022, 0.012, sx, yh, 5.985, M.steel, 14, Math.PI / 2);
    const hm = own(0xc7ccd1), hd = new T.Mesh(new T.CylinderGeometry(0.1, 0.085, 0.035, 28), hm); hd.position.set(sx, yh - 0.02, hz); const face = new T.Mesh(new T.CircleGeometry(0.075, 24), lm(0x7d848b)); face.rotation.x = Math.PI / 2; face.position.set(sx, yh - 0.0385, hz); G.add(hd, face);
    const kn = new T.Mesh(new T.CylinderGeometry(0.02, 0.022, 0.03, 16), hm); kn.rotation.x = Math.PI / 2; kn.position.set(sx, 1.15, 5.965); const lv2 = new T.Mesh(new T.BoxGeometry(0.1, 0.014, 0.014), hm); lv2.position.set(sx + 0.03, 1.15, 5.945); const hit = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshBasicMaterial({ visible: false })); hit.position.set(sx, yh - 0.1, hz); const hit2 = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), new T.MeshBasicMaterial({ visible: false })); hit2.position.set(sx, 1.15, 5.95); G.add(kn, lv2, hit, hit2);
    const N = 130, dm = new T.InstancedMesh(new T.BoxGeometry(0.004, 0.12, 0.004), new T.MeshBasicMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.6, depthWrite: false }), N); dm.frustumCulled = false; dm.visible = false; G.add(dm);
    const r = rnd(11), ang = [], rad = [], ph = [], spd = []; for (let i = 0; i < N; i++) { ang.push(r() * 6.283); rad.push(0.25 + r() * 0.75); ph.push(r()); spd.push(0.8 + r() * 0.5); }
    const m4 = new T.Matrix4(); let tt = 0; const spl = new T.Mesh(new T.RingGeometry(0.1, 0.24, 28), waterM(0.3, T.DoubleSide)); spl.rotation.x = -Math.PI / 2; spl.position.set(sx, 0.07, hz - 0.1); spl.visible = false; G.add(spl);
    let on = false, fog = 0, onT = 0; const set = v => { on = v; dm.visible = spl.visible = v; if (v) onT = 0; sfx(v ? 700 : 500, 0.07); snd.flow('chuveiro', v, WCL, 1200, 7500, 0.2); };
    inter([hd, face, kn, lv2, hit, hit2], () => set(!on), ['bath']);
    anims.push(dt => { onT += on ? dt : 0; fog += ((on ? Math.min(1, onT / 12) : 0) - fog) * (on ? 0.35 : 0.08) * dt * 3; GLs.opacity = 0.22 + 0.38 * fog; GLs.color.setHex(0xaed9ee).lerp(new T.Color(0xeaf3f7), fog);
      if (!on) return; tt += dt; for (let i = 0; i < N; i++) { const f = (ph[i] + tt * spd[i]) % 1, y = yh - 0.05 - (yh - 0.12) * f, rr = (0.03 + 0.19 * f) * rad[i]; m4.makeTranslation(sx + Math.cos(ang[i]) * rr, y, hz - 0.02 + Math.sin(ang[i]) * rr * 0.9); dm.setMatrixAt(i, m4); } dm.instanceMatrix.needsUpdate = true; spl.scale.setScalar(1 + 0.15 * Math.sin(tt * 14)); });
    house._water.push(() => { on = false; dm.visible = spl.visible = false; }); }
  B.cyl(0.015, 0.015, 0.5, -2.0, 1.1, 3.94, M.steel, 8, 0, Math.PI / 2); B.box(0.45, 0.5, 0.03, -2.0, 1.05, 3.93, lm(0x4f8fb5)); rug(-0.5, 4.65, 0.7, 1.0, 0, '#5b8fb0', '#e8f0f4');
  // ===== SALA =====
  pendant('sala', 0, CT, F + 2.25, 0, ['sala', 'parch']); sw(G, 2.44, F + 1.25, 1.35, Math.PI / 2, () => toggle('sala'), ['sala', 'parch']);
  rug(-0.2, 0, 2.8, 2.0, F, '#35506b', '#d8c9a3');
  B.box(0.45, 0.5, 1.9, -2.27, F + 0.25, 0, M.dwood); B.col(0.45, 0.5, 1.9, -2.27, F + 0.25, 0); B.box(0.05, 0.72, 1.28, -2.4, F + 0.95, 0, M.blk); B.box(0.2, 0.03, 0.5, -2.3, F + 0.515, 0, M.blk);
  { const k = cvs(320, 180), tvS = new T.Mesh(new T.PlaneGeometry(1.2, 0.675), new T.MeshBasicMaterial({ map: k.t })); tvS.rotation.y = Math.PI / 2; tvS.position.set(-2.37, F + 0.95, 0); G.add(tvS);
    const off = () => { k.g.fillStyle = '#05060a'; k.g.fillRect(0, 0, 320, 180); k.t.needsUpdate = true; }; off();
    const draw = t => { const g = k.g; g.fillStyle = '#0d1020'; g.fillRect(0, 0, 320, 180); for (let i = 0; i < 7; i++) { g.fillStyle = 'hsl(' + ((t * 0.04 + i * 52) % 360) + ',72%,55%)'; g.fillRect(i * 320 / 7, 0, 320 / 7 + 1, 110); } g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 110, 320, 70); g.beginPath(); g.arc(160 + Math.sin(t * 0.0021) * 120, 148, 14, 0, 7); g.fillStyle = '#fff'; g.fill(); g.font = '700 22px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('VR TV', 160, 132); k.t.needsUpdate = true; };
    let tT = 0, was = false; inter([tvS], () => { toggle('tv'); }, ['sala', 'parch']); anims.push((dt, t) => { if (lampSt.tv) { if (t - tT > 110) { tT = t; draw(t); } was = true; } else if (was) { was = false; off(); } });
    lamp('tv', [-1.5, F + 1.0, 0], ['sala', 'parch'], { col: 0x6aa0ff, k: 0.6, dist: 4.5, decay: 1.6 }); }
  B.at(0.9, F, 0, 0, b => { b.box(0.9, 0.4, 2.2, 0, 0.2, 0, M.sofa); b.box(0.2, 0.6, 2.2, 0.36, 0.7, 0, M.sofa); b.box(0.9, 0.3, 0.2, 0, 0.55, -1.0, M.sofa); b.box(0.9, 0.3, 0.2, 0, 0.55, 1.0, M.sofa);
    [-0.4, 0.4].forEach(z => { b.box(0.62, 0.12, 0.76, -0.08, 0.46, z, M.cush); b.box(0.14, 0.4, 0.74, 0.2, 0.7, z, M.cush); }); b.box(0.12, 0.34, 0.34, 0.0, 0.62, -0.78, M.cush2, 0, 0, 0.3); b.box(0.12, 0.34, 0.34, 0.0, 0.62, 0.78, M.cush3, 0, 0, 0.3); });
  B.col(0.9, 0.6, 2.2, 0.9, F + 0.3, 0);
  B.box(0.6, 0.05, 1.1, -0.7, F + 0.4, 0, M.wood); [[-0.95, -0.45], [-0.45, -0.45], [-0.95, 0.45], [-0.45, 0.45]].forEach(([x, z]) => B.box(0.05, 0.38, 0.05, x, F + 0.19, z, M.dwood)); B.col(0.6, 0.45, 1.1, -0.7, F + 0.22, 0);
  B.box(0.22, 0.03, 0.3, -0.7, F + 0.435, -0.2, M.red); B.box(0.2, 0.03, 0.28, -0.7, F + 0.465, -0.2, M.blu); B.cyl(0.05, 0.04, 0.16, -0.75, F + 0.5, 0.3, M.cer, 12); B.sph(0.07, -0.75, F + 0.64, 0.3, M.leaf, 1, 1.2, 1);
  { const lm2 = own(0xfff0cf), sh = new T.Mesh(new T.CylinderGeometry(0.15, 0.24, 0.3, 20), lm2); sh.position.set(-2.05, F + 1.65, -1.95); G.add(sh); B.cyl(0.17, 0.19, 0.03, -2.05, F + 0.015, -1.95, M.blk, 16); B.cyl(0.012, 0.012, 1.5, -2.05, F + 0.78, -1.95, M.blk, 8);
    inter([sh], () => toggle('floor'), ['sala', 'parch']); lamp('floor', [-2.0, F + 1.55, -1.9], ['sala', 'parch'], { col: 0xffe3b0, k: 0.8, dist: 5, emis: [{ m: lm2, c: 0xffc873 }] }); }
  shelf(-0.6, F, 2.14, 1.8, 1.9, 0.3, 0); B.col(1.8, 1.9, 0.3, -0.6, F + 0.95, 2.14); art(0.7, 0.5, 1.2, F + 1.65, 2.288, Math.PI, 3);
  plant(-2.1, F, 1.85, 1.3); B.box(0.3, 2.15, 0.08, -1.2, F + 1.3, -2.22, M.curt); B.box(0.3, 2.15, 0.08, 1.2, F + 1.3, -2.22, M.curt); B.box(2.7, 0.03, 0.03, 0, F + 2.4, -2.22, M.blk);
  // ===== SALA DE JANTAR =====
  pendant('jantar', 4.8, CT, F + 1.8, 0, ['jantar', 'parch', 'pcoz', 'pfront', 'pfoot']); sw(G, 5.5, F + 1.25, -2.292, 0, () => toggle('jantar'), ['jantar', 'pfront']);
  rug(4.8, 0, 2.6, 3.0, F, '#6b4a3a', '#d8c9a3');
  B.box(1.0, 0.05, 2.0, 4.8, F + 0.75, 0, M.oak); [[4.4, -0.9], [5.2, -0.9], [4.4, 0.9], [5.2, 0.9]].forEach(([x, z]) => B.box(0.07, 0.73, 0.07, x, F + 0.365, z, M.wood)); B.col(1.0, 0.8, 2.0, 4.8, F + 0.4, 0);
  [-0.55, 0.55].forEach(z => { chair(4.0, F, z, Math.PI / 2, M.cabB); chair(5.6, F, z, -Math.PI / 2, M.cabB); }); chair(4.8, F, -1.3, 0, M.cabB); chair(4.8, F, 1.3, Math.PI, M.cabB);
  B.cyl(0.07, 0.05, 0.22, 4.8, F + 0.88, 0, M.cer, 12); B.sph(0.12, 4.8, F + 1.1, 0, M.leaf2, 1, 0.9, 1); B.cyl(0.13, 0.08, 0.05, 4.8, F + 0.8, -0.5, M.red, 14); B.cyl(0.13, 0.08, 0.05, 4.8, F + 0.8, 0.5, M.red, 14);
  B.box(2.2, 0.8, 0.45, 4.3, F + 0.4, 2.07, M.wood); B.box(2.26, 0.04, 0.5, 4.3, F + 0.82, 2.07, M.dwood); B.col(2.2, 0.84, 0.45, 4.3, F + 0.42, 2.07); [-0.55, 0.55].forEach(x => B.box(0.02, 0.7, 0.01, 4.3 + x, F + 0.4, 1.84, M.dwood)); B.cyl(0.06, 0.045, 0.28, 3.6, F + 0.98, 2.07, M.cer, 12); B.sph(0.14, 3.6, F + 1.28, 2.07, M.leaf, 1, 1, 1);
  art(1.0, 0.7, 4.3, F + 1.6, 2.288, Math.PI, 1); plant(6.6, F, -1.9, 1.5);
  // ===== COZINHA =====
  plafon('coz', 8.5, CT, 0.2, ['coz', 'pcoz'], { dist: 7 }); sw(G, 7.108, F + 1.25, -0.95, Math.PI / 2, () => toggle('coz'), ['coz', 'pcoz']);
  { const cz = -1.97, sx0 = 7.78, sx1 = 8.2, sz0 = -2.16, sz1 = -1.78, sxc = (sx0 + sx1) / 2, TY = F + 0.9, ST = lm(0xb7bfc6), STD = lm(0x8f979e);   // bancada com cuba de inox embutida
    B.box(0.68, 0.86, 0.62, 7.44, F + 0.43, -1.99, M.cabW); B.box(0.28, 0.86, 0.62, 8.34, F + 0.43, -1.99, M.cabW); B.box(0.08, 0.86, 0.62, 9.26, F + 0.43, -1.99, M.cabW); B.box(0.42, 0.66, 0.62, sxc, F + 0.33, -1.99, M.cabW); B.box(0.42, 0.2, 0.02, sxc, F + 0.76, -1.69, M.cabW);
    B.box(0.7, 0.04, 0.66, 7.43, F + 0.88, cz, M.top); B.box(0.28, 0.04, 0.66, 8.34, F + 0.88, cz, M.top); B.box(0.1, 0.04, 0.66, 9.27, F + 0.88, cz, M.top); B.box(0.42, 0.04, 0.14, sxc, F + 0.88, -2.23, M.top); B.box(0.42, 0.04, 0.14, sxc, F + 0.88, -1.71, M.top);
    B.box(0.42, 0.012, 0.38, sxc, F + 0.712, cz, ST); B.box(0.012, 0.19, 0.38, sx0 + 0.006, F + 0.8, cz, ST); B.box(0.012, 0.19, 0.38, sx1 - 0.006, F + 0.8, cz, ST); B.box(0.42, 0.19, 0.012, sxc, F + 0.8, sz0 + 0.006, ST); B.box(0.42, 0.19, 0.012, sxc, F + 0.8, sz1 - 0.006, ST);
    B.box(0.46, 0.008, 0.016, sxc, TY + 0.002, sz0 - 0.008, ST); B.box(0.46, 0.008, 0.016, sxc, TY + 0.002, sz1 + 0.008, ST); B.box(0.016, 0.008, 0.4, sx0 - 0.008, TY + 0.002, cz, ST); B.box(0.016, 0.008, 0.4, sx1 + 0.008, TY + 0.002, cz, ST);
    B.cyl(0.032, 0.032, 0.006, sxc, F + 0.72, cz, STD, 20); B.cyl(0.018, 0.018, 0.008, sxc, F + 0.722, cz, M.blk, 14); B.cyl(0.045, 0.05, 0.014, sxc, TY + 0.007, -2.235, ST, 22);
    B.col(2.24, 0.9, 0.66, 8.2, F + 0.45, cz);
    const fm = own(0xc7ccd1), neck = new T.Mesh(new T.CylinderGeometry(0.016, 0.02, 0.3, 14), fm); neck.position.set(sxc, TY + 0.164, -2.235);
    const arc = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.22, 12), fm); arc.rotation.x = Math.PI / 2; arc.position.set(sxc, TY + 0.31, -2.125);
    const nz = new T.Mesh(new T.CylinderGeometry(0.016, 0.012, 0.04, 12), fm); nz.position.set(sxc, TY + 0.29, -2.015); const jt = new T.Mesh(new T.SphereGeometry(0.02, 12, 8), fm); jt.position.set(sxc, TY + 0.31, -2.235);
    const lev = new T.Mesh(new T.BoxGeometry(0.075, 0.014, 0.014), fm); lev.position.set(sxc + 0.045, TY + 0.1, -2.235); const hit = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ visible: false })); hit.position.set(sxc, TY + 0.25, -2.13); G.add(neck, arc, nz, jt, lev, hit);
    const st = streak(), wt = new T.Mesh(new T.CylinderGeometry(0.006, 0.0045, TY + 0.27 - (F + 0.725), 10, 1, true), own(0xcfeaff, { transparent: true, opacity: 0.7, map: st, depthWrite: false })); wt.position.set(sxc, (TY + 0.27 + F + 0.725) / 2, -2.015); wt.visible = false; G.add(wt);
    const rip = new T.Mesh(new T.CircleGeometry(0.055, 20), waterM(0.35)); rip.rotation.x = -Math.PI / 2; rip.position.set(sxc, F + 0.726, -2.015); rip.visible = false; G.add(rip);
    let on = false, rt_ = 0; const set = v => { on = v; wt.visible = rip.visible = v; sfx(v ? 700 : 500, 0.07); snd.flow('pia-coz', v, ['coz', 'pcoz'], 1800, 9000, 0.16); };
    inter([neck, arc, nz, jt, lev, hit], () => set(!on), ['coz']); anims.push(dt => { if (on) { st.offset.y -= dt * 1.6; rt_ += dt; rip.scale.setScalar(1 + 0.25 * Math.abs(Math.sin(rt_ * 9))); } });
    house._water = house._water || []; house._water.push(() => { on = false; wt.visible = rip.visible = false; }); }
  for (let i = 0; i <= 5; i++) if (i !== 4) B.box(0.01, 0.8, 0.008, 7.1 + i * 0.44, F + 0.43, -1.675, M.dsteel); for (let i = 0; i < 3; i++) B.box(0.1, 0.02, 0.02, 7.1 + i * 0.44 + 0.3, F + 0.78, -1.665, M.steel);
  B.box(1.35, 0.7, 0.35, 7.775, F + 1.85, -2.125, M.cabW); B.box(0.01, 0.65, 0.008, 7.775, F + 1.85, -1.945, M.dsteel);
  // ===== MICRO-ONDAS (porta que abre, visor, botões, prato giratório, luz, som e bipe) =====
  { const x0 = 7.2, x1 = 7.7, y0 = F + 0.9, y1 = F + 1.18, z0 = -2.25, z1 = -1.83, zc = (z0 + z1) / 2, ym = (y0 + y1) / 2, D_ = z1 - z0, LN = lm(0xcfd5da);
    B.box(0.5, 0.012, D_, 7.45, y0 + 0.006, zc, M.blk); B.box(0.5, 0.012, D_, 7.45, y1 - 0.006, zc, M.blk); B.box(0.5, 0.28, 0.012, 7.45, ym, z0 + 0.006, M.blk); B.box(0.012, 0.28, D_, x0 + 0.006, ym, zc, M.blk); B.box(0.15, 0.28, D_, 7.625, ym, zc, M.blk);
    B.box(0.338, 0.004, D_ - 0.02, 7.375, y0 + 0.014, zc, LN); B.box(0.338, 0.004, D_ - 0.02, 7.375, y1 - 0.014, zc, LN); B.box(0.338, 0.26, 0.004, 7.375, ym, z0 + 0.014, LN); B.box(0.004, 0.26, D_ - 0.02, x0 + 0.014, ym, zc, LN); B.box(0.004, 0.26, D_ - 0.02, 7.549, ym, zc, LN);
    B.col(0.5, 0.28, D_, 7.45, ym, zc);
    const bulbM = own(0xfff6dd), bulb = new T.Mesh(new T.BoxGeometry(0.06, 0.004, 0.03), bulbM); bulb.position.set(7.375, y1 - 0.018, zc - 0.05); G.add(bulb);
    // prato giratório com uma caneca (para o giro aparecer)
    const plate = new T.Group(); plate.position.set(7.375, y0 + 0.019, zc); G.add(plate);
    const pg = new T.Mesh(new T.CylinderGeometry(0.135, 0.135, 0.006, 32), new T.MeshLambertMaterial({ color: 0xbfd9e6, transparent: true, opacity: 0.85 })); plate.add(pg);
    const mug = new T.Mesh(new T.CylinderGeometry(0.032, 0.028, 0.07, 18), lm(0xe9edf0)); mug.position.set(0.06, 0.038, 0.02); plate.add(mug); const mh = new T.Mesh(new T.TorusGeometry(0.02, 0.005, 6, 12, Math.PI), lm(0xe9edf0)); mh.position.set(0.095, 0.04, 0.02); mh.rotation.z = -Math.PI / 2; plate.add(mh);
    const cof = new T.Mesh(new T.CylinderGeometry(0.027, 0.027, 0.004, 16), lm(0x5a3a22)); cof.position.set(0.06, 0.07, 0.02); plate.add(cof);
    // porta (dobradiça à esquerda, abre para a cozinha)
    const piv = new T.Group(); piv.position.set(x0, y0 + 0.01, z1); G.add(piv);
    const dm = () => own(0x1d1f24), fr = [[0.335, 0.03, 0.025, 0.1675, 0.245], [0.335, 0.03, 0.025, 0.1675, 0.015], [0.03, 0.26, 0.025, 0.015, 0.13], [0.05, 0.26, 0.025, 0.31, 0.13]].map(([w, h, d, x, y]) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), dm()); m.position.set(x, y, 0.0125); piv.add(m); return m; });
    const gl = new T.Mesh(new T.PlaneGeometry(0.25, 0.2), new T.MeshBasicMaterial({ color: 0x20262c, transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide })); gl.position.set(0.15, 0.13, 0.0125); piv.add(gl);
    const hnd = new T.Mesh(new T.BoxGeometry(0.012, 0.14, 0.014), own(0xc7ccd1)); hnd.position.set(0.325, 0.13, 0.03); piv.add(hnd);
    let open_ = 0, ov = 0, running = false, tleft = 0, endT = 0, last = '', hum = 0;
    const dClick = () => { open_ = open_ ? 0 : 1; sfx(open_ ? 420 : 330, 0.12); if (open_ && running) { running = false; sfx(300, 0.1); } };
    inter(fr.concat([gl, hnd]), dClick, ['coz']);
    anims.push(dt => { ov += (open_ - ov) * damp(6, dt); if (Math.abs(open_ - ov) < 0.002) ov = open_; piv.rotation.y = -1.75 * ov; });
    // visor
    const dk = cvs(128, 48), dg = dk.g, show = txt => { if (txt === last) return; last = txt; dg.fillStyle = '#04100a'; dg.fillRect(0, 0, 128, 48); dg.font = '700 36px monospace'; dg.textAlign = 'center'; dg.textBaseline = 'middle'; dg.fillStyle = txt === '0:00' ? '#1f5a3a' : '#5dff9a'; dg.fillText(txt, 64, 26); dk.t.needsUpdate = true; };
    const dsp = new T.Mesh(new T.PlaneGeometry(0.12, 0.045), new T.MeshBasicMaterial({ map: dk.t })); dsp.position.set(7.625, F + 1.125, z1 + 0.001); G.add(dsp); show('0:00');
    const fmt = t => { const s = Math.ceil(t); return ((s / 60) | 0) + ':' + ('0' + (s % 60)).slice(-2); };
    const stopRun = () => { running = false; };
    const beep = () => { [0, 0.28, 0.56].forEach(d => setTimeout(() => sfx(1600, 0.18, 0.5), d * 1000)); };
    // botões
    const btn = (x, y, w, txt, bg, fg, fn) => { const k = cvs(96, 64), g = k.g; g.fillStyle = bg; g.fillRect(0, 0, 96, 64); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.strokeRect(2, 2, 92, 60); g.font = '700 ' + (txt.length > 3 ? 26 : 30) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(txt, 48, 34);
      const m = new T.Mesh(new T.BoxGeometry(w, 0.022, 0.008), [lm(0x222222), lm(0x222222), lm(0x222222), lm(0x222222), new T.MeshBasicMaterial({ map: k.t }), lm(0x222222)]);
      m.rotation.set(0, 0, 0); m.position.set(x, y, z1 + 0.004); G.add(m);
      const mat = own(0xffffff); const face = new T.Mesh(new T.PlaneGeometry(w, 0.022), new T.MeshBasicMaterial({ map: k.t })); face.position.set(x, y, z1 + 0.0085); G.add(face); m.visible = true; m.material = m.material; const hit = new T.Mesh(new T.BoxGeometry(w + 0.012, 0.034, 0.03), new T.MeshBasicMaterial({ visible: false })); hit.position.set(x, y, z1 + 0.01); G.add(hit);
      inter([face, hit], () => { sfx(1200, 0.05); face.position.z = z1 + 0.0065; setTimeout(() => { face.position.z = z1 + 0.0085; }, 120); fn(); }, ['coz']); };
    const add = s => { if (tleft < 5940) tleft += s; if (tleft > 5940) tleft = 5940; };
    btn(7.585, F + 1.07, 0.034, '+10s', '#2b3a4a', '#ffffff', () => add(10)); btn(7.625, F + 1.07, 0.034, '+30s', '#2b3a4a', '#ffffff', () => add(30)); btn(7.665, F + 1.07, 0.034, '+1m', '#2b3a4a', '#ffffff', () => add(60));
    btn(7.597, F + 1.035, 0.05, 'STOP', '#a8322d', '#ffffff', () => { if (running) { running = false; } else tleft = 0; });
    btn(7.655, F + 1.035, 0.05, 'START', '#2e8b57', '#ffffff', () => { if (open_) { sfx(250, 0.2); toast('Feche a porta do micro-ondas'); return; } if (tleft <= 0) add(30); running = true; });
    lamp('micro', [7.375, y1 - 0.06, zc], ['coz', 'pcoz'], { auto: () => running || ov > 0.1, k: 0.35, dist: 1.4, decay: 1.5, col: 0xffe9c0, emis: [{ m: bulbM, c: 0xfff0c8 }] });
    anims.push((dt, t) => {
      if (running) { tleft -= dt; plate.rotation.y -= dt * 1.3; if (tleft <= 0) { tleft = 0; running = false; endT = 3; beep(); } }
      if (endT > 0) { endT -= dt; show(Math.floor(endT * 3) % 2 ? 'END' : '    '); if (endT <= 0) show('0:00'); } else show(fmt(tleft));
      snd.flow('micro', running, ['coz', 'pcoz'], 90, 420, 0.07);
    });
    house._water = house._water || []; house._water.push(() => { running = false; tleft = 0; endT = 0; open_ = 0; show('0:00'); }); }
  // ===== FOGÃO (4 bocas a gás com chama, forno elétrico com resistências e termostato, panela que ferve, coifa com exaustor e luz) =====
  { const SX = 8.85, WD = 0.74, X0 = SX - WD / 2, X1 = SX + WD / 2, ZF = -1.64, ZB = -2.3, ZC = (ZF + ZB) / 2, DL = ZF - ZB, TH = F + 0.91, HB = F + 1.6, GT = TH + 0.036;
    const BP = [[8.665, -2.1], [8.665, -1.83], [9.035, -1.83], [9.035, -2.1]];                      // bocas: 0 trás-esq, 1 frente-esq, 2 frente-dir, 3 trás-dir
    const mb = (w, h, d, x, y, z, mat, par) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); (par || G).add(m); return m; };
    const hit = (r, x, y, z) => { const m = new T.Mesh(new T.SphereGeometry(r, 8, 6), new T.MeshBasicMaterial({ visible: false })); m.position.set(x, y, z); G.add(m); return m; };
    const IRON = lm(0x15171a), BAR = lm(0xb9bec4);
    // --- corpo, tampo de vidro preto e painel ---
    B.box(0.02, 0.9, DL, X0 + 0.01, F + 0.45, ZC, M.dsteel); B.box(0.02, 0.9, DL, X1 - 0.01, F + 0.45, ZC, M.dsteel); B.box(WD, 0.9, 0.02, SX, F + 0.45, ZB + 0.01, M.dsteel);
    B.box(WD, 0.1, 0.03, SX, F + 0.05, ZF - 0.015, M.blk); B.box(WD, 0.02, DL, SX, TH - 0.01, ZC, M.blk);
    B.box(WD + 0.01, 0.01, 0.014, SX, TH + 0.002, ZF - 0.007, M.steel); B.box(WD + 0.01, 0.01, 0.014, SX, TH + 0.002, ZB + 0.007, M.steel);
    B.box(WD, 0.28, 0.025, SX, F + 0.76, ZF - 0.0125, M.blk); B.box(0.04, 0.52, 0.025, X0 + 0.02, F + 0.36, ZF - 0.0125, M.steel); B.box(0.04, 0.52, 0.025, X1 - 0.02, F + 0.36, ZF - 0.0125, M.steel);
    // --- grelhas de ferro e bases das bocas ---
    [0, 1].forEach(s => { const x = BP[s === 0 ? 0 : 2][0];
      [-0.15, 0.15].forEach(o => { B.box(0.012, 0.014, 0.6, x + o, GT - 0.007, ZC, IRON); [-2.27, -1.69].forEach(z => B.box(0.014, 0.036, 0.014, x + o, TH + 0.018, z, IRON)); });
      [-2.27, BP[0][1], BP[1][1], -1.69].forEach(z => B.box(0.31, 0.014, 0.012, x, GT - 0.007, z, IRON)); });
    BP.forEach(([x, z]) => { B.cyl(0.058, 0.058, 0.008, x, TH + 0.004, z, M.dsteel, 24); B.cyl(0.046, 0.046, 0.008, x, TH + 0.012, z, M.blk, 24); });
    // --- bocas: tampa clicável, anel de chamas ---
    const flameG = new T.ConeGeometry(0.0065, 0.032, 6); { const p = flameG.attributes.position, c = new Float32Array(p.count * 3), a = new T.Color(0x2255ff), b = new T.Color(0xaad8ff), k = new T.Color(); for (let i = 0; i < p.count; i++) { k.copy(a).lerp(b, (p.getY(i) + 0.016) / 0.032); c.set([k.r, k.g, k.b], i * 3); } flameG.setAttribute('color', new T.BufferAttribute(c, 3)); }
    const flameM = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending });
    const bn = BP.map(([x, z], i) => { const cap = new T.Mesh(new T.CylinderGeometry(0.03, 0.032, 0.012, 20), own(0x2a2d33)); cap.position.set(x, TH + 0.022, z); G.add(cap);
      const fg = new T.Group(); fg.position.set(x, TH + 0.028 + 0.016, z); fg.visible = false; G.add(fg); const jets = [];
      for (let j = 0; j < 14; j++) { const a = j / 14 * Math.PI * 2, m = new T.Mesh(flameG, flameM); m.position.set(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04); fg.add(m); jets.push(m); }
      return { i, x, z, cap, fg, jets, lv: 0, ign: false, it: 0, tk: 0, f: 0, flash: 0, knob: null, kr: 0 }; });
    let tot = 0, tm = 0;
    const lvTxt = ['desligada', 'fogo baixo', 'fogo médio', 'fogo alto'];
    const setLv = (b, v) => { const was = b.lv; b.lv = v; sfx(v ? 520 + v * 90 : 380, 0.05, 0.5); if (v && !was) { b.it = 0; b.tk = 0.1; } };
    const cycle = b => setLv(b, (b.lv + 1) % 4);
    // --- painel com legendas (mini-esquemas das bocas, marcas dos botões, visor do forno) ---
    const KX = [8.545, 8.64, 8.735, 8.83], KY = F + 0.745, OKX = 9.0, LBX = 9.13, DX = 9.06, DY = F + 0.835;
    { const pt = cvs(592, 224), g = pt.g; g.fillStyle = '#16191d'; g.fillRect(0, 0, 592, 224);
      const dots = (cx, cy, n, st) => { for (let l = 0; l < n; l++) { const a = st * l, px = cx - Math.sin(a) * 29, py = cy - Math.cos(a) * 29; g.beginPath(); g.arc(px, py, l === 0 ? 3 : 2 + l * 0.8, 0, 7); if (l === 0) { g.strokeStyle = '#8b939a'; g.lineWidth = 2; g.stroke(); } else { g.fillStyle = '#ff9a3c'; g.fill(); } } };
      KX.forEach((x, i) => { const cx = (x - X0) * 800, cy = 50; for (let q = 0; q < 4; q++) { const qx = q < 2 ? -11 : 11, qy = q === 0 || q === 3 ? -11 : 11; g.beginPath(); g.arc(cx + qx, cy + qy, 7, 0, 7); if (q === i) { g.fillStyle = '#e8eef2'; g.fill(); } else { g.strokeStyle = '#6b737a'; g.lineWidth = 2; g.stroke(); } } dots(cx, (F + 0.9 - KY) * 800, 4, 0.9); });
      dots((OKX - X0) * 800, (F + 0.9 - KY) * 800, 5, 0.8);
      g.fillStyle = '#9aa3aa'; g.font = '700 15px sans-serif'; g.textAlign = 'center'; g.fillText('FORNO', (DX - X0) * 800, 16); g.fillStyle = '#05080a'; g.fillRect((DX - X0) * 800 - 58, (F + 0.9 - DY) * 800 - 22, 116, 44);
      const pm = new T.Mesh(new T.PlaneGeometry(WD, 0.28), new T.MeshBasicMaterial({ map: pt.t })); pm.position.set(SX, F + 0.76, ZF + 0.0008); G.add(pm); }
    const mkKnob = (x, r, fn) => { const km = own(0xc7ccd1), grp = new T.Group(); grp.position.set(x, KY, ZF); G.add(grp);
      const k = new T.Mesh(new T.CylinderGeometry(r, r * 1.08, 0.028, 20), km); k.rotation.x = Math.PI / 2; k.position.z = 0.014; grp.add(k);
      const ind = new T.Mesh(new T.BoxGeometry(0.005, r * 0.8, 0.004), lm(0xffffff)); ind.position.set(0, r * 0.55, 0.03); grp.add(ind);
      inter([k, hit(0.044, x, KY, ZF + 0.02)], fn, ['coz']); return grp; };
    bn.forEach((b, i) => { b.knob = mkKnob(KX[i], 0.026, () => cycle(b)); inter([b.cap], () => setLv(b, b.lv ? 0 : 2), ['coz']); });
    // --- forno elétrico: cavidade, grade, resistências, lâmpada, bolo ---
    const cavM = own(0x2a2d32), elBM = own(0x4a3a35), elTM = own(0x4a3a35), bulbM = own(0xfff6dd);
    mb(0.66, 0.012, 0.595, SX, F + 0.116, -1.9625, cavM); mb(0.66, 0.012, 0.595, SX, F + 0.604, -1.9625, cavM); mb(0.66, 0.5, 0.012, SX, F + 0.36, -2.254, cavM); mb(0.012, 0.5, 0.595, X0 + 0.046, F + 0.36, -1.9625, cavM); mb(0.012, 0.5, 0.595, X1 - 0.046, F + 0.36, -1.9625, cavM);
    for (let z = -2.22; z < -1.7; z += 0.07) B.box(0.62, 0.008, 0.008, SX, F + 0.3, z, BAR); B.box(0.008, 0.008, 0.52, X0 + 0.06, F + 0.3, -1.97, BAR); B.box(0.008, 0.008, 0.52, X1 - 0.06, F + 0.3, -1.97, BAR);
    const coil = (y, zs, mat) => { zs.forEach((z, i) => { mb(0.54, 0.01, 0.011, SX, y, z, mat); if (i < zs.length - 1) mb(0.011, 0.01, zs[i + 1] - z, SX + (i % 2 ? -0.27 : 0.27), y, (z + zs[i + 1]) / 2, mat); }); };
    coil(F + 0.135, [-2.2, -2.08, -1.96, -1.84, -1.72], elBM); coil(F + 0.585, [-2.2, -2.06, -1.92, -1.78], elTM);
    mb(0.035, 0.01, 0.03, SX - 0.22, F + 0.596, -2.22, bulbM);
    const pan = new T.Mesh(new T.CylinderGeometry(0.1, 0.092, 0.04, 24), lm(0x3b3d41)); pan.position.set(SX, F + 0.326, -1.96); G.add(pan);
    const cakeM = own(0xe9d79a), cake = new T.Mesh(new T.CylinderGeometry(0.088, 0.09, 0.06, 24), cakeM); cake.position.set(SX, F + 0.352, -1.96); G.add(cake);
    // porta do forno (dobradiça embaixo, abre para a cozinha)
    const pv = new T.Group(); pv.position.set(SX, F + 0.1, ZF - 0.0125); G.add(pv);
    const dm = own(0xc7ccd1), dp = [[0.66, 0.07, 0.025, 0, 0.485, 0], [0.66, 0.06, 0.025, 0, 0.03, 0], [0.07, 0.52, 0.025, -0.295, 0.26, 0], [0.07, 0.52, 0.025, 0.295, 0.26, 0]].map(a => mb(a[0], a[1], a[2], a[3], a[4], a[5], dm, pv));
    const gM = new T.MeshBasicMaterial({ color: 0x14171b, transparent: true, opacity: 0.62, depthWrite: false, side: T.DoubleSide }), gl = new T.Mesh(new T.PlaneGeometry(0.52, 0.36), gM); gl.position.set(0, 0.27, 0.0135); pv.add(gl);
    mb(0.52, 0.4, 0.004, 0, 0.26, -0.0135, lm(0x6c737a), pv);
    const hh = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.6, 12), dm); hh.rotation.z = Math.PI / 2; hh.position.set(0, 0.5, 0.055); pv.add(hh);
    [-0.25, 0.25].forEach(x => { const p = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.045, 8), dm); p.rotation.x = Math.PI / 2; p.position.set(x, 0.5, 0.034); pv.add(p); });
    let om = 0, to = 22, hot = false, glow = 0, reached = false, dT = 0, dV = 0, lampO = false, bake = 0, lastD = '';
    const MODES = [{ t: 0, n: 'Forno desligado' }, { t: 150, n: 'Forno 150 °C' }, { t: 200, n: 'Forno 200 °C' }, { t: 250, n: 'Forno 250 °C' }, { t: 230, n: 'Grill 230 °C', grill: true }];
    inter(dp.concat([hh, gl]), () => { dT = dT ? 0 : 1; sfx(dT ? 380 : 300, 0.12); }, ['coz']);
    inter([cake], () => { bake = 0; sfx(500, 0.06); toast('Massa nova no forno'); }, ['coz']);
    const okn = mkKnob(OKX, 0.03, () => { om = (om + 1) % MODES.length; reached = false; sfx(420 + om * 70, 0.07, 0.5); toast(MODES[om].n); });
    // visor do forno
    const dk = cvs(128, 48), dg = dk.g, show = (txt, col) => { const key = txt + col; if (key === lastD) return; lastD = key; dg.fillStyle = '#05080a'; dg.fillRect(0, 0, 128, 48); dg.font = '700 32px monospace'; dg.textAlign = 'center'; dg.textBaseline = 'middle'; dg.fillStyle = col; dg.fillText(txt, 64, 26); dk.t.needsUpdate = true; };
    const dsp = new T.Mesh(new T.PlaneGeometry(0.13, 0.043), new T.MeshBasicMaterial({ map: dk.t })); dsp.position.set(DX, DY, ZF + 0.0016); G.add(dsp); show('--', '#1f5a3a');
    // botões com legenda (botão de luz do forno e botões da coifa)
    const pbtn = (x, y, z, w, h, txt, fn) => { const k = cvs(96, Math.round(96 * h / w)), g = k.g, hh_ = k.c.height; const paint = on => { g.fillStyle = on ? '#e8a23a' : '#2b3036'; g.fillRect(0, 0, 96, hh_); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 4; g.strokeRect(2, 2, 92, hh_ - 4); g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = on ? '#1a1206' : '#e6ebef'; g.fillText(txt, 48, hh_ / 2 + 2); k.t.needsUpdate = true; }; paint(false);
      const sd = lm(0x222222), m = new T.Mesh(new T.BoxGeometry(w, h, 0.012), [sd, sd, sd, sd, new T.MeshBasicMaterial({ map: k.t }), sd]); m.position.set(x, y, z + 0.006); G.add(m);
      inter([hit(Math.max(w, h) * 0.75, x, y, z + 0.02)], fn, ['coz']); return paint; };
    const lampPaint = pbtn(LBX, KY, ZF, 0.045, 0.032, 'LUZ', () => { lampO = !lampO; sfx(lampO ? 820 : 560, 0.05); lampPaint(lampO); });
    lamp('forno', [SX, F + 0.46, -1.9], ['coz', 'pcoz'], { auto: () => lampO || dV > 0.12, k: () => dV > 0.12 ? 0.5 : 0.18, dist: 1.3, decay: 1.5, col: 0xffe2b0, emis: [{ m: bulbM, c: 0xfff0c8 }] });
    // --- panela com água (clique para trocar de boca) ---
    const potM = own(0xc7ccd1), pot = new T.Group(); G.add(pot); let pI = 0, pw = 22;
    const pw1 = new T.Mesh(new T.CylinderGeometry(0.095, 0.09, 0.11, 28, 1, true), (() => { const m = potM.clone(); m.side = T.DoubleSide; return m; })()); pw1.position.y = 0.055; pot.add(pw1);
    const pb = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.006, 28), potM); pb.position.y = 0.003; pot.add(pb);
    const pr = new T.Mesh(new T.TorusGeometry(0.095, 0.004, 6, 28), potM); pr.rotation.x = Math.PI / 2; pr.position.y = 0.11; pot.add(pr);
    [-1, 1].forEach(s => { const h = new T.Mesh(new T.BoxGeometry(0.045, 0.012, 0.016), potM); h.position.set(s * 0.115, 0.095, 0); pot.add(h); });
    const wat = new T.Mesh(new T.CircleGeometry(0.088, 28), own(0x9fd3ea, { transparent: true, opacity: 0.8, depthWrite: false })); wat.rotation.x = -Math.PI / 2; wat.position.y = 0.078; pot.add(wat);
    inter([pw1, pb, pr, wat], () => { pI = (pI + 1) % 4; pot.position.set(BP[pI][0], GT, BP[pI][1]); sfx(240, 0.09, 0.6); }, ['coz']); pot.position.set(BP[0][0], GT, BP[0][1]);
    const bub = []; { const bg = new T.SphereGeometry(0.006, 6, 5), bm = own(0xeaf6ff, { transparent: true, opacity: 0.85 }); for (let i = 0; i < 12; i++) { const m = new T.Mesh(bg, bm); m.visible = false; pot.add(m); bub.push({ m, a: 1 }); } }
    // vapor
    const sx_ = cvs(64, 64), sgd = sx_.g.createRadialGradient(32, 32, 2, 32, 32, 30); sgd.addColorStop(0, 'rgba(255,255,255,.9)'); sgd.addColorStop(1, 'rgba(255,255,255,0)'); sx_.g.fillStyle = sgd; sx_.g.fillRect(0, 0, 64, 64); sx_.t.needsUpdate = true;
    const sp = []; for (let i = 0; i < 20; i++) { const m = new T.SpriteMaterial({ map: sx_.t, transparent: true, depthWrite: false, opacity: 0 }), s = new T.Sprite(m); s.visible = false; G.add(s); sp.push({ s, m, age: 1, life: 3, vx: 0, vy: 0, vz: 0, a: 1 }); }
    // --- coifa: corpo troncocônico de inox, chaminé, exaustor, luzes e botões ---
    { const g = new T.CylinderGeometry(0.7071 * 0.37, 0.7071, 0.22, 4, 1, true); g.rotateY(Math.PI / 4); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; let x = p.getX(i) * 0.76, z = p.getZ(i) * 0.52; if (top) z += -2.3 + 0.5 * 0.52 * 0.37 - (-2.04); p.setXYZ(i, x + SX, p.getY(i) + HB + 0.11, z - 2.04 + (top ? 0 : 0)); }
      g.computeVertexNormals(); G.add(new T.Mesh(g, own(0xc7ccd1, { side: T.DoubleSide }))); }
    B.box(0.28, F + 2.7 - (HB + 0.22), 0.19, SX, (HB + 0.22 + F + 2.7) / 2, -2.205, M.steel); B.box(0.74, 0.012, 0.5, SX, HB + 0.006, -2.04, M.dsteel);
    B.cyl(0.115, 0.115, 0.004, SX, HB - 0.002, -2.04, M.blk, 28); B.box(0.24, 0.003, 0.006, SX, HB - 0.018, -2.04, M.steel); B.box(0.006, 0.003, 0.24, SX, HB - 0.018, -2.04, M.steel);
    [-0.27, 0.27].forEach(o => B.box(0.17, 0.004, 0.44, SX + o, HB - 0.002, -2.04, M.dsteel)); B.box(0.5, 0.05, 0.016, SX, HB + 0.025, -1.788, M.steel);
    const fan = new T.Group(); fan.position.set(SX, HB - 0.012, -2.04); G.add(fan); const fm = own(0xa8aeb4);
    for (let i = 0; i < 6; i++) { const b = new T.Mesh(new T.BoxGeometry(0.085, 0.003, 0.028), fm); b.rotation.y = i / 6 * Math.PI * 2; b.position.set(Math.cos(i / 6 * Math.PI * 2) * 0.05, 0, -Math.sin(i / 6 * Math.PI * 2) * 0.05); fan.add(b); }
    const hlM = own(0xfff6dd); [-0.2, 0.2].forEach(o => { const l = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.006, 14), hlM); l.position.set(SX + o, HB - 0.006, -1.9); G.add(l); });
    let hoodL = false, fanL = 0, fanW = 0; const hp1 = pbtn(SX - 0.1, HB + 0.027, -1.78, 0.07, 0.034, 'LUZ', () => { hoodL = !hoodL; sfx(hoodL ? 820 : 560, 0.05); hp1(hoodL); });
    const f1 = pbtn(SX, HB + 0.027, -1.78, 0.07, 0.034, 'V1', () => { fanL = fanL === 1 ? 0 : 1; sfx(fanL ? 600 : 400, 0.06); f1(fanL === 1); f2(fanL === 2); });
    const f2 = pbtn(SX + 0.1, HB + 0.027, -1.78, 0.07, 0.034, 'V2', () => { fanL = fanL === 2 ? 0 : 2; sfx(fanL ? 700 : 400, 0.06); f1(fanL === 1); f2(fanL === 2); });
    lamp('coifa', [SX, HB - 0.12, -1.92], ['coz', 'pcoz'], { auto: () => hoodL, k: 0.55, dist: 2.4, decay: 1.4, col: 0xfff1d6, emis: [{ m: hlM, c: 0xfff4d0 }] });
    lamp('fogao', [SX, TH + 0.14, -1.97], ['coz', 'pcoz'], { auto: () => tot > 0.02, k: () => Math.min(0.5, tot * 0.28), dist: 1.8, decay: 1.4, col: 0x9ec4ff });
    // --- simulação ---
    const cDark = new T.Color(0x14171b), cHot = new T.Color(0x5a2a12), eRed = new T.Color(0xff3a10), cK1 = new T.Color(0xb9803a), cK2 = new T.Color(0x2a1a0e);
    anims.push(dt => {
      tm += dt; const kd = damp(12, dt);
      // bocas a gás
      tot = 0; bn.forEach(b => {
        if (b.lv > 0 && !b.ign) { b.it += dt; b.tk += dt; if (b.tk > 0.11) { b.tk = 0; sfx(2300 + Math.random() * 700, 0.014, 0.4); } if (b.it > 0.5) { b.ign = true; b.flash = 1; sfx(180, 0.12, 0.5); } }
        if (b.lv === 0) { b.ign = false; b.it = 0; }
        b.f += ((b.ign ? 0.4 + 0.22 * b.lv : 0) - b.f) * damp(b.lv ? 14 : 30, dt); b.flash = Math.max(0, b.flash - dt * 4); tot += b.f;
        b.fg.visible = b.f > 0.03; if (b.fg.visible) { const sc = b.f * (1 + b.flash * 0.7); b.jets.forEach((m, j) => { m.scale.set(0.7 + b.f * 0.5, sc * (0.85 + 0.22 * Math.sin(tm * 17 + j * 1.7) + 0.1 * Math.sin(tm * 31 + j * 2.9)), 0.7 + b.f * 0.5); m.position.y = m.scale.y * 0.016; }); }
        b.kr += (b.lv * 0.9 - b.kr) * kd; b.knob.rotation.z = b.kr; });
      // forno
      const md = MODES[om], tg = md.t; if (tg === 0) { hot = false; reached = false; } else { if (!hot && to < tg - 6) { hot = true; sfx(170, 0.04, 0.4); } else if (hot && to >= tg) { hot = false; sfx(170, 0.04, 0.4); } }
      dV += (dT - dV) * damp(5, dt); pv.rotation.x = dV * 1.5; to += ((hot ? 7 : 0) - (to - 22) * (0.008 + dV * 0.05)) * dt; to = Math.max(22, to);
      if (tg > 0 && !reached && to >= tg - 3) { reached = true; [0, 0.3].forEach(d => setTimeout(() => sfx(1500, 0.16, 0.5), d * 1000)); toast('Forno pré-aquecido: ' + tg + ' °C'); }
      glow += ((hot ? 1 : 0) - glow) * damp(hot ? 3 : 1.2, dt); okn.rotation.z += (om * 0.8 - okn.rotation.z) * kd;
      elBM.emissive.copy(eRed).multiplyScalar(md.grill ? glow * 0.12 : glow); elTM.emissive.copy(eRed).multiplyScalar(md.grill ? glow : glow * 0.7);
      cavM.emissive.setHex(0x3a0d00).multiplyScalar(glow * 0.6); gM.color.copy(cDark).lerp(cHot, Math.min(1, glow * 0.8 + (to > 120 ? 0.15 : 0)));
      if (to >= 130) bake += dt * Math.min(1.2, (to - 120) / 130) / 50;
      { const k = bake < 1 ? bake : 1, c = cakeM.color.setHex(0xe9d79a).lerp(cK1, k); if (bake > 1) c.lerp(cK2, Math.min(1, bake - 1)); cake.scale.y = 0.8 + 0.3 * k; cake.position.y = F + 0.322 + 0.03 * cake.scale.y; }
      show(tg === 0 && to < 45 ? '--' : Math.round(to / 5) * 5 + '°', tg > 0 && reached ? '#5dff9a' : '#ffb347');
      // panela e vapor
      const b0 = bn[pI], lvEff = b0.ign ? b0.lv : 0; pw += (2.4 * lvEff - 0.006 * (pw - 22)) * dt; pw = Math.min(100, Math.max(20, pw));
      const st = Math.min(1, Math.max(0, (pw - 55) / 45)), bo = Math.min(1, Math.max(0, (pw - 92) / 8)), px = BP[pI][0], pz = BP[pI][1];
      wat.scale.setScalar(1 + 0.012 * Math.sin(tm * 14) * bo);
      bub.forEach(p => { if (p.a >= 1) { if (bo > 0.05 && Math.random() < dt * 7 * bo) { p.a = 0; const r = Math.random() * 0.075, a = Math.random() * 6.28; p.m.position.set(Math.cos(a) * r, 0.079, Math.sin(a) * r); p.s = 0.6 + Math.random() * 0.9; } else p.m.visible = false; } else { p.a += dt * 2.6; p.m.visible = p.a < 1; p.m.scale.setScalar(Math.sin(Math.min(1, p.a) * Math.PI) * p.s); } });
      const fl = fanL, top = GT + 0.115;
      sp.forEach(p => {
        if (p.age >= 1) { if (st > 0.04 && Math.random() < dt * (2 + 10 * st)) { p.age = 0; p.life = 2.2 + Math.random() * 1.6; p.a = st; p.s.position.set(px + (Math.random() - 0.5) * 0.12, top, pz + (Math.random() - 0.5) * 0.12); p.vx = (Math.random() - 0.5) * 0.02; p.vz = (Math.random() - 0.5) * 0.02; p.vy = 0.16 + Math.random() * 0.08; p.s.visible = true; } else { p.s.visible = false; return; } }
        p.age += dt / p.life; const q = p.s.position;
        if (fl > 0) { p.vx += (SX - q.x) * 0.9 * fl * dt; p.vz += (-2.04 - q.z) * 0.9 * fl * dt; p.vy += 0.25 * fl * dt; p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt; if (q.y > HB - 0.03) p.age = 1; }
        else { p.vx += (Math.random() - 0.5) * 0.06 * dt; p.vz += (Math.random() - 0.5) * 0.06 * dt; if (q.y > HB - 0.04) { q.y = HB - 0.04; p.vy = 0; p.vz -= 0.02 * dt; } }
        q.x += p.vx * dt; q.y += p.vy * dt; q.z += p.vz * dt; const a = Math.min(1, p.age); p.s.scale.setScalar(0.05 + 0.2 * a); p.m.opacity = 0.3 * p.a * (1 - a) * Math.min(1, a * 6); });
      // coifa
      fanW += ((fanL === 2 ? 22 : fanL === 1 ? 10 : 0) - fanW) * damp(3, dt); fan.rotation.y += fanW * dt;
      // sons
      snd.flow('fogao-gas', bn.some(b => b.lv > 0), ['coz', 'pcoz'], 1500, 7000, 0.045); snd.flow('fogao-boil', bo > 0.5, ['coz', 'pcoz'], 300, 2200, 0.07);
      snd.flow('coifa1', fanL >= 1, ['coz', 'pcoz'], 60, 700, 0.06); snd.flow('coifa2', fanL === 2, ['coz', 'pcoz'], 400, 2600, 0.05); });
    house._water = house._water || []; house._water.push(() => { bn.forEach(b => { b.lv = 0; b.ign = false; b.it = 0; b.f = 0; b.fg.visible = false; b.kr = 0; b.knob.rotation.z = 0; }); om = 0; to = 22; hot = false; glow = 0; reached = false; dT = 0; dV = 0; lampO = false; bake = 0; pw = 22; fanL = 0; fanW = 0; hoodL = false; pv.rotation.x = 0; okn.rotation.z = 0; lampPaint(false); hp1(false); f1(false); f2(false); sp.forEach(p => { p.age = 1; p.s.visible = false; }); }); }
  B.box(0.62, 1.85, 0.03, 9.65, F + 0.925, -2.265, M.cer); B.box(0.03, 1.85, 0.62, 9.35, F + 0.925, -1.97, M.cer); B.box(0.03, 1.85, 0.62, 9.95, F + 0.925, -1.97, M.cer); B.box(0.62, 0.03, 0.62, 9.65, F + 1.865, -1.97, M.cer); B.box(0.62, 0.03, 0.62, 9.65, F + 0.03, -1.97, M.cer);
  [0.5, 0.95, 1.4].forEach(y => B.box(0.58, 0.02, 0.5, 9.65, F + y, -2.01, lm(0xdfe8ec))); B.box(0.1, 0.22, 0.1, 9.5, F + 0.62, -2.1, M.red); B.box(0.1, 0.26, 0.1, 9.75, F + 0.64, -2.1, M.blu); B.box(0.16, 0.12, 0.16, 9.6, F + 1.06, -2.0, M.yel); B.box(0.12, 0.3, 0.12, 9.78, F + 1.12, -2.1, M.grn); B.col(0.62, 1.85, 0.62, 9.65, F + 0.925, -1.97);
  { const fm = own(0xfff6dd); const f = D.fridge = mkDoor(G, { ax: 'x', c: -1.655, a: 9.65, w: 0.62, h: 1.83, y0: F + 0.04, hinge: -1, ang: -1.9, col: 0xf0f2f3, zones: ['coz'], knob: false });   // dobradiça do lado do balcão: a porta abre para a cozinha (antes atravessava a parede)
    const gk = lm(0x30343a), li = lm(0xf6f8f9), bn = lm(0xdde8ec), hs = lm(0xc7ccd1), add = (w, h, d, x, y, z, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); f.piv.add(o); return o; };
    add(0.025, 0.7, 0.03, 0.55, 1.05, 0.04, hs); add(0.025, 0.4, 0.03, 0.55, 0.3, 0.04, hs); add(0.56, 0.012, 0.004, 0.31, 0.62, 0.024, gk);               // puxadores e frestas entre freezer e geladeira
    add(0.54, 1.72, 0.012, 0.31, 0.9, -0.03, li); add(0.56, 0.025, 0.02, 0.31, 0.015, -0.032, gk); add(0.56, 0.025, 0.02, 0.31, 1.785, -0.032, gk); add(0.025, 1.76, 0.02, 0.035, 0.9, -0.032, gk); add(0.025, 1.76, 0.02, 0.585, 0.9, -0.032, gk);   // forro interno e borracha de vedação
    [0.4, 0.78, 1.16].forEach(y => { add(0.5, 0.012, 0.07, 0.31, y, -0.075, bn); add(0.5, 0.06, 0.01, 0.31, y + 0.03, -0.108, bn); add(0.012, 0.06, 0.07, 0.06, y + 0.03, -0.075, bn); add(0.012, 0.06, 0.07, 0.56, y + 0.03, -0.075, bn); });   // prateleiras da porta
    const pm = new T.Mesh(new T.BoxGeometry(0.3, 0.02, 0.1), fm); pm.position.set(9.65, F + 1.82, -2.0); G.add(pm);
    lamp('fridge', [9.65, F + 1.6, -1.85], ['coz'], { auto: () => f.v > 0.12, k: 0.7, dist: 2.6, col: 0xeaf4ff, emis: [{ m: fm, c: 0xdfefff }] }); }
  B.box(1.5, 0.88, 0.75, 8.7, F + 0.44, 0.35, M.cabB); B.box(1.62, 0.05, 0.87, 8.7, F + 0.905, 0.35, M.marble); B.col(1.62, 0.93, 0.87, 8.7, F + 0.465, 0.35); B.cyl(0.14, 0.09, 0.07, 8.9, F + 0.97, 0.35, M.yel, 14); B.sph(0.05, 8.88, F + 1.03, 0.33, M.red); B.sph(0.05, 8.93, F + 1.03, 0.4, M.grn);
  [8.25, 9.15].forEach(x => { B.cyl(0.17, 0.17, 0.05, x, F + 0.65, 1.15, M.dwood, 16); B.cyl(0.025, 0.025, 0.6, x, F + 0.32, 1.15, M.dsteel, 8); B.cyl(0.14, 0.14, 0.02, x, F + 0.2, 1.15, M.dsteel, 12); });
  // ===== FACHADA ESTILO EUA: porch coberto com degraus, colunas, guarda-corpo, telhados de duas águas, venezianas e chaminé =====
  const PX0 = 3.0, PX1 = 6.4, PZ = -4.3, WZ = -2.4, PC = (PX0 + PX1) / 2, PW = PX1 - PX0, FB = F - YG, SHUT = lm(0x23364d), SHUT2 = lm(0x1a2a3d), CONC = lm(0xc9c6bf), WHP = lm(0xf5f2ec);
  wbox(B, PW, FB - 0.01, WZ - PZ, PC, YG + (FB - 0.01) / 2, (PZ + WZ) / 2, BRICK);                                                   // base de tijolo do porch
  fl(G, PX0, PX1, PZ, WZ, F + 0.004, r => plank(['#9a9c9a', '#a3a5a3', '#8f918f', '#989a98'], r), 1.0);                             // deck pintado de cinza
  B.box(1.5, 0.18, 0.3, PC, YG + 0.09, PZ - 0.15, CONC);                                                                            // degrau de concreto (2 degraus no total: 18 cm + 18 cm)
  [[PX0 + 0.12, PZ + 0.12], [PX1 - 0.12, PZ + 0.12]].forEach(([x, z]) => { B.box(0.2, 0.2, 0.2, x, F + 0.1, z, WHT); B.box(0.15, 2.15, 0.15, x, F + 1.275, z, WHT); B.box(0.22, 0.12, 0.22, x, F + 2.39, z, WHT); B.col(0.2, 2.5, 0.2, x, F + 1.25, z); });   // colunas brancas
  B.box(PW - 0.1, 0.22, 0.14, PC, F + 2.35, PZ + 0.12, WHT); cl(G, PX0, PX1, PZ, WZ, F + 2.45, M.ceil);                             // viga e forro do porch
  B.at(PC, 0, (PZ + WZ) / 2, Math.PI / 2, b => gable(b, { y0: F + 2.45, rise: 0.78, W: PW, L: WZ - PZ, ovF: 0.2, ovB: 0.2, e0: 0, e1: 0.3, roof: ROOFM, wall: SIDING_DS, c0: 0 }));   // frontão do porch
  const railX = (x0, x1, z) => { B.box(x1 - x0, 0.06, 0.07, (x0 + x1) / 2, F + 0.96, z, WHT); B.box(x1 - x0, 0.05, 0.05, (x0 + x1) / 2, F + 0.2, z, WHT); for (let x = x0 + 0.06; x < x1; x += 0.13) B.box(0.03, 0.74, 0.03, x, F + 0.58, z, WHT); };
  const railZ = (z0, z1, x) => { B.box(0.07, 0.06, z1 - z0, x, F + 0.96, (z0 + z1) / 2, WHT); B.box(0.05, 0.05, z1 - z0, x, F + 0.2, (z0 + z1) / 2, WHT); for (let z = z0 + 0.06; z < z1; z += 0.13) B.box(0.03, 0.74, 0.03, x, F + 0.58, z, WHT); };
  railX(PX0 + 0.2, 4.0, PZ + 0.12); railX(5.4, PX1 - 0.2, PZ + 0.12); railZ(PZ + 0.2, WZ, PX0 + 0.12); railZ(PZ + 0.2, WZ, PX1 - 0.12);
  B.box(0.12, 0.7, 0.12, 4.0, F + 0.35, PZ + 0.12, WHT); B.box(0.12, 0.7, 0.12, 5.4, F + 0.35, PZ + 0.12, WHT);                      // pilaretes junto aos degraus
  // paredes de lambril do andar de cima (o quarto é do room.js: aqui só revestimos o lado de fora) + faixa entre os andares
  [[2.2, 2.7, -1.5, 1.35], [1.2, 2.7, 2.0, 1.35], [1.8, 0.95, 0.5, 0.475], [1.8, 0.55, 0.5, 2.425]].forEach(([w, h, x, y]) => wbox(B, w, h, 0.03, x, y, -2.415, SIDING));
  wbox(B, 0.03, 2.7, 4.7, -2.615, 1.35, 0, SIDING); wbox(B, 0.03, 2.7, 4.7, 2.615, 1.35, 0, SIDING);
  B.box(5.3, 0.2, 0.14, 0, -0.1, -2.37, WHT); B.box(0.14, 0.2, 4.74, -2.58, -0.1, 0, WHT); B.box(0.14, 0.2, 4.74, 2.58, -0.1, 0, WHT);
  B.box(2.0, 0.1, 0.05, 0.5, 2.2, -2.44, WHT); B.box(2.1, 0.07, 0.16, 0.5, 0.93, -2.47, WHT); B.box(0.1, 1.3, 0.05, -0.45, 1.55, -2.44, WHT); B.box(0.1, 1.3, 0.05, 1.45, 1.55, -2.44, WHT);   // moldura externa da janela do quarto
  // base de tijolo em volta da casa e blocos sólidos sob o corredor e o banheiro (antes flutuavam no ar)
  wbox(B, 12.78, FB, 0.14, 3.75, YG + FB / 2, -2.37, BRICK); wbox(B, 0.14, FB, 4.8, -2.57, YG + FB / 2, 0, BRICK); wbox(B, 0.14, FB, 4.8, 10.07, YG + FB / 2, 0, BRICK); wbox(B, 3.14, FB, 0.14, 8.55, YG + FB / 2, 2.42, BRICK); wbox(B, 4.14, FB, 0.14, 5.0, YG + FB / 2, 3.92, BRICK); wbox(B, 0.14, FB, 1.7, 7.12, YG + FB / 2, 3.15, BRICK);
  wbox(B, 5.55, -0.02 - YG, 1.55, 0.225, (YG - 0.02) / 2, 3.125, SIDING); wbox(B, 3.1, -0.02 - YG, 2.15, -1.0, (YG - 0.02) / 2, 4.975, SIDING);
  // telhados: casa de 2 andares, ala térrea, escada e ala do banheiro (cumeeiras cruzadas)
  gable(B, { x: 0.25, z: 0.75, y0: H, rise: 1.5, W: 6.3, L: 5.6, ovF: 0.5, ovB: 0.5, e0: 0.4, e1: 0.4, roof: ROOFM, wall: SIDING_DS });
  gable(B, { x: 5.025, z: 3.125, y0: H, rise: 0.4, W: 1.55, L: 4.05, ovF: 0.35, ovB: 0.35, e0: 0, e1: 0.35, roof: ROOFM, wall: SIDING_DS, c0: 0 });
  gable(B, { x: 6.3, z: -0.025, y0: CT, rise: 0.9, W: 4.75, L: 7.5, ovF: 0.5, ovB: 0, e0: 0, e1: 0.4, roof: ROOFM, wall: SIDING_DS, c0: 0 });
  B.at(-1.0, 0, 4.975, Math.PI / 2, b => gable(b, { y0: H, rise: 0.76, W: 3.1, L: 2.15, ovF: 0.45, ovB: 0.45, e0: 0.4, e1: 0, roof: ROOFM, wall: SIDING_DS }));
  wbox(B, 0.7, 4.95 - YG, 0.7, -2.95, (YG + 4.95) / 2, 0, BRICK); B.box(0.86, 0.1, 0.86, -2.95, 4.98, 0, CONC); B.box(0.34, 0.26, 0.34, -2.95, 5.16, 0, M.dsteel);   // chaminé de tijolo
  // venezianas (azul-marinho) e janela de baixo
  const shut = (x, y0s, y1s) => { B.box(0.28, y1s - y0s, 0.04, x, (y0s + y1s) / 2, -2.455, SHUT); [0.2, 0.4, 0.6, 0.8].forEach(k => B.box(0.22, 0.015, 0.05, x, y0s + (y1s - y0s) * k, -2.458, SHUT2)); };
  shut(-1.16, F + 0.9, F + 2.1); shut(1.16, F + 0.9, F + 2.1); shut(2.69, F + 0.9, F + 2.1); shut(6.71, F + 0.9, F + 2.1); shut(-0.66, 0.95, 2.15); shut(1.66, 0.95, 2.15);
  // porta vermelha com almofadas, número da casa, tapete, lanternas, bandeira, cadeiras e vasos
  D.front = mkDoor(G, { ax: 'x', c: -2.35, a: 4.7, w: 1.0, h: 2.1, y0: F, hinge: 1, ang: -1.75, col: 0x8f1d22, zones: ['jantar', 'pfront', 'porch', 'steps', 'lawn'] });
  { const pm = lm(0x761519); [-1, 1].forEach(sg => [[-0.21, 0.52, 0.3, 0.7], [0.21, 0.52, 0.3, 0.7], [-0.21, -0.45, 0.3, 0.6], [0.21, -0.45, 0.3, 0.6]].forEach(([x, y, w, h]) => { const m = new T.Mesh(new T.BoxGeometry(w, h, 0.012), pm); m.position.set(x, y, sg * 0.026); D.front.leaf.add(m); })); }
  { const k = cvs(128, 48), g = k.g; g.fillStyle = '#f5f2ec'; g.fillRect(0, 0, 128, 48); g.strokeStyle = '#2a2a2a'; g.lineWidth = 3; g.strokeRect(2, 2, 124, 44); g.fillStyle = '#1b1b1b'; g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1427', 64, 26); k.t.needsUpdate = true; vplane(G, 0.46, 0.17, PC, F + 2.31, WZ - 0.04, Math.PI, new T.MeshBasicMaterial({ map: k.t })); }
  { const k = cvs(130, 80), g = k.g; for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f4f4f4' : '#b22234'; g.fillRect(0, i * 80 / 13, 130, 80 / 13 + 1); } g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 55, 43); g.fillStyle = '#fff'; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) g.fillRect(5 + c * 8.5, 5 + r * 7.5, 2.4, 2.4); k.t.needsUpdate = true;
    const fm = new T.Mesh(new T.PlaneGeometry(0.6, 0.37), new T.MeshLambertMaterial({ map: k.t, side: T.DoubleSide })); fm.position.set(2.78, F + 1.9, PZ + 0.12); fm.rotation.y = Math.PI; G.add(fm); B.cyl(0.012, 0.012, 0.72, 2.78, F + 2.1, PZ + 0.12, M.dsteel, 6, 0, Math.PI / 2); B.box(0.1, 0.03, 0.03, 3.0, F + 2.1, PZ + 0.12, M.dsteel); }
  B.box(0.9, 0.02, 0.55, 4.7, F + 0.015, -2.8, lm(0x5a4632));
  { const m = own(0xfff6dd), ms = []; [4.03, 5.4].forEach(x => { const mesh = new T.Mesh(new T.BoxGeometry(0.12, 0.22, 0.12), m); mesh.position.set(x, F + 1.8, WZ - 0.1); G.add(mesh); ms.push(mesh); B.box(0.16, 0.03, 0.16, x, F + 1.93, WZ - 0.1, M.blk); B.box(0.16, 0.03, 0.16, x, F + 1.67, WZ - 0.1, M.blk); B.box(0.03, 0.1, 0.1, x, F + 1.8, WZ - 0.045, M.blk); });
    inter(ms, () => toggle('porch'), ['porch', 'pfront', 'steps', 'lawn']);
    lamp('porch', [PC, F + 1.95, -3.0], ['porch', 'pfront', 'steps', 'lawn', 'jantar'], { auto: () => !!lampSt.porch !== !!(VR.sky && VR.sky.cfg.dark > 0.4), col: 0xffd9a0, k: 0.85, dist: 7, emis: [{ m, c: 0xffd27a }] }); }   // acende sozinha ao anoitecer; o interruptor inverte
  sw(G, 5.38, F + 1.25, -2.408, 0, () => toggle('porch'), ['porch', 'pfront', 'steps', 'lawn']); sw(G, 5.38, F + 1.25, -2.318, Math.PI, () => toggle('porch'), ['jantar', 'pfront', 'porch']);
  chair(3.75, F, -3.5, Math.PI, WHP); chair(5.65, F, -3.5, Math.PI, WHP); plant(3.35, F, -2.8, 1.0); plant(6.05, F, -2.8, 1.0);
  D.bath = mkDoor(G, { ax: 'x', c: 3.85, a: -1.0, w: 0.9, h: 2.05, y0: 0, hinge: -1, ang: -1.75, col: 0xd9c4a4, zones: ['hall', 'pbath', 'bath'] });
  house.bedBody = P.staticBox(1.3, 1.05, 2.35, 0.48, 1.05, 0.03);
  B.flush(G);
  if (VR.outdoor) VR.outdoor.build(G);
  if (VR.garage) VR.garage.build(G);
  if (VR.market) VR.market.build(G);
}

// ---------- ligação com o quarto (room.js chama estas funções) ----------
house.mkDoor = mkDoor; house.NEAR = NEAR; house.AMB = AMB; house.Batch = Batch; house.lm = lm; house.own = own; house.inter = inter; house.gable = gable; house.WHT = WHT; house.cvs = cvs; house.rnd = rnd;
house.wall = wall; house.win = win; house.wbox = wbox; house.trim = trim; house.BRICK = BRICK; house.PAINT = PAINT; house.ROOFM = ROOFM; house.SIDING_DS = SIDING_DS; house.PASS = PASS;   // usados por garagem.js
house.enter = () => {
  if (!built) build();
  house.active = true; cur.lvl = 'up'; cur.room = 'bed'; house.y = 0; house.a = 1; house.roomF = 1;
  P.gnd.collisionFilterGroup = 0; P.gnd.collisionFilterMask = 0;                    // o plano do chão atrapalharia a escada e o térreo: as lajes da casa fazem o papel dele
  G.visible = true; house.snapLights(); if (VR.sky) VR.sky.snap();
};
house.exit = () => {
  house.active = false; G.visible = false; P.gnd.collisionFilterGroup = P.G.STATIC; P.gnd.collisionFilterMask = -1;
  snd.stopAll(); (house._water || []).forEach(f => f()); pool.forEach(pl => { pl.src = null; pl.f = 0; pl.L.intensity = 0; });
};
house.setVisible = (on, pass) => { G.visible = !!(on && !pass && built); };
house.update = (dt, t) => {
  if (!built) return;
  autoOpen(); anims.forEach(f => f(dt, t)); bodiesTick(); updLights(dt); snd.tick();
  house.y += (house.groundY() - house.y) * damp(12, dt); house.a += (house.amb() - house.a) * damp(4, dt); house.roomF += ((ROOMF[cur.room] || 0) - house.roomF) * damp(5, dt);
};
})();
