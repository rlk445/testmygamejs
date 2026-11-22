/* Clube noturno "VELVET ROSE", a leste do mercado (depois do estacionamento, x = 118 a 146).
   Por fora: fachada com letreiro de neon, toldo, tapete vermelho com cordas e segurança na porta.
   Por dentro (escuro, com luzes que pulsam no ritmo da música): pista de dança com piso de LED e globo de espelhos, balcão do bar com banquetas,
   prateleiras de garrafas e cardápio, palco com 2 mastros (pole dance) e passarela, camarotes com sofás, fileira de cadeiras junto à passarela,
   telão, caixas de som que pulsam, raios laser e feixes de luz giratórios.
   Elenco (NPCs): barman (faz os drinks), garçons com bandeja, seguranças, clientes sentados/no balcão/dançando, e 3 dançarinas de figurino de show.
   Bebidas: clique numa garrafa do balcão, o barman prepara e o copo aparece no balcão; clique no copo para beber.
   Música: assets/clube/playlist.json lista os arquivos (mp3/m4a) da pasta assets/clube/. Sem músicas, toca uma batida eletrônica gerada na hora.
   O painel na parede do fundo (perto do bar) controla: anterior, pausa, próxima, volume e "+" (escolher músicas do aparelho).
   Depende de house.js (H.*), npc.js (npc.api, npc.spawn). Mesmo padrão da praça (praca.js). */
(() => {
'use strict';
const VR = window.VR, T = VR.T, H = VR.house, PL = VR.PL, damp = VR.damp, clamp = VR.clamp, npc = VR.npc, A = npc && npc.api;
if (!H || !A) return;
const PI = Math.PI, TAU = PI * 2, YG = H.YG;
const cl = VR.clube = { built: false, spawned: false, group: null, beat: 0, orders: [], glasses: [], dancers: [], poses: [] };
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], c01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const sfx = (f, d, v) => { try { VR.ui.sfx(f, d, v); } catch (e) {} };
const toast = m => { try { VR.ui.toast(m, 2400); } catch (e) {} };
const lm = H.lm, own = H.own;

// ====================================================== LAYOUT ======================================================
// prédio: x 118..146, z -34..-5 (porta na parede oeste, de frente para o mercado). y é relativo ao piso interno (FL).
const X0 = 118, X1 = 146, Z0 = -34, Z1 = -5, WH = 4.2, DZ = -19.5, DW = 2.6;
const IX0 = X0 + 0.15, IX1 = X1 - 0.15, IZ0 = Z0 + 0.15, IZ1 = Z1 - 0.15;      // faces internas das paredes
const FL = YG + 0.09, LT = YG + 0.052, FS = FL + 0.6, CXc = 132, CZc = -19.5;
const STG = { x0: 137.2, x1: IX1, z0: -27, z1: -11 }, RUN = { x0: 129, x1: 137.2, z0: -20.6, z1: -17.4 };
const POLES = [[141, -22.3], [141, -15.7]];
const FLOOR_LED = { x0: 121, cols: 6, z0: -25, rows: 11 };
const DRINKS = [
  { n: 'Caipirinha', col: 0xb8e04a, glass: 'tall' }, { n: 'Cerveja gelada', col: 0xe8a825, glass: 'mug' }, { n: 'Whisky', col: 0xb8601a, glass: 'tumbler' },
  { n: 'Drink azul', col: 0x2aa8ff, glass: 'cone' }, { n: 'Champanhe', col: 0xf3dc8a, glass: 'flute' }];

// onde se anda: o interior vem antes do estacionamento (vale sobre ele)
H.ZY.clube = FL; H.AMB.clube = 0.4; H.ZY.clubelot = YG + 0.05; H.AMB.clubelot = 1;
H.zn('clube', 'down', IX0 + 0.1, IX1 - 0.1, IZ0 + 0.1, IZ1 - 0.1);
H.zn('clubelot', 'down', 111.5, 152, -36.5, -2.5);
const ob = (x0, x1, z0, z1) => H.ob('down', x0, x1, z0, z1);
// paredes (com o vão da porta)
ob(X0 - 0.15, X0 + 0.15, Z0 - 0.15, DZ - DW / 2); ob(X0 - 0.15, X0 + 0.15, DZ + DW / 2, Z1 + 0.15);
ob(X0 - 0.15, X1 + 0.15, Z0 - 0.15, Z0 + 0.15); ob(X0 - 0.15, X1 + 0.15, Z1 - 0.15, Z1 + 0.15); ob(X1 - 0.15, X1 + 0.15, Z0 - 0.15, Z1 + 0.15);
// móveis
ob(123.2, 137.8, -33.9, -30.5);                                             // balcão + corredor do barman
ob(STG.x0 - 0.2, IX1, STG.z0 - 0.2, STG.z1 + 0.2);                          // palco
ob(RUN.x0 - 1.7, STG.x0, RUN.z0 - 0.2, RUN.z1 + 0.2);                      // passarela
[127, 132, 137].forEach(x => ob(x - 1.7, x + 1.7, -9.0, -5.2));            // camarotes
ob(129.8, 136.6, -16.9, -15.9); ob(129.8, 136.6, -22.1, -21.1);            // cadeiras junto à passarela
ob(118.3, 119.1, -27.2, -25.8); ob(118.3, 119.1, -13.2, -11.8);            // caixas de som
ob(119.3, 124.2, -33.9, -33.0);                                             // painel de música
VR.hook(12, () => { if (!H.active || !VR.bounds) return; const b = VR.bounds; if (b.x1 < 153) VR.bounds = { x0: b.x0, x1: 153, z0: b.z0, z1: b.z1 }; });

// ====================================================== UTILIDADES ======================================================
let grp = null, B = null;
const M = {}, NEON = [], BEAMS = [], SPK = [], BOTS = [];
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; };
const ctex = c => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
const nm = (() => { const c = {}; return col => c[col] || (c[col] = new T.MeshBasicMaterial({ color: col })); })();
const neon = (ph, s, l) => { const m = new T.MeshBasicMaterial({ color: 0xff3fa8 }); NEON.push({ m, ph, s: s == null ? 1 : s, l: l == null ? 0.55 : l }); return m; };
const bx = (x0, x1, y0, y1, z0, z1, m) => B.box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, FL + (y0 + y1) / 2, (z0 + z1) / 2, m);
const cyY = (r0, r1, y0, y1, x, z, m, seg) => B.cyl(r0, r1, y1 - y0, x, FL + (y0 + y1) / 2, z, m, seg || 12);
const inter = (meshes, fn) => H.inter(meshes, fn, ['clube']);
const hit = (par, w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), own(0xffffff, { transparent: true, opacity: 0, depthWrite: false })); m.position.set(x, y, z); par.add(m); return m; };
const rrect = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
function neonTex(txt, sub, w, h, col, col2) {
  const k = cv(w, h), g = k.g; g.fillStyle = '#0b0510'; g.fillRect(0, 0, w, h);
  g.strokeStyle = col; g.lineWidth = 7; g.shadowColor = col; g.shadowBlur = 22; rrect(g, 10, 10, w - 20, h - 20, 22); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = Math.round(h * (sub ? 0.5 : 0.62)); g.font = '800 ' + fs + 'px Arial, sans-serif'; while (g.measureText(txt).width > w - 70 && fs > 14) { fs -= 4; g.font = '800 ' + fs + 'px Arial, sans-serif'; }
  g.fillStyle = '#fff'; g.shadowColor = col; g.shadowBlur = 26; g.fillText(txt, w / 2, sub ? h * 0.40 : h / 2);
  if (sub) { g.font = '700 ' + Math.round(h * 0.17) + 'px Arial, sans-serif'; g.fillStyle = col2 || '#ffd0ee'; g.shadowColor = col2 || col; g.shadowBlur = 12; g.fillText(sub, w / 2, h * 0.78); }
  return ctex(k.c);
}
const sgn = (tex, w, h, x, y, z, ry, dbl) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, side: dbl ? T.DoubleSide : T.FrontSide })); m.position.set(x, y, z); m.rotation.y = ry || 0; grp.add(m); return m; };
const glowTex = (() => { let t = null; return () => { if (t) return t; const k = cv(64, 64), g = k.g, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return t = ctex(k.c); }; })();
const dark = () => (VR.sky ? VR.sky.cfg.dark : 0);

