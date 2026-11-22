/* Praça do bairro, no fim OESTE da rua (do outro lado do mercado). A rua agora é bem maior (mais casas, postes e árvores em outdoor.js) e termina
   no portão da praça: prédios só visuais em volta (comércio, apartamentos, torres de vidro, prefeitura), e uma praça grande e interativa:
   chafariz (clique liga/desliga), parquinho (balanços, escorregador, gangorra, carrossel, cavalinhos de mola, caixa de areia), quadra de basquete
   e campinho de futebol com bolas de verdade (pegue e jogue; cesta e gol são contados), lago com patos, coreto com música, sorveteria,
   mesas de xadrez, piquenique, pombos que fogem, relógio e muita vida: crianças brincando, pais nos bancos, corredores, casais, cachorros,
   vendedor de sorvete, velhinhos no xadrez, jogadores de basquete e de futebol. Depende de house.js (H.*), npc.js (npc.api, npc.spawn). */
(() => {
'use strict';
const VR = window.VR, T = VR.T, H = VR.house, P = VR.phys, PL = VR.PL, damp = VR.damp, npc = VR.npc, A = npc && npc.api;
if (!H || !P || !A || !window.CANNON) return;
const CAN = window.CANNON, YG = H.YG, PI = Math.PI, TAU = PI * 2;
const pz = VR.plaza = { built: false, spawned: false, group: null, balls: [], score: { bask: 0, gol: 0 } };
const sfx = (f, d, v) => { try { VR.ui.sfx(f, d, v); } catch (e) {} };
const toast = m => { try { VR.ui.toast(m, 2200); } catch (e) {} };
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], c01 = v => Math.max(0, Math.min(1, v));
const lm = H.lm, own = H.own, srnd = H.rnd, WHT = H.WHT;
const dark = () => (VR.sky ? VR.sky.cfg.dark : 0);
// geometria: centro da praça (chafariz) e limites; (u, v) = (leste, norte) a partir do chafariz
const CX = -160, CZ = -18.5, X0 = -200, X1 = -122, Z0 = -57, Z1 = 20;
const WX = u => CX + u, WZ = v => CZ + v;

// ====================================================== ONDE SE ANDA ======================================================
H.ZY.plaza = YG; H.ZY.coreto = YG + 0.55; H.AMB.plaza = 1; H.AMB.coreto = 1;
H.zn('coreto', 'down', CX - 31, CX - 23, CZ - 3.9, CZ + 3.9);               // palco do coreto (antes da praça: vale sobre ela)
H.zn('plaza', 'down', X0, X1 + 1, Z0, Z1);
const ZP = ['plaza', 'coreto'];
const obR = (x0, x1, z0, z1) => H.ob('down', x0, x1, z0, z1);
const obP = (x, z, r) => obR(x - r, x + r, z - r, z + r);
const obU = (u0, u1, v0, v1) => obR(WX(u0), WX(u1), WZ(v0), WZ(v1));
const obCircle = (x, z, r) => { for (let d = -r; d <= r + 1e-6; d += 0.7) { const h = Math.sqrt(Math.max(0, r * r - d * d)); obR(x - h, x + h, z + d - 0.4, z + d + 0.4); } };
const obEllipse = (x, z, a, b) => { for (let d = -b; d <= b + 1e-6; d += 0.7) { const h = a * Math.sqrt(Math.max(0, 1 - (d / b) * (d / b))); obR(x - h, x + h, z + d - 0.4, z + d + 0.4); } };
// o jogador passa de 2 m de altura da casa até a praça sem o house.js limitar: amplia a área de andar e o alcance da câmera
VR.hook(12, () => { if (!H.active || !VR.bounds) return; const b = VR.bounds; if (b.x0 > -250 || b.z0 > -60 || b.z1 < 24) VR.bounds = { x0: Math.min(b.x0, -250), x1: Math.max(b.x1, 112), z0: Math.min(b.z0, -60), z1: Math.max(b.z1, 24) }; });
[VR.camMain, VR.camL, VR.camR].forEach(c => { if (c && c.far < 320) { c.far = 320; c.updateProjectionMatrix(); } });

// ====================================================== UTILIDADES ======================================================
let grp = null, B = null;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; };
const tex = (c, rx, ry) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 4; return t; };
const decal = (map, layer, o) => new T.MeshLambertMaterial(Object.assign({ map, polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer }, o || {}));
const flat = (w, d, x, z, y, m) => { const o = new T.Mesh(new T.PlaneGeometry(w, d), m); o.rotation.x = -PI / 2; o.position.set(x, y, z); grp.add(o); return o; };
const fu = (w, d, u, v, m, layer) => flat(w, d, CX + u, CZ + v, YG + 0.012 * layer, m);
const bu = (w, h, d, u, y, v, m, ry) => B.box(w, h, d, CX + u, YG + y, CZ + v, m, ry);
const cu = (r0, r1, h, u, y, v, m, seg) => B.cyl(r0, r1, h, CX + u, YG + y, CZ + v, m, seg || 10);
const blob = (r, x, y, z, m, sx, sy, sz) => { const g = new T.SphereGeometry(r, 8, 6); if (sx) g.scale(sx, sy, sz); B.add(B.xf(g, x, y, z), m); };
const mat = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const IRON = () => lm(0x2b2f35), WOODM = () => lm(0x9a6a3c), STONE = () => lm(0xb9b4a8);
const sign = (txt, w, h, bg, fg, sub) => { const cw = 512, ch = Math.max(64, Math.round(512 * h / w)), k = cv(cw, ch), g = k.g; g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 6; g.strokeRect(8, 8, cw - 16, ch - 16);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = Math.round(ch * (sub ? 0.5 : 0.62)); g.font = '800 ' + fs + 'px Arial, sans-serif'; while (g.measureText(txt).width > cw - 50 && fs > 14) { fs -= 4; g.font = '800 ' + fs + 'px Arial, sans-serif'; } g.fillText(txt, cw / 2, sub ? ch * 0.38 : ch / 2);
  if (sub) { g.font = '600 ' + Math.round(ch * 0.2) + 'px Arial, sans-serif'; g.fillText(sub, cw / 2, ch * 0.78); }
  const t = new T.CanvasTexture(k.c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
const signMesh = (txt, w, h, bg, fg, x, y, z, ry, sub) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: sign(txt, w, h, bg, fg, sub), side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; grp.add(m); return m; };
const glowTex = (() => { let t = null; return () => { if (t) return t; const k = cv(128, 128), g = k.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); t = new T.CanvasTexture(k.c); return t; }; })();
const inter = (meshes, fn) => H.inter(meshes, fn, ZP);

