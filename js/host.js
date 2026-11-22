/* Modo PC (?host=1): o jogo roda aqui e o celular só mostra a imagem.
   Celular → PC: câmera (para as mãos) e giroscópio.  PC → celular: vídeo do jogo e som. */
(() => {
'use strict';
if (!/[?&]host=1/.test(location.search)) return;
const VR = window.VR, S = VR.S, $ = VR.$, log = VR.log;
VR.host = true;
const qs = new URLSearchParams(location.search);
const STREAM_H = Math.max(360, Math.min(1080, +qs.get('h') || 720));      // altura do vídeo enviado (menos = mais leve e menos atraso)
const FPS = Math.max(30, Math.min(90, +qs.get('fps') || 60));
const MBPS = Math.max(4, Math.min(40, +qs.get('mbps') || 16));

// ajustes do modo PC: modelo preciso das mãos, resolução fixa 1×, cabeça "crua" (o celular corrige o atraso com o giroscópio dele)
S.cx = 1; S.res = 2; S.headPred = 0; S.smoothHead = 0.05; S.debug = false;

// ---------- painel de estado (canto da janela do PC) ----------
const bar = document.createElement('div'); bar.id = 'hostBar';
bar.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99999;font:14px/1.4 -apple-system,Segoe UI,sans-serif;color:#fff;background:rgba(10,18,40,.88);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:8px 12px;max-width:440px;pointer-events:none';
document.body.appendChild(bar);
let ips = [], hide = 0;
const say = (m, bad) => { bar.style.display = 'block'; bar.style.borderColor = bad ? '#ff8a7a' : 'rgba(255,255,255,.25)'; bar.innerHTML = m; clearTimeout(hide); if (!bad && /pronto|Conectado/.test(m)) hide = setTimeout(() => { bar.style.display = 'none'; }, 8000); };
const waitMsg = () => say('📱 <b>Esperando o celular.</b><br>No app, digite o IP do PC: <b>' + (ips.length ? ips.join(' ou ') : '(veja a janela preta)') + '</b>');
fetch('/info').then(r => r.json()).then(j => { ips = j.ips || []; if (!phoneOn) waitMsg(); }).catch(() => {});

// ---------- som: todos os AudioContext do jogo viram um só, que sai para o celular em vez do alto-falante do PC ----------
const RealAC = window.AudioContext || window.webkitAudioContext;
let ac = null, adest = null;
function getAC() {
  if (ac || !RealAC) return ac;
  ac = new RealAC({ latencyHint: 'interactive' }); adest = ac.createMediaStreamDestination();
  Object.defineProperty(ac, 'destination', { get: () => adest });
  return ac;
}
if (RealAC) { function FakeAC() { return getAC(); } FakeAC.prototype = RealAC.prototype; window.AudioContext = window.webkitAudioContext = FakeAC; }
const wake = () => { try { const c = getAC(); if (c && c.state !== 'running') c.resume().catch(() => {}); } catch (e) {} };
['pointerdown', 'keydown', 'click'].forEach(e => addEventListener(e, wake, { capture: true, passive: true })); setInterval(wake, 1500);
// avisos no canto de baixo: som parado (o navegador só libera o som depois de um clique/tecla; botão de controle não conta) e controle sem foco (o navegador só lê o controle com a janela em foco)
const hint = document.createElement('div');
hint.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99999;font:14px/1.4 -apple-system,Segoe UI,sans-serif;color:#fff;background:rgba(120,40,20,.92);border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:8px 12px;max-width:360px;display:none';
document.body.appendChild(hint);
let padSeen = false; addEventListener('gamepadconnected', () => { padSeen = true; });
setInterval(() => {
  const m = [];
  if (ac && ac.state !== 'running') m.push('🔇 <b>Som parado.</b> Clique uma vez nesta janela (botão do controle não conta) para o som tocar no celular.');
  if (padSeen && !document.hasFocus()) m.push('🎮 <b>Janela sem foco.</b> Clique nela para o controle voltar a funcionar.');
  hint.innerHTML = m.join('<br>'); hint.style.display = m.length ? 'block' : 'none';
}, 1000);

// ---------- câmera do celular → rastreador de mãos ----------
let camStream = null; const cam = $('cam');
async function attachCam() {
  if (!camStream) throw new Error('A câmera do celular ainda não chegou. Conecte o celular primeiro.');
  cam.srcObject = camStream; cam.muted = true; await cam.play(); VR.camOn = true; log('câmera do celular ligada');
}
VR.tracker.startCamera = attachCam;
VR.tracker.retryCam = async () => { try { await attachCam(); if (!S.handsReady) await VR.tracker.startHands(); VR.status('Câmera do celular ligada.'); if (S.pass) VR.setPass(true); } catch (e) { VR.status(e.message); } };
VR.camMsg = e => (e && e.message) || 'Falha na câmera do celular.';

// ---------- giroscópio do celular → o mesmo evento que o jogo já usa ----------
function onOrient(s) {
  const p = s.split(','); if (p.length < 4) return;
  const a = +p[0], b = +p[1], g = +p[2], ang = +p[3];
  if (!(isFinite(a) && isFinite(b) && isFinite(g))) return;
  VR.fakeAngle = isFinite(ang) ? ang : 90;
  const ev = new Event('deviceorientation'); ev.alpha = a; ev.beta = b; ev.gamma = g; dispatchEvent(ev);
}

// ---------- conexão ----------
let ws = null, pc = null, dc = null, phoneOn = false, info = { w: 1334, h: 750 }, queue = Promise.resolve(), vtrack = null, lastVR = null, gen = 0;
const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

function setSize(w, h) {                                                   // tamanho do vídeo = proporção da tela do celular
  const H = Math.round(STREAM_H / 2) * 2, W = Math.min(2400, Math.round(H * (w / h) / 2) * 2);
  VR.hostW = W; VR.hostH = H; VR.renderer.setPixelRatio(1); dispatchEvent(new Event('resize'));
  log('vídeo para o celular: ' + W + 'x' + H + ' @' + FPS);
}
function closePc() { gen++; try { if (pc) pc.close(); } catch (e) {} pc = null; dc = null; }

async function onOffer(m) {
  closePc(); const my = gen;
  if (m.w && m.h) info = { w: m.w, h: m.h };
  setSize(info.w, info.h); getAC(); wake();
  const c = pc = VR.hostPc = new RTCPeerConnection({ iceServers: [] });
  c.onicecandidate = e => { if (e.candidate && my === gen) send({ t: 'ice', c: e.candidate }); };
  c.ondatachannel = e => { dc = e.channel; dc.onmessage = ev => { if (typeof ev.data === 'string') onOrient(ev.data); }; };
  c.ontrack = e => {
    if (e.track.kind !== 'video') return;
    camStream = new MediaStream([e.track]); log('câmera do celular chegou');
    if (!S.started) setTimeout(() => { if (!S.started) { say('Conectado. Iniciando…'); $('start').click(); } }, 300);
    else attachCam().catch(er => log('câmera: ' + er.message));
  };
  c.onconnectionstatechange = () => {
    if (my !== gen) return; const st = c.connectionState; log('conexão com o celular: ' + st);
    if (st === 'connected') say('✅ Celular conectado — pronto.');
    else if (st === 'failed') say('A conexão com o celular falhou. Confira se os dois estão no mesmo Wi-Fi e se o Firewall do Windows permitiu o Chrome/Edge em <b>Redes privadas</b>.', true);
    else if (st === 'disconnected') say('Conexão com o celular oscilou…', true);
  };
  await c.setRemoteDescription({ type: 'offer', sdp: m.sdp });
  // vídeo do jogo (canvas) e som do jogo
  const cs = $('scene').captureStream(FPS); vtrack = cs.getVideoTracks()[0]; try { vtrack.contentHint = 'motion'; } catch (e) {}
  getAC(); if (ac && ac.state !== 'running') ac.resume().catch(() => {});                        // garante o canal de som mesmo se nada tocou ainda
  for (const t of c.getTransceivers()) {
    const kind = t.receiver && t.receiver.track && t.receiver.track.kind;
    try {
      if (kind === 'video') {
        t.direction = 'sendrecv'; await t.sender.replaceTrack(vtrack);
        if (t.setCodecPreferences && RTCRtpSender.getCapabilities) {              // H.264 usa o chip de vídeo do PC e do celular: menos calor e menos atraso
          const caps = RTCRtpSender.getCapabilities('video').codecs, h264 = caps.filter(x => /h264/i.test(x.mimeType)), rest = caps.filter(x => !/h264/i.test(x.mimeType));
          if (h264.length) t.setCodecPreferences([...h264, ...rest]);
        }
      } else if (kind === 'audio') {
        t.direction = 'sendonly'; await t.sender.replaceTrack(adest.stream.getAudioTracks()[0]);
      }
    } catch (e) { log('transceiver ' + kind + ': ' + e.message); }
  }
  const ans = await c.createAnswer(); await c.setLocalDescription(ans);
  send({ t: 'answer', sdp: ans.sdp });
  try {                                                                         // taxa de bits alta, prioriza fluidez
    for (const s of c.getSenders()) if (s.track && s.track.kind === 'video') { const p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}]; p.encodings[0].maxBitrate = MBPS * 1e6; p.encodings[0].maxFramerate = FPS; p.degradationPreference = 'maintain-framerate'; await s.setParameters(p); }
  } catch (e) { log('parâmetros do vídeo: ' + e.message); }
}

