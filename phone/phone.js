/* SKZ VR (celular): mostra o vídeo do jogo que roda no PC, toca o som, e manda giroscópio + câmera para o PC.
   Correção de cabeça: a cada quadro o vídeo é girado pela diferença entre o giroscópio de agora e o de "latência" ms atrás. */
(() => {
'use strict';
const $ = id => document.getElementById(id), D2R = Math.PI / 180, PORT = 8080;
const IN_APP = !/Safari\//.test(navigator.userAgent);                      // dentro do app (WKWebView) o UA não tem "Safari/": o iOS libera o som sem toque
const rv = $('rv'), out = $('out'), body = document.body;
const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const qs = new URLSearchParams(location.search);
const pcInput = $('pc'); pcInput.value = qs.get('pc') || ls.get('vrpc', '');
const pcHost = () => { let v = (pcInput.value || '').trim().replace(/^[a-z]+:\/\//i, '').replace(/[\/?#].*$/, ''); if (v && !/:\d+$/.test(v)) v += ':' + PORT; return v; };

let running = false, ws = null, wsOpened = false, wsTimer = 0, pc = null, dc = null, camStream = null, remote = null;
let vrOn = false, warp = ls.get('vrwarp', '1') !== '0', lat = Math.max(0, Math.min(250, +ls.get('vrlat', '60') || 60)), status = '', statusT = 0, rtcState = '-';
const say = (m, bad) => { status = m; statusT = performance.now(); const el = $('msg'); el.textContent = m; el.className = bad ? 'err' : ''; };

// ---------- quaternions (a mesma fórmula do jogo no PC, para a cabeça bater certinho) ----------
const qmul = (a, b) => [a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1], a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2], a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = q => [-q[0], -q[1], -q[2], q[3]];
const Q1 = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
function rawQuat(alpha, beta, gamma, angDeg) {                              // Euler 'YXZ' (beta, alpha, -gamma) × q1 × giro da tela
  const x = beta * D2R, y = alpha * D2R, z = -gamma * D2R, c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  const e = [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3], a = -angDeg * D2R;
  return qmul(qmul(e, Q1), [0, 0, Math.sin(a / 2), Math.cos(a / 2)]);
}
function qmat(q) {                                                           // matriz 3×3 (coluna por coluna, para o WebGL)
  const [x, y, z, w] = q, xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return new Float32Array([1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy)]);
}
const hist = [];                                                             // histórico do giroscópio (≈1 s)
function qAt(t) {
  if (!hist.length) return null;
  if (t <= hist[0].t) return hist[0].q; const last = hist[hist.length - 1]; if (t >= last.t) return last.q;
  let i = hist.length - 1; while (i > 0 && hist[i - 1].t > t) i--;
  const a = hist[i - 1], b = hist[i], k = (t - a.t) / Math.max(b.t - a.t, 1e-6); let s = a.q[0] * b.q[0] + a.q[1] * b.q[1] + a.q[2] * b.q[2] + a.q[3] * b.q[3] < 0 ? -1 : 1;
  const q = [0, 1, 2, 3].map(j => a.q[j] * (1 - k) + s * b.q[j] * k), n = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map(v => v / n);
}
const screenAng = () => (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);

// ---------- sensores → PC ----------
function onOri(e) {
  if (![e.alpha, e.beta, e.gamma].every(Number.isFinite)) return;
  const ang = screenAng(), now = performance.now();
  hist.push({ t: now, q: rawQuat(e.alpha, e.beta, e.gamma, ang) }); while (hist.length > 90 || (hist.length > 2 && now - hist[0].t > 1500)) hist.shift();
  if (!running) return;
  const s = e.alpha.toFixed(2) + ',' + e.beta.toFixed(2) + ',' + e.gamma.toFixed(2) + ',' + ang;
  if (dc && dc.readyState === 'open') { try { dc.send(s); } catch (er) {} }
  else if (ws && ws.readyState === 1) ws.send(s);                            // plano B: pelo servidor
}
async function askPerms() {
  const reqs = [];
  if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) reqs.push(DeviceOrientationEvent.requestPermission());
  if (window.DeviceMotionEvent && DeviceMotionEvent.requestPermission) reqs.push(DeviceMotionEvent.requestPermission());
  const r = await Promise.all(reqs); if (r.some(x => x !== 'granted')) throw new Error('Permissão de movimento negada. Ajustes do iPhone > SKZ VR (ou Safari) > Movimento e orientação.');
}
async function openCam() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Este app não tem acesso à câmera.');
  const tries = [{ facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, min: 30 } }, { facingMode: 'environment' }, true]; let err;
  for (const v of tries) { try { camStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: v }); return; } catch (e) { err = e; if (e.name === 'NotAllowedError') break; } }
  throw new Error(err && err.name === 'NotAllowedError' ? 'Permissão de câmera negada. Ajustes do iPhone > SKZ VR > Câmera.' : 'Não consegui abrir a câmera: ' + (err && err.message));
}