// ---------- texturas do chão ----------
function texGrass() { const k = cv(256, 256), g = k.g, r = srnd(31); g.fillStyle = '#5a9a3c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 22; i++) { const x = r() * 256, y = r() * 256, rr = 20 + r() * 40, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, r() < .5 ? 'rgba(40,100,30,.25)' : 'rgba(130,190,80,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 2200; i++) { const x = r() * 256, y = r() * 256, l = 3 + r() * 6; g.strokeStyle = r() < .5 ? 'rgba(40,96,30,.55)' : 'rgba(120,185,80,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 3, y - l); g.stroke(); } return k.c; }
function texPavers() { const k = cv(256, 256), g = k.g, r = srnd(7); g.fillStyle = '#d3ccbb'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const s = 0.9 + r() * 0.16; g.fillStyle = 'rgb(' + ((208 * s) | 0) + ',' + ((200 * s) | 0) + ',' + ((184 * s) | 0) + ')'; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  g.fillStyle = 'rgba(80,74,64,.5)'; for (let i = 0; i < 4; i++) { g.fillRect(i * 64, 0, 2, 256); g.fillRect(0, i * 64, 256, 2); } return k.c; }
function texRubber() { const k = cv(256, 256), g = k.g, r = srnd(17); g.fillStyle = '#4d86a8'; g.fillRect(0, 0, 256, 256); const cols = ['#c8553d', '#e3b83a', '#5aa05a', '#4d86a8', '#7a5aa8'];
  for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(r() * 256, r() * 256, 40 + r() * 50, 30 + r() * 40, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 2000; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'; g.fillRect(r() * 256, r() * 256, 2, 2); } return k.c; }
function texSand() { const k = cv(128, 128), g = k.g, r = srnd(19); g.fillStyle = '#e4cf9a'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 1200; i++) { g.fillStyle = r() < .5 ? 'rgba(150,120,60,.25)' : 'rgba(255,245,210,.3)'; g.fillRect(r() * 128, r() * 128, 2, 2); } return k.c; }
function texCourt() { const k = cv(512, 960), g = k.g, w = 512, h = 960; g.fillStyle = '#a8412f'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f74b8'; g.fillRect(30, 30, w - 60, h - 60); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(30, 30, w - 60, h - 60);
  g.beginPath(); g.moveTo(30, h / 2); g.lineTo(w - 30, h / 2); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 70, 0, TAU); g.stroke();
  [[1, 30], [-1, h - 30]].forEach(([sg, y0]) => { g.strokeRect(w / 2 - 80, sg > 0 ? y0 : y0 - 200, 160, 200); g.beginPath(); g.arc(w / 2, y0 + sg * 200, 80, sg > 0 ? 0 : PI, sg > 0 ? PI : TAU); g.stroke(); g.beginPath(); g.arc(w / 2, y0 + sg * 95, 210, sg > 0 ? 0.35 : PI + 0.35, sg > 0 ? PI - 0.35 : TAU - 0.35); g.stroke(); });
  return k.c; }
function texPitch() { const k = cv(512, 360), g = k.g, w = 512, h = 360; for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#4f9a3a' : '#59a843'; g.fillRect(i * w / 10, 0, w / 10, h); } g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20); g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 40, 0, TAU); g.stroke();
  g.strokeRect(10, h / 2 - 80, 60, 160); g.strokeRect(w - 70, h / 2 - 80, 60, 160); g.strokeRect(10, h / 2 - 36, 24, 72); g.strokeRect(w - 34, h / 2 - 36, 24, 72); return k.c; }
function texChess() { const k = cv(128, 128), g = k.g; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#2d2a26' : '#e8dcc0'; g.fillRect(i * 16, j * 16, 16, 16); } g.strokeStyle = '#6a4a2a'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124); return k.c; }
function texBlanket() { const k = cv(128, 128), g = k.g; g.fillStyle = '#f2ede2'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(200,50,50,.85)'; for (let i = 0; i < 4; i++) g.fillRect(i * 32, 0, 16, 128); g.fillStyle = 'rgba(200,50,50,.6)'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 32, 128, 16); return k.c; }
function ballTex(c1, c2, kind) { const k = cv(128, 64), g = k.g; g.fillStyle = c1; g.fillRect(0, 0, 128, 64); g.strokeStyle = c2; g.fillStyle = c2; g.lineWidth = 3;
  if (kind === 'soccer') { for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(10 + i * 19, 14 + (i % 2) * 30, 8, 0, TAU); g.fill(); } } else { g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.stroke(); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 32 + 16, 0); g.bezierCurveTo(i * 32 + 4, 22, i * 32 + 4, 42, i * 32 + 16, 64); g.stroke(); } }
  const t = new T.CanvasTexture(k.c); t.colorSpace = T.SRGBColorSpace; return t; }

// ====================================================== PRÉDIOS (só visuais) ======================================================
const CITY = { mats: [], fac: {}, byKey: {} };
function facade(style) {
  if (CITY.fac[style]) return CITY.fac[style];
  const r = srnd(style.length * 77 + 5), kd = cv(256, 256), ke = cv(256, 256), g = kd.g, e = ke.g; e.fillStyle = '#000'; e.fillRect(0, 0, 256, 256);
  const win = (x, y, w, h, lit, glass) => { g.fillStyle = glass; g.fillRect(x, y, w, h); const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = gr; g.fillRect(x, y, w, h); if (lit) { e.fillStyle = r() < .5 ? '#ffe2a0' : '#fff3c8'; e.fillRect(x, y, w, h); } };
  if (style === 'glass') { g.fillStyle = '#35506b'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) win(i * 32 + 2, j * 32 + 2, 28, 29, r() < .45, r() < .5 ? '#5f8db5' : '#4f7ea6'); g.fillStyle = '#c9d3dc'; for (let i = 0; i < 8; i++) { g.fillRect(i * 32, 0, 2, 256); g.fillRect(0, i * 32, 256, 2); } }
  else if (style === 'brick') { g.fillStyle = '#a9553f'; g.fillRect(0, 0, 256, 256); for (let row = 0; row < 32; row++) for (let i = -1; i < 12; i++) { const sh = 0.85 + r() * 0.3; g.fillStyle = 'rgb(' + ((168 * sh) | 0) + ',' + ((84 * sh) | 0) + ',' + ((64 * sh) | 0) + ')'; g.fillRect(i * 24 + (row % 2) * 12, row * 8, 22, 6); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = '#efe9dc'; g.fillRect(i * 64 + 10, j * 64 + 8, 44, 48); win(i * 64 + 14, j * 64 + 12, 36, 40, r() < .5, '#6b8499'); g.fillStyle = '#efe9dc'; g.fillRect(i * 64 + 14, j * 64 + 30, 36, 3); g.fillRect(i * 64 + 31, j * 64 + 12, 3, 40); } }
  else { g.fillStyle = '#e3dccb'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(i * 64 + 6, j * 64 + 54, 52, 5); g.fillStyle = '#f7f4ec'; g.fillRect(i * 64 + 14, j * 64 + 10, 36, 44); win(i * 64 + 17, j * 64 + 13, 30, 38, r() < .5, '#6f8ba3'); g.fillStyle = '#f7f4ec'; g.fillRect(i * 64 + 31, j * 64 + 13, 2, 38); } }
  const m = { map: tex(kd.c, 1, 1), emap: tex(ke.c, 1, 1) }; CITY.fac[style] = m; return m;
}
function facadeMat(style, tint) { const key = style + tint; if (CITY.byKey[key]) return CITY.byKey[key]; const f = facade(style); const m = new T.MeshLambertMaterial({ color: tint, map: f.map, emissive: 0xffffff, emissiveMap: f.emap, emissiveIntensity: 0 }); CITY.byKey[key] = m; CITY.mats.push(m); return m; }
const SHOPS = [['PADARIA', '#c9822b'], ['FARMÁCIA', '#2e8b57'], ['CAFÉ', '#6b4a2e'], ['LIVRARIA', '#2f4f8a'], ['BANCO', '#1f3d6b'], ['PIZZARIA', '#b3262e'], ['MERCADINHO', '#3d8b3d'], ['SORVETERIA', '#d6609c'], ['FLORICULTURA', '#8a3d8a'], ['BARBEARIA', '#333b46'], ['CINEMA', '#7a1f2b'], ['HOTEL', '#4a3a2a']];
// o: x0,x1,z0,z1, h, style, tint, fd (direção da fachada), shop (índice da loja no térreo)
function building(o) {
  const w = o.x1 - o.x0, d = o.z1 - o.z0, h = o.h, cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, side = facadeMat(o.style || 'apt', o.tint || 0xffffff), roof = lm(0x6b6b70);
  const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv, fx = Math.max(1, Math.round(d / 12)), fz = Math.max(1, Math.round(w / 12)), fy = Math.max(1, Math.round(h / 12.8));
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; if (f < 2) uv.setXY(i, uv.getX(i) * fx, uv.getY(i) * fy); else if (f >= 4) uv.setXY(i, uv.getX(i) * fz, uv.getY(i) * fy); }
  const m = new T.Mesh(g, [side, side, roof, roof, side, side]); m.position.set(cx, YG + h / 2, cz); grp.add(m);
  const rr = srnd((Math.abs(cx) * 7 + Math.abs(cz) * 3) | 0);
  B.box(w + 0.5, 0.9, d + 0.5, cx, YG + h + 0.45, cz, lm(0x8d8d92));
  for (let i = 0; i < 2 + ((rr() * 3) | 0); i++) B.box(1.6 + rr() * 1.4, 1.1, 1.4, cx + (rr() - .5) * (w - 4), YG + h + 1.4, cz + (rr() - .5) * (d - 4), lm(0xb9bdc2));
  if (rr() < 0.6) { const tx = cx + (rr() - .5) * (w - 5), tz = cz + (rr() - .5) * (d - 5); B.cyl(1.2, 1.2, 2.2, tx, YG + h + 2.0, tz, lm(0x8a8f96), 10); }
  if (h > 30) { B.cyl(0.08, 0.08, 7, cx, YG + h + 4.4, cz, lm(0x30343a), 5); B.sph(0.22, cx, YG + h + 8, cz, lm(0xd02020), 1, 1, 1); }
  if (o.shop !== undefined && o.fd) {                                                          // térreo comercial: vitrine, toldo e letreiro
    const fd = o.fd, ry = Math.atan2(fd[0], fd[1]), fw = fd[1] ? w : d, fdp = fd[1] ? d : w, bays = Math.max(1, Math.floor(fw / 9)), bw = fw / bays;
    B.at(cx, YG, cz, ry, b => { b.box(fw - 0.3, 0.5, 0.5, 0, 3.55, fdp / 2 + 0.2, lm(0x2b2f35)); for (let i = 0; i < bays; i++) { const x = -fw / 2 + bw * (i + 0.5), S = SHOPS[(o.shop + i) % SHOPS.length]; b.box(bw - 1.0, 2.9, 0.12, x, 1.5, fdp / 2 + 0.06, lm(0x1b2631)); b.box(bw - 0.9, 0.35, 1.3, x, 3.25, fdp / 2 + 0.6, lm(parseInt(S[1].slice(1), 16)), 0, 0.3); b.box(0.5, 2.9, 0.3, x - bw / 2 + 0.25, 1.5, fdp / 2 + 0.15, lm(0xd9d6cf)); } });
    for (let i = 0; i < bays; i++) { const lx = -fw / 2 + bw * (i + 0.5), s = Math.sin(ry), c = Math.cos(ry), S = SHOPS[(o.shop + i) % SHOPS.length]; signMesh(S[0], Math.min(5.2, bw - 1.2), 0.9, S[1], '#fff', cx + lx * c + (fdp / 2 + 0.75) * s, YG + 3.85, cz - lx * s + (fdp / 2 + 0.75) * c, ry); }
  }
}
function buildCity() {
  const N = [0, -1], S = [0, 1], E = [1, 0];            // para onde a fachada olha
  const L = [
    { x0: -142, x1: -124, z0: 24, z1: 40, h: 28, style: 'brick', fd: N, shop: 0 }, { x0: -163, x1: -144, z0: 24, z1: 38, h: 20, style: 'apt', tint: 0xf1e0c0, fd: N, shop: 2 }, { x0: -182, x1: -165, z0: 24, z1: 42, h: 44, style: 'glass', fd: N, shop: 4 }, { x0: -200, x1: -184, z0: 24, z1: 39, h: 26, style: 'apt', tint: 0xd5e3f0, fd: N, shop: 6 },
    { x0: -142, x1: -124, z0: -76, z1: -61, h: 25, style: 'apt', tint: 0xe9d3cf, fd: S, shop: 1 }, { x0: -162, x1: -144, z0: -74, z1: -61, h: 18, style: 'brick', fd: S, shop: 3 }, { x0: -181, x1: -164, z0: -80, z1: -61, h: 38, style: 'glass', fd: S, shop: 5 }, { x0: -200, x1: -183, z0: -76, z1: -61, h: 23, style: 'apt', tint: 0xd9e6d2, fd: S, shop: 7 },
    { x0: -224, x1: -204, z0: 6, z1: 26, h: 34, style: 'glass', fd: E, shop: 8 }, { x0: -222, x1: -204, z0: -5, z1: 4, h: 21, style: 'apt', tint: 0xf1e0c0, fd: E, shop: 9 }, { x0: -226, x1: -204, z0: -35, z1: -2, h: 15, style: 'brick', tint: 0xf3ead8, fd: E },
    { x0: -222, x1: -204, z0: -52, z1: -37, h: 20, style: 'apt', tint: 0xe9d3cf, fd: E, shop: 10 }, { x0: -226, x1: -204, z0: -74, z1: -54, h: 32, style: 'brick', fd: E, shop: 11 },
    { x0: -72, x1: -52, z0: 50, z1: 66, h: 15, style: 'apt', tint: 0xf1e0c0 }, { x0: -96, x1: -76, z0: 50, z1: 64, h: 20, style: 'brick' }, { x0: -118, x1: -100, z0: 50, z1: 68, h: 26, style: 'apt', tint: 0xd5e3f0 },
    { x0: -72, x1: -52, z0: -104, z1: -88, h: 17, style: 'brick' }, { x0: -96, x1: -76, z0: -102, z1: -88, h: 14, style: 'apt', tint: 0xd9e6d2 }, { x0: -118, x1: -100, z0: -106, z1: -88, h: 24, style: 'glass' },
    { x0: -262, x1: -244, z0: -30, z1: -10, h: 62, style: 'glass' }, { x0: -270, x1: -250, z0: 20, z1: 40, h: 54, style: 'apt', tint: 0xd5e3f0 }, { x0: -266, x1: -248, z0: -70, z1: -48, h: 70, style: 'glass' }, { x0: -150, x1: -130, z0: 70, z1: 88, h: 58, style: 'glass' }, { x0: -180, x1: -160, z0: -122, z1: -104, h: 66, style: 'brick' }
  ];
  L.forEach(building);
  const hx = -204, hz = -18.5;                                                                  // prefeitura: colunas, escadaria, frontão e bandeira, no eixo da rua
  for (let i = 0; i < 8; i++) B.cyl(0.55, 0.6, 8.6, hx + 1.6, YG + 4.9, hz - 14 + i * 4, lm(0xf1eee6), 12);
  B.box(3.2, 1.4, 34, hx + 1.4, YG + 9.9, hz, lm(0xe6e0d2)); B.box(3.4, 0.5, 34.4, hx + 1.5, YG + 10.8, hz, lm(0xcfc9ba));
  for (let i = 0; i < 4; i++) B.box(2.0 + i * 1.1, 0.2, 34, hx + 1.0 + i * 0.5 + 1.0, YG + 0.1 + (3 - i) * 0.2, hz, lm(0xd7d2c6));
  B.add(B.xf(new T.CylinderGeometry(0, 12, 3.2, 3, 1), hx + 1.8, YG + 12.6, hz), lm(0xcfc9ba));
  B.cyl(0.08, 0.08, 9, hx + 4, YG + 17.2, hz, lm(0xdcdcdc), 6);
  const fl = new T.Mesh(new T.PlaneGeometry(2.4, 1.5), new T.MeshBasicMaterial({ color: 0x2e8b57, side: T.DoubleSide })); fl.position.set(hx + 4, YG + 20.2, hz - 1.2); fl.rotation.y = PI / 2; grp.add(fl); pz.flag = fl;
  signMesh('PREFEITURA', 12, 1.3, '#e6e0d2', '#1f2a44', hx + 3.2, YG + 9.9, hz, PI / 2);
}

