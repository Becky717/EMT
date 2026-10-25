// EMT SIM VR — engine, 3D scene, VR input, 2D fallback. Medical rules live in rules.js.
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { SCENARIOS, ACTIONS, TABS, GENERIC, isTreatment, clamp } from './rules.js';

const TIME_LIMIT = 300;
const SKIN = { normal: 0xd9a27e, pale: 0xe6d3c4, cyanotic: 0x8f9bbd, flushed: 0xe0776a, mottled: 0xb9a4a8 };
const TONE = { info: '#e8eef7', good: '#5ee08a', bad: '#ff7b7b', warn: '#ffc857', say: '#7fd6ff', head: '#ffc857' };

// ======================= GAME STATE =======================
let mode = 'menu', S = null, scnIndex = 0, tab = 0, page = 0, seated = false, flash = null;
const best = JSON.parse(localStorage.getItem('emtvr_best') || '{}');

function newState(scn) {
  const s = { scn, t: 0, v: { hr: 80, sbp: 120, dbp: 80, rr: 16, spo2: 98, etco2: 36, avpu: 'A', bgl: 104 }, target: {}, age: scn.age,
    pose: 'supine', skin: 'normal', sweat: false, chest: 0.8, agonal: false, cpr: false, devices: new Set(), bleed: 0, hives: false, swelling: false,
    vomit: false, speech: '', who: '', lungs: '', reveal: {}, flags: { mistakeKeys: new Set() }, find: { ...scn.find }, mistakes: [], log: [],
    prompt: null, promptQ: [], ended: false, rhythm: null, pulseless: false, twoRescuer: false, qTotal: 0, qRight: 0, sex: 'm', shirt: 0x4a6fa5 };
  s.say = (who, text) => { s.speech = text; s.who = who; addLog(s, `${who}: "${text}"`, 'say'); };
  scn.setup(s);
  s.target = { ...s.v }; delete s.target.avpu; delete s.target.bgl;
  s.log.unshift({ text: 'DISPATCH: ' + scn.dispatch, tone: 'head' });
  return s;
}
function addLog(s, text, tone = 'info') { s.log.push({ text, tone }); if (s.log.length > 60) s.log.shift(); }
function makeApi(s) {
  return {
    say: s.say, log: (t, tone) => addLog(s, t, tone),
    info: t => { addLog(s, t, 'info'); },
    good: t => { addLog(s, '✓ ' + t, 'good'); doFlash('good'); },
    bad: (key, t, why, severe) => { addLog(s, '✗ ' + t + ' ' + why, 'bad'); doFlash('bad');
      if (!s.flags.mistakeKeys.has(key)) { s.flags.mistakeKeys.add(key); s.mistakes.push({ t, why, severe }); } },
    prompt: p => { if (s.prompt) s.promptQ.push(p); else s.prompt = p; },
    end: (o, msg) => endScenario(s, o, msg),
  };
}
function startScenario(i) {
  scnIndex = (i + SCENARIOS.length) % SCENARIOS.length; S = newState(SCENARIOS[scnIndex]); mode = 'play'; tab = 0; page = 0;
  rebuildPatientLook(); refreshAll();
}
function doAction(id) {
  if (mode !== 'play' || !S || S.ended) return;
  if (S.prompt) { doFlash('bad'); addLog(S, 'Answer the question on the main panel first.', 'warn'); return refreshAll(); }
  const s = S, api = makeApi(s);
  if (s.flags.sceneFirst === undefined) { s.flags.sceneFirst = id === 'scene'; s.flags.firstT = s.t; if (id !== 'scene') api.bad('sceneFirst', 'Started before scene safety/BSI.', 'Always confirm scene safety and gloves first.'); }
  addLog(s, '▶ ' + ACTIONS[id].label, 'head');
  (s.scn.actions?.[id] || GENERIC[id])(s, api);
  beep(isTreatment(id) ? 660 : 520, 0.05);
  refreshAll();
}
function answerPrompt(i) {
  const s = S, p = s.prompt; if (!p || i >= p.options.length) return;
  s.prompt = null;
  const ok = p.correct < 0 ? true : i === p.correct;
  if (p.correct >= 0) {
    s.qTotal++; if (ok) s.qRight++;
    addLog(s, ok ? `✓ Correct! ${p.explain}` : `✗ Answer: ${p.options[p.correct]}. ${p.explain}`, ok ? 'good' : 'bad');
    doFlash(ok ? 'good' : 'bad'); beep(ok ? 880 : 220, 0.15);
  }
  p.then && p.then(ok, i);
  if (!s.prompt && s.promptQ.length) s.prompt = s.promptQ.shift();
  refreshAll();
}
function tick() {
  const s = S; if (mode !== 'play' || !s || s.ended || s.prompt) return;
  s.t += 1;
  s.scn.update(s, 1, makeApi(s));
  const R = { hr: 4, sbp: 3, dbp: 2, rr: 1.5, spo2: 1, etco2: 2 };
  for (const k in R) if (s.target[k] != null) s.v[k] += clamp(s.target[k] - s.v[k], -R[k], R[k]);
  if (!s.ended && s.t >= TIME_LIMIT) endScenario(s, 'time');
  refreshAll(true);
}
function endScenario(s, outcome, msg) {
  if (s.ended) return; s.ended = true; s.prompt = null; s.promptQ = [];
  const crit = s.scn.critical(s);
  const okN = crit.filter(c => c.ok).length;
  const pen = s.mistakes.reduce((a, m) => a + (m.severe ? 10 : 5), 0);
  const score = clamp(Math.round(100 * okN / crit.length) - pen, 0, 100);
  if (!best[s.scn.id] || score > best[s.scn.id]) { best[s.scn.id] = score; localStorage.setItem('emtvr_best', JSON.stringify(best)); }
  const head = { transport: '🚑 Transported! Nice work.', fail: 'Patient crashed - great learning rep!', time: 'Time\'s up - ALS took over. Good practice!' }[outcome];
  const L = [{ text: head, tone: 'head' }];
  if (msg) L.push({ text: msg, tone: 'warn' });
  L.push({ text: `Score ${score}/100  •  Critical actions ${okN}/${crit.length}  •  Questions ${s.qRight}/${s.qTotal}  •  ${fmt(s.t)}`, tone: 'info' });
  const did = crit.filter(c => c.ok), miss = crit.filter(c => !c.ok);
  if (did.length) { L.push({ text: 'WHAT YOU NAILED', tone: 'good' }); did.forEach(c => L.push({ text: '✓ ' + c.label, tone: 'good' })); }
  if (miss.length) { L.push({ text: 'NEXT TIME', tone: 'warn' }); miss.forEach(c => L.push({ text: '• ' + c.label + ' - ' + c.why, tone: 'info' })); }
  if (s.mistakes.length) { L.push({ text: 'WATCH OUTS', tone: 'bad' }); s.mistakes.forEach(m => L.push({ text: '✗ ' + m.t + ' ' + m.why, tone: 'info' })); }
  if (s.variant) L.push({ text: 'Tip: this patient changes between replays (different BP / meds). Play again!', tone: 'say' });
  s.debrief = L; s.score = score; mode = 'debrief'; page = 0; beep(outcome === 'transport' ? 990 : 330, 0.25);
  refreshAll();
}
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function doFlash(kind) { flash = { kind, until: performance.now() + 1200 }; }