// ---------- conexão com o PC ----------
let wsGen = 0;
function hostsToTry() {                                                        // tenta o IP digitado (e, se faltar o último trecho, avisa)
  return pcHost();
}
async function probePc(host) {                                                 // testa se o servidor responde (HTTP) para dizer o motivo certo
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = setTimeout(() => { try { ctl && ctl.abort(); } catch (e) {} }, 4000);
  try { const r = await fetch('http://' + host + '/info?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined }); clearTimeout(tm); return r.ok ? 'ok' : 'http' + r.status; }
  catch (e) { clearTimeout(tm); return 'fail'; }
}
async function explainFail() {
  const host = pcHost(), r = await probePc(host); if (!running) return;
  if (r === 'ok') say('O servidor do PC responde, mas a ligação em tempo real (WebSocket) falhou. Feche o app, abra de novo e toque em Conectar. Se repetir, reinicie o iniciar.bat.', true);
  else say('Não consegui falar com o PC em ' + host + '.\n1) O IP é o da janela preta? (confira cada número)\n2) iPhone e PC no MESMO Wi-Fi (sem rede de convidados)?\n3) Ajustes do iPhone > SKZ VR > Rede local LIGADO.\n4) Rode o iniciar.bat de novo e aceite o pedido de administrador (ele libera o Firewall).\nTeste: no Safari do iPhone abra http://' + host + '/info — deve aparecer um texto com o IP.', true);
}
function connectWs() {
  clearTimeout(wsTimer); if (!running) return;
  const host = hostsToTry(), url = 'ws://' + host + '/ws?role=phone', my = ++wsGen;
  try { ws = new WebSocket(url); } catch (e) { say('Endereço do PC inválido.', true); return; }
  const mine = ws; wsOpened = false;
  const giveUp = setTimeout(() => {                                          // o iOS pode ficar minutos "conectando" se o Firewall descarta o pacote
    if (mine !== ws || wsOpened || my !== wsGen || !running) return;
    try { mine.onclose = null; mine.close(); } catch (e) {} ws = null;
    explainFail(); wsTimer = setTimeout(connectWs, 3000);
  }, 6000);
  ws.onopen = () => { clearTimeout(giveUp); wsOpened = true; say('Conectado ao servidor. Esperando o jogo abrir no PC…'); };
  ws.onmessage = e => { if (mine !== ws || typeof e.data !== 'string') return; let m; try { m = JSON.parse(e.data); } catch (er) { return; } onMsg(m); };
  ws.onerror = () => {};
  ws.onclose = () => {
    clearTimeout(giveUp);
    if (mine !== ws || !running) return; closeRtc();
    if (wsOpened) say('Perdi a conexão com o PC. Reconectando…'); else explainFail();
    wsTimer = setTimeout(connectWs, 2500);
  };
}
function onMsg(m) {
  if (m.t === 'peer' && m.role === 'host') { if (m.on) startRtc(); else { closeRtc(); say('Esperando o jogo abrir no PC…'); } }
  else if (m.t === 'answer' && pc) pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(e => say('Erro na conexão: ' + e.message, true));
  else if (m.t === 'ice' && pc && pc.remoteDescription) pc.addIceCandidate(m.c).catch(() => {});
  else if (m.t === 'vr') { vrOn = !!m.on; $('bVR').classList.toggle('on', vrOn); }
}
const sendWs = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
function startPlay() {
  rv.muted = false; const p = rv.play();
  if (p && p.catch) p.catch(() => { rv.muted = true; const p2 = rv.play(); if (p2 && p2.catch) p2.catch(() => {}); say('Toque na tela para ligar o som.'); });
}
const unmute = () => { if (!running) return; if (rv.muted) rv.muted = false; const p = rv.play(); if (p && p.catch) p.catch(() => {}); };
['pointerdown', 'touchstart', 'click'].forEach(ev => document.addEventListener(ev, unmute, { capture: true, passive: true }));
function closeRtc() { try { if (pc) pc.close(); } catch (e) {} pc = null; dc = null; remote = null; rv.srcObject = null; }
async function startRtc() {
  closeRtc(); say('Conectando ao jogo…');
  const c = pc = new RTCPeerConnection({ iceServers: [] });
  dc = c.createDataChannel('s', { ordered: false, maxRetransmits: 0 });
  c.addTransceiver(camStream.getVideoTracks()[0], { direction: 'sendrecv', streams: [camStream] });   // câmera ida, jogo volta (mesmo vídeo)
  c.addTransceiver('audio', { direction: 'recvonly' });                                              // som do jogo
  c.onicecandidate = e => { if (e.candidate && pc === c) sendWs({ t: 'ice', c: e.candidate }); };
  c.ontrack = e => {
    if (pc !== c) return;
    try { if (e.receiver) { if ('jitterBufferTarget' in e.receiver) e.receiver.jitterBufferTarget = 0; if ('playoutDelayHint' in e.receiver) e.receiver.playoutDelayHint = 0; } } catch (er) {}   // menos fila de vídeo = menos atraso
    if (!remote) remote = new MediaStream(); remote.addTrack(e.track); rv.srcObject = remote; rv.muted = false;
    startPlay();
  };
  c.onconnectionstatechange = () => { if (pc !== c) return; rtcState = c.connectionState; if (rtcState === 'failed') say('A conexão com o PC falhou. Mesmo Wi-Fi? Firewall do Windows em Redes privadas?', true); };
  try {
    const off = await c.createOffer(); await c.setLocalDescription(off);
    sendWs({ t: 'offer', sdp: off.sdp, w: innerWidth, h: innerHeight });
  } catch (e) { say('Erro ao conectar: ' + e.message, true); }
}

// ---------- tela: vídeo simples ou com correção de cabeça (WebGL) ----------
let vf = 0;
if (rv.requestVideoFrameCallback) { const cb = () => { newFrame = true; vf++; rv.requestVideoFrameCallback(cb); }; rv.requestVideoFrameCallback(cb); }
let gl = null, prog = null, tex = null, U = {}, newFrame = true, blackN = 0, frameN = 0;
const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
const FS = 'precision highp float;varying vec2 uv;uniform sampler2D tex;uniform mat3 R;uniform vec2 tn;uniform float vr;' +
  'void main(){vec2 q=uv;float h=0.;if(vr>0.5){h=uv.x<0.5?0.:0.5;q.x=(uv.x-h)*2.;}' +
  'vec3 r=R*vec3((q.x*2.-1.)*tn.x,(q.y*2.-1.)*tn.y,-1.);' +
  'vec2 n=vec2(0.);if(r.z<-0.0001)n=vec2(r.x/(-r.z)/tn.x,r.y/(-r.z)/tn.y);' +
  'n=clamp(n,-0.999,0.999);vec2 s=n*0.5+0.5;if(vr>0.5)s.x=s.x*0.5+h;gl_FragColor=vec4(texture2D(tex,s).rgb,1.);}';
function initGL() {
  try {
    gl = out.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); if (!gl) throw new Error('sem WebGL');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const k of ['tex', 'R', 'tn', 'vr']) U[k] = gl.getUniformLocation(prog, k);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.uniform1i(U.tex, 0);
    return true;
  } catch (e) { gl = null; return false; }
}
function setWarp(on, quiet) {
  if (on && !gl && !initGL()) { on = false; if (!quiet) say('Correção de cabeça indisponível neste aparelho (WebGL). Usando o vídeo simples.', true); }
  warp = on; body.classList.toggle('warp', on); $('bWp').classList.toggle('on', on); ls.set('vrwarp', on ? '1' : '0'); blackN = 0; newFrame = true;
}
const tanHalf = d => Math.tan(d * D2R / 2);
function draw() {
  requestAnimationFrame(draw); frameN++;
  if (!warp || !gl || !rv.videoWidth || rv.readyState < 2) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
  if (out.width !== W || out.height !== H) { out.width = W; out.height = H; }
  gl.viewport(0, 0, W, H);
  if (newFrame || !rv.requestVideoFrameCallback) { newFrame = false; try { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rv); } catch (e) { setWarp(false); say('Correção de cabeça falhou; usando o vídeo simples.', true); return; } }
  const now = performance.now(), qn = qAt(now), qt = qAt(now - lat); let R = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  if (qn && qt) R = qmat(qmul(qinv(qt), qn));                                // do olhar de agora para o olhar que o vídeo mostra
  const vw = rv.videoWidth, vh = rv.videoHeight, tv = vrOn ? tanHalf(90) : tanHalf(75), ta = vrOn ? (vw / 2) / vh : vw / vh;
  gl.uniformMatrix3fv(U.R, false, R); gl.uniform2f(U.tn, tv * ta, tv); gl.uniform1f(U.vr, vrOn ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  if (frameN % 45 === 0) {                                                   // se a imagem sair toda preta por ~2 s, volta para o vídeo simples
    const px = new Uint8Array(4); let sum = 0;
    for (const [fx, fy] of [[.5, .5], [.25, .5], [.75, .5], [.5, .25], [.5, .75], [.15, .3], [.85, .7]]) { gl.readPixels(Math.floor(W * fx), Math.floor(H * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
    blackN = sum === 0 ? blackN + 1 : 0;
    if (blackN >= 3) { setWarp(false); say('A correção de cabeça saiu preta; voltei para o vídeo simples.', true); }
  }
}

// ---------- barra de controles ----------
const btn = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); fn(); });
const setLat = v => { lat = Math.max(0, Math.min(250, v)); ls.set('vrlat', String(lat)); $('lat').textContent = lat + ' ms'; };
btn('bVR', () => { vrOn = !vrOn; $('bVR').classList.toggle('on', vrOn); sendWs({ t: 'ctl', c: 'vr', on: vrOn }); });
btn('bRe', () => sendWs({ t: 'ctl', c: 'recenter' }));
btn('bWp', () => setWarp(!warp));
btn('bLm', () => setLat(lat - 10)); btn('bLp', () => setLat(lat + 10));
btn('bX', () => stop());
let barT = 0;
const toggleBar = () => { const b = $('bar'); b.classList.toggle('on'); clearTimeout(barT); if (b.classList.contains('on')) barT = setTimeout(() => b.classList.remove('on'), 12000); };
[rv, out].forEach(el => el.addEventListener('pointerdown', () => { if (running) { try { rv.play(); } catch (e) {} toggleBar(); } }));