// ====================================================== GRAFO DE CAMINHOS DA PRAÇA ======================================================
const PZN = {};
function buildGraph() {
  const nu = (u, v) => A.node(WX(u), WZ(v)), L = A.link, R = [];
  for (let k = 0; k < 8; k++) R.push(nu(9.5 * Math.cos(k * PI / 4), 9.5 * Math.sin(k * PI / 4))); R.forEach((id, k) => L(id, R[(k + 1) % 8]));
  PZN.R = R; PZN.PG = A.ID.PG; PZN.KH = nu(17, 0); L(PZN.PG, PZN.KH); L(PZN.KH, R[0]);
  PZN.CO = nu(-20, 0); L(R[4], PZN.CO);
  PZN.AN1 = nu(0, 20); L(R[2], PZN.AN1); PZN.PH = nu(-9, 21); L(PZN.AN1, PZN.PH); PZN.FH = nu(4, 21); L(PZN.AN1, PZN.FH); PZN.AN2 = nu(0, 33); L(PZN.AN1, PZN.AN2);
  PZN.AS1 = nu(0, -16); L(R[6], PZN.AS1); PZN.AS2 = nu(0, -23); L(PZN.AS1, PZN.AS2); PZN.CH = nu(10, -23); L(PZN.AS2, PZN.CH); PZN.DH = nu(-10, -24); L(PZN.AS2, PZN.DH); PZN.AS3 = nu(0, -35); L(PZN.AS2, PZN.AS3);
}

