/* ZHOPPE: app de compras de bichinhos (cachorro e gato).
   Fluxo: Apps > ZHOPPE > escolhe o bicho e a cor > Comprar > 5 s depois toca a campainha e a caixa chega na porta da frente >
   pegue a caixa e leve até o fundo do quintal > ao soltar no chão o bicho sai da caixa > toque nele (pinça rápida): 1ª vez pede o nome;
   depois abre o menu (barras de status, sentar/seguir, cor da coleira, vender). Carinho: passe a mão aberta por cima dele. Pinça segurada: leva para outro lugar.
   STATUS: cada bicho tem Fome, Sede, Energia e Felicidade (barras no menu dele). Comer, beber e dormir (casinhas, potes, torneira) ficam em js/petcare.js. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, ui = VR.ui, C = ui.C, HS = VR.house, P = VR.phys, PL = VR.PL, HEAD = VR.HEAD, clamp = VR.clamp, damp = VR.damp;
const CAN = window.CANNON, YG = HS.YG, FY = HS.FY, PI = Math.PI;
const zh = VR.zhoppe = { live: {}, boxes: {}, hands: VR.H, on: false };
const rnd = (a, b) => a + Math.random() * (b - a), wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const money = v => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ====================================================== CATÁLOGO ======================================================
const KINDS = {
  dog: { nome: 'Cachorro', preco: 1200, colors: [['cara', 'Caramelo', '#c98a4b'], ['pret', 'Preto', '#26262b'], ['bran', 'Branco', '#f2efe8'], ['choc', 'Chocolate', '#6b4226'], ['cinz', 'Cinza', '#8a8f96'], ['dour', 'Dourado', '#e2b866']] },
  cat: { nome: 'Gato', preco: 900, colors: [['lara', 'Laranja', '#e08a3c'], ['pret', 'Preto', '#222226'], ['bran', 'Branco', '#f4f2ee'], ['cinz', 'Cinza', '#8d939c'], ['sia', 'Siamês', '#d8c3a5'], ['marr', 'Marrom', '#7a5233']] }
};
const COLLARS = [['verm', 'Vermelha', '#d63a3a'], ['azul', 'Azul', '#2f6fe0'], ['verd', 'Verde', '#2fa863'], ['amar', 'Amarela', '#f2c230'], ['rosa', 'Rosa', '#e665a6'], ['pret', 'Preta', '#222226']];
const hexOf = (list, id) => (list.find(c => c[0] === id) || list[0])[2];
const nameOf = (list, id) => (list.find(c => c[0] === id) || list[0])[1];
const SELL_K = 0.6, MAX_PETS = 8;                                              // vender devolve 60% do preço
const SLOTS = [[4.7, -3.5], [4.1, -3.5], [5.3, -3.5], [4.7, -3.95], [4.1, -3.95], [5.3, -3.95], [3.7, -3.5], [5.7, -3.5]];   // onde as caixas chegam no porch
const YARD = { x0: -7.4, x1: 18.0, z0: 9.3, z1: 13.6, mx: 1.0, mz: 11.8 };       // fundo do quintal (solte a caixa aqui)
const FENCE = { x0: -7.6, x1: 18.2, z0: -8.9, z1: 13.6 };                        // os bichos nunca saem do terreno
const DIM = {
  dog: { bl: 0.46, bw: 0.2, bh: 0.21, lh: 0.21, lr: 0.034, hs: 0.15, sn: 0.08, tl: 0.22, tr: 0.026, h: 0.5, grab: 0.42, box: [0.46, 0.34, 0.34] },
  cat: { bl: 0.34, bw: 0.14, bh: 0.15, lh: 0.15, lr: 0.026, hs: 0.115, sn: 0.03, tl: 0.3, tr: 0.02, h: 0.32, grab: 0.34, box: [0.38, 0.28, 0.28] }
};

// ====================================================== ESTADO (salvo no aparelho) ======================================================
const KEY = 'zhoppe1';
let st = { money: 5000, pets: [], orders: [], boxes: [], nid: 1 };
try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') st = Object.assign(st, o); } catch (e) {}
['pets', 'orders', 'boxes'].forEach(k => { if (!Array.isArray(st[k])) st[k] = []; });
const save = () => { try { const now = Date.now(); st.pets.forEach(e => { e.ts = now; }); localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
zh.state = () => st;
const toast = (m, ms) => { try { ui.toast(m, ms || 4200); } catch (e) {} };
const sel = zh.sel = { dog: 'cara', cat: 'lara' };

// ====================================================== STATUS (fome, sede, energia, felicidade) ======================================================
const RATE = { h: 100 / 1500, t: 100 / 1000, en: 100 / 2400 };
const SLEEP_GAIN = 100 / 150;
const clampS = v => Math.max(0, Math.min(100, v));
function initStats(e) {
  const s = e.s;
  if (!s || typeof s !== 'object') e.s = { h: 90, t: 90, en: 100, j: 70 };
  else { ['h', 't', 'en', 'j'].forEach(k => { s[k] = isFinite(s[k]) ? clampS(s[k]) : 80; }); }
}
function applyAway(e, sec) {
  if (!(sec > 5)) return; sec = Math.min(sec, 1200) * 0.5; const s = e.s;
  s.h = clampS(s.h - RATE.h * sec); s.t = clampS(s.t - RATE.t * sec); s.en = clampS(s.en - RATE.en * sec * 0.5); s.j = clampS(s.j - 0.02 * sec);
}
function statTick(p, dt) {
  const s = p.e.s, sl = !!(p.cs && p.cs.sleeping), f = sl ? 0.35 : 1;
  s.h = clampS(s.h - RATE.h * dt * f); s.t = clampS(s.t - RATE.t * dt * f);
  s.en = clampS(s.en + (sl ? SLEEP_GAIN : -RATE.en) * dt);
  const need = Math.min(s.h, s.t, s.en);
  if (need < 25) s.j = clampS(s.j - 0.12 * dt); else if (need < 50) s.j = clampS(s.j - 0.06 * dt); else s.j = clampS(s.j - 0.03 * dt);
  if (need >= 60 && s.j < 60) s.j = clampS(s.j + 0.08 * dt);
  if (p.caress > 0.3 && p.petT > 0 && !sl) s.j = clampS(s.j + 6 * dt);
}
function moodOf(s) {
  const m = Math.min(s.h, s.t, s.en);
  if (m < 25) return s.h === m ? ['Com muita fome', '#ff8a7a'] : s.t === m ? ['Com muita sede', '#ff8a7a'] : ['Muito cansado', '#ff8a7a'];
  if (m < 45) return s.h === m ? ['Ficando com fome', '#ffd166'] : s.t === m ? ['Ficando com sede', '#ffd166'] : ['Ficando cansado', '#ffd166'];
  if (s.j >= 70) return ['Muito feliz', '#7dffb0']; if (s.j >= 40) return ['Tranquilo', '#cfe3ff']; return ['Meio tristinho', '#ffd166'];
}
ui.D.zbar = (g, w) => {
  const v = clampS(w.get()), col = v < 25 ? '#ff6b5e' : v < 50 ? '#ffb84d' : w.color;
  ui.text(g, w.label, w.x, w._y + 13, 24, C.txt, 'left', 600); ui.text(g, Math.round(v) + '%', w.x + w.w, w._y + 13, 22, C.dim, 'right', 600);
  ui.rr(g, w.x, w._y + 32, w.w, 16, 8); g.fillStyle = 'rgba(255,255,255,.16)'; g.fill();
  if (v > 0.6) { ui.rr(g, w.x, w._y + 32, Math.max(16, w.w * v / 100), 16, 8); g.fillStyle = col; g.fill(); }
};

// ====================================================== SOM ======================================================
let ac = null;
const A = () => { try { if (!ac) { const K = window.AudioContext || window.webkitAudioContext; if (!K) return null; ac = new K(); } if (ac.state === 'suspended') ac.resume(); return ac; } catch (e) { return null; } };
function tone(f0, f1, dur, type, vol, delay) {
  const c = A(); if (!c) return; try {
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch (e) {}
}
const bell = () => { tone(880, 880, 1.1, 'sine', 0.13); tone(1760, 1760, 0.5, 'sine', 0.04); tone(659, 659, 1.5, 'sine', 0.13, 0.55); tone(1318, 1318, 0.6, 'sine', 0.04, 0.55); };   // ding-dong
const bark = () => { tone(330, 150, 0.13, 'sawtooth', 0.09); tone(300, 140, 0.12, 'sawtooth', 0.08, 0.18); };
const meow = () => { tone(620, 900, 0.18, 'sine', 0.09); tone(900, 520, 0.38, 'sine', 0.09, 0.18); };
const pop = () => { tone(300, 950, 0.14, 'sine', 0.1); tone(700, 1400, 0.1, 'triangle', 0.05, 0.08); };
const land = () => tone(140, 70, 0.09, 'sine', 0.07);
function purr(dur) {
  const c = A(); if (!c) return; try {
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 62; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    l.frequency.value = 24; lg.gain.value = 0.03; l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(c.destination); o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
  } catch (e) {}
}
const voice = p => { if (p.kind === 'dog') bark(); else meow(); };

// ====================================================== CORES ======================================================
const hexNum = h => parseInt(h.slice(1), 16);
const mixHex = (a, b, k) => { const f = s => ((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k; return ((f(16) | 0) << 16) | ((f(8) | 0) << 8) | (f(0) | 0); };
const shadeHex = (h, k) => mixHex(hexNum(h), 0x000000, 1 - k);
const css = n => '#' + n.toString(16).padStart(6, '0');
const matC = {}, lam = c => matC[c] || (matC[c] = new T.MeshLambertMaterial({ color: c }));

// ====================================================== LOJA (janela) ======================================================
function drawPetIcon(g, kind, hex, cx, cy, s, collar) {
  const n = hexNum(hex), dk = css(mixHex(n, 0, 0.28)), lt = css(mixHex(n, 0xffffff, 0.35)), sia = kind === 'cat' && hex === '#d8c3a5', dk2 = sia ? '#4a3526' : dk, fur = hex;
  g.save(); g.translate(cx, cy); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
  const ell = (x, y, rx, ry, col, rot) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, 7); g.fillStyle = col; g.fill(); };
  const box = (x, y, w, h, col) => { ui.rr(g, x, y, w, h, 5); g.fillStyle = col; g.fill(); };
  if (kind === 'dog') {
    g.strokeStyle = fur; g.lineWidth = 11; g.beginPath(); g.moveTo(-50, 0); g.quadraticCurveTo(-74, -8, -70, -38); g.stroke();
    box(-44, 18, 13, 36, dk2); box(-23, 20, 13, 34, dk2); ell(-10, 6, 54, 30, fur); box(14, 20, 13, 34, fur); box(35, 18, 13, 36, fur);
    ell(52, -20, 27, 25, fur); ell(75, -12, 17, 13, lt); ell(88, -16, 6, 5, '#1b1b1f'); ell(58, -29, 4.6, 4.6, '#1b1b1f'); ell(41, -32, 10, 22, dk2, 0.4);
    g.strokeStyle = collar; g.lineWidth = 9; g.beginPath(); g.moveTo(32, -6); g.lineTo(46, 8); g.stroke();
  } else {
    g.strokeStyle = sia ? dk2 : fur; g.lineWidth = 10; g.beginPath(); g.moveTo(-46, 12); g.quadraticCurveTo(-88, 8, -76, -36); g.stroke();
    box(-34, 30, 11, 26, fur); box(-14, 32, 11, 24, fur); ell(-8, 16, 48, 26, fur); box(12, 30, 11, 26, fur); box(30, 28, 11, 28, fur);
    ell(38, -10, 25, 23, fur);
    [[18, -26, 22, -58, 40, -34], [42, -34, 58, -58, 60, -24]].forEach(t => { g.beginPath(); g.moveTo(t[0], t[1]); g.lineTo(t[2], t[3]); g.lineTo(t[4], t[5]); g.closePath(); g.fillStyle = sia ? dk2 : fur; g.fill(); });
    ell(29, -14, 4.5, 6.5, '#2a8a4a'); ell(48, -14, 4.5, 6.5, '#2a8a4a'); ell(29, -14, 1.6, 5, '#101010'); ell(48, -14, 1.6, 5, '#101010'); ell(38, -4, 3.5, 2.6, '#e88fa0');
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; [[-1, -3], [-1, 1]].forEach(([s2, o]) => { g.beginPath(); g.moveTo(32, o - 1); g.lineTo(10, o - 5 + o * 3); g.moveTo(44, o - 1); g.lineTo(66, o - 5 + o * 3); g.stroke(); });
    g.strokeStyle = collar; g.lineWidth = 8; g.beginPath(); g.ellipse(34, 12, 17, 5, 0, 0.15, PI - 0.15); g.stroke();
  }
  g.restore();
}
ui.D.zpet = (g, w) => {
  const k = KINDS[w.kind], hex = hexOf(k.colors, sel[w.kind]), gr = g.createLinearGradient(w.x, w._y, w.x + w.w, w._y + w.h);
  gr.addColorStop(0, w.kind === 'dog' ? '#ffb15c' : '#b78cff'); gr.addColorStop(1, w.kind === 'dog' ? '#e0457b' : '#4a6bff');
  ui.rr(g, w.x, w._y, w.w, w.h, 26); g.fillStyle = gr; g.fill();
  g.save(); ui.rr(g, w.x, w._y, w.w, w.h, 26); g.clip(); g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(w.x, w._y + w.h - 62, w.w, 62); g.restore();
  drawPetIcon(g, w.kind, hex, w.x + w.w / 2 - 4, w._y + 98, 1.12, '#d63a3a');
  ui.text(g, k.nome, w.x + 26, w._y + w.h - 31, 32, '#fff', 'left', 700); ui.text(g, money(k.preco), w.x + w.w - 26, w._y + w.h - 31, 30, '#fff', 'right', 600);
};
const pending = () => st.orders.length, waiting = () => st.boxes.length, owned = () => st.pets.length;
const total = () => pending() + waiting() + owned();
function buy(kind) {
  const k = KINDS[kind]; if (!k) return false;
  if (total() >= MAX_PETS) { toast('Limite de ' + MAX_PETS + ' bichos. Venda algum primeiro'); ui.sfx(220, 0.15); return false; }
  if (st.money < k.preco) { toast('Saldo insuficiente'); ui.sfx(220, 0.15); return false; }
  st.money -= k.preco; st.orders.push({ kind, color: sel[kind], due: Date.now() + 5000 }); save(); shop.dirty = true;
  ui.sfx(1000, 0.08); toast(k.nome + ' comprado! A entrega chega em 5 segundos', 3500); return true;
}
const shop = ui.panel({ id: 'zhoppe', mw: 1.5, mh: 1.0, primary: true, title: 'ZHOPPE', titleIcon: 'bag', dist: 1.35, dy: 0.03, order: 11,
  onOpen: p => { ui.lastPrimary = 'zhoppe'; p.rebuild(); },
  extra(g, p) {
    const t = money(st.money); g.font = '700 28px ' + ui.FONT; const tw = g.measureText(t).width + 44;
    ui.rr(g, p.W - 100 - tw, 22, tw, 52, 26); g.fillStyle = 'rgba(255,255,255,.14)'; g.fill(); ui.text(g, t, p.W - 100 - tw / 2, 49, 28, '#fff', 'center', 700);
    const l1 = [pending() ? 'Pedidos a caminho: ' + pending() : '', waiting() ? 'Caixas na porta: ' + waiting() : '', 'Seus bichos: ' + owned()].filter(Boolean).join('   ·   ');
    ui.text(g, l1, 28, 586, 25, C.txt, 'left', 600);
    ui.text(g, 'Pegue a caixa na porta da frente, leve ao fundo do quintal e solte no chão.', 28, 624, 22, C.dim);
    if (!zh.on) ui.text(g, 'Abra o Quarto 3D (Ambientes) para receber seus bichos na casa.', 28, 660, 22, '#ffd166', 'left', 600);
  },
  build() {
    const out = [];
    ['dog', 'cat'].forEach((k, i) => {
      const x = 24 + i * 512, K = KINDS[k];
      out.push({ t: 'zpet', x, y: 98, w: 490, h: 220, kind: k });
      out.push({ t: 'choice', x, y: 328, w: 490, h: 122, label: 'Cor do ' + K.nome.toLowerCase(), sub: nameOf(K.colors, sel[k]), opts: K.colors, swatch: true, rebuild: true, get: () => sel[k], set: v => { sel[k] = v; } });
      out.push({ t: 'button', x, y: 460, w: 490, h: 84, style: 'primary', icon: 'bag', chev: false, label: () => st.money >= K.preco ? 'Comprar · ' + money(K.preco) : 'Saldo insuficiente', onClick: () => buy(k) });
    });
    return out;
  } });

// ====================================================== MODELOS 3D ======================================================
const gc = {}, geo = (k, f) => gc[k] || (gc[k] = f());
const ELL = () => geo('ell', () => new T.SphereGeometry(1, 14, 10));
function buildPet(kind, hex, collarHex) {
  const D = DIM[kind], root = new T.Group(), body = new T.Group(), n = hexNum(hex), sia = kind === 'cat' && hex === '#d8c3a5';
  const fur = lam(n), dk = lam(sia ? 0x4a3526 : mixHex(n, 0, 0.3)), snm = lam(mixHex(n, 0xffffff, 0.35)), eyeM = lam(0x111114), noseM = lam(kind === 'cat' ? 0xe88fa0 : 0x141416);
  const add = (par, g, m, x, y, z, sx, sy, sz) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); if (sx) o.scale.set(sx, sy, sz); par.add(o); return o; };
  const bodyY = D.lh + D.bh * 0.5, pz = -D.bl * 0.3;
  body.position.set(0, bodyY, pz); root.add(body);
  add(body, ELL(), fur, 0, 0, D.bl * 0.3, D.bw * 0.58, D.bh * 0.6, D.bl * 0.56);
  const head = new T.Group(); head.position.set(0, D.bh * 0.35, D.bl * 0.74); body.add(head);
  const hs = D.hs; add(head, ELL(), fur, 0, hs * 0.2, hs * 0.3, hs * 0.5, hs * 0.46, hs * 0.5);
  add(head, geo('box1', () => new T.BoxGeometry(1, 1, 1)), snm, 0, hs * 0.02, hs * 0.3 + hs * 0.45 + D.sn / 2 - 0.01, hs * 0.5, hs * 0.38, D.sn);
  add(head, ELL(), noseM, 0, hs * 0.1, hs * 0.75 + D.sn - 0.005, 0.016, 0.014, 0.014);
  const eyes = [-1, 1].map(s => add(head, ELL(), eyeM, s * hs * 0.24, hs * 0.34, hs * 0.72, 0.016, 0.018, 0.012));
  if (kind === 'dog') [-1, 1].forEach(s => { const e = add(head, geo('box1', () => new T.BoxGeometry(1, 1, 1)), dk, s * hs * 0.5, hs * 0.38, hs * 0.2, hs * 0.2, hs * 0.5, hs * 0.14); e.rotation.z = s * 0.35; });
  else { [-1, 1].forEach(s => { const e = add(head, geo('cone', () => new T.ConeGeometry(1, 1, 4)), sia ? dk : fur, s * hs * 0.3, hs * 0.72, hs * 0.2, hs * 0.2, hs * 0.4, hs * 0.2); e.rotation.z = -s * 0.15;
    [1, 2].forEach(i => add(head, geo('box1', () => new T.BoxGeometry(1, 1, 1)), lam(0xf2f2f2), s * (hs * 0.28 + 0.0), hs * (0.18 + i * 0.07), hs * 0.78, 0.07, 0.002, 0.002).rotation.z = s * (i - 1.5) * 0.35); }); }
  const tail = new T.Group(); tail.position.set(0, D.bh * 0.2, -D.bl * 0.2); body.add(tail);
  add(tail, geo('cyl' + kind, () => new T.CylinderGeometry(D.tr * 0.7, D.tr, D.tl, 7)), sia || kind === 'dog' ? (sia ? dk : fur) : fur, 0, D.tl / 2, 0); tail.rotation.x = kind === 'dog' ? -0.85 : -0.3;
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const l = new T.Group(); l.position.set(sx * D.bw * 0.32, D.lh, sz * D.bl * 0.32); root.add(l);
    add(l, geo('leg' + kind, () => new T.CylinderGeometry(D.lr, D.lr * 0.85, D.lh, 6)), fur, 0, -D.lh / 2, 0); add(l, geo('paw' + kind, () => new T.SphereGeometry(D.lr * 1.15, 7, 5)), sia ? dk : (kind === 'dog' ? fur : snm), 0, -D.lh + D.lr * 0.7, D.lr * 0.4);
    return l;
  });
  const collarMat = new T.MeshLambertMaterial({ color: hexNum(collarHex) });
  const ring = new T.Mesh(new T.TorusGeometry(D.bh * 0.5, 0.012, 7, 18), collarMat); ring.position.set(0, D.bh * 0.12, D.bl * 0.62); ring.scale.set(D.bw / D.bh, 1, 1); body.add(ring);
  add(body, new T.SphereGeometry(0.014, 7, 5), lam(0xf2c230), 0, D.bh * 0.12 - D.bh * 0.5, D.bl * 0.64);
  const shadow = new T.Mesh(new T.CircleGeometry(D.bl * 0.55, 18), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -PI / 2; shadow.position.y = 0.02; root.add(shadow);
  const hit = new T.Mesh(new T.BoxGeometry(D.grab * 1.1, D.h * 1.1, D.bl * 1.5), new T.MeshBasicMaterial({ visible: false })); hit.position.y = D.h * 0.5; root.add(hit);
  return { root, body, head, tail, legs, eyes, collarMat, shadow, hit, bodyY, pz };
}

// efeitos: corações e estrelinhas
const grp = new T.Group(); grp.visible = false; VR.scene.add(grp);
const fxTex = {};
function fxTexture(kind) {
  if (fxTex[kind]) return fxTex[kind]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff';
  if (kind === 'heart') { g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(4, 34, 8, 8, 24, 10); g.bezierCurveTo(30, 11, 32, 16, 32, 18); g.bezierCurveTo(32, 16, 34, 11, 40, 10); g.bezierCurveTo(56, 8, 60, 34, 32, 54); g.fill(); }
  else { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * PI / 5 - PI / 2, r = i % 2 ? 11 : 28; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return fxTex[kind] = t;
}
const fxs = [];
function fx(kind, x, y, z, n, o) {
  o = o || {};
  for (let i = 0; i < n; i++) {
    let f = fxs.find(q => q.life <= 0); if (!f) { if (fxs.length >= 40) return; const sp = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false, fog: false })); sp.visible = false; grp.add(sp); f = { sp, life: 0, v: new T.Vector3() }; fxs.push(f); }
    f.kind = kind; f.life = f.max = o.life || (kind === 'heart' ? 1.3 : 0.9); f.sp.material.map = fxTexture(kind); f.sp.material.needsUpdate = true;
    f.sp.material.color.setHex(kind === 'heart' ? (Math.random() < 0.5 ? 0xff5a8a : 0xff8fb0) : [0xffd166, 0x7dffb0, 0x6ab4ff, 0xff8fb0, 0xffffff][(Math.random() * 5) | 0]);
    f.sp.position.set(x + rnd(-0.08, 0.08), y, z + rnd(-0.08, 0.08)); f.s0 = kind === 'heart' ? rnd(0.1, 0.16) : rnd(0.05, 0.1); f.sp.scale.setScalar(f.s0); f.sp.visible = true;
    if (kind === 'heart') f.v.set(rnd(-0.1, 0.1), rnd(0.35, 0.55), rnd(-0.1, 0.1)); else f.v.set(rnd(-1, 1) * (o.spread || 1), rnd(0.8, 2.2), rnd(-1, 1) * (o.spread || 1));
  }
}
function fxTick(dt) {
  fxs.forEach(f => { if (f.life <= 0) return; f.life -= dt; if (f.life <= 0) { f.sp.visible = false; return; }
    if (f.kind !== 'heart') f.v.y -= 6 * dt; f.sp.position.addScaledVector(f.v, dt); const k = f.life / f.max; f.sp.material.opacity = Math.min(1, k * 2.2); f.sp.scale.setScalar(f.s0 * (f.kind === 'heart' ? 0.6 + 0.6 * (1 - k) : 0.5 + k)); });
}

// ====================================================== CAIXA ======================================================
function boxMesh(kind) {
  const d = DIM[kind].box, root = new T.Group(), cv = document.createElement('canvas'); cv.width = 256; cv.height = 192; const g = cv.getContext('2d');
  g.fillStyle = '#c9a06a'; g.fillRect(0, 0, 256, 192); g.fillStyle = 'rgba(0,0,0,.07)'; for (let i = 0; i < 12; i++) g.fillRect(0, i * 16, 256, 2);
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#ff8a3d'); gr.addColorStop(1, '#d6246e'); ui.rr(g, 28, 38, 200, 62, 14); g.fillStyle = gr; g.fill();
  g.font = '700 38px ' + ui.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('ZHOPPE', 128, 70);
  g.font = '600 22px ' + ui.FONT; g.fillStyle = '#5a3d1e'; g.fillText(kind === 'dog' ? 'CACHORRO' : 'GATO', 128, 128); g.font = '600 16px ' + ui.FONT; g.fillText('este lado para cima ↑', 128, 160);
  const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
  const side = new T.MeshLambertMaterial({ color: 0xc19a64 }), top = new T.MeshLambertMaterial({ color: 0xb48a55 }), face = new T.MeshLambertMaterial({ map: tx });
  root.add(new T.Mesh(new T.BoxGeometry(d[0], d[1], d[2]), [side, side, top, top, face, face]));
  const flaps = [1, -1].map(s => { const pv = new T.Group(); pv.position.set(0, d[1] / 2, s * d[2] / 2); const m = new T.Mesh(new T.BoxGeometry(d[0] * 0.99, 0.012, d[2] * 0.5), top); m.position.set(0, 0.006, -s * d[2] / 4); pv.add(m); root.add(pv); pv.userData.s = s; return pv; });
  const tape = new T.Mesh(new T.BoxGeometry(d[0] * 0.995, 0.004, 0.07), new T.MeshLambertMaterial({ color: 0xe8d9b5 })); tape.position.set(0, 0.014, -0.05 * 1); flaps[0].add(tape);
  return { root, flaps };
}
function spawnBox(e, idx) {
  const d = DIM[e.kind].box, bm = boxMesh(e.kind), sl = SLOTS[idx % SLOTS.length]; grp.add(bm.root);
  const p = P.addProp({ mesh: bm.root, shapes: [{ shape: new CAN.Box(new CAN.Vec3(d[0] / 2, d[1] / 2, d[2] / 2)) }], mass: 3, pos: [sl[0], FY + d[1] / 2 + 0.03, sl[1]], r: 0.26, damping: 0.1, name: 'caixa' });
  p.b.wakeUp(); const box = zh.boxes[e.id] = { id: e.id, e, p, b: p.b, mesh: bm.root, flaps: bm.flaps, state: 'closed', t: 0, still: 0, lost: 0 }; return box;
}
function dropBox(box) {                                                          // tira do mundo físico (a entrada no estado continua)
  try { P.world.removeBody(box.b); } catch (e) {} const i = P.props.indexOf(box.p); if (i >= 0) P.props.splice(i, 1); P.rebuildPick(); grp.remove(box.mesh); delete zh.boxes[box.id];
}
function openBox(box) {
  const b = box.b, e = box.e; box.state = 'opening'; box.t = 0;
  try { P.world.removeBody(b); } catch (er) {} const i = P.props.indexOf(box.p); if (i >= 0) P.props.splice(i, 1); P.rebuildPick();
  st.boxes = st.boxes.filter(x => x.id !== e.id);
  const pe = { id: e.id, kind: e.kind, color: e.color, name: '', collar: 'verm', mode: 'free', x: b.position.x, z: b.position.z }; st.pets.push(pe); save();
  const p = spawnPet(pe, { x: b.position.x, z: b.position.z, y: b.position.y + 0.05 });
  const a = Math.atan2(PL.x - p.x, PL.z - p.z) + rnd(-0.6, 0.6); p.yaw = a; p.state = 'pop'; p.t = 0; p.vy = 2.5; p.vx = Math.sin(a) * 0.55; p.vz = Math.cos(a) * 0.55; p.sc = 0.35;
  fx('star', b.position.x, b.position.y + 0.2, b.position.z, 14, { spread: 1.1 }); pop(); setTimeout(() => voice(p), 350);
  toast('Toque no ' + KINDS[e.kind].nome.toLowerCase() + ' para dar um nome', 5000); shop.dirty = true;
}
function boxTick(dt) {
  const ids = Object.keys(zh.boxes);
  ids.forEach(id => {
    const box = zh.boxes[id]; if (!box) return;
    if (box.state === 'opening') {
      box.t += dt; const k = clamp(box.t / 0.35, 0, 1); box.flaps.forEach(f => { f.rotation.x = f.userData.s * k * 2.1; });
      if (box.t > 1.2) { const s = clamp(1 - (box.t - 1.2) / 0.35, 0, 1); box.mesh.scale.setScalar(Math.max(0.001, s)); if (s <= 0) { grp.remove(box.mesh); delete zh.boxes[id]; } }
      return;
    }
    if (P.props.indexOf(box.p) < 0) { grp.remove(box.mesh); delete zh.boxes[id]; return; }        // o cenário foi reiniciado: a caixa volta no próximo quadro
    const b = box.b, sp = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z), held = b.type !== CAN.Body.DYNAMIC, pos = b.position;
    const inYard = pos.x > YARD.x0 && pos.x < YARD.x1 && pos.z > YARD.z0 && pos.z < YARD.z1, low = pos.y < YG + 0.7;
    if (!held && inYard && low && sp < 1.0) { box.still += dt; if (box.still > 0.35) openBox(box); } else box.still = 0;
    if (!held && !inYard && sp < 0.3 && pos.y < YG + 0.7 && pos.z > 4) { box.lost += dt; if (box.lost > 3 && performance.now() - (zh.hintT || 0) > 25000) { zh.hintT = performance.now(); box.lost = 0; toast('Aqui não: leve a caixa até o fundo do quintal'); } } else box.lost = 0;
  });
}
// marcador no chão do quintal enquanto houver caixa para levar
const mark = new T.Group(); mark.visible = false; grp.add(mark);
{ const ring = new T.Mesh(new T.RingGeometry(0.7, 0.85, 40), new T.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.7, depthWrite: false, side: T.DoubleSide, fog: false })); ring.rotation.x = -PI / 2; ring.position.y = 0.03; mark.add(ring);
  const arrow = new T.Mesh(new T.ConeGeometry(0.16, 0.34, 4), new T.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.85, fog: false })); arrow.rotation.x = PI; arrow.position.y = 1.1; arrow.name = 'arrow'; mark.add(arrow);
  mark.position.set(YARD.mx, YG, YARD.mz); }

// ====================================================== BICHOS ======================================================
const zinfo = (x, z) => HS.zoneInfo ? HS.zoneInfo(x, z, 'down') : null;
const okPos = (x, z) => x > FENCE.x0 && x < FENCE.x1 && z > FENCE.z0 && z < FENCE.z1 && !!zinfo(x, z);
function findFree(x, z, r) {
  if (okPos(x, z)) return { x, z };
  for (let rad = 0.4; rad <= r; rad += 0.4) for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, nx = x + Math.cos(a) * rad, nz = z + Math.sin(a) * rad; if (okPos(nx, nz)) return { x: nx, z: nz }; }
  return null;
}
function tryMove(p, dx, dz) {
  if (okPos(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; return true; }
  if (dx && okPos(p.x + dx, p.z)) { p.x += dx; return true; }
  if (dz && okPos(p.x, p.z + dz)) { p.z += dz; return true; }
  return false;
}
const floorAt = p => { const zi = zinfo(p.x, p.z); if (zi) { p.lastFloor = zi.y; return zi.y; } return p.lastFloor; };
function spawnPet(e, o) {
  o = o || {}; const D = DIM[e.kind], m = buildPet(e.kind, hexOf(KINDS[e.kind].colors, e.color), hexOf(COLLARS, e.collar)); grp.add(m.root);
  const p = Object.assign(m, { id: e.id, e, kind: e.kind, D, x: 0, y: YG, z: 0, yaw: rnd(0, PI * 2), vx: 0, vy: 0, vz: 0, state: 'idle', t: 0, act: 'stand', actT: rnd(1, 3), tgt: null, phase: 0, sit: 0, wantSit: 0, happy: 0, caress: 0, petT: 0, heartT: 0, blink: rnd(2, 4), blinkK: 0, hold: null,
    menu: false, nameOpen: false, stuck: 0, idleT: 0, sc: 1, lastFloor: YG, lastGood: null, squash: 0, vcur: 0, joy: 0, voiceT: 0, sniff: 0,
    cs: null, eat: 0, eatW: 0, eatF: 9, lie: 0, lieW: 0, floorAdd: 0, bub: null, bubK: 0 });
  initStats(e); if (e.ts && o.y === undefined) applyAway(e, (Date.now() - e.ts) / 1000);
  let x = o.x !== undefined ? o.x : e.x, z = o.z !== undefined ? o.z : e.z;
  if (!(x > FENCE.x0 && x < FENCE.x1 && z > FENCE.z0 && z < FENCE.z1)) { x = YARD.mx; z = YARD.mz; }
  if (o.y === undefined) { const f = findFree(x, z, 5) || findFree(YARD.mx, YARD.mz, 6) || { x: YARD.mx, z: YARD.mz }; x = f.x; z = f.z; }
  p.x = x; p.z = z; const zi = zinfo(x, z); p.lastFloor = zi ? zi.y : YG; p.y = o.y !== undefined ? o.y : p.lastFloor; p.lastGood = { x, z };
  p.it = { zh: true, meshes: [p.hit], click: () => rayTap(p), hover: () => {}, skip: () => !zh.on }; zh.live[e.id] = p; refreshInter(); return p;
}
function removePet(p) { grp.remove(p.root); if (p.bub) grp.remove(p.bub); if (zh.care && zh.care.gone) zh.care.gone(p); delete zh.live[p.id]; refreshInter(); }
function refreshInter() {
  const W = VR.world, base = (W.interactives || []).filter(i => !i.zh), mine = Object.keys(zh.live).map(k => zh.live[k].it).filter(Boolean); W.setInteractives(base.concat(mine));
}
const petCenter = p => ({ x: p.x, y: p.y + p.D.h * 0.45, z: p.z });
function nearestPet(a, extra) {
  let best = null, bd = 1e9; for (const k in zh.live) { const p = zh.live[k]; if (p.state !== 'idle' && p.state !== 'fall') continue; const c = petCenter(p), d = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z); if (d < p.D.grab + (extra || 0) && d < bd) { bd = d; best = p; } }
  return best;
}
// ---------- tocar no bicho: 1ª vez pede o nome; depois abre o menu ----------
let lastTap = 0;
function tapPet(p) {
  if (!p || p.state !== 'idle' || performance.now() - lastTap < 350) return; lastTap = performance.now();
  if (zh.care && zh.care.touch) zh.care.touch(p);
  voice(p); p.joy = 0.8; p.squash = 0.5; p.e.s.j = clampS(p.e.s.j + 3);
  if (!p.e.name) askName(p); else openMenu(p);
}
function rayTap(p) { for (const s of zh.hands) if (s.vis && s.on) { const c = petCenter(p); if (Math.hypot(s.anchor.x - c.x, s.anchor.y - c.y, s.anchor.z - c.z) < p.D.grab + 0.25) return; } tapPet(p); }   // mão perto: a pinça de perto cuida (toque ou pegar)

// ---------- nome ----------
const nm = { p: null, name: '' };
function askName(p) {
  p.nameOpen = true; nm.p = p; closeMenu();
  const fn = v => { v = String(v || '').trim().slice(0, 14); if (!v) { toast('Digite um nome para continuar'); askName(p); return; } nm.name = v; ui.place(nome, 1.2, 0.08, 0); nome.rebuild(); ui.show(nome, true); };
  if (VR.kb) VR.kb.open({ label: 'Dê um nome ao ' + KINDS[p.kind].nome.toLowerCase(), value: '', max: 14, onEnter: fn });
  else { let v = ''; try { v = prompt('Nome do ' + KINDS[p.kind].nome.toLowerCase() + ':', '') || ''; } catch (e) {} fn(v); }
}
const nome = ui.panel({ id: 'znome', mw: 0.9, mh: 0.5, title: 'Confirmar nome', titleIcon: 'paw', dist: 1.2, dy: 0.08, order: 11,
  extra(g, p) { if (!nm.p) return; ui.text(g, 'Chamar seu ' + KINDS[nm.p.kind].nome.toLowerCase() + ' de', p.W / 2, 132, 26, C.dim, 'center'); ui.text(g, '“' + nm.name + '”', p.W / 2, 190, 46, '#fff', 'center', 700); },
  build() { return [
    { t: 'button', x: 24, y: 252, w: 282, h: 80, label: 'Confirmar', style: 'primary', chev: false, onClick: () => { const p = nm.p; if (!p) return; p.e.name = nm.name; p.nameOpen = false; p.joy = 2.2; p.squash = 0.6; save(); ui.show(nome, false); nm.p = null; pop(); voice(p); fx('heart', p.x, p.y + p.D.h + 0.1, p.z, 5); toast('Agora ele se chama ' + p.e.name + '!'); } },
    { t: 'button', x: 324, y: 252, w: 282, h: 80, label: 'Mudar', chev: false, onClick: () => { const p = nm.p; ui.show(nome, false); if (p) askName(p); } }]; } });

// ---------- menu do bicho ----------
let mpet = null;
const menu = ui.panel({ id: 'zmenu', mw: 0.9, mh: 1.15, title: '', titleIcon: 'paw', dist: 1.2, dy: 0.02, order: 11,
  extra(g, p) {
    if (p.confirm && mpet) { ui.text(g, 'Você recebe ' + money(Math.round(KINDS[mpet.kind].preco * SELL_K)), p.W / 2, 190, 28, C.dim, 'center'); }
    else if (mpet && mpet.e.s) { const m = moodOf(mpet.e.s); ui.text(g, m[0], 28, 94, 26, m[1], 'left', 700); if (mpet.cs && mpet.cs.sleeping) ui.text(g, 'dormindo 💤', p.W - 28, 94, 24, C.dim, 'right', 600); }
  },
  build(p) {
    const q = mpet; if (!q) return [];
    if (p.confirm) {
      const val = Math.round(KINDS[q.kind].preco * SELL_K);
      return [{ t: 'text', x: 315, y: 118, w: 582, h: 60, label: 'Vender ' + (q.e.name || KINDS[q.kind].nome) + '?', size: 38, weight: 700, align: 'center' },
        { t: 'button', x: 24, y: 250, w: 582, h: 90, label: 'Sim, vender por ' + money(val), style: 'danger', icon: 'bag', chev: false, onClick: () => sellPet(q) },
        { t: 'button', x: 24, y: 352, w: 582, h: 90, label: 'Não, ficar com ele', chev: false, onClick: () => { p.confirm = false; p.rebuild(); } }];
    }
    return [
      { t: 'zbar', x: 24, y: 118, w: 582, h: 52, label: 'Fome', color: '#ffa94d', get: () => q.e.s.h },
      { t: 'zbar', x: 24, y: 172, w: 582, h: 52, label: 'Sede', color: '#4aa3ff', get: () => q.e.s.t },
      { t: 'zbar', x: 24, y: 226, w: 582, h: 52, label: 'Energia', color: '#a58bff', get: () => q.e.s.en },
      { t: 'zbar', x: 24, y: 280, w: 582, h: 52, label: 'Felicidade', color: '#ff7ab0', get: () => q.e.s.j },
      { t: 'choice', x: 24, y: 346, w: 582, h: 122, label: 'Comportamento', sub: 'como ele age', opts: [['free', 'Livre'], ['sit', 'Sentado'], ['follow', 'Seguir']], get: () => q.e.mode, set: v => setMode(q, v) },
      { t: 'choice', x: 24, y: 478, w: 582, h: 122, label: 'Cor da coleira', sub: nameOf(COLLARS, q.e.collar), opts: COLLARS, swatch: true, rebuild: true, get: () => q.e.collar, set: v => { q.e.collar = v; q.collarMat.color.setHex(hexNum(hexOf(COLLARS, v))); save(); } },
      { t: 'button', x: 24, y: 610, w: 582, h: 80, label: 'Vender · ' + money(Math.round(KINDS[q.kind].preco * SELL_K)), style: 'danger', icon: 'bag', chev: false, onClick: () => { p.confirm = true; p.rebuild(); } },
      { t: 'button', x: 24, y: 700, w: 582, h: 80, label: 'Fechar', icon: 'close', chev: false, onClick: () => closeMenu() }];
  } });
function openMenu(p) {
  if (mpet && mpet !== p) mpet.menu = false; mpet = p; p.menu = true; menu.confirm = false; menu.title = p.e.name || KINDS[p.kind].nome; ui.place(menu, 1.2, 0.02, 0); menu.rebuild(); ui.show(menu, true);
}
function closeMenu() { if (mpet) { mpet.menu = false; mpet = null; } if (menu.vis) ui.show(menu, false); }
function setMode(p, v) {
  p.e.mode = v; p.tgt = null; p.act = 'stand'; p.actT = 1; p.idleT = 0; save(); ui.sfx(900, 0.05);
  toast(v === 'sit' ? (p.e.name || 'Ele') + ' vai ficar sentado' : v === 'follow' ? (p.e.name || 'Ele') + ' vai te seguir' : (p.e.name || 'Ele') + ' está livre', 2200);
}
function sellPet(p) {
  const val = Math.round(KINDS[p.kind].preco * SELL_K); st.money += val; st.pets = st.pets.filter(e => e !== p.e && e.id !== p.id); save(); closeMenu(); shop.dirty = true;
  p.state = 'gone'; p.t = 0; fx('star', p.x, p.y + p.D.h * 0.5, p.z, 12, { spread: 0.9 }); ui.sfx(660, 0.12); ui.sfx(990, 0.15); toast('Vendido por ' + money(val));
}

// ---------- comportamento ----------
function idleAI(p, dt) {
  const e = p.e, dx = PL.x - p.x, dz = PL.z - p.z, dist = Math.hypot(dx, dz), lvlOK = HS.cur.lvl === 'down';
  p.petT = Math.max(0, p.petT - dt); p.joy = Math.max(0, p.joy - dt);
  let walk = false, speed = 0, tx = 0, tz = 0, face = null, sit = 0, ghost = false, cp = null;
  const run = p.kind === 'dog' ? 2.4 : 2.0, wlk = p.kind === 'dog' ? 0.95 : 0.75;
  if (p.menu || p.nameOpen || p.petT > 0) { face = dist < 6 ? Math.atan2(dx, dz) : null; sit = p.menu && e.mode === 'sit' ? 1 : 0; p.idleT = 0; if (zh.care && zh.care.touch) zh.care.touch(p); }
  else if (zh.care && (cp = zh.care.plan(p, dt, { dist, dx, dz, run, wlk, lvlOK }))) {
    walk = !!cp.walk; tx = cp.tx; tz = cp.tz; speed = cp.speed || wlk; face = cp.face === undefined ? null : cp.face; ghost = !!cp.ghost; p.idleT = 0; p.act = 'stand'; p.tgt = null;
  }
  else if (e.mode === 'sit') { sit = 1; if (dist < 5) face = Math.atan2(dx, dz); }
  else if (e.mode === 'follow') {
    if (!lvlOK) sit = 1;
    else if (dist > 14) { const f = findFree(PL.x, PL.z, 2.5); if (f) { fx('star', p.x, p.y + 0.3, p.z, 6); p.x = f.x; p.z = f.z; fx('star', p.x, p.y + 0.3, p.z, 6); } }
    else if (dist > 1.7) { walk = true; const k = 1.0 / dist; tx = PL.x - dx * k; tz = PL.z - dz * k; speed = dist > 4.5 ? run : wlk * 1.15; p.idleT = 0; }
    else { p.idleT += dt; if (dist < 6) face = Math.atan2(dx, dz); if (p.idleT > 2.5) sit = 1; }
  } else {
    p.actT -= dt;
    if (p.actT <= 0) {
      const r = Math.random();
      if (r < 0.5) { for (let i = 0; i < 8 && !p.tgt; i++) { const a = rnd(0, PI * 2), d = rnd(1, 3.5), nx = p.x + Math.cos(a) * d, nz = p.z + Math.sin(a) * d; if (okPos(nx, nz)) p.tgt = { x: nx, z: nz }; } if (p.tgt) { p.act = 'walk'; p.actT = 12; } else { p.act = 'stand'; p.actT = 1.5; } }
      else if (r < 0.72) { p.act = 'sit'; p.actT = rnd(3, 8); p.tgt = null; }
      else if (r < 0.86) { p.act = 'sniff'; p.actT = rnd(1.5, 3); p.tgt = null; }
      else { p.act = 'stand'; p.actT = rnd(2, 4); p.tgt = null; }
    }
    if (p.act === 'walk' && p.tgt) { if (Math.hypot(p.tgt.x - p.x, p.tgt.z - p.z) < 0.25) { p.tgt = null; p.act = 'stand'; p.actT = rnd(1, 3); } else { walk = true; tx = p.tgt.x; tz = p.tgt.z; speed = wlk; } }
    else if (p.act === 'sit') sit = 1;
    if (!walk && dist < 4 && p.act !== 'sniff') face = Math.atan2(dx, dz);
  }
  p.sniff = p.act === 'sniff' && !p.menu && e.mode === 'free' && !cp ? 1 : 0;
  p.wantSit = walk || p.lieW > 0.5 || p.eatW > 0.5 ? 0 : sit;
  if (walk) {
    const ang = Math.atan2(tx - p.x, tz - p.z); p.yaw += wrapA(ang - p.yaw) * Math.min(1, 7 * dt);
    const al = Math.max(0, Math.cos(wrapA(ang - p.yaw))), sp = speed * (0.25 + 0.75 * al);
    if (ghost) { p.x += Math.sin(p.yaw) * sp * dt; p.z += Math.cos(p.yaw) * sp * dt; p.stuck = 0; }
    else if (!tryMove(p, Math.sin(p.yaw) * sp * dt, Math.cos(p.yaw) * sp * dt)) { p.stuck += dt; if (p.stuck > 0.6) { p.tgt = null; p.act = 'stand'; p.actT = rnd(0.5, 1.5); p.stuck = 0; if (e.mode === 'follow') { const f = findFree(PL.x, PL.z, 2.5); if (f && Math.hypot(PL.x - p.x, PL.z - p.z) > 6) { p.x = f.x; p.z = f.z; } } } } else p.stuck = 0;
    p.vcur += (sp - p.vcur) * damp(8, dt);
  } else p.vcur += (0 - p.vcur) * damp(8, dt);
  if (face !== null && !walk) p.yaw += wrapA(face - p.yaw) * Math.min(1, 4 * dt);
  if (dist < 0.4 && dist > 0.001) tryMove(p, -dx / dist * 0.8 * dt, -dz / dist * 0.8 * dt);                   // não fica dentro de você
  const fy = floorAt(p); p.y += (fy + p.floorAdd - p.y) * damp(14, dt); if (zinfo(p.x, p.z)) p.lastGood = { x: p.x, z: p.z };
}
function airTick(p, dt) {                                                                                          // caindo (solto da mão) ou saindo da caixa
  p.vy -= 9.8 * dt; p.y += p.vy * dt; const nx = p.x + p.vx * dt;
  if (okPos(nx, p.z + p.vz * dt) || p.state === 'pop') { p.x = nx; p.z += p.vz * dt; } else { p.vx *= 0.3; p.vz *= 0.3; }
  p.vx *= 1 - 0.8 * dt; p.vz *= 1 - 0.8 * dt;
  if (p.state === 'pop') p.sc = 0.35 + 0.65 * Math.min(1, p.t / 0.35);
  const fy = floorAt(p);
  if (p.y <= fy && p.vy < 0) {
    p.y = fy; p.vy = 0; p.vx = p.vz = 0; p.sc = 1; p.squash = 1; land();
    if (!okPos(p.x, p.z)) { const f = findFree(p.x, p.z, 4) || p.lastGood; if (f) { p.x = f.x; p.z = f.z; } }
    if (p.state === 'pop') p.joy = 1.2;
    p.state = 'idle'; p.act = 'stand'; p.actT = rnd(1, 2);
  }
}
function updPet(p, dt, t) {
  const D = p.D; p.t += dt;
  if (p.state === 'gone') { p.sc = Math.max(0.001, 1 - p.t / 0.5); if (p.t >= 0.5) { removePet(p); return; } }
  else if (p.state === 'pop' || p.state === 'fall') airTick(p, dt);
  else if (p.state === 'held') { /* a posição vem da mão (handsTick) */ }
  else idleAI(p, dt);
  if (p.state !== 'held' && p.state !== 'gone') {
    p.happy += ((p.caress > 0.3 || p.joy > 0 ? 1 : 0) - p.happy) * damp(5, dt);
    p.caress = Math.max(0, p.caress - dt * 0.35);
  } else p.happy += (0 - p.happy) * damp(5, dt);
  if (p.happy > 0.5 && p.state === 'idle') { p.heartT -= dt; if (p.heartT <= 0) { p.heartT = rnd(0.5, 0.9); fx('heart', p.x, p.y + D.h + 0.05, p.z, 1); } }
  if (p.state !== 'gone') { statTick(p, dt); needBubble(p, dt, t); }
  poseApply(p, dt, t);
}
const bubTex = {};
function bubTexture(ch) {
  if (bubTex[ch]) return bubTex[ch]; const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.94)'; g.beginPath(); g.arc(48, 44, 38, 0, 7); g.fill(); g.beginPath(); g.moveTo(34, 76); g.lineTo(48, 94); g.lineTo(58, 74); g.fill();
  g.font = '44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 48, 46);
  const tx = new T.CanvasTexture(c); if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace; return bubTex[ch] = tx;
}
function needBubble(p, dt, t) {
  const s = p.e.s, sl = !!(p.cs && p.cs.sleeping); let ch = '';
  if (!sl && p.state === 'idle' && !p.menu && !p.nameOpen) ch = s.h < 25 ? '🍖' : s.t < 25 ? '💧' : s.en < 18 ? '💤' : '';
  p.bubK += ((ch ? 1 : 0) - p.bubK) * damp(8, dt);
  if (ch && !p.bub) { p.bub = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false, fog: false })); p.bub.scale.setScalar(0.01); grp.add(p.bub); }
  if (!p.bub) return;
  if (ch && p.bub.userData.ch !== ch) { p.bub.userData.ch = ch; p.bub.material.map = bubTexture(ch); p.bub.material.needsUpdate = true; }
  p.bub.visible = p.bubK > 0.03; const k = 0.2 * p.bubK; p.bub.scale.set(k, k, 1); p.bub.position.set(p.x, p.y + p.D.h + 0.22 + Math.sin(t * 3) * 0.015, p.z);
}
function poseApply(p, dt, t) {
  const D = p.D, sit = p.sit += (p.wantSit - p.sit) * damp(6, dt), wk = clamp(p.vcur / (p.kind === 'dog' ? 1.0 : 0.8), 0, 1.6);
  const E = p.eat += (p.eatW - p.eat) * damp(7, dt), L = p.lie += (p.lieW - p.lie) * damp(4, dt);
  p.phase += p.vcur * dt * (p.kind === 'dog' ? 9 : 11); p.squash = Math.max(0, p.squash - dt * 3);
  const sw = Math.sin(p.phase) * 0.7 * Math.min(1, wk), [fl, fr, rl, rr] = p.legs, held = p.state === 'held', air = p.state === 'fall' || p.state === 'pop';
  let a1 = sw, a2 = -sw, a3 = -sw, a4 = sw;
  if (held) { const w = Math.sin(t * 9) * 0.25; a1 = 0.45 + w; a2 = 0.45 - w; a3 = -0.3 - w; a4 = -0.3 + w; } else if (air) { a1 = a2 = -0.5; a3 = a4 = 0.6; }
  const sm = (1 - sit * 0.8) * (1 - L); fl.rotation.x = a1 * sm - 1.35 * L; fr.rotation.x = a2 * sm - 1.35 * L; rl.rotation.x = a3 * sm - 1.25 * sit + 1.1 * L; rr.rotation.x = a4 * sm - 1.25 * sit + 1.1 * L;
  const fLift = Math.sin(0.45) * D.bl * 0.5 - D.lh * 0.5; fl.position.y = fr.position.y = D.lh + fLift * sit - D.lh * 0.8 * L; fl.scale.y = fr.scale.y = (1 + (fLift / D.lh) * sit) * (1 - 0.45 * L);
  rl.position.y = rr.position.y = D.lh - D.lh * 0.5 * sit - D.lh * 0.8 * L; rl.scale.y = rr.scale.y = (1 - 0.3 * sit) * (1 - 0.45 * L);
  const breathe = Math.sin(t * (L > 0.5 ? 1.5 : 2.2) + p.id) * (0.004 + 0.004 * L);
  p.body.position.y = p.bodyY + Math.abs(Math.sin(p.phase)) * 0.012 * Math.min(1, wk) - D.lh * 0.5 * sit - D.lh * 0.8 * L - D.lh * 0.22 * E + breathe - p.happy * 0.012; p.body.rotation.x = -0.45 * sit + 0.3 * E;
  // cabeça: olha para você, fareja, levanta o focinho no carinho
  const dx = PL.x - p.x, dz = PL.z - p.z, dist = Math.hypot(dx, dz), ang = wrapA(Math.atan2(dx, dz) - p.yaw);
  const ly = p.state === 'idle' && p.vcur < 0.2 && dist < 5 && Math.abs(ang) < 2.2 && L < 0.1 && E < 0.1 ? clamp(ang, -0.8, 0.8) : 0;
  p.head.rotation.y += ((ly + (p.id % 2 ? 0.55 : -0.55) * L) - p.head.rotation.y) * damp(6, dt);
  const lx = (p.sniff ? 0.6 : 0) - 0.25 * sit - 0.35 * p.happy + (held ? 0.2 : 0) + 0.45 * L + E * (0.7 + Math.sin(t * p.eatF) * 0.12); p.head.rotation.x += (lx - p.head.rotation.x) * damp(7, dt);
  const wf = p.happy > 0.3 ? 15 : E > 0.5 ? 8 : p.state === 'idle' && dist < 4 ? 6 : 2, amp = ((p.kind === 'dog' ? 0.3 : 0.15) + (p.kind === 'dog' ? 0.55 : 0.3) * p.happy) * (1 - 0.9 * L);
  p.tail.rotation.z = Math.sin(t * wf + p.id) * amp; p.tail.rotation.x = (p.kind === 'dog' ? -0.85 : -0.3) + (held ? 0.9 : 0) + 0.15 * sit;
  p.blink -= dt; if (p.blink < 0) { p.blinkK = 1; p.blink = rnd(2.5, 5); } p.blinkK = Math.max(0, p.blinkK - dt * 8);
  const ey = Math.max(0.1, 1 - Math.max(p.blinkK * 0.9, p.happy * 0.85, L * 0.97)); p.eyes.forEach(e => { e.scale.y = 0.018 * ey; });
  const sq = p.squash, s = p.sc; p.root.position.set(p.x, p.y, p.z); p.root.rotation.y = p.yaw; p.root.scale.set(s * (1 + 0.15 * sq), s * (1 - 0.25 * sq), s * (1 + 0.15 * sq));
  p.shadow.position.y = (p.lastFloor + (p.floorAdd || 0) - p.y) / Math.max(s, 0.1) + 0.02; p.shadow.material.opacity = 0.28 * clamp(1 - (p.y - p.lastFloor) * 0.8, 0.1, 1);
}