// ====================================================== MÚSICA ======================================================
const mus = cl.mus = { ctx: null, list: [], idx: -1, playing: false, paused: false, vol: 0.85, title: '', synth: false, src: null, tok: 0, loaded: false, loading: false, cur: null, bins: null, avg: 0, level: 0, cd: 0, clk: 0, lastBeat: -1, nextT: 0, step: 0, timer: 0, noise: null, dirty: true };
function ctxGet() {
  if (mus.ctx) return mus.ctx; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { mus.ctx = new AC(); } catch (e) { return null; } const c = mus.ctx;
  mus.bus = c.createGain(); mus.an = c.createAnalyser(); mus.an.fftSize = 256; mus.an.smoothingTimeConstant = 0.55;
  mus.lp = c.createBiquadFilter(); mus.lp.type = 'lowpass'; mus.lp.frequency.value = 600; mus.gain = c.createGain(); mus.gain.gain.value = 0;
  mus.bus.connect(mus.an); mus.an.connect(mus.lp); mus.lp.connect(mus.gain); mus.gain.connect(c.destination); mus.bins = new Uint8Array(mus.an.frequencyBinCount);
  return c;
}
['click', 'touchend', 'pointerup', 'keydown'].forEach(ev => addEventListener(ev, () => { const c = mus.ctx; if (c && c.state === 'suspended') c.resume().catch(() => {}); }, { passive: true }));
try { ctxGet(); } catch (e) {}                                              // criado já no carregamento: o toque em "Iniciar" libera o som
function loadList(cb) {
  if (mus.loaded) { cb(); return; } if (mus.loading) { mus.waiters.push(cb); return; } mus.loading = true; mus.waiters = [cb];
  const done = l => { mus.list = mus.list.concat((Array.isArray(l) ? l : []).map(s => typeof s === 'string' ? { file: s, title: s.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ') } : s).filter(x => x && x.file)); mus.loaded = true; mus.loading = false; mus.waiters.forEach(f => f()); mus.waiters = []; mus.dirty = true; };
  try { fetch('assets/clube/playlist.json?' + Date.now()).then(r => r.ok ? r.json() : []).catch(() => []).then(done); } catch (e) { done([]); }
}
function getBuf(it) {
  if (mus.cur && mus.cur.it === it) return Promise.resolve(mus.cur.buf);
  const raw = it.blob ? it.blob.arrayBuffer() : fetch('assets/clube/' + encodeURIComponent(it.file)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
  return raw.then(ab => new Promise((ok, er) => mus.ctx.decodeAudioData(ab, ok, er))).then(buf => { mus.cur = { it, buf }; return buf; });
}
function stopSrc() { const s = mus.src; mus.src = null; if (s) { s.onended = null; try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} } }
function playTrack(i) {
  const c = mus.ctx; if (!c || !mus.list.length) return; synthOff(); const L = mus.list.length; mus.idx = ((i % L) + L) % L; const it = mus.list[mus.idx], tok = ++mus.tok; stopSrc(); mus.title = it.title; mus.dirty = true;
  getBuf(it).then(buf => {
    if (tok !== mus.tok || !mus.playing) return; const s = c.createBufferSource(); s.buffer = buf; s.connect(mus.bus);
    s.onended = () => { if (tok === mus.tok && mus.playing) playTrack(mus.idx + 1); }; s.start(); mus.src = s;
  }).catch(e => { VR.log('clube: não consegui tocar "' + it.title + '": ' + (e && e.message)); if (tok !== mus.tok) return; it.bad = true; if (mus.list.every(x => x.bad)) { mus.title = 'Batida da casa'; synthOn(); } else playTrack(mus.idx + 1); });
}
function musicOn() {
  if (mus.playing || mus.paused) return; const c = ctxGet(); if (!c) return; mus.playing = true; if (c.state === 'suspended') c.resume().catch(() => {});
  loadList(() => { if (!mus.playing) return; if (mus.list.length && !mus.list.every(x => x.bad)) playTrack(mus.idx < 0 ? 0 : mus.idx); else { mus.title = 'Batida da casa'; synthOn(); } mus.dirty = true; });
}
function musicOff() { mus.playing = false; mus.tok++; stopSrc(); synthOff(); }
// ---- batida eletrônica de reserva (124 bpm), tocada quando não há músicas na pasta
const BASSL = [55, 55, 0, 55, 0, 55, 82.4, 0, 55, 0, 55, 55, 0, 73.4, 0, 65.4], CHORD = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 293.7]];
function noiseBuf() { const c = mus.ctx; if (mus.noise) return mus.noise; const n = (c.sampleRate * 0.5) | 0, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return mus.noise = b; }
function env(node, t, a, d, v) { const g = mus.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); node.connect(g); g.connect(mus.bus); return g; }
function kick(t) { const c = mus.ctx, o = c.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(o, t, 0.003, 0.28, 0.95); o.start(t); o.stop(t + 0.34); }
function nz(t, type, f, dur, v) { const c = mus.ctx, s = c.createBufferSource(); s.buffer = noiseBuf(); const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; s.connect(fl); env(fl, t, 0.002, dur, v); s.start(t); s.stop(t + dur + 0.05); }
function bassN(t, f) { const c = mus.ctx, o = c.createOscillator(), fl = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(180, t + 0.18); o.connect(fl); env(fl, t, 0.005, 0.2, 0.34); o.start(t); o.stop(t + 0.26); }
function stab(t, ch) { const c = mus.ctx; ch.forEach((f, i) => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * (i % 2 ? 1.003 : 0.997); const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2400; o.connect(fl); env(fl, t, 0.004, 0.16, 0.07); o.start(t); o.stop(t + 0.22); }); }
function sched(s, t) {
  const b = s % 16, bar = (s >> 4) % 4; if (b % 4 === 0) kick(t); if (b === 4 || b === 12) nz(t, 'bandpass', 1700, 0.12, 0.5);
  if (b % 4 === 2) nz(t, 'highpass', 7000, 0.06, 0.22); else if (b % 2) nz(t, 'highpass', 8000, 0.03, 0.07);
  if (BASSL[b]) bassN(t, BASSL[b] * (bar === 2 ? 0.89 : 1)); if (b === 2 || b === 6 || b === 10 || b === 13) stab(t, CHORD[bar]);
}
function synthTick() { const c = mus.ctx; if (!c || !mus.synth || !mus.playing) return; if (mus.nextT < c.currentTime - 0.4) mus.nextT = c.currentTime + 0.05; while (mus.nextT < c.currentTime + 0.2) { sched(mus.step, mus.nextT); mus.nextT += 60 / 124 / 4; mus.step = (mus.step + 1) % 64; } }
function synthOn() { if (mus.synth || !mus.ctx) return; mus.synth = true; mus.nextT = mus.ctx.currentTime + 0.08; mus.step = 0; mus.timer = setInterval(synthTick, 40); mus.dirty = true; }
function synthOff() { mus.synth = false; if (mus.timer) { clearInterval(mus.timer); mus.timer = 0; } }
function pickFiles() {
  let inp = cl.inp;
  if (!inp) {
    inp = cl.inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*'; inp.multiple = true; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const fs = Array.prototype.slice.call(inp.files || []); if (!fs.length) return; const first = mus.list.length;
      fs.forEach(f => mus.list.push({ title: f.name.replace(/\.[^.]+$/, ''), blob: f })); toast('🎵 ' + fs.length + ' música(s) adicionada(s)'); mus.paused = false;
      if (mus.playing && (mus.synth || !mus.src)) { synthOff(); playTrack(first); } else if (!mus.playing) musicOn(); mus.dirty = true; inp.value = '';
    });
  }
  inp.click();
}
// analisa o grave para sincronizar as luzes (usa o relógio de 124 bpm quando não há som)
function beatUpdate(d) {
  const c = mus.ctx; let live = false;
  if (c && mus.an && mus.playing && c.state === 'running') {
    mus.an.getByteFrequencyData(mus.bins); let s = 0; for (let i = 0; i < mus.bins.length; i++) s += mus.bins[i]; mus.level = s / (mus.bins.length * 255); live = mus.level > 0.015;
    const bass = (mus.bins[1] + mus.bins[2] + mus.bins[3] + mus.bins[4]) / (4 * 255); mus.avg += (bass - mus.avg) * Math.min(1, d * 2.5); mus.cd -= d;
    if (live && bass > mus.avg * 1.12 + 0.05 && bass > 0.3 && mus.cd <= 0) { cl.beat = 1; mus.cd = 0.24; }
  }
  if (!live) { mus.clk += d * 124 / 60; const f = Math.floor(mus.clk); if (f !== mus.lastBeat) { mus.lastBeat = f; cl.beat = 1; } }
  cl.beat = Math.max(0, cl.beat - d * 4.2); cl.live = live;
}
function mixUpdate(d) {
  const c = mus.ctx; if (!c || !mus.gain) return; const inside = H.cur.room === 'clube';
  const dx = Math.max(X0 - PL.x, 0, PL.x - X1), dz = Math.max(Z0 - PL.z, 0, PL.z - Z1), dd = Math.hypot(dx, dz);
  let v, f; if (inside) { v = 1; f = 16000; } else { v = Math.pow(c01(1 - dd / 55), 1.6) * 0.55; f = dd < 4 ? 900 : 550; }
  mus.gain.gain.setTargetAtTime(v * mus.vol, c.currentTime, 0.15); mus.lp.frequency.setTargetAtTime(f, c.currentTime, 0.2);
}