// ====================================================== CHÃO, BANCOS, ÁRVORES, POSTES ======================================================
const BENCHES = [], LAMPS = [], TREES = [];
const LAMP_M = new T.MeshBasicMaterial({ color: 0x9aa0a6 }), GLOW_M = new T.SpriteMaterial({ map: null, color: 0xffd9a0, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 });
function bench(u, v, yaw) {
  const x = WX(u), z = WZ(v), ax = Math.cos(yaw), az = -Math.sin(yaw);
  B.at(x, YG, z, yaw, b => { b.box(1.6, 0.06, 0.45, 0, 0.45, 0, WOODM()); b.box(1.6, 0.4, 0.05, 0, 0.75, -0.22, WOODM()); [-1, 1].forEach(s => { b.box(0.06, 0.45, 0.42, s * 0.7, 0.22, 0, IRON()); b.box(0.05, 0.05, 0.4, s * 0.8, 0.62, 0, IRON()); }); });
  obP(x + ax * 0.55, z + az * 0.55, 0.45); obP(x - ax * 0.55, z - az * 0.55, 0.45);
  BENCHES.push({ x, z, yaw, fx: Math.sin(yaw), fz: Math.cos(yaw), slots: [null, null], node: A.nearest(x, z) });
}
function tree(u, v, s) {
  const x = WX(u), z = WZ(v), TR = lm(0x5b4129), LS = [lm(0x4f8f3a), lm(0x3e7a2f), lm(0x5e9d43)];
  B.cyl(0.14 * s, 0.2 * s, 2.6 * s, x, YG + 1.3 * s, z, TR, 8);
  [[0, 3.4, 0, 1.5], [0.9, 3.0, 0.4, 1.1], [-0.8, 3.1, -0.5, 1.2], [0.2, 4.3, -0.2, 1.0], [-0.3, 3.0, 0.9, 1.0]].forEach(([a, b, c, r], i) => blob(r * s, x + a * s, YG + b * s, z + c * s, LS[i % 3], 1, 0.9, 1));
  obP(x, z, 0.4); TREES.push([x, z]);
}
function lampPost(u, v) {
  const x = WX(u), z = WZ(v); B.cyl(0.06, 0.09, 4.6, x, YG + 2.3, z, IRON(), 8); B.sph(0.22, x, YG + 4.7, z, lm(0xe9e6df), 1, 1, 1); B.box(0.34, 0.06, 0.34, x, YG + 4.46, z, IRON());
  B.add(B.xf(new T.SphereGeometry(0.16, 8, 6), x, YG + 4.7, z), LAMP_M); const sp = new T.Sprite(GLOW_M); sp.scale.set(3.4, 3.4, 1); sp.position.set(x, YG + 4.7, z); grp.add(sp); obP(x, z, 0.25);
}
function buildGround() {
  const gr = tex(texGrass(), 1, 1), pv = tex(texPavers(), 1, 1), rp = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
  GLOW_M.map = glowTex();
  flat(190, 260, -255, -50, YG, new T.MeshLambertMaterial({ map: rp(gr, 63, 87) }));                // gramado além do fim do bairro
  const PATHS = [[-22, 38, -3, 3], [-2, 2, -38.5, 38.5], [-10, -2, 19, 23], [2, 12, -25, -21], [-12, -2, -25, -23], [-34, -22, -5, 5], [26, 38, -9, 9]];
  PATHS.forEach(([a, b, c, d]) => fu(b - a, d - c, (a + b) / 2, (c + d) / 2, decal(rp(pv, (b - a) / 2, (d - c) / 2), 2), 2));
  const disc = new T.Mesh(new T.CircleGeometry(11.5, 48), decal(rp(pv, 11.5, 11.5), 3)); disc.rotation.x = -PI / 2; disc.position.set(CX, YG + 0.036, CZ); grp.add(disc);
  fu(24, 24, -22, 21, decal(rp(tex(texRubber(), 1, 1), 6, 6), 3), 3);                                // parquinho (borracha)
  fu(15, 28, 19.5, -23, decal(tex(texCourt(), 1, 1), 3), 3);                                         // quadra
  fu(30, 21, 20, 21.5, decal(tex(texPitch(), 1, 1), 3), 3);                                          // campinho
  fu(5, 4, -31, 17.5, decal(rp(tex(texSand(), 1, 1), 3, 2.5), 4), 4);                                // caixa de areia
  fu(3, 3, -6, 26, decal(tex(texBlanket(), 1, 1), 4), 4);                                            // toalha de piquenique
  // lago: leito, água (animada) e pedras na borda
  const pu = -24, pv0 = -24, pa = 11, pb = 7, bed = new T.Mesh(new T.CircleGeometry(1, 40), decal(null, 4, { color: 0x6b6a52 })); bed.scale.set(pa + 0.9, pb + 0.9, 1); bed.rotation.x = -PI / 2; bed.position.set(WX(pu), YG + 0.048, WZ(pv0)); grp.add(bed);
  const wm = new T.MeshLambertMaterial({ color: 0x3a86a8, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), pw = new T.Mesh(new T.CircleGeometry(1, 40), wm); pw.scale.set(pa, pb, 1); pw.rotation.x = -PI / 2; pw.position.set(WX(pu), YG + 0.06, WZ(pv0)); grp.add(pw); pz.pondMat = wm;
  for (let i = 0; i < 30; i++) { const a = i / 30 * TAU, r = 0.88 + (i % 3) * 0.08; blob(0.5 + (i % 4) * 0.08, WX(pu) + Math.cos(a) * (pa + 0.7), YG + 0.15, WZ(pv0) + Math.sin(a) * (pb + 0.5), lm(i % 2 ? 0x9a958a : 0xb0aba0), 1, 0.55, 1); void r; }
  obEllipse(WX(pu), WZ(pv0), pa + 0.4, pb + 0.2); pz.pond = { x: WX(pu), z: WZ(pv0), a: pa, b: pb };
}
function buildDecor() {
  // chafariz: bacia de pedra, água (clique liga/desliga os jatos), pedestal com tigelas
  cu(4.5, 4.6, 0.6, 0, 0.3, 0, STONE(), 40); B.add(B.xf((() => { const g = new T.TorusGeometry(4.35, 0.25, 8, 40); g.rotateX(PI / 2); return g; })(), CX, YG + 0.62, CZ), STONE());
  cu(0.7, 0.95, 1.5, 0, 1.3, 0, STONE(), 14); cu(1.8, 0.8, 0.35, 0, 2.2, 0, STONE(), 20); cu(0.3, 0.42, 1.0, 0, 2.75, 0, STONE(), 10); cu(1.0, 0.4, 0.2, 0, 3.3, 0, STONE(), 14);
  const fw = new T.Mesh(new T.CircleGeometry(4.15, 40), own(0x4fa3d1, { transparent: true, opacity: 0.88 })); fw.rotation.x = -PI / 2; fw.position.set(CX, YG + 0.55, CZ); grp.add(fw); pz.fwater = fw;
  obCircle(CX, CZ, 4.7);
  const fo = pz.fo = { on: true, N: 9 * 20 }, pos = new Float32Array(fo.N * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  fo.pts = new T.Points(geo, new T.PointsMaterial({ size: 0.11, color: 0xd5ecff, transparent: true, opacity: 0.85, depthWrite: false })); fo.pts.frustumCulled = false; grp.add(fo.pts);
  fo.em = [{ p: [0, 3.65, 0], v: [0, 6.0, 0], T: 1.25 }]; for (let k = 0; k < 8; k++) { const a = k * PI / 4; fo.em.push({ p: [Math.cos(a) * 3.3, 0.7, Math.sin(a) * 3.3], v: [-Math.cos(a) * 2.2, 4.6, -Math.sin(a) * 2.2], T: 0.95 }); }
  inter([fw], () => { fo.on = !fo.on; fo.pts.visible = fo.on; sfx(fo.on ? 700 : 450, 0.12); toast(fo.on ? '⛲ Chafariz ligado' : '⛲ Chafariz desligado'); });
  // portão da praça (viradas para a rua e para a praça)
  [-6.4, 6.4].forEach(v => { bu(0.8, 6.2, 0.8, 36.8, 3.1, v, STONE()); bu(1.1, 0.4, 1.1, 36.8, 6.4, v, lm(0xd9d6cf)); obP(WX(36.8), WZ(v), 0.6); });
  bu(1.0, 0.9, 13.6, 36.8, 5.9, 0, lm(0x2e5a3a));
  signMesh('PRAÇA CENTRAL', 9, 1.1, '#2e5a3a', '#fff', WX(36.8) + 0.52, YG + 5.9, CZ, PI / 2, 'abre todo dia'); signMesh('PRAÇA CENTRAL', 9, 1.1, '#2e5a3a', '#fff', WX(36.8) - 0.52, YG + 5.9, CZ, -PI / 2, 'abre todo dia');
  // relógio (hora real do aparelho)
  { const u = 0, v = 36, TS = lm(0xc9c1b0); bu(3.4, 9.2, 3.4, u, 4.6, v, STONE()); bu(3.7, 0.4, 3.7, u, 9.3, v, TS); bu(2.8, 5.2, 2.8, u, 12.2, v, TS); bu(3.1, 0.3, 3.1, u, 14.95, v, STONE());
    B.add(B.xf((() => { const g = new T.CylinderGeometry(0, 2.5, 2.6, 4, 1); g.rotateY(PI / 4); return g; })(), WX(u), YG + 16.4, WZ(v)), lm(0x7a2b2b)); B.cyl(0.04, 0.04, 1.2, WX(u), YG + 18.3, WZ(v), IRON(), 5); obU(-1.8, 1.8, v - 1.8, v + 1.8);
    const k = cv(256, 256), g = k.g; g.fillStyle = '#f7f3e8'; g.beginPath(); g.arc(128, 128, 124, 0, TAU); g.fill(); g.strokeStyle = '#2b2f35'; g.lineWidth = 8; g.stroke(); g.fillStyle = '#1b1b1b'; g.font = '700 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) g.fillText(String(i), 128 + Math.sin(i * PI / 6) * 96, 128 - Math.cos(i * PI / 6) * 96); const ct = new T.CanvasTexture(k.c); ct.colorSpace = T.SRGBColorSpace; pz.hands = [];
    [[0, 0], [PI, 0], [PI / 2, 0], [-PI / 2, 0]].forEach(([ry]) => { const pv2 = new T.Group(), off = 1.43; pv2.position.set(WX(u) + Math.sin(ry) * off, YG + 12.2, WZ(v) + Math.cos(ry) * off); pv2.rotation.y = ry; grp.add(pv2);
      const f = new T.Mesh(new T.CircleGeometry(1.2, 32), new T.MeshBasicMaterial({ map: ct })); pv2.add(f);
      const hh = new T.Group(), mh = new T.Group(); [[hh, 0.62, 0.12], [mh, 0.95, 0.07]].forEach(([gp, len, wd]) => { const m = new T.Mesh(new T.BoxGeometry(wd, len, 0.03), new T.MeshBasicMaterial({ color: 0x1b1b1b })); m.position.set(0, len / 2 - 0.08, 0.03); gp.add(m); gp.position.z = 0.01; pv2.add(gp); }); pz.hands.push([hh, mh]); }); }
  // coreto com música
  { const u = -27, ST = lm(0xd9d4c7); cu(3.6, 3.7, 0.55, u, 0.275, 0, ST, 12); cu(3.5, 3.5, 0.03, u, 0.56, 0, WOODM(), 12);
    for (let k = 1; k < 8; k++) { const a = k * PI / 4, pu = u + Math.cos(a) * 3.2, pv2 = Math.sin(a) * 3.2; cu(0.1, 0.1, 3.9, pu, 0.55 + 1.95, pv2, lm(0xf1eee6), 8); obP(WX(pu), WZ(pv2), 0.28); }
    cu(3.5, 3.5, 0.2, u, 4.5, 0, lm(0xf1eee6), 12); B.add(B.xf(new T.CylinderGeometry(0, 4.5, 2.0, 12, 1), WX(u), YG + 5.6, WZ(0)), lm(0x7a2b2b)); B.sph(0.22, WX(u), YG + 6.7, WZ(0), lm(0xe0b04a), 1, 1, 1);
    bu(1.3, 0.2, 2.6, -23.0, 0.1, 0, ST); bu(0.8, 0.4, 2.6, -23.5, 0.2, 0, ST);
    const jk = new T.Mesh(new T.BoxGeometry(0.7, 1.3, 1.6), own(0x30343a)); jk.position.set(WX(-29.6), YG + 0.55 + 0.65, CZ); grp.add(jk); obU(-30.2, -29.0, -0.9, 0.9);
    const note = signMesh('♪  MÚSICA', 1.4, 0.4, '#e0b04a', '#2b2f35', WX(-29.2), YG + 0.55 + 1.55, CZ, PI / 2); void note;
    const mus = pz.mus = { on: false, t: 0, i: 0 }; inter([jk], () => { mus.on = !mus.on; mus.t = 0; sfx(mus.on ? 880 : 500, 0.1); toast(mus.on ? '🎵 Música no coreto: ligada' : '🎵 Música no coreto: desligada'); }); }
  // sorveteria
  { const u = 17, v = 5, PNK = lm(0xf4a9c8), WHP = lm(0xf6efe6); bu(3.2, 2.4, 0.15, u, 1.2, v + 1.05, lm(0xf6e7d0)); bu(0.15, 2.4, 2.2, u - 1.6, 1.2, v, lm(0xf6e7d0)); bu(0.15, 2.4, 2.2, u + 1.6, 1.2, v, lm(0xf6e7d0)); bu(3.2, 1.0, 0.5, u, 0.5, v - 0.85, lm(0xf6e7d0)); bu(3.8, 0.12, 2.9, u, 2.62, v - 0.1, lm(0x7a4a2a));
    for (let i = 0; i < 6; i++) bu(0.64, 0.1, 3.0, u - 1.6 + 0.32 + i * 0.64, 2.75, v - 0.1, i % 2 ? WHP : PNK);
    [[-1.7, -1.3], [1.7, -1.3], [-1.7, 1.0], [1.7, 1.0]].forEach(([a, b]) => cu(0.05, 0.05, 2.7, u + a, 1.35, v + b, IRON(), 6)); cu(0.0, 0.3, 0.7, u, 3.5, v - 0.1, lm(0xe0b04a), 8); blob(0.3, WX(u), YG + 3.95, WZ(v - 0.1), PNK); blob(0.22, WX(u), YG + 4.3, WZ(v - 0.1), lm(0xf6efe6));
    signMesh('SORVETES', 3.0, 0.6, '#d6609c', '#fff', WX(u), YG + 2.1, WZ(v - 1.15), PI); obU(u - 1.8, u + 1.8, v - 1.2, v + 1.2);
    const cm = new T.Mesh(new T.BoxGeometry(3.1, 0.07, 0.6), own(0xf3d9e0)); cm.position.set(WX(u), YG + 1.04, WZ(v - 0.85)); grp.add(cm); pz.cart = cm;
    inter([cm], () => { sfx(880, 0.09); setTimeout(() => sfx(1320, 0.14), 110); const vd = pz.vendor; if (vd) A.say(vd, pick(['Sorvete de morango, que tal?', 'Gelado e docinho!', 'Hoje tem chocolate também!', 'Quer experimentar?']), 3); }); }
  // quadra de basquete (aros: poste, tabela, argola; cesta contada com a bola de verdade)
  pz.hoops = [];
  const hoop = (u, vp, dir) => { const x = WX(u), zp = WZ(vp), zb = zp + dir * 1.2, zr = zp + dir * 2.2, ORG = lm(0xe0602a);
    B.cyl(0.08, 0.1, 4.3, x, YG + 2.15, zp, IRON(), 8); bu(0.1, 0.1, 1.25, u, 3.9, vp + dir * 0.6, IRON()); bu(1.8, 1.05, 0.06, u, 3.55, vp + dir * 1.2, lm(0xf2f2f2)); bu(0.6, 0.4, 0.04, u, 3.4, vp + dir * 1.17, lm(0xd04a3a));
    B.add(B.xf((() => { const g = new T.TorusGeometry(0.23, 0.02, 6, 16); g.rotateX(PI / 2); return g; })(), x, YG + 3.05, zr), ORG);
    B.add(B.xf(new T.CylinderGeometry(0.23, 0.13, 0.4, 10, 1, true), x, YG + 2.85, zr), mat(0xffffff, { transparent: true, opacity: 0.55, side: T.DoubleSide }));
    obP(x, zp, 0.3); P.staticBox(x, YG + 3.55, zb, 0.9, 0.52, 0.03); P.staticBox(x, YG + 3.9, (zp + zb) / 2, 0.05, 0.05, 0.6);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, b = new CAN.Body({ mass: 0, shape: new CAN.Sphere(0.035), position: new CAN.Vec3(x + Math.cos(a) * 0.23, YG + 3.05, zr + Math.sin(a) * 0.23), collisionFilterGroup: P.G.STATIC, material: P.M.stat }); P.world.addBody(b); P.statics.push(b); }
    pz.hoops.push({ x, z: zr, y: YG + 3.05 }); };
  hoop(19.5, -8.3, -1); hoop(19.5, -37.7, 1);
  // campinho de futebol: duas goleiras
  pz.goals = [];
  const goal = (uLine, dir, id) => { const vc = 21.5, x = WX(uLine), z = WZ(vc), W2 = 2.0, GH = 2.0, D = 1.3, NET = mat(0xffffff, { transparent: true, opacity: 0.3, side: T.DoubleSide }), WH = lm(0xf2f2f2);
    [-1, 1].forEach(s => { B.box(0.08, GH, 0.08, x, YG + GH / 2, z + s * W2, WH); B.box(0.06, GH, 0.06, x - dir * D, YG + GH / 2, z + s * W2, WH); B.box(D, 0.05, 0.05, x - dir * D / 2, YG + GH, z + s * W2, WH); P.staticBox(x, YG + GH / 2, z + s * W2, 0.05, GH / 2, 0.05); P.staticBox(x - dir * D / 2, YG + GH / 2, z + s * (W2 + 0.02), D / 2, GH / 2, 0.03); });
    B.box(0.06, 0.06, W2 * 2, x, YG + GH, z, WH); B.box(0.05, 0.05, W2 * 2, x - dir * D, YG + GH, z, WH); P.staticBox(x, YG + GH, z, 0.04, 0.04, W2); P.staticBox(x - dir * D, YG + GH / 2, z, 0.03, GH / 2, W2); P.staticBox(x - dir * D / 2, YG + GH + 0.02, z, D / 2, 0.03, W2);
    B.add(B.xf(new T.BoxGeometry(0.02, GH, W2 * 2), x - dir * D, YG + GH / 2, z), NET); B.add(B.xf(new T.BoxGeometry(D, 0.02, W2 * 2), x - dir * D / 2, YG + GH, z), NET); pz.goals.push({ x, z, dir, W2, GH, D, id }); };
  goal(5, 1, 0); goal(35, -1, 1);
  // mesas de xadrez
  pz.chair = [];
  [[-5, -14.5], [5, -14.5]].forEach(([u, v]) => { cu(0.15, 0.22, 0.72, u, 0.36, v, IRON(), 8); bu(1.1, 0.06, 1.1, u, 0.75, v, WOODM()); flat(1.0, 1.0, WX(u), WZ(v), YG + 0.785, new T.MeshLambertMaterial({ map: tex(texChess(), 1, 1) }));
    [-1, 1].forEach(s => { cu(0.19, 0.17, 0.45, u, 0.225, v + s * 0.95, lm(0x6a4a2a), 8); pz.chair.push({ x: WX(u), z: WZ(v + s * 0.95), yaw: s > 0 ? PI : 0 }); }); obU(u - 0.7, u + 0.7, v - 1.25, v + 1.25); });
  // piquenique
  bu(0.5, 0.3, 0.4, -6.5, 0.15, 26.4, lm(0xb5651d)); bu(0.18, 0.12, 0.18, -5.4, 0.06, 25.6, lm(0xc0392b)); blob(0.08, WX(-5.9), YG + 0.14, WZ(25.3), lm(0xe0602a));
  // lixeiras
  [[3.2, 9], [-3.2, -9], [3.2, -30], [-3.2, 30], [24, 3.6], [-8, 14.5]].forEach(([u, v]) => { cu(0.28, 0.24, 0.8, u, 0.4, v, lm(0x2e6b4a), 10); cu(0.3, 0.3, 0.05, u, 0.82, v, lm(0x1f4a33), 10); obP(WX(u), WZ(v), 0.3); });
  // bancos
  for (let k = 0; k < 8; k++) { const a = (22.5 + 45 * k) * PI / 180; bench(12.6 * Math.cos(a), 12.6 * Math.sin(a), Math.atan2(-Math.cos(a), -Math.sin(a))); }
  [[3.3, 14, -PI / 2], [-3.3, 14, PI / 2], [3.3, -30, -PI / 2], [-3.3, -30, PI / 2], [3.3, 28, -PI / 2], [-3.3, 28, PI / 2], [28, 4.3, PI], [28, -4.3, 0], [-14, 4.3, PI], [-14, -4.3, 0], [20, 9.3, 0], [30, 9.3, 0], [10.2, -23, PI / 2], [10.2, -14, PI / 2], [-8.5, 15, -PI / 2], [-8.5, 30, -PI / 2], [-24, -13.5, PI], [-30, -13.5, PI]].forEach(b => bench(b[0], b[1], b[2]));
  // árvores e postes
  [[-5, -34], [5, -34], [-5, -28], [5, -28], [-5, 31], [5, 31], [5, 36], [-5, 37], [-38, 36], [31, 36], [-38, -36], [33, -36], [-11, 13], [-36, 6], [36, 14], [36, -12], [-6, 22], [-8.5, 31], [-36, -31], [-12, -34], [-20, -35], [-28, -35], [12, 36], [24, 35], [-14, -9], [9, 12], [-20, 7], [22, -3.6], [35, 34], [35, -34]].forEach(([u, v]) => tree(u, v, 0.9 + ((u * 7 + v * 3) & 3) * 0.12));
  [[3, 12], [-3, 12], [3, -12], [-3, -12], [3, 26], [-3, 26], [3, -30], [-3, -30], [18, 3.6], [30, -3.6], [-16, 3.6], [-26, -4.6], [-9, 17], [10, -9], [3, 33], [-3, 33]].forEach(([u, v]) => lampPost(u, v));
}

// ====================================================== PARQUINHO (brinquedos interativos) ======================================================
const SW = [], SPR = [], toys = { car: null, see: null, slide: null };
const RED = () => lm(0xc8372d), YEL = () => lm(0xe3b83a), BLU = () => lm(0x2f6db5);
function buildPlayground() {
  // balanços (3 assentos; clique empurra; as crianças também pedalam)
  { const bx = CX - 27, bz = CZ + 29, top = 2.6, L = 1.8; B.box(5.6, 0.12, 0.12, bx, YG + top, bz, RED());
    [-2.6, 2.6].forEach(dx => [-1, 1].forEach(sg => B.cyl(0.05, 0.05, 2.82, bx + dx, YG + top / 2, bz + sg * 0.55, IRON(), 6, -sg * 0.4)));
    [-1.3, 0, 1.3].forEach((dx, i) => { const piv = new T.Group(); piv.position.set(bx + dx, YG + top, bz); grp.add(piv);
      [-0.2, 0.2].forEach(s => { const c = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, L, 4), new T.MeshLambertMaterial({ color: 0x2b2f35 })); c.position.set(s, -L / 2, 0); piv.add(c); });
      const seat = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.24), own([0xd6492f, 0x2f6db5, 0xe3b83a][i])); seat.position.set(0, -L, 0); piv.add(seat);
      const s = { piv, seat, L, top, px: bx + dx, pz: bz, ang: 0, vel: 0, occ: null, pump: false }; SW.push(s);
      inter([seat], () => { s.vel += (s.vel >= 0 ? 1 : -1) * 1.3 + 0.2; sfx(420, 0.05); }); });
    obR(bx - 2.9, bx + 2.9, bz - 1.3, bz + 1.3); }
  // escorregador (rampa com colisão: a bolinha rola)
  { const u = -15, base = 13.3, topY = 2.0, z0 = CZ + 16.1, z1 = CZ + 21.6, len = Math.hypot(z1 - z0, topY - 0.1), th = Math.atan2(topY - 0.1, z1 - z0), cx = CX + u;
    bu(1.5, 0.08, 1.5, u, topY, 15.4, YEL()); [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].forEach(([a, b]) => cu(0.05, 0.05, topY, u + a, topY / 2, 15.4 + b, BLU(), 6));
    [-0.72, 0.72].forEach(s => { bu(0.05, 0.5, 1.5, u + s, topY + 0.28, 15.4, RED()); }); bu(1.5, 0.5, 0.05, u, topY + 0.28, 16.15, RED()); bu(1.5, 0.5, 0.05, u, topY + 0.28, 14.65, RED());
    B.box(0.8, 0.06, len, cx, YG + (topY + 0.1) / 2, (z0 + z1) / 2, lm(0xb9bdc2), 0, th); [-0.42, 0.42].forEach(s => B.box(0.06, 0.16, len, cx + s, YG + (topY + 0.1) / 2 + 0.1, (z0 + z1) / 2, RED(), 0, th));
    [-0.3, 0.3].forEach(s => B.cyl(0.03, 0.03, 2.3, cx + s, YG + 1.0, CZ + 14.0, lm(0xb9bdc2), 5, 0.58)); for (let i = 0; i < 6; i++) bu(0.6, 0.04, 0.06, u, 0.3 + i * 0.34, 13.5 + i * 0.22, lm(0xb9bdc2));
    const rb = new CAN.Body({ mass: 0, shape: new CAN.Box(new CAN.Vec3(0.4, 0.03, len / 2)), position: new CAN.Vec3(cx, YG + (topY + 0.1) / 2, (z0 + z1) / 2), collisionFilterGroup: P.G.STATIC, material: P.M.stat }); rb.quaternion.setFromEuler(th, 0, 0); P.world.addBody(rb); P.statics.push(rb);
    obU(u - 0.9, u + 0.9, 14.55, 16.25); obU(u - 0.6, u + 0.6, 16.25, 21.8); obU(u - 0.5, u + 0.5, 13.2, 14.5);
    toys.slide = { x: cx, base: CZ + base, zb: CZ + 13.4, zt: CZ + 14.95, zp: CZ + 15.4, z0, z1, topY }; }
  // carrossel (clique gira; crianças sobem)
  { const u = -24, v = 19.5, cx = CX + u, cz = CZ + v, g = new T.Group(); g.position.set(cx, YG, cz); grp.add(g);
    const disc = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 0.12, 20), own(0xe3b83a)); disc.position.y = 0.34; g.add(disc);
    [0, 1, 2, 3].forEach(k => { const a = k * PI / 2 + PI / 4, bar = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.0, 5), new T.MeshLambertMaterial({ color: 0xc8372d })); bar.position.set(Math.cos(a) * 1.2, 0.9, Math.sin(a) * 1.2); g.add(bar); });
    const ring = new T.Mesh(new T.TorusGeometry(1.2, 0.03, 5, 20), new T.MeshLambertMaterial({ color: 0xc8372d })); ring.rotation.x = PI / 2; ring.position.y = 1.4; g.add(ring);
    cu(0.08, 0.12, 0.34, u, 0.17, v, IRON(), 8); obCircle(cx, cz, 1.75);
    toys.car = { g, x: cx, z: cz, ang: 0, w: 0, riders: [] }; inter([disc], () => { toys.car.w += 3.2; sfx(300, 0.1); }); }
  // gangorra
  { const u = -30.5, v = 11.5, x = CX + u, z = CZ + v, g = new T.Group(); g.position.set(x, YG + 0.5, z); grp.add(g);
    const pl = new T.Mesh(new T.BoxGeometry(3.6, 0.1, 0.34), own(0x2f9a6a)); g.add(pl); [-1, 1].forEach(s => { const h = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.34), new T.MeshLambertMaterial({ color: 0x2b2f35 })); h.position.set(s * 1.5, 0.2, 0); g.add(h); const sd = new T.Mesh(new T.BoxGeometry(0.4, 0.04, 0.3), new T.MeshLambertMaterial({ color: 0xc8372d })); sd.position.set(s * 1.4, 0.06, 0); g.add(sd); });
    B.add(B.xf(new T.CylinderGeometry(0.02, 0.5, 0.5, 4, 1), x, YG + 0.25, z), IRON()); obR(x - 1.9, x + 1.9, z - 0.4, z + 0.4);
    toys.see = { g, ang: 0, vel: 0, tgt: 0.2 }; inter([pl], () => { toys.see.tgt = -toys.see.tgt; toys.see.vel += toys.see.tgt * 2; sfx(260, 0.08); }); }
  // cavalinhos de mola
  [[-14, 28, 0xc8372d], [-12, 28, 0x2f6db5], [-31, 24.5, 0xe3b83a]].forEach(([u, v, col]) => { const x = CX + u, z = CZ + v, g = new T.Group(); g.position.set(x, YG, z); grp.add(g);
    const base = new T.Mesh(new T.CylinderGeometry(0.28, 0.3, 0.05, 10), new T.MeshLambertMaterial({ color: 0x2b2f35 })); base.position.y = 0.03; g.add(base); const sp = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.4, 6), new T.MeshLambertMaterial({ color: 0xb9bdc2 })); sp.position.y = 0.25; g.add(sp);
    const top = new T.Group(); top.position.y = 0.45; g.add(top); const body = new T.Mesh(new T.BoxGeometry(0.22, 0.2, 0.62), own(col)); body.position.y = 0.12; top.add(body); const hd = new T.Mesh(new T.BoxGeometry(0.16, 0.22, 0.2), new T.MeshLambertMaterial({ color: col })); hd.position.set(0, 0.28, 0.32); top.add(hd);
    const hdl = new T.Mesh(new T.BoxGeometry(0.4, 0.03, 0.03), new T.MeshLambertMaterial({ color: 0x2b2f35 })); hdl.position.set(0, 0.36, 0.2); top.add(hdl);
    const s = { top, x, z, a: 0, v: 0, occ: null }; SPR.push(s); inter([body], () => { s.v += 2.6; sfx(500, 0.06); }); obP(x, z, 0.35); });
  // caixa de areia (borda de madeira)
  [[-31, 15.4, 5.2, 0.2], [-31, 19.6, 5.2, 0.2]].forEach(([u, v, w, d]) => bu(w, 0.25, d, u, 0.12, v, WOODM())); [[-33.6, 17.5], [-28.4, 17.5]].forEach(([u, v]) => bu(0.2, 0.25, 4.2, u, 0.12, v, WOODM()));
  // cercadinho baixo do parquinho (abertura no lado leste)
  const fz = (u0, u1, v, ...r) => { for (let u = u0; u <= u1; u += 1.2) { bu(0.05, 0.7, 0.05, u, 0.35, v, WOODM()); } bu(u1 - u0, 0.05, 0.04, (u0 + u1) / 2, 0.62, v, WOODM()); bu(u1 - u0, 0.05, 0.04, (u0 + u1) / 2, 0.38, v, WOODM()); void r; };
  fz(-34, -10, 33.5); fz(-34, -10, 8.8);
  [[-34, 8.8, 33.5]].forEach(([u, v0, v1]) => { for (let v = v0; v <= v1; v += 1.2) bu(0.05, 0.7, 0.05, u, 0.35, v, WOODM()); bu(0.04, 0.05, v1 - v0, u, 0.62, (v0 + v1) / 2, WOODM()); bu(0.04, 0.05, v1 - v0, u, 0.38, (v0 + v1) / 2, WOODM()); });
  obU(-34.2, -33.8, 8.7, 33.6); obU(-34, -10, 8.6, 9.0); obU(-34, -10, 33.3, 33.7);
}