// ======================= UI MODEL (shared by VR panel + 2D page) =======================
function model() {
  if (mode === 'menu') return {
    title: 'EMT Sim VR', right: '', align: 'top',
    lines: [{ text: 'Pick a patient. Each run is 3-5 min. Treat them like a real call: scene safety first, then assess, treat, transport.', tone: 'info' },
            { text: 'VR: point the laser, pull the trigger. Left panel = main. Right panel + tray = your actions.', tone: 'say' }],
    cols: 2, buttons: [...SCENARIOS.map((sc, i) => ({ id: 'scn:' + i, label: sc.title + (best[sc.id] != null ? `  ★${best[sc.id]}` : '') })),
      { id: 'random', label: '🎲 Random patient', primary: true }, { id: 'seat', label: seated ? 'Seated mode: ON' : 'Seated mode: OFF' }] };
  if (mode === 'debrief') {
    return { title: 'Debrief: ' + S.scn.title, right: '', align: 'top', paged: true, lines: S.debrief, cols: 3,
      buttons: [{ id: 'replay', label: '↻ Play again', primary: true }, { id: 'next', label: 'Next patient ▸' }, { id: 'menu', label: 'Menu' },
        { id: 'pgPrev', label: '◂ Prev page' }, { id: 'pgNext', label: 'More ▸' }] };
  }
  const s = S;
  const m = { title: s.scn.title, right: `${fmt(s.t)} / 5:00`, align: 'bottom', lines: s.log.slice(-14), cols: 1, buttons: [] };
  if (s.prompt) { m.question = s.prompt.q; m.buttons = s.prompt.options.map((o, i) => ({ id: 'opt:' + i, label: 'ABCD'[i] + ')  ' + o })); }
  else m.buttons = [{ id: 'menu', label: 'Quit to menu' }];
  return m;
}
function onButton(id) {
  ensureAudio();
  if (id.startsWith('scn:')) return startScenario(+id.slice(4));
  if (id.startsWith('opt:')) return answerPrompt(+id.slice(4));
  if (id.startsWith('tab:')) { tab = +id.slice(4); return refreshAll(); }
  if (id.startsWith('act:')) return doAction(id.slice(4));
  switch (id) {
    case 'random': return startScenario(Math.floor(Math.random() * SCENARIOS.length));
    case 'seat': seated = !seated; world.position.y = seated ? -0.45 : 0; return refreshAll();
    case 'menu': mode = 'menu'; S = null; rebuildPatientLook(); return refreshAll();
    case 'replay': return startScenario(scnIndex);
    case 'next': return startScenario(scnIndex + 1);
    case 'pgPrev': page = Math.max(0, page - 1); return refreshAll();
    case 'pgNext': page++; return refreshAll();
  }
}

// ======================= THREE SETUP =======================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('view').appendChild(renderer.domElement);
const vrBtn = VRButton.createButton(renderer);
document.body.appendChild(vrBtn);
setTimeout(() => { if (!/ENTER/i.test(vrBtn.textContent)) vrBtn.style.display = 'none'; }, 2500);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2633);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50);
camera.position.set(0, 1.6, 1.0); camera.lookAt(0, 1.25, -1.3);
const world = new THREE.Group(); scene.add(world);
scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(1, 3, 2); scene.add(sun);
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), sph: new THREE.IcosahedronGeometry(0.5, 1),
  tor: new THREE.TorusGeometry(0.5, 0.12, 6, 16), cone: new THREE.ConeGeometry(0.5, 1, 10) };
