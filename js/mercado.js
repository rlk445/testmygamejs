/* Mercado de bairro (porte médio) no fim da rua: estacionamento, fachada de tijolo e vidro, portas de correr automáticas,
   e por dentro: um caixa, hortifrúti, padaria (só a prateleira), laticínios e congelados com portas/tampas que abrem, e gôndolas, com produtos que dá para pegar, levar ao caixa, pagar e levar para casa (atendente no caixa, botão de confirmar, sacola).
   Depende de house.js (exports H.*) e de outdoor.js (out.car). É construído no fim de house.build() (VR.market.build). */
(() => {
'use strict';
const VR = window.VR, T = VR.T, H = VR.house, P = VR.phys, PL = VR.PL, clamp = VR.clamp;
const YG = H.YG, YS = YG - 0.14, YF = YG + 0.12, CEIL = YG + 4.12, PAR = YG + 5.1;
const MX0 = 80, MX1 = 104, MZ0 = -28, MZ1 = -9, MC = -18.5;                      // eixos das paredes: frente (oeste), fundos (leste), norte, sul; centro da rua
const mk = VR.market = { built: false, group: null, door: { v: 0, t: 0 } };
const sfx = (f, d) => { try { VR.ui.sfx(f, d); } catch (e) {} };
const lm = H.lm, own = H.own, zn = H.zn, ob = H.ob;

// ====================================================== ONDE SE ANDA ======================================================
const doorOpen = () => mk.door.v > 0.5;
zn('mktd', 'down', 79.6, 81.2, MC - 1.5, MC + 1.5, doorOpen);                   // soleira da porta de correr (só aberta)
zn('mkt', 'down', 80.4, 103.6, -27.6, -9.4);                                    // dentro do mercado
// estacionamento em volta do prédio (o prédio em si fica de fora das zonas)
[[59, 79.8, -36.5, -2.5], [79.8, 112, -36.5, -28.3], [79.8, 112, -8.7, -2.5], [104.3, 112, -28.3, -8.7]].forEach(r => zn('mktlot', 'down', r[0], r[1], r[2], r[3]));
H.ZY.mkt = YF; H.ZY.mktd = YF - 0.02; H.ZY.mktlot = YG + 0.05;
H.AMB.mkt = 0.95; H.AMB.mktd = 0.95; H.AMB.mktlot = 1;
H.PASS.mktd = ['mkt', 'mktlot']; H.PASS.mktlot = ['mktd'];

// ---- obstáculos (lado de fora)
ob('down', 61.1, 61.9, -11.9, -11.1);                                            // totem do mercado
[[82, -31.5], [96, -31.5], [82, -5.5], [96, -5.5]].forEach(([x, z]) => ob('down', x - 0.25, x + 0.25, z - 0.25, z + 0.25));      // postes
[[79, -30.8], [79, -6.3], [106, -30.5], [106, -6.5]].forEach(([x, z]) => ob('down', x - 0.3, x + 0.3, z - 0.3, z + 0.3));       // árvores
ob('down', 78.4, 79.5, -26.6, -24.0);                                            // carrinhos (cercadinho)
ob('down', 79.1, 79.7, -23.5, -22.2);                                            // banco
ob('down', 79.0, 79.7, -13.4, -12.6); ob('down', 79.0, 79.7, -12.3, -11.0);       // máquina de gelo e jornais
ob('down', 104.3, 107, -25.2, -19.8); ob('down', 107.1, 109.9, -24.4, -22.6);     // plataforma de carga e caçamba
// ---- obstáculos (dentro)
ob('down', 81.7, 86.1, -24.75, -23.85); ob('down', 86.3, 87.05, -24.7, -23.9);   // caixa único + banco do operador
ob('down', 81.0, 84.0, -13.2, -12.0);                                            // balcão de atendimento
ob('down', 80.7, 82.1, -16.4, -14.7);                                            // carrinhos
ob('down', 83.8, 84.6, -9.9, -9.3);                                              // caixa eletrônico
ob('down', 86.2, 96.8, -10.1, -9.25);                                            // parede de hortifrúti
[89.0, 93.4].forEach(x => ob('down', x - 1.4, x + 1.4, -13.2, -12.0));          // mesas de frutas
[90.5, 94.5].forEach(x => ob('down', x - 1.5, x + 1.5, -15.95, -14.85));        // freezers
[-24.8, -22.4, -20.0].forEach(z => ob('down', 88, 99.5, z - 0.45, z + 0.45));     // gôndolas
ob('down', 88, 100, -27.9, -27.0);                                               // prateleira da parede norte
ob('down', 102.8, 103.9, -27.4, -20.2);                                          // geladeiras de laticínios
ob('down', 97.8, 103.6, -10.1, -9.3);                                            // prateleira da padaria

// ====================================================== CONSTRUÇÃO ======================================================
mk.build = parent => {
  if (mk.built) return; mk.built = true;
  const grp = mk.group = new T.Group(); parent.add(grp);
  const B = H.Batch(), rnd = H.rnd(2024), mc = (w, h, rep) => H.cvs(w, h, rep);
  const GL = new T.MeshLambertMaterial({ color: 0xaed9ee, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide });
  const STUC = lm(0xece4d2), STUC2 = lm(0xd9cfba), BRICK = H.BRICK, DK = lm(0x30343a), DK2 = lm(0x505660), WHT = H.WHT, RED = lm(0xc4262e), CONC = lm(0xbdbab2), STEEL = lm(0xc7ccd1), WOOD = lm(0x8a5a33), WOODL = lm(0xc49a6c);
  const LIGHT = new T.MeshBasicMaterial({ color: 0xf7faff }), PANE = [0xdfe3e6, 0xaed9ee];
  const flat = (w, d, x, y, z, mat, up) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = up === false ? Math.PI / 2 : -Math.PI / 2; m.position.set(x, y, z); grp.add(m); return m; };
  const glass = (ax, c, a, w, y0, y1) => { const m = new T.Mesh(new T.PlaneGeometry(w, y1 - y0), GL); m.position.set(ax === 'x' ? a : c, (y0 + y1) / 2, ax === 'x' ? c : a); if (ax === 'z') m.rotation.y = Math.PI / 2; grp.add(m); return m; };
  // placa com texto (canvas). ry: 0 => olha para +z, PI => -z, -PI/2 => -x, PI/2 => +x
  const lab = (txt, sub, w, h, bg, fg, x, y, z, ry, fs) => { const cw = 512, ch = Math.max(48, Math.round(512 * h / w)), k = mc(cw, ch), g = k.g;
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 4; g.strokeRect(6, 6, cw - 12, ch - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 ' + (fs || Math.round(ch * (sub ? 0.5 : 0.62))) + 'px Arial, sans-serif'; g.fillText(txt, cw / 2, sub ? ch * 0.38 : ch / 2);
    if (sub) { g.font = '600 ' + Math.round(ch * 0.22) + 'px Arial, sans-serif'; g.fillText(sub, cw / 2, ch * 0.78); }
    k.t.needsUpdate = true; const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: k.t, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; grp.add(m); return m; };
  const rod = (x, y, z, len) => B.cyl(0.012, 0.012, len, x, y, z, DK, 5);

  // ---------- estacionamento ----------
  const asph = (() => { const k = mc(256, 256, [18, 12]), g = k.g, r = H.rnd(5); g.fillStyle = '#44474c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,20,22,.45)' : 'rgba(130,132,138,.3)'; g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); } k.t.needsUpdate = true; return k.t; })();
  flat(55, 35, 86, YG + 0.05, -19.0, new T.MeshLambertMaterial({ map: asph }));
  const LN = lm(0xeeeeea), LY = lm(0xe6b800);
  for (let i = 0; i <= 11; i++) { const z = -35.0 + i * 2.8; if (z > -22.2 && z < -14.8) continue; B.box(5.2, 0.004, 0.1, 75.0, YG + 0.055, z, LN); }          // vagas encostadas no prédio
  for (let i = 0; i <= 11; i++) { const z = -35.0 + i * 2.8; if (z > -24.5 && z < -12.5) continue; B.box(5.2, 0.004, 0.1, 65.0, YG + 0.055, z, LN); }          // vagas do lado da rua
  for (let i = 0; i < 8; i++) B.box(4.6, 0.004, 0.4, 70.1, YG + 0.055, -21.6 + i * 0.88, LN);                                                                   // faixa de pedestres
  B.box(0.2, 0.004, 5.4, 78.2, YG + 0.055, -31.0, LY); B.box(0.2, 0.004, 5.4, 78.2, YG + 0.055, -6.0, LY);                                                       // meio-fio pintado
  { const k = mc(128, 128), g = k.g; g.fillStyle = '#1c5fb4'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 30, 12, 0, 7); g.fill(); g.fillRect(56, 44, 16, 40); g.fillRect(40, 60, 48, 10); g.fillRect(44, 84, 12, 30); g.fillRect(72, 84, 12, 30); k.t.needsUpdate = true;
    const m = new T.Mesh(new T.PlaneGeometry(1.3, 1.3), new T.MeshBasicMaterial({ map: k.t })); m.rotation.x = -Math.PI / 2; m.position.set(75.0, YG + 0.058, -23.6); grp.add(m); }                    // vaga PCD

  // ---------- fachada: paredes, vitrines, pilastras, calçada, toldo ----------
  B.box(2.4, 0.1, 19.6, 78.8, YG + 0.05, MC, CONC);                                                                     // calçada em frente à loja
  const brick = (w, h, d, x, y, z) => H.wbox(B, w, h, d, x, y, z, BRICK);
  [[-28.0, -20.1], [-16.9, -9.0]].forEach(([a, b]) => brick(0.3, 0.9, b - a, MX0, YG + 0.45, (a + b) / 2));            // base de tijolo sob as vitrines
  B.box(0.3, 1.8, 19.3, MX0, YG + 4.2, MC, STUC);                                                                        // faixa do letreiro (inclui o vão da porta)
  B.box(0.12, 0.1, 19.4, 79.85, YG + 3.3, MC, DK);
  [-28.0, -26.0, -24.0, -22.0, -20.1, -16.9, -15.0, -13.0, -11.0, -9.0].forEach(z => B.box(0.1, 2.4, 0.1, MX0, YG + 2.1, z, DK));    // montantes das vitrines
  [[-28.0, -20.1], [-16.9, -9.0]].forEach(([a, b]) => glass('z', MX0, (a + b) / 2, b - a, YG + 0.9, YG + 3.3));
  [-28.1, -20.3, -16.7, -8.9].forEach(z => brick(0.6, 5.1, 0.6, 79.85, YG + 2.55, z));                                     // pilastras
  [[MX0 + 12, MZ0 - 0.0, 'x'], [MX0 + 12, MZ1, 'x']].forEach(([cx, c]) => { const L = 24.3; brick(L, 1.0, 0.3, 92.0, YG + 0.5, c); B.box(L, 4.1, 0.3, 92.0, YG + 3.05, c, STUC); });   // paredes norte e sul
  brick(0.3, 1.0, 19.3, MX1, YG + 0.5, MC); B.box(0.3, 4.1, 19.3, MX1, YG + 3.05, MC, STUC);                                // parede dos fundos
  [84, 90, 96, 102].forEach(x => { brick(0.5, 5.1, 0.2, x, YG + 2.55, MZ0 - 0.2); brick(0.5, 5.1, 0.2, x, YG + 2.55, MZ1 + 0.2); });  // pilastras laterais
  [-24, -19, -14].forEach(z => brick(0.2, 5.1, 0.5, MX1 + 0.2, YG + 2.55, z));
  B.box(24.9, 0.14, 0.5, 92.0, PAR + 0.07, MZ0, STUC2); B.box(24.9, 0.14, 0.5, 92.0, PAR + 0.07, MZ1, STUC2); B.box(0.5, 0.14, 19.5, MX0 - 0.1, PAR + 0.07, MC, STUC2); B.box(0.5, 0.14, 19.5, MX1 + 0.1, PAR + 0.07, MC, STUC2);   // platibanda
  B.box(24.8, 0.6, 0.12, 92.0, YG + 4.8, MZ0 - 0.12, STUC); B.box(24.8, 0.6, 0.12, 92.0, YG + 4.8, MZ1 + 0.12, STUC);
  // telhado plano com ar-condicionado
  B.box(24.5, 0.28, 19.5, 92.0, YG + 4.34, MC, lm(0x3d4046));
  [[86, -20], [92, -16], [98, -22]].forEach(([x, z]) => { B.box(2.0, 1.0, 1.4, x, YG + 5.0, z, STEEL); B.cyl(0.45, 0.45, 0.06, x, YG + 5.53, z, DK2, 16); B.box(2.1, 0.06, 1.5, x, YG + 4.52, z, DK); });
  // toldo da entrada
  B.box(2.8, 0.16, 8.4, 78.7, YG + 3.55, MC, RED); B.box(0.08, 0.3, 8.4, 77.3, YG + 3.4, MC, WHT);
  [-22.4, -14.6].forEach(z => B.box(0.14, 3.5, 0.14, 77.7, YG + 1.75, z, WHT));
  [-21.2, -15.8].forEach(z => B.cyl(0.1, 0.1, 0.95, 77.2, YG + 0.5, z, lm(0xe6b800), 10));                               // balizas amarelas
  // letreiro da fachada
  lab('MERCADO BOM PREÇO', 'frutas · pães · laticínios · tudo em um só lugar', 12.2, 1.45, '#b3202a', '#ffffff', 79.68, YG + 4.25, MC, -Math.PI / 2);
  // luminárias de parede (acendem à noite)
  const wallL = lm(0xdadada); const NIGHTM = new T.MeshBasicMaterial({ color: 0x9aa0a6 });
  [-26, -22.4, -14.6, -11].forEach(z => { B.box(0.22, 0.12, 0.3, 79.75, YG + 3.15, z, wallL); const m = new T.Mesh(new T.BoxGeometry(0.1, 0.04, 0.24), NIGHTM); m.position.set(79.68, YG + 3.08, z); grp.add(m); });
  // portas de correr (vidro, abrem sozinhas)
  const DM = [0, 1].map(() => new T.Mesh(new T.BoxGeometry(0.05, 2.55, 1.58), new T.MeshLambertMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.3, depthWrite: false })));
  DM.forEach(m => { m.position.y = YF + 1.27; grp.add(m); });
  [-0.8, 0.8].forEach(dz => { B.box(0.08, 2.6, 0.08, 80.0, YG + 1.3, MC + dz * 2, DK); });
  B.box(0.2, 0.18, 3.5, 80.1, YG + 3.15, MC, DK2);                                                                       // trilho/sensor
  mk._doors = DM;
  mk._night = { NIGHTM, GLOW: null, POOL: null };
  // ---------- chão, forro e luzes ----------
  const tile = (() => { const k = mc(256, 256, [24 / 2.4, 19 / 2.4]), g = k.g; g.fillStyle = '#d9d6cd'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#e8e5dc' : '#cfcbc0'; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); } k.t.needsUpdate = true; return k.t; })();
  flat(23.7, 18.7, 92.0, YF, MC, new T.MeshLambertMaterial({ map: tile }));
  flat(23.7, 18.7, 92.0, CEIL, MC, lm(0xf3f1ea), false);
  for (const z of [-24.5, -19.5, -14.5]) for (let x = 84; x <= 100; x += 4) { B.box(1.3, 0.05, 0.22, x, CEIL - 0.03, z, LIGHT); B.box(1.4, 0.03, 0.3, x, CEIL - 0.01, z, DK2); }
  [[86, -18.5], [95, -23.5], [96, -14.5]].forEach(p => H.light({ p: [p[0], CEIL - 0.6, p[1]], auto: () => true, zones: ['mkt', 'mktd'], k: 0.85, dist: 14, decay: 1.1, col: 0xf4f8ff }));
  P.staticBox(92, YG + 0.02, MC, 12, 0.1, 9.5);                                                                          // piso
  P.staticBox(92, YG + 4.3, MC, 12.3, 0.18, 9.8);                                                                        // teto/telhado
  P.staticBox(MX1, YG + 2.5, MC, 0.15, 2.5, 9.7); P.staticBox(92, YG + 2.5, MZ0, 12.3, 2.5, 0.15); P.staticBox(92, YG + 2.5, MZ1, 12.3, 2.5, 0.15);
  P.staticBox(MX0, YG + 2.5, -24.05, 0.15, 2.5, 3.95); P.staticBox(MX0, YG + 2.5, -12.95, 0.15, 2.5, 3.95);
  P.staticBox(115, YG - 0.5, MC, 15, 0.5, 25);                                                                           // chão do estacionamento além do gramado

  // ---------- caixa ÚNICO (detalhado): esteira que anda, leitor de código de barras, monitor, gaveta, maquininha, impressora, banco, placa luminosa ----------
  const LZ = -24.3, Z2 = ['mkt', 'mktd'], A = mk._anim = [];                                                                // A: animações por quadro (esteira, gaveta, portas...)
  const mesh = (geo, mat, x, y, z, par) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); (par || grp).add(m); return m; };
  const LED = new T.MeshBasicMaterial({ color: 0xeaf6ff }), ALU = lm(0xcfd4d9), BLK = lm(0x1a1c20);
  const POS = { total: 0, n: 0, last: 'Aguardando...', paid: false, rt: 0, flash: 0 };
  const ITEMS = [['ARROZ TIPO 1 5KG', 24.9], ['LEITE INTEGRAL 1L', 5.49], ['CAFÉ TORRADO 500G', 17.9], ['FEIJÃO CARIOCA 1KG', 8.5], ['MACARRÃO 500G', 4.29], ['REFRIGERANTE 2L', 9.99], ['DETERGENTE 500ML', 2.79], ['PÃO FRANCÊS KG', 12.9], ['AÇÚCAR 1KG', 4.99], ['SABONETE', 1.99]];
  const money = v => 'R$ ' + v.toFixed(2).replace('.', ',');
  const kPos = mc(320, 200), kCus = mc(256, 96), kPin = mc(128, 192), kRec = mc(96, 280);
  const drawAll = () => {
    let g = kPos.g; g.fillStyle = '#0c1a26'; g.fillRect(0, 0, 320, 200); g.fillStyle = '#1f7a5a'; g.fillRect(0, 0, 320, 34); g.fillStyle = '#fff'; g.font = '700 19px Arial, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('CAIXA 1 · BOM PREÇO', 12, 18);
    g.textAlign = 'right'; g.fillText(POS.n + (POS.n === 1 ? ' item' : ' itens'), 308, 18); g.textAlign = 'left'; g.fillStyle = '#9fd8ff'; g.font = '600 15px Arial, sans-serif'; g.fillText(POS.last, 12, 56);
    g.fillStyle = '#16384f'; g.fillRect(12, 78, 296, 2); g.fillStyle = '#8affc1'; g.font = '700 14px Arial, sans-serif'; g.fillText('TOTAL A PAGAR', 12, 104); g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = '800 46px Arial, sans-serif'; g.fillText(money(POS.total), 308, 148);
    g.textAlign = 'left'; g.fillStyle = '#5d7a8c'; g.font = '600 12px Arial, sans-serif'; g.fillText('Passe os itens no leitor · pague na maquininha', 12, 184); kPos.t.needsUpdate = true;
    g = kCus.g; g.fillStyle = '#06130d'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#35e08a'; g.font = '700 16px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('TOTAL', 12, 20); g.textAlign = 'right'; g.font = '800 44px Arial, sans-serif'; g.fillText(money(POS.total), 244, 62);
    g.textAlign = 'left'; g.fillStyle = '#1d8f58'; g.font = '600 12px Arial, sans-serif'; g.fillText(POS.paid ? 'PAGAMENTO APROVADO' : POS.proc ? 'PROCESSANDO...' : POS.n + ' item(ns)', 12, 86); kCus.t.needsUpdate = true;
    g = kPin.g; g.fillStyle = '#16181c'; g.fillRect(0, 0, 128, 192); g.fillStyle = '#9fe8c0'; g.fillRect(8, 8, 112, 50); g.fillStyle = '#0b2b1c'; g.font = '700 13px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(POS.paid ? 'APROVADO' : POS.proc ? 'AGUARDE' : POS.n ? 'PAGAR' : 'INSIRA', 64, 24); g.font = '800 17px Arial, sans-serif'; g.fillText(money(POS.total), 64, 44);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.fillStyle = r === 3 ? ['#d03a3a', '#cfcfcf', '#2fae5e'][c] : '#d9dde1'; g.fillRect(10 + c * 38, 68 + r * 29, 32, 24); g.fillStyle = '#111'; g.font = '700 14px Arial, sans-serif'; g.fillText(r === 3 ? ['✕', '·', 'OK'][c] : String(r * 3 + c + 1), 26 + c * 38, 81 + r * 29); }
    kPin.t.needsUpdate = true;
  };
  const drawReceipt = () => { const g = kRec.g; g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 96, 280); g.fillStyle = '#222'; g.font = '700 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MERCADO', 48, 12); g.fillText('BOM PREÇO', 48, 24); g.font = '8px monospace'; g.textAlign = 'left';
    for (let i = 0; i < 12; i++) { g.fillStyle = '#555'; g.fillRect(8, 42 + i * 13, 30 + ((i * 17) % 38), 3); g.fillRect(70, 42 + i * 13, 18, 3); }
    g.fillStyle = '#222'; g.fillRect(8, 206, 80, 1); g.font = '700 9px monospace'; g.fillText('TOTAL', 8, 222); g.textAlign = 'right'; g.fillText(money(POS.total), 88, 222); g.textAlign = 'center'; g.font = '8px monospace'; g.fillText('OBRIGADO!', 48, 246); g.fillText('VOLTE SEMPRE', 48, 258); kRec.t.needsUpdate = true; };
  drawAll();
  // ---- esteira (clique no botão ou na própria esteira liga/desliga)
  B.box(3.0, 0.68, 0.78, 83.6, YF + 0.44, LZ, lm(0xe6e3da)); B.box(2.9, 0.1, 0.7, 83.6, YF + 0.05, LZ, DK); B.box(3.0, 0.03, 0.78, 83.6, YF + 0.795, LZ, lm(0x30343a));
  [-0.37, 0.37].forEach(dz => B.box(3.0, 0.07, 0.04, 83.6, YF + 0.855, LZ + dz, STEEL)); [82.12, 85.08].forEach(x => B.cyl(0.03, 0.03, 0.6, x, YF + 0.83, LZ, DK2, 10, Math.PI / 2));
  [-0.36, 0.36].forEach(dz => B.box(0.05, 0.05, 0.05, 84.85, YF + 0.93, LZ + dz, BLK));                                       // sensores fotoelétricos
  lab('CAIXA 1', 'passe seus itens aqui', 1.5, 0.3, '#1f3b5a', '#ffffff', 83.6, YF + 0.45, LZ + 0.395, 0, 46);
  const beltT = mc(256, 64, [6, 1]); { const g = beltT.g; g.fillStyle = '#1b1d21'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 16; i++) { g.fillStyle = '#2d3037'; g.fillRect(i * 16 + 2, 0, 10, 64); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(i * 16 + 2, 0, 2, 64); } beltT.t.needsUpdate = true; }
  const belt = mesh(new T.PlaneGeometry(2.84, 0.6), own(0xffffff, { map: beltT.t }), 83.6, YF + 0.835, LZ); belt.rotation.x = -Math.PI / 2;
  const sep = mesh(new T.BoxGeometry(0.04, 0.07, 0.58), own(0x3b6fd4), 82.35, YF + 0.87, LZ);
  const BT = { on: false, v: 0 }, bBtn = mesh(new T.CylinderGeometry(0.032, 0.032, 0.02, 14), own(0x888888, { emissive: 0xd02a2a }), 82.45, YF + 0.58, LZ + 0.4); bBtn.rotation.x = Math.PI / 2;
  B.box(0.12, 0.12, 0.012, 82.45, YF + 0.58, LZ + 0.392, BLK);
  H.inter([bBtn, belt], () => { BT.on = !BT.on; bBtn.material.emissive.setHex(BT.on ? 0x14c85a : 0xd02a2a); sfx(BT.on ? 700 : 480, 0.1); setTimeout(() => sfx(BT.on ? 180 : 140, 0.18), 60); }, Z2);
  A.push(dt => { BT.v += ((BT.on ? 1 : 0) - BT.v) * VR.damp(3, dt); if (BT.v < 0.002) BT.v = 0; beltT.t.offset.x -= dt * 0.55 * BT.v; sep.position.x += dt * 0.45 * BT.v; if (sep.position.x > 84.88) sep.position.x = 82.35; });
  // ---- balcão do caixa: leitor, monitor, teclado, impressora, gaveta
  B.box(1.0, 0.85, 0.8, 85.6, YF + 0.425, LZ, lm(0xe0ddd4)); B.box(1.04, 0.05, 0.84, 85.6, YF + 0.875, LZ, lm(0x30343a)); B.box(0.02, 0.4, 0.78, 86.11, YF + 0.45, LZ, lm(0xd3d0c7));
  B.box(0.34, 0.03, 0.24, 85.38, YF + 0.915, LZ, BLK);
  const glassS = mesh(new T.PlaneGeometry(0.26, 0.17), own(0x0b2233), 85.38, YF + 0.932, LZ); glassS.rotation.x = -Math.PI / 2;
  const laser = mesh(new T.PlaneGeometry(0.25, 0.01), new T.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }), 85.38, YF + 0.935, LZ); laser.rotation.x = -Math.PI / 2;
  const scan = () => { POS.flash = 1; sfx(2300, 0.07); setTimeout(() => sfx(1700, 0.05), 70); };                            // o leitor só apita: os itens entram sozinhos quando ficam na esteira
  H.inter([glassS], scan, Z2);
  A.push(dt => { if (POS.flash > 0) { POS.flash = Math.max(0, POS.flash - dt * 3.5); laser.material.opacity = POS.flash * 0.9; } });
  B.cyl(0.075, 0.075, 0.015, 85.8, YF + 0.9075, LZ, BLK, 16); B.box(0.03, 0.2, 0.03, 85.8, YF + 1.01, LZ, BLK);
  { const mg = new T.Group(); mg.position.set(85.8, YF + 1.22, LZ); mg.rotation.z = 0.12; grp.add(mg); mesh(new T.BoxGeometry(0.03, 0.22, 0.33), lm(0x15171a), 0, 0, 0, mg);
    const sc = mesh(new T.PlaneGeometry(0.3, 0.19), new T.MeshBasicMaterial({ map: kPos.t }), 0.0165, 0, 0, mg); sc.rotation.y = Math.PI / 2; }                // monitor do operador (olha para +x)
  { const k = mc(128, 256), g = k.g; g.fillStyle = '#26292e'; g.fillRect(0, 0, 128, 256); for (let r = 0; r < 12; r++) for (let c = 0; c < 5; c++) { g.fillStyle = (r + c) % 7 === 0 ? '#c9a227' : '#d5d8dc'; g.fillRect(6 + c * 24, 6 + r * 20, 20, 15); } k.t.needsUpdate = true;
    B.box(0.12, 0.015, 0.34, 85.97, YF + 0.9075, LZ, BLK); const kb = mesh(new T.PlaneGeometry(0.11, 0.32), new T.MeshBasicMaterial({ map: k.t }), 85.97, YF + 0.9155, LZ); kb.rotation.x = -Math.PI / 2; }     // teclado
  B.box(0.17, 0.11, 0.2, 85.62, YF + 0.955, LZ - 0.29, BLK); B.box(0.12, 0.01, 0.012, 85.62, YF + 1.012, LZ - 0.29, lm(0x050505)); B.box(0.05, 0.04, 0.05, 85.62, YF + 1.02, LZ - 0.34, lm(0xe8e8e8));   // impressora de cupom
  const rcpt = mesh(new T.PlaneGeometry(0.07, 0.2), new T.MeshBasicMaterial({ map: kRec.t, side: T.DoubleSide }), 85.62, YF + 1.015, LZ - 0.285); rcpt.geometry.translate(0, 0.1, 0); rcpt.rotation.y = Math.PI / 2; rcpt.visible = false;
  const RC = { v: 0, ph: 0, wait: 0, tk: 0 };
  A.push(dt => { if (RC.ph === 1) { RC.v = Math.min(1, RC.v + dt / 1.3); RC.tk -= dt; if (RC.tk <= 0) { sfx(1500 + Math.random() * 300, 0.025); RC.tk = 0.07; } if (RC.v >= 1) { RC.ph = 2; RC.wait = 6; } } else if (RC.ph === 2) { RC.wait -= dt; if (RC.wait <= 0) RC.ph = 3; } else if (RC.ph === 3) { RC.v = Math.max(0, RC.v - dt * 3); if (RC.v <= 0) RC.ph = 0; }
    rcpt.visible = RC.v > 0.01; rcpt.scale.y = Math.max(0.01, RC.v); });
  // gaveta de dinheiro (abre para o lado do operador)
  const drw = new T.Group(); drw.position.set(86.1, YF + 0.72, LZ); grp.add(drw); const DR = { v: 0, t: 0, auto: 0 };
  const dfront = mesh(new T.BoxGeometry(0.025, 0.15, 0.52), own(0x8a8f96), 0.0125, 0, 0, drw); mesh(new T.BoxGeometry(0.012, 0.025, 0.14), lm(0x25282d), 0.03, 0.03, 0, drw);
  mesh(new T.BoxGeometry(0.4, 0.02, 0.48), lm(0xb9bec4), -0.2, -0.065, 0, drw);
  [-0.24, 0.24].forEach(dz => mesh(new T.BoxGeometry(0.4, 0.1, 0.015), lm(0xa5abb2), -0.2, -0.015, dz, drw)); mesh(new T.BoxGeometry(0.015, 0.1, 0.48), lm(0xa5abb2), -0.4, -0.015, 0, drw);
  [-0.09, 0.0, 0.09].forEach(dz => mesh(new T.BoxGeometry(0.3, 0.07, 0.008), lm(0x6f757c), -0.22, -0.03, dz, drw));
  [[0x4f9d5a, -0.17], [0x4a7fc1, -0.045], [0xb45fa0, 0.045], [0xd98a3d, 0.17]].forEach(([c, dz]) => mesh(new T.BoxGeometry(0.13, 0.035, 0.07), lm(c), -0.1, -0.035, dz, drw));          // cédulas
  [0xd9b84a, 0xc7ccd1, 0xb87333, 0xd9b84a].forEach((c, i) => mesh(new T.CylinderGeometry(0.028, 0.028, 0.05, 12), lm(c), -0.3, -0.02, -0.18 + i * 0.12, drw));                       // moedas
  A.push(dt => { if (DR.auto > 0) { DR.auto -= dt; if (DR.auto <= 0) { DR.t = 0; sfx(260, 0.09); } } DR.v += (DR.t - DR.v) * VR.damp(8, dt); if (Math.abs(DR.t - DR.v) < 0.002) DR.v = DR.t; drw.position.x = 86.1 + DR.v * 0.36; });
  H.inter([dfront], () => { DR.t = DR.t ? 0 : 1; DR.auto = 0; sfx(DR.t ? 620 : 260, 0.1); }, Z2);
  // maquininha de cartão (virada para o cliente, em +z) + display do cliente
  B.box(0.1, 0.02, 0.1, 85.45, YF + 0.91, LZ + 0.34, BLK); B.cyl(0.012, 0.012, 0.14, 85.45, YF + 0.99, LZ + 0.38, BLK, 8);
  const pg = new T.Group(); pg.position.set(85.45, YF + 1.07, LZ + 0.42); pg.rotation.x = 0.55; grp.add(pg);
  const pbody = mesh(new T.BoxGeometry(0.09, 0.02, 0.15), own(0x16181c), 0, 0, 0, pg), pface = mesh(new T.PlaneGeometry(0.082, 0.142), new T.MeshBasicMaterial({ map: kPin.t }), 0, 0.0105, 0, pg); pface.rotation.x = -Math.PI / 2;
  const pay = () => mk.pay();
  H.inter([pbody, pface], pay, Z2);
  A.push(dt => { if (POS.rt > 0) { POS.rt -= dt; if (POS.rt <= 0) { if (POS.paid) { POS.total = 0; POS.n = 0; POS.paid = false; } POS.last = 'Aguardando...'; drawAll(); } } });
  B.cyl(0.012, 0.012, 0.27, 85.2, YF + 1.04, LZ + 0.32, BLK, 8); B.box(0.2, 0.1, 0.02, 85.2, YF + 1.2, LZ + 0.32, BLK);
  mesh(new T.PlaneGeometry(0.19, 0.08), new T.MeshBasicMaterial({ map: kCus.t }), 85.2, YF + 1.2, LZ + 0.3315);                                                                // display do cliente
  B.cyl(0.035, 0.035, 0.16, 85.18, YF + 0.98, LZ - 0.3, lm(0xf2f4f5), 12); B.cyl(0.02, 0.02, 0.05, 85.18, YF + 1.085, LZ - 0.3, lm(0x2e6da4), 10); B.box(0.07, 0.015, 0.015, 85.2, YF + 1.115, LZ - 0.3, lm(0x2e6da4));   // álcool em gel
  // carrossel de sacolas, cestinhas, banco do operador, tapete, câmera
  [[-0.14, -0.18], [0.14, -0.18], [-0.14, 0.18], [0.14, 0.18]].forEach(([dx, dz]) => B.cyl(0.01, 0.01, 0.95, 84.7 + dx, YF + 0.475, LZ + 0.66 + dz, STEEL, 6)); B.cyl(0.19, 0.19, 0.012, 84.7, YF + 0.95, LZ + 0.66, STEEL, 16); B.box(0.34, 0.012, 0.42, 84.7, YF + 0.01, LZ + 0.66, lm(0x8d949b));
  for (let i = 0; i < 7; i++) B.box(0.26, 0.34, 0.006, 84.7, YF + 0.74, LZ + 0.54 + i * 0.03, lm(i % 2 ? 0xf1f3f4 : 0xe3e8ea));
  [-0.2, 0.2].forEach(dx => [-0.15, 0.15].forEach(dz => B.box(0.03, 0.5, 0.03, 81.5 + dx, YF + 0.25, LZ + 0.75 + dz, STEEL))); B.box(0.48, 0.03, 0.38, 81.5, YF + 0.52, LZ + 0.75, STEEL);
  for (let k = 0; k < 6; k++) { B.box(0.42, 0.09, 0.32, 81.5, YF + 0.59 + k * 0.045, LZ + 0.75, lm(0xd32f2f)); B.box(0.34, 0.02, 0.02, 81.5, YF + 0.64 + k * 0.045, LZ + 0.75 + 0.15, lm(0x8f1d22)); }   // cestinhas empilhadas
  B.cyl(0.2, 0.2, 0.02, 86.64, YF + 0.01, LZ, BLK, 16); B.cyl(0.025, 0.025, 0.55, 86.64, YF + 0.3, LZ, STEEL, 8); B.cyl(0.17, 0.17, 0.06, 86.64, YF + 0.64, LZ, lm(0x22252a), 16); B.box(0.04, 0.22, 0.3, 86.83, YF + 0.82, LZ, lm(0x22252a));   // banco
  [0, 1, 2, 3, 4].forEach(i => { const a = i / 5 * Math.PI * 2; B.box(0.2, 0.02, 0.03, 86.64 + Math.cos(a) * 0.1, YF + 0.03, LZ + Math.sin(a) * 0.1, BLK, -a); });
  B.box(0.9, 0.012, 1.3, 86.9, YF + 0.006, LZ, lm(0x2b2f36)); B.box(0.06, 0.004, 1.4, 81.0, YF + 0.003, LZ + 0.35, LY);                     // tapete antifadiga + faixa de espera
  B.sph(0.12, 85.6, CEIL - 0.04, LZ, DK, 1, 0.6, 1);                                                                                           // câmera de segurança
  // placa luminosa do caixa (pendurada no teto, dupla face)
  { const mkSign = () => { const k = mc(512, 240), g = k.g; g.fillStyle = '#0f5132'; g.fillRect(0, 0, 512, 240); g.strokeStyle = '#7be08a'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 224); g.fillStyle = '#7be08a'; g.fillRect(24, 24, 150, 192); g.fillStyle = '#0f5132'; g.font = '800 170px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', 99, 128);
      g.fillStyle = '#fff'; g.font = '800 70px Arial, sans-serif'; g.fillText('CAIXA', 344, 80); g.fillStyle = '#7be08a'; g.font = '800 58px Arial, sans-serif'; g.fillText('ABERTO', 344, 168); k.t.needsUpdate = true; return new T.Mesh(new T.PlaneGeometry(0.95, 0.446), new T.MeshBasicMaterial({ map: k.t })); };
    B.box(0.12, 0.5, 1.0, 84.2, YF + 2.55, LZ, DK); [-0.38, 0.38].forEach(dz => B.cyl(0.008, 0.008, 1.1, 84.2, YF + 3.5, LZ + dz, DK, 5));
    const s1 = mkSign(); s1.position.set(84.2 - 0.062, YF + 2.55, LZ); s1.rotation.y = -Math.PI / 2; grp.add(s1); const s2 = mkSign(); s2.position.set(84.2 + 0.062, YF + 2.55, LZ); s2.rotation.y = Math.PI / 2; grp.add(s2); }
  // balcão de atendimento, caixa eletrônico, carrinhos e pilha de água
  B.box(3.0, 1.05, 0.8, 82.5, YF + 0.525, -12.6, WOODL); B.box(3.1, 0.05, 0.95, 82.5, YF + 1.07, -12.6, DK); B.box(0.4, 0.3, 0.1, 82.0, YF + 1.28, -12.4, lm(0x222));
  lab('ATENDIMENTO', null, 2.0, 0.4, '#1f4a7a', '#ffffff', 82.5, YF + 2.9, -12.4, -Math.PI / 2); rod(82.5, YF + 3.4, -12.4, 1.0);
  B.box(0.7, 1.7, 0.5, 84.2, YF + 0.85, -9.55, lm(0x2d3a4a)); B.box(0.5, 0.25, 0.04, 84.2, YF + 1.35, -9.78, lm(0x6ec6ff)); lab('ATM', null, 0.6, 0.25, '#1f4a7a', '#fff', 84.2, YF + 1.85, -9.77, Math.PI);
  const cart = (x, z, ry) => B.at(x, YF, z, ry, b => { b.box(0.56, 0.3, 0.95, 0, 0.62, 0, STEEL); b.box(0.5, 0.03, 0.9, 0, 0.44, 0, DK2); b.box(0.06, 0.05, 0.55, 0, 0.98, -0.5, DK); [[-0.24, -0.4], [0.24, -0.4], [-0.24, 0.4], [0.24, 0.4]].forEach(([a, c]) => b.cyl(0.05, 0.05, 0.04, a, 0.07, c, DK, 8, 0, Math.PI / 2)); b.box(0.04, 0.4, 0.04, 0, 0.25, 0.4, DK2); });
  for (let i = 0; i < 5; i++) cart(81.3, -15.9 + i * 0.28, Math.PI / 2);
  for (let i = 0; i < 4; i++) cart(78.9, -26.3 + i * 0.6, Math.PI / 2);

  // ---------- gôndolas e prateleiras ----------
  const PAL = [0xc0392b, 0xe67e22, 0xf1c40f, 0x27ae60, 0x2980b9, 0x8e44ad, 0xecf0f1, 0xd35400, 0x16a085, 0xe84393, 0x7f8c8d, 0xf5cba7].map(c => lm(c));
  const boards = (x0, x1, zc, s, levels) => { for (let l = 0; l < levels; l++) B.box(x1 - x0, 0.03, 0.44, (x0 + x1) / 2, YF + 0.22 + l * 0.38, zc + s * 0.25, STEEL); };
  [-24.8, -22.4, -20.0].forEach((z, i) => { B.box(11.5, 0.12, 0.95, 93.75, YF + 0.06, z, DK2); B.box(11.5, 1.7, 0.06, 93.75, YF + 0.95, z, DK); boards(88, 99.5, z, 1, 4); boards(88, 99.5, z, -1, 4);
    B.box(11.5, 0.05, 0.9, 93.75, YF + 1.8, z, lm(0xb3202a));
    lab(['1 · Massas e grãos', '2 · Bebidas', '3 · Snacks'][i], null, 2.4, 0.5, '#f4f0e6', '#7a1a20', 87.4, YF + 2.9, z, -Math.PI / 2); rod(87.4, YF + 3.4, z, 1.0); });
  B.box(12, 1.7, 0.06, 94, YF + 0.95, -27.72, DK); boards(88, 100, -27.72, 1, 4); B.box(12, 0.12, 0.5, 94, YF + 0.06, -27.55, DK2);               // prateleira da parede norte
  lab('ENLATADOS · MOLHOS', null, 3.4, 0.5, '#f4f0e6', '#7a1a20', 94, YF + 2.6, -27.78, 0);
  // hortifrúti: parede inclinada + 2 mesas com frutas
  B.box(10, 1.4, 0.7, 91.5, YF + 0.7, -9.65, WOOD); B.box(10, 0.04, 0.3, 91.5, YF + 1.45, -9.8, lm(0x2e8b57));
  B.box(10.1, 0.06, 0.74, 91.5, YF + 0.5, -9.62, lm(0x5a3f27));
  [89.0, 93.4].forEach((x, ti) => { B.box(2.8, 0.7, 1.2, x, YF + 0.35, -12.6, WOOD); B.box(2.6, 0.04, 1.0, x, YF + 0.72, -12.6, lm(0x5a3f27));
    B.box(2.8, 0.18, 0.04, x, YF + 0.88, -13.2, WOODL); });
  lab('HORTIFRÚTI', 'fresquinhas todo dia', 3.2, 0.9, '#2e7d32', '#ffffff', 91.2, YF + 3.15, -10.6, Math.PI); rod(89.8, YF + 3.6, -10.6, 1.0); rod(92.6, YF + 3.6, -10.6, 1.0);
  // ---------- vidro com gotas de condensação (um material por porta/tampa: o realce ao apontar não vaza para as outras) ----------
  const dropT = (() => { const k = mc(256, 128), g = k.g, r = H.rnd(77); g.fillStyle = 'rgba(190,225,240,0.20)'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 110; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.16 + r() * 0.3).toFixed(2) + ')'; g.beginPath(); g.arc(r() * 256, r() * 128, 1 + r() * 2.6, 0, 7); g.fill(); }
    const gr = g.createLinearGradient(0, 0, 256, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.42, 'rgba(255,255,255,.24)'); gr.addColorStop(0.58, 'rgba(255,255,255,.24)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); k.t.needsUpdate = true; return k.t; })();
  const glassFx = () => own(0xffffff, { map: dropT, transparent: true, depthWrite: false, side: T.DoubleSide });
  const frostT = (() => { const k = mc(256, 96), g = k.g, r = H.rnd(91); for (let i = 0; i < 420; i++) { g.fillStyle = 'rgba(240,250,255,' + (0.1 + r() * 0.35).toFixed(2) + ')'; g.beginPath(); g.arc(r() * 256, r() * 96, 1 + r() * 4, 0, 7); g.fill(); } k.t.needsUpdate = true; return k.t; })();
  const lcdTxt = (w, h, txt, col, bg, fs) => { const k = mc(w, h), g = k.g; g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = col; g.font = '800 ' + fs + 'px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); k.t.needsUpdate = true; return new T.MeshBasicMaterial({ map: k.t }); };

  // ---------- congelados: 2 freezers de baú, cada um com 2 tampas de vidro que abrem (clique/pinça) ----------
  [90.5, 94.5].forEach(x => {
    const z0 = -15.4, W = 3.0, HW = lm(0xeceff1), LN2 = lm(0xd9ecf6);
    B.box(2.9, 0.1, 1.0, x, YF + 0.05, z0, DK);                                                                                       // base recuada
    [-1, 1].forEach(s => { B.box(W, 0.85, 0.07, x, YF + 0.525, z0 + s * 0.515, HW); B.box(0.07, 0.85, 1.1 - 0.14, x + s * 1.465, YF + 0.525, z0, HW);              // paredes externas
      B.box(2.86, 0.82, 0.015, x, YF + 0.54, z0 + s * 0.4725, LN2); B.box(0.015, 0.82, 0.93, x + s * 1.4225, YF + 0.54, z0, LN2);                                    // forro interno
      B.box(W, 0.05, 0.1, x, YF + 0.975, z0 + s * 0.5, STEEL); B.box(0.1, 0.05, 0.9, x + s * 1.45, YF + 0.975, z0, STEEL);                                            // moldura de alumínio
      B.box(2.8, 0.015, 0.03, x, YF + 0.925, z0 + s * 0.43, LED); B.box(W - 0.1, 0.12, 0.012, x, YF + 0.72, z0 + s * 0.556, lm(0x1f5f8b));                             // luz interna + faixa azul
      B.cyl(0.008, 0.008, 2.84, x, YF + 0.8, z0 + s * 0.3, STEEL, 6, 0, Math.PI / 2); });                                                                              // trilhos das cestas
    B.box(2.86, 0.02, 0.93, x, YF + 0.13, z0, lm(0xcfe3ee)); B.box(0.06, 0.05, 0.9, x, YF + 0.975, z0, STEEL);                                                         // fundo + divisória central
    for (let i = 0; i < 5; i++) B.cyl(0.006, 0.006, 0.62, x - 1.2 + i * 0.6, YF + 0.8, z0, STEEL, 6, Math.PI / 2);
    for (let j = 0; j < 4; j++) { B.box(0.8, 0.012, 0.01, x - 0.95, YF + 0.14 + j * 0.03, z0 + 0.556, DK); B.box(0.8, 0.012, 0.01, x + 0.55, YF + 0.14 + j * 0.03, z0 + 0.556, DK); }   // grade do compressor (frente)
    B.cyl(0.025, 0.025, 0.02, x + 1.3, YF + 0.55, z0 + 0.562, DK, 12, Math.PI / 2);                                                                                    // botão do termostato
    const fr = mesh(new T.PlaneGeometry(2.8, 0.9), new T.MeshLambertMaterial({ map: frostT, transparent: true, depthWrite: false }), x, YF + 0.152, z0); fr.rotation.x = -Math.PI / 2;
    mesh(new T.PlaneGeometry(0.24, 0.1), lcdTxt(96, 40, '-18 °C', '#ff4a3a', '#120606', 26), x + 1.05, YF + 0.55, z0 + 0.563);                                           // display da temperatura (frente)
    [-1, 1].forEach(sd => {                                                                                                                                              // tampas: dobradiça no fundo, puxador na frente
      const lid = new T.Group(); lid.position.set(x + sd * 0.74, YF + 1.0, z0 - 0.5); grp.add(lid); const LW = 1.43, LD = 0.96;
      const bar = (w, h, d, px, py, pz, m) => mesh(new T.BoxGeometry(w, h, d), m || ALU, px, py, pz, lid);
      bar(LW, 0.035, 0.04, 0, 0.0175, 0.02); bar(LW, 0.035, 0.04, 0, 0.0175, LD - 0.02); bar(0.04, 0.035, LD, -LW / 2 + 0.02, 0.0175, LD / 2); bar(0.04, 0.035, LD, LW / 2 - 0.02, 0.0175, LD / 2);
      const gl = mesh(new T.PlaneGeometry(LW - 0.06, LD - 0.06), glassFx(), 0, 0.022, LD / 2, lid); gl.rotation.x = -Math.PI / 2;
      const hnd = mesh(new T.BoxGeometry(0.5, 0.03, 0.03), own(0xb8bec4), 0, 0.065, LD - 0.02, lid); [-0.22, 0.22].forEach(px => bar(0.03, 0.045, 0.03, px, 0.04, LD - 0.02, lm(0x6b7077)));
      [-0.5, 0.5].forEach(px => { const h = mesh(new T.CylinderGeometry(0.014, 0.014, 0.09, 8), lm(0x6b7077), px, 0.012, -0.012, lid); h.rotation.z = Math.PI / 2; });                    // dobradiças
      const st = { v: 0, t: 0 }; H.inter([gl, hnd], () => { st.t = st.t ? 0 : 1; sfx(st.t ? 380 : 300, 0.1); setTimeout(() => sfx(st.t ? 520 : 220, 0.06), 90); }, Z2);
      A.push(dt => { st.v += (st.t - st.v) * VR.damp(6, dt); if (Math.abs(st.t - st.v) < 0.002) st.v = st.t; lid.rotation.x = -st.v * 1.6; });
    });
  });
  lab('CONGELADOS', null, 2.4, 0.5, '#1f5f8b', '#ffffff', 92.5, YF + 2.7, -15.3, Math.PI); rod(92.5, YF + 3.2, -15.3, 1.0);

  // ---------- laticínios: expositor refrigerado com 8 portas de vidro que abrem uma a uma ----------
  const CZ0 = -27.21, CN = 8, CP = 0.84, XF = 102.95, CZC = CZ0 + CN * CP / 2, CWH = lm(0xeceff1), CGR = lm(0x9aa1a8);
  B.box(0.85, 0.15, 6.8, 103.375, YF + 0.075, CZC, CGR); B.box(0.85, 0.35, 6.8, 103.375, YF + 2.125, CZC, CWH);                                                           // rodapé ventilado + cabeçote
  B.box(0.03, 1.8, 6.72, 103.79, YF + 1.05, CZC, lm(0xe6ebee)); B.box(0.85, 0.02, 6.72, 103.375, YF + 0.16, CZC, lm(0x8d949b));                                          // fundo e piso interno
  [CZ0 - 0.02, CZ0 + CN * CP + 0.02].forEach(z => B.box(0.85, 1.8, 0.04, 103.375, YF + 1.05, z, CWH));                                                                    // laterais
  B.box(0.03, 0.02, 6.6, 103.0, YF + 1.94, CZC, LED);
  for (let i = 0; i < 16; i++) B.box(0.012, 0.06, 0.3, 102.947, YF + 0.075, CZ0 + 0.25 + i * 0.41, DK);                                                                   // fendas de ventilação
  for (let i = 0; i <= CN; i++) { const z = CZ0 + CP * i; B.box(0.06, 1.8, 0.06, 102.985, YF + 1.05, z, ALU); B.box(0.02, 1.7, 0.025, 103.77, YF + 1.05, z, LED); }          // montantes + tubos de LED
  const TAGS = [lm(0xf6d743), lm(0xffffff), lm(0xe05a4f)];
  for (let l = 0; l < 4; l++) { const y = YF + 0.35 + l * 0.42; B.box(0.72, 0.02, 6.72, 103.35, y, CZC, STEEL); B.box(0.02, 0.05, 6.72, 102.995, y + 0.03, CZC, WHT);
    for (let i = 0; i < CN; i++) for (let j = 0; j < 3; j++) B.box(0.006, 0.035, 0.11, 102.983, y + 0.035, CZ0 + CP * i + 0.2 + j * 0.22, TAGS[(i + j + l) % 3]); }                  // etiquetas de preço
  { const k = mc(1024, 40), g = k.g, gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#1d4f8f'); gr.addColorStop(1, '#2b6cb0'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 40); g.fillStyle = '#fff'; g.font = '800 26px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LATICÍNIOS  ·  IOGURTES  ·  QUEIJOS  ·  MANTEIGA  ·  REQUEIJÃO  ·  LEITE', 512, 22); k.t.needsUpdate = true;
    const hd = mesh(new T.PlaneGeometry(5.9, 0.23), new T.MeshBasicMaterial({ map: k.t }), 102.94, YF + 2.12, CZC + 0.3); hd.rotation.y = -Math.PI / 2; }
  { const tm = mesh(new T.PlaneGeometry(0.3, 0.12), lcdTxt(120, 48, '+4 °C', '#35e08a', '#06130d', 30), 102.93, YF + 2.12, CZ0 + 0.28); tm.rotation.y = -Math.PI / 2; }
  const cdoors = [];
  for (let i = 0; i < CN; i++) {
    const pv = new T.Group(); pv.position.set(XF - 0.03, YF + 0.15, CZ0 + CP * i + 0.04); grp.add(pv);
    const bar = (w, h, d, px, py, pz, m) => mesh(new T.BoxGeometry(w, h, d), m || ALU, px, py, pz, pv);
    bar(0.035, 0.05, 0.76, 0, 1.775, 0.38); bar(0.035, 0.05, 0.76, 0, 0.025, 0.38); bar(0.035, 1.8, 0.05, 0, 0.9, 0.025); bar(0.035, 1.8, 0.05, 0, 0.9, 0.735);
    const gl = mesh(new T.PlaneGeometry(0.66, 1.7), glassFx(), 0, 0.9, 0.38, pv); gl.rotation.y = Math.PI / 2;
    const hd = mesh(new T.BoxGeometry(0.025, 0.8, 0.028), own(0xb8bec4), -0.045, 0.9, 0.7, pv); [0.55, 1.25].forEach(py => bar(0.04, 0.03, 0.03, -0.02, py, 0.7, lm(0x6b7077)));
    [0.02, 1.78].forEach(py => mesh(new T.CylinderGeometry(0.012, 0.012, 0.06, 8), lm(0x6b7077), 0, py, 0.0, pv));
    const st = { v: 0, t: 0, pv }; cdoors.push(st);
    H.inter([gl, hd], () => { st.t = st.t ? 0 : 1; sfx(st.t ? 340 : 280, 0.1); setTimeout(() => sfx(st.t ? 480 : 200, 0.07), 80); }, Z2);
  }
  A.push(dt => cdoors.forEach(st => { st.v += (st.t - st.v) * VR.damp(6, dt); if (Math.abs(st.t - st.v) < 0.002) st.v = st.t; st.pv.rotation.y = -st.v * 1.75; }));
  lab('LATICÍNIOS', null, 2.4, 0.5, '#2b6cb0', '#ffffff', 102.2, YF + 2.65, CZC, -Math.PI / 2); rod(102.2, YF + 3.15, CZC, 1.0);
  // (balcão de frios/açougue removido a pedido)
  // padaria: só a prateleira de pães (a ilha com vitrine foi removida a pedido)
  B.box(5.8, 1.9, 0.5, 100.7, YF + 0.95, -9.65, WOOD); [0.3, 0.75, 1.2, 1.65].forEach(y => { B.box(5.7, 0.03, 0.45, 100.7, YF + y, -9.72, WOODL); });
  lab('PADARIA', 'pão quentinho', 2.6, 0.9, '#8a5a33', '#fff3dc', 101.0, YF + 3.15, -10.4, Math.PI); rod(100.2, YF + 3.6, -10.4, 1.0); rod(101.8, YF + 3.6, -10.4, 1.0);
  // ---------- decoração ----------
  lab('OFERTAS DA SEMANA', 'leve 3 pague 2', 3.6, 1.1, '#f2c200', '#c4262e', 91.5, YF + 3.1, -18.3, -Math.PI / 2); rod(91.5, YF + 3.55, -18.3, 0.9);
  B.cyl(0.35, 0.3, 0.9, 80.9, YF + 0.45, -9.8, lm(0x4b5156), 14); B.cyl(0.5, 0.5, 0.2, 80.9, YF + 1.0, -9.8, lm(0x2e8b57), 14); B.sph(0.4, 80.9, YF + 1.35, -9.8, lm(0x3d7d36), 1, 1, 1);   // vaso com planta
  // ---------- exterior: totem, bancos, máquina de gelo, jornais, árvores, postes, fundos ----------
  B.box(0.5, 5.0, 0.5, 61.5, YG + 2.5, -11.5, DK); B.box(0.34, 2.5, 2.9, 61.5, YG + 4.3, -11.5, lm(0xb3202a));
  lab('MERCADO', 'BOM PREÇO · 24h', 2.7, 2.3, '#b3202a', '#ffffff', 61.32, YG + 4.3, -11.5, -Math.PI / 2); lab('MERCADO', 'BOM PREÇO · 24h', 2.7, 2.3, '#b3202a', '#ffffff', 61.68, YG + 4.3, -11.5, Math.PI / 2);
  B.box(0.5, 0.06, 1.4, 79.3, YG + 0.5, -22.9, WOOD); B.box(0.5, 0.5, 0.06, 79.5, YG + 0.75, -22.9, WOOD); [-23.5, -22.3].forEach(z => B.box(0.05, 0.5, 0.05, 79.3, YG + 0.25, z, DK));
  B.box(0.7, 1.7, 0.6, 79.35, YG + 0.85, -13.0, lm(0x2b8fd6)); lab('GELO', null, 0.6, 0.25, '#ffffff', '#2b8fd6', 79.0, YG + 1.4, -13.0, -Math.PI / 2);
  [0xc0392b, 0x2e6da4, 0x2e8b57].forEach((c, i) => B.box(0.3, 0.9, 0.35, 79.35, YG + 0.45 + 0.03, -11.9 + i * 0.35 * 0, lm(c)));
  B.cyl(0.25, 0.22, 0.8, 79.4, YG + 0.4, -14.2, lm(0x4b5156), 12);
  const tree = (x, z, s) => { B.cyl(0.14 * s, 0.2 * s, 2.6 * s, x, YG + 1.3 * s, z, lm(0x5b4129), 8);
    [[0, 3.4, 0, 1.5], [0.9, 3.0, 0.4, 1.1], [-0.8, 3.1, -0.5, 1.2], [0.2, 4.3, -0.2, 1.0], [-0.3, 3.0, 0.9, 1.0]].forEach(([a, b, c, r], i) => B.sph(r * s, x + a * s, YG + b * s, z + c * s, [lm(0x4f8f3a), lm(0x3e7a2f), lm(0x5e9d43)][i % 3], 1, 0.85, 1)); };
  [[79, -30.8], [79, -6.3], [106, -30.5], [106, -6.5]].forEach(([x, z]) => tree(x, z, 1.0));
  [[78.4, -29.2], [78.4, -7.8], [62.2, -13.6], [62.2, -9.6], [60.8, -5.0]].forEach(([x, z], i) => B.sph(0.45, x, YG + 0.4, z, i % 2 ? lm(0x2f6b2e) : lm(0x3d7d36), 1, 0.85, 1));
  // postes de luz do estacionamento (acendem à noite)
  const glowC = (() => { const k = mc(128, 128), g = k.g, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return k.c; })();
  const GLOW = new T.SpriteMaterial({ map: new T.CanvasTexture(glowC), color: 0xffd9a0, blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 });
  const POOL = new T.MeshBasicMaterial({ map: new T.CanvasTexture(glowC), color: 0xffcf8a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
  mk._night.GLOW = GLOW; mk._night.POOL = POOL;
  [[82, -31.5], [96, -31.5], [82, -5.5], [96, -5.5]].forEach(([x, z]) => { B.cyl(0.08, 0.1, 7.0, x, YG + 3.5, z, DK, 8); B.box(1.4, 0.1, 0.1, x, YG + 7.0, z, DK); B.box(0.5, 0.1, 0.24, x - 0.6, YG + 6.92, z, NIGHTM); B.box(0.5, 0.1, 0.24, x + 0.6, YG + 6.92, z, NIGHTM);
    const sp = new T.Sprite(GLOW); sp.scale.set(4.2, 4.2, 1); sp.position.set(x, YG + 6.8, z); grp.add(sp); const pl = flat(11, 11, x, YG + 0.06, z, POOL); pl.renderOrder = 2; });
  // fundos: doca de carga, porta de rolo, caçamba, paletes; saída de emergência na lateral
  B.box(2.7, 1.1, 5.4, 105.65, YG + 0.55, -22.5, CONC); B.box(0.1, 2.7, 3.2, MX1 + 0.2, YG + 2.4, -22.5, lm(0xcfd2d6)); [0.4, 0.9, 1.4, 1.9, 2.4, 2.9].forEach(y => B.box(0.04, 0.03, 3.2, MX1 + 0.27, YG + 1.1 + y * 0.85, -22.5, lm(0xaeb2b8)));
  B.box(2.8, 1.3, 2.0, 108.5, YG + 0.65, -23.5, lm(0x2e7d4f)); B.box(2.9, 0.1, 2.1, 108.5, YG + 1.35, -23.5, lm(0x23603c));
  for (let i = 0; i < 3; i++) { B.box(1.2, 0.12, 1.2, 105.5, YG + 1.16, -24.0 + i * 1.2, WOOD); B.box(0.9, 0.7, 0.9, 105.5, YG + 1.56, -24.0 + i * 1.2, lm(0xb08d5b)); }
  B.box(1.0, 2.1, 0.06, 98.0, YG + 1.15, MZ1 + 0.18, lm(0x9a2a2a)); lab('SAÍDA', null, 0.7, 0.25, '#1d6b34', '#fff', 98.0, YG + 2.4, MZ1 + 0.2, Math.PI / 2 - Math.PI / 2, 120);
// ====================================================== COMPRAS: produtos, caixa, sacola e atendente ======================================================
  // Fluxo: pegue produtos nas prateleiras/freezers/geladeira/frutas → coloque na esteira do caixa (eles entram na conta sozinhos)
  //        → aperte o botão verde "CONFIRMAR COMPRA" na parte de baixo do balcão → pagamento → tudo vira uma sacola
  //        → pegue a sacola, leve para casa e solte em cima da mesa de jantar: a sacola some e as compras aparecem.
  const CAN = window.CANNON, KIN = CAN.Body.KINEMATIC, DYN = CAN.Body.DYNAMIC;
  const mergeG = gs => { let nv = 0, ni = 0; gs.forEach(g => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni); let vo = 0, io = 0;
    gs.forEach(g => { const p = g.attributes.position; pos.set(p.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
      if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; } else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; } vo += p.count; });
    const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); m.setIndex(new T.BufferAttribute(idx, 1)); return m; };
  // monta o modelo de um produto: geometrias juntadas por material (poucos meshes por produto); y é medido a partir da base; dy centraliza no corpo físico
  const buildProto = (dy, fn) => { const map = new Map();
    const add = (g, mat) => { let a = map.get(mat); if (!a) map.set(mat, a = []); a.push(g); };
    const xf = (g, x, y, z, ry, rx, rz) => { if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y - dy, z); return g; };
    fn({
      box: (w, h, d, x, y, z, mat, ry, rx, rz) => add(xf(new T.BoxGeometry(w, h, d), x, y, z, ry, rx, rz), mat),
      cyl: (r0, r1, h, x, y, z, mat, rx, rz) => add(xf(new T.CylinderGeometry(r0, r1, h, 9), x, y, z, 0, rx, rz), mat),
      sph: (r, x, y, z, mat, sx, sy, sz) => { const g = new T.SphereGeometry(r, 9, 6); if (sx) g.scale(sx, sy, sz); add(xf(g, x, y, z), mat); },
      tor: (R, r, arc, x, y, z, mat, ry, rz) => add(xf(new T.TorusGeometry(R, r, 6, 12, arc), x, y, z, ry, 0, rz), mat),
      pln: (w, h, x, y, z, mat, ry, rx) => add(xf(new T.PlaneGeometry(w, h), x, y, z, ry, rx), mat)
    });
    const out = []; map.forEach((gs, mat) => out.push([mergeG(gs), mat])); return out; };
  const inst = proto => { const g = new T.Group(); proto.forEach(([geo, mat]) => g.add(new T.Mesh(geo, mat))); return g; };
  const lblMat = (w, h, draw) => { const k = mc(w, h); draw(k.g, w, h); k.t.needsUpdate = true; return new T.MeshLambertMaterial({ map: k.t, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); };
  const txt = (g, s, x, y, size, col, wt) => { g.fillStyle = col; g.font = (wt || 800) + ' ' + size + 'px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  const PI = Math.PI;

  // ---------- catálogo: nome, preço, caixa de colisão [largura, altura, profundidade] (origem = centro), massa, raio de pegar, e o modelo ----------
  const PRODS = {
    leite: { nome: 'LEITE INTEGRAL 1L', preco: 5.49, dim: [0.07, 0.2, 0.07], mass: 1.05, r: 0.1, make: Q => {
      const L = lblMat(128, 192, (g, w, h) => { g.fillStyle = '#f7fbff'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b6cb0'; g.fillRect(0, 0, w, 54); txt(g, 'LEITE', 64, 28, 38, '#fff'); txt(g, 'INTEGRAL', 64, 86, 24, '#1d4f8f'); txt(g, '1L', 64, 136, 60, '#2b6cb0'); g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(64, 172, 9, 0, 7); g.fill(); });
      Q.box(0.07, 0.19, 0.07, 0, 0.095, 0, lm(0x2b6cb0)); Q.box(0.07, 0.012, 0.022, 0, 0.196, 0, lm(0xf3f5f7)); Q.pln(0.062, 0.17, 0, 0.095, 0.0355, L, 0); Q.pln(0.062, 0.17, 0, 0.095, -0.0355, L, PI); } },
    salgadinho: { nome: 'SALGADINHO DE MILHO', preco: 7.99, dim: [0.2, 0.3, 0.055], mass: 0.1, r: 0.16, make: Q => {
      const L = lblMat(160, 200, (g, w, h) => { g.fillStyle = '#f39c12'; g.fillRect(0, 0, w, h); g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(80, 100, 62, 0, 7); g.fill(); g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(80, 100, 48, 0, 7); g.fill(); txt(g, 'CRUNCH', 80, 92, 30, '#b3202a'); txt(g, 'queijo', 80, 124, 22, '#8a4b0f', 700); txt(g, 'salgadinho de milho', 80, 180, 14, '#fff', 700); });
      Q.box(0.2, 0.26, 0.05, 0, 0.15, 0, lm(0xf39c12)); Q.box(0.2, 0.022, 0.014, 0, 0.289, 0, lm(0xc87f0a)); Q.box(0.2, 0.022, 0.014, 0, 0.011, 0, lm(0xc87f0a));
      for (let i = 0; i < 6; i++) { Q.box(0.006, 0.02, 0.016, -0.085 + i * 0.034, 0.289, 0, lm(0xa86a08)); Q.box(0.006, 0.02, 0.016, -0.085 + i * 0.034, 0.011, 0, lm(0xa86a08)); }
      Q.pln(0.17, 0.21, 0, 0.15, 0.0255, L, 0); Q.pln(0.17, 0.21, 0, 0.15, -0.0255, L, PI); } },
    trigo: { nome: 'FARINHA DE TRIGO 1KG', preco: 5.99, dim: [0.095, 0.17, 0.065], mass: 1.0, r: 0.1, make: Q => {
      const L = lblMat(128, 192, (g, w, h) => { g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f5f8b'; g.fillRect(0, 20, w, 64); txt(g, 'FARINHA', 64, 40, 30, '#fff'); txt(g, 'DE TRIGO', 64, 68, 24, '#bfe3f2'); g.fillStyle = '#e6c15a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(34 + i * 15, 118, 4, 11, 0.3, 0, 7); g.fill(); } txt(g, '1kg', 64, 164, 36, '#1f5f8b'); });
      Q.box(0.095, 0.165, 0.065, 0, 0.0825, 0, lm(0xf2efe6)); Q.box(0.095, 0.01, 0.03, 0, 0.165, 0, lm(0xe3ddcc)); Q.pln(0.085, 0.14, 0, 0.08, 0.0335, L, 0); Q.pln(0.085, 0.14, 0, 0.08, -0.0335, L, PI); } },
    ovos: { nome: 'OVOS BRANCOS DÚZIA', preco: 12.9, dim: [0.3, 0.072, 0.105], mass: 0.75, r: 0.16, make: Q => {
      const Lt = lblMat(312, 105, (g, w, h) => { g.fillStyle = '#d9c7b0'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4ecdc'; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { g.beginPath(); g.ellipse(32 + c * 49.5, 28 + r * 38, 17, 15, 0, 0, 7); g.fill(); } g.fillStyle = '#b3202a'; g.fillRect(0, 74, w, 28); txt(g, 'OVOS BRANCOS · 12 UNIDADES', w / 2, 89, 20, '#fff'); });
      const Lf = lblMat(256, 48, (g, w, h) => { g.fillStyle = '#b3202a'; g.fillRect(0, 0, w, h); txt(g, 'OVOS · DÚZIA', w / 2, h / 2 + 2, 30, '#fff'); });
      Q.box(0.3, 0.045, 0.105, 0, 0.0225, 0, lm(0xcdb8a0)); Q.box(0.3, 0.025, 0.105, 0, 0.0575, 0, lm(0xd9c7b0)); Q.pln(0.292, 0.097, 0, 0.0705, 0, Lt, 0, -PI / 2); Q.pln(0.26, 0.04, 0, 0.045, 0.0526, Lf, 0); } },
    carne: { nome: 'CARNE BOVINA BANDEJA', preco: 32.9, dim: [0.22, 0.047, 0.15], mass: 0.5, r: 0.14, make: Q => {
      const L = lblMat(128, 80, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3202a'; g.fillRect(0, 0, w, 26); txt(g, 'CARNE', 64, 14, 22, '#fff'); txt(g, '500g', 64, 52, 30, '#222'); });
      Q.box(0.22, 0.012, 0.15, 0, 0.006, 0, lm(0xf6f6f2)); Q.box(0.22, 0.03, 0.006, 0, 0.027, 0.072, lm(0xf6f6f2)); Q.box(0.22, 0.03, 0.006, 0, 0.027, -0.072, lm(0xf6f6f2)); Q.box(0.006, 0.03, 0.15, 0.107, 0.027, 0, lm(0xf6f6f2)); Q.box(0.006, 0.03, 0.15, -0.107, 0.027, 0, lm(0xf6f6f2));
      Q.box(0.19, 0.03, 0.12, 0, 0.027, 0, lm(0xb3262d)); [-0.03, 0, 0.03].forEach(z => Q.box(0.17, 0.004, 0.012, 0, 0.043, z, lm(0xe8b4b8))); Q.pln(0.07, 0.045, 0.06, 0.0465, 0.04, L, 0, -PI / 2); } },
    linguica: { nome: 'LINGUIÇA TOSCANA', preco: 21.9, dim: [0.24, 0.052, 0.16], mass: 0.5, r: 0.14, make: Q => {
      const L = lblMat(128, 80, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a3b20'; g.fillRect(0, 0, w, 26); txt(g, 'LINGUIÇA', 64, 14, 20, '#fff'); txt(g, '5 un', 64, 52, 30, '#222'); });
      Q.box(0.24, 0.012, 0.16, 0, 0.006, 0, lm(0xf6f6f2)); Q.box(0.24, 0.03, 0.006, 0, 0.027, 0.077, lm(0xf6f6f2)); Q.box(0.24, 0.03, 0.006, 0, 0.027, -0.077, lm(0xf6f6f2)); Q.box(0.006, 0.03, 0.16, 0.117, 0.027, 0, lm(0xf6f6f2)); Q.box(0.006, 0.03, 0.16, -0.117, 0.027, 0, lm(0xf6f6f2));
      for (let i = 0; i < 5; i++) Q.cyl(0.019, 0.019, 0.2, 0, 0.032, -0.058 + i * 0.029, lm(i % 2 ? 0xa3432f : 0xb5523b), 0, PI / 2); Q.pln(0.07, 0.045, 0.07, 0.0525, 0.05, L, 0, -PI / 2); } },
    fermento: { nome: 'FERMENTO EM PÓ 100G', preco: 4.49, dim: [0.06, 0.055, 0.06], mass: 0.1, r: 0.06, make: Q => {
      const L = lblMat(128, 64, (g, w, h) => { g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, h); txt(g, 'FERMENTO', 64, 32, 24, '#fff'); });
      Q.cyl(0.028, 0.028, 0.045, 0, 0.0225, 0, lm(0xf1c40f)); Q.cyl(0.0285, 0.0285, 0.016, 0, 0.0225, 0, lm(0xc0392b)); Q.cyl(0.0295, 0.0295, 0.008, 0, 0.049, 0, lm(0xf4f4f4)); Q.pln(0.034, 0.017, 0, 0.0225, 0.0292, L, 0); } },
    morango: { nome: 'MORANGO BANDEJA 300G', preco: 9.9, dim: [0.15, 0.066, 0.11], mass: 0.3, r: 0.1, make: Q => {
      const L = lblMat(192, 48, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#d62839'; g.fillRect(0, 0, 40, h); txt(g, 'MORANGO 300g', 118, 26, 26, '#b3202a'); });
      Q.box(0.14, 0.03, 0.1, 0, 0.015, 0, lm(0xe7f3f7));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const x = -0.045 + i * 0.03, z = -0.025 + j * 0.05; Q.sph(0.02, x, 0.042, z, lm(0xd62839), 1, 1.15, 1); Q.cyl(0.011, 0.011, 0.004, x, 0.063, z, lm(0x2e8b3d)); }
      Q.pln(0.09, 0.022, 0, 0.015, 0.0505, L, 0); } },
    maca: { nome: 'MAÇÃ VERMELHA', preco: 1.8, dim: [0.08, 0.08, 0.08], mass: 0.18, r: 0.05, shape: 'sphere', make: Q => {
      Q.sph(0.039, 0, 0.04, 0, lm(0xc0392b), 1, 0.95, 1); Q.cyl(0.003, 0.003, 0.02, 0, 0.082, 0, lm(0x5a3f27)); Q.sph(0.011, 0.014, 0.084, 0, lm(0x3e8e41), 1.6, 0.3, 0.8); } },
    banana: { nome: 'BANANA PRATA (PENCA)', preco: 6.5, dim: [0.19, 0.075, 0.13], mass: 0.6, r: 0.11, make: Q => {
      const R = 0.12, arc = 1.5, ye = R + 0.017;
      for (let i = 0; i < 4; i++) { const z = (i - 1.5) * 0.03, y = ye + (i % 2) * 0.004; Q.tor(R, 0.017, arc, 0, y, z, lm(0xf4d03f), 0.05 * (i - 1.5), -PI / 2 - arc / 2);
        [-1, 1].forEach(s => Q.sph(0.012, s * R * Math.sin(arc / 2), y - R * Math.cos(arc / 2), z, lm(0x5a3f27))); } } },
    refri: { nome: 'REFRIGERANTE COLA 6 UN', preco: 39.9, dim: [0.24, 0.3, 0.17], mass: 3.5, r: 0.2, make: Q => {
      const L = lblMat(256, 48, (g, w, h) => { g.fillStyle = '#7f1212'; g.fillRect(0, 0, w, h); txt(g, 'REFRIGERANTE COLA · 6 UN', w / 2, h / 2 + 2, 22, '#fff'); });
      Q.box(0.235, 0.06, 0.16, 0, 0.03, 0, lm(0xb71c1c));
      [-0.075, 0, 0.075].forEach(x => [-0.0375, 0.0375].forEach(z => { Q.cyl(0.029, 0.029, 0.17, x, 0.145, z, lm(0x3b2412)); Q.cyl(0.0295, 0.0295, 0.07, x, 0.14, z, lm(0xe53935)); Q.cyl(0.012, 0.029, 0.04, x, 0.25, z, lm(0x3b2412)); Q.cyl(0.012, 0.012, 0.02, x, 0.28, z, lm(0x3b2412)); Q.cyl(0.0135, 0.0135, 0.012, x, 0.296, z, lm(0xf4f4f4)); }));
      Q.pln(0.2, 0.045, 0, 0.03, 0.0805, L, 0); Q.pln(0.2, 0.045, 0, 0.03, -0.0805, L, PI); } },
    cerveja: { nome: 'CERVEJA LONG NECK 12 UN', preco: 54.9, dim: [0.31, 0.3, 0.23], mass: 6, r: 0.22, make: Q => {
      const L = lblMat(256, 48, (g, w, h) => { g.fillStyle = '#7a4a00'; g.fillRect(0, 0, w, h); txt(g, 'CERVEJA LONG NECK · 12 UN', w / 2, h / 2 + 2, 20, '#ffe08a'); });
      Q.box(0.31, 0.07, 0.23, 0, 0.035, 0, lm(0xd4a017));
      [-0.108, -0.036, 0.036, 0.108].forEach(x => [-0.072, 0, 0.072].forEach(z => { Q.cyl(0.026, 0.026, 0.14, x, 0.14, z, lm(0x7a3e0b)); Q.cyl(0.0265, 0.0265, 0.05, x, 0.14, z, lm(0xf0e6c8)); Q.cyl(0.0105, 0.026, 0.04, x, 0.23, z, lm(0x7a3e0b)); Q.cyl(0.0105, 0.0105, 0.04, x, 0.27, z, lm(0x7a3e0b)); Q.cyl(0.013, 0.013, 0.008, x, 0.294, z, lm(0xe6b800)); }));
      Q.pln(0.22, 0.05, 0, 0.035, 0.1155, L, 0); Q.pln(0.22, 0.05, 0, 0.035, -0.1155, L, PI); } },
    racao: { nome: 'RAÇÃO PET 1KG', preco: 24.9, dim: [0.2, 0.3, 0.08], mass: 1.0, r: 0.17, make: Q => {
      const L = lblMat(160, 224, (g, w, h) => { g.fillStyle = '#2f6b3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#f5d76e'; g.fillRect(0, 0, w, 52); txt(g, 'RAÇÃO', 80, 26, 34, '#2f6b3a'); g.fillStyle = '#fff6e0'; g.beginPath(); g.arc(80, 118, 46, 0, 7); g.fill(); g.fillStyle = '#8a5a2b'; [[60, 108, 9], [100, 108, 9], [80, 96, 8], [80, 132, 15]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); txt(g, 'CÃES E GATOS', 80, 186, 20, '#fff', 800); txt(g, '1 kg', 80, 210, 18, '#f5d76e', 700); });
      Q.box(0.2, 0.3, 0.075, 0, 0.15, 0, lm(0x2f6b3a)); Q.box(0.2, 0.02, 0.08, 0, 0.29, 0, lm(0x23542d)); Q.box(0.2, 0.012, 0.08, 0, 0.006, 0, lm(0x23542d)); Q.pln(0.18, 0.252, 0, 0.15, 0.0382, L, 0); Q.pln(0.18, 0.252, 0, 0.15, -0.0382, L, PI); } },
    bolacha: { nome: 'BOLACHA RECHEADA', preco: 3.99, dim: [0.14, 0.2, 0.04], mass: 0.2, r: 0.12, make: Q => {
      const L = lblMat(128, 160, (g, w, h) => { g.fillStyle = '#8d5524'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e0c0'; g.beginPath(); g.ellipse(64, 84, 52, 44, 0, 0, 7); g.fill(); g.fillStyle = '#4b2e1a'; [[44, 74], [78, 70], [60, 98], [88, 96]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); }); txt(g, 'BOLACHA', 64, 22, 24, '#fff'); txt(g, 'recheada', 64, 146, 18, '#fff', 700); });
      Q.box(0.14, 0.19, 0.035, 0, 0.1, 0, lm(0x8d5524)); Q.box(0.14, 0.012, 0.016, 0, 0.196, 0, lm(0x6e421a)); Q.box(0.14, 0.012, 0.016, 0, 0.004, 0, lm(0x6e421a)); Q.pln(0.125, 0.16, 0, 0.1, 0.0182, L, 0); Q.pln(0.125, 0.16, 0, 0.1, -0.0182, L, PI); } }
  };
  const PRO = {}, protoOf = t => PRO[t] || (PRO[t] = buildProto(PRODS[t].dim[1] / 2, PRODS[t].make));
  const dropProp = p => { try { P.world.removeBody(p.b); } catch (e) {} const i = P.props.indexOf(p); if (i >= 0) P.props.splice(i, 1); if (p.mesh.parent) p.mesh.parent.remove(p.mesh); P.rebuildPick(); };
  mk.spawnProd = (type, x, yb, z, ry, awake) => {
    const d = PRODS[type], dm = d.dim, mesh = inst(protoOf(type)); grp.add(mesh);
    const shape = d.shape === 'sphere' ? new CAN.Sphere(dm[0] / 2) : new CAN.Box(new CAN.Vec3(dm[0] / 2, dm[1] / 2, dm[2] / 2));
    const hy = ry || 0, p = P.addProp({ mesh, shapes: [{ shape }], mass: d.mass, pos: [x, yb + dm[1] / 2 + 0.002, z], quat: [0, Math.sin(hy / 2), 0, Math.cos(hy / 2)], r: d.r, name: d.nome, damping: 0.15, adamp: 0.35 });
    p.kind = 'prod'; p.type = type; p.zt = 0; if (!awake) p.b.sleep(); return p; };

  // ---------- paredes e prateleiras com colisão (para os produtos pararem em cima) ----------
  const GZ = [-24.8, -22.4, -20.0], GB = 0.27;
  GZ.forEach(z => { P.staticBox(93.75, YF + 0.95, z, 5.75, 0.85, 0.03); [-1, 1].forEach(s => { for (let l = 0; l < 4; l++) P.staticBox(93.75, YF + 0.22 + l * 0.38, z + s * 0.25, 5.75, 0.015, 0.22); }); });
  const FZ0 = -15.4;
  [90.5, 94.5].forEach(x => { P.staticBox(x, YF + 0.13, FZ0, 1.43, 0.01, 0.47);                                      // fundo do freezer
    [-1, 1].forEach(s => { P.staticBox(x, YF + 0.5, FZ0 + s * 0.5, 1.5, 0.4, 0.035); P.staticBox(x + s * 1.45, YF + 0.5, FZ0, 0.035, 0.4, 0.5); }); });
  [89.0, 93.4].forEach(x => P.staticBox(x, YF + 0.37, -12.6, 1.4, 0.37, 0.6));                                        // mesas de frutas
  for (let l = 0; l < 4; l++) P.staticBox(103.35, YF + 0.35 + l * 0.42, -27.21 + 8 * 0.84 / 2, 0.36, 0.012, 3.36);       // prateleiras da geladeira de laticínios
  P.staticBox(103.79, YF + 1.05, -27.21 + 8 * 0.84 / 2, 0.03, 0.95, 3.36);
  // esteira do caixa: o plano da esteira, as guias laterais e os batentes nas pontas
  P.staticBox(83.6, YF + 0.4175, LZ, 1.45, 0.4175, 0.37); [-1, 1].forEach(s => P.staticBox(83.6, YF + 0.86, LZ + s * 0.37, 1.5, 0.035, 0.02));
  P.staticBox(82.1, YF + 1.0, LZ, 0.02, 0.17, 0.4); P.staticBox(85.13, YF + 1.05, LZ, 0.03, 0.22, 0.4);
  P.staticBox(85.6, YF + 0.45, LZ, 0.5, 0.45, 0.4);                                                                    // balcão do operador

  // ---------- onde cada produto fica (vagas de reposição) ----------
  const SL = [], SP = { racao: 0.23, trigo: 0.105, fermento: 0.07, salgadinho: 0.215, bolacha: 0.15, refri: 0.26, cerveja: 0.33, leite: 0.1, ovos: 0.33 };
  const slot = (type, x, yb, z, ry) => SL.push({ type, x, yb, z, ry: ry || 0, p: null, t: 0 });
  const cluX = (type, xc, n, yb, z, ry) => { for (let i = 0; i < n; i++) slot(type, xc + (i - (n - 1) / 2) * SP[type], yb, z, ry); };
  const cluZ = (type, zc, n, yb, x, ry) => { for (let i = 0; i < n; i++) slot(type, x, yb, zc + (i - (n - 1) / 2) * SP[type], ry); };
  const put = (type, g, s, l, xcs, n) => xcs.forEach(xc => cluX(type, xc, n, YF + 0.22 + l * 0.38 + 0.015, GZ[g] + s * GB, s > 0 ? 0 : PI));
  put('trigo', 0, 1, 2, [90, 93.5, 97], 3); put('fermento', 0, 1, 1, [90, 93.5, 97], 3); put('trigo', 0, -1, 1, [91.5, 95.5], 3); put('fermento', 0, -1, 2, [91.5, 95.5], 3);      // gôndola 1
  put('refri', 1, 1, 0, [89.9, 93, 96.1], 2); put('refri', 1, 1, 1, [91.4, 94.5], 2); put('cerveja', 1, -1, 0, [89.9, 93, 96.1], 2); put('cerveja', 1, -1, 1, [91.4, 94.5], 2);          // gôndola 2
  put('salgadinho', 2, -1, 2, [90.5, 94, 97.5], 2); put('bolacha', 2, -1, 1, [90, 93.5, 97], 3); put('salgadinho', 2, 1, 1, [90.5, 94, 97.5], 2); put('bolacha', 2, 1, 2, [90, 93.5, 97], 3);   // gôndola 3
  put('racao', 2, -1, 0, [90.5, 94, 97.5], 2); put('racao', 2, 1, 0, [90.5, 94, 97.5], 2);                                                        // ração pet: prateleira de baixo da gôndola 3 (os dois lados)
  { const lt = l => YF + 0.35 + l * 0.42 + 0.012, dz = d => -27.21 + 0.84 * (d + 0.5);                                // geladeira de laticínios (8 portas)
    for (let d = 0; d < 4; d++) cluZ('leite', dz(d), 2, lt(1), 103.35, -PI / 2); for (let d = 0; d < 2; d++) cluZ('leite', dz(d), 2, lt(2), 103.35, -PI / 2); for (let d = 4; d < 7; d++) cluZ('ovos', dz(d), 2, lt(2), 103.35, -PI / 2); }
  [[90.5, 'carne'], [94.5, 'linguica']].forEach(([fx, t]) => [-1, 0, 1].forEach(xo => [-0.2, 0.2].forEach(zo => slot(t, fx + xo, YF + 0.14, FZ0 + zo, 0))));                              // freezers
  { const TT = YF + 0.74; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) slot('maca', 88.3 + 0.1 * i, TT, -12.8 + 0.1 * j, 0);                                                   // hortifrúti
    slot('banana', 89.3, TT, -12.85, 0.1); slot('banana', 89.3, TT, -12.6, -0.1); slot('banana', 89.8, TT, -12.72, 0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) slot('morango', 92.5 + 0.22 * i, TT, -12.85 + 0.16 * j, 0);
    slot('banana', 93.6, TT, -12.85, 0.1); slot('banana', 93.6, TT, -12.6, -0.1); slot('banana', 94.1, TT, -12.72, 0); }
  const MAXP = 170;
  const liveProds = () => { let n = 0; for (const p of P.props) if (p.kind === 'prod') n++; return n; };
  mk.stock = () => { SL.forEach(s => { s.p = mk.spawnProd(s.type, s.x, s.yb, s.z, s.ry, false); s.t = 0; }); };
  mk.clearAll = () => { P.props.slice().forEach(p => { if (p.kind === 'prod' || p.kind === 'bag') dropProp(p); }); SL.forEach(s => { s.p = null; }); CO.ph = 0; CO.items = []; POS.proc = false; pops.length = 0; };
  mk.restockAll = () => { mk.clearAll(); POS.total = 0; POS.n = 0; POS.paid = false; POS.last = 'Aguardando...'; drawAll(); mk.stock(); };
  const restock = dt => { let live = liveProds();
    SL.forEach(s => { const here = s.p && P.props.indexOf(s.p) >= 0 && Math.hypot(s.p.b.position.x - s.x, s.p.b.position.z - s.z) < 0.22 && Math.abs(s.p.b.position.y - (s.yb + PRODS[s.type].dim[1] / 2)) < 0.25;
      if (here) { s.t = 0; return; } s.t += dt; if (s.t < 1.8 || live >= MAXP) return;
      const hy = s.yb + PRODS[s.type].dim[1] / 2; for (const q of P.props) if (q.kind === 'prod' && Math.hypot(q.b.position.x - s.x, q.b.position.z - s.z) < 0.14 && Math.abs(q.b.position.y - hy) < 0.2) { s.t = 0; return; }    // alguém devolveu um item aqui
      s.p = mk.spawnProd(s.type, s.x, s.yb, s.z, s.ry, false); s.t = 0; live++; }); };

  // ---------- caixa: itens na esteira entram na conta; botão verde confirma; pagamento; sacola ----------
  const CO = { ph: 0, t: 0, items: [], scanT: 0 }, pops = [], BZ = { x0: 82.2, x1: 85.05, hz: 0.33, y0: YF + 0.78, y1: YF + 1.5 };
  const onBelt = p => { const b = p.b; return b.type === DYN && b.position.x > BZ.x0 && b.position.x < BZ.x1 && Math.abs(b.position.z - LZ) < BZ.hz && b.position.y > BZ.y0 && b.position.y < BZ.y1 && Math.abs(b.velocity.y) < 1.2; };
  const registered = () => P.props.filter(p => p.kind === 'prod' && p.zt > 0.35 && !p.locked);
  // atendente (sentada no banco): fala, olha para você, passa os itens, ensaca e se despede
  const AX = 86.64, AZ = LZ, W = (wx, wy, wz) => [wz - AZ, wy - YF, AX - wx];                                          // mundo → local da atendente (ela olha para -x)
  const SK = own(0xc68a63), UNI = own(0xc4262e), PNT = own(0x252a35), SHO = own(0x15171a), HAIR = own(0x24160f), DKM = own(0x111111);
  const AT = new T.Group(); AT.position.set(AX, YF, AZ); AT.rotation.y = -PI / 2; grp.add(AT);
  const part = (geo, mat, x, y, z, par, rx, rz) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; if (rz) m.rotation.z = rz; (par || AT).add(m); return m; };
  [-1, 1].forEach(s => { const sx = s * 0.1; part(new T.CylinderGeometry(0.06, 0.055, 0.4, 10), PNT, sx, 0.73, 0.2, AT, PI / 2); part(new T.CylinderGeometry(0.05, 0.045, 0.64, 10), PNT, sx, 0.4, 0.4); part(new T.BoxGeometry(0.1, 0.06, 0.24), SHO, sx, 0.03, 0.49); });
  part(new T.BoxGeometry(0.3, 0.14, 0.24), PNT, 0, 0.75, 0);
  const TG = new T.Group(); TG.position.set(0, 0.76, 0); AT.add(TG);
  part(new T.BoxGeometry(0.36, 0.5, 0.2), UNI, 0, 0.27, 0, TG); part(new T.BoxGeometry(0.14, 0.025, 0.205), own(0xf4f4f4), 0, 0.5, 0, TG);
  [-1, 1].forEach(s => part(new T.SphereGeometry(0.062, 10, 8), UNI, s * 0.2, 0.47, 0, TG)); part(new T.CylinderGeometry(0.04, 0.045, 0.09, 10), SK, 0, 0.56, 0, TG);
  { const k = mc(160, 64), g = k.g; g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 64); g.fillStyle = '#b3202a'; g.fillRect(0, 0, 160, 22); txt(g, 'BOM PREÇO', 80, 12, 16, '#fff'); txt(g, 'ANA · CAIXA', 80, 44, 20, '#222'); k.t.needsUpdate = true;
    const m = new T.Mesh(new T.PlaneGeometry(0.1, 0.04), new T.MeshBasicMaterial({ map: k.t })); m.position.set(0.1, 0.38, 0.1015); TG.add(m); }                       // crachá
  const HG = new T.Group(); HG.position.set(0, 0.6, 0.015); TG.add(HG);
  part(new T.SphereGeometry(0.105, 14, 10), SK, 0, 0.105, 0, HG); part(new T.SphereGeometry(0.112, 14, 10), HAIR, 0, 0.14, -0.018, HG).scale.set(1, 0.85, 1.02);
  part(new T.CylinderGeometry(0.107, 0.11, 0.05, 14), UNI, 0, 0.2, -0.004, HG); part(new T.BoxGeometry(0.15, 0.012, 0.09), UNI, 0, 0.185, 0.105, HG);                                // boné vermelho
  [-1, 1].forEach(s => part(new T.SphereGeometry(0.02, 8, 6), SK, s * 0.105, 0.1, 0, HG));
  const eyes = [-1, 1].map(s => part(new T.SphereGeometry(0.012, 8, 6), DKM, s * 0.038, 0.12, 0.1, HG)); part(new T.SphereGeometry(0.014, 8, 6), SK, 0, 0.095, 0.112, HG);
  const mouth = part(new T.BoxGeometry(0.042, 0.008, 0.01), own(0x8a2b2b), 0, 0.058, 0.103, HG);
  const ARM = [-1, 1].map(() => ({ up: part(new T.CylinderGeometry(1, 1, 1, 8), UNI, 0, 0, 0), fo: part(new T.CylinderGeometry(1, 1, 1, 8), SK, 0, 0, 0), el: part(new T.SphereGeometry(0.048, 8, 6), UNI, 0, 0, 0), ha: part(new T.SphereGeometry(0.046, 8, 6), SK, 0, 0, 0) }));   // 0 = direita (lado -x local), 1 = esquerda
  const bubC = mc(512, 128), bub = new T.Sprite(new T.SpriteMaterial({ map: bubC.t, transparent: true, opacity: 0 })); bub.scale.set(1.2, 0.3, 1); bub.position.set(AX, YF + 1.95, AZ); grp.add(bub);
  const ATS = { lean: 0.12, mode: 'idle', modeT: 0, head: 0, blink: 2, say: 0, greet: 0, wave: 0, hand: [new T.Vector3(...W(85.99, YF + 0.94, LZ - 0.08)), new T.Vector3(...W(85.99, YF + 0.93, LZ + 0.2))] };
  const say = (s, dur) => { const g = bubC.g; g.clearRect(0, 0, 512, 128); g.fillStyle = 'rgba(255,255,255,.96)'; g.strokeStyle = '#b3202a'; g.lineWidth = 6; g.beginPath(); g.roundRect ? g.roundRect(6, 6, 500, 94, 26) : g.rect(6, 6, 500, 94); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(236, 98); g.lineTo(256, 124); g.lineTo(276, 98); g.fill(); let fs = 40; g.font = '800 ' + fs + 'px Arial, sans-serif'; while (g.measureText && g.measureText(s).width > 470 && fs > 18) { fs -= 2; g.font = '800 ' + fs + 'px Arial, sans-serif'; }
    txt(g, s, 256, 54, fs, '#7a1a20'); bubC.t.needsUpdate = true; ATS.say = dur || 3; };
  const V1 = new T.Vector3(), V2 = new T.Vector3(), V3 = new T.Vector3(), V4 = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
  const segM = (m, a, b, r) => { V1.copy(b).sub(a); const l = V1.length() || 1e-3; m.position.copy(a).addScaledVector(V1, 0.5); V1.multiplyScalar(1 / l); m.quaternion.setFromUnitVectors(UP, V1); m.scale.set(r, l, r); };
  const armIK = (A_, S, Tg, side) => { const L1 = 0.3, L2 = 0.28; V1.copy(Tg).sub(S); const d = V1.length(), dd = Math.min(Math.max(d, 0.14), L1 + L2 - 0.006); V1.normalize();
    const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    V2.set(side * 0.45, -1, -0.15); V2.addScaledVector(V1, -V2.dot(V1)).normalize();
    V3.copy(S).addScaledVector(V1, a).addScaledVector(V2, h); V4.copy(S).addScaledVector(V1, dd);                                // cotovelo e mão
    segM(A_.up, S, V3, 0.05); segM(A_.fo, V3, V4, 0.042); A_.el.position.copy(V3); A_.ha.position.copy(V4); };
  const SH = new T.Vector3(), TG_ = new T.Vector3();
  const animAtt = dt => {
    const t = performance.now() / 1000, k = VR.damp(9, dt), inStore = PL.x > 80.4 && PL.x < 103.6 && PL.z > -27.6 && PL.z < -9.4, dP = Math.hypot(PL.x - AX, PL.z - AZ);
    if (ATS.greet > 0) ATS.greet -= dt; if (dP > 14) ATS.greet = Math.min(ATS.greet, 0);
    if (H.active && inStore && dP < 6.5 && ATS.greet <= 0) { ATS.greet = 90; ATS.wave = 2.4; say('Bem-vindo(a) ao Bom Preço!', 3.2); }
    if (ATS.wave > 0) ATS.wave -= dt; if (ATS.say > 0) { ATS.say -= dt; bub.material.opacity = Math.min(1, ATS.say / 0.4); } else bub.material.opacity = 0;
    if (CO.scanT > 0) CO.scanT -= dt;
    const mode = ATS.wave > 0 ? 'wave' : CO.ph === 3 ? 'bag' : CO.scanT > 0 ? 'scan' : 'idle';
    const tl = mode === 'scan' ? 0.3 : mode === 'bag' ? 0.28 : mode === 'wave' ? 0.1 : 0.12; ATS.lean += (tl - ATS.lean) * k; TG.rotation.x = ATS.lean; TG.scale.y = 1 + 0.006 * Math.sin(t * 1.7);
    let r, l; const sw = Math.sin(t * 9);
    if (mode === 'scan') { r = W(85.5 - 0.1 * sw, YF + 1.0, LZ + 0.05 + 0.05 * sw); l = W(85.2, YF + 0.95, LZ + 0.28 - 0.06 * sw); }
    else if (mode === 'bag') { r = W(84.55 + 0.05 * sw, YF + 1.0 + 0.03 * Math.abs(sw), LZ + 0.18); l = W(84.8, YF + 0.95, LZ + 0.35); }
    else if (mode === 'wave') { r = [-0.34 + 0.07 * Math.sin(t * 11), 1.62, 0.3]; l = W(85.99, YF + 0.93, LZ + 0.2); }
    else { r = W(85.99, YF + 0.945 + 0.006 * Math.sin(t * 14), LZ - 0.08 + 0.01 * Math.sin(t * 5)); l = W(85.99, YF + 0.93, LZ + 0.2); }
    ATS.hand[0].x += (r[0] - ATS.hand[0].x) * k; ATS.hand[0].y += (r[1] - ATS.hand[0].y) * k; ATS.hand[0].z += (r[2] - ATS.hand[0].z) * k;
    ATS.hand[1].x += (l[0] - ATS.hand[1].x) * k; ATS.hand[1].y += (l[1] - ATS.hand[1].y) * k; ATS.hand[1].z += (l[2] - ATS.hand[1].z) * k;
    const cl = Math.cos(ATS.lean), sl = Math.sin(ATS.lean);
    [-1, 1].forEach((s, i) => { SH.set(s * 0.2, 0.76 + 0.47 * cl, 0.47 * sl); armIK(ARM[i], SH, TG_.copy(ATS.hand[i]), s); });
    let hy = 0; if (inStore && dP < 8) { hy = Math.atan2(PL.x - AX, PL.z - AZ) + PI / 2; hy = Math.atan2(Math.sin(hy), Math.cos(hy)); hy = clamp(hy, -1.0, 1.0); }
    ATS.head += (hy - ATS.head) * VR.damp(5, dt); HG.rotation.y = ATS.head; HG.rotation.x = 0.05 + (mode === 'scan' ? 0.12 : 0);
    ATS.blink -= dt; if (ATS.blink < 0) ATS.blink = 2.5 + Math.random() * 3; const bl = ATS.blink < 0.12 ? 0.1 : 1; eyes.forEach(e => { e.scale.y = bl; });
    mouth.scale.set(mode === 'wave' || ATS.say > 0 ? 1.3 : 1, mode === 'wave' || ATS.say > 0 ? 1.6 + 0.6 * Math.sin(t * 12) : 1, 1);
  };

  // ---------- botão verde "CONFIRMAR COMPRA" (parte de baixo do balcão, lado do cliente) ----------
  const cbBase = mesh(new T.CylinderGeometry(0.068, 0.072, 0.02, 20), lm(0x2b2f36), 83.0, YF + 0.2, LZ + 0.4); cbBase.rotation.x = PI / 2;
  const cbBtn = mesh(new T.CylinderGeometry(0.052, 0.052, 0.03, 20), own(0x1fae5a, { emissive: 0x0f7a3a }), 83.0, YF + 0.2, LZ + 0.42); cbBtn.rotation.x = PI / 2;
  const cbPlate = lab('CONFIRMAR COMPRA', 'aperte para pagar', 0.64, 0.12, '#0f5132', '#ffffff', 83.0, YF + 0.085, LZ + 0.391, 0, 36);
  const CB = { press: 0 };
  H.inter([cbBtn, cbPlate], () => { CB.press = 1; mk.pay(); }, Z2);

  const reg = () => { const items = registered(); let tot = 0; items.forEach(p => { tot += PRODS[p.type].preco; }); return { items, tot }; };
  mk.pay = () => {
    if (CO.ph) return; const { items } = reg();
    if (POS.paid) { sfx(220, 0.1); return; }
    if (!items.length) { sfx(220, 0.15); POS.last = 'Coloque os itens na esteira primeiro'; POS.rt = 3; drawAll(); say('Coloque suas compras na esteira!', 3); return; }
    CO.items = items; CO.ph = 1; CO.t = 0; POS.proc = true; POS.last = 'AGUARDE... PROCESSANDO'; POS.rt = 0; drawAll(); sfx(880, 0.07); setTimeout(() => sfx(1180, 0.07), 90);
    items.forEach(p => { p.locked = true; const b = p.b; b.type = KIN; b.mass = 0; b.updateMassProperties(); b.velocity.setZero(); b.angularVelocity.setZero(); b.allowSleep = false; });   // trava os itens enquanto paga
  };
  // sacola de papel: com pontas dos produtos aparecendo
  const bagMat = lm(0xc8a26b), bagD = lm(0xa8834e);
  const BAGP = buildProto(0.16, Q => {
    const L = lblMat(256, 200, (g, w, h) => { g.fillStyle = '#c8a26b'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3202a'; g.fillRect(20, 40, 216, 80); txt(g, 'MERCADO', 128, 68, 38, '#fff'); txt(g, 'BOM PREÇO', 128, 102, 30, '#ffe9b0'); txt(g, 'obrigado! volte sempre', 128, 160, 20, '#6b4a1f', 700); });
    Q.box(0.3, 0.3, 0.17, 0, 0.15, 0, bagMat); Q.pln(0.26, 0.13, 0, 0.3205, 0, lm(0x3a2a1a), 0, -PI / 2); Q.box(0.3, 0.012, 0.17, 0, 0.306, 0, bagD);
    Q.pln(0.24, 0.19, 0, 0.14, 0.0855, L, 0); Q.pln(0.24, 0.19, 0, 0.14, -0.0855, L, PI); [-1, 1].forEach(s => Q.tor(0.06, 0.007, PI, 0, 0.31, s * 0.04, bagD, 0, 0)); });
  // API para os vizinhos (js/npc.js): prateleiras, catálogo, protótipos, caixa e atendente
  mk.api = { SL, GZ, PRODS, LZ, BAGP, inst, protoOf, dropProp, say: (s, d) => say(s, d), beep: () => scan() };
  mk.makeBag = (types, x, y, z) => {
    const g = inst(BAGP); g.scale.setScalar(0.2); grp.add(g);
    types.slice(0, 5).forEach((t, i) => { const d = PRODS[t].dim, it = inst(protoOf(t)), s = 0.8, e = Math.min(d[1] * s * 0.55, 0.13);
      it.scale.setScalar(s); it.position.set((i % 3 - 1) * 0.085, 0.16 + e - d[1] * s / 2, (i < 3 ? -1 : 1) * 0.025); it.rotation.y = (i * 1.7) % PI; g.add(it); });
    const p = P.addProp({ mesh: g, shapes: [{ shape: new CAN.Box(new CAN.Vec3(0.15, 0.16, 0.085)) }], mass: 1.5, pos: [x, y, z], r: 0.2, name: 'sacola de compras', damping: 0.12 });
    p.kind = 'bag'; p.types = types.slice(); pops.push({ m: g, t: 0, dur: 0.35 }); return p; };
  const TABLE = { x0: 4.28, x1: 5.32, z0: -1.02, z1: 1.02, y: H.FY + 0.8 }, CELLX = [4.47, 4.8, 5.13], CELLZ = [-0.8, -0.4, 0, 0.4, 0.8];
  mk.unpack = bag => {
    const types = bag.types.slice().sort((a, b) => PRODS[b].dim[0] * PRODS[b].dim[2] - PRODS[a].dim[0] * PRODS[a].dim[2]), cells = [];
    CELLZ.forEach(z => CELLX.forEach(x => { if (!(x === 4.8 && z === 0)) cells.push([x, z]); }));                                 // (o vaso fica no meio da mesa)
    let have = 0; for (const p of P.props) if (p.kind === 'prod' && p.b.position.x > TABLE.x0 && p.b.position.x < TABLE.x1 && Math.abs(p.b.position.z) < 1.05 && p.b.position.y > TABLE.y) have++;
    const layer = Math.floor(have / cells.length); dropProp(bag);
    types.forEach((t, i) => { const c = cells[i % cells.length], lay = layer + Math.floor(i / cells.length); const p = mk.spawnProd(t, c[0] + (Math.random() - 0.5) * 0.02, TABLE.y + 0.01 + lay * 0.32, c[1] + (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.4, true); pops.push({ m: p.mesh, t: -i * 0.05, dur: 0.25 }); });
    sfx(420, 0.05); setTimeout(() => sfx(520, 0.05), 70); setTimeout(() => sfx(380, 0.07), 150); try { VR.ui.toast('Compras guardadas na mesa (' + types.length + (types.length === 1 ? ' item)' : ' itens)'), 2500); } catch (e) {} };

  // ---------- por quadro ----------
  let tkS = 0, tkR = 0;
  A.push(dt => {
    if (!mk.live) return;
    animAtt(dt);
    if (CB.press > 0) { CB.press = Math.max(0, CB.press - dt * 5); cbBtn.position.z = LZ + 0.42 - 0.014 * Math.min(1, CB.press * 2); cbBtn.material.emissive.setHex(CB.press > 0.05 ? 0x30ff80 : 0x0f7a3a); }
    pops.forEach(o => { o.t += dt; o.m.scale.setScalar(o.t < 0 ? 0.001 : 0.2 + 0.8 * (1 - Math.pow(1 - clamp(o.t / o.dur, 0, 1), 3))); }); for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t >= pops[i].dur) { pops[i].m.scale.setScalar(1); pops.splice(i, 1); }
    // itens sobre a esteira: contam por 0,35 s antes de entrar na conta; com a esteira ligada, andam até o leitor
    for (const p of P.props) { if (p.kind !== 'prod' || p.locked) continue; if (onBelt(p)) { p.zt += dt; if (BT.on && BT.v > 0.3 && p.b.position.x < 84.6) { p.b.wakeUp(); if (p.b.velocity.x < 0.3) p.b.velocity.x += (0.3 - p.b.velocity.x) * Math.min(1, dt * 6); } } else p.zt = 0; }
    tkS += dt; if (tkS > 0.12 && CO.ph === 0 && !POS.paid) { tkS = 0; const { items, tot } = reg();
      if (items.length !== POS.n || Math.abs(tot - POS.total) > 0.001) { const grew = items.length > POS.n; POS.n = items.length; POS.total = tot;
        if (grew) { const q = items[items.length - 1]; POS.last = PRODS[q.type].nome + '  ' + money(PRODS[q.type].preco); POS.flash = 1; CO.scanT = 0.8; sfx(2300, 0.07); setTimeout(() => sfx(1700, 0.05), 70); } else POS.last = 'Item removido da conta';
        POS.rt = 2.5; drawAll(); }
      else if (POS.rt <= 0 && POS.n > 0 && POS.last === 'Aguardando...') { POS.last = POS.n + (POS.n === 1 ? ' item' : ' itens') + ' · aperte o botão verde'; drawAll(); } }
    // fases do pagamento
    if (CO.ph) { CO.t += dt;
      if (CO.ph === 1 && CO.t > 2.2) { CO.ph = 2; CO.t = 0; const tot = CO.items.reduce((a, p) => a + PRODS[p.type].preco, 0); POS.proc = false; POS.paid = true; POS.n = CO.items.length; POS.total = tot; POS.last = 'PAGAMENTO APROVADO · obrigado!'; drawAll(); drawReceipt();
        sfx(880, 0.09); setTimeout(() => sfx(1320, 0.16), 120); RC.ph = 1; RC.v = 0; RC.tk = 0; setTimeout(() => { DR.t = 1; DR.auto = 8; sfx(620, 0.1); }, 900); say('Aprovado! Obrigada, volte sempre!', 3.6); }
      else if (CO.ph === 2 && CO.t > 1.1) { CO.ph = 3; CO.t = 0; }
      else if (CO.ph === 3) { const k = clamp(CO.t / 0.7, 0, 1); CO.items.forEach(p => { if (p.mesh) p.mesh.scale.setScalar(Math.max(0.001, 1 - k)); });
        if (k >= 1) { const types = CO.items.map(p => p.type); CO.items.forEach(p => dropProp(p)); CO.items = [];
          const nb = Math.ceil(types.length / 10); for (let b = 0; b < nb; b++) mk.makeBag(types.slice(b * 10, b * 10 + 10), 84.4 - b * (nb > 4 ? 0.55 : 0.75), YF + 1.04, LZ);
          sfx(520, 0.06); setTimeout(() => sfx(760, 0.08), 80); say('Aqui estão suas sacolas! Pegue e leve para casa.', 4); POS.rt = 4; CO.ph = 0; } } }
    // sacolas soltas em cima da mesa de jantar: a sacola some e as compras aparecem
    tkR += dt; if (tkR > 0.15) { tkR = 0; for (const p of P.props) if (p.kind === 'bag' && p.b.type === DYN) { const b = p.b.position;
      if (b.x > TABLE.x0 - 0.06 && b.x < TABLE.x1 + 0.06 && b.z > TABLE.z0 - 0.06 && b.z < TABLE.z1 + 0.06 && b.y > TABLE.y + 0.04 && b.y < TABLE.y + 0.7 && p.b.velocity.length() < 1.6) { mk.unpack(p); break; } } }
    restock(dt);
  });
  B.flush(grp);
};

// ====================================================== LIGAÇÃO COM A CASA (produtos nascem ao entrar, somem ao sair) ======================================================
// room.js recria os objetos pegáveis a cada entrada e apaga todos na saída, então o estoque do mercado é refeito junto com a casa.
{ const enter0 = H.enter, exit0 = H.exit, reset0 = P.resetProps;
  H.enter = function () { const r = enter0.apply(this, arguments); try { if (mk.built && mk.stock) { mk.clearAll(); mk.stock(); mk.live = true; } } catch (e) { VR.log('mercado: ' + e.message); } return r; };
  H.exit = function () { try { if (mk.clearAll) mk.clearAll(); } catch (e) {} mk.live = false; return exit0.apply(this, arguments); };
  P.resetProps = function () { const r = reset0.apply(this, arguments); try { if (mk.live) mk.restockAll(); } catch (e) { VR.log('mercado: ' + e.message); } return r; };    // "reiniciar objetos" também repõe o mercado e some com as sacolas
}

// ====================================================== ATUALIZAÇÃO ======================================================
VR.hook(54, dt => {
  if (!mk.built) return;
  const d = mk.door, near = H.active && PL.x > 74 && PL.x < 86.5 && Math.abs(PL.z - MC) < 3.4;
  d.t = near ? 1 : 0; d.v += (d.t - d.v) * VR.damp(4, dt); if (Math.abs(d.t - d.v) < 0.003) d.v = d.t;
  const N = mk._night, dk = VR.sky ? VR.sky.cfg.dark : 0, on = clamp((dk - 0.35) * 3, 0, 1);
  if (N) { N.NIGHTM.color.setRGB(0.6 + 0.4 * on, 0.62 + 0.3 * on, 0.65 + 0.05 * on); if (N.GLOW) N.GLOW.opacity = on * 0.9; if (N.POOL) N.POOL.opacity = on * 0.55; }
  (mk._anim || []).forEach(f => f(dt));
  (mk._doors || []).forEach((m, i) => { m.position.set(80.04, m.position.y, MC + (i ? 1 : -1) * (0.8 + d.v * 1.35)); });
});
})();