// ====================================================== BOLAS DE VERDADE (cesta e gol) ======================================================
function spawnBalls() {
  pz.balls.forEach(b => { if (b.mesh.parent) b.mesh.parent.remove(b.mesh); }); pz.balls.length = 0;
  const mk = (kind, u, v, r, c1, c2, mass, name) => { const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), new T.MeshLambertMaterial({ map: ballTex(c1, c2, kind) })); grp.add(m);
    const p = P.addProp({ mesh: m, shapes: [{ shape: new CAN.Sphere(r) }], mass, pos: [WX(u), YG + r + 0.05, WZ(v)], mat: P.M.ball, r: r + 0.05, name, damping: 0.1, adamp: 0.2 }); const o = { p, mesh: m, kind, py: p.b.position.y, cd: 0 }; pz.balls.push(o); return o; };
  mk('basket', 17, -22, 0.12, '#d9622b', '#2b1a10', 0.6, 'bola de basquete'); mk('basket', 22, -26, 0.12, '#d9622b', '#2b1a10', 0.6, 'bola de basquete');
  mk('soccer', 20, 21.5, 0.11, '#f4f4f4', '#222', 0.43, 'bola de futebol'); mk('soccer', 28, 24, 0.11, '#f4f4f4', '#222', 0.43, 'bola de futebol');
  mk('basket', -20, 11, 0.16, '#e84a5f', '#ffffff', 0.25, 'bola de borracha');
}
function ballSync(dt) {
  pz.balls.forEach(o => { const b = o.p.b; o.cd -= dt;
    if (o.kind === 'basket') pz.hoops.forEach(h => { if (o.py > h.y && b.position.y <= h.y && Math.hypot(b.position.x - h.x, b.position.z - h.z) < 0.19 && o.cd <= 0) { o.cd = 1.2; pz.score.bask++; toast('🏀 Cesta! (' + pz.score.bask + ')'); sfx(880, 0.08); setTimeout(() => sfx(1320, 0.12), 90); } });
    else if (o.kind === 'soccer') pz.goals.forEach(g => { const du = (b.position.x - g.x) * -g.dir; if (du > 0.05 && du < g.D && Math.abs(b.position.z - g.z) < g.W2 - 0.05 && b.position.y < g.GH && o.cd <= 0) { o.cd = 3; pz.score.gol++; toast('⚽ GOOOL! (' + pz.score.gol + ')'); sfx(660, 0.12); setTimeout(() => sfx(990, 0.2), 120); } });
    o.py = b.position.y; });
}