// ---------- controle de movimento (2º celular, ex.: Galaxy A14): aponta um raio e o gatilho clica/pega ----------
const D2R = Math.PI / 180, pad = { t: 0, on: false, need: true, off: 0, d: null };
function onPad(m) {
  const T = VR.T, a = m.a * D2R, b = m.b * D2R;
  if (!isFinite(a) || !isFinite(b)) return;
  const ex = -Math.sin(a) * Math.cos(b), ey = Math.cos(a) * Math.cos(b), ez = Math.sin(b);      // para onde o topo do celular aponta (leste, norte, cima)
  const yaw = Math.atan2(ex, ey), pitch = Math.asin(Math.max(-1, Math.min(1, ez)));              // yaw 0 = norte; positivo = direita
  if (pad.need || m.c) {                                                                         // calibrar: onde o celular aponta agora = para onde a cabeça olha agora
    const f = new T.Vector3(0, 0, -1).applyQuaternion(VR.headQ); pad.off = Math.atan2(f.x, -f.z) - yaw; pad.need = false; pad.d = null;
    VR.toast && VR.toast('Controle calibrado');
  }
  const y = yaw + pad.off, cp = Math.cos(pitch), d = new T.Vector3(Math.sin(y) * cp, Math.sin(pitch), -Math.cos(y) * cp);
  if (pad.d) { pad.d.lerp(d, 0.65).normalize(); } else pad.d = d;
  const mo = VR.ui && VR.ui.mouse; if (!mo) return;
  mo.o.copy(VR.HEAD); mo.d.copy(pad.d); mo.on = true; mo.down = !!m.d;
  if (!pad.on) { pad.on = true; log('controle conectado'); VR.toast && VR.toast('Controle conectado'); }
  pad.t = performance.now();
}
setInterval(() => { if (pad.on && performance.now() - pad.t > 800) { pad.on = false; pad.need = true; const mo = VR.ui && VR.ui.mouse; if (mo) { mo.on = false; mo.down = false; } } }, 300);