// ====================================================== MÃOS: tocar, pegar com a pinça e fazer carinho ======================================================
const _a = new T.Vector3(), _b = new T.Vector3(), _p = new T.Vector3();
const hst = [0, 1].map(() => ({ cand: null, held: null, pp: new T.Vector3(), pv: new T.Vector3(), has: false, pinch: false, spd: 0, purrT: 0 }));
function grabPet(p, h, s) {
  if (zh.care && zh.care.touch) zh.care.touch(p);
  p.state = 'held'; p.hold = h; hst[h].held = p; hst[h].cand = null; if (p.menu) closeMenu(); p.act = 'stand'; p.tgt = null; p.nameOpen = false; s.busy = true; ui.sfx(700, 0.06);
  if (Math.random() < 0.5) voice(p);
}
function dropPet(p, s) {
  const st_ = hst[p.hold]; if (st_) st_.held = null; p.hold = null; p.state = 'fall'; p.vy = clamp((s && s.vel ? s.vel.y : 0) * 0.5, -1, 2); p.vx = clamp((s && s.vel ? s.vel.x : 0) * 0.5, -2, 2); p.vz = clamp((s && s.vel ? s.vel.z : 0) * 0.5, -2, 2); p.act = 'stand'; p.actT = 1.5;
}
function handsTick(dt) {
  for (let h = 0; h < 2; h++) {
    const s = zh.hands[h], k = hst[h]; if (!s) continue;
    if (!(s.vis && s.on)) { if (k.held) dropPet(k.held, s); k.cand = null; k.has = false; k.pinch = false; continue; }
    if (s.palmW) _p.copy(s.palmW); else { VR.toWorld(_a, s.P[0]); VR.toWorld(_b, s.P[9]); _p.copy(_a).add(_b).multiplyScalar(0.5); }
    if (k.has) k.pv.copy(_p).sub(k.pp).multiplyScalar(1 / Math.max(dt, 1 / 120)); else k.pv.set(0, 0, 0); k.pp.copy(_p); k.has = true;
    const pinch = !!s.pinch, rise = pinch && !k.pinch; k.pinch = pinch;
    if (k.held) {                                                                                                   // carregando: o bicho fica pendurado na pinça
      if (!pinch) { dropPet(k.held, s); }
      else { const p = k.held, a = s.anchor, f = damp(14, dt); s.busy = true; p.x += (a.x - p.x) * f; p.z += (a.z - p.z) * f; p.y += (a.y - p.D.h * 0.55 - p.y) * f;
        p.x = clamp(p.x, FENCE.x0, FENCE.x1); p.z = clamp(p.z, FENCE.z0, FENCE.z1); floorAt(p); p.y = Math.max(p.y, p.lastFloor); p.yaw += wrapA(Math.atan2(PL.x - p.x, PL.z - p.z) - p.yaw) * Math.min(1, 2 * dt); }
      continue;
    }
    if (rise && !s.held && !s.uiHover && !s.busy) { const p = nearestPet(s.anchor, 0); if (p && p.state === 'idle') { k.cand = { p, t: 0, a0: s.anchor.clone() }; s.busy = true; } }
    if (k.cand) {
      const c = k.cand; if (!pinch) { k.cand = null; tapPet(c.p); }
      else { s.busy = true; c.t += dt; if (c.p.state !== 'idle') k.cand = null; else if (c.t > 0.28 || s.anchor.distanceTo(c.a0) > 0.07) grabPet(c.p, h, s); }
      continue;
    }
    // carinho: mão aberta passando por cima do bicho
    if (pinch || s.fist || s.held || s.uiHover) continue;
    for (const id in zh.live) {
      const p = zh.live[id]; if (p.state !== 'idle') continue; const top = p.y + p.D.h;
      if (Math.hypot(_p.x - p.x, _p.z - p.z) < 0.34 && _p.y > top - 0.12 && _p.y < top + 0.3) {
        const sp = Math.hypot(k.pv.x, k.pv.z); k.spd += (sp - k.spd) * damp(10, dt);
        if (k.spd > 0.08) {
          p.caress = Math.min(1.5, p.caress + clamp(k.spd / 0.25, 0, 1) * dt * 1.3); p.petT = 1.2;
          if (p.caress > 0.3) { k.purrT -= dt; if (k.purrT <= 0) { k.purrT = 1.3; if (p.kind === 'cat') purr(1.2); else tone(900, 700, 0.12, 'sine', 0.05); } }
        }
        break;
      }
    }
  }
}

