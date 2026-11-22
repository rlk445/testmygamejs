/* Garagem de 2 carros (colada na cozinha) + cerca estilo EUA em volta do terreno + quintais laterais e dos fundos.
   - Garagem: porta seccional detalhada que sobe (clique, botoeira interna ou teclado externo), luzes com interruptor, porta para a cozinha, bancada, estante, aquecedor (sem carro).
   - Cerca: cerquinha branca na frente (portão de pedestre e portão duplo da entrada de carros), cerca de madeira nos lados e no fundo.
   Depende de house.js (exports H.*) e de outdoor.js (out.car). É construída no fim de house.build() (VR.garage.build). */
(() => {
'use strict';
const VR = window.VR, T = VR.T, H = VR.house, P = VR.phys, clamp = VR.clamp;
const YG = H.YG, F = H.FY, CT = F + 2.7, GF = YG + 0.04, FB = F - YG;        // gramado, piso do térreo, teto do térreo, piso da garagem, altura da base de tijolo
const GX0 = 10.05, GX1 = 16.45, GZ0 = -2.35, GZ1 = 3.4, GCX = (GX0 + GX1) / 2, GCZ = (GZ0 + GZ1) / 2;   // paredes da garagem (eixos das paredes)
const DW = 4.9, DX = 13.3, DH = 2.4;                                          // porta da garagem: largura, centro em x, altura
const FX0 = -8.0, FX1 = 18.6, FZ0 = -9.3, FZ1 = 14.0;                         // cerca: oeste, leste, frente (calçada) e fundos
const gar = VR.garage = { built: false, group: null, door: { v: 0, t: 0 }, light: false };
const sfx = (f, d) => { try { VR.ui.sfx(f, d); } catch (e) {} };
const lm = H.lm, own = H.own, WHT = H.WHT;
const setBody = (b, on) => { if (!b) return; b.collisionFilterGroup = on ? P.G.STATIC : 0; b.collisionFilterMask = on ? -1 : 0; };
const lerp = (a, b, k) => a + (b - a) * k;
const OUT = ['lawn', 'street', 'lawn2', 'quintal'];                           // cômodos "de fora" (para os cliques valerem)
const GZ = ['lawn', 'quintal', 'garagem', 'pgd', 'pgs'];

// ====================================================== ONDE SE ANDA ======================================================
const zn = H.zn, ob = H.ob, D = H.doors;
const gdOpen = () => gar.door.v > 0.5;
const dOpen = k => () => !!(D[k] && D[k].v > 0.35);
const dClosed = k => () => !(D[k] && D[k].v > 0.35);
// porta cozinha -> garagem: coz (x<=9,8) -> pgi (soleira) -> pgs (degrau dentro da garagem) -> garagem
zn('pgi', 'down', 9.7, 10.2, 1.1, 1.9, dOpen('gin'));
zn('pgs', 'down', 10.1, 10.62, 1.1, 1.9);
zn('pgd', 'down', 11.0, 15.65, -2.65, -2.0, gdOpen);                          // vão da porta da garagem (só com a porta aberta)
zn('garagem', 'down', 10.2, 16.3, -2.0, 3.25);
// quintais: lateral oeste, fundos, atrás da cozinha, atrás da garagem e lateral leste (sempre dentro da cerca)
[[-7.8, -2.85, -2.6, 13.8], [-7.8, 18.4, 6.3, 13.8], [0.85, 7.45, 4.25, 6.4], [7.45, 10.3, 2.65, 6.4], [10.3, 18.4, 3.7, 6.4], [16.7, 18.4, -2.6, 3.8]]
  .forEach(r => zn('quintal', 'down', r[0], r[1], r[2], r[3]));
H.ZY.garagem = GF; H.ZY.pgd = YG + 0.02; H.ZY.pgs = F - 0.16; H.ZY.pgi = F; H.ZY.quintal = YG;
H.AMB.garagem = 0.7; H.AMB.pgd = 0.9; H.AMB.pgs = 0.75; H.AMB.pgi = 0.75;
H.PASS.pgi = ['coz', 'garagem']; H.PASS.pgs = ['garagem', 'coz']; H.PASS.pgd = ['garagem', 'lawn'];
// obstáculos
ob('down', 10.25, 13.05, 2.65, 3.4);                                          // bancada
ob('down', 10.1, 10.55, -2.3, 0.45);                                          // estante
ob('down', 15.8, 16.4, 2.7, 3.35);                                            // aquecedor de água
ob('down', -3.3, -2.6, -0.4, 0.4);                                            // chaminé
ob('down', 17.1, 17.75, 0.5, 2.0);                                            // lixeiras
[6.9, 9.1, 11.3].forEach(x => ob('down', x - 0.65, x + 0.65, 8.4, 11.8));                      // canteiros da horta
ob('down', 12.6, 13.4, 12.2, 13.1);                                           // composteira
[[4.0, 10.5], [13.5, 9.5], [-5.2, 7.5]].forEach(([x, z]) => ob('down', x - 0.3, x + 0.3, z - 0.3, z + 0.3));   // árvores do quintal
// cerca (retângulos finos; os portões só bloqueiam fechados)
const T4 = 0.15;                                                              // espessura (com folga) das barreiras: o jogador não atravessa a cerca nem num quadro lento
ob('down', FX0, 4.1, FZ0 - T4, FZ0 + T4); ob('down', 5.3, 10.9, FZ0 - T4, FZ0 + T4); ob('down', 16.1, FX1, FZ0 - T4, FZ0 + T4);
ob('down', 4.1, 5.3, FZ0 - T4, FZ0 + T4, dClosed('gate')); ob('down', 10.9, 13.5, FZ0 - T4, FZ0 + T4, dClosed('gateL')); ob('down', 13.5, 16.1, FZ0 - T4, FZ0 + T4, dClosed('gateR'));
ob('down', FX0 - T4, FX0 + T4, FZ0, FZ1); ob('down', FX1 - T4, FX1 + T4, FZ0, FZ1); ob('down', FX0, FX1, FZ1 - T4, FZ1 + T4);

// ====================================================== CONSTRUÇÃO ======================================================
gar.build = parent => {
  if (gar.built) return; gar.built = true;
  const grp = gar.group = new T.Group(); parent.add(grp);
  const B = H.Batch(), BRICK = H.BRICK, EXT = H.PAINT.ext, INN = H.PAINT.gar;
  const GL = new T.MeshLambertMaterial({ color: 0xaed9ee, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
  const mc = (w, h, rep) => H.cvs(w, h, rep);
  const dark = lm(0x3a3d42), steel = lm(0xc7ccd1), woodD = lm(0x4b3626), woodM = lm(0x8a5a33), cardb = lm(0xb08d5b), copper = lm(0xb87333), CONC = lm(0xb9b6ae);
  const glass = (ax, c, a, w, y0, y1) => { const m = new T.Mesh(new T.PlaneGeometry(w, y1 - y0), GL); m.position.set(ax === 'x' ? a : c, (y0 + y1) / 2, ax === 'x' ? c : a); if (ax === 'z') m.rotation.y = Math.PI / 2; grp.add(m); };
  const flatM = (w, d, x, y, z, mat, up) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2; m.position.set(x, y, z); grp.add(m); return m; };

  // ---------- paredes: frente (com o vão da porta), leste, fundos e o trecho da parede oeste que fica atrás da cozinha ----------
  H.wall(B, 'x', GZ0, GX0, GX1, F, CT, INN, EXT, [{ c: DX, w: DW, y0: F, y1: GF + DH }]);
  H.wall(B, 'z', GX1, GZ0, GZ1, F, CT, EXT, INN, [{ c: 0.6, w: 1.0, y0: F + 0.95, y1: F + 2.05 }]);
  H.wall(B, 'x', GZ1, GX0, GX1, F, CT, EXT, INN, [{ c: DX, w: 1.2, y0: F + 0.95, y1: F + 2.05 }]);
  H.wall(B, 'z', GX0, 2.35, GZ1, F, CT, INN, EXT);
  H.win(B, 'z', GX1, 0.6, 1.0, F + 0.95, F + 2.05); glass('z', GX1, 0.6, 1.0, F + 0.95, F + 2.05);
  H.win(B, 'x', GZ1, DX, 1.2, F + 0.95, F + 2.05); glass('x', GZ1, DX, 1.2, F + 0.95, F + 2.05);
  // base de tijolo (como no resto da casa) e quinas brancas
  H.wbox(B, 0.8, FB, 0.14, 10.45, YG + FB / 2, -2.37, BRICK); H.wbox(B, 0.77, FB, 0.14, 16.135, YG + FB / 2, -2.37, BRICK);
  H.wbox(B, 0.14, FB, 5.82, 16.47, YG + FB / 2, GCZ, BRICK); H.wbox(B, 6.5, FB, 0.14, GCX, YG + FB / 2, 3.42, BRICK); H.wbox(B, 0.14, FB, 1.1, 10.07, YG + FB / 2, 2.9, BRICK);
  [[16.47, -2.37], [16.47, 3.42], [10.03, 3.42]].forEach(([x, z]) => B.box(0.12, CT - F, 0.12, x, (F + CT) / 2, z, WHT));
  // moldura da porta da garagem
  B.box(DW + 0.34, 0.14, 0.07, DX, GF + DH + 0.07, GZ0 - 0.05, WHT); [-1, 1].forEach(s => B.box(0.12, DH + 0.14, 0.07, DX + s * (DW / 2 + 0.11), GF + (DH + 0.14) / 2, GZ0 - 0.05, WHT));
  B.box(DW, 0.05, 0.14, DX, GF + 0.025, GZ0 - 0.05, CONC);                                                                // soleira de concreto
  // telhado de duas águas, mais baixo que o da ala da cozinha (encosta na empena dela)
  H.gable(B, { x: GCX, z: GCZ, y0: CT, rise: 0.58, W: GZ1 - GZ0, L: GX1 - GX0, ovF: 0.5, ovB: 0.5, e0: 0, e1: 0.4, roof: H.ROOFM, wall: H.SIDING_DS, c0: 0 });
  // lanternas ao lado da porta da garagem
  const lantM = own(0xfff6dd);
  [10.45, 16.1].forEach(x => { const m = new T.Mesh(new T.BoxGeometry(0.12, 0.22, 0.12), lantM); m.position.set(x, F + 1.8, GZ0 - 0.1); grp.add(m);
    B.box(0.16, 0.03, 0.16, x, F + 1.93, GZ0 - 0.1, dark); B.box(0.16, 0.03, 0.16, x, F + 1.67, GZ0 - 0.1, dark); B.box(0.03, 0.1, 0.1, x, F + 1.8, GZ0 - 0.045, dark); });
  H.light({ p: [DX, F + 1.9, GZ0 - 0.9], auto: () => !!(VR.sky && VR.sky.cfg.dark > 0.4), zones: ['lawn', 'quintal', 'pgd'], k: 0.8, dist: 8, decay: 1.2, col: 0xffd9a0, emis: [{ m: lantM, c: 0xffd27a }] });

  // ---------- interior: piso, forro, degrau da porta da cozinha ----------
  const conc = (() => { const k = mc(256, 256, [GX1 - GX0 - 0.1, GZ1 - GZ0 - 0.1].map(v => v / 2.4)), g = k.g, r = H.rnd(21);
    g.fillStyle = '#9d9b96'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(70,68,64,.16)' : 'rgba(255,255,255,.1)'; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    const gr = g.createRadialGradient(150, 130, 4, 150, 130, 42); gr.addColorStop(0, 'rgba(25,25,28,.34)'); gr.addColorStop(1, 'rgba(25,25,28,0)'); g.fillStyle = gr; g.fillRect(90, 70, 120, 120);   // mancha de óleo
    g.strokeStyle = 'rgba(50,50,48,.6)'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256); k.t.needsUpdate = true; return k.t; })();
  flatM(GX1 - GX0 - 0.1, GZ1 - GZ0 - 0.1, GCX, GF, GCZ, new T.MeshLambertMaterial({ map: conc }), true);
  flatM(GX1 - GX0 - 0.1, GZ1 - GZ0 - 0.1, GCX, CT, GCZ, lm(0xf4f1ea), false);
  P.staticBox(GCX, GF - 0.1, GCZ, 3.1, 0.1, 2.8);
  B.box(0.52, F - 0.16 - GF, 0.9, 10.36, (GF + F - 0.16) / 2, 1.5, CONC); P.staticBox(10.36, (GF + F - 0.16) / 2, 1.5, 0.26, (F - 0.16 - GF) / 2, 0.45);   // degrau (a cozinha fica 32 cm acima)
  H.trim(B, 'z', GX0, 1.5, 0.9, 2.1, F);
  // ---------- porta da cozinha para a garagem ----------
  D.gin = H.mkDoor(grp, { ax: 'z', c: GX0, a: 1.5, w: 0.9, h: 2.1, y0: F, hinge: 1, ang: 1.75, col: 0xe9e3d6, zones: ['coz', 'pgi', 'pgs', 'garagem'] });
  H.NEAR.push({ d: 'gin', lvl: 'down', x0: 9.3, x1: 11.3, z0: 0.85, z1: 2.15 });

  // ---------- porta seccional (4 painéis), detalhada: painéis em relevo, janelas, dobradiças, rolamentos, trilhos, mola de torção, cabos, vedação, maçaneta, abridor com braço e botoeiras ----------
  const panelTex = win => { const k = mc(1024, 128), g = k.g;
    g.fillStyle = '#efece4'; g.fillRect(0, 0, 1024, 128);
    for (let y = 0; y < 128; y += 8) { g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(0, y, 1024, 2); }                                   // nervuras finas de chapa
    for (let i = 0; i < 4; i++) { const x = i * 256;
      g.fillStyle = '#e4e0d6'; g.fillRect(x + 16, 16, 224, 96);                                                                           // painel em relevo
      g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(x + 16, 16, 224, 4); g.fillRect(x + 16, 16, 4, 96);                              // luz (cima/esquerda)
      g.fillStyle = 'rgba(0,0,0,.30)'; g.fillRect(x + 16, 108, 224, 4); g.fillRect(x + 236, 16, 4, 96);                                  // sombra (baixo/direita)
      g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 2; g.strokeRect(x + 34, 32, 188, 64);                                              // moldura interna
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 34, 32, 188, 2); }
    if (win) for (let i = 0; i < 4; i++) { const x = i * 256 + 24, gr = g.createLinearGradient(x, 18, x + 208, 112); gr.addColorStop(0, '#b9d8ea'); gr.addColorStop(0.5, '#6f98b4'); gr.addColorStop(1, '#3f6079');
      g.fillStyle = '#f7f6f1'; g.fillRect(x - 6, 12, 220, 104); g.fillStyle = gr; g.fillRect(x, 18, 208, 92);                                                // moldura + vidro
      g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(x + 20, 18); g.lineTo(x + 70, 18); g.lineTo(x + 20, 110); g.lineTo(x - 10, 110); g.closePath(); g.fill();   // reflexo
      g.fillStyle = '#f7f6f1'; g.fillRect(x + 102, 18, 4, 92); g.fillRect(x, 62, 208, 4);                                                    // travessas
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(x, 18, 208, 92); }
    g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(0, 0, 1024, 3); g.fillRect(0, 125, 1024, 3);                                              // junta entre painéis
    k.t.needsUpdate = true; return k.t; };
  const tx0 = panelTex(false), tx1 = panelTex(true), panels = [];
  const GPT = 0.06, GPH = 0.595, GPW = DW - 0.04, GRO = 0.19;                                                                                  // espessura, altura, largura do painel; recuo do rolamento até o trilho
  const gdark = lm(0x23262b), gstl = lm(0xaeb4ba), gblk = lm(0x101114);
  for (let k = 0; k < 4; k++) { const m = new T.Mesh(new T.BoxGeometry(GPW, GPH, GPT), own(0xf4f1ea, { map: k === 3 ? tx1 : tx0 })); grp.add(m); panels.push(m);
    const add = (geo, mat, x, y, z, rx, rz) => { const c = new T.Mesh(geo, mat); c.position.set(x, y, z); if (rx) c.rotation.x = rx; if (rz) c.rotation.z = rz; m.add(c); return c; };
    if (k > 0) [-1.9, -0.95, 0, 0.95, 1.9].forEach(x => add(new T.BoxGeometry(0.12, 0.06, 0.012), gstl, x, -GPH / 2 + 0.01, GPT / 2 + 0.006));                // dobradiças entre painéis
    [-1, 1].forEach(sd => { add(new T.BoxGeometry(0.075, 0.03, GRO), gstl, sd * (GPW / 2 + 0.03), -GPH / 2 + 0.05, GPT / 2 + GRO / 2 - 0.02);                                // braço do rolamento
      add(new T.CylinderGeometry(0.024, 0.024, 0.03, 12), gblk, sd * (GPW / 2 + 0.07), -GPH / 2 + 0.05, GPT / 2 + GRO - 0.02, 0, Math.PI / 2); });                          // roda
    if (k === 0) add(new T.BoxGeometry(GPW, 0.035, GPT + 0.02), gblk, 0, -GPH / 2 + 0.01, 0);                                                                                 // borracha de vedação do chão
    if (k === 1) { add(new T.BoxGeometry(0.30, 0.10, 0.012), gdark, 0, 0.12, -GPT / 2 - 0.006); add(new T.BoxGeometry(0.22, 0.03, 0.03), gstl, 0, 0.12, -GPT / 2 - 0.022); add(new T.CylinderGeometry(0.018, 0.018, 0.02, 12), gblk, 0.09, 0.12, -GPT / 2 - 0.016, Math.PI / 2); }   // maçaneta + fechadura
  }
  const gd = gar.door, gdBody = P.staticBox(DX, GF + DH / 2, GZ0 + 0.02, DW / 2, DH / 2, 0.04);
  let s3 = 0;
  const place = () => panels.forEach((m, k) => { const e = clamp(gd.v * 1.6 - 0.6 * (3 - k) / 3, 0, 1), s = e * e * (3 - 2 * e);      // o painel de cima sai na frente
    m.position.set(DX, lerp(GF + 0.3 + 0.6 * k, CT - 0.2, s), lerp(GZ0 + 0.02, GZ0 + 0.55 + k * 0.63, s)); m.rotation.x = s * Math.PI / 2; if (k === 3) s3 = s; });
  // trilhos (vertical, curva e horizontal), mola de torção, tambores e cabos
  { const YT = GF + DH + 0.02, YH = CT - 0.2 - GRO + 0.0, ZR = GZ0 + 0.02 + GRO, ZE = 0.7, dyc = YH - YT, dzc = 0.34;
    [-1, 1].forEach(sd => { const x = DX + sd * (DW / 2 + 0.05);
      B.box(0.05, YT - GF - 0.05, 0.06, x, (GF + 0.05 + YT) / 2, ZR, gstl);                                                                 // vertical
      B.box(0.05, Math.hypot(dyc, dzc), 0.06, x, (YT + YH) / 2, ZR + dzc / 2, gstl, 0, Math.atan2(dzc, dyc));                                // curva
      B.box(0.05, 0.06, ZE - (ZR + dzc), x, YH, (ZR + dzc + ZE) / 2, gstl);                                                                 // horizontal
      B.box(0.05, 0.04, 0.5, x, YT - 0.45, ZR - 0.03, gstl); B.box(0.02, 0.12, 0.012, x, GF + 0.6, ZR + 0.035, gdark); B.box(0.02, 0.12, 0.012, x, GF + 1.6, ZR + 0.035, gdark);    // suportes
      B.box(0.05, 0.06, 0.3, x, CT - 0.12, ZE - 0.1, gdark);                                                                                // suporte no forro
      B.cyl(0.09, 0.09, 0.07, x - sd * 0.13, GF + DH + 0.2, ZR - 0.03, gstl, 16, 0, Math.PI / 2); B.cyl(0.004, 0.004, DH + 0.1, x - sd * 0.13, GF + (DH + 0.1) / 2 + 0.05, ZR - 0.03, gblk, 5); });    // tambor de cabo + cabo
    B.cyl(0.018, 0.018, DW - 0.2, DX, GF + DH + 0.2, ZR - 0.03, gstl, 10, 0, Math.PI / 2);                                                   // eixo
    const sp = (() => { const k = mc(256, 16, [6, 1]), g = k.g; g.fillStyle = '#8c4a2a'; g.fillRect(0, 0, 256, 16); for (let i = 0; i < 16; i++) { g.fillStyle = '#d98a55'; g.fillRect(i * 16, 0, 9, 16); } k.t.needsUpdate = true; return k.t; })();
    [-1, 1].forEach(sd => { const m = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 1.5, 16), new T.MeshLambertMaterial({ map: sp })); m.rotation.z = Math.PI / 2; m.position.set(DX + sd * 0.95, GF + DH + 0.2, ZR - 0.03); grp.add(m); });     // molas de torção
    B.box(0.2, 0.16, 0.08, DX, GF + DH + 0.2, ZR - 0.06, gdark);                                                                            // mancal central
    B.box(DW, 0.05, 0.05, DX, GF + DH - 0.025, GZ0 + 0.08, gblk);                                                                           // vedação de cima
  }
  H.inter(panels, () => { gd.t = gd.t ? 0 : 1; sfx(gd.t ? 230 : 190, 0.35); setTimeout(() => sfx(gd.t ? 170 : 150, 0.3), 260); }, GZ);
  // abridor: trilho, motor com luz, carrinho que anda e braço ligado ao painel de cima
  B.box(0.08, 0.06, 2.6, DX, CT - 0.34, -0.7, dark); B.box(0.34, 0.24, 0.5, DX, CT - 0.3, 0.8, dark); B.box(0.2, 0.04, 0.3, DX, CT - 0.44, 0.8, lm(0xf2f6ff));
  const trol = new T.Mesh(new T.BoxGeometry(0.1, 0.06, 0.14), gdark); grp.add(trol);
  const arm = new T.Mesh(new T.BoxGeometry(0.025, 1, 0.025), gstl); grp.add(arm);
  { const prev = gar._pl; const upd = () => { const s = s3, p3 = panels[3], hy = p3.position.y + 0.3 * Math.cos(s * Math.PI / 2), hz = p3.position.z + 0.3 * Math.sin(s * Math.PI / 2), ty = CT - 0.42, tz = lerp(-1.9, 0.15, s);
      trol.position.set(DX, ty, tz); const dy = hy - ty, dz = hz - tz, len = Math.hypot(dy, dz); arm.position.set(DX, (hy + ty) / 2, (hz + tz) / 2); arm.scale.y = len; arm.rotation.x = Math.atan2(dz, dy); };
    gar._pl = () => { place(); upd(); setBody(gdBody, gd.v < 0.25); }; place(); upd(); }
  // botoeira interna (parede ao lado da porta) e teclado externo: abrem/fecham a porta
  const toggleGD = () => { gd.t = gd.t ? 0 : 1; sfx(gd.t ? 230 : 190, 0.35); setTimeout(() => sfx(gd.t ? 170 : 150, 0.3), 260); };
  { B.box(0.12, 0.2, 0.025, 16.0, F + 1.25, -2.185, lm(0xe9e6de));
    const bt = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.02, 16), own(0x888888, { emissive: 0xc02a2a })); bt.rotation.x = Math.PI / 2; bt.position.set(16.0, F + 1.28, -2.165); grp.add(bt);
    B.box(0.04, 0.025, 0.012, 16.0, F + 1.18, -2.17, gdark);
    gar._led = bt; H.inter([bt], toggleGD, ['garagem', 'pgs', 'pgi', 'pgd']);
    const kp = mc(128, 192), g = kp.g; g.fillStyle = '#1b1d21'; g.fillRect(0, 0, 128, 192); g.fillStyle = '#7be08a'; g.fillRect(14, 12, 100, 26);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.fillStyle = '#d6dadd'; g.fillRect(14 + c * 35, 52 + r * 32, 30, 26); g.fillStyle = '#111'; g.font = '700 16px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r === 3 ? ['*', '0', '#'][c] : String(r * 3 + c + 1), 29 + c * 35, 66 + r * 32); } kp.t.needsUpdate = true;
    B.box(0.16, 0.24, 0.03, 16.12, GF + 1.25, -2.51, gdark);
    const kb = new T.Mesh(new T.PlaneGeometry(0.13, 0.195), new T.MeshBasicMaterial({ map: kp.t })); kb.position.set(16.12, GF + 1.25, -2.527); kb.rotation.y = Math.PI; grp.add(kb);
    H.inter([kb], toggleGD, ['lawn', 'quintal', 'pgd']); }

  // ---------- luzes do forro + interruptor ----------
  const tubeM = [own(0xf2f6ff), own(0xf2f6ff)];
  [11.9, 14.6].forEach((x, i) => { const m = new T.Mesh(new T.BoxGeometry(1.2, 0.05, 0.2), tubeM[i]); m.position.set(x, CT - 0.03, 0.6); grp.add(m); });
  H.light({ p: [GCX, CT - 0.5, 0.5], auto: () => gar.light, zones: ['garagem', 'pgs', 'pgi', 'pgd'], k: 0.95, dist: 9, decay: 1.1, col: 0xf4f8ff, emis: tubeM.map(m => ({ m, c: 0xe8f2ff })) });
  const swM = new T.Mesh(new T.BoxGeometry(0.09, 0.13, 0.016), own(0xf2f2f2)); swM.position.set(GX0 + 0.058, F + 1.25, 0.75); swM.rotation.y = Math.PI / 2; grp.add(swM);
  H.inter([swM], () => { gar.light = !gar.light; sfx(gar.light ? 820 : 560, 0.06); }, ['garagem', 'pgs', 'pgi']);

  // ---------- bancada com ferramentas e painel perfurado ----------
  B.box(2.7, 0.05, 0.62, 11.65, GF + 0.9, 3.01, woodM); [[10.35, 2.75], [12.95, 2.75], [10.35, 3.27], [12.95, 3.27]].forEach(([x, z]) => B.box(0.06, 0.9, 0.06, x, GF + 0.45, z, woodD));
  B.box(2.6, 0.03, 0.55, 11.65, GF + 0.25, 3.01, lm(0x6b4a2a)); B.box(0.16, 0.12, 0.2, 10.6, GF + 0.98, 2.92, dark); B.box(0.5, 0.22, 0.3, 12.2, GF + 0.37, 3.0, lm(0xc0392b));
  B.box(0.3, 0.03, 0.05, 11.2, GF + 0.945, 2.95, steel); B.box(0.05, 0.03, 0.12, 11.06, GF + 0.945, 2.95, steel); B.box(0.34, 0.02, 0.06, 11.9, GF + 0.935, 2.85, lm(0xf1c40f));
  [[10.7, 0.34], [11.1, 0.37], [11.5, 0.34]].forEach(([x, h]) => B.cyl(0.08, 0.08, h * 0.5, x, GF + 0.285 + h * 0.25, 3.0, lm(0x2980b9), 12));
  B.box(2.5, 0.9, 0.03, 11.65, GF + 1.75, 3.33, lm(0xb59a72));
  [[10.6, 0.3, 0.04, steel], [10.95, 0.26, 0.03, lm(0xc0392b)], [11.3, 0.34, 0.03, steel], [11.7, 0.3, 0.05, lm(0xf1c40f)], [12.1, 0.28, 0.03, steel], [12.45, 0.32, 0.04, dark]]
    .forEach(([x, h, w, m]) => B.box(w, h, 0.03, x, GF + 1.8, 3.3, m)); B.box(0.5, 0.1, 0.03, 11.4, GF + 1.5, 3.3, steel);

  // ---------- estante de metal com caixas (parede oeste) ----------
  [[10.14, -2.2], [10.46, -2.2], [10.14, 0.4], [10.46, 0.4]].forEach(([x, z]) => B.box(0.04, 1.9, 0.04, x, GF + 0.95, z, steel));
  const sr = H.rnd(5), bins = [lm(0x2e6da4), lm(0x8e44ad), lm(0x2e8b57), lm(0xc0392b)];
  for (let i = 0; i < 4; i++) { const y = GF + 0.25 + i * 0.5; B.box(0.42, 0.03, 2.62, 10.3, y, -0.9, lm(0x8d949b));
    for (let j = 0; j < 5; j++) { const z = -2.05 + j * 0.5 + sr() * 0.08, h = 0.2 + sr() * 0.18; B.box(0.3, h, 0.38, 10.3, y + 0.015 + h / 2, z, (i + j) % 3 === 0 ? bins[(i + j) % 4] : cardb); } }

  // ---------- aquecedor de água e lixeiras (lado de fora) ----------
  B.cyl(0.27, 0.27, 1.4, 16.1, GF + 0.7, 3.0, lm(0xe8ebee), 18); B.cyl(0.27, 0.22, 0.08, 16.1, GF + 1.44, 3.0, lm(0xe8ebee), 18); B.cyl(0.02, 0.02, 0.5, 16.0, GF + 1.7, 3.0, copper, 8); B.cyl(0.02, 0.02, 0.5, 16.2, GF + 1.7, 3.0, lm(0x3498db), 8);
  B.box(0.1, 0.1, 0.06, 16.1, GF + 0.5, 2.72, lm(0xc0392b));
  [[17.4, 0.8, 0x2e8b57], [17.4, 1.5, 0x4b5156]].forEach(([x, z, c]) => { B.cyl(0.27, 0.23, 0.95, x, YG + 0.475, z, lm(c), 14); B.cyl(0.29, 0.29, 0.06, x, YG + 0.98, z, lm(c), 14); });

  // ====================================================== CERCA ======================================================
  const PICK = lm(0xf8f6f0), POST = lm(0xf2efe8), CAP = lm(0xe9e5db);
  const wood = (() => { const k = mc(256, 256, [1, 1]), g = k.g, r = H.rnd(33); g.fillStyle = '#7e5a38'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6; i++) { const x = i * 42.67, t = 150 + r() * 40; g.fillStyle = 'rgb(' + t + ',' + (t * 0.72 | 0) + ',' + (t * 0.46 | 0) + ')'; g.fillRect(x, 0, 41, 256);
      for (let j = 0; j < 26; j++) { g.strokeStyle = 'rgba(70,45,25,' + (0.1 + r() * 0.15).toFixed(2) + ')'; g.lineWidth = 1; g.beginPath(); const gx = x + 4 + r() * 33; g.moveTo(gx, 0); g.lineTo(gx + (r() - 0.5) * 4, 256); g.stroke(); }
      g.fillStyle = 'rgba(35,22,12,.7)'; g.fillRect(x + 41, 0, 2, 256); }
    k.t.needsUpdate = true; return k.t; })();
  const WOODM = new T.MeshLambertMaterial({ map: wood }), WRAIL = lm(0x6e4e30), WCAP = lm(0x5a3f27);
  WOODM.userData.wuv = true;
  const tip = new T.ConeGeometry(0.06, 0.1, 4); tip.rotateY(Math.PI / 4); tip.scale(1, 1, 0.3);
  const picketRun = (ax, c, a0, a1, h, side) => {                                                                          // side: lado de dentro (+1/-1) onde ficam as travessas
    const len = a1 - a0, n = Math.max(1, Math.round(len / 0.135)), st = len / n, ry = ax === 'x' ? 0 : Math.PI / 2;
    for (let i = 0; i < n; i++) { const a = a0 + (i + 0.5) * st, x = ax === 'x' ? a : c, z = ax === 'x' ? c : a;
      B.box(0.085, h, 0.025, x, YG + h / 2, z, PICK, ry); B.add(B.xf(tip.clone(), x, YG + h + 0.05, z, ry), PICK); }
    const m = (a0 + a1) / 2, o = c + side * 0.03;
    [0.28, h - 0.22].forEach(y => ax === 'x' ? B.box(len, 0.07, 0.04, m, YG + y, o, PICK) : B.box(0.04, 0.07, len, o, YG + y, m, PICK));
  };
  const post = (x, z, h, big) => { const w = big ? 0.16 : 0.12; B.box(w, h, w, x, YG + h / 2, z, POST); B.box(w + 0.05, 0.035, w + 0.05, x, YG + h + 0.0175, z, CAP);
    if (big) B.sph(0.07, x, YG + h + 0.09, z, CAP, 1, 1, 1); else B.box(0.06, 0.06, 0.06, x, YG + h + 0.065, z, CAP); };
  const privRun = (ax, c, a0, a1, h, side) => {
    const len = a1 - a0, m = (a0 + a1) / 2, o = c + side * 0.07;
    if (ax === 'x') { H.wbox(B, len, h, 0.05, m, YG + h / 2, c, WOODM); B.box(len, 0.1, 0.12, m, YG + h + 0.05, c, WCAP); [0.3, h - 0.3].forEach(y => B.box(len, 0.08, 0.05, m, YG + y, o, WRAIL)); }
    else { H.wbox(B, 0.05, h, len, c, YG + h / 2, m, WOODM); B.box(0.12, 0.1, len, c, YG + h + 0.05, m, WCAP); [0.3, h - 0.3].forEach(y => B.box(0.05, 0.08, len, o, YG + y, m, WRAIL)); }
    const n = Math.max(1, Math.ceil(len / 2.4)); for (let i = 0; i <= n; i++) { const a = a0 + len * i / n; B.box(0.13, h + 0.12, 0.13, ax === 'x' ? a : c, YG + (h + 0.12) / 2, ax === 'x' ? c : a, WRAIL); }
  };
  const col = (cx, cy, cz, hx, hy, hz) => P.staticBox(cx, cy, cz, hx, hy, hz);
  const PH = 1.05, WH = 1.8, ZT = -2.35;                                                                                    // altura da cerquinha, altura da cerca de madeira, onde a cerquinha vira madeira
  // frente (cerquinha branca) com vãos para os portões
  picketRun('x', FZ0, FX0 + 0.1, 4.05, PH, 1); picketRun('x', FZ0, 5.35, 10.85, PH, 1); picketRun('x', FZ0, 16.15, FX1 - 0.1, PH, 1);
  const postsRun = (ax, c, a0, a1) => { const n = Math.max(1, Math.ceil((a1 - a0) / 2.4)); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, big = i === 0 || i === n; post(ax === 'x' ? a : c, ax === 'x' ? c : a, big ? 1.25 : 1.15, big); } };
  postsRun('x', FZ0, FX0, 4.1); postsRun('x', FZ0, 5.3, 10.9); postsRun('x', FZ0, 16.1, FX1);
  col((FX0 + 4.05) / 2, YG + 0.6, FZ0, (4.05 - FX0) / 2, 0.6, 0.03); col(8.1, YG + 0.6, FZ0, 2.75, 0.6, 0.03); col((16.15 + FX1) / 2, YG + 0.6, FZ0, (FX1 - 16.15) / 2, 0.6, 0.03);
  // laterais: cerquinha até a frente da casa, depois madeira até o fundo; fundos em madeira
  [[FX0, 1], [FX1, -1]].forEach(([x, s]) => { picketRun('z', x, FZ0 + 0.1, ZT - 0.1, PH, s); postsRun('z', x, FZ0, ZT); privRun('z', x, ZT, FZ1, WH, s); post(x, ZT, 1.9, true);
    col(x, YG + 0.6, (FZ0 + ZT) / 2, 0.03, 0.6, (ZT - FZ0) / 2); col(x, YG + 0.9, (ZT + FZ1) / 2, 0.04, 0.9, (FZ1 - ZT) / 2); });
  privRun('x', FZ1, FX0, FX1, WH, -1); col((FX0 + FX1) / 2, YG + 0.9, FZ1, (FX1 - FX0) / 2, 0.9, 0.04);

  // ---------- portões ----------
  const GZ_OUT = OUT.concat(['pgd']);
  const gateTex = w => { const W = Math.round(w * 160), Hh = 170, k = mc(W, Hh), g = k.g, n = Math.max(3, Math.round(w / 0.135)), st = W / n, pw = st * 0.62;
    g.fillStyle = '#f8f6f0'; for (let i = 0; i < n; i++) { const x = i * st + (st - pw) / 2; g.beginPath(); g.moveTo(x, Hh); g.lineTo(x, 22); g.lineTo(x + pw / 2, 4); g.lineTo(x + pw, 22); g.lineTo(x + pw, Hh); g.closePath(); g.fill(); }
    g.fillStyle = '#e4e0d6'; [Hh * 0.3, Hh * 0.74].forEach(y => g.fillRect(0, y, W, 14)); k.t.needsUpdate = true; return k.t; };
  const gate = (key, a, w, hinge, ang, nx0, nx1) => {
    const d = D[key] = H.mkDoor(grp, { ax: 'x', c: FZ0, a, w, h: PH - 0.05, y0: YG + 0.05, hinge, ang, col: 0xf8f6f0, zones: GZ_OUT, knob: false });
    d.leaf.material = own(0xf8f6f0, { map: gateTex(w), alphaTest: 0.5, side: T.DoubleSide });
    H.NEAR.push({ d: key, lvl: 'down', x0: nx0, x1: nx1, z0: FZ0 - 1.9, z1: FZ0 + 1.5 }); return d; };
  gate('gate', 4.7, 1.0, -1, -1.75, 3.2, 6.2);                                                                              // portão de pedestre (abre para dentro)
  gate('gateL', 12.24, 2.52, -1, -1.75, 10.0, 13.5); gate('gateR', 14.76, 2.52, 1, 1.75, 13.5, 17.0);                      // portão duplo da entrada de carros

  // ---------- quintal: árvores, arbustos junto à cerca ----------
  const tree = (x, z, s) => { B.cyl(0.14 * s, 0.2 * s, 2.6 * s, x, YG + 1.3 * s, z, lm(0x5b4129), 8);
    [[0, 3.4, 0, 1.5], [0.9, 3.0, 0.4, 1.1], [-0.8, 3.1, -0.5, 1.2], [0.2, 4.3, -0.2, 1.0], [-0.3, 3.0, 0.9, 1.0]].forEach(([a, b, c, r], i) => B.sph(r * s, x + a * s, YG + b * s, z + c * s, [lm(0x4f8f3a), lm(0x3e7a2f), lm(0x5e9d43)][i % 3], 1, 0.85, 1)); };
  tree(4.0, 10.5, 1.2); tree(13.5, 9.5, 1.3); tree(-5.2, 7.5, 1.1);
  for (let x = -7; x <= 18; x += 2.7) B.sph(0.45, x, YG + 0.36, FZ1 - 0.5, (Math.floor(x) % 2) ? lm(0x2f6b2e) : lm(0x3d7d36), 1, 0.85, 1);
  for (let z = 0; z <= 12; z += 2.9) B.sph(0.42, FX0 + 0.5, YG + 0.34, z, lm(0x2f6b2e), 1, 0.85, 1);
  [[-6.8, -5.4], [-6.8, -3.4], [17.6, -7.6], [17.6, -3.5]].forEach(([x, z], i) => B.sph(0.4, x, YG + 0.32, z, i % 2 ? lm(0x3d7d36) : lm(0x2f6b2e), 1, 0.85, 1));   // arbustos do jardim da frente, junto à cerca

  // ---------- horta no fundo da casa: 3 canteiros elevados (alface, repolho, tomate), composteira, regador e placa ----------
  { const SOIL = lm(0x3b2a1e), FRAME = lm(0x8a6a44), LET1 = lm(0x6fb04a), LET2 = lm(0x8cc860), CAB = lm(0x5f9e6b), TOM = lm(0x3f7d34), RED = lm(0xd23a2e), STAKE = lm(0xb89a6a), HZ0 = 8.4, HZ1 = 11.8, HL = HZ1 - HZ0, HC = (HZ0 + HZ1) / 2, BW = 1.3, BH = 0.4, hr = H.rnd(77);
    [6.9, 9.1, 11.3].forEach((x, bi) => {
      B.box(BW, BH - 0.05, HL, x, YG + (BH - 0.05) / 2, HC, SOIL);                                                          // terra
      B.box(BW + 0.12, 0.06, 0.1, x, YG + BH - 0.03, HZ0 - 0.05, FRAME); B.box(BW + 0.12, 0.06, 0.1, x, YG + BH - 0.03, HZ1 + 0.05, FRAME);   // bordas de madeira
      B.box(0.1, 0.06, HL + 0.2, x - BW / 2 - 0.05, YG + BH - 0.03, HC, FRAME); B.box(0.1, 0.06, HL + 0.2, x + BW / 2 + 0.05, YG + BH - 0.03, HC, FRAME);
      B.box(BW + 0.12, BH - 0.06, 0.06, x, YG + (BH - 0.06) / 2, HZ0 - 0.05, FRAME); B.box(BW + 0.12, BH - 0.06, 0.06, x, YG + (BH - 0.06) / 2, HZ1 + 0.05, FRAME);
      B.box(0.06, BH - 0.06, HL + 0.2, x - BW / 2 - 0.05, YG + (BH - 0.06) / 2, HC, FRAME); B.box(0.06, BH - 0.06, HL + 0.2, x + BW / 2 + 0.05, YG + (BH - 0.06) / 2, HC, FRAME);
      for (let r = 0; r < 2; r++) for (let j = 0; j < 7; j++) { const px = x + (r ? 0.3 : -0.3) + (hr() - 0.5) * 0.06, pz = HZ0 + 0.3 + j * (HL - 0.6) / 6, py = YG + BH - 0.05;
        if (bi === 0) B.sph(0.14 + hr() * 0.04, px, py + 0.08, pz, (r + j) % 2 ? LET1 : LET2, 1, 0.55, 1);                  // alface
        else if (bi === 1) { B.sph(0.2, px, py + 0.14, pz, CAB, 1, 0.85, 1); B.sph(0.12, px, py + 0.2, pz, LET2, 1, 0.8, 1); }  // repolho
        else if (j % 2 === 0) { B.cyl(0.015, 0.015, 1.3, px, py + 0.65, pz, STAKE, 5); B.sph(0.2, px, py + 0.55, pz, TOM, 1, 1.5, 1);   // tomateiro com estaca
          [[0.12, 0.45, 0.08], [-0.1, 0.7, -0.1], [0.08, 0.9, 0.1], [-0.12, 0.6, 0.12]].forEach(([dx, dy, dz]) => B.sph(0.05, px + dx, py + dy, pz + dz, RED, 1, 1, 1)); }
        else B.sph(0.1, px, py + 0.07, pz, LET1, 1, 0.6, 1); } });
    // placa de madeira e regador
    B.box(0.05, 0.7, 0.05, 5.55, YG + 0.35, 8.2, STAKE); B.box(0.5, 0.22, 0.04, 5.55, YG + 0.72, 8.2, FRAME);
    B.cyl(0.1, 0.1, 0.2, 12.2, YG + 0.1, 8.6, lm(0x2e7d9a), 12); B.box(0.3, 0.03, 0.03, 12.38, YG + 0.2, 8.6, lm(0x2e7d9a), 0, 0, 0.5);
    // composteira de madeira (4 lados + terra escura)
    B.box(0.8, 0.7, 0.8, 13.0, YG + 0.35, 12.65, lm(0x5a3f27)); B.box(0.68, 0.04, 0.68, 13.0, YG + 0.72, 12.65, lm(0x2b1f16)); B.box(0.86, 0.04, 0.86, 13.0, YG + 0.72, 12.65, lm(0x6e4e30));
    // caminho de cascalho entre os canteiros
    [[8.0, 0.9], [10.2, 0.9]].forEach(([x, w]) => { const m = new T.Mesh(new T.PlaneGeometry(w, HL + 0.4), lm(0xb9b2a4)); m.rotation.x = -Math.PI / 2; m.position.set(x, YG + 0.012, HC); grp.add(m); }); }

  B.flush(grp);
};

// ====================================================== ATUALIZAÇÃO ======================================================
VR.hook(53, dt => {
  if (!gar.built) return;
  const d = gar.door; d.v += (d.t - d.v) * VR.damp(2.2, dt); if (Math.abs(d.t - d.v) < 0.003) d.v = d.t;
  if (gar._pl) gar._pl();
  if (gar._led) gar._led.material.emissive.setHex(d.t ? 0x14c85a : 0xc02a2a);
  ['gate', 'gateL', 'gateR', 'gin'].forEach(k => { const g = D[k]; if (g && g.body) setBody(g.body, g.v < 0.12); });
});
})();
