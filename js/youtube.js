/* Janela "Link" dentro do VR (YouTube, vídeo direto .mp4/.webm, ou qualquer página que permita ser embutida): dois iframes (um por olho) posicionados sobre a janela 3D */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, ui = VR.ui, C = ui.C, UPM = ui.UPM, clamp = VR.clamp;
let id = '', list = '', kind = '', url = '', playing = true, loaded = '';
const parseYT = v => { v = (v || '').trim(); let i = '', l = ''; const m = v.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || v.match(/^([\w-]{11})$/); if (m) i = m[1]; const q = v.match(/[?&]list=([\w-]+)/); if (q) l = q[1]; return { id: i, list: l }; };
const MEDIA = /\.(mp4|webm|mov|m4v|ogv)$/i, YTHOST = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;
function parseLink(v) {                                                   // devolve { kind: 'yt' | 'media' | 'url', ... } ou null
  v = (v || '').trim(); if (!v || /\s/.test(v)) return null;
  if (/^[\w-]{11}$/.test(v)) return { kind: 'yt', id: v, list: '' };
  let o; try { o = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); } catch (e) { return null; }
  if (!/^https?:$/.test(o.protocol) || !/^[^.]+(\.[^.]+)+$/.test(o.hostname)) return null;
  if (YTHOST.test(o.hostname)) { const r = parseYT(o.href); if (r.id || r.list) return { kind: 'yt', id: r.id, list: r.list }; }
  const host = o.hostname.replace(/^www\./, ''), vm = host === 'vimeo.com' && o.pathname.match(/^\/(\d+)/);
  if (vm) return { kind: 'url', url: 'https://player.vimeo.com/video/' + vm[1] + '?autoplay=1&loop=1' };
  return { kind: MEDIA.test(o.pathname) ? 'media' : 'url', url: o.href };
}
const has = () => !!(id || list || url);
function apply(r) { kind = r.kind; id = r.id || ''; list = r.list || ''; url = r.url || ''; }
function setLink(v) { const r = parseLink(v); if (!r) return false; apply(r); try { localStorage.setItem('ytlink', v); } catch (e) {} if (yt.vis) load(); yt.dirty = true; return true; }
try { const v = localStorage.getItem('ytlink'); const r = v && parseLink(v); if (r) apply(r); } catch (e) {}
const box = document.createElement('div'); box.id = 'ytBox'; document.body.appendChild(box);
const eyes = [0, 1].map(i => { const w = document.createElement('div'); w.className = 'eye'; const f = document.createElement('iframe'); f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.setAttribute('playsinline', ''); w.appendChild(f); box.appendChild(w); return { w, f, on: false }; });
const src = i => { const q = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', enablejsapi: '1', controls: '0', modestbranding: '1', mute: i ? '1' : '0' }); if (list) q.set('list', list); else if (id) { q.set('loop', '1'); q.set('playlist', id); } return 'https://www.youtube.com/embed/' + (id || 'videoseries') + '?' + q; };
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const mediaDoc = i => '<!doctype html><body style="margin:0;background:#000;overflow:hidden"><video src="' + esc(url) + '" autoplay loop playsinline' + (i ? ' muted' : '') + ' style="width:100%;height:100%;object-fit:contain"></video><script>var v=document.querySelector("video");addEventListener("message",function(e){var m;try{m=JSON.parse(e.data)}catch(x){return}if(m.event!=="command")return;if(m.func==="playVideo")v.play();else if(m.func==="pauseVideo")v.pause();else if(m.func==="setVolume"&&' + (i ? 'false' : 'true') + ')v.volume=m.args[0]/100})<\/script>';
function load() {
  const key = kind + '|' + id + '|' + list + '|' + url; if (!has() || loaded === key) return; loaded = key;
  eyes.forEach((e, i) => { e.f.removeAttribute('srcdoc'); if (kind === 'yt') e.f.src = src(i); else if (kind === 'media') e.f.srcdoc = mediaDoc(i); else e.f.src = url; });
  setTimeout(() => setVolume(S.ytVol), 2500);
}
const cmd = (func, args, both) => eyes.forEach((e, i) => { if ((both || i === 0) && e.f.contentWindow) try { e.f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (er) {} });
function setVolume(v) { S.ytVol = v; cmd('setVolume', [v]); }
const VX = 25, VY = 86, VW = 720, VH = 405;
const yt = ui.panel({ id: 'yt', mw: 1.1, mh: 0.88, title: 'Link', titleIcon: 'tv', dist: 1.7, dy: 0.12, order: 11, onOpen: () => { load(); if (loaded) { playing = true; cmd('playVideo', [], true); } },
  extra(g) {
    g.fillStyle = '#000'; g.fillRect(VX, VY, VW, VH);
    if (!has()) { ui.text(g, 'Nenhum link escolhido.', yt.W / 2, VY + VH / 2 - 24, 30, '#aab', 'center'); ui.text(g, 'Use "Alterar link" ou cole o link na tela inicial (YouTube, vídeo, site).', yt.W / 2, VY + VH / 2 + 24, 24, '#889', 'center'); }
  },
  build(p) {
    const y = VY + VH + 14, mk = (x, w, label, icon, fn) => ({ t: 'button', x, y, w, h: 74, label, icon, chev: false, onClick: fn });
    return [mk(25, 210, () => playing ? 'Pausar' : 'Tocar', 'play', () => { playing = !playing; cmd(playing ? 'playVideo' : 'pauseVideo', [], true); p.dirty = true; }),
      mk(250, 130, '− Vol', null, () => { setVolume(clamp(S.ytVol - 10, 0, 100)); VR.save(); }), mk(392, 130, '+ Vol', null, () => { setVolume(clamp(S.ytVol + 10, 0, 100)); VR.save(); }),
      mk(535, 210, 'Alterar link', null, () => {
        const apply = v => { if (v && !setLink(v)) VR.toast('Link não reconhecido'); };
        if (VR.kb) { let cur = ''; try { cur = localStorage.getItem('ytlink') || ''; } catch (e) {} VR.kb.open({ label: 'Link', value: cur, onEnter: apply }); return; }   // teclado dentro do VR (o prompt() não aparece na tela dividida)
        let v = ''; try { v = prompt('Cole o link:', localStorage.getItem('ytlink') || '') || ''; } catch (e) {} apply(v); })];
  } });
yt.fixedNoSc = true;
const pv = new T.Vector3(), pw = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3();
function sync(w, h) {
  const show = yt.vis && yt.anim > 0.9 && yt.g.visible && has() && !S.obs;
  if (!show) { eyes.forEach(e => { if (e.on) { e.w.style.display = 'none'; e.on = false; } }); if (yt._wasOn) { yt._wasOn = false; cmd('pauseVideo', [], true); } return; }
  if (!yt._wasOn) { yt._wasOn = true; if (playing) cmd('playVideo', [], true); }
  yt.g.updateMatrixWorld(true);
  a.set((VX - yt.W / 2) / UPM, (yt.H / 2 - VY) / UPM, 0); b.set((VX + VW - yt.W / 2) / UPM, (yt.H / 2 - VY - VH) / UPM, 0); yt.g.localToWorld(a); yt.g.localToWorld(b);
  const eye = [{ cam: S.vr ? VR.camL : VR.camMain, x: 0, w: S.vr ? (w / 2) * S.eyeW : w }, { cam: VR.camR, x: 0, w: (w / 2) * S.eyeW }];
  if (S.vr) { const ox = (w / 2 - eye[0].w) / 2; eye[0].x = ox; eye[1].x = w / 2 + ox; }
  eyes.forEach((e, i) => {
    if (i && !S.vr) { if (e.on) { e.w.style.display = 'none'; e.on = false; } return; }
    const v = eye[i], c = v.cam; pv.copy(a).project(c); pw.copy(b).project(c);
    if (pv.z > 1 || pw.z > 1) { if (e.on) { e.w.style.display = 'none'; e.on = false; } return; }
    const x0 = v.x + (pv.x * 0.5 + 0.5) * v.w, x1 = v.x + (pw.x * 0.5 + 0.5) * v.w, y0 = (-pv.y * 0.5 + 0.5) * h, y1 = (-pw.y * 0.5 + 0.5) * h;
    const s = e.w.style; s.display = 'block'; e.on = true; s.left = v.x + 'px'; s.top = '0px'; s.width = v.w + 'px'; s.height = h + 'px';
    const f = e.f.style; f.left = (x0 - v.x) + 'px'; f.top = y0 + 'px'; f.width = Math.max(1, x1 - x0) + 'px'; f.height = Math.max(1, y1 - y0) + 'px';
  });
}
VR.post.push(sync);
VR.yt = { setLink, setVolume, toggle() { if (!has() && !yt.vis) VR.toast('Escolha um link: "Alterar link" na janela'); ui.toggleWin('yt'); } };
})();
