/* Navegador dentro do VR — parte do PC (sem instalar nada: usa o Chrome/Edge que já existe).
   Abre um Chrome/Edge invisível (headless) com perfil próprio, controla pelo protocolo DevTools (CDP)
   e manda a imagem (JPEG) para a janela "Navegador" do VR pelo WebSocket em /br.
   Só aceita conexão do próprio PC (localhost). */
'use strict';
const http = require('http'), crypto = require('crypto'), cp = require('child_process'), os = require('os'), path = require('path');

// ---------- WebSocket mínimo (usado nos dois lados: aceitar o jogo e falar com o Chrome) ----------
function enc(op, payload, mask) {
  const n = payload.length, mb = mask ? 0x80 : 0; let h;
  if (n < 126) h = Buffer.from([0x80 | op, mb | n]);
  else if (n < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = mb | 126; h.writeUInt16BE(n, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = mb | 127; h.writeBigUInt64BE(BigInt(n), 2); }
  if (!mask) return Buffer.concat([h, payload]);
  const m = crypto.randomBytes(4), body = Buffer.alloc(n);
  for (let i = 0; i < n; i++) body[i] = payload[i] ^ m[i & 3];
  return Buffer.concat([h, m, body]);
}
function makeParser(onFrame, onBad) {
  let buf = Buffer.alloc(0), frags = [], fop = 1;
  return d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = !!(buf[0] & 0x80), op = buf[0] & 15, masked = !!(buf[1] & 0x80); let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 64e6) { onBad(); return; }
      const need = off + (masked ? 4 : 0) + len; if (buf.length < need) return;
      let p = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const m = buf.subarray(off, off + 4), o = Buffer.alloc(len); for (let i = 0; i < len; i++) o[i] = p[i] ^ m[i & 3]; p = o; } else p = Buffer.from(p);
      buf = buf.subarray(need);
      if (op >= 8) { onFrame(op, p); continue; }
      if (op !== 0) fop = op;
      frags.push(p); if (!fin) continue;
      const full = frags.length === 1 ? frags[0] : Buffer.concat(frags); frags = [];
      onFrame(fop, full);
    }
  };
}
function wsConnect(url, onText, onClose) {                                  // cliente WebSocket (para o Chrome)
  return new Promise((resolve, reject) => {
    const u = new URL(url), key = crypto.randomBytes(16).toString('base64');
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13' } });
    req.on('upgrade', (res, socket, head) => {
      socket.setNoDelay(true);
      const parse = makeParser((op, p) => { if (op === 9) socket.write(enc(10, p, true)); else if (op === 1) onText(p.toString('utf8')); else if (op === 8) socket.destroy(); }, () => socket.destroy());
      if (head && head.length) parse(head);
      socket.on('data', parse); socket.on('close', onClose); socket.on('error', onClose);
      resolve({ send: t => { try { socket.write(enc(1, Buffer.from(t), true)); } catch (e) {} }, close: () => socket.destroy() });
    });
    req.on('response', res => reject(new Error('o navegador recusou a conexão (' + res.statusCode + ')')));
    req.on('error', reject); req.end();
  });
}

