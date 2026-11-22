/* Vizinhos (NPCs): cada casa do bairro tem um morador com seu cachorro. Eles saem de casa, passeiam pela rua, vão ao mercado
   (pegam produtos das prateleiras, entram na fila do caixa, pagam e levam a sacola para casa) e reagem a você: olham, acenam e cumprimentam.
   Depende de house.js (portas das casas), outdoor.js (casas) e mercado.js (VR.market.api). Cada NPC é uma "rotina" (gerador) que roda um passo por quadro. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, H = VR.house, PL = VR.PL, clamp = VR.clamp, damp = VR.damp, mk = VR.market;
const YG = H.YG, YS = YG - 0.14, YF = YG + 0.12, FLY = YG + 0.17, PI = Math.PI;
const npc = VR.npc = { built: false, list: [], group: null, ST: { count: 0, queue: [], busy: null } }, ST = npc.ST;
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const sfx = (f, d) => { try { VR.ui.sfx(f, d); } catch (e) {} };
let DT = 1 / 60, TT = 0;

// ====================================================== MAPA DE CAMINHOS (grafo) ======================================================
// calçadas: norte (z = ZN, casas do lado norte) e sul (z = ZS); XP = esquina do mercado; dentro do mercado: corredores livres de prateleiras
const ZN = -13.3, ZS = -24.0, XP = 76.5, ZD = -18.5, r2 = v => Math.round(v * 100) / 100;
const HOUSES = [[-17, -2.4, 1, 12, 1], [27, -2.4, 1, 12.5, -1], [-39, -2.4, 1, 11, 1], [49, -2.4, 1, 12, -1], [-30, -37, -1, 11, 1], [-9, -37, -1, 12, -1], [14, -37, -1, 12, 1], [37, -37, -1, 11.5, -1], [60, -37, -1, 12, 1], [-62, -2.4, 1, 12, 1], [-85, -2.4, 1, 11.5, -1], [-108, -2.4, 1, 12, 1], [-53, -37, -1, 12, -1], [-76, -37, -1, 11.5, 1], [-99, -37, -1, 12, -1]];   // [cx, zf, face, w, garagem] como em outdoor.js
const N = [], node = (x, z) => (N.push({ x, z, adj: [] }), N.length - 1), link = (a, b) => { N[a].adj.push(b); N[b].adj.push(a); };
const hs = HOUSES.map(([cx, zf, face, w, ga], id) => { const drx = ga ? -ga * (w / 2 - 2.0) * 0.8 : 0, dx = r2(face > 0 ? cx + drx : cx - drx); return { id, cx, zf, face, dx, home: [dx, zf + face * 0.3], outZ: zf - face * 1.2, laneZ: face > 0 ? ZN : ZS, door: 'nb' + id + 'p' }; });
const GRID = [-120, -108, -96, -84, -72, -60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60, XP];
const lane = (z, extra) => { const xs = [...new Set(GRID.concat(extra))].sort((a, b) => a - b), m = {}; let prev = -1; xs.forEach(x => { const id = node(x, z); m[x] = id; if (prev >= 0) link(prev, id); prev = id; }); return m; };
const LN = lane(ZN, hs.filter(h => h.face > 0).map(h => h.dx)), LS = lane(ZS, hs.filter(h => h.face < 0).map(h => h.dx));
GRID.forEach(x => link(LN[x], LS[x]));
hs.forEach(h => { h.out = node(h.dx, h.outZ); link(h.out, (h.face > 0 ? LN : LS)[h.dx]); });
const ID = {}; const nm = (k, x, z) => (ID[k] = node(x, z));
nm('X1', XP, ZD); link(ID.X1, LN[XP]); link(ID.X1, LS[XP]);
nm('PG', -124, ZD); link(ID.PG, LN[-120]); link(ID.PG, LS[-120]);                        // portão da praça (praca.js liga o resto)
nm('DP', 78.9, ZD); nm('D', 82.0, ZD); nm('QA', 83.6, ZD); nm('M1', 87.4, ZD); nm('M2', 97.2, ZD); nm('E', 102.0, ZD);
[['X1', 'DP'], ['DP', 'D'], ['D', 'QA'], ['QA', 'M1'], ['M1', 'M2'], ['M2', 'E']].forEach(([a, b]) => link(ID[a], ID[b]));
nm('W26', 87.4, -26.0); nm('W23', 87.4, -23.6); nm('W21', 87.4, -21.2); nm('W14', 87.4, -14.4); nm('W11', 87.4, -11.2);
[['W26', 'W23'], ['W23', 'W21'], ['W21', 'M1'], ['M1', 'W14'], ['W14', 'W11']].forEach(([a, b]) => link(ID[a], ID[b]));
function path(a, b) {                                                          // Dijkstra simples: devolve os ids dos nós depois de a até b
  const dist = N.map(() => 1e9), prev = N.map(() => -1), done = N.map(() => false); dist[a] = 0;
  for (;;) { let u = -1; for (let i = 0; i < N.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i; if (u < 0 || dist[u] >= 1e9 || u === b) break; done[u] = true;
    N[u].adj.forEach(v => { const d = dist[u] + Math.hypot(N[u].x - N[v].x, N[u].z - N[v].z); if (d < dist[v]) { dist[v] = d; prev[v] = u; } }); }
  const out = []; for (let c = b; c >= 0 && c !== a; c = prev[c]) out.unshift(c); return out;
}
const LANE_IDS = Object.values(LN).concat(Object.values(LS));
const QX = 83.6, QZ = -23.25, qpos = i => [QX, QZ + 0.8 * i];                    // fila do caixa: o primeiro encosta na esteira, os outros formam fila para +z
const groundAt = (x, z) => (x > 80.4 && x < 103.6 && z > -27.6 && z < -9.4) ? YF : (x >= 59 && x < 112 && z > -36.5 && z < -2.5) ? YG + 0.05 : (x > -122 && z < -13.5 && z > -23.5) ? YS : YG;

// ====================================================== MODELOS ======================================================
const SKINS = [0xf1c8a0, 0xe0ac7e, 0xc68a63, 0x9a6540, 0x6e4529], HAIRS = [0x24160f, 0x4a2c17, 0x8a5a2b, 0xd0b060, 0x1a1a1a, 0x7a2a1a, 0xb8b8b8];
const SHIRTS = [0x2f6db5, 0xc0392b, 0x2e8b57, 0xe0a030, 0x8e44ad, 0x34495e, 0xe67e22, 0x16a085, 0xd35c8a, 0x5d6d7e], PANTS = [0x2b3445, 0x3a3f4a, 0x5b4636, 0x1f2a3a, 0x4a5568];
const DOGS = [0x8a5a33, 0x1c1c1e, 0xd6b26a, 0xf2efe8, 0x8a8f96, 0xa86a3a];
let G_ = null;
const geos = () => G_ || (G_ = { leg: new T.CylinderGeometry(0.062, 0.052, 0.84, 7), shoe: new T.BoxGeometry(0.11, 0.07, 0.24), torso: new T.BoxGeometry(0.42, 0.58, 0.24), arm: new T.CylinderGeometry(0.048, 0.04, 0.58, 7), hand: new T.SphereGeometry(0.05, 7, 5),
  head: new T.SphereGeometry(0.115, 12, 9), hair: new T.SphereGeometry(0.12, 12, 8, 0, PI * 2, 0, PI * 0.55), skirt: new T.CylinderGeometry(0.17, 0.27, 0.46, 10), long: new T.BoxGeometry(0.2, 0.34, 0.07), cap: new T.BoxGeometry(0.17, 0.014, 0.12), eye: new T.SphereGeometry(0.014, 6, 5),
  dBody: new T.BoxGeometry(0.17, 0.2, 0.46), dHead: new T.BoxGeometry(0.14, 0.14, 0.15), dSnout: new T.BoxGeometry(0.075, 0.065, 0.1), dEar: new T.BoxGeometry(0.035, 0.09, 0.05), dLeg: new T.CylinderGeometry(0.028, 0.024, 0.3, 6), dTail: new T.CylinderGeometry(0.016, 0.022, 0.24, 6), dNose: new T.SphereGeometry(0.02, 6, 5) });
const NPCM = new T.MeshLambertMaterial({ vertexColors: true });
function mergeC(items) {                                                         // junta peças numa só malha, com a cor de cada peça nos vértices
  let nv = 0, ni = 0; items.forEach(o => { nv += o.g.attributes.position.count; ni += o.g.index ? o.g.index.count : o.g.attributes.position.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0;
  items.forEach(o => { const p = o.g.attributes.position, nn = o.g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const k = (vo + i) * 3; pos[k] = p.getX(i) + o.x; pos[k + 1] = p.getY(i) + o.y; pos[k + 2] = p.getZ(i) + o.z; nor[k] = nn.getX(i); nor[k + 1] = nn.getY(i); nor[k + 2] = nn.getZ(i); col[k] = o.c.r; col[k + 1] = o.c.g; col[k + 2] = o.c.b; }
    if (o.g.index) { for (let i = 0; i < o.g.index.count; i++) idx[io + i] = o.g.index.array[i] + vo; io += o.g.index.count; } else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; } vo += p.count; });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(new T.BufferAttribute(idx, 1)); return g;
}
function makeHuman(n) {
  const G = geos(), lm = H.lm, g = new T.Group(), body = new T.Group(); g.add(body);
  const skin = lm(pick(SKINS)), shirt = lm(pick(SHIRTS)), pants = lm(pick(PANTS)), hair = lm(pick(HAIRS)), shoe = lm(0x1b1b1f), fem = Math.random() < 0.5, capOn = !fem && Math.random() < 0.3;
  const all = [], part = par => { const list = []; return { add(geo, m, x, y, z) { list.push({ g: geo, c: m.color, x, y, z }); all.push({ g: geo, c: m.color, x: x + par.position.x, y: y + par.position.y, z: z + par.position.z }); }, done() { par.add(new T.Mesh(mergeC(list), NPCM)); } }; };
  const core = new T.Group(); body.add(core); const pc = part(core);
  n.legs = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * 0.1, 0.88, 0); body.add(p); const q = part(p); q.add(G.leg, fem ? skin : pants, 0, -0.43, 0); q.add(G.shoe, shoe, 0, -0.85, 0.04); q.done(); return p; });
  if (fem) pc.add(G.skirt, lm(pick(PANTS.concat(SHIRTS))), 0, 0.78, 0);
  pc.add(G.torso, shirt, 0, 1.2, 0); pc.done();
  n.arms = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * 0.27, 1.43, 0); body.add(p); const q = part(p); q.add(G.arm, shirt, 0, -0.27, 0); q.add(G.hand, skin, 0, -0.59, 0); q.done(); return p; });
  n.head = new T.Group(); n.head.position.set(0, 1.52, 0); body.add(n.head); const ph = part(n.head);
  ph.add(G.head, skin, 0, 0.13, 0); ph.add(G.hair, hair, 0, 0.145, -0.008); [-1, 1].forEach(s => ph.add(G.eye, lm(0x15171a), s * 0.04, 0.15, 0.105));
  if (fem) ph.add(G.long, hair, 0, 0.06, -0.085); if (capOn) ph.add(G.cap, lm(pick(SHIRTS)), 0, 0.2, 0.13); ph.done();
  n.imp = new T.Mesh(mergeC(all), NPCM); n.imp.visible = false; g.add(n.imp);                                  // de longe (> 28 m): 1 peça só
  n.carryG = new T.Group(); n.carryG.position.set(0, 1.0, 0.3); body.add(n.carryG);
  n.body = body; g.visible = false; return g;
}
function makeDog(n) {
  const G = geos(), lm = H.lm, g = new T.Group(), col = pick(DOGS), m = lm(col), dk = lm(col === 0x1c1c1e ? 0x2a2a2e : 0x4a3220), body = new T.Group(); g.add(body);
  const add = (geo, mat, x, y, z, par) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); (par || body).add(o); return o; };
  add(G.dBody, m, 0, 0.4, 0);
  const d = { g, body, legs: [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const p = new T.Group(); p.position.set(sx * 0.065, 0.32, sz * 0.17); body.add(p); add(G.dLeg, m, 0, -0.15, 0, p); return p; }) };
  d.head = new T.Group(); d.head.position.set(0, 0.5, 0.27); body.add(d.head); add(G.dHead, m, 0, 0.04, 0.02, d.head); add(G.dSnout, dk, 0, 0.01, 0.11, d.head); add(G.dNose, lm(0x111111), 0, 0.03, 0.165, d.head); [-1, 1].forEach(s => add(G.dEar, dk, s * 0.065, 0.1, 0, d.head));
  d.tail = new T.Group(); d.tail.position.set(0, 0.46, -0.24); body.add(d.tail); add(G.dTail, m, 0, 0.1, 0, d.tail).rotation.x = -0.5;
  d.x = d.z = d.y = 0; d.yaw = 0; d.amp = 0; d.ph = 0; d.sit = 0; d.sniff = 0; d.idle = 0; g.visible = false; return d;
}
const bubble = n => { if (n.bub) return n.bub; const k = H.cvs(256, 64); n.bubC = k; n.bub = new T.Sprite(new T.SpriteMaterial({ map: k.t, transparent: true, opacity: 0, depthWrite: false })); n.bub.scale.set(0.95, 0.2375, 1); npc.group.add(n.bub); return n.bub; };
function say(n, s, dur) {
  const b = bubble(n), g = n.bubC.g; g.clearRect(0, 0, 256, 64); g.fillStyle = 'rgba(255,255,255,.96)'; g.strokeStyle = '#2b3445'; g.lineWidth = 4; g.beginPath(); if (g.roundRect) g.roundRect(4, 4, 248, 42, 16); else g.rect(4, 4, 248, 42); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(118, 46); g.lineTo(128, 62); g.lineTo(138, 46); g.fill(); let fs = 26; g.font = '800 ' + fs + 'px Arial, sans-serif'; while (g.measureText && g.measureText(s).width > 226 && fs > 14) { fs -= 2; g.font = '800 ' + fs + 'px Arial, sans-serif'; }
  g.fillStyle = '#1b2030'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 128, 26); n.bubC.t.needsUpdate = true; n.sayT = dur || 2.4;
}
const greeting = () => { const id = VR.sky ? VR.sky.id() : 'day'; return pick(id === 'night' ? ['Boa noite!', 'Oi!', 'Tudo bem?'] : id === 'aft' || id === 'sunset' ? ['Boa tarde!', 'Oi!', 'Tudo bem?', 'E aí!'] : ['Bom dia!', 'Oi!', 'Olá!', 'Tudo bem?', 'E aí!']); };

// ====================================================== ROTINAS (geradores: cada yield = um quadro) ======================================================
function stepTo(n, x, z, sp) {                                                  // anda um passo em direção ao ponto; devolve a distância restante
  const dx = x - n.x, dz = z - n.z, d = Math.hypot(dx, dz);
  if (d < 0.06) { n.moving = false; return d; }
  if (n.pause > 0) { n.moving = false; return d; }
  if ((dx * (PL.x - n.x) + dz * (PL.z - n.z)) > 0 && Math.hypot(PL.x - n.x, PL.z - n.z) < 0.85 && n.vis) { n.moving = false; n.yawT = Math.atan2(dx, dz); return d; }    // você está na frente: espera
  const k = Math.min(1, (sp || n.sp) * DT / d); n.x += dx * k; n.z += dz * k; n.yawT = Math.atan2(dx, dz); n.moving = true; return d - (sp || n.sp) * DT;
}
function* goto(n, x, z, sp) { while (stepTo(n, x, z, sp) > 0.06) yield; n.moving = false; }
function* route(n, to) { for (const id of path(n.at, to)) { yield* goto(n, N[id].x, N[id].z); n.at = id; } }
function* wait(n, s) { n.moving = false; while (s > 0) { s -= DT; yield; } }
function* idle(n, s) { n.moving = false; let t = rnd(1, 2.5); while (s > 0) { s -= DT; t -= DT; if (t <= 0) { t = rnd(1.5, 3.5); n.lookOff = rnd(-1, 1); n.yawT += rnd(-0.9, 0.9) * (Math.random() < 0.3 ? 1 : 0); } yield; } }
const door = n => H.doors[n.h.door];
function* leaveHome(n) {
  const d = door(n); if (d) d.t = 1; n.vis = false; n.x = n.h.home[0]; n.z = n.h.home[1]; n.fy = FLY; n.yaw = n.yawT = n.h.face > 0 ? PI : 0; n.at = n.h.out;
  yield* wait(n, 0.6); n.vis = true; if (!n.noDog) { n.dogMode = 'follow'; n.dog.x = n.h.dx + rnd(-0.4, 0.4); n.dog.z = n.h.outZ; n.dog.vis = true; }
  yield* goto(n, n.h.dx, n.h.outZ, 1.0); n.fy = null; yield* wait(n, 0.4); if (d) d.t = 0;
}
function* goHome(n) {
  yield* route(n, n.h.out); const d = door(n); if (d) d.t = 1; n.fy = FLY; yield* wait(n, 0.5);
  yield* goto(n, n.h.home[0], n.h.home[1], 1.0); n.vis = false; n.dogMode = 'hidden'; clearCarry(n); n.fy = null; yield* wait(n, 0.8); if (d) d.t = 0;
}
function clearCarry(n) { n.carry.forEach(c => { if (c.m.parent) c.m.parent.remove(c.m); }); n.carry.length = 0; if (n.bag) { if (n.bag.parent) n.bag.parent.remove(n.bag); n.bag = null; } n.hold = false; }
function* stroll(n) {
  const legs = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < legs; i++) {
    let to, tries = 0; do { to = pick(LANE_IDS); tries++; } while (tries < 12 && Math.hypot(N[to].x - n.x, N[to].z - n.z) < 14);
    yield* route(n, to); yield* idle(n, rnd(4, 11));
  }
}
function pickSlot(api) { const live = api.SL.filter(s => s.p && VR.phys.props.indexOf(s.p) >= 0); return live.length ? pick(live) : null; }
function standFor(api, s) {                                                     // onde o NPC fica para pegar o item e por qual nó chega lá
  const x = s.x, z = s.z;
  if (x > 102.5) return { sx: 102.0, sz: z, anchor: ID.E };
  if (z > -16.0 && z < -14.9) return { sx: x, sz: -14.4, anchor: ID.W14 };
  if (z > -13.2 && z < -12.0) return { sx: x, sz: -11.2, anchor: ID.W11 };
  let Gc = api.GZ[0]; api.GZ.forEach(g => { if (Math.abs(g - z) < Math.abs(Gc - z)) Gc = g; });
  const dir = z > Gc ? 1 : -1, az = r2(Gc + dir * 1.2), anchor = az < -25 ? ID.W26 : az < -22 ? ID.W23 : az < -20 ? ID.W21 : ID.M1;
  return { sx: x, sz: az, anchor };
}
function* shopTrip(n) {
  const api = mk && mk.api; if (!api) { yield* stroll(n); return; }
  n.dogMode = 'wait'; n.dogSpot = { x: 77.6, z: -17.0 - (n.id % 4) * 0.5 };
  yield* route(n, ID.DP);
  while (ST.count >= 3) { n.moving = false; yield* idle(n, 2); }                // mercado cheio: espera do lado de fora
  ST.count++; n.shopping = true; yield* route(n, ID.D);
  if (api.say && Math.hypot(PL.x - 86.6, PL.z + 24.3) > 0) { try { api.say('Bem-vindo(a)!', 2.2); } catch (e) {} }
  const want = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < want; i++) {
    const s = pickSlot(api); if (!s) break; const st = standFor(api, s);
    yield* route(n, st.anchor); yield* goto(n, st.sx, st.sz); n.yawT = Math.atan2(s.x - n.x, s.z - n.z); n.lookOff = 0;
    yield* wait(n, 0.5); n.reach = 0.6; yield* wait(n, 0.5);
    if (s.p && VR.phys.props.indexOf(s.p) >= 0) { const type = s.type, it = api.inst(api.protoOf(type)); api.dropProp(s.p); s.p = null; it.scale.setScalar(0.7); n.carry.push({ m: it, type }); n.carryG.add(it); n.hold = true; n.carry.forEach((c, k) => c.m.position.set((k - (n.carry.length - 1) / 2) * 0.24, 0, 0)); }
    yield* wait(n, 0.4);
  }
  yield* route(n, ID.QA);                                                       // fila do caixa
  ST.queue.push(n);
  for (;;) { const i = ST.queue.indexOf(n), q = qpos(i); stepTo(n, q[0], q[1], 1.0); if (i === 0 && Math.hypot(q[0] - n.x, q[1] - n.z) < 0.08) break; if (Math.hypot(q[0] - n.x, q[1] - n.z) < 0.08) n.yawT = PI; yield; }
  n.yawT = PI; n.moving = false; ST.busy = n; yield* wait(n, 0.5);
  const placed = []; const top = YF + 0.835;
  for (let i = 0; i < n.carry.length; i++) { const c = n.carry[i], d = api.PRODS[c.type].dim; n.carryG.remove(c.m); c.m.scale.setScalar(1); c.m.position.set(82.75 + i * 0.36, top + d[1] / 2 + 0.004, api.LZ); npc.group.add(c.m); placed.push(c); n.reach = 0.5; yield* wait(n, 0.45); }
  n.carry.length = 0; n.hold = false; yield* wait(n, 0.3);
  for (const c of placed) { api.beep(); yield* wait(n, 0.7); c.m.parent.remove(c.m); }
  sfx(880, 0.09); yield* wait(n, 0.12); sfx(1320, 0.14); yield* wait(n, 1.1);
  try { api.say('Obrigada, volte sempre!', 3); } catch (e) {}
  n.bag = api.inst(api.BAGP); n.bag.position.set(0.34, 0.62, 0.05); n.body.add(n.bag); n.hasBag = true;
  ST.queue.splice(ST.queue.indexOf(n), 1); ST.busy = null; n.at = ID.QA; yield* wait(n, 0.4);
  yield* route(n, ID.DP); ST.count--; n.shopping = false; n.dogMode = 'follow';
  yield* wait(n, 0.6);
}
function* life(n) {
  yield* wait(n, n.startDelay);
  for (;;) {
    const dark = VR.sky ? VR.sky.cfg.dark : 0;
    if (dark > 0.6 && Math.random() > 0.2) { yield* wait(n, rnd(15, 35)); continue; }
    yield* leaveHome(n);
    if (npc.plaza && Math.random() < 0.4) yield* npc.plaza.visit(n); else if (mk && mk.api && ST.count < 3 && Math.random() < 0.55) yield* shopTrip(n); else yield* stroll(n);
    yield* goHome(n);
    yield* wait(n, rnd(25, 80));
  }
}

// ====================================================== CONSTRUÇÃO E REAÇÃO AO JOGADOR ======================================================
function makeNpc(h) {
  const n = { id: h.id, h, x: 0, z: 0, y: YG, yaw: 0, yawT: 0, vis: false, sp: rnd(1.15, 1.45), moving: false, amp: 0, ph: 0, pause: 0, lookT: 0, lookOff: 0, aware: rnd(0, 2), greetCd: 0, wave: 0, sayT: 0, carry: [], bag: null, hold: false, reach: 0, fy: null, at: h.out, shopping: false, dogMode: 'hidden', dogSpot: { x: 78, z: -17 }, idleT: 0, hasBag: false, startDelay: 4 + h.id * 3.5 + rnd(0, 6) };
  n.g = makeHuman(n); n.dog = makeDog(n); npc.group.add(n.g); npc.group.add(n.dog.g);
  n.reset = () => { clearCarry(n); n.vis = false; n.dogMode = 'hidden'; n.dog.vis = false; n.shopping = false; n.fy = null; n.pause = 0; n.wave = 0; n.lookT = 0; n.sayT = 0; n.startDelay = 4 + h.id * 3.5 + rnd(0, 6); n.at = h.out; const d = door(n); if (d) d.t = 0; n.co = life(n); };
  n.co = life(n); return n;
}
function senses(n) {
  if (!n.vis) return;
  const dx = PL.x - n.x, dz = PL.z - n.z, d = Math.hypot(dx, dz);
  n.aware -= DT; n.greetCd -= DT; if (n.lookT > 0) n.lookT -= DT; if (n.pause > 0) n.pause -= DT; if (n.wave > 0) n.wave -= DT; if (n.sayT > 0) n.sayT -= DT;
  if (n.aware <= 0) { n.aware = rnd(1.2, 3.2);
    if (d < 8 && n.lookT <= 0 && Math.random() < 0.5) n.lookT = rnd(1.5, 4);                    // às vezes te olham
    if (d < 3.8 && n.greetCd <= 0 && Math.random() < 0.6) {                                    // às vezes cumprimentam quando você passa perto
      n.greetCd = rnd(45, 90); n.wave = 2.0; n.lookT = 3.2; say(n, greeting(), 2.6); if (n.moving && Math.random() < 0.4) n.pause = 1.6; } }
}
function view(n) {
  const g = n.g, dg = n.dog, gy = n.fy !== null ? n.fy : groundAt(n.x, n.z);
  n.y = n.lock ? gy : n.y + (gy - n.y) * damp(9, DT); n.yaw = n.lock ? n.yawT : n.yaw + wrapA(n.yawT - n.yaw) * damp(8, DT);
  const far = Math.hypot(PL.x - n.x, PL.z - n.z) > 85; g.visible = n.vis && !far; if (!n.vis) { dogView(n, dg); return; } if (far) { dogView(n, dg, true); return; }
  n.sitK = (n.sitK || 0) + ((n.sitT || 0) - (n.sitK || 0)) * damp(10, DT);
  const lod = !!n.imp && Math.hypot(PL.x - n.x, PL.z - n.z) > 28; if (n.imp) { n.imp.visible = lod; n.body.visible = !lod; }
  if (lod) { g.position.set(n.x, n.y, n.z); n.imp.rotation.y = n.yaw; n.imp.scale.y = 1 - 0.25 * n.sitK; if (n.bub) n.bub.material.opacity = 0; dogView(n, dg); return; }
  n.amp += ((n.moving ? 1 : 0) - n.amp) * damp(10, DT); if (n.moving) n.ph += DT * 7.2 * (n.sp / 1.3);
  const s = Math.sin(n.ph) * n.amp; g.position.set(n.x, n.y + Math.abs(Math.cos(n.ph)) * 0.025 * n.amp, n.z); n.body.rotation.y = n.yaw;
  n.legs[0].rotation.x = s * 0.6; n.legs[1].rotation.x = -s * 0.6; n.reach = Math.max(0, n.reach - DT);
  n.sitK = (n.sitK || 0) + ((n.sitT || 0) - (n.sitK || 0)) * damp(10, DT); const sk = n.sitK;                                  // sentado: pernas para frente e corpo abaixado
  if (sk > 0.01) { const lb = (n.legBob || 0) * Math.sin(TT * 4.6) * 0.5; n.legs[0].rotation.x = (-1.45 + lb) * sk; n.legs[1].rotation.x = (-1.45 - lb) * sk; }
  n.body.position.y = -(n.sitDrop || 0.42) * sk;
  const hold = n.hold ? -1.0 : 0, rch = n.reach > 0 ? -0.9 : 0;
  n.arms[0].rotation.x = -s * 0.55 * (n.hold ? 0 : 1) + hold + rch; n.arms[0].rotation.z = 0.05;
  n.arms[1].rotation.x = s * 0.55 * (n.hold ? 0 : 1) + hold + (n.hasBag ? -0.25 : 0); n.arms[1].rotation.z = -0.05;
  if (sk > 0.5 && !n.hold) { n.arms[0].rotation.x = n.reach > 0 ? -1.3 : -0.8; n.arms[1].rotation.x = n.cone ? -1.2 : -0.8; }
  if (n.wave > 0 && !n.hold) { n.arms[1].rotation.x = 0; n.arms[1].rotation.z = -(2.4 + Math.sin(TT * 11) * 0.35); }
  let look = n.lookOff * 0.6; if (n.lookT > 0) look = clamp(wrapA(Math.atan2(PL.x - n.x, PL.z - n.z) - n.yaw), -1.2, 1.2);
  n.head.rotation.y += (look - n.head.rotation.y) * damp(7, DT); n.head.rotation.x = n.lookT > 0 ? 0.04 : 0;
  if (n.bub) { n.bub.position.set(n.x, n.y + 2.05, n.z); n.bub.material.opacity = n.sayT > 0 ? Math.min(1, n.sayT / 0.4) : 0; }
  dogView(n, dg);
}
function dogView(n, d, hide) {
  if (hide || n.dogMode === 'hidden' || !d.vis) { d.g.visible = false; return; }
  d.g.visible = true; let tx, tz;
  if (n.dogMode === 'wait') { tx = n.dogSpot.x; tz = n.dogSpot.z; }
  else { const s = Math.sin(n.yaw), c = Math.cos(n.yaw), side = n.id % 2 ? 1 : -1, off = 0.95 + 0.25 * Math.sin(TT * 0.5 + n.id); tx = n.x - s * off + c * 0.5 * side; tz = n.z - c * off - s * 0.5 * side; }
  const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz); let mv = false;
  if (dist > 10) { d.x = tx; d.z = tz; }
  else if (dist > 0.3) { const sp = Math.min(3.0, dist * 2.6 + 0.4) * DT; d.x += dx / dist * Math.min(sp, dist); d.z += dz / dist * Math.min(sp, dist); d.yaw += wrapA(Math.atan2(dx, dz) - d.yaw) * damp(9, DT); mv = true; }
  d.idle = mv ? 0 : d.idle + DT; d.sit += ((d.idle > 2.5 ? 1 : 0) - d.sit) * damp(5, DT);
  if (!mv && d.sniff <= 0 && d.idle > 0.8 && Math.random() < 0.004) d.sniff = 1.7; if (d.sniff > 0) d.sniff -= DT;
  d.amp += ((mv ? 1 : 0) - d.amp) * damp(10, DT); if (mv) d.ph += DT * 12; d.y += (groundAt(d.x, d.z) - d.y) * damp(9, DT);
  const s = Math.sin(d.ph) * d.amp; d.g.position.set(d.x, d.y, d.z); d.g.visible = Math.hypot(PL.x - d.x, PL.z - d.z) < 32; d.body.rotation.y = d.yaw; d.body.position.y = -0.14 * d.sit + Math.abs(Math.cos(d.ph)) * 0.015 * d.amp; d.body.rotation.x = -0.35 * d.sit;
  d.legs[0].rotation.x = s * 0.7 - 0.7 * d.sit * 0; d.legs[1].rotation.x = -s * 0.7; d.legs[2].rotation.x = -s * 0.7; d.legs[3].rotation.x = s * 0.7;
  d.head.rotation.x = (d.sniff > 0 ? 0.75 : 0) + 0.35 * d.sit; d.tail.rotation.z = Math.sin(TT * (mv ? 14 : 7) + n.id) * 0.5; d.tail.rotation.x = 0.4 + 0.3 * d.sit;
}
npc.build = () => {
  if (npc.built) return; npc.built = true; const g = npc.group = new T.Group(); H.group.add(g);
  hs.forEach(h => npc.list.push(makeNpc(h)));
};
npc.reset = () => { ST.count = 0; ST.queue.length = 0; ST.busy = null; npc.list.forEach(n => n.reset()); };
{ const enter0 = H.enter, exit0 = H.exit;
  H.enter = function () { const r = enter0.apply(this, arguments); try { if (!npc.built) npc.build(); npc.reset(); } catch (e) { VR.log('npc: ' + e.message); } return r; };
  H.exit = function () { try { if (npc.built) npc.reset(); } catch (e) {} return exit0.apply(this, arguments); };
}
VR.hook(56, dt => {
  if (!npc.built || !H.active) return;
  DT = Math.min(dt, 0.1); TT += DT; let near = false;
  const L = npc.list;
  L.forEach(n => { try { n.co.next(); } catch (e) { VR.log('npc ' + n.id + ': ' + e.message); n.reset(); } senses(n); view(n); if (n.shopping && n.vis && n.x > 74 && n.x < 87 && Math.abs(n.z - ID_Z()) < 3.4) near = true; });
  if (mk) mk.npcNear = near;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j];     // vizinhos que se cruzam também se cumprimentam
    if (!a.vis || !b.vis || a.greetCd > 0 || b.greetCd > 0 || Math.hypot(a.x - b.x, a.z - b.z) > 2.4) continue;
    if (Math.random() < 0.02) { a.greetCd = b.greetCd = rnd(40, 80); a.wave = b.wave = 1.8; a.yawT = Math.atan2(b.x - a.x, b.z - a.z); b.yawT = Math.atan2(a.x - b.x, a.z - b.z); a.pause = b.pause = 1.5; say(a, 'Oi, vizinho(a)!', 2.2); if (Math.random() < 0.6) setTimeout(() => say(b, 'Tudo bem?', 2), 700); } }
});
const ID_Z = () => ZD;
// ---- API para js/praca.js (moradores da praça são NPCs sem casa: rotina própria) ----
const nearest = (x, z) => { let b = 0, bd = 1e9; N.forEach((q, i) => { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; b = i; } }); return b; };
npc.api = { N, ID, node, link, path, nearest, goto, route, wait, idle, stepTo, say, makeHuman, makeDog, rnd, pick, wrapA, sfx, get dt() { return DT; } };
function* kidDay(n) {
  yield* wait(n, n.startDelay);
  for (;;) {
    if ((VR.sky ? VR.sky.cfg.dark : 0) > 0.6) { yield* wait(n, rnd(15, 35)); continue; }
    yield* leaveHome(n); n.sp0 = n.sp; if (npc.plaza && npc.plaza.kid) yield* npc.plaza.kid(n); else yield* stroll(n); n.sp = n.sp0 || n.sp;
    yield* goHome(n); yield* wait(n, rnd(20, 60));
  }
}
npc.addKid = hid => {                                                           // criança que mora na casa hid
  const n = makeNpc(hs[hid]); n.g.scale.setScalar(0.68); npc.group.remove(n.dog.g); n.dog = { vis: false, g: { visible: false } }; n.noDog = true; n.sp = rnd(1.5, 1.8);
  const r0 = n.reset; n.reset = () => { r0(); n.co = kidDay(n); }; n.co = kidDay(n); npc.list.push(n); return n;
};
npc.spawn = o => {                                                              // o: { x, z, at, dog, sp, co: n => gerador, kid }
  const n = { id: 100 + npc.list.length, h: null, x: o.x, z: o.z, y: YG, yaw: 0, yawT: 0, vis: true, sp: o.sp || rnd(1.15, 1.45), moving: false, amp: 0, ph: 0, pause: 0, lookT: 0, lookOff: 0, aware: rnd(0, 2), greetCd: 0, wave: 0, sayT: 0, carry: [], bag: null, hold: false, reach: 0, fy: null, at: o.at || 0, shopping: false, dogMode: 'hidden', dogSpot: { x: 0, z: 0 }, idleT: 0, hasBag: false, sitK: 0, sitT: 0, sitDrop: 0.42, lock: false, startDelay: 0 };
  n.g = makeHuman(n); if (o.kid) n.g.scale.setScalar(0.68); npc.group.add(n.g);
  n.dog = o.dog ? makeDog(n) : { vis: false, g: { visible: false } }; if (o.dog) npc.group.add(n.dog.g);
  n.reset = () => { clearCarry(n); if (n.cone && n.cone.parent) n.cone.parent.remove(n.cone); n.cone = null; n.x = o.x; n.z = o.z; n.y = YG; n.vis = true; n.fy = null; n.lock = false; n.sitT = 0; n.sitK = 0; n.sitDrop = 0.42; n.legBob = 0; n.pause = 0; n.wave = 0; n.sayT = 0; n.lookT = 0; n.reach = 0; n.at = o.at || 0;
    if (o.dog) { n.dogMode = 'follow'; n.dog.vis = true; n.dog.x = o.x; n.dog.z = o.z; } n.co = o.co(n); };
  n.reset(); npc.list.push(n); return n;
};
})();