// ====================================================== ANIMAIS (pombos que fogem, patos no lago) ======================================================
const clamp = VR.clamp, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), PIG = [], DUCK = [];
function buildAnimals() {
  const bm = new T.MeshLambertMaterial({ color: 0x7d8591 }), hm = new T.MeshLambertMaterial({ color: 0x5a6270 }), km = new T.MeshLambertMaterial({ color: 0xe0902a }), bg = new T.SphereGeometry(0.09, 7, 5), hg = new T.SphereGeometry(0.05, 6, 5), kg = new T.BoxGeometry(0.02, 0.015, 0.04);
  for (let i = 0; i < 9; i++) { const g = new T.Group(), body = new T.Mesh(bg, bm); body.scale.set(1, 0.85, 1.5); body.position.y = 0.11; const hd = new T.Group(); hd.position.set(0, 0.17, 0.12); hd.add(new T.Mesh(hg, hm)); const k = new T.Mesh(kg, km); k.position.set(0, -0.005, 0.06); hd.add(k); g.add(body); g.add(hd);
    const a = rnd(0, TAU), r = rnd(5, 13), x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r; g.position.set(x, YG, z); grp.add(g); PIG.push({ g, hd, x, z, sx: x, sz: z, tx: x, tz: z, st: 0, t: rnd(0, 5), T: 1, yaw: rnd(0, TAU) }); }
  const wb = new T.MeshLambertMaterial({ color: 0xe9e5d8 }), gh = new T.MeshLambertMaterial({ color: 0x2f6b3a }), dg = new T.SphereGeometry(0.13, 8, 6), dh = new T.SphereGeometry(0.07, 7, 5);
  for (let i = 0; i < 4; i++) { const g = new T.Group(), b = new T.Mesh(dg, wb); b.scale.set(1, 0.7, 1.45); b.position.y = 0.09; const h = new T.Mesh(dh, gh); h.position.set(0, 0.22, 0.17); const k = new T.Mesh(kg, km); k.scale.set(2.2, 1.6, 2.2); k.position.set(0, 0.2, 0.26); g.add(b); g.add(h); g.add(k);
    const a = rnd(0, TAU), x = pz.pond.x + Math.cos(a) * 5, z = pz.pond.z + Math.sin(a) * 3; g.position.set(x, YG + 0.07, z); grp.add(g); DUCK.push({ g, x, z, yaw: rnd(0, TAU), tx: x, tz: z, t: rnd(0, 6) }); }
}
function updAnimals(dt, t) {
  PIG.forEach(p => { p.t += dt;
    if (p.st === 0) { p.hd.rotation.x = Math.max(0, Math.sin(p.t * 7 + p.yaw)) * 0.7; p.g.position.set(p.x, YG, p.z);
      if (Math.hypot(PL.x - p.x, PL.z - p.z) < 3.0) { const a = Math.atan2(p.z - PL.z, p.x - PL.x) + rnd(-0.8, 0.8), d = rnd(8, 14); p.sx = p.x; p.sz = p.z; p.tx = clamp(p.x + Math.cos(a) * d, X0 + 4, X1 - 8); p.tz = clamp(p.z + Math.sin(a) * d, Z0 + 4, Z1 - 4); p.st = 1; p.t = 0; p.T = rnd(1.4, 2.4); p.yaw = Math.atan2(p.tx - p.sx, p.tz - p.sz); p.g.rotation.y = p.yaw; } }
    else { const k = Math.min(1, p.t / p.T); p.x = p.sx + (p.tx - p.sx) * k; p.z = p.sz + (p.tz - p.sz) * k; p.g.position.set(p.x, YG + Math.sin(k * PI) * 2.4, p.z); p.hd.rotation.x = -0.3; p.g.rotation.z = Math.sin(p.t * 30) * 0.5; if (k >= 1) { p.st = 0; p.t = 0; p.g.rotation.z = 0; } } });
  const pd = pz.pond; DUCK.forEach(d => { d.t -= dt; if (d.t <= 0 || Math.hypot(d.tx - d.x, d.tz - d.z) < 0.6) { d.t = rnd(4, 9); const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 0.75; d.tx = pd.x + Math.cos(a) * pd.a * r; d.tz = pd.z + Math.sin(a) * pd.b * r; }
    d.yaw += wrapA(Math.atan2(d.tx - d.x, d.tz - d.z) - d.yaw) * damp(2, dt); d.x += Math.sin(d.yaw) * 0.45 * dt; d.z += Math.cos(d.yaw) * 0.45 * dt; d.g.position.set(d.x, YG + 0.07 + 0.012 * Math.sin(t * 0.003 + d.t), d.z); d.g.rotation.y = d.yaw; });
}

// ====================================================== BOLAS FALSAS (só dos NPCs) ======================================================
const sg = { x: 0, z: 0, y: 0.11, vx: 0, vz: 0, vy: 0, cd: 0 }, FB = [];
function buildFake() {
  sg.mesh = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), new T.MeshLambertMaterial({ map: ballTex('#f4f4f4', '#222', 'soccer') })); grp.add(sg.mesh); sg.x = WX(20); sg.z = WZ(21.5);
  for (let i = 0; i < 2; i++) { const m = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshLambertMaterial({ map: ballTex('#d9622b', '#2b1a10', 'basket') })); m.visible = false; grp.add(m); FB.push(m); }
}
function updFake(dt) {
  sg.cd -= dt; sg.vy -= 9.8 * dt; sg.y += sg.vy * dt; if (sg.y < 0.11) { sg.y = 0.11; sg.vy = Math.abs(sg.vy) > 1 ? -sg.vy * 0.45 : 0; }
  const f = Math.exp(-(sg.y > 0.13 ? 0.15 : 0.9) * dt); sg.vx *= f; sg.vz *= f; sg.x += sg.vx * dt; sg.z += sg.vz * dt;
  const x0 = WX(5.4), x1 = WX(34.6), z0 = WZ(11.4), z1 = WZ(31.6); if (sg.x < x0) { sg.x = x0; sg.vx = Math.abs(sg.vx); } if (sg.x > x1) { sg.x = x1; sg.vx = -Math.abs(sg.vx); } if (sg.z < z0) { sg.z = z0; sg.vz = Math.abs(sg.vz); } if (sg.z > z1) { sg.z = z1; sg.vz = -Math.abs(sg.vz); }
  sg.mesh.position.set(sg.x, YG + sg.y, sg.z); sg.mesh.rotation.x += sg.vz * dt * 6; sg.mesh.rotation.z -= sg.vx * dt * 6;
}