// ====================================================== MATERIAIS E CONSTRUÇÃO ======================================================
function mats() {
  M.wall = lm(0x2a1230); M.roof = lm(0x140a18); M.floor = lm(0x1c1224); M.wood = lm(0x3a2216); M.black = lm(0x0d0d12); M.chrome = lm(0xdfe3ea); M.leather = lm(0x8e1230); M.leatherD = lm(0x4a0a1c);
  M.red = lm(0x8a0f26); M.stage = lm(0x16101c); M.out = lm(0x1b1820); M.mirror = lm(0x9a8fb0); M.concrete = lm(0x6b6870); M.curtain = lm(0x5a0a1c); M.speaker = lm(0x101014); M.table = lm(0x201418);
}
function stripes() { const k = cv(256, 256), g = k.g; g.fillStyle = '#34343a'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) g.fillRect(i * 64 + 30, 0, 4, 120); const t = ctex(k.c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(10, 8); return t; }
function buildLot() {
  const lot = new T.Mesh(new T.PlaneGeometry(40.5, 34), new T.MeshLambertMaterial({ map: stripes() })); lot.rotation.x = -PI / 2; lot.position.set(131.75, LT, -19.5); grp.add(lot);
  const car = new T.Mesh(new T.PlaneGeometry(6, 1.7), lm(0x8a0f26)); car.rotation.x = -PI / 2; car.position.set(115, LT + 0.004, DZ); grp.add(car);                 // tapete vermelho
  [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) { const x = 113 + i * 2.2; B.cyl(0.04, 0.05, 1.0, x, LT + 0.5, DZ + s * 1.45, M.chrome, 8); B.sph(0.07, x, LT + 1.02, DZ + s * 1.45, M.chrome); if (i < 2) B.box(2.2, 0.04, 0.04, x + 1.1, LT + 0.85, DZ + s * 1.45, M.red); } });
  B.cyl(0.18, 0.2, 6.6, 113.4, LT + 3.3, -28.5, M.black, 10);                                                                                                         // totem na calçada
  const tot = sgn(neonTex('VELVET ROSE', 'SHOW AO VIVO · +18', 512, 200, '#ff3fa8', '#8ff'), 2.6, 1.0, 113.4, LT + 6.4, -28.5, 0, true); cl.totem = tot;
}
function buildShell() {
  const wl = (x0, x1, z0, z1, y0, y1) => bx(x0, x1, y0, y1, z0, z1, M.wall);
  wl(X0 - 0.15, X0 + 0.15, Z0 - 0.15, DZ - DW / 2, 0, WH); wl(X0 - 0.15, X0 + 0.15, DZ + DW / 2, Z1 + 0.15, 0, WH); wl(X0 - 0.15, X0 + 0.15, DZ - DW / 2, DZ + DW / 2, 2.7, WH);
  wl(X0 - 0.15, X1 + 0.15, Z0 - 0.15, Z0 + 0.15, 0, WH); wl(X0 - 0.15, X1 + 0.15, Z1 - 0.15, Z1 + 0.15, 0, WH); wl(X1 - 0.15, X1 + 0.15, Z0 - 0.15, Z1 + 0.15, 0, WH);
  bx(X0 - 0.15, X1 + 0.15, WH, WH + 0.3, Z0 - 0.15, Z1 + 0.15, M.roof);
  bx(IX0, IX1, -0.09, 0, IZ0, IZ1, M.floor);                                                                                  // piso
  bx(X0 - 0.2, X1 + 0.2, 0, 0.35, Z0 - 0.2, Z0 - 0.15, M.out); bx(X0 - 0.2, X1 + 0.2, 0, 0.35, Z1 + 0.15, Z1 + 0.2, M.out);   // rodapé externo
  // fachada: faixa de neon em volta da porta, toldo, letreiro e placa +18
  const nA = neon(0), nB = neon(0.5);
  bx(X0 - 0.2, X0 - 0.15, 0, 2.7, DZ - DW / 2 - 0.12, DZ - DW / 2, nA); bx(X0 - 0.2, X0 - 0.15, 0, 2.7, DZ + DW / 2, DZ + DW / 2 + 0.12, nA); bx(X0 - 0.2, X0 - 0.15, 2.7, 2.82, DZ - DW / 2 - 0.12, DZ + DW / 2 + 0.12, nA);
  bx(X0 - 1.5, X0 - 0.15, 2.9, 3.05, DZ - 1.9, DZ + 1.9, M.red); bx(X0 - 1.5, X0 - 1.46, 2.7, 2.9, DZ - 1.9, DZ + 1.9, M.red); bx(X0 - 1.5, X0 - 0.15, 2.9, 3.05, DZ + 1.86, DZ + 1.9, nB);
  sgn(neonTex('VELVET ROSE', 'GENTLEMEN\'S CLUB · SHOW AO VIVO', 1024, 220, '#ff3fa8', '#9ff'), 7.2, 1.0, X0 - 0.17, FL + 3.62, DZ, -PI / 2);
  sgn(neonTex('+18', 'PROIBIDO PARA MENORES', 256, 200, '#ff9a3f', '#ffd9a8'), 0.9, 0.7, X0 - 0.17, FL + 1.55, DZ + 2.4, -PI / 2);
  // neon dentro das paredes (cornijas)
  const nC = neon(0.25, 1, 0.5), nD = neon(0.75, 1, 0.5);
  bx(IX0, IX1, WH - 0.35, WH - 0.28, IZ0, IZ0 + 0.04, nC); bx(IX0, IX1, WH - 0.35, WH - 0.28, IZ1 - 0.04, IZ1, nD); bx(IX0, IX0 + 0.04, WH - 0.35, WH - 0.28, IZ0, IZ1, nC); bx(IX1 - 0.04, IX1, WH - 0.35, WH - 0.28, IZ0, IZ1, nD);
  bx(IX0, IX0 + 0.04, 0.05, 0.12, IZ0, IZ1, nD); bx(IX0, IX1, 0.05, 0.12, IZ1 - 0.04, IZ1, nC);
}
function buildBar() {
  bx(123.4, 137.6, 0, 1.05, -31.35, -30.65, M.wood); bx(123.2, 137.8, 1.05, 1.12, -31.5, -30.5, M.black);
  const nE = neon(0.1, 1, 0.5), nF = neon(0.6, 1, 0.5); bx(123.4, 137.6, 0.1, 0.16, -30.66, -30.62, nE); bx(123.2, 137.8, 1.12, 1.14, -30.52, -30.5, nF);
  bx(123.2, 123.45, 0, 1.12, -33.0, -30.5, M.wood); bx(137.55, 137.8, 0, 1.12, -33.0, -30.5, M.wood);
  B.cyl(0.03, 0.03, 14, 130.5, FL + 0.22, -30.5, M.chrome, 8, 0, PI / 2);
  bx(123.2, 137.8, 0, 0.9, -33.85, -33.2, M.wood); bx(123.4, 137.6, 1.0, 2.5, -33.86, -33.84, M.mirror);
  const bots = [0xff4d6d, 0x4dd2ff, 0x9dff4d, 0xffc94d, 0xb06bff, 0xff8f4d, 0x4dffb5]; let bi = 0;
  [1.25, 1.72, 2.19].forEach(y => { bx(123.4, 137.6, y, y + 0.04, -33.85, -33.5, M.wood); for (let x = 123.9; x < 137.3; x += 0.5) { const c = bots[(bi++) % bots.length]; cyY(0.04, 0.045, y + 0.04, y + 0.3, x, -33.66, nm(c), 8); cyY(0.015, 0.02, y + 0.3, y + 0.4, x, -33.66, nm(c), 6); } });
  const nG = neon(0.4, 0.9, 0.5); bx(123.4, 137.6, 2.52, 2.56, -33.85, -33.8, nG);
  for (let i = 0; i < 9; i++) { const x = 124.4 + i * 1.45; cyY(0.02, 0.02, 0.1, 0.62, x, -29.95, M.chrome, 6); cyY(0.23, 0.23, 0.62, 0.7, x, -29.95, M.leather, 12); cyY(0.18, 0.18, 0.02, 0.08, x, -29.95, M.chrome, 10); }
  // cardápio (quadro na parede) e bandeira VIP
  const k = cv(512, 256), g = k.g; g.fillStyle = '#17101c'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#ff3fa8'; g.lineWidth = 8; rrect(g, 8, 8, 496, 240, 18); g.stroke();
  g.fillStyle = '#ffd9f0'; g.font = '800 40px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('CARDÁPIO', 256, 56); g.font = '700 30px Arial, sans-serif'; g.textAlign = 'left';
  DRINKS.forEach((d, i) => { g.fillStyle = '#' + ('000000' + d.col.toString(16)).slice(-6); g.beginPath(); g.arc(46, 96 + i * 30, 9, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.fillText(d.n, 70, 106 + i * 30); });
  sgn(ctex(k.c), 3.2, 1.6, 130.8, FL + 3.15, IZ0 + 0.02, 0);
  sgn(neonTex('VIP', 'CAMAROTES', 256, 180, '#b06bff', '#e0c8ff'), 1.5, 1.05, 132, FL + 2.7, IZ1 - 0.02, PI);
}
function buildStage() {
  const nS = neon(0.3, 1, 0.55), nT = neon(0.8, 1, 0.5);
  bx(STG.x0, STG.x1, 0, 0.6, STG.z0, STG.z1, M.stage); bx(STG.x0 - 0.02, STG.x0 + 0.02, 0.44, 0.52, STG.z0, STG.z1, nS); bx(STG.x0, STG.x1, 0.6, 0.62, STG.z0, STG.z0 + 0.06, nT); bx(STG.x0, STG.x1, 0.6, 0.62, STG.z1 - 0.06, STG.z1, nT);
  bx(RUN.x0, RUN.x1, 0, 0.6, RUN.z0, RUN.z1, M.stage); cyY(1.6, 1.6, 0, 0.6, 129, -19, M.stage, 24); cyY(1.64, 1.64, 0.5, 0.56, 129, -19, nS, 24);
  bx(RUN.x0, RUN.x1, 0.5, 0.56, RUN.z0 - 0.02, RUN.z0, nS); bx(RUN.x0, RUN.x1, 0.5, 0.56, RUN.z1, RUN.z1 + 0.02, nS);
  bx(IX1 - 0.3, IX1 - 0.12, 0.62, 3.9, STG.z0, STG.z1, M.black);                                                           // moldura do telão
  bx(IX1 - 0.4, IX1 - 0.12, 0.6, 4.0, STG.z0 - 0.5, STG.z0, M.curtain); bx(IX1 - 0.4, IX1 - 0.12, 0.6, 4.0, STG.z1, STG.z1 + 0.5, M.curtain);   // cortinas laterais
  POLES.forEach(p => { cyY(0.035, 0.035, 0.6, WH, p[0], p[1], M.chrome, 10); cyY(0.22, 0.24, 0.6, 0.66, p[0], p[1], M.chrome, 14); cyY(0.16, 0.16, WH - 0.06, WH, p[0], p[1], M.chrome, 12); });
  const scr = new T.Mesh(new T.PlaneGeometry(STG.z1 - STG.z0 - 0.4, 3.0), new T.MeshBasicMaterial({ color: 0xff3fa8 })); scr.rotation.y = -PI / 2; scr.position.set(IX1 - 0.11, FL + 2.3, (STG.z0 + STG.z1) / 2); grp.add(scr); cl.screen = scr;
  [-1, 1].forEach(s => { const z = (STG.z0 + STG.z1) / 2 + s * 5.5, sp = B; sp.box(0.5, 1.5, 0.5, STG.x0 + 0.5, FS + 0.75, z, M.speaker); });                 // caixas de som do palco
}
function buildFurniture() {
  [127, 132, 137].forEach(x => {
    bx(x - 1.7, x + 1.7, 0, 0.45, -6.95, -5.45, M.leather); bx(x - 1.7, x + 1.7, 0.45, 1.2, -5.6, -5.3, M.leatherD); bx(x - 1.7, x - 1.5, 0.45, 0.8, -6.95, -5.45, M.leatherD); bx(x + 1.5, x + 1.7, 0.45, 0.8, -6.95, -5.45, M.leatherD);
    cyY(0.5, 0.5, 0.68, 0.72, x, -8.4, M.table, 16); cyY(0.05, 0.05, 0.0, 0.68, x, -8.4, M.chrome, 8); cyY(0.3, 0.3, 0.0, 0.04, x, -8.4, M.chrome, 12); cyY(0.04, 0.04, 0.72, 0.82, x, -8.4, nm(0xffb347), 8);
  });
  [[130.2, -16.4, 1], [132.2, -16.4, 1], [134.2, -16.4, 1], [136.2, -16.4, 1], [130.2, -21.6, -1], [132.2, -21.6, -1], [134.2, -21.6, -1], [136.2, -21.6, -1]].forEach(([x, z, s]) => {
    bx(x - 0.24, x + 0.24, 0.4, 0.46, z - 0.24, z + 0.24, M.leather); bx(x - 0.24, x + 0.24, 0.46, 0.95, z + s * 0.2, z + s * 0.26, M.leatherD); cyY(0.03, 0.03, 0, 0.4, x - 0.18, z - 0.18, M.chrome, 6); cyY(0.03, 0.03, 0, 0.4, x + 0.18, z + 0.18, M.chrome, 6); cyY(0.03, 0.03, 0, 0.4, x - 0.18, z + 0.18, M.chrome, 6); cyY(0.03, 0.03, 0, 0.4, x + 0.18, z - 0.18, M.chrome, 6); });
  // caixas de som da pista (os cones pulsam com o grave)
  [[IX0 + 0.5, -26.5], [IX0 + 0.5, -12.5]].forEach(([x, z]) => { bx(x - 0.4, x + 0.4, 0, 1.6, z - 0.7, z + 0.7, M.speaker); [0.45, 1.15].forEach(y => { const c = new T.Mesh(new T.CylinderGeometry(y > 1 ? 0.2 : 0.3, y > 1 ? 0.2 : 0.3, 0.06, 18), nm(0x2a2a33)); c.rotation.z = PI / 2; c.position.set(x + 0.41, FL + y, z); grp.add(c); SPK.push({ m: c, y, bx: x + 0.41 }); }); });
  // colunas
  [[127.5, -10.2], [127.5, -28.6]].forEach(([x, z]) => { cyY(0.22, 0.22, 0, WH, x, z, M.wall, 12); cyY(0.24, 0.24, 0.9, 0.96, x, z, neon(0.2), 12); });
}
function buildLights() {
  // piso de LED (uma só malha instanciada)
  const g = new T.PlaneGeometry(0.94, 0.94); g.rotateX(-PI / 2); const n = FLOOR_LED.cols * FLOOR_LED.rows, im = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: 0xffffff }), n), m4 = new T.Matrix4(), c0 = new T.Color(0x220022);
  for (let i = 0; i < n; i++) { const cx = FLOOR_LED.x0 + (i % FLOOR_LED.cols) + 0.5, cz = FLOOR_LED.z0 + Math.floor(i / FLOOR_LED.cols) + 0.5; m4.setPosition(cx, FL + 0.012, cz); im.setMatrixAt(i, m4); im.setColorAt(i, c0); }
  im.frustumCulled = false; grp.add(im); cl.led = im;
  // globo de espelhos
  const k = cv(128, 64), kg = k.g; kg.fillStyle = '#888'; kg.fillRect(0, 0, 128, 64); for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { const v = 110 + ((x * 37 + y * 91) % 120); kg.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 20) + ')'; kg.fillRect(x * 8 + 1, y * 8 + 1, 6, 6); }
  const ball = new T.Mesh(new T.SphereGeometry(0.45, 16, 12), new T.MeshBasicMaterial({ map: ctex(k.c) })); ball.position.set(124, FL + WH - 0.9, CZc); grp.add(ball); cl.ball = ball; B.cyl(0.015, 0.015, 0.7, 124, FL + WH - 0.35, CZc, M.chrome, 4);
  // feixes de luz (cones aditivos presos ao teto)
  const cols = [0xff3fa8, 0x3fe0ff, 0xb06bff, 0x7dff6a, 0xff9a3f, 0xff3fa8, 0x3fe0ff, 0xb06bff];
  [[141, -24], [141, -14], [139, -19], [143, -19], [124, -23], [124, -16], [128, -19.5], [121, -19.5]].forEach(([x, z], i) => {
    const pv = new T.Group(); pv.position.set(x, FL + WH - 0.08, z); const cg = new T.CylinderGeometry(0.05, 0.85, 3.7, 14, 1, true); cg.translate(0, -1.85, 0);
    const bm = new T.Mesh(cg, new T.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); pv.add(bm);
    const lens = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), nm(0xffffff)); pv.add(lens); grp.add(pv); BEAMS.push({ pv, bm, ph: i * 1.3, sp: 0.5 + (i % 3) * 0.22, amp: 0.5 });
  });
  // lasers (varrem a pista)
  cl.lasers = []; for (let i = 0; i < 5; i++) { const lg = new T.Group(); lg.position.set(124, FL + WH - 0.5, CZc); const lc = i % 2 ? 0x44ff66 : 0xff2a5a, l = new T.Mesh(new T.BoxGeometry(0.018, 0.018, 9), new T.MeshBasicMaterial({ color: lc, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false })); l.position.z = 4.5; lg.add(l); grp.add(lg); cl.lasers.push(lg); }
  // luzes reais (poucas, reaproveitadas): palco, pista e bar
  [{ p: [141, FL + 3.4, -19], col: 0xff3fa8, dist: 12, k: () => 0.75 + 0.9 * cl.beat }, { p: [124, FL + 3.2, CZc], col: 0x3fe0ff, dist: 11, k: () => 0.6 + 0.8 * cl.beat }, { p: [131, FL + 2.5, -31.5], col: 0xffb36b, dist: 8, k: () => 0.7 }].forEach(o => H.light({ p: o.p, col: o.col, dist: o.dist, decay: 1.4, k: o.k, zones: ['clube'], auto: () => true }));
}
function buildMusicPanel() {
  const px = 121.2, pz = IZ0 + 0.04; bx(px - 1.25, px + 1.25, 1.05, 2.5, IZ0, IZ0 + 0.1, M.black);
  const dk = cv(512, 128); cl.dispC = dk; cl.dispT = ctex(dk.c); const disp = new T.Mesh(new T.PlaneGeometry(2.3, 0.575), new T.MeshBasicMaterial({ map: cl.dispT })); disp.position.set(px, FL + 2.08, pz + 0.07); grp.add(disp);
  const ico = ['⏮', '⏯', '⏭', '−', '+', '♫'], acts = [() => { if (mus.list.length > 1) playTrack(mus.idx - 1); else toast('Só há uma música'); }, () => { mus.paused = !mus.paused; if (mus.paused) musicOff(); else musicOn(); mus.dirty = true; },
    () => { if (mus.list.length > 1) playTrack(mus.idx + 1); else toast('Só há uma música'); }, () => { mus.vol = clamp(mus.vol - 0.1, 0.1, 1); mus.dirty = true; }, () => { mus.vol = clamp(mus.vol + 0.1, 0.1, 1); mus.dirty = true; }, pickFiles];
  ico.forEach((s, i) => {
    const k = cv(96, 96), g = k.g; g.fillStyle = '#2b1236'; g.fillRect(0, 0, 96, 96); g.strokeStyle = '#ff3fa8'; g.lineWidth = 6; rrect(g, 5, 5, 86, 86, 14); g.stroke(); g.fillStyle = '#fff'; g.font = '700 54px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 48, 52);
    const m = new T.Mesh(new T.PlaneGeometry(0.34, 0.34), new T.MeshBasicMaterial({ map: ctex(k.c) })); m.position.set(px - 1.0 + i * 0.4, FL + 1.52, pz + 0.07); grp.add(m);
    inter([m], () => { sfx(900, 0.06); acts[i](); });
  });
}
function drawPanel() {
  const k = cl.dispC, g = k.g; g.fillStyle = '#0b0510'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#3fe0ff'; g.lineWidth = 5; rrect(g, 4, 4, 504, 120, 14); g.stroke();
  g.fillStyle = '#3fe0ff'; g.font = '700 22px Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(mus.paused ? '⏸ PAUSADO' : '♪ TOCANDO' + (mus.list.length > 1 ? '  ' + (mus.idx + 1) + '/' + mus.list.length : ''), 20, 28);
  let t = mus.title || (mus.loaded && !mus.list.length ? 'Batida da casa' : '...'), fs = 34; g.font = '800 ' + fs + 'px Arial, sans-serif'; while (g.measureText(t).width > 470 && fs > 16) { fs -= 2; g.font = '800 ' + fs + 'px Arial, sans-serif'; } g.fillStyle = '#fff'; g.fillText(t, 20, 66);
  g.fillStyle = '#2b1236'; g.fillRect(20, 96, 400, 12); g.fillStyle = '#ff3fa8'; g.fillRect(20, 96, 400 * mus.vol, 12); g.fillStyle = '#ffd9f0'; g.font = '700 20px Arial, sans-serif'; g.fillText(Math.round(mus.vol * 100) + '%', 432, 102);
  cl.dispT.needsUpdate = true; mus.dirty = false;
}