function mk(geo, mat, sx, sy, sz, x = 0, y = 0, z = 0, parent = world) { const m = new THREE.Mesh(G[geo], mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; }

// room (ER bay)
mk('box', lam(0x3b4656), 8, 0.02, 8, 0, -0.01, -1);
mk('box', lam(0x8fa3b8), 8, 3.2, 0.05, 0, 1.6, -3.4);
mk('box', lam(0x7d90a6), 0.05, 3.2, 8, -3.2, 1.6, -1); mk('box', lam(0x7d90a6), 0.05, 3.2, 8, 3.2, 1.6, -1);
mk('box', lam(0xd9e2ec), 3, 0.9, 0.5, -1.6, 0.45, -3.1); mk('box', lam(0x2f8f83), 2.6, 0.05, 8, 0, 0.01, -1.3);
mk('box', new THREE.MeshBasicMaterial({ color: 0xf2f6ff }), 1.6, 0.02, 0.6, 0, 3.19, -1.3);
mk('box', lam(0xc0392b), 0.5, 0.12, 0.02, 0, 2.95, -3.37);
// stretcher
const STR_Y = 0.68;
mk('box', lam(0xe9edf2), 2.0, 0.08, 0.7, 0, STR_Y, -1.3); mk('box', lam(0x7b8794), 1.8, 0.05, 0.5, 0, 0.25, -1.3);
mk('box', lam(0x9aa5b1), 0.05, 0.4, 0.05, -0.8, 0.45, -1.3); mk('box', lam(0x9aa5b1), 0.05, 0.4, 0.05, 0.8, 0.45, -1.3);

// ======================= PATIENT =======================
const P = {};
function buildPatient() {
  const root = new THREE.Group(); world.add(root); P.root = root;
  const body = new THREE.Group(); root.add(body); P.body = body;
  P.mSkin = lam(SKIN.normal); P.mShirt = lam(0x4a6fa5); P.mPants = lam(0x2b2d42);
  const torso = new THREE.Group(); body.add(torso); P.torso = torso;
  P.chest = mk('box', P.mShirt, 0.38, 0.56, 0.22, 0, 0.3, 0, torso);
  mk('cyl', P.mSkin, 0.1, 0.1, 0.1, 0, 0.62, 0, torso);
  const head = new THREE.Group(); head.position.set(0, 0.77, 0); torso.add(head); P.head = head;
  mk('sph', P.mSkin, 0.22, 0.25, 0.23, 0, 0, 0, head);
  P.mLips = lam(0xb5655a); P.lips = mk('box', P.mLips, 0.06, 0.016, 0.02, 0, -0.06, 0.108, head);
  const eye = lam(0x222222); mk('box', eye, 0.03, 0.012, 0.01, -0.045, 0.02, 0.11, head); mk('box', eye, 0.03, 0.012, 0.01, 0.045, 0.02, 0.11, head);
  mk('box', lam(0x3a2a20), 0.23, 0.07, 0.24, 0, 0.1, -0.01, head); // hair
  P.sweat = new THREE.Group(); head.add(P.sweat);
  const drop = new THREE.MeshBasicMaterial({ color: 0xcfefff });
  [[-0.05, 0.06], [0.04, 0.07], [0.0, 0.04], [0.07, 0.0], [-0.075, 0.0]].forEach(([x, y]) => mk('sph', drop, 0.018, 0.026, 0.018, x, y, 0.108, P.sweat));
  P.arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.23, 0.54, 0); torso.add(sh);
    mk('cyl', P.mShirt, 0.1, 0.3, 0.1, 0, -0.15, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    mk('cyl', P.mSkin, 0.08, 0.27, 0.08, 0, -0.135, 0, el); mk('sph', P.mSkin, 0.09, 0.1, 0.06, 0, -0.3, 0, el);
    P.arms.push({ sh, el });
  }
  P.legs = [];
  for (const sx of [-1, 1]) {
    const hp = new THREE.Group(); hp.position.set(sx * 0.1, 0, 0); body.add(hp);
    mk('cyl', P.mPants, 0.15, 0.44, 0.15, 0, -0.22, 0, hp);
    const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
    mk('cyl', P.mPants, 0.12, 0.42, 0.12, 0, -0.21, 0, kn); mk('box', lam(0x222222), 0.1, 0.07, 0.22, 0, -0.44, 0.05, kn);
    P.legs.push({ hp, kn });
  }
  // hives
  P.hives = new THREE.Group(); torso.add(P.hives); const hv = lam(0xd94b4b);
  [[0.05, 0.6, 0.06], [-0.06, 0.63, 0.05], [0.12, 0.45, 0.115], [-0.1, 0.4, 0.115], [0.02, 0.5, 0.115], [-0.15, 0.55, 0.115]].forEach(p => mk('sph', hv, 0.035, 0.035, 0.01, ...p, P.hives));
  // devices
  const dev = P.dev = {};
  dev.nrb = mk('cone', new THREE.MeshLambertMaterial({ color: 0x7fe0a0, transparent: true, opacity: 0.6 }), 0.13, 0.1, 0.13, 0, -0.04, 0.13, head); dev.nrb.rotation.x = -Math.PI / 2;
  dev.nc = mk('tor', lam(0x9fe6c0), 0.12, 0.12, 0.12, 0, -0.03, 0.09, head); dev.nc.rotation.x = Math.PI / 2;
  dev.cpap = mk('box', new THREE.MeshLambertMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.75 }), 0.13, 0.12, 0.06, 0, -0.04, 0.13, head);
  dev.bvm = new THREE.Group(); head.add(dev.bvm); mk('cone', lam(0x335c99), 0.12, 0.06, 0.12, 0, -0.04, 0.14, dev.bvm).rotation.x = -Math.PI / 2; mk('sph', lam(0x3f7fd9), 0.13, 0.13, 0.26, 0, -0.04, 0.32, dev.bvm);
  dev.adv = mk('cyl', lam(0x9b5de5), 0.03, 0.03, 0.12, 0, -0.06, 0.14, head); dev.adv.rotation.x = Math.PI / 2;
  dev.opa = mk('box', lam(0xffd166), 0.04, 0.02, 0.03, 0, -0.06, 0.12, head);
  dev.npa = mk('cyl', lam(0xf4a261), 0.02, 0.02, 0.04, 0.02, -0.01, 0.12, head);
  dev.collar = mk('cyl', lam(0xe8c07d), 0.17, 0.11, 0.17, 0, 0.64, 0, torso);
  dev.aed = new THREE.Group(); torso.add(dev.aed); const pad = lam(0xffffff);
  mk('box', pad, 0.1, 0.13, 0.01, -0.09, 0.45, 0.115, dev.aed); mk('box', pad, 0.1, 0.13, 0.01, 0.12, 0.18, 0.115, dev.aed);
  dev.tq = mk('tor', lam(0x111111), 0.2, 0.2, 0.25, 0, -0.08, 0, P.legs[1].hp); dev.tq.rotation.x = Math.PI / 2;
  dev.dressing = mk('cyl', lam(0xf5f5f5), 0.17, 0.08, 0.17, 0, -0.22, 0, P.legs[1].hp);
  P.vomit = mk('sph', lam(0x8a8b3a), 0.1, 0.04, 0.08, 0, -0.1, 0.14, head);
  // world-level props
  P.blanket = mk('box', lam(0x3d5a80), 1.15, 0.05, 0.62, -0.25, STR_Y + 0.2, -1.3);
  P.blood = mk('cyl', lam(0x8b0000), 1, 0.01, 1, 0, STR_Y + 0.045, -1.3);
  P.hands = mk('box', lam(0x4c7bd9), 0.14, 0.06, 0.18, 0, 0, 0); // rescuer gloved hands for CPR
}
buildPatient();