// ---------- iniciar / sair ----------
function stop() {
  running = false; clearTimeout(wsTimer); closeRtc(); try { if (ws) { const w = ws; ws = null; w.close(); } } catch (e) {}
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  body.classList.remove('run'); $('intro').style.display = ''; $('bar').classList.remove('on'); $('go').disabled = false; say('Desconectado.');
}
$('go').onclick = async () => {
  $('go').disabled = true; say('Pedindo permissões…');
  try {
    if (!pcHost()) throw new Error('Digite o IP do PC (aparece na janela preta do servidor).');
    ls.set('vrpc', pcInput.value.trim());
    await askPerms(); await openCam();
    running = true; body.classList.add('run'); setWarp(warp, true); say('Procurando o PC…'); connectWs();
  } catch (e) { say(e.message || String(e), true); $('go').disabled = false; }
};
addEventListener('deviceorientation', onOri);
requestAnimationFrame(draw); setLat(lat); $('bWp').classList.toggle('on', warp);

// ---------- diagnóstico e estado ----------
let lastFrames = 0, lastT = performance.now(), fps = 0;
setInterval(() => {
  const q = rv.getVideoPlaybackQuality ? rv.getVideoPlaybackQuality() : null, frames = Math.max(q ? q.totalVideoFrames : 0, vf), now = performance.now();
  fps = Math.round((frames - lastFrames) * 1000 / Math.max(now - lastT, 1)); lastFrames = frames; lastT = now;
  $('stat').textContent = fps + ' fps';
  if (running && rv.srcObject) {                                                                  // parado ou sem som? tenta voltar COM som (no app o iOS deixa; no Safari só depois de um toque)
    if (rv.paused || (rv.muted && IN_APP)) { rv.muted = false; const pp = rv.play(); if (pp && pp.catch) pp.catch(() => { if (rv.paused) { rv.muted = true; const p3 = rv.play(); if (p3 && p3.catch) p3.catch(() => {}); } }); }
    if (!rv.muted && rv.volume < 1) rv.volume = 1;
  }
  const live = running && rv.videoWidth > 0;
  if (live && $('intro').style.display !== 'none') $('intro').style.display = 'none';
  if (running && !live && $('intro').style.display === 'none') $('intro').style.display = '';
  $('dbg').textContent = 'v2 ' + (rv.paused ? 'PARADO ' : 'tocando ') + (rv.muted ? 'sem-som ' : 'com-som ') + '\n' + (status && now - statusT < 6000 ? status + '\n' : '') + 'ws ' + (ws ? ['conectando', 'aberto', 'fechando', 'fechado'][ws.readyState] : '-') + '  pc ' + rtcState + '  sensor ' + (hist.length ? 'ok' : 'não') +
    '\nvídeo ' + rv.videoWidth + 'x' + rv.videoHeight + ' quadros ' + frames + (warp ? '  correção ' + lat + 'ms' : '  simples');
  $('dbg').classList.toggle('on', running && (frames < 5 || $('bar').classList.contains('on') || now - statusT < 6000));
}, 500);
})();