// ====================================================== BEBIDAS ======================================================
function makeGlass(d) {
  const g = new T.Group(), gm = own(0xcfe8f5, { transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide }), lq = own(d.col, { emissive: d.col, emissiveIntensity: 0.15 });
  const add = (geo, mat, y) => { const m = new T.Mesh(geo, mat); m.position.y = y; g.add(m); return m; }; let liquid, h;
  switch (d.glass) {
    case 'mug': h = 0.14; add(new T.CylinderGeometry(0.048, 0.044, h, 12), gm, h / 2); liquid = add(new T.CylinderGeometry(0.043, 0.04, h * 0.8, 12), lq, h * 0.42); add(new T.CylinderGeometry(0.044, 0.044, 0.025, 12), own(0xffffff), h * 0.84); break;
    case 'tumbler': h = 0.09; add(new T.CylinderGeometry(0.04, 0.036, h, 12), gm, h / 2); liquid = add(new T.CylinderGeometry(0.036, 0.033, h * 0.55, 12), lq, h * 0.3); break;
    case 'cone': { h = 0.16; add(new T.CylinderGeometry(0.003, 0.003, 0.08, 6), gm, 0.04); const c1 = add(new T.ConeGeometry(0.06, 0.09, 14, 1, true), gm, 0.12); c1.rotation.x = PI; liquid = add(new T.ConeGeometry(0.052, 0.07, 14), lq, 0.115); liquid.rotation.x = PI; break; }
    case 'flute': h = 0.2; add(new T.CylinderGeometry(0.02, 0.012, h, 10), gm, h / 2); liquid = add(new T.CylinderGeometry(0.018, 0.011, h * 0.7, 10), lq, h * 0.4); break;
    default: h = 0.17; add(new T.CylinderGeometry(0.045, 0.036, h, 12), gm, h / 2); liquid = add(new T.CylinderGeometry(0.043, 0.035, h * 0.75, 12), lq, h * 0.4); add(new T.CylinderGeometry(0.004, 0.004, 0.2, 5), own(0x4d9a2a), 0.12).rotation.z = 0.15;
  }
  g.userData = { liquid, y0: liquid.position.y, h }; return g;
}
function orderDrink(i, x) {
  if (cl.orders.length >= 2) { toast('🍸 O barman já está com pedidos, aguarde um instante'); return; }
  cl.orders.push({ drink: DRINKS[i], x }); sfx(760, 0.07);
}
function placeGlass(d, x) {
  const g = makeGlass(d); let gx = clamp(Math.round(x * 2) / 2, 125, 136.5); cl.glasses.forEach(o => { if (Math.abs(o.g.position.x - gx) < 0.3) gx += 0.4; });
  g.position.set(gx, FL + 1.14, -30.74); grp.add(g); const o = { g, d, sips: 0 }; cl.glasses.push(o);
  const h = hit(g, 0.2, 0.3, 0.2, 0, 0.1, 0); inter([h], () => { o.sips++; sfx(300 + o.sips * 40, 0.14, 0.4); const u = g.userData; u.liquid.scale.y = Math.max(0.02, 1 - o.sips * 0.26); u.liquid.position.y = u.y0 - u.h * 0.35 * (1 - u.liquid.scale.y) * 0.5; if (o.sips === 1) toast('🍹 ' + d.n + ': saúde!'); if (o.sips >= 4) { toast('Acabou! Peça outro no balcão'); setTimeout(() => { grp.remove(g); const k = cl.glasses.indexOf(o); if (k >= 0) cl.glasses.splice(k, 1); }, 500); } });
}
function buildOrderBottles() {
  DRINKS.forEach((d, i) => {
    const x = 126.2 + i * 2.6, g = new T.Group(); g.position.set(x, FL + 1.14, -31.12); grp.add(g);
    const mb = own(d.col, { emissive: d.col, emissiveIntensity: 0.25 }), body = new T.Mesh(new T.CylinderGeometry(0.05, 0.055, 0.28, 12), mb), neck = new T.Mesh(new T.CylinderGeometry(0.018, 0.04, 0.12, 10), mb.clone());
    body.position.y = 0.14; neck.position.y = 0.34; g.add(body); g.add(neck); const tag = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: d.col, transparent: true, opacity: 0.5, depthWrite: false })); tag.scale.set(0.5, 0.5, 1); tag.position.y = 0.2; g.add(tag);
    inter([body, neck], () => orderDrink(i, PL.x));
  });
}