function setJoints(torsoX, headX, shX, elX, hipX, knX) {
  P.torso.rotation.x = torsoX; P.head.rotation.x = headX;
  P.arms.forEach(a => { a.sh.rotation.x = shX; a.el.rotation.x = elX; });
  P.legs.forEach(l => { l.hp.rotation.x = hipX; l.kn.rotation.x = knX; });
}
function rebuildPatientLook() {
  const s = S;
  P.root.visible = !!s; P.blanket.visible = false; P.blood.visible = false; P.hands.visible = false;
  if (!s) return;
  P.mShirt.color.setHex(s.shirt); P.mPants.color.setHex(s.sex === 'f' ? 0x264653 : 0x2b2d42);
  const inf = s.age === 'infant';
  P.root.scale.setScalar(inf ? 0.34 : 1);
  P.lastPose = null;
}
function applyPose() {
  const s = S; if (P.lastPose === s.pose) return; P.lastPose = s.pose;
  const inf = s.age === 'infant';
  if (s.pose === 'supine') {
    P.body.rotation.set(-Math.PI / 2, 0, 0); P.root.rotation.set(0, -Math.PI / 2, 0);
    P.root.position.set(inf ? 0.15 : -0.1, STR_Y + (inf ? 0.08 : 0.15), -1.3); setJoints(0, 0, 0, 0, 0, 0);
  } else {
    P.body.rotation.set(0, 0, 0); P.root.rotation.set(0, 0.6, 0);
    P.root.position.set(0, STR_Y + 0.12, -1.2);
    if (s.pose === 'tripod') setJoints(0.5, -0.45, -1.0, -0.35, -Math.PI / 2, Math.PI / 2);
    else setJoints(-0.08, 0.05, -0.3, -1.0, -Math.PI / 2, Math.PI / 2);
  }
}
const tmpC = new THREE.Color();
let breathPhase = 0;
function animatePatient(dt, now) {
  const s = S; if (!s) return;
  applyPose();
  // skin color (lerp)
  P.mSkin.color.lerp(tmpC.setHex(SKIN[s.skin] || SKIN.normal), Math.min(1, dt * 1.5));
  P.mLips.color.lerp(tmpC.setHex(s.skin === 'cyanotic' || s.skin === 'mottled' ? 0x4d5d9e : 0xb5655a), Math.min(1, dt * 1.5));
  P.sweat.visible = s.sweat; P.hives.visible = s.hives; P.vomit.visible = s.vomit;
  P.lips.scale.set(s.swelling ? 0.09 : 0.06, s.swelling ? 0.035 : 0.016, 0.02);
  for (const k in P.dev) P.dev[k].visible = s.devices.has(k);
  if (s.devices.has('bvm')) P.dev.nrb.visible = P.dev.nc.visible = false;
  P.blanket.visible = s.devices.has('blanket') && s.pose === 'supine' && s.age !== 'infant';
  P.blood.visible = s.bleed > 0; if (s.bleed > 0) { const r = 0.25 + s.bleed * 0.5; P.blood.scale.set(r, 0.01, r * 0.7); P.blood.position.set(-0.45, STR_Y + 0.045, -1.15); }
  // breathing / CPR
  let z = 1;
  if (s.cpr) {
    const c = Math.max(0, Math.sin(now * 0.001 * Math.PI * 2 * 1.83));
    z = 1 - 0.18 * c;
    P.hands.visible = true;
    const cp = new THREE.Vector3(0, 0.33, 0.13); P.torso.localToWorld(cp);
    P.hands.position.set(cp.x, cp.y + 0.06 - c * 0.04 * P.root.scale.x, cp.z); P.hands.scale.set(0.14, 0.06, 0.18).multiplyScalar(s.age === 'infant' ? 0.4 : 1);
  } else {
    P.hands.visible = false;
    const rr = s.v.rr, depth = s.chest;
    if (s.agonal && rr < 1) { const g = (now * 0.001) % 7; z = 1 + (g < 0.8 ? 0.1 * Math.sin(g / 0.8 * Math.PI) : 0); }
    else if (rr > 0.5) { breathPhase += dt * rr / 60 * Math.PI * 2; z = 1 + 0.13 * depth * (0.5 - 0.5 * Math.cos(breathPhase)); }
  }
  P.chest.scale.z = 0.22 * z;
  P.chest.position.z = (0.22 * z - 0.22) / 2;
}