// ====================================================== LOOP ======================================================
let wasOn = false, saveT = 0, chkT = 0, barT = 0;
function processOrders() {
  const now = Date.now(), ready = st.orders.filter(o => o.due <= now); if (!ready.length) return;
  st.orders = st.orders.filter(o => o.due > now); ready.forEach(o => st.boxes.push({ id: st.nid++, kind: o.kind, color: o.color })); save(); shop.dirty = true;
  bell(); toast('Ding-dong! Caixa na porta: leve até o fundo do quintal', 6000);
}
function tick(dt, t) {
  processOrders();
  const on = !!HS.active && !S.pass; zh.on = on; grp.visible = on;
  if (!on) { if (wasOn) { wasOn = false; Object.keys(zh.boxes).forEach(id => dropBox(zh.boxes[id])); closeMenu(); if (VR.kb && VR.kb.isOpen() && nm.p) VR.kb.close(); if (nome.vis) ui.show(nome, false); hst.forEach(k => { k.held = null; k.cand = null; }); Object.keys(zh.live).forEach(id => { const p = zh.live[id]; if (p.state === 'held') p.state = 'idle'; }); } mark.visible = false; return; }
  wasOn = true;
  // caixas que ainda não estão no mundo (chegada, ou o cenário reiniciou)
  st.boxes.forEach((e, i) => { if (!zh.boxes[e.id]) spawnBox(e, i); });
  Object.keys(zh.boxes).forEach(id => { if (zh.boxes[id].state === 'closed' && !st.boxes.some(e => String(e.id) === id)) dropBox(zh.boxes[id]); });
  // bichos salvos que ainda não apareceram
  st.pets.forEach(e => { if (!zh.live[e.id]) spawnPet(e); });
  chkT += dt; if (chkT > 0.5) { chkT = 0; const W = VR.world; Object.keys(zh.live).forEach(id => { if ((W.interactives || []).indexOf(zh.live[id].it) < 0) { refreshInter(); } }); }
  handsTick(dt);
  Object.keys(zh.live).forEach(id => { const p = zh.live[id]; if (p) updPet(p, dt, t / 1000); });
  boxTick(dt); fxTick(dt);
  const any = Object.keys(zh.boxes).some(id => zh.boxes[id].state === 'closed'); mark.visible = any;
  if (any) { const a = mark.getObjectByName('arrow'); a.position.y = 1.1 + Math.sin(t / 300) * 0.12; mark.children[0].material.opacity = 0.45 + 0.3 * Math.sin(t / 250); mark.children[0].scale.setScalar(1 + 0.05 * Math.sin(t / 250)); }
  // menu: fecha se o bicho sumiu, foi pego ou você se afastou; nome: se o teclado fechou sem confirmar, solta o bicho
  if (mpet && (!menu.vis || mpet.state !== 'idle' || Math.hypot(PL.x - mpet.x, PL.z - mpet.z) > 7)) closeMenu();
  if (mpet && menu.vis && !menu.confirm) { barT += dt; if (barT > 0.4) { barT = 0; menu.dirty = true; } }                       // barras de status andando ao vivo
  if (nm.p && nm.p.nameOpen && !(VR.kb && VR.kb.isOpen()) && !nome.vis) { nm.p.nameOpen = false; nm.p = null; }
  if (nm.p && !nome.vis && nm.p.nameOpen === false) nm.p = null;
  saveT += dt; if (saveT > 5) { saveT = 0; let ch = false; Object.keys(zh.live).forEach(id => { const p = zh.live[id]; if (p.state === 'idle' && (Math.abs(p.e.x - p.x) > 0.05 || Math.abs(p.e.z - p.z) > 0.05)) { p.e.x = +p.x.toFixed(2); p.e.z = +p.z.toFixed(2); ch = true; } }); if (ch) save(); }
}
VR.hook(29, tick);
addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

// ---------- ganchos para testes ----------
zh.buy = buy; zh.tap = id => tapPet(zh.live[id]); zh.openBox = id => zh.boxes[id] && openBox(zh.boxes[id]); zh.tick = tick; zh.openMenu = id => openMenu(zh.live[id]); zh.sell = id => sellPet(zh.live[id]);
zh.reset = () => { Object.keys(zh.boxes).forEach(id => dropBox(zh.boxes[id])); Object.keys(zh.live).forEach(id => removePet(zh.live[id])); st = { money: 5000, pets: [], orders: [], boxes: [], nid: 1 }; save(); closeMenu(); };
zh.okPos = okPos; zh.fx = fx; zh.hst = hst; zh.YARD = YARD; zh.menu = menu; zh.nome = nome; zh.shop = shop; zh.nm = nm;
})();
