/* Teste Modelo: mostra o personagem do arquivo assets/modelo_chel.glb num palco escuro, com painel de controles.
   - Rosto: 14 poses de boca (ossos) e 13 expressões (shape keys), piscar automático.
   - Corpo: respiração, olhar para você, cabeça, braços, dedos, balanço do cabelo / orelhas / rabo.
   - Partes ligáveis: cabelo, chifres, orelhas, mamilos, parte íntima (as duas últimas começam desligadas).
   O esqueleto só tem UMA pose de corpo (pose_corpo); o resto do movimento é feito por código em cima dela. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, scene = VR.scene, HEAD = VR.HEAD, ui = VR.ui, C = ui.C;
const clamp = VR.clamp || ((v, a, b) => Math.max(a, Math.min(b, v)));
const md = VR.modelo = { on: false, ready: false, loading: false, err: '' };
const st = { mouth: 0, mouthFrom: null, mouthT: 1, blinkT: 3, blinkD: -1, yaw: 0, pitch: 0, rotPrev: 0, omega: 0, lag: 0, auto: 0, norm: 1, minY: 0, t: 0 }; md.st = st;
const URL_GLB = 'assets/modelo_chel.glb?v=1', DEG = Math.PI / 180, TARGET_H = 1.55;

// ---------- textos do painel ----------
const MOUTHS = [['default', 'Padrão'], ['smile', 'Sorriso'], ['smileteeth', 'Sorriso com dentes'], ['a', 'A'], ['aa', 'AA'], ['at', 'AT'], ['e', 'E'], ['i', 'I'], ['it', 'IT'], ['ot', 'OT'], ['u', 'U'], ['pout', 'Beicinho'], ['kiss', 'Beijo'], ['tongue', 'Língua']];
const EXPR = [['eb_up', 'Sobrancelha: para cima'], ['eb_down', 'Sobrancelha: para baixo'], ['eb_joy', 'Sobrancelha: alegre'], ['eb_unger', 'Sobrancelha: brava'], ['eb_sad', 'Sobrancelha: triste'], ['eb_serious', 'Sobrancelha: séria'],
  ['pupil_shrink', 'Pupila encolhida'], ['el_blink', 'Piscar'], ['el_smile', 'Olho sorrindo'], ['el_halfeye', 'Olho meio fechado'], ['el_jito', 'Olhar de desdém'], ['el_surprise', 'Olho surpreso'], ['el_underlidup', 'Pálpebra de baixo']];
const BODY = [['nipples', 'Forma: mamilos'], ['pattern', 'Forma: estampa'], ['extraboob', 'Forma: volume extra']];
const PARTS = [['hair', 'Cabelo', 'mdHair'], ['horn', 'Chifres', 'mdHorn'], ['ear', 'Orelhas', 'mdEar'], ['nippless', 'Mamilos', 'mdNip'], ['genital', 'Parte íntima', 'mdGen']];
// valores padrão (core.js copia as chaves de DEF; aqui só o lado do módulo)
md.DEF = { mdRot: 0, mdSpin: 0, mdScale: 1, mdDist: 2.0, mdMouth: 0, mdLook: true, mdBreath: true, mdSway: true, mdBlink: true, mdHeadYaw: 0, mdHeadPitch: 0, mdArmL: 0, mdArmR: 0, mdFingL: 0, mdFingR: 0, mdFingFlip: false,
  mdHair: true, mdHorn: true, mdEar: true, mdNip: false, mdGen: false };
EXPR.forEach((e, i) => { md.DEF['mdE' + i] = 0; }); BODY.forEach((e, i) => { md.DEF['mdB' + i] = 0; });
for (const k in md.DEF) if (!(k in S)) S[k] = md.DEF[k];

// ---------- estado ----------
let root, model, gltf, built = false, bones = {}, groups = {}, poseClips = {}, mouthBones = [], touched = [], base = {};
const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _v = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(), _m = new T.Matrix4(), _ax = new T.Vector3();
const AX = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };

// ---------- carregar ----------
function load() {
  if (built || md.loading) return; md.loading = true; md.err = '';
  if (!T.GLTFLoader) { md.err = 'GLTFLoader não carregou'; md.loading = false; return; }
  new T.GLTFLoader().load(URL_GLB, g => { try { setup(g); md.ready = true; VR.log('modelo: carregado'); } catch (e) { md.err = e.message; VR.log('modelo: ' + e.message); } md.loading = false; refreshPanel(); },
    null, e => { md.err = (e && e.message) || String(e); md.loading = false; VR.log('modelo: ' + md.err); refreshPanel(); });
}
function refreshPanel() { const p = ui.panels && ui.panels.modelo; if (p) p.dirty = true; }
function clipPose(clip) {                                                      // clip -> { osso: {p, q, s} } com o primeiro quadro
  const o = {};
  clip.tracks.forEach(tr => {
    const i = tr.name.lastIndexOf('.'), n = tr.name.slice(0, i), k = tr.name.slice(i + 1), c = k === 'quaternion' ? 4 : 3;
    (o[n] || (o[n] = {}))[k === 'position' ? 'p' : k === 'quaternion' ? 'q' : 's'] = Array.from(tr.values.slice(0, c));
  });
  return o;
}
function setup(g) {
  gltf = g; model = g.scene; built = true;
  g.skeletons[0].bones.forEach(b => { bones[b.name] = b; });
  model.traverse(o => { if (o.userData && o.userData.meshes) groups[o.name] = o; });
  g.animations.forEach(a => { poseClips[a.name] = clipPose(a); });
  const P = poseClips.pose_corpo; if (!P) throw new Error('pose_corpo não encontrada');
  for (const n in P) { const b = bones[n]; if (!b) continue; if (P[n].p) b.position.fromArray(P[n].p); if (P[n].q) b.quaternion.fromArray(P[n].q); if (P[n].s) b.scale.fromArray(P[n].s); }
  // ossos que mudam entre as poses de boca (só o rosto)
  const D = poseClips.mouth_default, ms = new Set();
  MOUTHS.forEach(([k]) => { const c = poseClips['mouth_' + k]; if (!c || !D) return; for (const n in c) { const a = c[n].q, b = D[n] && D[n].q; if (a && b && a.some((v, i) => Math.abs(v - b[i]) > 1e-5)) ms.add(n); else { const pa = c[n].p, pb = D[n] && D[n].p; if (pa && pb && pa.some((v, i) => Math.abs(v - pb[i]) > 1e-5)) ms.add(n); } } });
  mouthBones = Array.from(ms).filter(n => bones[n]);
  // ossos mexidos por código: guardam a pose base
  ['首', '頭', '目L', '目R', '上半身2', '肩L', '肩R', '腕L', '腕R', 'tail', 'earL', 'earR', 'haircbase'].forEach(n => { if (bones[n]) touched.push(bones[n]); });
  Object.keys(bones).forEach(n => { if (/^hair/.test(n) && !touched.includes(bones[n])) touched.push(bones[n]); });
  FING.forEach(f => f.chain.forEach(n => { if (bones[n] && !touched.includes(bones[n])) touched.push(bones[n]); }));
  touched.forEach(b => { base[b.name] = { q: b.quaternion.clone() }; });
  // altura e pés no chão
  model.updateMatrixWorld(true);
  const bb = new T.Box3(); ['body_0', 'head_0', 'hair_0', 'horn_0'].forEach(n => { const m = model.getObjectByName(n); if (m) { m.skeleton.update(); const b2 = new T.Box3().setFromObject(m); bb.union(b2); } });
  const feet = [bones['足首L'], bones['足首R'], bones['つま先L'], bones['つま先R']].filter(Boolean); let fy = Infinity; feet.forEach(b => { b.getWorldPosition(_v); fy = Math.min(fy, _v.y); });
  st.minY = isFinite(fy) ? Math.min(fy, bb.min.y) : bb.min.y; const h = bb.max.y - st.minY; st.norm = h > 0.2 ? TARGET_H / h : 1;
  root = new T.Group(); root.visible = false; scene.add(root);
  model.position.y = -st.minY; model.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  const pivot = new T.Group(); pivot.add(model); root.add(pivot); md.pivot = pivot;
  buildStage(); applyAll(true); root.visible = md.on && !S.pass;
}
let stage;
function buildStage() {
  stage = new T.Group(); root.add(stage);
  const disc = new T.Mesh(new T.CircleGeometry(1.0, 56), new T.MeshLambertMaterial({ color: 0x1a1d2b })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; stage.add(disc);
  const ring = new T.Mesh(new T.RingGeometry(1.0, 1.04, 64), new T.MeshBasicMaterial({ color: 0x6f8cff })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; stage.add(ring);
  const floor = new T.Mesh(new T.CircleGeometry(9, 48), new T.MeshLambertMaterial({ color: 0x0e1018 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001; stage.add(floor);
  md.rim = new T.DirectionalLight(0x9db4ff, 0.9); md.rim.position.set(-2.5, 3, -4); root.add(md.rim);
  md.fill = new T.DirectionalLight(0xffe2cc, 0.55); md.fill.position.set(3, 1.5, 2.5); root.add(md.fill);
}

// ---------- ferramentas de osso ----------
function rotChar(b, axis, ang) {                                               // gira o osso em torno de um eixo do personagem (x,y,z do mundo-personagem)
  if (!ang || !b) return; const par = b.parent; par.updateWorldMatrix(true, false);
  par.getWorldQuaternion(_q); root.getWorldQuaternion(_q2);                    // _q = rotação do pai, _q2 = rotação do personagem
  _ax.copy(axis).applyQuaternion(_q2); const d = new T.Quaternion().setFromAxisAngle(_ax, ang);   // delta no mundo
  b.quaternion.premultiply(_q2.copy(_q).invert().multiply(d).multiply(_q));    // pai^-1 * delta * pai * local
}
function rotWorldDir(b, from, to, k) {                                         // gira o osso para levar a direção "from" até "to" (mundo), fração k
  if (!b) return; const par = b.parent; par.updateWorldMatrix(true, false); par.getWorldQuaternion(_q);
  const d = new T.Quaternion().setFromUnitVectors(from, to); if (k !== 1) d.slerp(new T.Quaternion(), 1 - k);
  b.quaternion.premultiply(_q2.copy(_q).invert().multiply(d).multiply(_q));
}

// ---------- dedos ----------
const FING = [];
['L', 'R'].forEach(sd => { [['親指', 3, 1.0], ['人指', 4, 1.0], ['中指', 4, 1.0], ['薬指', 4, 1.0], ['小指', 4, 1.0]].forEach(([f, n, w]) => { const ch = []; for (let i = 0; i < n; i++) ch.push(f + '０１２３'[i] + sd); FING.push({ side: sd, chain: ch, thumb: f === '親指' }); }); });
const CURL = [0, 70, 80, 55];                                                  // graus por junta (de ０ a ３) em dedos; polegar usa 3 juntas
function curlFingers(side, amt) {
  if (amt <= 0.001) return;
  const sg = side === 'L' ? 1 : -1, flip = S.mdFingFlip ? -1 : 1;
  FING.forEach(f => {
    if (f.side !== side) return;
    f.chain.forEach((n, i) => {
      const b = bones[n], nx = bones[f.chain[i + 1]] || null; if (!b) return;
      const ang = (f.thumb ? [20, 35, 40][i] || 30 : CURL[i]) * DEG * amt; if (!ang) return;
      b.updateWorldMatrix(true, false); b.getWorldPosition(_v);
      if (nx) { nx.updateWorldMatrix(true, false); nx.getWorldPosition(_v2); } else { b.getWorldQuaternion(_q); _v2.set(0, 1, 0).applyQuaternion(_q).add(_v); }
      _v2.sub(_v).normalize();                                                 // direção do dedo
      root.getWorldQuaternion(_q2);                                            // para onde o dedo deve fechar: para dentro e um pouco para a frente (palma)
      _v3.set(-sg * 0.8 * flip, -0.1, 0.6 * flip).applyQuaternion(_q2).normalize();
      _ax.crossVectors(_v2, _v3); if (_ax.lengthSq() < 1e-6) return; _ax.normalize();
      b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(_q);
      const d = new T.Quaternion().setFromAxisAngle(_ax, ang);
      b.quaternion.premultiply(_q2.copy(_q).invert().multiply(d).multiply(_q));
    });
  });
}

// ---------- morphs ----------
function setMorph(group, name, v) { const gr = groups[group]; if (!gr) return; gr.userData.meshes.forEach(m => { const i = m.morphTargetDictionary && m.morphTargetDictionary[name]; if (i !== undefined) m.morphTargetInfluences[i] = v; }); }
function applyMouth(name) {
  const c = poseClips['mouth_' + name]; if (!c) return;
  st.mouthFrom = mouthBones.map(n => ({ n, p: bones[n].position.clone(), q: bones[n].quaternion.clone() })); st.mouthTo = c; st.mouthT = 0;
}
function stepMouth(dt) {
  if (st.mouthT >= 1 || !st.mouthFrom) return; st.mouthT = Math.min(1, st.mouthT + dt / 0.14); const k = st.mouthT * st.mouthT * (3 - 2 * st.mouthT);
  st.mouthFrom.forEach(f => { const t = st.mouthTo[f.n], b = bones[f.n]; if (!t) return; if (t.q) { _q.fromArray(t.q); b.quaternion.copy(f.q).slerp(_q, k); } if (t.p) { _v.fromArray(t.p); b.position.copy(f.p).lerp(_v, k); } });
}

// ---------- aplicar estado (partes, formas) ----------
function applyAll(force) {
  if (!built) return;
  PARTS.forEach(([g, , key]) => { if (groups[g]) groups[g].visible = !!S[key]; });
  BODY.forEach(([n], i) => setMorph('body', n, S['mdB' + i] || 0));
  const m = clamp(Math.round(S.mdMouth || 0), 0, MOUTHS.length - 1); if (force || m !== st.mouth) { st.mouth = m; applyMouth(MOUTHS[m][0]); }
}
md.applyAll = applyAll;
md.resetFace = () => { EXPR.forEach((e, i) => { S['mdE' + i] = 0; }); S.mdMouth = 0; VR.save(); refreshPanel(); };
md.resetAll = () => { for (const k in md.DEF) S[k] = md.DEF[k]; VR.save(); applyAll(); refreshPanel(); };

// ---------- quadro a quadro ----------
md.update = (dt, t) => {
  if (!md.on || !built || !root.visible) return;
  dt = Math.min(dt, 0.05); st.t += dt;
  // posição / giro / tamanho
  st.auto = (st.auto + (S.mdSpin || 0) * dt) % 360;
  const rotDeg = (S.mdRot || 0) + st.auto, rot = rotDeg * DEG, sc = (S.mdScale || 1) * st.norm;
  root.position.set(0, 0, -(S.mdDist || 2)); md.pivot.rotation.y = rot; md.pivot.scale.setScalar(sc);
  let dr = rot - st.rotPrev; if (dr > Math.PI) dr -= 2 * Math.PI; if (dr < -Math.PI) dr += 2 * Math.PI; st.rotPrev = rot;
  st.omega += ((dt > 0 ? dr / dt : 0) - st.omega) * Math.min(1, dt * 10); st.lag += (clamp(-st.omega * 0.045, -0.5, 0.5) - st.lag) * Math.min(1, dt * 6);
  root.updateMatrixWorld(true);
  // boca em transição
  stepMouth(dt);
  // restaura a pose base dos ossos mexidos por código
  touched.forEach(b => b.quaternion.copy(base[b.name].q));
  const sw = S.mdSway ? 1 : 0;
  // respiração
  if (S.mdBreath) { const bt = Math.sin(st.t * 1.7); rotChar(bones['上半身2'], AX.x, 0.018 * bt); rotChar(bones['肩L'], AX.z, 0.012 * bt); rotChar(bones['肩R'], AX.z, -0.012 * bt); }
  // olhar para o jogador (cabeça + olhos)
  let ty = 0, tp = 0;
  if (S.mdLook && bones['頭']) {
    bones['頭'].getWorldPosition(_v); _v2.copy(HEAD).sub(_v); _q.copy(md.pivot.getWorldQuaternion(_q2)).invert(); _v2.applyQuaternion(_q);   // direção no espaço do personagem (+Z = frente)
    ty = clamp(Math.atan2(_v2.x, _v2.z), -70 * DEG, 70 * DEG); tp = clamp(Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z)), -35 * DEG, 35 * DEG);
  }
  const k = Math.min(1, dt * 6); st.yaw += (ty - st.yaw) * k; st.pitch += (tp - st.pitch) * k;
  const hy = st.yaw + (S.mdHeadYaw || 0) * DEG, hp = -st.pitch + (S.mdHeadPitch || 0) * DEG;
  rotChar(bones['首'], AX.y, hy * 0.35); rotChar(bones['首'], AX.x, hp * 0.3);
  rotChar(bones['頭'], AX.y, hy * 0.45); rotChar(bones['頭'], AX.x, hp * 0.5);
  rotChar(bones['目L'], AX.y, clamp(st.yaw * 0.2, -0.2, 0.2)); rotChar(bones['目R'], AX.y, clamp(st.yaw * 0.2, -0.2, 0.2));
  // braços (levantar para o lado) e dedos
  rotChar(bones['腕L'], AX.z, (S.mdArmL || 0) * DEG); rotChar(bones['腕R'], AX.z, -(S.mdArmR || 0) * DEG);
  curlFingers('L', S.mdFingL || 0); curlFingers('R', S.mdFingR || 0);
  // balanço do cabelo, orelhas e rabo
  if (sw) Object.keys(bones).forEach((n, i) => {
    if (!/^(hair|ear|tail)/.test(n)) return; const b = bones[n], ph = (n.length * 1.7 + (n.charCodeAt(n.length - 1) % 5)) * 0.9, depth = /00[1-4]/.test(n) ? 1.6 : 1, e = /^ear/.test(n) ? 1.4 : 1;
    rotChar(b, AX.z, (Math.sin(st.t * 1.3 + ph) * 0.03 + st.lag * 0.6) * depth * e); rotChar(b, AX.x, Math.sin(st.t * 1.1 + ph * 1.3) * 0.02 * depth * e);
  });
  // piscar automático + expressões
  let blink = 0; st.blinkT -= dt;
  if (S.mdBlink) { if (st.blinkD < 0 && st.blinkT <= 0) { st.blinkD = 0; } if (st.blinkD >= 0) { st.blinkD += dt; const x = st.blinkD / 0.18; if (x >= 1) { st.blinkD = -1; st.blinkT = 2.2 + Math.random() * 3.5; } else blink = Math.sin(x * Math.PI); } }
  EXPR.forEach(([n], i) => { let v = S['mdE' + i] || 0; if (n === 'el_blink') v = Math.max(v, blink); setMorph('head', n, v); });
  applyAll(false);
};

// ---------- ambiente ----------
md.setVisible = (on, pass) => { md.on = on; if (root) root.visible = on && !pass; if (on) load(); };
md.enter = () => { md.on = true; load(); if (built) { applyAll(true); root.visible = true; } VR.bounds = { x0: -6, x1: 6, z0: -8, z1: 4 }; };
md.exit = () => { md.on = false; if (root) root.visible = false; if (ui.panels.modelo) ui.show(ui.panels.modelo, false); };
VR.hook(51, (dt, t) => { if (md.on) { try { md.update(dt, t); } catch (e) { if (!md._e) { md._e = 1; VR.log('modelo: ' + e.message); } } } });

// ---------- painel ----------
const R = {
  head: label => ({ t: 'head', h: 58, label }),
  toggle: (label, key, o = {}) => Object.assign({ t: 'toggle', h: o.sub ? 90 : 80, label, get: () => !!S[key], set: v => { S[key] = v; } }, o),
  slider: (label, key, min, max, step, fmt, o = {}) => Object.assign({ t: 'slider', h: 106, label, min, max, step, fmt, get: () => S[key], set: v => { S[key] = v; } }, o),
  button: (label, onClick, o = {}) => Object.assign({ t: 'button', h: 80, label, onClick }, o)
};
const pct = v => Math.round(v * 100) + '%', dg = v => Math.round(v) + '°';
const panel = ui.panel({ id: 'modelo', mw: 1.0, mh: 0.96, primary: true, title: 'Teste Modelo', titleIcon: 'cube', dist: 1.15, dy: 0.04, dx: 0.45, order: 11,
  onOpen: p => { ui.lastPrimary = 'modelo'; p.rebuild(); },
  extra(g, p) { if (!md.ready) ui.text(g, md.err ? 'Erro: ' + md.err : 'Carregando o modelo…', p.W / 2, 60, 24, md.err ? '#ff8a8a' : '#ffd166', 'center', 600); },
  build(p) {
    p.sc = { x: 24, y: 92, w: 640, h: p.H - 112 };
    const rows = [
      R.head('Posição'),
      R.slider('Giro', 'mdRot', -180, 180, 5, dg), R.slider('Giro automático', 'mdSpin', 0, 90, 5, v => v ? Math.round(v) + '°/s' : 'parado'),
      R.slider('Tamanho', 'mdScale', 0.5, 1.6, 0.05, pct), R.slider('Distância', 'mdDist', 0.9, 4, 0.1, v => v.toFixed(1) + ' m'),
      R.head('Boca'),
      R.slider('Pose da boca', 'mdMouth', 0, MOUTHS.length - 1, 1, v => MOUTHS[clamp(Math.round(v), 0, MOUTHS.length - 1)][1]),
      R.head('Expressões do rosto')
    ];
    EXPR.forEach(([n, lb], i) => rows.push(R.slider(lb, 'mdE' + i, 0, 1, 0.05, pct)));
    rows.push(R.button('Zerar o rosto', () => md.resetFace(), { icon: 'refresh' }));
    rows.push(R.head('Partes'));
    PARTS.forEach(([g, lb, key]) => rows.push(R.toggle(lb, key, { on: () => applyAll(false) })));
    rows.push(R.head('Forma do corpo'));
    BODY.forEach(([n, lb], i) => rows.push(R.slider(lb, 'mdB' + i, 0, 1, 0.05, pct)));
    rows.push(R.head('Movimento'),
      R.toggle('Olhar para você', 'mdLook'), R.toggle('Respirar', 'mdBreath'), R.toggle('Balançar cabelo, orelhas e rabo', 'mdSway'), R.toggle('Piscar sozinho', 'mdBlink'),
      R.slider('Cabeça: girar', 'mdHeadYaw', -40, 40, 1, dg), R.slider('Cabeça: inclinar', 'mdHeadPitch', -30, 30, 1, dg),
      R.slider('Braço esquerdo: levantar', 'mdArmL', -20, 110, 1, dg), R.slider('Braço direito: levantar', 'mdArmR', -20, 110, 1, dg),
      R.slider('Mão esquerda: fechar', 'mdFingL', 0, 1, 0.05, pct), R.slider('Mão direita: fechar', 'mdFingR', 0, 1, 0.05, pct),
      R.toggle('Inverter o sentido dos dedos', 'mdFingFlip', { sub: 'Use se os dedos dobrarem para trás' }),
      R.button('Restaurar tudo', () => md.resetAll(), { icon: 'refresh' }));
    return p.layoutRows(rows, 24, 640, 10);
  } });
})();