// ---------- módulo ----------
module.exports = function init(opt) {
  const { findBrowser, log, GUID } = opt;
  const PORT = +process.env.BR_PORT || 9333, DIR = path.join(os.homedir(), '.vr-stream-navegador');
  const OUT_W = 1120, OUT_H = 630;                                           // tamanho da imagem enviada (igual à área da página na janela do VR)
  const HACK = "(()=>{try{window.open=function(u){if(u)location.href=u;return null};document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[target]');if(a&&a.target!=='_self')a.target='_self'},true)}catch(e){}})()";
  const EXPR = "JSON.stringify([location.href,document.title,(function(){var a=document.activeElement;if(!a)return 0;if(a.isContentEditable||a.tagName==='TEXTAREA')return 1;if(a.tagName==='INPUT')return /^(checkbox|radio|button|submit|range|color|file|image|reset|hidden)$/i.test(a.type)?0:1;return 0})()])";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let child = null, cdp = null, ready = null, cid = 0, client = null, vw = 960, casting = false, infoTimer = null, idleTimer = null, lastInfo = '';
  const pend = new Map();

  const getJson = (p, method) => new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method: method || 'GET' }, s => { let d = ''; s.on('data', c => d += c); s.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
    r.on('error', rej); r.setTimeout(3000, () => r.destroy(new Error('timeout'))); r.end();
  });
  const call = (method, params) => new Promise((res, rej) => {
    if (!cdp) return rej(new Error('navegador desconectado'));
    const id = ++cid; pend.set(id, { res, rej }); cdp.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pend.delete(id)) rej(new Error('tempo esgotado: ' + method)); }, 15000);
  });
  const fire = (method, params) => { if (cdp) cdp.send(JSON.stringify({ id: ++cid, method, params: params || {} })); };   // sem esperar resposta (mouse, teclado)
  const sendJ = o => { if (client && !client.socket.destroyed) try { client.socket.write(enc(1, Buffer.from(JSON.stringify(o)), false)); } catch (e) {} };

  // ---------- imagem: no máximo ~30 quadros/s, sempre entrega o último ----------
  let lastFrame = null, lastSent = 0, timer = null;
  function queueFrame(buf) { lastFrame = buf; if (timer) return; timer = setTimeout(flush, Math.max(0, 33 - (Date.now() - lastSent))); }
  function flush() {
    timer = null; if (!client || !lastFrame) return;
    if (client.socket.writableLength > 1.5e6) { timer = setTimeout(flush, 50); return; }           // o jogo não está dando conta: pula quadros
    const f = lastFrame; lastFrame = null; lastSent = Date.now();
    try { client.socket.write(enc(2, f, false)); } catch (e) {}
  }
  function onCdp(text) {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (m.id) { const p = pend.get(m.id); if (p) { pend.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result || {}); } return; }
    if (m.method === 'Page.screencastFrame') { const q = m.params; fire('Page.screencastFrameAck', { sessionId: q.sessionId }); queueFrame(Buffer.from(q.data, 'base64')); }
  }

  // ---------- abrir / reaproveitar o navegador ----------
  function ensure() {
    if (ready) return ready;
    ready = (async () => {
      let v = await getJson('/json/version').catch(() => null);
      if (!v) {
        const exe = findBrowser(); if (!exe) throw new Error('Não achei o Chrome nem o Edge no PC.');
        log('[NAVEGADOR] abrindo ' + path.basename(exe) + ' invisível (perfil em ' + DIR + ')');
        child = cp.spawn(exe, ['--headless=new', '--remote-debugging-port=' + PORT, '--remote-debugging-address=127.0.0.1', '--remote-allow-origins=*', '--user-data-dir=' + DIR,
          '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--lang=pt-BR', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
        child.on('error', e => log('[NAVEGADOR] erro ao abrir: ' + e.message));
        child.on('exit', () => { child = null; cdp = null; ready = null; casting = false; });
        for (let i = 0; i < 60 && !v; i++) { await sleep(250); v = await getJson('/json/version').catch(() => null); }
        if (!v) throw new Error('O navegador do PC não respondeu.');
      }
      const list = await getJson('/json/list');
      const page = list.find(t => t.type === 'page') || await getJson('/json/new?about:blank', 'PUT');
      cdp = await wsConnect(page.webSocketDebuggerUrl, onCdp, () => { cdp = null; ready = null; casting = false; });
      await call('Page.enable');
      await call('Emulation.setUserAgentOverride', { userAgent: String(v['User-Agent'] || '').replace('HeadlessChrome', 'Chrome'), acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8' });
      await call('Page.addScriptToEvaluateOnNewDocument', { source: HACK });
      return true;
    })().catch(e => { ready = null; throw e; });
    return ready;
  }
  process.on('exit', () => { try { if (child) child.kill(); } catch (e) {} });

  // ---------- tela ----------
  async function setView(w) {
    vw = Math.max(480, Math.min(1600, Math.round(w || vw)));
    await call('Emulation.setDeviceMetricsOverride', { width: vw, height: Math.round(vw * 9 / 16), deviceScaleFactor: OUT_W / vw, mobile: false });
  }
  async function startCast() {
    await call('Page.stopScreencast').catch(() => {});
    await call('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: OUT_W, maxHeight: OUT_H, everyNthFrame: 1 });
    casting = true; lastInfo = ''; clearInterval(infoTimer); infoTimer = setInterval(pollInfo, 500);
  }
  function stopCast() {
    clearInterval(infoTimer); infoTimer = null;
    if (casting) { casting = false; call('Page.stopScreencast').catch(() => {}); }
  }
  function pollInfo() {
    if (!casting) return;
    call('Runtime.evaluate', { expression: EXPR, returnByValue: true }).then(r => {
      const s = r && r.result && r.result.value; if (!s || s === lastInfo) return; lastInfo = s;
      const a = JSON.parse(s); sendJ({ t: 'info', url: a[0], title: a[1], ed: !!a[2] });
    }).catch(() => {});
  }

  // ---------- pedidos vindos da janela do VR ----------
  const KEYS = { Enter: [13, '\r'], Backspace: [8, ''], Tab: [9, ''], Escape: [27, ''], ArrowUp: [38, ''], ArrowDown: [40, ''], ArrowLeft: [37, ''], ArrowRight: [39, ''] };
  async function start(m) {
    try {
      sendJ({ t: 'st', msg: 'Abrindo o navegador do PC…' });
      await ensure(); await setView(m.vw);
      const cur = await call('Runtime.evaluate', { expression: 'location.href', returnByValue: true }).catch(() => null);
      if (m.url && (!cur || !cur.result || cur.result.value === 'about:blank')) await call('Page.navigate', { url: m.url });
      await startCast(); sendJ({ t: 'ready' });
    } catch (e) { log('[NAVEGADOR] ' + e.message); sendJ({ t: 'err', msg: e.message }); }
  }
  function onClient(text) {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    const x = Math.round((m.x || 0) * vw), y = Math.round((m.y || 0) * vw * 9 / 16);
    switch (m.t) {
      case 'open': start(m); break;
      case 'stop': stopCast(); break;
      case 'view': if (cdp) setView(m.w).then(() => casting && startCast()).catch(() => {}); break;
      case 'nav': if (cdp && /^(https?|about|file):/i.test(m.url || '')) call('Page.navigate', { url: m.url }).catch(() => {}); break;
      case 'cmd': if (!cdp) break; if (m.c === 'reload') fire('Page.reload'); else fire('Runtime.evaluate', { expression: m.c === 'back' ? 'history.back()' : 'history.forward()' }); break;
      case 'm': fire('Input.dispatchMouseEvent', { type: m.k === 'down' ? 'mousePressed' : m.k === 'up' ? 'mouseReleased' : 'mouseMoved', x, y, button: m.k === 'move' && !m.d ? 'none' : 'left', buttons: m.k === 'up' || (m.k === 'move' && !m.d) ? 0 : 1, clickCount: m.k === 'move' ? 0 : 1 }); break;
      case 'wheel': fire('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: +m.dx || 0, deltaY: +m.dy || 0 }); break;
      case 'text': if (typeof m.s === 'string' && m.s) fire('Input.insertText', { text: m.s.slice(0, 500) }); break;
      case 'key': { const k = KEYS[m.k]; if (!k) break; const o = { key: m.k, code: m.k, windowsVirtualKeyCode: k[0], nativeVirtualKeyCode: k[0] }; if (k[1]) { o.text = k[1]; o.unmodifiedText = k[1]; }
        fire('Input.dispatchKeyEvent', Object.assign({ type: k[1] ? 'keyDown' : 'rawKeyDown' }, o)); fire('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, o)); break; }
    }
  }

  // ---------- conexão /br (chamada pelo server.js) ----------
  // aceita só o próprio PC: localhost OU o endereço de rede do próprio PC (quando o jogo é aberto por http://192.168.x.x:8080)
  function isThisPc(ra) {
    if (ra === '127.0.0.1' || ra === '::1') return true;
    for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.address === ra) return true;
    return false;
  }
  function upgrade(req, socket) {
    let u; try { u = new URL(req.url, 'http://x'); } catch (e) { return false; }
    if (u.pathname !== '/br') return false;
    const ra = (socket.remoteAddress || '').replace('::ffff:', ''), key = req.headers['sec-websocket-key'];
    if (!key || !isThisPc(ra)) { log('[NAVEGADOR] recusado (só aceita o próprio PC): ' + ra); socket.destroy(); return true; }
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
    socket.setNoDelay(true);
    const c = { socket }, old = client; client = c; clearTimeout(idleTimer); if (old) try { old.socket.destroy(); } catch (e) {}
    const parse = makeParser((op, p) => { if (op === 8) socket.end(); else if (op === 9) socket.write(enc(10, p, false)); else if (op === 1) onClient(p.toString('utf8')); }, () => socket.destroy());
    socket.on('data', parse);
    const gone = () => { if (client === c) { client = null; idleTimer = setTimeout(stopCast, 20000); } };
    socket.on('close', gone); socket.on('error', gone); socket.on('end', gone);
    log('[NAVEGADOR] janela do VR conectou');
    return true;
  }
  return { upgrade };
};
