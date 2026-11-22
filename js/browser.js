/* Navegador dentro do VR: janela 3D que mostra um Chrome/Edge do PC (controlado pelo server.js em /br).
   A imagem vira textura de um plano 3D (por isso também aparece no vídeo que vai para o celular).
   Toque/pinça: clica. Arrastar: rola a página (ou arrasta, no modo "Arrastar"). Clicou num campo de texto: abre o teclado do VR. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, ui = VR.ui, C = ui.C, UPM = ui.UPM, clamp = VR.clamp;
const VX = 25, VY = 164, VW = 1120, VH = 630;                              // retângulo da página dentro da janela (px da textura)
const HOME = 'https://www.google.com/', ZOOMS = [640, 800, 960, 1120, 1280];
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const st = { ws: null, msg: '', bad: false, url: ls.get('brurl') || '', title: '', zoom: ZOOMS.includes(+ls.get('brzoom')) ? +ls.get('brzoom') : 960, drag: ls.get('brdrag') === '1', frame: false, ed: false, lastClick: 0 };
const NATIVE = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.vrbrowser);      // dentro do app do iPhone (sem PC)
const send = o => { if (NATIVE) { try { window.webkit.messageHandlers.vrbrowser.postMessage(JSON.stringify(o)); } catch (e) {} } else if (st.ws && st.ws.readyState === 1) st.ws.send(JSON.stringify(o)); };
const say = (m, bad) => { st.msg = m; st.bad = !!bad; br.dirty = true; if (bad && VR.toast) VR.toast(m.slice(0, 68), 5000); };
const pct = () => Math.round(VW / st.zoom * 100) + '%';

// ---------- endereço digitado → URL ou pesquisa ----------
function norm(v) {
  v = (v || '').trim(); if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^about:/i.test(v)) return v;
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/\S*)?$/.test(v)) return 'http://' + v;
  if (!/\s/.test(v) && (/^localhost(:\d+)?(\/|$)/i.test(v) || /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(v))) return 'https://' + v;
  return 'https://www.google.com/search?q=' + encodeURIComponent(v);
}
const go = v => { const u = norm(v); if (u) { st.url = u; send({ t: 'nav', url: u }); br.dirty = true; } };

// ---------- teclado do VR: o que você digita vai para o campo da página ----------
function typeOpen(label) {
  if (!VR.kb) return; let prev = '';
  VR.kb.open({ label: label || 'Digitar na página', value: '', max: 400,
    onChange(v) {
      let k = 0; const n = Math.min(prev.length, v.length); while (k < n && prev[k] === v[k]) k++;
      for (let i = 0; i < prev.length - k && i < 200; i++) send({ t: 'key', k: 'Backspace' });
      if (v.length > k) send({ t: 'text', s: v.slice(k) });
      prev = v;
    },
    onEnter() { send({ t: 'key', k: 'Enter' }); } });
}
function urlOpen() {
  if (!VR.kb) { let v = ''; try { v = prompt('Endereço ou pesquisa:', st.url) || ''; } catch (e) {} go(v); return; }
  VR.kb.open({ label: 'Endereço ou pesquisa', value: st.url === 'about:blank' ? '' : st.url, max: 500, onEnter: go });
}
const setZoom = d => { const i = clamp(ZOOMS.indexOf(st.zoom) + d, 0, ZOOMS.length - 1); if (ZOOMS[i] === st.zoom) return; st.zoom = ZOOMS[i]; ls.set('brzoom', st.zoom); send({ t: 'view', w: st.zoom }); VR.toast && VR.toast('Zoom ' + pct()); br.dirty = true; };

// ---------- widgets novos ----------
const D = ui.D, rr = ui.rr;
const bg = w => w.prs ? C.rowP : w.hov ? C.rowH : C.row;
D.ibtn = (g, w) => { rr(g, w.x, w._y, w.w, w.h, 18); g.fillStyle = bg(w); g.fill(); ui.icon(g, w.icon, w.x + w.w / 2, w._y + w.h / 2, 32, '#fff', 2.1); };
D.tbtn = (g, w) => {
  rr(g, w.x, w._y, w.w, w.h, 18); g.fillStyle = bg(w); g.fill(); const lab = typeof w.label === 'function' ? w.label() : w.label;
  if (w.icon) { ui.icon(g, w.icon, w.x + 34, w._y + w.h / 2, 30, '#fff'); ui.text(g, lab, w.x + 62, w._y + w.h / 2, 25, C.txt, 'left', 600); }
  else ui.text(g, lab, w.x + w.w / 2, w._y + w.h / 2, 26, C.txt, 'center', 700);
};
D.ubar = (g, w) => {
  rr(g, w.x, w._y, w.w, w.h, 32); g.fillStyle = w.prs ? 'rgba(0,0,0,.55)' : w.hov ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.35)'; g.fill();
  let s = (w.label() || 'Toque para digitar um endereço').replace(/^https?:\/\/(www\.)?/, ''); g.font = '500 26px ' + ui.FONT;
  if (g.measureText(s).width > w.w - 52) { while (s.length > 4 && g.measureText(s + '…').width > w.w - 52) s = s.slice(0, -1); s += '…'; }
  ui.text(g, s, w.x + 26, w._y + w.h / 2, 26, st.url ? C.txt : C.dim);
};

// ---------- janela ----------
const br = ui.panel({ id: 'br', mw: (VX + VW + 25) / UPM, mh: (VY + VH + 25) / UPM, title: 'Navegador', titleIcon: 'tv', dist: 1.5, dy: 0.1, order: 11, keep: true,
  onOpen: () => { prevVis = true; if (NATIVE) { say('Abrindo o navegador…'); sendOpen(); return; } if (!st.ws || st.ws.readyState > 1) connect(); else if (st.ws.readyState === 1) sendOpen(); },
  extra(g) {
    g.fillStyle = '#0b0d12'; rr(g, VX, VY, VW, VH, 10); g.fill();
    if (!st.frame || st.bad) { ui.text(g, st.msg || 'Abrindo…', VX + VW / 2, VY + VH / 2, 32, st.bad ? C.bad : C.dim, 'center'); }
  },
  build() {
    const y = 84, h = 64, ib = (x, icon, fn) => ({ t: 'ibtn', x, y, w: 66, h, icon, onClick: fn });
    return [ib(25, 'back', () => send({ t: 'cmd', c: 'back' })), ib(99, 'chev', () => send({ t: 'cmd', c: 'forward' })), ib(173, 'refresh', () => send({ t: 'cmd', c: 'reload' })), ib(247, 'home', () => go(HOME)),
      { t: 'ubar', x: 321, y, w: 404, h, label: () => st.url, onClick: urlOpen },
      { t: 'tbtn', x: 733, y, w: 130, h, label: () => st.drag ? 'Arrastar' : 'Rolar', onClick: () => { st.drag = !st.drag; ls.set('brdrag', st.drag ? '1' : '0'); VR.toast && VR.toast(st.drag ? 'Arrastar: segurar e mover seleciona/arrasta' : 'Rolar: segurar e mover rola a página'); br.dirty = true; } },
      { t: 'tbtn', x: 871, y, w: 130, h, icon: 'keyboard', label: 'Digitar', onClick: () => typeOpen() },
      { t: 'tbtn', x: 1009, y, w: 62, h, label: '−', onClick: () => setZoom(-1) }, { t: 'tbtn', x: 1079, y, w: 66, h, label: '+', onClick: () => setZoom(1) }];
  } });

// ---------- imagem da página como textura (plano na frente da janela) ----------
const pg = document.createElement('canvas'); pg.width = VW; pg.height = VH; const pgx = pg.getContext('2d'); pgx.fillStyle = '#0b0d12'; pgx.fillRect(0, 0, VW, VH);
const tex = new T.CanvasTexture(pg); tex.colorSpace = T.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter; tex.anisotropy = 4;
const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, fog: false, toneMapped: false, opacity: 0 });
const mesh = new T.Mesh(new T.PlaneGeometry(VW / UPM, VH / UPM), mat); mesh.renderOrder = br.order + 1; mesh.visible = false;
mesh.position.set((VX + VW / 2 - br.W / 2) / UPM, (br.H / 2 - (VY + VH / 2)) / UPM, 0.003); br.g.add(mesh);
let seq = 0, shown = 0;
function onFrame(buf) {
  const my = ++seq;
  createImageBitmap(new Blob([buf], { type: 'image/jpeg' })).then(bm => {
    if (my < shown) { bm.close && bm.close(); return; } shown = my;
    pgx.drawImage(bm, 0, 0, VW, VH); bm.close && bm.close(); tex.needsUpdate = true;
    if (!st.frame) { st.frame = true; br.dirty = true; }
  }).catch(() => {});
}

// ---------- mensagens do navegador (PC pelo WebSocket, ou app do iPhone direto) ----------
function onMsg(m) {
  if (m.t === 'info') {
    st.url = m.url; st.title = m.title; ls.set('brurl', m.url); br.dirty = true;
    if (m.ed && !st.ed && performance.now() - st.lastClick < 2500 && VR.kb && !VR.kb.isOpen()) typeOpen();      // clicou num campo de texto → teclado
    st.ed = !!m.ed;
  } else if (m.t === 'st') say(m.msg); else if (m.t === 'ready') say(''); else if (m.t === 'err') say('Navegador: ' + m.msg, true);
}
let fetching = false;
function nativeTick() {                                                                                    // o app avisa que tem foto nova; busca no servidor local do app
  if (fetching) return; fetching = true;
  fetch('/__br/frame.jpg?' + Date.now(), { cache: 'no-store' }).then(r => r.arrayBuffer()).then(b => { fetching = false; if (b.byteLength > 1000) onFrame(b); }).catch(() => { fetching = false; });
}

// ---------- conexão com o servidor ----------
function sendOpen() { send({ t: 'open', url: st.url || HOME, vw: st.zoom }); }
function connect() {
  if (!/^https?:$/.test(location.protocol)) { say('Abra o jogo pelo servidor do PC (iniciar.bat) para usar o navegador.', true); return; }
  say('Conectando ao servidor…'); st.frame = false;
  let opened = false; const ws = st.ws = new WebSocket('ws://' + location.host + '/br'); ws.binaryType = 'arraybuffer';
  ws.onopen = () => { opened = true; sendOpen(); };
  ws.onmessage = e => {
    if (typeof e.data !== 'string') { onFrame(e.data); return; }
    let m; try { m = JSON.parse(e.data); } catch (er) { return; }
    onMsg(m);
  };
  ws.onclose = () => { if (st.ws === ws) { st.ws = null; st.frame = false; say(opened ? 'Conexão perdida. Feche e abra a janela.' : 'Só funciona no modo PC (a janela preta do servidor precisa estar aberta).', true); } };
}

// ---------- ponteiros (chamado pelo ui_kit para cada ponteiro que aponta para esta janela) ----------
const ps = [0, 1, 2].map(() => ({ seen: -1, down: false, nx: 0, ny: 0, sx: 0, sy: 0, py: 0, px: 0, moved: false, mode: 'tap', acc: 0, accX: 0, tMove: 0, tWheel: 0 }));
const VHc = () => st.zoom * 9 / 16, GAIN = 1.4;
let fn = 0, prevVis = false;
function finish(i, nx, ny) {
  const s = ps[i]; if (!s.down) return; s.down = false;
  if (s.mode === 'drag') send({ t: 'm', k: 'up', x: nx, y: ny });
  else if (!s.moved) { send({ t: 'm', k: 'move', x: s.sx, y: s.sy }); send({ t: 'm', k: 'down', x: s.sx, y: s.sy }); send({ t: 'm', k: 'up', x: s.sx, y: s.sy }); st.lastClick = performance.now(); }
  else if (s.acc || s.accX) { send({ t: 'wheel', x: nx, y: ny, dx: s.accX, dy: s.acc }); s.acc = s.accX = 0; }
}
br.onPtr = (i, hit, press, down) => {
  const s = ps[i], u = hit.u - VX, v = hit.v - VY, inside = u >= 0 && u <= VW && v >= 0 && v <= VH;
  if (!inside && !s.down) return;
  s.seen = fn; const nx = clamp(u / VW, 0, 1), ny = clamp(v / VH, 0, 1), now = performance.now();
  if (press && inside) {
    s.down = true; s.moved = false; s.mode = st.drag ? 'drag' : 'tap'; s.sx = s.px = nx; s.sy = s.py = ny; s.acc = s.accX = 0;
    if (s.mode === 'drag') { send({ t: 'm', k: 'move', x: nx, y: ny }); send({ t: 'm', k: 'down', x: nx, y: ny }); st.lastClick = now; }
  } else if (s.down && !down) { finish(i, nx, ny); }
  else if (s.down) {
    if (s.mode === 'drag') { if (now - s.tMove > 33) { s.tMove = now; send({ t: 'm', k: 'move', x: nx, y: ny, d: 1 }); } }
    else {
      if (!s.moved && Math.hypot((nx - s.sx) * st.zoom, (ny - s.sy) * VHc()) > 16) { s.moved = true; s.px = nx; s.py = ny; }
      if (s.moved) {
        s.acc += (s.py - ny) * VHc() * GAIN; s.accX += (s.px - nx) * st.zoom * GAIN; s.py = ny; s.px = nx;
        if (now - s.tWheel > 33 && (Math.abs(s.acc) >= 1 || Math.abs(s.accX) >= 1)) { s.tWheel = now; send({ t: 'wheel', x: nx, y: ny, dx: s.accX, dy: s.acc }); s.acc = s.accX = 0; }
      }
    }
  } else if (!NATIVE && now - s.tMove > 40 && (Math.abs(nx - s.nx) + Math.abs(ny - s.ny)) > 0.0008) { s.tMove = now; send({ t: 'm', k: 'move', x: nx, y: ny }); }   // só passando o raio: efeito de "hover"
  s.nx = nx; s.ny = ny;
};
VR.hook(31, () => {
  for (let i = 0; i < 3; i++) { const s = ps[i]; if (s.down && s.seen !== fn) finish(i, s.nx, s.ny); }      // o raio saiu da janela com o dedo fechado
  fn++;
  if (br.vis !== prevVis) { prevVis = br.vis; if (!br.vis) send({ t: 'stop' }); }
  mesh.visible = br.g.visible && st.frame && !st.bad; mat.opacity = br.mat.opacity;
});

// roda do mouse sobre a página
VR.$('scene').addEventListener('wheel', e => {
  if (!S.started || !br.vis) return;
  const mo = ui.mouse; if (!mo.on) return; const hit = ui.hitPanels(mo.o, mo.d);
  if (!hit || hit.panel !== br) return; const u = hit.u - VX, v = hit.v - VY; if (u < 0 || u > VW || v < 0 || v > VH) return;
  send({ t: 'wheel', x: u / VW, y: v / VH, dx: e.deltaX, dy: e.deltaY }); e.preventDefault(); e.stopImmediatePropagation();
}, { passive: false, capture: true });

VR.browser = { nativeTick, nativeMsg: onMsg, toggle() { ui.toggleWin('br'); }, open(u) { if (u) { st.url = norm(u); } ui.openWin('br'); if (u) go(u); }, go };
})();