// ======================= CANVAS PANELS =======================
class Panel {
  constructor(wM, hM, W, H, pos, rotY, rotX = 0) {
    this.W = W; this.H = H; this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d'); this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }));
    this.mesh.position.set(...pos); this.mesh.rotation.set(rotX, rotY, 0, 'YXZ'); this.mesh.userData.panel = this; world.add(this.mesh);
    this.buttons = []; this.hover = null;
  }
  hit(uv) { const x = uv.x * this.W, y = (1 - uv.y) * this.H; return this.buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); }
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function wrap(c, text, maxW) { const out = []; let cur = ''; for (const w of String(text).split(' ')) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }
function drawBtn(c, P_, b, label, opt = {}) {
  const hov = P_.hover === b.id;
  rr(c, b.x, b.y, b.w, b.h, 18);
  c.fillStyle = opt.sel ? '#2b6cb0' : opt.primary ? (hov ? '#3fbf7f' : '#2f9e6a') : hov ? '#4a5a78' : opt.dim ? '#26324a' : '#33415c'; c.fill();
  if (hov) { c.lineWidth = 5; c.strokeStyle = '#ffe08a'; c.stroke(); }
  c.fillStyle = opt.dim ? '#9fb0c8' : '#ffffff'; c.font = `bold ${opt.size || 36}px system-ui, sans-serif`; c.textBaseline = 'middle';
  const lines = wrap(c, label, b.w - 36).slice(0, 2), lh = (opt.size || 36) * 1.15;
  const align = opt.left ? 'left' : 'center'; c.textAlign = align;
  lines.forEach((ln, i) => c.fillText(ln, opt.left ? b.x + 22 : b.x + b.w / 2, b.y + b.h / 2 + (i - (lines.length - 1) / 2) * lh));
  c.textAlign = 'left';
}

// main panel (left)
const mainP = new Panel(1.5, 1.125, 1280, 960, [-1.3, 1.62, -1.35], 0.72);
function drawMain() {
  const m = model(), Pn = mainP, c = Pn.ctx, W = Pn.W, H = Pn.H; Pn.buttons = [];
  c.clearRect(0, 0, W, H); rr(c, 4, 4, W - 8, H - 8, 30); c.fillStyle = 'rgba(16,24,40,0.95)'; c.fill();
  const fl = flash && performance.now() < flash.until ? flash.kind : null;
  c.lineWidth = fl ? 14 : 4; c.strokeStyle = fl === 'good' ? '#5ee08a' : fl === 'bad' ? '#ff6b6b' : '#5b6b88'; c.stroke();
  c.fillStyle = '#ffffff'; c.font = 'bold 52px system-ui, sans-serif'; c.textBaseline = 'alphabetic'; c.fillText(m.title, 40, 78);
  if (m.right) { c.font = 'bold 40px system-ui'; c.textAlign = 'right'; c.fillStyle = '#ffc857'; c.fillText(m.right, W - 40, 76); c.textAlign = 'left'; }
  // buttons
  const cols = m.cols, bh = m.question ? 82 : 86, gap = 14, rows = Math.ceil(m.buttons.length / cols), bw = (W - 80 - gap * (cols - 1)) / cols;
  const btnTop = H - 32 - rows * bh - (rows - 1) * gap;
  m.buttons.forEach((b, i) => { const bb = { id: b.id, x: 40 + (i % cols) * (bw + gap), y: btnTop + Math.floor(i / cols) * (bh + gap), w: bw, h: bh }; Pn.buttons.push(bb); drawBtn(c, Pn, bb, b.label, { primary: b.primary, left: !!m.question, size: m.question ? 34 : 34 }); });
  // text
  let bottom = btnTop - 22; const top = 110, fs = 34, lh = 43;
  if (m.question) {
    c.font = 'bold 42px system-ui'; const ql = wrap(c, m.question, W - 80);
    c.fillStyle = '#ffc857'; ql.forEach((l, i) => c.fillText(l, 40, bottom - (ql.length - 1 - i) * 52)); bottom -= ql.length * 52 + 18;
  }
  c.font = `${fs}px system-ui, sans-serif`;
  const rows2 = []; m.lines.forEach(L => wrap(c, L.text, W - 80).forEach(t => rows2.push({ t, tone: L.tone })));
  const per = Math.floor((bottom - top) / lh);
  let view;
  if (m.align === 'bottom') view = rows2.slice(-per);
  else { const pages = Math.max(1, Math.ceil(rows2.length / per)); if (m.paged) page = clamp(page, 0, pages - 1); view = rows2.slice(page * per, page * per + per); if (m.paged) { const nb = Pn.buttons.find(b => b.id === 'pgNext'); if (nb) { /* relabel */ drawBtn(c, Pn, nb, `More ▸ (${page + 1}/${pages})`, {}); } } }
  view.forEach((r, i) => { c.fillStyle = TONE[r.tone] || '#fff'; c.font = (r.tone === 'head' ? 'bold ' : '') + `${fs}px system-ui, sans-serif`; c.fillText(r.t, 40, top + 30 + i * lh); });
  Pn.tex.needsUpdate = true;
}