// ====================================================== DANÇARINAS ======================================================
let DG = null;
const dgeo = () => DG || (DG = { shorts: new T.CylinderGeometry(0.07, 0.068, 0.36, 8), thigh: new T.CylinderGeometry(0.058, 0.052, 0.16, 8), boot: new T.CylinderGeometry(0.05, 0.058, 0.34, 8), foot: new T.BoxGeometry(0.1, 0.07, 0.24),
  torso: new T.BoxGeometry(0.42, 0.58, 0.24), hips: new T.BoxGeometry(0.44, 0.2, 0.26), arm: new T.CylinderGeometry(0.046, 0.038, 0.58, 7), hand: new T.SphereGeometry(0.048, 7, 5), head: new T.SphereGeometry(0.115, 12, 9),
  hair: new T.SphereGeometry(0.125, 12, 8, 0, TAU, 0, PI * 0.58), long: new T.BoxGeometry(0.22, 0.4, 0.07), eye: new T.SphereGeometry(0.014, 6, 4) });
function makeDancer(sty) {
  const G = dgeo(), g = new T.Group(), body = new T.Group(); g.add(body);
  const sk = lm(sty.skin), su = lm(sty.suit), s2 = lm(sty.suit2), bo = lm(0x15121a), ha = lm(sty.hair), ey = lm(0x15171a);
  const put = (geo, mat, x, y, z, par) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); (par || body).add(m); return m; };
  const d = { g, body, st: 'groove', stT: rnd(2, 5), th: 0, ph: rnd(0, 6), px: 0, pz: 0, y: 0, yaw: 0 };
  d.legs = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * 0.1, 0.88, 0); body.add(p); put(G.shorts, s2, 0, -0.18, 0, p); put(G.thigh, sk, 0, -0.44, 0, p); put(G.boot, bo, 0, -0.67, 0, p); put(G.foot, bo, 0, -0.85, 0.04, p); return p; });
  put(G.hips, s2, 0, 0.93, 0); put(G.torso, su, 0, 1.2, 0);
  d.arms = [-1, 1].map(s => { const p = new T.Group(); p.position.set(s * 0.27, 1.43, 0); body.add(p); put(G.arm, sk, 0, -0.27, 0, p); put(G.hand, sk, 0, -0.59, 0, p); return p; });
  d.head = new T.Group(); d.head.position.set(0, 1.52, 0); body.add(d.head); put(G.head, sk, 0, 0.13, 0, d.head); put(G.hair, ha, 0, 0.145, -0.008, d.head); put(G.long, ha, 0, 0.04, -0.085, d.head); [-1, 1].forEach(s => put(G.eye, ey, s * 0.04, 0.15, 0.105, d.head));
  d.hit = hit(g, 0.8, 1.85, 0.7, 0, 0.92, 0); return d;
}
const DSTY = [{ skin: 0xe0ac7e, hair: 0xd0b060, suit: 0xff3fa8, suit2: 0x2a0a30 }, { skin: 0x9a6540, hair: 0x1a1a1a, suit: 0x3fe0ff, suit2: 0x101a40 }, { skin: 0xf1c8a0, hair: 0x7a2a1a, suit: 0xb06bff, suit2: 0x1a1030 }];
function buildDancers() {
  DSTY.forEach((s, k) => { const d = makeDancer(s); d.k = k; d.fy = FS; d.pole = k < 2 ? POLES[k] : null; d.px = d.pole ? d.pole[0] - 0.42 : 139.5; d.pz = d.pole ? d.pole[1] + 0.42 : -19; d.yaw = -PI / 2; d.stT = 2 + k * 1.7; d.st = k < 2 ? 'pose' : 'groove'; d.wp = 0; grp.add(d.g); cl.dancers.push(d); inter([d.hit], () => tip(d)); });
}
const bills = [];
function tip(d) {
  sfx(1100, 0.08, 0.5); setTimeout(() => sfx(1500, 0.1, 0.4), 90); d.wave = 2.2; d.say = 3; cl.dSayT = cl.dSayT || 0;
  const b = bills.find(q => !q.on) || (() => { const m = new T.Mesh(new T.PlaneGeometry(0.16, 0.08), new T.MeshBasicMaterial({ color: 0x5bd16a, side: T.DoubleSide })); grp.add(m); const q = { m, on: false, u: 0, a: [0, 0, 0], b: [0, 0, 0] }; bills.push(q); return q; })();
  b.on = true; b.u = 0; b.a = [PL.x, FL + 1.2, PL.z]; b.d = d; b.m.visible = true; toast('💵 Gorjeta! ' + pick(['Obrigada, querido(a)!', 'Valeu!', 'Que fofo!', 'Brigadão!']));
}
function updDancer(d, ts, dt) {
  const beat = cl.beat, sw = Math.sin(ts * TAU * 124 / 120 + d.ph), bob = Math.abs(Math.sin(ts * TAU * 124 / 120 + d.ph));
  d.stT -= dt; const P = d.pole;
  let r = 0.4, y = 0, lean = 0, aL = 0, aR = 0, aLz = 0.12, aRz = -0.12, lg0 = 0, lg1 = 0, hd = 0;
  if (P) {
    if (d.stT <= 0) { const nx = { pose: 'walk', walk: 'spin', spin: 'slide', slide: 'pose' }[d.st]; if (nx === 'walk') d.th = Math.atan2(d.px - P[0], d.pz - P[1]); d.st = nx; d.stT = { walk: rnd(5, 7), spin: rnd(3.5, 5), slide: 2.6, pose: rnd(4, 6) }[nx]; d.dur = d.stT; }
    if (d.st === 'walk') { d.th += dt * 0.95; r = 0.42; d.r = d.r == null ? r : d.r + (r - d.r) * damp(5, dt); d.px = P[0] + d.r * Math.sin(d.th); d.pz = P[1] + d.r * Math.cos(d.th); d.yaw = d.th + PI; aR = -2.45; aRz = -0.05; aL = -0.5 + sw * 0.5; aLz = 0.5; y = bob * 0.025; lg0 = Math.sin(ts * 5.2) * 0.35; lg1 = -lg0; hd = 0.05; }
    else if (d.st === 'spin') { d.th += dt * 3.0; r = 0.3; d.r = d.r == null ? r : d.r + (r - d.r) * damp(5, dt); d.px = P[0] + d.r * Math.sin(d.th); d.pz = P[1] + d.r * Math.cos(d.th); d.yaw = d.th + PI; aR = -2.7; aL = -2.55; aRz = -0.1; aLz = 0.1; y = 0.24 + 0.03 * Math.sin(ts * 6); lean = -0.5; lg0 = 0.7; lg1 = -0.6 + 0.2 * Math.sin(ts * 5); hd = -0.35; }
    else if (d.st === 'slide') { const u = c01(1 - d.stT / d.dur); d.th += dt * (1.6 - u); r = 0.32; d.r = d.r == null ? r : d.r + (r - d.r) * damp(5, dt); d.px = P[0] + d.r * Math.sin(d.th); d.pz = P[1] + d.r * Math.cos(d.th); d.yaw = d.th + PI; aR = -2.7; aL = -2.4; y = 0.24 - 0.62 * Math.sin(u * PI * 0.9) * (u < 0.5 ? 1 : 1); lg0 = -1.0 * Math.sin(u * PI); lg1 = -0.7 * Math.sin(u * PI); lean = -0.25; }
    else { const tx = P[0], tz = P[1] + 0.45; d.px += (tx - d.px) * damp(4, dt); d.pz += (tz - d.pz) * damp(4, dt); d.yaw += wr(-PI / 2 - d.yaw) * damp(4, dt); aL = 0; aLz = -2.35; aR = -0.25; aRz = 0.75; y = bob * 0.015; lean = 0.05 * sw; lg0 = 0.18 * sw; lg1 = -0.1 * sw; hd = 0.08 * sw; }
  } else {
    if (d.stT <= 0) { const nx = { groove: 'tip', tip: 'pose', pose: 'back', back: 'groove' }[d.st]; d.st = nx; d.stT = nx === 'groove' ? rnd(8, 12) : nx === 'pose' ? rnd(4, 6) : 99; }
    const walkTo = (tx, tz, nxt) => { const dx = tx - d.px, dz = tz - d.pz, L = Math.hypot(dx, dz); if (L < 0.08) { d.stT = 0; return true; } const k = Math.min(1, 0.95 * dt / L); d.px += dx * k; d.pz += dz * k; d.yaw += wr(Math.atan2(dx, dz) - d.yaw) * damp(8, dt); return false; };
    if (d.st === 'groove') { d.px += (139.4 + Math.sin(ts * 0.4) * 1.0 - d.px) * damp(1.2, dt); d.pz += (-19 + Math.cos(ts * 0.31) * 2.2 - d.pz) * damp(1.2, dt); d.yaw += wr(-PI / 2 + Math.sin(ts * 0.5) * 0.7 - d.yaw) * damp(2, dt); aL = -2.2 + sw * 0.4; aR = -2.3 - sw * 0.4; aLz = -0.3; aRz = 0.3; y = bob * 0.04; lean = 0.08 * sw; lg0 = 0.2 * sw; lg1 = -0.2 * sw; hd = 0.12 * sw; }
    else if (d.st === 'tip') { walkTo(130.4, -19); aL = -0.5 * Math.sin(ts * 5); aR = 0.5 * Math.sin(ts * 5); lg0 = 0.5 * Math.sin(ts * 5); lg1 = -lg0; y = bob * 0.02; lean = 0.06 * sw; }
    else if (d.st === 'pose') { d.yaw += wr(-PI / 2 + Math.sin(ts * 0.9) * 1.1 - d.yaw) * damp(3, dt); aL = -2.5; aR = -0.4; aLz = -0.4; aRz = 0.5; y = bob * 0.03; lean = 0.1 * sw; lg0 = 0.12 * sw; hd = 0.15 * sw; }
    else { walkTo(139.4, -19); aL = -0.5 * Math.sin(ts * 5); aR = 0.5 * Math.sin(ts * 5); lg0 = 0.5 * Math.sin(ts * 5); lg1 = -lg0; y = bob * 0.02; lean = 0.06 * sw; }
  }
  if (d.wave > 0) { d.wave -= dt; aR = 0; aRz = -(2.4 + Math.sin(ts * 11) * 0.35); }
  d.g.position.set(d.px, d.fy + (P ? 0 : 0), d.pz); d.body.rotation.y = d.yaw; d.body.position.y = y; d.body.rotation.x = lean; d.body.rotation.z = sw * 0.06 * (d.st === 'spin' ? 0 : 1);
  d.arms[0].rotation.x += (aL - d.arms[0].rotation.x) * damp(10, dt); d.arms[1].rotation.x += (aR - d.arms[1].rotation.x) * damp(10, dt); d.arms[0].rotation.z += (aLz - d.arms[0].rotation.z) * damp(10, dt); d.arms[1].rotation.z += (aRz - d.arms[1].rotation.z) * damp(10, dt);
  d.legs[0].rotation.x += (lg0 - d.legs[0].rotation.x) * damp(10, dt); d.legs[1].rotation.x += (lg1 - d.legs[1].rotation.x) * damp(10, dt); d.head.rotation.x += (hd - d.head.rotation.x) * damp(8, dt); d.head.rotation.z = sw * 0.06;
  if (d.say > 0) { d.say -= dt; if (d.say <= 0) d.say = 0; }
}
const wr = a => Math.atan2(Math.sin(a), Math.cos(a));