function onMsg(raw) {
  if (raw.charAt(0) !== '{') { onOrient(raw); return; }                        // giroscópio que veio pelo servidor (se o canal direto falhar)
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (m.t === 'peer' && m.role === 'phone') {
    phoneOn = m.on;
    if (m.on) say('📱 Celular encontrado. Conectando…'); else { closePc(); waitMsg(); }
  } else if (m.t === 'pad') onPad(m);
  else if (m.t === 'offer') queue = queue.then(() => onOffer(m)).catch(e => { log('oferta: ' + e.message); say('Erro ao conectar: ' + e.message, true); });
  else if (m.t === 'ice') queue = queue.then(() => { if (pc && pc.remoteDescription) return pc.addIceCandidate(m.c); }).catch(() => {});
  else if (m.t === 'ctl') {
    if (m.c === 'recenter') VR.recenter();
    else if (m.c === 'vr') { S.vr = !!m.on; VR.save(); VR.main.setHud(); lastVR = S.vr; }
  }
}
function connect() {
  ws = new WebSocket('ws://' + location.host + '/ws?role=host');
  ws.onopen = () => { log('servidor ok'); waitMsg(); lastVR = null; };
  ws.onmessage = e => { if (typeof e.data === 'string') onMsg(e.data); };
  ws.onclose = () => { say('Sem conexão com o servidor (a janela preta foi fechada?). Tentando de novo…', true); setTimeout(connect, 1500); };
}
connect();
setInterval(() => { if (lastVR !== S.vr) { lastVR = S.vr; send({ t: 'vr', on: S.vr }); } }, 150);   // o Modo VR também pode ser ligado dentro do jogo
})();