// action panel (right)
const actP = new Panel(1.2, 1.35, 1024, 1152, [1.3, 1.55, -1.3], -0.72);
function drawAct() {
  const Pn = actP, c = Pn.ctx, W = Pn.W, H = Pn.H; Pn.buttons = [];
  c.clearRect(0, 0, W, H); rr(c, 4, 4, W - 8, H - 8, 30); c.fillStyle = 'rgba(16,24,40,0.95)'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#5b6b88'; c.stroke();
  const play = mode === 'play';
  c.fillStyle = '#fff'; c.font = 'bold 44px system-ui'; c.textBaseline = 'alphabetic'; c.fillText(play ? 'ACTIONS' : 'ACTIONS (start a patient first)', 36, 66);
  const tw = (W - 60) / TABS.length;
  TABS.forEach((t, i) => { const b = { id: 'tab:' + i, x: 30 + i * tw, y: 90, w: tw - 8, h: 84 }; Pn.buttons.push(b); drawBtn(c, Pn, b, t, { sel: i === tab, size: 28 }); });
  const ids = Object.keys(ACTIONS).filter(k => ACTIONS[k].tab === tab);
  const bw = (W - 74) / 2, bh = 104, gap = 14;
  ids.forEach((id, i) => { const b = { id: 'act:' + id, x: 30 + (i % 2) * (bw + gap), y: 200 + Math.floor(i / 2) * (bh + gap), w: bw, h: bh }; Pn.buttons.push(b);
    const done = S && S.log.some(l => l.text === '▶ ' + ACTIONS[id].label);
    drawBtn(c, Pn, b, (done ? '✓ ' : '') + ACTIONS[id].label, { dim: !play || (S && S.prompt), primary: id === 'transport' && play, size: 36 }); });
  Pn.tex.needsUpdate = true;
}

// vitals monitor (behind patient)
const monP = new Panel(1.15, 0.72, 1024, 640, [0, 2.55, -2.3], 0, 0.2);
function drawMon() {
  const Pn = monP, c = Pn.ctx, W = Pn.W, H = Pn.H, s = S;
  c.fillStyle = '#05080c'; rr(c, 0, 0, W, H, 26); c.fill(); c.lineWidth = 10; c.strokeStyle = '#3a4250'; c.stroke();
  c.textBaseline = 'alphabetic'; c.fillStyle = '#9fb0c8'; c.font = 'bold 34px system-ui'; c.fillText('PATIENT MONITOR', 30, 52);
  if (s) { c.textAlign = 'right'; c.fillText(fmt(s.t), W - 30, 52); c.textAlign = 'left'; }
  const R = s ? s.reveal : {}, v = s ? s.v : {};
  const hrTxt = !s ? '--' : s.pulseless ? (s.devices.has('aed') || s.reveal.etco2 ? (s.rhythm || '--') : '--') : R.hr ? Math.round(v.hr) : '--';
  const cells = [
    ['HR', hrTxt, '#4cff7a', 'check pulse'], ['SpO2 %', R.spo2 && !s.pulseless ? Math.round(v.spo2) : '--', '#4fd8ff', 'pulse ox'],
    ['BP', R.bp ? (s.pulseless ? '0/0' : `${Math.round(v.sbp)}/${Math.round(v.dbp)}`) : '--', '#ff6b6b', 'BP cuff'], ['RR', R.rr ? Math.round(v.rr) : '--', '#ffd94f', 'check breathing'],
    ['ETCO2', R.etco2 ? Math.round(v.etco2) : '--', '#f6f0a0', 'with BVM/airway'], ['AVPU', R.avpu ? v.avpu : '--', '#ffffff', 'responsiveness'],
  ];
  cells.forEach(([lab, val, col, hint], i) => {
    const x = 30 + (i % 3) * 330, y = 80 + Math.floor(i / 3) * 270;
    c.fillStyle = '#0e141c'; rr(c, x, y, 310, 250, 18); c.fill();
    c.fillStyle = col; c.font = 'bold 34px system-ui'; c.fillText(lab, x + 18, y + 46);
    c.font = `bold ${String(val).length > 5 ? 74 : 110}px system-ui`; c.fillText(val, x + 18, y + 170);
    if (val === '--') { c.font = '26px system-ui'; c.fillStyle = '#7d8a9c'; c.fillText('(' + hint + ')', x + 18, y + 225); }
    else if (lab === 'HR' && s && s.pulseless) { c.font = 'bold 30px system-ui'; c.fillStyle = '#ff6b6b'; c.fillText('NO PULSE', x + 18, y + 225); }
  });
  if (s && R.bgl) { c.fillStyle = '#ffffff'; c.font = 'bold 30px system-ui'; c.textAlign = 'right'; c.fillText(`BGL ${s.v.bgl}`, W - 330, 52); c.textAlign = 'left'; }
  Pn.tex.needsUpdate = true;
}

// speech bubble above patient
const bubP = new Panel(1.1, 0.215, 1024, 200, [0, 1.85, -1.4], 0);
function drawBub() {
  const Pn = bubP, c = Pn.ctx, W = Pn.W, H = Pn.H, s = S;
  c.clearRect(0, 0, W, H); Pn.mesh.visible = !!(s && s.speech);
  if (!s || !s.speech) { Pn.tex.needsUpdate = true; return; }
  rr(c, 6, 6, W - 12, H - 12, 40); c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill();
  c.fillStyle = '#1b2433'; c.font = 'bold 42px system-ui'; c.textBaseline = 'middle';
  const lines = wrap(c, `${s.who}: "${s.speech}"`, W - 60).slice(0, 3);
  lines.forEach((l, i) => c.fillText(l, 30, H / 2 + (i - (lines.length - 1) / 2) * 50));
  Pn.tex.needsUpdate = true;
}
bubP.mesh.userData.panel = null;