// ====================================================== NPCs ======================================================
function* walk(n, pts, sp) { for (const p of pts) while (A.stepTo(n, p[0], p[1], sp || 1.2) > 0.1) yield; n.moving = false; }
const near = (n, r) => Math.hypot(PL.x - n.x, PL.z - n.z) < r;
function* bartenderLife(n) {
  n.fy = FL; n.lock = true; n.x = 131; n.z = -32.3; n.yawT = 0; n.shake = 0; let chat = rnd(6, 12);
  n.pose = ts => { if (n.shake > 0) { n.arms[0].rotation.x = -1.9 + Math.sin(ts * 28) * 0.3; n.arms[1].rotation.x = -1.7 - Math.sin(ts * 28) * 0.3; n.arms[0].rotation.z = 0.2; n.arms[1].rotation.z = -0.2; } else if (n.wipe) { n.arms[0].rotation.x = -1.0 + Math.sin(ts * 3) * 0.15; n.arms[1].rotation.x = -0.9; } };
  for (;;) {
    const o = cl.orders.shift();
    if (o) {
      yield* walk(n, [[clamp(o.x, 125, 136.5), -32.3]], 1.4); n.yawT = 0; A.say(n, pick(['Já é pra já!', 'Saindo!', 'Boa escolha!']), 2.2); yield* A.wait(n, 0.5);
      n.shake = 1; sfx(520, 0.05); let t = 2.2; while (t > 0) { t -= A.dt; if (((t * 6) | 0) % 2 === 0) sfx(240 + rnd(0, 80), 0.03, 0.25); yield; } n.shake = 0;
      placeGlass(o.drink, o.x); sfx(880, 0.08); A.say(n, o.drink.n + '! Aproveite', 2.6); yield* A.wait(n, 0.8); continue;
    }
    n.wipe = true; let t = rnd(5, 9); while (t > 0 && !cl.orders.length) { t -= A.dt; chat -= A.dt; if (chat <= 0) { chat = rnd(10, 20); if (near(n, 9)) { A.say(n, pick(['Quer beber alguma coisa?', 'Clique numa garrafa!', 'Tem caipirinha gelada!']), 3); n.wave = 1.2; } } yield; }
    n.wipe = false; if (!cl.orders.length) { yield* walk(n, [[rnd(125, 136.5), -32.3]], 0.9); n.yawT = 0; }
  }
}
function mkTray() {
  const g = new T.Group(), td = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.012, 14), lm(0xcfd3da)); g.add(td); g.gl = [];
  [[-0.07, 0.04], [0.08, 0.03], [0, -0.08]].forEach((p, i) => { const q = makeGlass(DRINKS[(i * 2) % 5]); q.position.set(p[0], 0.008, p[1]); q.scale.setScalar(0.9); g.add(q); g.gl.push(q); }); g.position.set(0, 0.02, 0.12); return g;
}
const PICK = [137.6, -29.4];
const SPOTS = [ // destinos dos garçons: [pontos do caminho (ida), x, z, yaw]
  ...[130.2, 132.2, 134.2, 136.2].map(x => ({ via: [[x, -28.2]], x, z: -23.5, yaw: PI })),
  ...[130.2, 134.2].map(x => ({ via: [[126.2, -28.2], [126.2, -12.6], [x, -12.6]], x, z: -14.9, yaw: PI })),
  ...[127, 132, 137].map(x => ({ via: [[126.2, -28.2], [126.2, -12.6], [x, -12.6]], x, z: -10.2, yaw: 0 })),
  ...[126, 130.2, 134.8].map(x => ({ via: [], x, z: -28.5, yaw: PI }))];