// ====================================================== VIDA NA PRAÇA (rotinas dos NPCs) ======================================================
const dt = () => A.dt, mix = (a, b, k) => a + (b - a) * k;
const ACTS = {};
function releaseAll(n) { BENCHES.forEach(b => { b.slots.forEach((s, i) => { if (s === n) b.slots[i] = null; }); }); SW.forEach(s => { if (s.occ === n) { s.occ = null; s.pump = false; } }); SPR.forEach(s => { if (s.occ === n) s.occ = null; }); if (toys.car) { const i = toys.car.riders.indexOf(n); if (i >= 0) toys.car.riders.splice(i, 1); } }
function dropCone(n) { if (n.cone && n.cone.parent) n.cone.parent.remove(n.cone); n.cone = null; }
function resetPose(n) { releaseAll(n); dropCone(n); n.sitT = 0; n.sitDrop = 0.42; n.lock = false; n.fy = null; n.legBob = 0; n.reach = 0; n.hold = false; n.moving = false; n.sp = n.sp0 || n.sp; }
function* nightGate(n, hx, hz) {                                             // à noite os moradores da praça vão embora e voltam de dia
  if (dark() <= 0.72) return; resetPose(n); n.vis = false;
  while (dark() > 0.55) yield* A.wait(n, 3);
  n.x = hx != null ? hx : WX(36); n.z = hz != null ? hz : CZ; n.at = A.nearest(n.x, n.z); n.vis = true;
}
function* runTo(n, id, sp) { const s0 = n.sp; n.sp = sp; yield* A.route(n, id); n.sp = s0; }
function* benchSit(n, secs, px, pxz, withB) {
  const free = BENCHES.filter(b => b.slots.some(s => !s)); if (!free.length) { yield* A.idle(n, 4); return; }
  const b = withB && withB.slots.some(s => !s) ? withB : free.slice().sort((p, q) => Math.hypot(p.x - (px == null ? n.x : px), p.z - (pxz == null ? n.z : pxz)) - Math.hypot(q.x - (px == null ? n.x : px), q.z - (pxz == null ? n.z : pxz)))[Math.floor(Math.random() * Math.min(3, free.length))];
  const slot = b.slots[0] ? 1 : 0; b.slots[slot] = n; n.bench = b; const ax = Math.cos(b.yaw) * (slot ? 0.42 : -0.42), az = -Math.sin(b.yaw) * (slot ? 0.42 : -0.42);
  yield* A.route(n, b.node); yield* A.goto(n, b.x + ax + b.fx * 1.0, b.z + az + b.fz * 1.0); yield* A.goto(n, b.x + ax, b.z + az, 0.8);
  n.yawT = b.yaw; n.moving = false; yield* A.wait(n, 0.3); n.sitT = 1; n.sitDrop = 0.42;
  let t = secs, look = rnd(2, 5); while (t > 0) { t -= dt(); look -= dt(); if (look <= 0) { look = rnd(3, 7); n.lookOff = rnd(-0.9, 0.9); if (Math.random() < 0.25 && n.cone) n.reach = 0.5; } yield; }
  n.sitT = 0; dropCone(n); yield* A.wait(n, 0.6); yield* A.goto(n, b.x + ax + b.fx * 1.0, b.z + az + b.fz * 1.0); b.slots[slot] = null; n.bench = null; n.at = b.node;
}
function makeCone() { const g = new T.Group(), c = new T.Mesh(new T.CylinderGeometry(0.05, 0.004, 0.15, 8), new T.MeshLambertMaterial({ color: 0xd9a24a })), s = new T.Mesh(new T.SphereGeometry(0.058, 8, 6), new T.MeshLambertMaterial({ color: pick([0xf4a9c8, 0x6b4a2e, 0xf6efe6, 0x9fd8a4]) })); c.position.y = -0.62; s.position.y = -0.52; g.add(c); g.add(s); return g; }
function* doKiosk(n) {
  yield* A.route(n, PZN.KH); yield* A.goto(n, WX(17 + rnd(-1.2, 1.2)), WZ(2.8)); n.yawT = 0; yield* A.wait(n, 0.6); n.reach = 0.6; yield* A.wait(n, 0.4);
  if (pz.vendor) A.say(pz.vendor, pick(['Aqui está!', 'Bom apetite!', 'Gostou?', 'Volte sempre!']), 2.4); sfx(880, 0.08); dropCone(n); n.cone = makeCone(); n.arms[1].add(n.cone); yield* A.wait(n, 1.0);
}
function* doPond(n) { yield* A.route(n, PZN.DH); yield* A.goto(n, WX(-12.4), WZ(-24 + rnd(-2, 2))); n.yawT = -PI / 2; if (Math.random() < 0.5) A.say(n, pick(['Olha os patinhos!', 'Que lago bonito', 'Os patos!']), 2.6); yield* A.wait(n, rnd(7, 14)); }
function* doRing(n) { const R = PZN.R; let i = Math.floor(Math.random() * 8); for (let k = 0; k < 9; k++) { yield* A.route(n, R[(i + k) % 8]); } }
function* jog(n) { const s0 = n.sp, R = PZN.R; n.sp = 2.7; for (let i = 0; i < 5; i++) yield* A.route(n, pick([R[0], R[2], R[4], R[6], PZN.AN2, PZN.AS3, PZN.CH, PZN.DH, PZN.FH, PZN.PH])); n.sp = s0; yield* A.idle(n, rnd(4, 8)); }
function* kidVisit(n) {                                                        // criança de casa: corre até a praça, brinca e volta
  n.sp0 = n.sp; yield* runTo(n, PZN.PG, 2.4); const rounds = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < rounds && dark() < 0.7; i++) { if (Math.random() < 0.15) { yield* doKiosk(n); yield* A.wait(n, 3); dropCone(n); } else yield* ACTS[pick(['swing', 'swing', 'slide', 'slide', 'carousel', 'sand', 'spring', 'run'])](n); yield* A.wait(n, rnd(0.5, 2)); }
  dropCone(n); n.sp = n.sp0; yield* runTo(n, PZN.PG, 2.4); n.sp = n.sp0;
}
function* visit(n) {                                                           // vizinhos de casa também frequentam a praça
  yield* A.route(n, PZN.PG); const acts = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < acts; i++) { const r = Math.random();
    if (r < 0.28) yield* benchSit(n, rnd(25, 60)); else if (r < 0.5) { yield* doKiosk(n); yield* benchSit(n, rnd(18, 35)); } else if (r < 0.68) yield* doPond(n); else if (r < 0.84) yield* doRing(n); else yield* jog(n); }
  dropCone(n); yield* A.route(n, PZN.PG);
}
// ---- crianças
ACTS.swing = function* (n) {
  const s = SW.find(q => !q.occ); if (!s) { yield* ACTS.run(n); return; } s.occ = n; yield* A.route(n, PZN.PH); yield* A.goto(n, s.px, s.pz - 1.0, 2.0); yield* A.goto(n, s.px, s.pz - 0.3, 1.0);
  n.lock = true; n.moving = false; n.yawT = 0; n.sitT = 1; n.legBob = 1; s.pump = true; s.vel += 1.2; let t = rnd(14, 26);
  while (t > 0) { t -= dt(); const c = Math.cos(s.ang), si = Math.sin(s.ang); n.x = s.px; n.z = s.pz - s.L * si; n.fy = YG + s.top - s.L * c + 0.03; n.yawT = 0; if (Math.random() < 0.003) A.say(n, pick(['Mais alto!', 'Uhuu!', 'Olha eu!']), 2); yield; }
  s.pump = false; n.lock = false; n.sitT = 0; n.legBob = 0; n.fy = null; s.occ = null; yield* A.wait(n, 0.3); yield* A.goto(n, s.px, s.pz - 1.3, 1.5);
};
ACTS.slide = function* (n) {
  const S = toys.slide; yield* A.route(n, PZN.PH); yield* A.goto(n, S.x, S.zb - 0.6, 2.0); n.lock = true; let t = 0;
  while (t < 1) { t += dt() / 2.2; n.x = S.x; n.z = mix(S.zb, S.zt, t); n.fy = YG + 2.0 * t; n.yawT = 0; n.moving = true; yield; }
  n.moving = false; n.z = S.zp; n.fy = YG + S.topY; n.sitT = 1; yield* A.wait(n, 0.6); t = 0;
  while (t < 1) { t += dt() / 1.7; const k = t * t * 0.4 + t * 0.6; n.z = mix(S.z0, S.z1, k); n.fy = YG + mix(S.topY, 0.1, k) + 0.03; n.yawT = 0; yield; }
  if (Math.random() < 0.6) A.say(n, pick(['Uhuu!', 'De novo!', 'Que legal!']), 2); n.lock = false; n.sitT = 0; n.fy = null; yield* A.wait(n, 0.4); yield* A.goto(n, S.x, S.z1 + 1.2, 1.8);
};
ACTS.carousel = function* (n) {
  const C = toys.car; if (C.riders.length >= 3) { yield* ACTS.run(n); return; } yield* A.route(n, PZN.PH); yield* A.goto(n, C.x + 2.3, C.z - 0.2, 1.8); const slot = C.riders.length; C.riders.push(n); C.w = Math.max(C.w, 2.4); n.lock = true; n.moving = false; let t = rnd(9, 15);
  while (t > 0 && C.w > 0.45) { t -= dt(); const a = slot * 2.1 - C.ang; n.x = C.x + Math.cos(a) * 1.0; n.z = C.z + Math.sin(a) * 1.0; n.fy = YG + 0.4; n.yawT = Math.atan2(Math.sin(a), -Math.cos(a)); if (C.w < 1.4 && Math.random() < 0.01) C.w += 0.8; yield; }
  n.lock = false; n.fy = null; const i = C.riders.indexOf(n); if (i >= 0) C.riders.splice(i, 1); yield* A.wait(n, 0.3); yield* A.goto(n, C.x + 2.3, C.z + 0.3, 1.8);
};
ACTS.sand = function* (n) {
  yield* A.route(n, PZN.PH); yield* A.goto(n, WX(-31 + rnd(-1, 1)), WZ(14.7), 1.8); yield* A.goto(n, WX(-31 + rnd(-1.2, 1.2)), WZ(17.5 + rnd(-0.8, 0.8)), 1.2); n.sitDrop = 0.76; n.sitT = 1; n.yawT = rnd(-PI, PI); let t = rnd(12, 22), d = 1;
  while (t > 0) { t -= dt(); d -= dt(); if (d <= 0) { d = rnd(0.8, 1.8); n.reach = 0.5; } yield; }
  n.sitT = 0; n.sitDrop = 0.42; yield* A.wait(n, 0.6);
};
ACTS.spring = function* (n) {
  const s = SPR.find(q => !q.occ); if (!s) { yield* ACTS.run(n); return; } s.occ = n; yield* A.route(n, PZN.PH); yield* A.goto(n, s.x, s.z - 1.0, 1.8); n.lock = true; n.moving = false; n.sitT = 1; n.yawT = 0; let t = rnd(8, 14), k = 0;
  while (t > 0) { t -= dt(); k -= dt(); if (k <= 0) { k = 1.0; s.v += 1.8; } n.x = s.x; n.z = s.z - 0.02; n.fy = YG + 0.66; n.yawT = 0; yield; }
  n.lock = false; n.sitT = 0; n.fy = null; s.occ = null; yield* A.wait(n, 0.3); yield* A.goto(n, s.x, s.z - 1.1, 1.8);
};
ACTS.run = function* (n) { const R = PZN.R, hubs = [PZN.PH, PZN.AN1, PZN.FH, R[1], R[3], R[5], PZN.DH, PZN.CH, PZN.KH]; n.sp0 = n.sp0 || n.sp; for (let i = 0; i < 4; i++) yield* runTo(n, pick(hubs), 3.0); n.sp = n.sp0; yield* A.wait(n, rnd(0.5, 2)); };
function* kidLife(n) { n.sp0 = n.sp; for (;;) { yield* nightGate(n); const a = pick(['swing', 'swing', 'slide', 'slide', 'carousel', 'sand', 'spring', 'run']); yield* ACTS[a](n); yield* A.wait(n, rnd(0.5, 2)); } }
// ---- adultos
function* vendorLife(n) { const hx = WX(17), hz = WZ(5.4); let t = rnd(6, 12); for (;;) { n.vis = dark() < 0.72; n.x = hx; n.z = hz; n.yawT = PI; n.moving = false; t -= dt();
  if (t <= 0) { t = rnd(10, 22); if (n.vis && Math.hypot(PL.x - hx, PL.z - hz) < 16) { A.say(n, pick(['Sorvete! Sorvete gelado!', 'Vai um sorvetinho?', 'Tem de morango, chocolate...', 'Bom dia, pessoal!']), 3); n.wave = 1.8; } } yield; } }