// equipment tray (front)
const TRAY = ['spo2', 'bp', 'lungs', 'glucose', 'nc', 'nrb', 'bvm', 'opa', 'npa', 'suction', 'cpap', 'aed', 'asa', 'ntg', 'oralglucose', 'albuterol', 'epi', 'naloxone', 'tourniquet', 'dressing', 'collar', 'blanket', 'cpr', 'als'];
const TRAY_LABEL = { spo2: 'Pulse ox', bp: 'BP cuff', lungs: 'Stethoscope', glucose: 'Glucometer', nc: 'Cannula', nrb: 'NRB', bvm: 'BVM', opa: 'OPA', npa: 'NPA', suction: 'Suction', cpap: 'CPAP', aed: 'AED', asa: 'Aspirin', ntg: 'Nitro', oralglucose: 'Oral gluc.', albuterol: 'Inhaler', epi: 'EpiPen', naloxone: 'Naloxone', tourniquet: 'Tourniquet', dressing: 'Dressing', collar: 'C-collar', blanket: 'Blanket', cpr: 'CPR', als: 'Radio: ALS' };
const TRAY_SHAPE = { spo2: ['box', 0x5c6b80], bp: ['box', 0x1f3a93], lungs: ['tor', 0x222222], glucose: ['box', 0xf0f0f0], nc: ['tor', 0x8fe3b5], nrb: ['cone', 0x7fe0a0], bvm: ['sph', 0x3f7fd9], opa: ['tor', 0xffd166], npa: ['cyl', 0xf4a261], suction: ['cyl', 0x8d99ae], cpap: ['box', 0xbfe3ff], aed: ['box', 0xc6e03b], asa: ['cyl', 0xffffff], ntg: ['cyl', 0x8b5a2b], oralglucose: ['cyl', 0xff9f1c], albuterol: ['box', 0x4361ee], epi: ['cyl', 0xffd60a], naloxone: ['cyl', 0x90e0ef], tourniquet: ['tor', 0x111111], dressing: ['box', 0xfafafa], collar: ['tor', 0xe8c07d], blanket: ['box', 0x3d5a80], cpr: ['box', 0xff595e], als: ['box', 0x333333] };
const tray = new THREE.Group(); tray.position.set(0.72, 0.88, -0.48); tray.rotation.set(-0.85, -0.5, 0, 'YXZ'); world.add(tray);
const TW = 1.25, TH = 0.62, TC = 6, TR = 4;
const trayP = new Panel(TW, TH, 1200, 600, [0, 0, 0], 0); tray.add(trayP.mesh); trayP.mesh.position.set(0, 0, 0);
const trayItems = [];
TRAY.forEach((id, i) => {
  const [g, col] = TRAY_SHAPE[id], cx = (i % TC + 0.5) / TC * TW - TW / 2, cy = TH / 2 - (Math.floor(i / TC) + 0.42) / TR * TH;
  const m = mk(g, lam(col), 0.07, g === 'cone' || g === 'cyl' ? 0.09 : 0.05, 0.07, cx, cy, 0.04, tray);
  if (g === 'cyl' || g === 'cone') m.rotation.x = Math.PI / 2;
  m.userData.action = id; m.userData.base = m.scale.clone(); trayItems.push(m);
});
function drawTray() {
  const Pn = trayP, c = Pn.ctx, W = Pn.W, H = Pn.H; Pn.buttons = [];
  c.fillStyle = '#c9d3df'; rr(c, 0, 0, W, H, 24); c.fill(); c.lineWidth = 10; c.strokeStyle = '#6b7a8f'; c.stroke();
  const cw = W / TC, ch = H / TR;
  TRAY.forEach((id, i) => {
    const x = (i % TC) * cw, y = Math.floor(i / TC) * ch, b = { id: 'act:' + id, x: x + 4, y: y + 4, w: cw - 8, h: ch - 8 }; Pn.buttons.push(b);
    c.fillStyle = Pn.hover === b.id ? '#ffe08a' : '#e7edf4'; rr(c, b.x, b.y, b.w, b.h, 14); c.fill();
    c.fillStyle = '#1b2433'; c.font = 'bold 30px system-ui'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(TRAY_LABEL[id], x + cw / 2, y + ch - 16); c.textAlign = 'left';
  });
  Pn.tex.needsUpdate = true;
}

// ======================= 2D DOM FALLBACK =======================
const $ = id => document.getElementById(id);
function drawDom() {
  const m = model();
  $('d-title').textContent = m.title + (m.right ? '  ·  ' + m.right : '');
  const s = S;
  $('d-vitals').textContent = s && mode === 'play' ? vitalsLine(s) : '';
  $('d-lines').innerHTML = (mode === 'play' ? m.lines.slice(-8) : m.lines).map(L => `<div style="color:${TONE[L.tone]}">${esc(L.text)}</div>`).join('');
  if (mode === 'play') $('d-lines').scrollTop = 1e6;
  $('d-q').textContent = m.question || '';
  $('d-buttons').innerHTML = m.buttons.filter(b => !b.id.startsWith('pg')).map(b => `<button data-id="${b.id}" class="${b.primary ? 'pri' : ''}">${esc(b.label)}</button>`).join('');
  $('d-actions-wrap').style.display = mode === 'play' && !(s && s.prompt) ? '' : 'none';
  $('d-tabs').innerHTML = TABS.map((t, i) => `<button data-id="tab:${i}" class="${i === tab ? 'sel' : ''}">${t}</button>`).join('');
  $('d-actions').innerHTML = Object.keys(ACTIONS).filter(k => ACTIONS[k].tab === tab).map(k => `<button data-id="act:${k}" class="${k === 'transport' ? 'pri' : ''}">${esc(ACTIONS[k].label)}</button>`).join('');
}
function vitalsLine(s) {
  const R = s.reveal, v = s.v;
  return `HR ${s.pulseless ? (s.devices.has('aed') ? s.rhythm || '--' : 'no pulse') : R.hr ? Math.round(v.hr) : '--'}  SpO2 ${R.spo2 && !s.pulseless ? Math.round(v.spo2) : '--'}  BP ${R.bp ? Math.round(v.sbp) + '/' + Math.round(v.dbp) : '--'}  RR ${R.rr ? Math.round(v.rr) : '--'}  ${R.etco2 ? 'ETCO2 ' + Math.round(v.etco2) + '  ' : ''}AVPU ${R.avpu ? v.avpu : '--'}${s.speech ? `\n${s.who}: "${s.speech}"` : ''}`;
}
const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
document.getElementById('ui').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) onButton(b.dataset.id); });
$('d-toggle').addEventListener('click', () => document.body.classList.toggle('hideui'));