function* waiterLife(n, k) {
  n.fy = FL; n.lock = false; const tray = mkTray(); n.carryG.add(tray); tray.visible = false; n.x = PICK[0]; n.z = PICK[1]; yield* A.wait(n, 2 + k * 5 + rnd(0, 3));
  for (;;) {
    yield* walk(n, [PICK], 1.2); n.yawT = PI; yield* A.wait(n, 0.8); tray.gl.forEach(q => { q.visible = true; }); tray.visible = true; n.hold = true; yield* A.wait(n, 0.7);
    const s = pick(SPOTS); yield* walk(n, s.via.concat([[s.x, s.z]]), 1.25); n.yawT = s.yaw; yield* A.wait(n, 0.5); A.say(n, pick(['Seu drink!', 'Bebida na mesa!', 'Aqui está!', 'Mais alguma coisa?']), 2.4); sfx(700, 0.05);
    yield* A.wait(n, 1.2); tray.gl.forEach(q => { q.visible = false; }); yield* A.wait(n, 1.4);
    yield* walk(n, s.via.slice().reverse().concat([PICK]), 1.25); n.hold = false; tray.visible = false; yield* A.wait(n, rnd(2, 8));
  }
}
function* guardLife(n, x, z, yaw, lines) {
  n.fy = H.YG + 0.05; n.lock = true; n.x = x; n.z = z; n.yawT = yaw; let cd = rnd(3, 8); n.pose = () => { n.arms[0].rotation.x = -0.9; n.arms[1].rotation.x = -0.9; n.arms[0].rotation.z = 0.25; n.arms[1].rotation.z = -0.25; };
  if (x > X0) n.fy = FL; for (;;) { cd -= A.dt; if (cd <= 0 && near(n, 5)) { cd = rnd(14, 26); A.say(n, pick(lines), 3); n.wave = 1.4; } n.x = x; n.z = z; n.yawT = yaw; yield; }
}
function* sitLife(n, x, z, yaw, drop) {
  n.fy = FL; n.lock = true; n.sitT = 1; n.sitDrop = drop; n.moving = false; let t = rnd(3, 10);
  for (;;) { n.x = x; n.z = z; n.yawT = yaw; n.sitT = 1; t -= A.dt;
    if (t <= 0) { t = rnd(5, 13); const r = Math.random(), dn = cl.dancers[2] && Math.hypot(cl.dancers[2].px - x, cl.dancers[2].pz - z) < 8;
      if (r < 0.45 && dn) { n.wave = 1.8; A.say(n, pick(['Uhuuul!', 'Isso aí!', 'Que show!', 'Maravilhosa!']), 2.4); } else if (r < 0.7) n.reach = 0.7; else n.lookOff = rnd(-0.8, 0.8); }
    yield; }
}
function* floorLife(n, k) {
  n.fy = FL; n.lock = false; n.x = rnd(121.8, 126.2); n.z = rnd(-24.5, -14.5); n.pose = ts => { if (n.dance) { n.arms[0].rotation.x = -2.3 + Math.sin(ts * 7 + k) * 0.4; n.arms[1].rotation.x = -2.3 - Math.sin(ts * 7 + k) * 0.4; n.arms[0].rotation.z = 0.3; n.arms[1].rotation.z = -0.3; n.body.position.y = Math.abs(Math.sin(ts * 6.4 + k)) * 0.05; n.body.rotation.z = Math.sin(ts * 3.2 + k) * 0.08; } };
  yield* A.wait(n, k * 1.5);
  for (;;) { yield* walk(n, [[rnd(121.5, 126.5), rnd(-24.5, -14.5)]], 0.55); n.dance = true; let t = rnd(8, 18); while (t > 0) { t -= A.dt; n.yawT += 0.6 * A.dt; yield; } n.dance = false; if (Math.random() < 0.3) A.say(n, pick(['Essa música é boa!', 'Bora dançar!', 'Uhuul!']), 2.4); }
}
function spawn() {
  const sp = (x, z, co) => { const n = npc.spawn({ x, z, at: A.nearest(x, z), co }); cl.poses.push(n); return n; };
  sp(131, -32.3, n => bartenderLife(n));
  [0, 1].forEach(k => sp(PICK[0], PICK[1], n => waiterLife(n, k)));
  sp(116.7, -17.5, n => guardLife(n, 116.7, -17.5, -PI / 2, ['Boa noite! Só maiores de 18.', 'Bem-vindo(a) ao Velvet Rose!', 'Pode entrar, a casa está animada!']));
  sp(119.4, -21.6, n => guardLife(n, 119.4, -21.6, -PI / 2, ['Aproveite a noite!', 'Tudo tranquilo por aqui.', 'Bebida só no balcão, tá?']));
  [[126.6, -6.5], [128.0, -6.5], [132.6, -6.5], [137.4, -6.5]].forEach(([x, z]) => sp(x, z, n => sitLife(n, x, z, PI, 0.42)));
  [[130.2, -16.4, PI], [134.2, -16.4, PI], [132.2, -21.6, 0], [136.2, -21.6, 0]].forEach(([x, z, y]) => sp(x, z, n => sitLife(n, x, z, y, 0.42)));
  [126, 130.2, 134.8].forEach(x => sp(x, -29.95, n => sitLife(n, x, -29.95, PI, 0.2)));
  [0, 1, 2].forEach(k => sp(123, -19, n => floorLife(n, k)));
}

