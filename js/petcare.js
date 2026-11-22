/* Cuidados dos bichos (ZHOPPE): 2 casinhas (cachorro e gato), pote de ração, pote de água e torneira no fundo da casa (parede dos fundos da garagem).
   - Ração: compre no mercado (prateleira de baixo da gôndola 3, "RAÇÃO PET"), leve para casa e SOLTE o pacote em cima do pote vermelho: o pote enche.
   - Água: pegue o pote azul, leve até a torneira (fundo da garagem), clique na torneira para abrir e deixe o pote embaixo dela. Clique de novo para fechar.
   - Os bichos vão sozinhos ao pote quando estão com fome ou sede, e à casinha quando estão cansados ou é noite (acordam de dia, ou se você tocar neles).
   Depende de zhoppe.js (VR.zhoppe, onde ficam as barras de status) e de house.js. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, H = VR.house, P = VR.phys, PL = VR.PL, S = VR.S, zh = VR.zhoppe, CAN = window.CANNON, clamp = VR.clamp;
if (!VR || !zh || !H || !P || !CAN) return;
const YG = H.YG, PI = Math.PI, lm = H.lm;
const sfx = (f, d, v) => { try { VR.ui.sfx(f, d, v); } catch (e) {} };
const toast = (m, ms) => { try { VR.ui.toast(m, ms); } catch (e) {} };
const care = zh.care = {};
const grp = new T.Group(); grp.visible = false; VR.scene.add(grp);
const nowS = () => performance.now() / 1000;
const rnd = (a, b) => a + Math.random() * (b - a);
const CAP = 200, EAT_RATE = 9, DRINK_RATE = 12, FILL_RATE = 45;                     // pote: 200 unidades (= 2 refeições cheias); come 9/s, bebe 12/s; torneira enche 45/s
const TAP = { x: 15.0, z: 3.72, y: YG + 0.46 };                                      // ponta da torneira (parede dos fundos da garagem, ao lado da janela)
const HOUSES = {
  dog: { x: 17.1, z: 5.2, W: 1.0, D: 1.0, Hh: 0.78, dw: 0.44, dh: 0.58, wall: 0xd9b27c, roof: 0xa8432b, bed: 0xc0392b, label: 'AUAU', slots: [-0.2, 0.2] },
  cat: { x: 11.2, z: 5.2, W: 0.78, D: 0.78, Hh: 0.6, dw: 0.34, dh: 0.46, wall: 0xf1e3c6, roof: 0x4a6fa5, bed: 0x2f6fe0, label: 'MIAU', slots: [-0.15, 0.15] }
};
const FLOOR = 0.09;                                                                   // altura do pé do bicho dentro da casinha (piso + almofada)
const BPOS = { food: [14.35, 5.05], water: [13.65, 5.05] };
let built = false;

// ---------- salvo no aparelho: quanto tem em cada pote ----------
const KEY = 'zhoppe_care';
const lv = { food: 0, water: 0 };
try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) { lv.food = clamp(+o.food || 0, 0, CAP); lv.water = clamp(+o.water || 0, 0, CAP); } } catch (e) {}
let saveT = 0, dirty = false;
const saveLv = () => { dirty = false; try { localStorage.setItem(KEY, JSON.stringify(lv)); } catch (e) {} };

// ====================================================== CONSTRUÇÃO ======================================================
const box = (g, w, h, d, x, y, z, col, ry) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), typeof col === 'number' ? lm(col) : col); m.position.set(x, y, z); if (ry) m.rotation.y = ry; g.add(m); return m; };
function signTex(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 96); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(5, 5, 246, 86);
  g.fillStyle = fg; g.font = '800 54px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 52);
  const t = new T.CanvasTexture(c); if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; return t;
}
function mkHouse(k) {
  const c = HOUSES[k], g = new T.Group(); g.position.set(c.x, YG, c.z); grp.add(g);
  const W = c.W, D = c.D, Hh = c.Hh, th = 0.05, R = 0.28, wallM = lm(c.wall), roofM = lm(c.roof), trim = lm(0x7a4a2a);
  box(g, W + 0.1, 0.06, D + 0.1, 0, 0.03, 0, lm(0x8a6a44));                                   // base de madeira
  box(g, W - 0.04, 0.02, D - 0.04, 0, 0.05, 0, lm(0xb58b5a));                                  // piso
  box(g, W, Hh, th, 0, 0.06 + Hh / 2, -D / 2 + th / 2, wallM);                                  // fundo
  [-1, 1].forEach(s => box(g, th, Hh, D, s * (W / 2 - th / 2), 0.06 + Hh / 2, 0, wallM));      // laterais
  const px = (W - c.dw) / 2;                                                                    // frente: dois pilares + verga em cima da porta
  [-1, 1].forEach(s => box(g, px, Hh, th, s * (c.dw / 2 + px / 2), 0.06 + Hh / 2, D / 2 - th / 2, wallM));
  box(g, c.dw, Hh - c.dh, th, 0, 0.06 + c.dh + (Hh - c.dh) / 2, D / 2 - th / 2, wallM);
  [-1, 1].forEach(s => box(g, 0.035, c.dh, 0.07, s * (c.dw / 2 + 0.0175), 0.06 + c.dh / 2, D / 2 - th / 2, trim));   // batente
  box(g, c.dw + 0.07, 0.035, 0.07, 0, 0.06 + c.dh + 0.0175, D / 2 - th / 2, trim);
  // empenas (triângulos) frente e fundo
  [-1, 1].forEach(s => { const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.BufferAttribute(new Float32Array([-W / 2, 0, 0, W / 2, 0, 0, 0, R, 0]), 3)); tri.computeVertexNormals();
    const m = new T.Mesh(tri, new T.MeshLambertMaterial({ color: c.wall, side: T.DoubleSide })); m.position.set(0, 0.06 + Hh, s * (D / 2 - th / 2)); g.add(m); });
  // telhado de duas águas (cumeeira ao longo de x)
  const th2 = Math.atan2(R, D / 2), Dh = D / 2 + 0.08, Ls = Dh / Math.cos(th2), yE = 0.06 + Hh + R - Dh * Math.tan(th2);
  [-1, 1].forEach(s => { const m = box(g, W + 0.16, 0.045, Ls, 0, yE + (Dh / 2) * Math.tan(th2) + 0.02, s * Dh / 2, roofM); m.rotation.x = -s * th2; });
  box(g, W + 0.16, 0.05, 0.07, 0, 0.06 + Hh + R + 0.03, 0, trim);                                // cumeeira
  // almofada dentro (uma por vaga) e plaquinha em cima da porta
  c.slots.forEach(o => { const cu = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.03, 18), lm(c.bed)); cu.position.set(o, 0.075, D / 2 - 0.12 - (k === 'dog' ? 0.23 : 0.17) ); g.add(cu); });
  const sg = new T.Mesh(new T.PlaneGeometry(0.34, 0.127), new T.MeshLambertMaterial({ map: signTex(c.label, '#fff6e0', k === 'dog' ? '#a8432b' : '#2c4f86') }));
  sg.position.set(0, 0.06 + Hh + 0.12, D / 2 + 0.004); g.add(sg);
  H.ob('down', c.x - W / 2, c.x + W / 2, c.z - D / 2, c.z + D / 2);                             // ninguém atravessa a casinha (o bichinho entra "por dentro" da porta)
  P.staticBox(c.x, YG + (Hh + 0.06) / 2, c.z, W / 2, (Hh + 0.06) / 2, D / 2);
}
function mkTap() {
  const g = new T.Group(), cu = lm(0xb87333), st = lm(0xc7ccd1); grp.add(g);
  const y = TAP.y + 0.06, wallZ = 3.5;
  box(g, 0.12, 0.12, 0.03, TAP.x, y, wallZ, st);                                                // flange na parede
  const pipe = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, TAP.z - wallZ, 12), cu); pipe.rotation.x = PI / 2; pipe.position.set(TAP.x, y, (TAP.z + wallZ) / 2); g.add(pipe);
  const spout = new T.Mesh(new T.CylinderGeometry(0.02, 0.014, 0.08, 12), cu); spout.position.set(TAP.x, y - 0.04, TAP.z); g.add(spout);
  const stem = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.05, 8), st); stem.position.set(TAP.x, y + 0.03, wallZ + 0.07); g.add(stem);
  const wheel = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.014, 14), lm(0xd63a3a)); wheel.position.set(TAP.x, y + 0.062, wallZ + 0.07); g.add(wheel);
  const bar = new T.Mesh(new T.BoxGeometry(0.1, 0.016, 0.016), lm(0xb02a2a)); bar.position.copy(wheel.position); bar.position.y += 0.01; g.add(bar);
  const hit = new T.Mesh(new T.SphereGeometry(0.15, 8, 6), new T.MeshBasicMaterial({ visible: false })); hit.position.set(TAP.x, y, wallZ + 0.1); g.add(hit);
  const sm = new T.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
  const stream = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 1, 8, 1, true), sm); stream.visible = false; grp.add(stream);
  const rip = new T.Mesh(new T.CircleGeometry(0.05, 16), new T.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.55, depthWrite: false, fog: false })); rip.rotation.x = -PI / 2; rip.visible = false; grp.add(rip);
  tap.wheel = wheel; tap.bar = bar; tap.stream = stream; tap.rip = rip;
  const it = H.inter([wheel, bar, pipe, spout, hit], () => setTap(!tap.on), ['quintal', 'lawn', 'lawn2', 'pgd']);
  tap.it = it;
}
const tap = { on: false, t: 0, spin: 0 };
function setTap(v) {
  tap.on = v; tap.t = 0; if (tap.stream) tap.stream.visible = tap.rip.visible = v; sfx(v ? 700 : 500, 0.07); flowOn(v);
  if (v) toast('Torneira aberta. Coloque o pote azul embaixo da torneira.', 2600);
}
function build() {
  if (built) return; built = true;
  mkHouse('dog'); mkHouse('cat'); mkTap();
}

// ---------- som da água ----------
const flow = { s: null, g: null, c: null, ctx: null, buf: null };
function flowOn(v) {
  try {
    if (v) {
      if (flow.s) return; const A = window.AudioContext || window.webkitAudioContext; if (!A) return; if (!flow.ctx) flow.ctx = new A(); const c = flow.ctx; if (c.state === 'suspended') c.resume().catch(() => {});
      if (!flow.buf) { const n = (c.sampleRate * 1.5) | 0; flow.buf = c.createBuffer(1, n, c.sampleRate); const d = flow.buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
      const s = c.createBufferSource(); s.buffer = flow.buf; s.loop = true; const f1 = c.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = 1800;
      const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 9000; const gn = c.createGain(); gn.gain.value = 0;
      s.connect(f1); f1.connect(f2); f2.connect(gn); gn.connect(c.destination); s.start(); flow.s = s; flow.g = gn; flow.c = c;
    } else if (flow.s) { const s = flow.s, gn = flow.g, c = flow.c; gn.gain.setTargetAtTime(0, c.currentTime, 0.1); setTimeout(() => { try { s.stop(); } catch (e) {} }, 700); flow.s = null; flow.g = null; }
  } catch (e) {}
}

// ====================================================== POTES (objetos que se pega) ======================================================
const bowlOf = k => P.props.filter(p => p.bk === k);
function mkBowl(k) {
  const food = k === 'food', col = food ? 0xd8453a : 0x3a8fd8, g = new T.Group();
  const bm = new T.MeshLambertMaterial({ color: col, side: T.DoubleSide });
  g.add(new T.Mesh(new T.CylinderGeometry(0.13, 0.095, 0.07, 22, 1, true), bm));
  const base = new T.Mesh(new T.CylinderGeometry(0.095, 0.095, 0.012, 22), bm); base.position.y = -0.029; g.add(base);
  const rim = new T.Mesh(new T.TorusGeometry(0.13, 0.008, 6, 22), new T.MeshLambertMaterial({ color: 0xf2f2f2 })); rim.rotation.x = PI / 2; rim.position.y = 0.035; g.add(rim);
  const stripe = new T.Mesh(new T.CylinderGeometry(0.1225, 0.1135, 0.012, 22, 1, true), new T.MeshLambertMaterial({ color: 0xffffff, side: T.DoubleSide })); stripe.position.y = 0.012; g.add(stripe);
  let fill;
  if (food) { fill = new T.Mesh(new T.SphereGeometry(0.115, 14, 8), new T.MeshLambertMaterial({ color: 0x8a5a2b })); fill.position.y = -0.03; }
  else { fill = new T.Mesh(new T.CircleGeometry(0.118, 22), new T.MeshBasicMaterial({ color: 0x4cc3ff, transparent: true, opacity: 0.82, depthWrite: false })); fill.rotation.x = -PI / 2; }
  fill.visible = false; g.add(fill); grp.add(g);
  const pos = BPOS[k], p = P.addProp({ mesh: g, shapes: [{ shape: new CAN.Box(new CAN.Vec3(0.125, 0.035, 0.125)) }], mass: 0.5, pos: [pos[0], YG + 0.037, pos[1]], r: 0.16, name: food ? 'pote de ração' : 'pote de água', damping: 0.2, adamp: 0.5 });
  p.bk = k; p.fill = fill; p.shown = -1; p.spillT = 0; return p;
}
function spawnBowls() { clearBowls(); mkBowl('food'); mkBowl('water'); }
function clearBowls() {
  bowlOf('food').concat(bowlOf('water')).forEach(p => { try { P.world.removeBody(p.b); } catch (e) {} const i = P.props.indexOf(p); if (i >= 0) P.props.splice(i, 1); if (p.mesh.parent) p.mesh.parent.remove(p.mesh); });
  P.rebuildPick();
}
function bowlVis(p) {
  const v = lv[p.bk], key = Math.round(v / 2); if (key === p.shown) return; p.shown = key;
  const f = clamp(v / CAP, 0, 1); p.fill.visible = v > 0.5;
  if (p.bk === 'food') p.fill.scale.set(1, 0.18 + 0.45 * f, 1); else p.fill.position.y = -0.032 + 0.064 * f;
}

// ====================================================== BICHOS ======================================================
const ensure = p => p.cs || (p.cs = { sleeping: false, inside: false, path: null, pi: 0, dir: '', res: null, eating: false, bowl: null, wake: false, noSleep: 0, giveUp: {}, sp: null, spT: 0, prog: 1e9, progT: 0, sleepT: 0, snT: 0 });
let nightF = false;
const isNight = () => { const d = VR.sky && VR.sky.cfg ? VR.sky.cfg.dark : 0; if (d > 0.55) nightF = true; else if (d < 0.35) nightF = false; return nightF; };
const slotOf = (p, hs) => Object.keys(zh.live).map(k => zh.live[k]).filter(q => q.kind === p.kind).sort((a, b) => a.id - b.id).indexOf(p) % hs.slots.length;
const pts = (p, hs) => {
  const si = Math.max(0, slotOf(p, hs)), off = hs.slots[si], front = hs.z + hs.D / 2;
  return { A: { x: hs.x, z: front + 0.62 }, Dp: { x: hs.x, z: front - 0.02 }, W1: { x: hs.x + off, z: front - 0.18 }, I: { x: hs.x + off, z: front - 0.12 - p.D.bl / 2 } };
};
function setPath(p, cs, hs, dir) {
  const q = pts(p, hs); cs.dir = dir; cs.pi = 0;
  cs.path = dir === 'in' ? [q.Dp, q.W1, q.I] : [q.W1, q.Dp, q.A];
}
function standPoint(p, b) {
  const r = p.kind === 'dog' ? 0.4 : 0.31, bx = b.b.position.x, bz = b.b.position.z; let best = null, bd = 1e9;
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, x = bx + Math.sin(a) * r, z = bz + Math.cos(a) * r; if (!zh.okPos(x, z)) continue; const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = { x, z }; } }
  return best;
}
const bowlOK = b => b && P.props.indexOf(b) >= 0 && b.b.type === CAN.Body.DYNAMIC && b.b.position.y < YG + 0.4 && lv[b.bk] > 0.5;
const pickBowl = (k, p) => { let best = null, bd = 1e9; bowlOf(k).forEach(b => { if (!bowlOK(b)) return; const d = Math.hypot(b.b.position.x - p.x, b.b.position.z - p.z); if (d < bd) { bd = d; best = b; } }); return best; };
function resetFlags(p, cs) { cs.eating = false; cs.res = null; cs.bowl = null; p.eatW = 0; }

care.touch = p => {                                          // tocar, pegar ou abrir o menu: acorda e tira o bicho da casinha
  const cs = ensure(p); resetFlags(p, cs); cs.noSleep = nowS() + 30;
  if (cs.inside) { const hs = HOUSES[p.kind], q = pts(p, hs); p.x = q.A.x; p.z = q.A.z; cs.inside = false; cs.sleeping = false; cs.path = null; p.lieW = 0; p.floorAdd = 0; p.lastGood = { x: p.x, z: p.z }; }
  cs.sleeping = false; p.lieW = 0;
};
care.gone = p => { if (p.cs) { p.cs.inside = false; p.cs.sleeping = false; } };

function walkPath(p, cs) {
  const w = cs.path[cs.pi]; if (!w) return null;
  if (Math.hypot(w.x - p.x, w.z - p.z) < 0.1) { cs.pi++; if (cs.dir === 'in' && cs.pi === 1) p.floorAdd = FLOOR; if (cs.dir === 'out' && cs.pi === 2) p.floorAdd = 0; return walkPath(p, cs); }
  return { walk: true, tx: w.x, tz: w.z, speed: p.kind === 'dog' ? 0.8 : 0.65, ghost: true };
}
function planInside(p, cs, hs, s, night, t) {
  if (cs.sleeping) {
    const starving = s.h < 10 || s.t < 10;
    if (cs.wake || starving || (!night && s.en >= 60) || t - cs.sleepT > 900) {                       // acordou: sai pela porta
      cs.sleeping = false; cs.wake = false; cs.noSleep = t + 25; p.lieW = 0; setPath(p, cs, hs, 'out'); sfx(600, 0.05, 0.03);
    } else {
      const q = pts(p, hs); p.lieW = 1; p.eatW = 0; p.floorAdd = FLOOR; p.x = q.I.x; p.z = q.I.z;
      return { walk: false, tx: p.x, tz: p.z, face: 0 };
    }
  }
  if (!cs.path) { cs.inside = false; p.floorAdd = 0; return null; }
  const r = walkPath(p, cs);
  if (r) return r;
  if (cs.dir === 'in') { cs.sleeping = true; cs.sleepT = t; p.lieW = 1; const q = pts(p, hs); return { walk: false, tx: q.I.x, tz: q.I.z, face: 0 }; }
  cs.inside = false; cs.path = null; p.floorAdd = 0; return null;                                      // saiu
}

care.plan = (p, dt, c) => {
  if (!built) return null;
  const cs = ensure(p), hs = HOUSES[p.kind], s = p.e.s, t = nowS(), night = isNight();
  if (!hs || !s) return null;
  if (cs.inside) return planInside(p, cs, hs, s, night, t);
  if (!cs.eating && p.eatW > 0) p.eatW = 0;
  if (p.lieW > 0) p.lieW = 0;
  // ----- comendo / bebendo agora -----
  if (cs.eating) {
    const b = cs.bowl, stat = cs.res === 'food' ? 'h' : 't';
    if (!bowlOK(b) || s[stat] >= 98 || cs.wake || Math.hypot(b.b.position.x - p.x, b.b.position.z - p.z) > 0.8) { resetFlags(p, cs); cs.wake = false; }
    else {
      const rate = cs.res === 'food' ? EAT_RATE : DRINK_RATE, g = Math.min(lv[b.bk], rate * dt); lv[b.bk] -= g; dirty = true; s[stat] = Math.min(100, s[stat] + g);
      p.eatW = 1; p.eatF = cs.res === 'food' ? 9 : 6; cs.snT -= dt; if (cs.snT <= 0) { cs.snT = cs.res === 'food' ? 0.28 : 0.2; sfx(cs.res === 'food' ? rnd(260, 340) : rnd(520, 640), 0.035, 0.03); }
      if (s[stat] >= 98 && s.j < 100) s.j = Math.min(100, s.j + 4);
      return { walk: false, tx: p.x, tz: p.z, face: Math.atan2(b.b.position.x - p.x, b.b.position.z - p.z) };
    }
  }
  // ----- dormir -----
  const needSleep = t > cs.noSleep && t > (cs.giveUp.sleep || 0) && !(s.h < 25 || s.t < 25) && (s.en < 22 || (night && s.en < 92));
  if (needSleep) {
    const q = pts(p, hs), d = Math.hypot(q.A.x - p.x, q.A.z - p.z);
    if (d < 0.2) { cs.inside = true; setPath(p, cs, hs, 'in'); return walkPath(p, cs); }
    return approach(p, cs, q.A, 'sleep', t, c.wlk * 1.2, null);
  }
  // ----- comer ou beber (o que estiver pior) -----
  let res = null, bowl = null;
  const bf = s.h < 55 && t > (cs.giveUp.food || 0) ? pickBowl('food', p) : null, bw = s.t < 55 && t > (cs.giveUp.water || 0) ? pickBowl('water', p) : null;
  if (bf && (!bw || s.h <= s.t)) { res = 'food'; bowl = bf; } else if (bw) { res = 'water'; bowl = bw; }
  if (res) {
    if (!cs.sp || cs.spBowl !== bowl || t - cs.spT > 0.6) { cs.sp = standPoint(p, bowl); cs.spBowl = bowl; cs.spT = t; }
    if (!cs.sp) { cs.giveUp[res] = t + 40; return null; }
    const d = Math.hypot(cs.sp.x - p.x, cs.sp.z - p.z);
    if (d < 0.14) { cs.eating = true; cs.res = res; cs.bowl = bowl; cs.snT = 0; cs.prog = 1e9; return { walk: false, tx: p.x, tz: p.z, face: Math.atan2(bowl.b.position.x - p.x, bowl.b.position.z - p.z) }; }
    return approach(p, cs, cs.sp, res, t, (res === 'food' ? s.h : s.t) < 25 ? c.run * 0.8 : c.wlk * 1.3, bowl);
  }
  cs.sp = null; cs.prog = 1e9;
  return null;
};
function approach(p, cs, target, key, t, speed, bowl) {                                 // anda até o alvo; se ficar preso por muito tempo, desiste por um tempo
  const d = Math.hypot(target.x - p.x, target.z - p.z);
  if (d < cs.prog - 0.15) { cs.prog = d; cs.progT = t; } else if (t - cs.progT > 6) { cs.giveUp[key] = t + 45; cs.prog = 1e9; return null; }
  return { walk: true, tx: target.x, tz: target.z, speed, face: undefined };
}

// ====================================================== POR QUADRO ======================================================
let tkR = 0, warnT = 0;
VR.hook(31, dt => {
  const on = !!H.active && !S.pass; grp.visible = on && built;
  if (!on || !built) { if (tap.on) setTap(false); return; }
  const tt = nowS();
  // torneira: gira o volante, desenha o jato e enche o pote azul que estiver embaixo
  if (tap.on) {
    tap.t += dt; tap.spin += dt * 4; tap.wheel.rotation.y = tap.spin * 0.2; tap.bar.rotation.y = tap.spin * 0.2;
    let under = null; bowlOf('water').forEach(b => { if (Math.abs(b.b.position.x - TAP.x) < 0.11 && Math.abs(b.b.position.z - TAP.z) < 0.11 && b.b.position.y < TAP.y - 0.04 && b.b.position.y > YG - 0.1) under = b; });
    let sy = YG + 0.012;
    if (under) { const up = 1 - 2 * (under.b.quaternion.x * under.b.quaternion.x + under.b.quaternion.z * under.b.quaternion.z), f = clamp(lv.water / CAP, 0, 1); sy = under.b.position.y - 0.032 + 0.064 * f; if (up > 0.8) { const was = lv.water; lv.water = Math.min(CAP, lv.water + FILL_RATE * dt); dirty = true; if (was < CAP && lv.water >= CAP) { sfx(900, 0.08, 0.05); toast('Pote de água cheio!', 1800); } } }
    const len = Math.max(0.02, TAP.y - sy), j = 1 + 0.15 * Math.sin(tap.t * 40);
    tap.stream.scale.set(j, len, j); tap.stream.position.set(TAP.x, sy + len / 2, TAP.z);
    tap.rip.position.set(TAP.x, sy + 0.004, TAP.z); tap.rip.scale.setScalar(1 + 0.3 * Math.abs(Math.sin(tap.t * 9)));
    if (flow.g) { const d = Math.hypot(PL.x - TAP.x, PL.z - TAP.z); flow.g.gain.setTargetAtTime(0.14 * clamp(1 - d / 14, 0.12, 1), flow.c.currentTime, 0.15); }
    if (tap.t > 45) { setTap(false); toast('A torneira fechou sozinha', 1800); }
  }
  // potes: desenho do conteúdo e derramar se virar de cabeça para baixo
  bowlOf('food').concat(bowlOf('water')).forEach(b => {
    bowlVis(b); const q = b.b.quaternion, up = 1 - 2 * (q.x * q.x + q.z * q.z);
    if (up < 0.45 && lv[b.bk] > 1) { b.spillT += dt; if (b.spillT > 0.15) { lv[b.bk] = 0; dirty = true; b.shown = -1; b.spillT = 0; sfx(b.bk === 'food' ? 330 : 480, 0.12, 0.05); toast(b.bk === 'food' ? 'A ração caiu no chão' : 'A água derramou', 2200); } } else b.spillT = 0;
  });
  // pacote de ração solto em cima do pote vermelho: enche o pote e o pacote some
  tkR += dt; if (tkR > 0.12) { tkR = 0; const fb = bowlOf('food')[0], mk = VR.market;
    if (fb && mk && mk.api) for (const p of P.props) {
      if (p.kind !== 'prod' || p.type !== 'racao' || p.b.type !== CAN.Body.DYNAMIC) continue;
      const b = p.b.position, c = fb.b.position;
      if (Math.hypot(b.x - c.x, b.z - c.z) < 0.2 && b.y > c.y - 0.02 && b.y < c.y + 0.7 && p.b.velocity.length() < 4) {
        if (lv.food > CAP - 5) { if (tt - warnT > 2) { warnT = tt; toast('O pote de ração já está cheio', 1800); } continue; }
        lv.food = CAP; dirty = true; fb.shown = -1; mk.api.dropProp(p); sfx(300, 0.06, 0.05); setTimeout(() => sfx(360, 0.06, 0.05), 70); setTimeout(() => sfx(280, 0.08, 0.05), 150); toast('Ração colocada no pote!', 2200); break;
      }
    } }
  saveT += dt; if (dirty && saveT > 3) { saveT = 0; saveLv(); }
});
addEventListener('pagehide', () => { if (dirty) saveLv(); });

// ====================================================== LIGAÇÃO COM A CASA (potes nascem ao entrar, somem ao sair) ======================================================
{ const enter0 = H.enter, exit0 = H.exit;
  H.enter = function () { const r = enter0.apply(this, arguments); try { build(); spawnBowls(); } catch (e) { VR.log('petcare: ' + e.message); } return r; };
  H.exit = function () { try { if (built) { clearBowls(); if (tap.on) setTap(false); if (dirty) saveLv(); } } catch (e) {} return exit0.apply(this, arguments); };
}
care.lv = lv; care.HOUSES = HOUSES; care.tap = tap; care.setTap = setTap;
})();