let lastSpeech = null;
function refreshAll(fromTick) {
  drawMain(); drawAct(); drawMon(); drawTray();
  if (!S || S.speech + S.who !== lastSpeech) { drawBub(); lastSpeech = S ? S.speech + S.who : null; }
  if (!renderer.xr.isPresenting) drawDom();
}

// ======================= INPUT (VR controllers + mouse/touch) =======================
const ray = new THREE.Raycaster(); const tmpM = new THREE.Matrix4();
const targets = [mainP.mesh, actP.mesh, trayP.mesh, ...trayItems];
function hitInfo(inter) {
  if (!inter) return null;
  const o = inter.object;
  if (o.userData.action) return { panel: trayP, id: 'act:' + o.userData.action };
  const pn = o.userData.panel; if (!pn) return null;
  const b = pn.hit(inter.uv); return b ? { panel: pn, id: b.id } : { panel: pn, id: null };
}
let hovered = new Map();
function setHover(src, info) {
  const prev = hovered.get(src); hovered.set(src, info);
  const panels = new Set([mainP, actP, trayP]);
  panels.forEach(pn => { const h = [...hovered.values()].find(x => x && x.panel === pn && x.id); const id = h ? h.id : null; if (pn.hover !== id) { pn.hover = id; pn === mainP ? drawMain() : pn === actP ? drawAct() : drawTray(); } });
  trayItems.forEach(m => { const on = [...hovered.values()].some(x => x && x.id === 'act:' + m.userData.action); m.scale.copy(m.userData.base).multiplyScalar(on ? 1.35 : 1); });
}
function activate(info, src) { if (!info || !info.id) return; pulse(src); onButton(info.id); }
const controllers = [];
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x9ad1ff }));
  line.scale.z = 4; c.add(line); c.userData.line = line;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a })); dot.visible = false; scene.add(dot); c.userData.dot = dot;
  c.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.1), lam(0x444c5c)));
  c.addEventListener('connected', e => { c.userData.src = e.data; });
  c.addEventListener('disconnected', () => { c.userData.src = null; });
  c.addEventListener('selectstart', () => { ensureAudio(); activate(c.userData.hit, c); });
  scene.add(c); controllers.push(c);
}
function pulse(c) { try { c?.userData?.src?.gamepad?.hapticActuators?.[0]?.pulse(0.5, 40); } catch (e) {} }
function updateControllers() {
  for (const c of controllers) {
    if (!c.userData.src) { c.userData.dot.visible = false; continue; }
    tmpM.identity().extractRotation(c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
    const inter = ray.intersectObjects(targets, false)[0];
    c.userData.line.scale.z = inter ? inter.distance : 4;
    c.userData.dot.visible = !!inter; if (inter) c.userData.dot.position.copy(inter.point);
    const info = hitInfo(inter); c.userData.hit = info;
    const prev = hovered.get(c);
    if ((prev && prev.id) !== (info && info.id)) setHover(c, info);
  }
}
const ndc = new THREE.Vector2();
function pick(e) { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return hitInfo(ray.intersectObjects(targets, false)[0]); }
renderer.domElement.addEventListener('pointerdown', e => { ensureAudio(); activate(pick(e)); });
renderer.domElement.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { const info = pick(e); const prev = hovered.get('mouse'); if ((prev && prev.id) !== (info && info.id)) setHover('mouse', info); renderer.domElement.style.cursor = info && info.id ? 'pointer' : 'default'; } });
renderer.xr.addEventListener('sessionstart', () => { document.body.classList.add('inxr'); hovered.delete('mouse'); });
renderer.xr.addEventListener('sessionend', () => { document.body.classList.remove('inxr'); drawDom(); });

// ======================= AUDIO =======================
let actx = null;
function ensureAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); }
function beep(f, d) { if (!actx) return; const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; g.gain.value = 0.08; o.connect(g).connect(actx.destination); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d + 0.05); o.start(); o.stop(actx.currentTime + d + 0.06); }

// ======================= LOOP =======================
function onResize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h;
  const portrait = w < h * 1.1 && w < 820; camera.fov = portrait ? 95 : 70; camera.position.set(0, portrait ? 1.9 : 1.75, portrait ? 1.6 : 0.9); camera.lookAt(0, portrait ? -1.1 : 1.2, -1.3); camera.updateProjectionMatrix();
}
addEventListener('resize', onResize); onResize();
let last = performance.now(), acc = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  acc += dt; if (acc >= 1) { acc -= 1; tick(); }
  if (flash && now > flash.until) { flash = null; drawMain(); }
  if (renderer.xr.isPresenting) updateControllers();
  animatePatient(dt, now);
  renderer.render(scene, camera);
});
rebuildPatientLook(); refreshAll();
window.__emt = { start: startScenario, act: doAction, answer: answerPrompt, state: () => S, tick, mode: () => mode, onButton };