// ====================================================== ATUALIZAÇÃO ======================================================
let clk = 0, mixT = 0;
VR.hook(57, d => {                                                          // poses das rotinas (depois do npc.js desenhar o NPC)
  if (!cl.built || !H.active) return; clk += d; const ts = clk;
  cl.poses.forEach(n => { if (n.pose && n.vis) { try { n.pose(ts); } catch (e) {} } });
});
VR.hook(58, (d, t) => {
  if (!cl.built) return; const dist = Math.hypot(PL.x - CXc, PL.z - CZc);
  if (!H.active) { if (mus.playing) musicOff(); return; }
  cl.group.visible = dist < 150; if (dist > 150) { if (mus.playing) musicOff(); return; }
  const ts = clk, tm = ts * 1000;
  if (dist < 75 && !mus.playing && !mus.paused) musicOn(); else if (dist > 100 && mus.playing) musicOff();
  beatUpdate(d); mixT -= d; if (mixT <= 0) { mixT = 0.1; mixUpdate(d); } if (mus.dirty && cl.dispC) drawPanel();
  const inside = H.cur.room === 'clube', night = dark(), hue0 = (ts * 0.04) % 1, b = cl.beat;
  NEON.forEach(n => n.m.color.setHSL((hue0 + n.ph) % 1, n.s, n.l + 0.18 * b));
  if (cl.totem) cl.totem.scale.setScalar(1 + 0.02 * b);
  if (dist > 60 && !inside) return;                                         // de longe só o neon da fachada
  cl.dancers.forEach(x => updDancer(x, ts, d));
  if (cl.led) { const FLc = FLOOR_LED, col = new T.Color(); for (let i = 0; i < FLc.cols * FLc.rows; i++) { const cx = i % FLc.cols, cz = Math.floor(i / FLc.cols), w = Math.sin(ts * 2.1 + cx * 0.9 + cz * 0.55) * 0.5 + 0.5; col.setHSL((hue0 * 2 + cx * 0.08 + cz * 0.05) % 1, 1, 0.06 + 0.2 * w + 0.3 * b * (((cx + cz + ((ts * 2) | 0)) % 3 === 0) ? 1 : 0.2)); cl.led.setColorAt(i, col); } cl.led.instanceColor.needsUpdate = true; }
  if (cl.ball) cl.ball.rotation.y += d * 0.6;
  BEAMS.forEach((q, i) => { q.pv.rotation.x = Math.sin(ts * q.sp + q.ph) * q.amp; q.pv.rotation.z = Math.cos(ts * q.sp * 0.8 + q.ph) * q.amp; q.bm.material.color.setHSL((hue0 * 1.5 + i * 0.13) % 1, 1, 0.55); q.bm.material.opacity = 0.1 + 0.14 * b + 0.02 * night; });
  cl.lasers.forEach((l, i) => { l.rotation.y = ts * (0.5 + i * 0.13) + i * 1.3; l.rotation.x = 0.5 + Math.sin(ts * 0.7 + i) * 0.35; l.visible = cl.live ? b > 0.1 || (i % 2 === 0) : (i % 2 === 0); });
  SPK.forEach(s => { s.m.scale.set(1 + 0.12 * b, 1, 1 + 0.12 * b); });
  if (cl.screen) cl.screen.material.color.setHSL((hue0 * 1.2 + 0.05) % 1, 1, 0.35 + 0.2 * b);
  bills.forEach(q => { if (!q.on) return; q.u += d / 0.7; const dd = q.d; if (q.u >= 1) { q.on = false; q.m.visible = false; return; } q.m.position.set(q.a[0] + (dd.px - q.a[0]) * q.u, q.a[1] + (FS + 1.3 - q.a[1]) * q.u + Math.sin(q.u * PI) * 0.6, q.a[2] + (dd.pz - q.a[2]) * q.u); q.m.rotation.set(q.u * 9, q.u * 7, 0); });
});

// ====================================================== CONSTRUÇÃO E LIGAÇÃO ======================================================
cl.build = () => {
  if (cl.built) return; cl.built = true; grp = cl.group = new T.Group(); H.group.add(grp); B = H.Batch(); mats();
  buildLot(); buildShell(); buildBar(); buildStage(); buildFurniture(); buildLights(); buildMusicPanel(); buildOrderBottles(); buildDancers(); B.flush(grp); drawPanel();
};
function resetClub() { cl.orders.length = 0; cl.glasses.forEach(o => { if (o.g.parent) o.g.parent.remove(o.g); }); cl.glasses.length = 0; cl.poses = cl.poses.filter(n => npc.list.indexOf(n) >= 0); }
{ const enter0 = H.enter, exit0 = H.exit;
  H.enter = function () { const r = enter0.apply(this, arguments); try { if (!cl.built) cl.build(); resetClub(); if (npc.built && !cl.spawned) { cl.spawned = true; spawn(); } } catch (e) { VR.log('clube: ' + e.message + ' ' + ((e.stack || '').split('\n')[1] || '')); } return r; };
  H.exit = function () { try { musicOff(); resetClub(); } catch (e) {} return exit0.apply(this, arguments); };
}
})();