function* chessLife(n, seat) { for (;;) { yield* nightGate(n, seat.x, seat.z); n.x = seat.x; n.z = seat.z; n.yawT = seat.yaw; n.moving = false; n.sitT = 1; let t = rnd(5, 12);
  while (t > 0) { t -= dt(); n.x = seat.x; n.z = seat.z; n.yawT = seat.yaw; n.lock = false; if (dark() > 0.72) break; yield; } n.reach = 0.6; if (Math.random() < 0.25) A.say(n, pick(['Xeque!', 'Hmm...', 'Boa jogada!', 'Essa eu não vi']), 2.4); } }
function* basketLife(n, k) { const hp = pz.hoops[k], fb = FB[k], sgn = (WZ(-23) - hp.z) > 0 ? 1 : -1; let ph = 0;
  for (;;) { yield* nightGate(n, WX(19.5), WZ(-23)); fb.visible = false; yield* A.route(n, PZN.CH); const sx = hp.x + rnd(-2.2, 2.2), sz = hp.z + sgn * rnd(3.4, 4.6); yield* A.goto(n, sx, sz); n.yawT = Math.atan2(hp.x - n.x, hp.z - n.z);
    for (let s = 0; s < 3 && dark() < 0.72; s++) { let t = rnd(2, 3.5); fb.visible = true; n.hold = false;
      while (t > 0) { t -= dt(); ph += dt() * 7; const hx = n.x + Math.sin(n.yaw) * 0.32, hz = n.z + Math.cos(n.yaw) * 0.32; fb.position.set(hx, n.y + 0.14 + Math.abs(Math.sin(ph)) * 0.6, hz); n.moving = false; yield; }
      n.reach = 0.9; yield* A.wait(n, 0.45); const x0 = n.x, z0 = n.z, ok = Math.random() < 0.6, ex = hp.x + (ok ? 0 : rnd(-0.45, 0.45)), ez = hp.z + (ok ? 0 : rnd(-0.45, 0.45)); let u = 0;
      while (u < 1) { u += dt() / 1.1; fb.position.set(mix(x0, ex, u), n.y + 1.9 + (hp.y - YG - 1.9) * u + Math.sin(u * PI) * 1.7, mix(z0, ez, u)); yield; }
      if (ok) { A.say(n, pick(['Cesta!', 'Boa!', 'Tá on fire!']), 2); sfx(900, 0.06); } else A.say(n, pick(['Quase!', 'Ah, não!']), 2); fb.visible = false; yield* A.wait(n, 1.1); }
    fb.visible = false; yield* A.wait(n, 0.5); } }
function* soccerLife(n, idx) { let cd = 0; for (;;) { yield* nightGate(n, WX(20), WZ(15)); yield* A.route(n, PZN.FH); yield* A.goto(n, WX(12 + idx * 16), WZ(21.5 + rnd(-3, 3))); let t = rnd(70, 140);
  while (t > 0 && dark() < 0.72) { t -= dt(); cd -= dt(); const pr = pz.soccer && pz.soccer[1 - idx], d = Math.hypot(sg.x - n.x, sg.z - n.z), dp = pr ? Math.hypot(sg.x - pr.x, sg.z - pr.z) : 99;
    if (d <= dp + 0.4) { if (d < 0.6 && cd <= 0 && sg.y < 0.5) { const tx = (pr ? pr.x : WX(idx ? 5 : 35)) + rnd(-2, 2), tz = (pr ? pr.z : WZ(21.5)) + rnd(-2, 2), L = Math.hypot(tx - sg.x, tz - sg.z) || 1, sp = Math.min(8, 2.5 + L * 0.7); sg.vx = (tx - sg.x) / L * sp; sg.vz = (tz - sg.z) / L * sp; sg.vy = rnd(0.5, 2.8); cd = 1.1; n.reach = 0.35; if (Math.random() < 0.15) A.say(n, pick(['Toma!', 'Passa!', 'Vai!']), 1.8); } else A.stepTo(n, sg.x, sg.z, 3.0); }
    else { const tx = clamp(sg.x + (n.x > sg.x ? 4 : -4), WX(7), WX(33)), tz = clamp(sg.z + (idx ? 3 : -3), WZ(13), WZ(30)); if (A.stepTo(n, tx, tz, 1.8) < 0.3) { n.moving = false; n.yawT = Math.atan2(sg.x - n.x, sg.z - n.z); } }
    yield; }
  n.moving = false; yield* A.idle(n, 6); } }
function spawnResidents() {                                                    // crianças moram em casas do bairro; o resto do elenco são frequentadores fixos (somem à noite)
  const sp = (x, z, co, o) => npc.spawn(Object.assign({ x, z, at: A.nearest(x, z), co }, o || {}));
  [2, 4, 9, 11, 13].forEach(h => npc.addKid(h));
  pz.vendor = sp(WX(17), WZ(5.4), n => vendorLife(n));
  sp(pz.chair[0].x, pz.chair[0].z, n => chessLife(n, pz.chair[0])); sp(pz.chair[1].x, pz.chair[1].z, n => chessLife(n, pz.chair[1]));
  [0, 1].forEach(k => sp(WX(19.5), WZ(-23), n => basketLife(n, k)));
  pz.soccer = []; [0, 1].forEach(k => pz.soccer.push(sp(WX(12 + k * 16), WZ(21.5), n => soccerLife(n, k))));
}

// ====================================================== ATUALIZAÇÃO ======================================================
const SCALE = [262, 294, 330, 392, 440, 523], TUNE = [0, 2, 4, 2, 3, 1, 0, 2, 5, 4, 3, 2, 1, 0, 1, 2];
VR.hook(54, (d, t) => {
  if (!pz.built) return;
  const dk = dark(), on = c01((dk - 0.35) * 3); LAMP_M.color.setRGB(0.6 + 0.4 * on, 0.62 + 0.3 * on, 0.65 + 0.05 * on, T.SRGBColorSpace); GLOW_M.opacity = on * 0.9;
  const ei = c01((dk - 0.4) * 2.2); CITY.mats.forEach(m => { m.emissiveIntensity = ei; });
  if (!H.active || Math.hypot(PL.x - CX, PL.z - CZ) > 130) return;
  if (pz.flag) pz.flag.rotation.z = Math.sin(t * 0.004) * 0.08;
  SW.forEach(s => { const acc = -(9.8 / s.L) * Math.sin(s.ang) - 0.12 * s.vel + (s.pump && Math.abs(s.ang) < 0.85 ? 0.9 * (s.vel >= 0 ? 1 : -1) : 0); s.vel += acc * d; s.ang += s.vel * d; if (Math.abs(s.ang) > 1.15) { s.ang = Math.sign(s.ang) * 1.15; s.vel *= -0.4; } s.piv.rotation.x = s.ang; });
  { const C = toys.car; C.w *= Math.exp(-0.35 * d); C.ang += C.w * d; C.g.rotation.y = C.ang; }
  { const S = toys.see; S.vel += ((S.tgt - S.ang) * 40 - S.vel * 4) * d; S.ang += S.vel * d; S.g.rotation.z = S.ang; }
  SPR.forEach(s => { s.v += (-40 * s.a - 1.6 * s.v) * d; s.a += s.v * d; s.top.rotation.x = s.a * 0.35; s.top.position.y = 0.45 + Math.abs(s.a) * 0.05; });
  const fo = pz.fo; if (fo.on) { fo.clk = (fo.clk || 0) + d; const pa = fo.pts.geometry.attributes.position.array; let k = 0; fo.em.forEach(e => { for (let j = 0; j < 20; j++) { const tt = (fo.clk + j * e.T / 20) % e.T; pa[k++] = CX + e.p[0] + e.v[0] * tt; pa[k++] = YG + e.p[1] + e.v[1] * tt - 4.9 * tt * tt; pa[k++] = CZ + e.p[2] + e.v[2] * tt; } }); fo.pts.geometry.attributes.position.needsUpdate = true; }
  pz.fwater.material.color.setHSL(0.55, 0.55, 0.5 + 0.03 * Math.sin(t * 0.002)); pz.pondMat.color.setHSL(0.55, 0.5, 0.42 + 0.03 * Math.sin(t * 0.0017));
  pz.clkT = (pz.clkT || 0) - d; if (pz.clkT <= 0) { pz.clkT = 1; const dt2 = new Date(), m = dt2.getMinutes() + dt2.getSeconds() / 60, h = (dt2.getHours() % 12) + m / 60; pz.hands.forEach(([hh, mh]) => { hh.rotation.z = -h / 12 * TAU; mh.rotation.z = -m / 60 * TAU; }); }
  const mus = pz.mus; if (mus.on) { mus.t -= d; if (mus.t <= 0) { mus.t = 0.32; const dist = Math.hypot(PL.x - WX(-27), PL.z - CZ); if (dist < 70) sfx(SCALE[TUNE[mus.i++ % TUNE.length]] * (mus.i % 16 > 8 ? 2 : 1), 0.28, 0.35 * (1 - dist / 70)); } }
  updAnimals(d, t); updFake(d);
});

// ====================================================== CONSTRUÇÃO E LIGAÇÃO ======================================================
pz.build = () => {
  if (pz.built) return; pz.built = true; grp = pz.group = new T.Group(); H.group.add(grp); B = H.Batch();
  buildGraph(); buildGround(); buildCity(); buildDecor(); buildPlayground(); buildAnimals(); buildFake(); B.flush(grp);
  P.syncs.push(ballSync); npc.plaza = { visit, kid: kidVisit };
};
function clearToys() { BENCHES.forEach(b => { b.slots = [null, null]; }); SW.forEach(s => { s.occ = null; s.pump = false; }); SPR.forEach(s => { s.occ = null; }); if (toys.car) toys.car.riders.length = 0; }
{ const enter0 = H.enter, exit0 = H.exit;
  H.enter = function () { const r = enter0.apply(this, arguments); try { if (!pz.built) pz.build(); spawnBalls(); clearToys(); if (npc.built && !pz.spawned) { pz.spawned = true; spawnResidents(); } } catch (e) { VR.log('praça: ' + e.message + ' ' + ((e.stack || '').split('\n')[1] || '')); } return r; };
  H.exit = function () { try { clearToys(); } catch (e) {} return exit0.apply(this, arguments); };
}
})();
