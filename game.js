// EMT SIM VR — engine, 3D scene, VR input, 2D fallback. Medical rules live in rules.js.
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GEO, mergeKit, kitGroup, buildEquip, buildO2Tank, hose, EQUIP, EQUIP_LABEL } from './models.js';
import { SCENARIOS, ACTIONS, TABS, GENERIC, isTreatment, clamp } from './rules.js';
import { recordRound, makeCase, makeTemplate, TEMPLATE_IDS, pickSkill, topSkills, skillLabel, resetSkills, skillData } from './adaptive.js';
import { localizeScenario, isLocalOn, toggleLocal, paintMapCardSync, ATTRIBUTION, AREA, LOCATIONS, mapProviderInfo, STATION } from './maps.js';

const TIME_LIMIT = 300;
const SKIN = { normal: 0xd9a27e, pale: 0xe6d3c4, cyanotic: 0x8f9bbd, flushed: 0xe0776a, mottled: 0xb9a4a8 };
const TONE = { info: '#e8eef7', good: '#5ee08a', bad: '#ff7b7b', warn: '#ffc857', say: '#7fd6ff', head: '#ffc857' };

// ======================= GAME STATE =======================
let mode = 'menu', S = null, scnIndex = 0, tab = 0, page = 0, seated = false, flash = null, adScn = null, resetArm = false, pendingScn = null;
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
      if (!s.flags.mistakeKeys.has(key)) { s.flags.mistakeKeys.add(key); s.mistakes.push({ key, t, why, severe }); } },
    prompt: p => { if (s.prompt) s.promptQ.push(p); else s.prompt = p; },
    end: (o, msg) => endScenario(s, o, msg),
  };
}
function beginPlay(scn, isAdaptive) {
  const loc = localizeScenario(scn);
  adScn = isAdaptive ? loc : null;
  if (loc.local) {
    pendingScn = loc; S = null; mode = 'dispatch'; page = 0;
    updateSceneLabel(loc.local); rebuildPatientLook(); refreshAll();
    return;
  }
  S = newState(loc); mode = 'play'; tab = 0; page = 0; pendingScn = null;
  updateSceneLabel(null); rebuildPatientLook(); refreshAll();
}
function confirmDispatch() {
  if (!pendingScn) return;
  S = newState(pendingScn); mode = 'play'; tab = 0; page = 0;
  // enrich log with ETA / map note
  if (pendingScn.local) {
    const L = pendingScn.local;
    S.log.push({ text: `MAP: ${L.loc.cadPlace} · ETA ${L.etaMin} min (${L.mi} mi from ${L.from})`, tone: 'say' });
    S.log.push({ text: ATTRIBUTION, tone: 'info' });
  }
  pendingScn = null; rebuildPatientLook(); refreshAll();
}
function startScenario(i) {
  scnIndex = (i + SCENARIOS.length) % SCENARIOS.length;
  beginPlay(SCENARIOS[scnIndex], false);
}
// adaptive "weak spot" case (generated in adaptive.js)
function startCase(scn) {
  beginPlay(scn || makeCase(), true);
}
function doAction(id) {
  if (mode !== 'play' || !S || S.ended) return;
  if (S.prompt) { doFlash('bad'); addLog(S, 'Answer the question on the main panel first.', 'warn'); return refreshAll(); }
  const s = S, api = makeApi(s);
  if (s.flags.sceneFirst === undefined) { s.flags.sceneFirst = id === 'scene'; s.flags.firstT = s.t; if (id !== 'scene') api.bad('sceneFirst', 'Started before scene safety/BSI.', 'Always confirm scene safety and gloves first.'); }
  addLog(s, '▶ ' + ACTIONS[id].label, 'head');
  const fl = s.flags; (fl.at ||= {}); if (fl.at[id] == null) fl.at[id] = s.t; (fl.seq ||= []).push([id, s.t]);
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
    if (p.skill) (s.flags.qRes ||= []).push({ skill: p.skill, ok, q: p.q });
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
  // adaptive coach: what she missed, why it matters, what's next
  let rep = null; try { rep = recordRound(s); } catch (e) { console.warn('adaptive', e); }
  if (rep) {
    if (rep.tested) L.push({ text: rep.tested.ok ? `🎯 Trap beaten: ${rep.tested.label} ✓` : `🎯 Trap: ${rep.tested.trap}`, tone: rep.tested.ok ? 'good' : 'bad' });
    if (rep.misses.length) { L.push({ text: 'MISSED (and why it matters)', tone: 'bad' }); rep.misses.slice(0, 4).forEach(m => L.push({ text: `✗ ${m.label}: ${m.why}`, tone: 'info' })); }
    L.push({ text: `➡ Next case will test: ${skillLabel(rep.next)}`, tone: 'warn' });
  }
  s.adNext = rep && rep.next;
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
    lines: [{ text: 'Pick a patient. 3-5 min each. Scene safety first, then assess, treat, transport.', tone: 'info' },
            { text: `🎯 Weak spots: a new case built from your misses. Next: ${skillLabel(pickSkill())}`, tone: 'warn' },
            { text: isLocalOn() ? `📍 Local calls ON — real North AL roads (OSM). ${LOCATIONS.length} places.` : '📍 Local calls OFF — generic settings.', tone: 'say' },
            { text: 'VR: laser + trigger. Gear and meds are on the red cart.', tone: 'say' }],
    cols: 2, buttons: [...SCENARIOS.map((sc, i) => ({ id: 'scn:' + i, label: sc.title + (best[sc.id] != null ? `  ★${best[sc.id]}` : '') })),
      { id: 'adaptive', label: '🎯 Weak spots (adaptive)', primary: true }, { id: 'progress', label: '📊 My weak spots' },
      { id: 'random', label: '🎲 Random patient' },
      { id: 'local', label: isLocalOn() ? '📍 Local calls: ON' : '📍 Local calls: OFF', primary: isLocalOn() },
      { id: 'seat', label: seated ? 'Seated mode: ON' : 'Seated mode: OFF' }] };
  if (mode === 'dispatch' && pendingScn) {
    const L = pendingScn.local;
    const lines = [
      { text: '📻 ' + (L?.cad || pendingScn.dispatch), tone: 'head' },
      { text: L ? `${L.loc.cadPlace}` : '', tone: 'warn' },
      { text: L ? `ETA ${L.etaMin} min · ${L.mi} mi from ${L.from} · Scene: ${L.sceneType}` : '', tone: 'say' },
      { text: ATTRIBUTION, tone: 'info' },
    ].filter(x => x.text);
    return { title: 'Dispatch', right: pendingScn.title, align: 'top', map: true, lines,
      cols: 2, buttons: [{ id: 'respond', label: '🚑 Respond / ENTER SCENE', primary: true }, { id: 'menu', label: 'Cancel' }] };
  }
  if (mode === 'progress') {
    const top = topSkills(6), d = skillData(), days = Math.ceil((new Date(2026, 11, 12) - new Date()) / 864e5);
    const L = [{ text: `Rounds played: ${d.rounds}${days > 0 ? `  •  NREMT in ${days} days` : ''}`, tone: 'info' }];
    if (!top.length) L.push({ text: 'No weak spots right now. Nice! Play a few cases.', tone: 'good' });
    top.forEach(t => { const n = Math.max(1, Math.min(5, Math.round(t.w / 2))); L.push({ text: `${'■'.repeat(n)}${'□'.repeat(5 - n)}  ${t.label}  (missed ${t.miss}, right ${t.hit})`, tone: t.w >= 4 ? 'bad' : 'warn' }); });
    L.push({ text: 'Miss = bar goes up. Get it right = bar shrinks.', tone: 'say' });
    return { title: 'My weak spots', right: '', align: 'top', lines: L, cols: 3,
      buttons: [{ id: 'adaptive', label: '🎯 Practice top spot', primary: true }, { id: 'reset', label: resetArm ? 'Tap again to reset' : 'Reset progress' }, { id: 'menu', label: 'Menu' }] };
  }
  if (mode === 'debrief') {
    return { title: 'Debrief: ' + S.scn.title, right: '', align: 'top', paged: true, lines: S.debrief, cols: 3,
      buttons: [{ id: 'adaptive', label: '🎯 Weak-spot case', primary: true }, { id: 'replay', label: '↻ Play again' }, { id: 'next', label: adScn ? 'Menu' : 'Next patient ▸' },
        { id: 'progress', label: '📊 Weak spots' }, { id: 'pgPrev', label: '◂ Prev page' }, { id: 'pgNext', label: 'More ▸' }] };
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
    case 'adaptive': resetArm = false; return startCase(makeCase(S && S.adNext !== undefined && mode === 'debrief' ? S.adNext : undefined));
    case 'progress': resetArm = false; mode = 'progress'; S = null; page = 0; rebuildPatientLook(); return refreshAll();
    case 'reset': if (resetArm) { resetSkills(); resetArm = false; } else resetArm = true; return refreshAll();
    case 'local': toggleLocal(); return refreshAll();
    case 'respond': return confirmDispatch();
    case 'seat': seated = !seated; world.position.y = seated ? -0.45 : 0; return refreshAll();
    case 'menu': resetArm = false; mode = 'menu'; S = null; pendingScn = null; updateSceneLabel(null); rebuildPatientLook(); return refreshAll();
    case 'replay': return adScn ? startCase(adScn) : startScenario(scnIndex);
    case 'next': if (adScn) { mode = 'menu'; S = null; adScn = null; rebuildPatientLook(); return refreshAll(); } return startScenario(scnIndex + 1);
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
// lighting: soft image-based light (generated once, no downloads) + hemisphere + one key light, no shadows
try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture; pm.dispose(); } catch (e) { console.warn('env map skipped', e); }
scene.add(new THREE.HemisphereLight(0xf4f7ff, 0x404a58, 0.9));
const sun = new THREE.DirectionalLight(0xfff6ea, 1.5); sun.position.set(1.2, 3.2, 1.6); scene.add(sun);
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, envMapIntensity: 0.6, ...o });
const lam = std;
const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16), sph: new THREE.SphereGeometry(0.5, 16, 12),
  tor: new THREE.TorusGeometry(0.5, 0.12, 6, 16), cone: new THREE.ConeGeometry(0.5, 1, 10) };
function mk(geo, mat, sx, sy, sz, x = 0, y = 0, z = 0, parent = world) { const m = new THREE.Mesh(G[geo], mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; }
const addM = (geo, mat, parent, pos, rot) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); return m; };

// room (ER bay)
mk('box', std(0x3b4656, { roughness: 0.55 }), 8, 0.02, 8, 0, -0.01, -1);
mk('box', std(0x8fa3b8), 8, 3.2, 0.05, 0, 1.6, -3.4);
mk('box', std(0x7d90a6), 0.05, 3.2, 8, -3.2, 1.6, -1); mk('box', std(0x7d90a6), 0.05, 3.2, 8, 3.2, 1.6, -1);
mk('box', std(0xd9e2ec, { roughness: 0.5 }), 3, 0.9, 0.5, -1.6, 0.45, -3.1); mk('box', std(0x2f8f83, { roughness: 0.5 }), 2.6, 0.03, 8, 0, 0.005, -1.3);
mk('box', std(0x5b6b7f, { roughness: 0.3 }), 3.02, 0.04, 0.54, -1.6, 0.92, -3.1);
mk('box', std(0xe2e8f0, { roughness: 0.6 }), 3, 0.7, 0.35, -1.6, 2.15, -3.2);
for (let i = 0; i < 4; i++) mk('box', std(0x94a3b8), 0.012, 0.66, 0.01, -2.85 + i * 0.83, 2.15, -3.02);
mk('box', new THREE.MeshBasicMaterial({ color: 0xf2f6ff }), 1.6, 0.02, 0.6, 0, 3.19, -1.3);
mk('box', std(0xc0392b), 0.5, 0.12, 0.02, 0, 2.95, -3.37);
mk('box', std(0x16a34a), 0.08, 0.1, 0.03, 0.8, 1.5, -3.37); mk('box', std(0xf8fafc), 0.08, 0.1, 0.03, 0.95, 1.5, -3.37); // wall O2 / air outlets
const bezel = mk('box', std(0x1f2937, { roughness: 0.4 }), 1.24, 0.82, 0.05, 0, 2.55, -2.34); bezel.rotation.x = 0.2;
mk('cyl', std(0x9aa5b1, { metalness: 0.5, roughness: 0.4 }), 0.05, 0.9, 0.05, 0, 2.95, -2.6);
// blob shadow helper (cheap fake contact shadow)
function blobTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; }
const BLOB = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false });
function blob(w, d, x, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), BLOB); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.022, z); world.add(m); return m; }

// stretcher
const STR_Y = 0.68, MT = 0.775; // MT = mattress (sheet) top
{ const metal = std(0xb3bcc8, { metalness: 0.6, roughness: 0.35, envMapIntensity: 1 }), dark = std(0x1f2937, { roughness: 0.6 });
  blob(2.4, 1.1, 0, -1.3);
  mk('box', metal, 1.7, 0.06, 0.5, 0, 0.2, -1.3); mk('box', metal, 2.0, 0.05, 0.66, 0, 0.655, -1.3);
  for (const x of [-0.55, 0.55]) mk('cyl', metal, 0.07, 0.44, 0.07, x, 0.42, -1.3);
  for (const x of [-0.75, 0.75]) for (const z of [-1.52, -1.08]) { const w = mk('cyl', dark, 0.12, 0.04, 0.12, x, 0.06, z); w.rotation.x = Math.PI / 2; mk('box', metal, 0.03, 0.12, 0.03, x, 0.15, z); }
  addM(new RoundedBoxGeometry(2.0, 0.1, 0.68, 3, 0.04), std(0x23344a, { roughness: 0.7 }), world, [0, 0.715, -1.3]);
  addM(new RoundedBoxGeometry(1.98, 0.02, 0.69, 2, 0.008), std(0xf1f5f9, { roughness: 0.95 }), world, [0, MT - 0.01, -1.3]);
  addM(new RoundedBoxGeometry(0.3, 0.07, 0.5, 3, 0.03), std(0xf8fafc, { roughness: 0.95 }), world, [-0.8, MT + 0.012, -1.3]);
  mk('cyl', metal, 0.025, 1.7, 0.025, 0, MT + 0.14, -1.66).rotation.z = Math.PI / 2; // far side rail (up)
  for (const x of [-0.6, 0.6]) mk('cyl', metal, 0.025, 0.16, 0.025, x, MT + 0.07, -1.66);
  mk('cyl', metal, 0.025, 1.0, 0.025, 0, MT - 0.02, -0.95).rotation.z = Math.PI / 2; // near rail (lowered)
  // IV pole + bag at head end
  mk('cyl', metal, 0.025, 1.95, 0.025, -1.05, 0.98, -1.7); mk('cyl', metal, 0.3, 0.02, 0.02, -1.05, 1.95, -1.7).rotation.z = Math.PI / 2;
  addM(new RoundedBoxGeometry(0.12, 0.2, 0.035, 2, 0.015), std(0xe0f2fe, { transparent: true, opacity: 0.6, roughness: 0.1 }), world, [-1.15, 1.8, -1.7]);
}


// Scene address placard (ER bay stays; label names the real-road scene)
const sceneLabel = { mesh: null, tex: null, ctx: null, canvas: null };
(function makeSceneLabel() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.position.set(0, 2.85, -3.35); world.add(mesh); mesh.visible = false;
  sceneLabel.mesh = mesh; sceneLabel.tex = tex; sceneLabel.ctx = ctx; sceneLabel.canvas = c;
})();
function updateSceneLabel(local) {
  const { mesh, ctx, canvas: c, tex } = sceneLabel;
  if (!local || !local.loc) { mesh.visible = false; return; }
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(11,18,32,0.92)'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#2f9e6a'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  ctx.fillStyle = '#5ee08a'; ctx.font = 'bold 28px system-ui'; ctx.fillText('SCENE', 24, 40);
  ctx.fillStyle = '#e8eef7'; ctx.font = 'bold 36px system-ui';
  const place = local.loc.cadPlace;
  ctx.fillText(place.length > 48 ? place.slice(0, 46) + '…' : place, 24, 88);
  ctx.fillStyle = '#ffc857'; ctx.font = '22px ui-monospace, monospace';
  ctx.fillText(local.sceneType.toUpperCase() + '  ·  ETA ' + local.etaMin + ' min', 700, 40);
  tex.needsUpdate = true; mesh.visible = true;
}

// ======================= PATIENT =======================
const P = {};
const v3 = new THREE.Vector3();
function skinTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const draw = mottled => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${200 + Math.random() * 40},${170 + Math.random() * 30},${160 + Math.random() * 30},0.07)`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 0, 7); x.fill(); }
    if (mottled) { // lacy purple-blue mottling
      for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${140 + Math.random() * 40},${95 + Math.random() * 30},${150 + Math.random() * 30},0.13)`; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 9, 2 + Math.random() * 6, Math.random() * 3, 0, 7); x.fill(); }
    }
    tex.needsUpdate = true;
  };
  draw(false); return { tex, draw, mottled: false };
}
// point on the face surface (union of skull + jaw ellipsoids), used to place sweat/hives
function faceZ(x, y) {
  const e = (cx, cy, cz, ax, ay, az) => { const t = 1 - ((x - cx) / ax) ** 2 - ((y - cy) / ay) ** 2; return t > 0 ? cz + az * Math.sqrt(t) : -1; };
  return Math.max(e(0, 0.012, -0.005, 0.1, 0.1175, 0.1075), e(0, -0.045, 0.008, 0.08, 0.075, 0.085));
}
function buildPatient() {
  const PI = Math.PI;
  const root = new THREE.Group(); world.add(root); P.root = root;
  const body = new THREE.Group(); root.add(body); P.body = body;
  P.skinTex = skinTexture();
  P.mSkin = std(SKIN.normal, { roughness: 0.6, map: P.skinTex.tex, envMapIntensity: 0.5 });
  P.mShirt = std(0x4a6fa5, { roughness: 0.92 }); P.mPants = std(0x2b2d42, { roughness: 0.9 });
  P.mHair = std(0x3a2a20, { roughness: 0.75 }); P.mShoe = std(0x26262b, { roughness: 0.45 }); P.mSole = std(0xe5e7eb, { roughness: 0.7 });
  P.mEyeW = std(0xf4f2ec, { roughness: 0.25 }); P.mIris = std(0x3b2a1a, { roughness: 0.15 }); P.mBrow = std(0x2a1d15);
  P.mLips = std(0xb5655a, { roughness: 0.45 }); P.mMouth = std(0x3a1214);
  const hive = std(0xe0605a, { roughness: 0.6 });
  P.hives = [];
  // pelvis + belt
  addM(mergeKit(k => { k.add(GEO.sph(0.5, 22, 14), 0xffffff, { p: [0, 0.0, 0], s: [0.34, 0.22, 0.21] }); }), P.mPants, body);
  const torso = new THREE.Group(); body.add(torso); P.torso = torso;
  P.belt = addM(mergeKit(k => k.add(GEO.tor(0.155, 0.012, PI * 2, 6, 28), 0, { p: [0, 0.06, 0], r: [PI / 2, 0, 0], s: [1, 0.62, 1] })), std(0x3b2b20, { roughness: 0.5 }), torso);
  P.abd = addM(mergeKit(k => k.add(GEO.lathe([[0.001, 0.0], [0.14, 0.0], [0.155, 0.04], [0.155, 0.18], [0.15, 0.28], [0.001, 0.29]], 28), 0, { s: [1, 1, 0.62] })), P.mShirt, torso);
  P.chest = addM(mergeKit(k => {
    k.add(GEO.lathe([[0.001, 0.22], [0.152, 0.22], [0.156, 0.26], [0.168, 0.32], [0.185, 0.42], [0.19, 0.5], [0.18, 0.56], [0.14, 0.605], [0.08, 0.63], [0.001, 0.638]], 28), 0, { s: [1, 1, 0.62] });
    k.add(GEO.tor(0.062, 0.012, PI * 2, 6, 20), 0, { p: [0, 0.625, 0.004], r: [PI / 2, 0, 0], s: [1, 0.85, 1] });
  }), P.mShirt, torso);
  P.bust = addM(mergeKit(k => { for (const sx of [-1, 1]) k.add(GEO.sph(0.5, 18, 14), 0, { p: [sx * 0.062, 0.425, 0.072], s: [0.13, 0.11, 0.07] }); }), P.mShirt, P.chest);
  addM(mergeKit(k => k.add(GEO.cyl(0.047, 0.056, 0.14, 18), 0, { p: [0, 0.665, 0] })), P.mSkin, torso);
  // neck hives
  P.hives.push(addM(mergeKit(k => { for (const [a, y] of [[-0.9, 0.64], [-0.3, 0.68], [0.4, 0.65], [1.0, 0.7], [0.1, 0.62]]) k.add(GEO.sph(0.014, 10, 8), 0, { p: [0.042 * Math.sin(a), y, 0.042 * Math.cos(a)] }); }), hive, torso));
  // ----- head
  const head = new THREE.Group(); head.position.set(0, 0.785, 0); torso.add(head); P.head = head;
  addM(mergeKit(k => {
    k.add(GEO.sph(0.5, 26, 20), 0, { p: [0, 0.012, -0.005], s: [0.2, 0.235, 0.215] });
    k.add(GEO.sph(0.5, 22, 16), 0, { p: [0, -0.045, 0.008], s: [0.16, 0.15, 0.17] });
    k.add(GEO.sph(0.5, 14, 10), 0, { p: [0, -0.098, 0.044], s: [0.07, 0.05, 0.06] });
    k.add(GEO.cyl(0.0045, 0.011, 0.034, 12), 0, { p: [0, -0.006, 0.1], r: [0.34, 0, 0] });
    k.add(GEO.sph(0.0105, 12, 10), 0, { p: [0, -0.025, 0.11], s: [1, 0.85, 1] });
    for (const sx of [-1, 1]) {
      k.add(GEO.sph(0.0078, 10, 8), 0, { p: [sx * 0.0105, -0.03, 0.104] });
      k.add(GEO.sph(0.5, 12, 10), 0, { p: [sx * 0.1, -0.005, -0.005], s: [0.022, 0.062, 0.042], r: [0, sx * 0.3, 0] });
    }
  }), P.mSkin, head);
  P.lids = []; P.brows = [];
  addM(mergeKit(k => { for (const sx of [-1, 1]) k.add(GEO.sph(0.014, 14, 10), 0, { p: [sx * 0.036, 0.012, 0.088] }); }), P.mEyeW, head);
  addM(mergeKit(k => { for (const sx of [-1, 1]) k.add(GEO.sph(0.0068, 10, 8), 0, { p: [sx * 0.036, 0.012, 0.0975] }); }), P.mIris, head);
  for (const sx of [-1, 1]) {
    P.lids.push(addM(GEO.dome(0.0174, 14, 6), P.mSkin, head, [sx * 0.036, 0.012, 0.088]));
    const b = addM(GEO.cap(0.0036, 0.024, 2, 8), P.mBrow, head, [sx * 0.037, 0.043, 0.095], [0, 0, PI / 2]); b.userData.sx = sx; P.brows.push(b);
  }
  P.lips = new THREE.Group(); P.lips.position.set(0, -0.066, 0.092); head.add(P.lips);
  P.mouth = addM(GEO.sph(0.5, 14, 10), P.mMouth, P.lips, [0, 0, -0.004]); P.mouth.scale.set(0.036, 0.004, 0.012);
  P.lipU = addM(GEO.sph(0.5, 16, 10), P.mLips, P.lips, [0, 0.006, 0]); P.lipU.scale.set(0.044, 0.011, 0.016);
  P.lipL = addM(GEO.sph(0.5, 16, 10), P.mLips, P.lips, [0, -0.006, 0]); P.lipL.scale.set(0.042, 0.013, 0.017);
  P.hair = addM(mergeKit(k => { k.add(GEO.dome(0.5, 26, 10, 0.5), 0, { p: [0, 0.012, -0.005], s: [0.222, 0.254, 0.238], r: [-0.6, 0, 0] }); k.add(GEO.dome(0.5, 22, 8, 0.5), 0, { p: [0, 0.012, -0.005], s: [0.22, 0.252, 0.236], r: [-1.9, 0, 0] }); }), P.mHair, head);
  P.hairLong = addM(mergeKit(k => { k.add(GEO.cap(0.07, 0.13, 4, 14), 0, { p: [0, -0.07, -0.085], s: [1.4, 1, 0.55] }); }), P.mHair, head);
  P.sweat = addM(mergeKit(k => {
    for (const [x, y] of [[-0.045, 0.058], [-0.015, 0.064], [0.02, 0.06], [0.05, 0.054], [-0.066, 0.035], [0.068, 0.03], [0, 0.05], [0.072, -0.02], [-0.074, -0.022], [0.03, -0.05], [-0.032, -0.052], [-0.03, 0.05]])
      k.add(GEO.sph(0.0032, 8, 6), 0, { p: [x, y, faceZ(x, y) + 0.0005], s: [1, 1.4, 0.6] });
  }), std(0xcfe9ff, { roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.55, envMapIntensity: 2 }), head);
  P.hives.push(addM(mergeKit(k => { for (const [x, y] of [[0.055, -0.02], [-0.06, -0.03], [0.04, -0.075], [-0.045, -0.08], [0.03, 0.06], [-0.07, 0.01], [0.075, -0.05]]) k.add(GEO.sph(0.012, 10, 8), 0, { p: [x, y, faceZ(x, y) - 0.0085] }); }), hive, head));
  // ----- arms
  P.arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.205, 0.55, 0); torso.add(sh);
    addM(mergeKit(k => { k.add(GEO.sph(0.06, 16, 12), 0); k.add(GEO.cyl(0.058, 0.053, 0.16, 18), 0, { p: [0, -0.08, 0] }); }), P.mShirt, sh);
    addM(mergeKit(k => k.add(GEO.cap(0.043, 0.2, 4, 14), 0, { p: [0, -0.15, 0] })), P.mSkin, sh);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    addM(mergeKit(k => {
      k.add(GEO.sph(0.041, 14, 10), 0);
      k.add(GEO.lathe([[0.001, -0.26], [0.026, -0.255], [0.029, -0.22], [0.036, -0.12], [0.041, -0.04], [0.04, 0], [0.001, 0.0]], 16), 0);
      k.add(GEO.sph(0.5, 16, 12), 0, { p: [0, -0.3, 0], s: [0.026, 0.085, 0.075] });
      for (let i = 0; i < 4; i++) k.add(GEO.cap(0.0085, 0.04 - Math.abs(i - 1.5) * 0.006, 3, 8), 0, { p: [-sx * 0.006, -0.368 + Math.abs(i - 1.5) * 0.004, -0.026 + i * 0.0173], r: [0, 0, -sx * 0.3] });
      k.add(GEO.cap(0.0095, 0.03, 3, 8), 0, { p: [-sx * 0.01, -0.285, 0.04], r: [-0.6, 0, 0] });
    }), P.mSkin, el);
    P.hives.push(addM(mergeKit(k => { for (const [a, y] of [[0.5, -0.08], [1.2, -0.14], [-0.3, -0.18], [2.2, -0.1], [0.9, -0.22], [-1.2, -0.06]]) k.add(GEO.sph(0.014, 10, 8), 0, { p: [0.025 * Math.sin(a), y, 0.025 * Math.cos(a)] }); }), hive, el));
    P.arms.push({ sh, el });
  }
  // ----- legs (index 0 = patient's RIGHT leg, since the patient faces +z)
  P.legs = [];
  for (const sx of [-1, 1]) {
    const hp = new THREE.Group(); hp.position.set(sx * 0.095, 0, 0); body.add(hp);
    addM(mergeKit(k => k.add(GEO.lathe([[0.001, -0.47], [0.054, -0.46], [0.056, -0.42], [0.068, -0.25], [0.08, -0.05], [0.075, 0.03], [0.001, 0.05]], 18), 0)), P.mPants, hp);
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
    addM(mergeKit(k => k.add(GEO.lathe([[0.001, -0.41], [0.045, -0.4], [0.046, -0.32], [0.054, -0.12], [0.056, 0.02], [0.001, 0.03]], 18), 0)), P.mPants, kn);
    addM(mergeKit(k => k.add(GEO.sph(0.5, 16, 12), 0, { p: [0, -0.43, 0.045], s: [0.09, 0.08, 0.24] })), P.mShoe, kn);
    addM(new RoundedBoxGeometry(0.088, 0.02, 0.25, 2, 0.008), P.mSole, kn, [0, -0.468, 0.05]);
    P.legs.push({ hp, kn });
  }
  // thigh wound + blood-soaked pants (right thigh)
  P.wound = new THREE.Group(); P.wound.position.set(0, -0.27, 0.06); P.legs[0].hp.add(P.wound);
  P.soak = addM(GEO.sph(0.5, 16, 12), std(0x5a0a0f, { roughness: 0.35 }), P.wound, [0, 0, -0.012]); P.soak.scale.set(0.14, 0.2, 0.05);
  addM(GEO.sph(0.5, 14, 10), std(0x3d0303, { roughness: 0.2 }), P.wound, [0, 0, 0.006]).scale.set(0.045, 0.065, 0.018);
  // vomit at mouth/cheek
  P.vomit = addM(mergeKit(k => { for (const [x, y, z, s] of [[0.0, -0.085, 0.1, 0.03], [0.03, -0.082, 0.094, 0.028], [0.055, -0.092, 0.078, 0.032], [0.075, -0.1, 0.052, 0.034], [0.09, -0.108, 0.02, 0.04], [0.095, -0.115, -0.015, 0.045]]) k.add(GEO.sph(0.5, 12, 8), 0, { p: [x, y, z], s: [s, s * 0.45, s * 0.8] }); }), std(0x9c9436, { roughness: 0.25 }), head);
  // ----- devices on the patient
  const dev = P.dev = {};
  const put = (fn, parent, opts) => { const g = kitGroup(fn, opts); parent.add(g); return g; };
  const maskDome = (k, s, col) => k.add(GEO.dome(0.5, 20, 8), col, { p: [0, -0.04, 0.103], r: [PI / 2, 0, 0], s, clear: true });
  dev.nrb = put(k => {
    k.add(GEO.dome(0.5, 20, 8), 0xc9f2df, { p: [0, -0.048, 0.103], r: [PI / 2, 0, 0], s: [0.13, 0.085, 0.12], clear: true });
    k.add(GEO.tor(0.108, 0.0018, PI, 4, 24), 0xf1f5f9, { p: [0, -0.03, -0.004], r: [-PI / 2, 0, 0], s: [1, 1.05, 1] });
    k.add(GEO.cyl(0.008, 0.008, 0.035, 10), 0x9ad9bb, { p: [0, -0.115, 0.13] });
    k.add(GEO.sph(0.5, 16, 12), 0x5fd391, { p: [0, -0.18, 0.13], s: [0.1, 0.13, 0.05], clear: true });
    k.add(GEO.cyl(0.007, 0.007, 0.003, 12), 0x2f9e6a, { p: [0.05, -0.04, 0.125], r: [0, 0, PI / 2] });
    k.add(GEO.cyl(0.007, 0.007, 0.003, 12), 0x2f9e6a, { p: [-0.05, -0.04, 0.125], r: [0, 0, PI / 2] });
    k.add(GEO.tube([[0, -0.245, 0.13], [0.04, -0.3, 0.1], [0.16, -0.32, 0.06], [0.3, -0.3, 0.0]], 0.0035, 24, 6), 0x2fb36f);
  }, head);
  dev.nc = put(k => {
    const side = sx => [[0, -0.13, 0.065], [sx * 0.05, -0.12, 0.045], [sx * 0.098, -0.06, -0.01], [sx * 0.108, 0.0, -0.004], [sx * 0.085, -0.02, 0.07], [sx * 0.04, -0.043, 0.1], [0, -0.042, 0.106]];
    const R = side(1), L = side(-1).reverse();
    k.add(GEO.tube([...R, ...L.slice(1)], 0.0028, 80, 6), 0x8fe3b8);
    k.add(GEO.cyl(0.006, 0.006, 0.012, 10), 0x5cc596, { p: [0, -0.13, 0.065] });
    k.add(GEO.tube([[0, -0.135, 0.065], [0, -0.22, 0.09], [0.12, -0.3, 0.1], [0.3, -0.3, 0.0]], 0.003, 24, 6), 0x8fe3b8);
  }, head);
  dev.cpap = put(k => {
    k.add(GEO.dome(0.5, 20, 8), 0xe3f0ff, { p: [0, -0.05, 0.1], r: [PI / 2, 0, 0], s: [0.13, 0.1, 0.135], clear: true });
    k.add(GEO.tor(0.5, 0.07, PI * 2, 8, 24), 0x2b78e4, { p: [0, -0.05, 0.1], s: [0.125, 0.13, 0.1] });
    k.add(GEO.tor(0.112, 0.004, PI, 4, 24), 0x1f2937, { p: [0, 0.03, -0.005], r: [-PI / 2 - 0.5, 0, 0] });
    k.add(GEO.tor(0.104, 0.004, PI, 4, 24), 0x1f2937, { p: [0, -0.06, -0.005], r: [-PI / 2 + 0.25, 0, 0] });
    k.add(GEO.cyl(0.013, 0.013, 0.03, 12), 0xf1f5f9, { p: [0, -0.05, 0.16], r: [PI / 2, 0, 0] });
    hose(k, [[0, -0.05, 0.172], [0, -0.09, 0.24], [0.1, -0.16, 0.26], [0.24, -0.22, 0.12]], 0.011, 0xb9c6d6, 16);
  }, head);
  dev.bvm = put(k => {
    maskDome(k, [0.15, 0.09, 0.14], 0xdff3ff);
    k.add(GEO.tor(0.5, 0.09, PI * 2, 8, 24), 0x56677a, { p: [0, -0.04, 0.103], s: [0.14, 0.13, 0.12] });
    k.add(GEO.cyl(0.014, 0.014, 0.05, 14), 0xf1f5f9, { p: [0, -0.04, 0.17], r: [PI / 2, 0, 0] });
    k.add(GEO.sph(0.5, 22, 16), 0x2f6fd0, { p: [0, -0.04, 0.3], s: [0.12, 0.12, 0.24] });
    k.add(GEO.sph(0.5, 16, 12), 0x7fe0a6, { p: [0, -0.04, 0.5], s: [0.1, 0.07, 0.16], clear: true });
  }, head);
  dev.adv = put(k => {
    k.add(GEO.cyl(0.0085, 0.0085, 0.13, 12), 0x9b5de5, { p: [0, -0.066, 0.165], r: [PI / 2, 0, 0] });
    k.add(GEO.cyl(0.012, 0.012, 0.025, 12), 0xf1f5f9, { p: [0, -0.066, 0.24], r: [PI / 2, 0, 0] });
    k.add(GEO.tube([[0.005, -0.066, 0.12], [0.04, -0.07, 0.15], [0.05, -0.08, 0.2]], 0.0015, 10, 4), 0xf1f5f9);
    k.add(GEO.sph(0.008, 8, 6), 0x60a5fa, { p: [0.05, -0.08, 0.205] });
  }, head);
  dev.opa = put(k => { k.add(GEO.rbox(0.042, 0.016, 0.006, 0.002), 0xf2c230, { p: [0, -0.066, 0.112] }); k.add(GEO.box(0.018, 0.004, 0.002), 0x5a4508, { p: [0, -0.066, 0.1155] }); }, head);
  dev.npa = put(k => { k.add(GEO.tor(0.007, 0.0022, PI * 2, 6, 14), 0xe39463, { p: [-0.012, -0.041, 0.109], r: [PI / 2 - 0.3, 0, 0] }); k.add(GEO.cyl(0.0068, 0.004, 0.008, 12, true), 0xe39463, { p: [-0.012, -0.037, 0.108], r: [-0.3, 0, 0] }); }, head);
  dev.collar = put(k => {
    const gap = 0.4 * PI, ts = PI + gap / 2, tl = PI * 2 - gap;
    k.add(GEO.cyl(0.072, 0.078, 0.1, 30, true, ts, tl), 0x2f4f86, { p: [0, 0.665, 0] });
    k.add(GEO.cyl(0.066, 0.072, 0.104, 30, true, ts, tl), 0xb8bec8, { p: [0, 0.665, 0] });
    k.add(GEO.sph(0.5, 18, 10), 0x2f4f86, { p: [0, 0.72, 0.06], s: [0.1, 0.035, 0.07] });
    k.add(GEO.cyl(0.011, 0.011, 0.006, 14), 0x111827, { p: [0, 0.655, 0.077], r: [PI / 2, 0, 0] });
  }, torso);
  dev.aed = put(k => {
    k.add(GEO.rbox(0.09, 0.12, 0.006, 0.003), 0xf8fafc, { p: [-0.085, 0.47, 0.112], r: [0, -0.4, 0] });
    k.add(GEO.rbox(0.065, 0.09, 0.004, 0.002), 0x9ca3af, { p: [-0.085, 0.47, 0.115], r: [0, -0.4, 0] });
    k.add(GEO.rbox(0.09, 0.12, 0.006, 0.003), 0xf8fafc, { p: [0.165, 0.33, 0.065], r: [0, 1.0, 0.1] });
    k.add(GEO.tube([[-0.06, 0.53, 0.115], [-0.13, 0.62, 0.13], [-0.22, 0.76, 0.1], [-0.3, 0.92, 0.05]], 0.0025, 20, 5), 0xdc2626);
    k.add(GEO.tube([[0.2, 0.38, 0.08], [0.06, 0.5, 0.15], [-0.15, 0.7, 0.13], [-0.3, 0.92, 0.05]], 0.0025, 20, 5), 0x111827);
  }, torso);
  P.aedInfantPads = put(k => k.add(GEO.rbox(0.12, 0.13, 0.008, 0.003), 0xf8fafc, { p: [0, 0.42, 0.118] }), torso);
  dev.tq = put(k => {
    k.add(GEO.cyl(0.083, 0.083, 0.04, 26, true), 0x1c1c1c, { p: [0, -0.12, 0], s: [1, 1, 1] });
    k.add(GEO.rbox(0.06, 0.012, 0.032, 0.004), 0x262626, { p: [0, -0.12, 0.088], r: [PI / 2, 0, 0] });
    k.add(GEO.cyl(0.006, 0.006, 0.085, 10), 0x333333, { p: [0, -0.12, 0.098], r: [0, 0, PI / 2] });
    k.add(GEO.box(0.03, 0.014, 0.003), 0xf8fafc, { p: [0, -0.1, 0.095] });
    k.add(GEO.rbox(0.016, 0.026, 0.006, 0.002), 0xdc2626, { p: [0.08, -0.12, 0.04] });
  }, P.legs[0].hp);
  dev.dressing = put(k => {
    k.add(GEO.cyl(0.076, 0.072, 0.11, 24, false), 0xe8dcc0, { p: [0, -0.27, 0] });
    k.add(GEO.rbox(0.08, 0.09, 0.012, 0.004), 0xf8fafc, { p: [0, -0.27, 0.074] });
  }, P.legs[0].hp);
  // world-level props
  { const g = new THREE.BoxGeometry(1.15, 0.025, 0.86, 24, 1, 16), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i), az = Math.abs(z); let y = pos.getY(i) + (az < 0.3 ? 0.245 * Math.cos(az / 0.3 * PI / 2) ** 0.6 : 0); if (az > 0.34) y -= (az - 0.34) * 1.6; pos.setY(i, y); }
    g.computeVertexNormals(); P.blanket = addM(g, std(0x3d5a80, { roughness: 0.95 }), world, [0.42, MT + 0.015, -1.3]); }
  { const sh = new THREE.Shape(); for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, r = 1 + 0.18 * Math.sin(a * 3) + 0.1 * Math.sin(a * 7 + 1); i ? sh.lineTo(r * Math.cos(a), r * Math.sin(a)) : sh.moveTo(r, 0); }
    P.blood = addM(new THREE.ShapeGeometry(sh), std(0x6b0000, { roughness: 0.12, envMapIntensity: 1.2 }), world); P.blood.rotation.x = -Math.PI / 2; }
  P.hands = buildEquip('cpr', 0.15, 0.2, 0.08); P.hands.rotation.y = Math.PI; world.add(P.hands);
  P.aedUnit = new THREE.Group(); const au = kitGroup(k => EQUIP.aed(k, true), { rough: 0.45 }); au.scale.setScalar(1.7); P.aedUnit.add(au);
  P.aedUnit.position.set(-0.86, MT + 0.01, -1.06); P.aedUnit.rotation.y = 0.3; world.add(P.aedUnit);
  P.shadow = blob(1.0, 0.5, 0, -1.3); P.shadow.position.y = MT + 0.003; P.shadow.material = BLOB.clone(); P.shadow.material.opacity = 0.6;
}
buildPatient();

function setJoints(torsoX, headX, shX, elX, hipX, knX) {
  P.torso.rotation.x = torsoX; P.head.rotation.x = headX;
  P.arms.forEach(a => { a.sh.rotation.x = shX; a.el.rotation.x = elX; });
  P.legs.forEach(l => { l.hp.rotation.x = hipX; l.kn.rotation.x = knX; });
}
function rebuildPatientLook() {
  const s = S;
  P.root.visible = !!s; P.blanket.visible = false; P.blood.visible = false; P.hands.visible = false; P.aedUnit.visible = false; P.shadow.visible = !!s;
  if (!s) return;
  const inf = s.age === 'infant', kid = s.age === 'child', fem = s.sex === 'f';
  P.mShirt.color.setHex(s.shirt);
  P.mPants.color.setHex(inf ? 0xf8f4ef : fem ? 0x264653 : 0x2b2d42);
  P.mShoe.color.setHex(inf ? 0xf3f0ea : 0x26262b);
  P.mHair.color.setHex(inf ? 0x6b4a2e : fem ? 0x4a2f1d : 0x2a2018);
  P.root.scale.setScalar(inf ? 0.34 : kid ? 0.62 : 1);
  P.head.scale.setScalar(inf ? 1.5 : kid ? 1.2 : 1); P.head.position.y = inf ? 0.74 : kid ? 0.77 : 0.785;
  P.arms.forEach(a => a.sh.scale.set(inf ? 1.15 : 1, inf ? 0.75 : 1, inf ? 1.15 : 1));
  P.legs.forEach(l => l.hp.scale.set(inf ? 1.2 : 1, inf ? 0.72 : 1, inf ? 1.2 : 1));
  P.bust.visible = fem && !inf && !kid; P.belt.visible = !inf; P.hairLong.visible = fem && !inf; P.hair.scale.setScalar(inf ? 0.985 : 1);
  P.wound.visible = s.bleed > 0;
  P.hands.scale.setScalar(inf ? 0.45 : kid ? 0.75 : 1);
  P.skinTex.mottled = null; P.mSkin.color.setHex(SKIN[s.skin] || SKIN.normal);
  P.lastPose = null; P.blink = 0;
}
function applyPose() {
  const s = S; if (P.lastPose === s.pose) return; P.lastPose = s.pose;
  const inf = s.age === 'infant', kid = s.age === 'child';
  if (s.pose === 'supine') {
    P.body.rotation.set(-Math.PI / 2, 0, 0); P.root.rotation.set(0, Math.PI / 2, 0); // head toward -x, patient's right side toward you
    P.root.position.set(inf ? -0.15 : kid ? -0.24 : 0.06, MT + (inf ? 0.04 : kid ? 0.07 : 0.112), -1.3); setJoints(0, inf ? 0 : 0.12, 0, 0, 0, 0);
    P.shadow.scale.set(inf ? 0.6 : kid ? 1.25 : 2, 1, inf ? 0.5 : kid ? 0.7 : 1); P.shadow.position.set(inf ? -0.25 : kid ? -0.2 : 0.1, MT + 0.003, -1.3);
  } else {
    P.body.rotation.set(0, 0, 0); P.root.rotation.set(0, -0.35, 0);
    P.root.position.set(-0.05, MT + (kid ? 0.055 : 0.085), -1.2);
    if (s.pose === 'tripod') setJoints(0.5, -0.45, -1.0, -0.35, -Math.PI / 2, Math.PI / 2);
    else setJoints(-0.08, 0.05, -0.3, -1.0, -Math.PI / 2, Math.PI / 2);
    P.shadow.scale.set(0.7, 1, 0.9); P.shadow.position.set(-0.1, MT + 0.003, -1.12);
  }
  placeBlood();
}
function placeBlood() {
  const s = S; if (!s || s.bleed <= 0) return;
  P.root.updateMatrixWorld(true); P.wound.getWorldPosition(v3);
  const r = Math.min(0.3, 0.14 + s.bleed * 0.25); P.blood.scale.set(r, r * 0.55, 1); P.blood.position.set(v3.x, MT + 0.004, v3.z - 0.03);
}
const tmpC = new THREE.Color();
let breathPhase = 0;
function animatePatient(dt, now) {
  const s = S; if (!s) return;
  applyPose();
  const k = Math.min(1, dt * 1.5);
  // skin color + texture (mottling) + sweat sheen
  P.mSkin.color.lerp(tmpC.setHex(SKIN[s.skin] || SKIN.normal), k);
  const mot = s.skin === 'mottled'; if (P.skinTex.mottled !== mot) { P.skinTex.mottled = mot; P.skinTex.draw(mot); }
  P.mSkin.roughness += ((s.sweat ? 0.28 : 0.62) - P.mSkin.roughness) * k;
  P.mLips.color.lerp(tmpC.setHex(s.skin === 'cyanotic' || s.skin === 'mottled' ? 0x4d5d9e : s.skin === 'pale' ? 0xc9928a : 0xb5655a), k);
  P.sweat.visible = s.sweat; P.hives.forEach(h => h.visible = s.hives); P.vomit.visible = s.vomit;
  P.lips.scale.setScalar(s.swelling ? 1.5 : 1);
  for (const key in P.dev) P.dev[key].visible = s.devices.has(key);
  if (s.devices.has('bvm')) P.dev.nrb.visible = P.dev.nc.visible = false;
  const inf = s.age === 'infant';
  if (inf && s.devices.has('aed')) { P.dev.aed.visible = false; P.aedInfantPads.visible = true; } else P.aedInfantPads.visible = false;
  P.aedUnit.visible = s.devices.has('aed');
  P.blanket.visible = s.devices.has('blanket') && s.pose === 'supine' && !inf;
  P.wound.visible = s.bleed > 0;
  P.blood.visible = s.bleed > 0; if (s.bleed > 0) { const r = Math.min(0.3, 0.14 + s.bleed * 0.25); if (Math.abs(P.blood.scale.x - r) > 0.005) placeBlood(); P.soak.scale.set(0.12 + s.bleed * 0.05, 0.17 + s.bleed * 0.1, 0.05); }
  // eyes by AVPU (A open + blinking, V droopy, P/U closed)
  const av = s.v.avpu, pl = s.pulseless;
  let open = pl || av === 'U' || av === 'P' ? 0 : av === 'V' ? 0.4 : 1;
  if (open === 1) { P.blink -= dt; if (P.blink < -3.5 - Math.random() * 3) P.blink = 0.14; if (P.blink > 0) open = 0; }
  const lidX = 1.62 - open * 2.1;
  P.lids.forEach(l => { l.rotation.x += (lidX - l.rotation.x) * Math.min(1, dt * 18); });
  const distress = s.sweat || s.pose === 'tripod' || s.chest < 0.55;
  P.brows.forEach(b => { b.rotation.z = Math.PI / 2 + (distress && av === 'A' ? -b.userData.sx * 0.28 : 0); b.position.y = distress && av === 'A' ? 0.046 : 0.043; });
  // breathing / CPR
  let z = 1, mouth = 0.05;
  if (s.cpr) {
    const c = Math.max(0, Math.sin(now * 0.001 * Math.PI * 2 * 1.83));
    z = 1 - 0.18 * c;
    P.hands.visible = true;
    const cp = new THREE.Vector3(0, 0.42, 0.12); P.torso.localToWorld(cp);
    P.hands.position.set(cp.x, cp.y + 0.005 - c * 0.04 * P.root.scale.x, cp.z);
  } else {
    P.hands.visible = false;
    const rr = s.v.rr, depth = s.chest;
    if (s.agonal && rr < 1) { const g = (now * 0.001) % 7; const gasp = g < 0.8 ? Math.sin(g / 0.8 * Math.PI) : 0; z = 1 + 0.1 * gasp; mouth = 0.1 + 0.9 * gasp; }
    else if (rr > 0.5) { breathPhase += dt * rr / 60 * Math.PI * 2; const b = 0.5 - 0.5 * Math.cos(breathPhase); z = 1 + 0.13 * depth * b; if (av === 'A' && (rr > 24 || s.pose === 'tripod')) mouth = 0.3 + 0.35 * b; }
  }
  P.chest.scale.set(1 + (z - 1) * 0.3, 1, z);
  P.abd.scale.set(1, 1, 1 + (z - 1) * 0.5);
  P.mouth.scale.y = 0.004 + 0.02 * mouth; P.lipL.position.y = -0.006 - 0.01 * mouth;
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
  // dispatch map card (VR panel texture)
  let top = 110;
  if (m.map && pendingScn && pendingScn.local) {
    const mw = W - 80, mh = 280;
    c.save(); c.translate(40, 100);
    paintMapCardSync(c, mw, mh, pendingScn.local);
    c.restore();
    top = 100 + mh + 20;
  }
  // text
  let bottom = btnTop - 22; const fs = 34, lh = 43;
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

// action panel (right): assessment + positioning + transport. Equipment & meds are picked from the 3D tray.
const actP = new Panel(1.2, 1.35, 1024, 1152, [1.3, 1.55, -1.3], -0.72);
let PANEL_ACTS = null;
function drawAct() {
  const Pn = actP, c = Pn.ctx, W = Pn.W, H = Pn.H; Pn.buttons = [];
  PANEL_ACTS = PANEL_ACTS || Object.keys(ACTIONS).filter(k => !TRAY.includes(k));
  c.clearRect(0, 0, W, H); rr(c, 4, 4, W - 8, H - 8, 30); c.fillStyle = 'rgba(16,24,40,0.95)'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#5b6b88'; c.stroke();
  const play = mode === 'play';
  c.fillStyle = '#fff'; c.font = 'bold 44px system-ui'; c.textBaseline = 'alphabetic'; c.fillText(play ? 'ASSESS & MOVE' : 'ACTIONS (start a patient first)', 36, 66);
  const bw = (W - 74) / 2, bh = 100, gap = 14;
  PANEL_ACTS.forEach((id, i) => { const b = { id: 'act:' + id, x: 30 + (i % 2) * (bw + gap), y: 96 + Math.floor(i / 2) * (bh + gap), w: bw, h: bh }; Pn.buttons.push(b);
    const done = S && S.log.some(l => l.text === '▶ ' + ACTIONS[id].label);
    drawBtn(c, Pn, b, (done ? '✓ ' : '') + ACTIONS[id].label, { dim: !play || (S && S.prompt), primary: id === 'transport' && play, size: 36 }); });
  const ty = 96 + Math.ceil(PANEL_ACTS.length / 2) * (bh + gap) + 10;
  c.fillStyle = '#ffd45e'; rr(c, 30, ty, W - 60, H - ty - 30, 20); c.globalAlpha = 0.14; c.fill(); c.globalAlpha = 1;
  c.fillStyle = '#ffd45e'; c.font = 'bold 38px system-ui'; c.fillText('EQUIPMENT & MEDS', 56, ty + 56);
  c.fillStyle = '#e8eef7'; c.font = '34px system-ui'; c.fillText('Point at an item on the red cart', 56, ty + 104); c.fillText('(below, on your right) and pull trigger.', 56, ty + 146);
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

// equipment tray (front-right): real-looking 3D equipment on a crash-cart top, name label under each item
const TRAY = ['spo2', 'bp', 'lungs', 'glucose', 'aed', 'cpr', 'nc', 'nrb', 'bvm', 'cpap', 'opa', 'npa', 'suction', 'asa', 'ntg', 'oralglucose', 'albuterol', 'epi', 'naloxone', 'tourniquet', 'dressing', 'collar', 'blanket', 'als'];
const TRAY_LABEL = EQUIP_LABEL;
const TW = 1.38, TH = 0.86, TC = 6, TR = 4, LBL = 0.068; // meters; LBL = label strip height
const tray = new THREE.Group(); tray.position.set(0.86, 0.9, -0.4); tray.rotation.set(-(Math.PI / 2 - 0.36), -0.6, 0, 'YXZ'); world.add(tray);
const trayP = new Panel(TW, TH, 1380, 860, [0, 0, 0], 0); tray.add(trayP.mesh); trayP.mesh.position.set(0, 0, 0);
{ // crash cart under the tray (decor)
  const cart = new THREE.Group(); cart.position.set(0.86, 0, -0.4); cart.rotation.y = -0.6; world.add(cart);
  addM(new RoundedBoxGeometry(1.34, 0.68, 0.58, 2, 0.03), std(0xc0392b, { roughness: 0.45 }), cart, [0, 0.4, -0.04]);
  [0xe5e7eb, 0x2563eb, 0xf59e0b, 0x16a34a].forEach((c, i) => addM(new RoundedBoxGeometry(1.24, 0.12, 0.02, 2, 0.008), std(c, { roughness: 0.5 }), cart, [0, 0.66 - i * 0.15, 0.255]));
  for (const x of [-0.58, 0.58]) for (const z of [-0.28, 0.2]) addM(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), std(0x1f2937), cart, [x, 0.04, z], [Math.PI / 2, 0, 0]);
  const o2 = buildO2Tank(); o2.position.set(0.76, 0.03, -0.05); cart.add(o2);
  blob(1.6, 0.85, 0.86, -0.4).rotation.z = 0.6;
}
const trayItems = [];
const cellRect = i => { const cw = TW / TC, ch = TH / TR; return { cx: (i % TC + 0.5) * cw - TW / 2, top: TH / 2 - Math.floor(i / TC) * ch, cw, ch }; };
TRAY.forEach((id, i) => {
  const { cx, top, cw, ch } = cellRect(i), zoneH = ch - LBL - 0.03;
  const it = buildEquip(id, cw - 0.06, zoneH - 0.02, 0.085);
  it.rotation.x = Math.PI / 2; // item "up" = out of the tray surface, item depth runs down toward its label
  it.position.set(cx, top - 0.015 - zoneH / 2, 0.004);
  it.traverse(o => { o.userData.action = id; });
  it.userData.base = 1; tray.add(it); trayItems.push(it);
});
function drawTray() {
  const Pn = trayP, c = Pn.ctx, W = Pn.W, H = Pn.H; Pn.buttons = [];
  c.clearRect(0, 0, W, H); c.fillStyle = '#2a3442'; rr(c, 0, 0, W, H, 26); c.fill(); c.lineWidth = 10; c.strokeStyle = '#8796ab'; c.stroke();
  const cw = W / TC, ch = H / TR, lh = LBL / TH * H;
  const used = new Set(S ? S.log.filter(l => l.text.startsWith('▶ ')).map(l => l.text.slice(2)) : []);
  TRAY.forEach((id, i) => {
    const x = (i % TC) * cw, y = Math.floor(i / TC) * ch, b = { id: 'act:' + id, x: x + 6, y: y + 6, w: cw - 12, h: ch - 12 }; Pn.buttons.push(b);
    const hov = Pn.hover === b.id;
    c.fillStyle = hov ? '#4a5568' : '#1b232e'; rr(c, b.x, b.y, b.w, b.h, 16); c.fill(); // foam cut-out
    if (hov) { c.lineWidth = 8; c.strokeStyle = '#ffd45e'; c.stroke(); }
    // label plate
    const ly = y + ch - lh - 8; c.fillStyle = hov ? '#ffd45e' : '#f4f7fb'; rr(c, x + 12, ly, cw - 24, lh, 12); c.fill();
    let fs = 46; c.font = `bold ${fs}px system-ui, sans-serif`;
    const txt = TRAY_LABEL[id]; while (c.measureText(txt).width > cw - 40 && fs > 26) { fs -= 2; c.font = `bold ${fs}px system-ui, sans-serif`; }
    c.fillStyle = '#111827'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x + cw / 2, ly + lh / 2 + 2); c.textAlign = 'left';
    if (used.has(ACTIONS[id].label)) { c.fillStyle = '#2f9e6a'; c.beginPath(); c.arc(x + 34, y + 34, 20, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 28px system-ui'; c.textAlign = 'center'; c.fillText('✓', x + 34, y + 35); c.textAlign = 'left'; }
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
  let mapHtml = '';
  if (m.map && pendingScn && pendingScn.local) {
    const c = document.createElement('canvas'); c.width = 640; c.height = 220; c.style.cssText = 'width:100%;border-radius:10px;margin:6px 0';
    paintMapCardSync(c.getContext('2d'), c.width, c.height, pendingScn.local);
    mapHtml = `<div id="d-map"></div>`;
    // defer paint into DOM after innerHTML
    queueMicrotask(() => { const box = $('d-map'); if (box) { box.innerHTML = ''; box.appendChild(c); } });
  }
  $('d-lines').innerHTML = mapHtml + (mode === 'play' ? m.lines.slice(-8) : m.lines).map(L => `<div style="color:${TONE[L.tone]}">${esc(L.text)}</div>`).join('');
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
  if (o.userData.action) return { panel: trayP, id: 'act:' + o.userData.action, item: true };
  const pn = o.userData.panel; if (!pn) return null;
  const b = pn.hit(inter.uv); return b ? { panel: pn, id: b.id } : { panel: pn, id: null };
}
let hovered = new Map();
function setHover(src, info) {
  const prev = hovered.get(src); hovered.set(src, info);
  const panels = new Set([mainP, actP, trayP]);
  panels.forEach(pn => { const h = [...hovered.values()].find(x => x && x.panel === pn && x.id); const id = h ? h.id : null; if (pn.hover !== id) { pn.hover = id; pn === mainP ? drawMain() : pn === actP ? drawAct() : drawTray(); } });
  trayItems.forEach(m => { const on = [...hovered.values()].some(x => x && x.id === 'act:' + m.userData.action); m.scale.setScalar(on ? 1.15 : 1); m.position.z = on ? 0.03 : 0.004; m.userData.mats.forEach(mt => mt.emissive.setHex(on ? 0x3a3214 : 0x000000)); });
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
    const inter = ray.intersectObjects(targets, true)[0];
    c.userData.line.scale.z = inter ? inter.distance : 4;
    c.userData.dot.visible = !!inter; if (inter) c.userData.dot.position.copy(inter.point);
    const info = hitInfo(inter); c.userData.hit = info;
    const prev = hovered.get(c);
    if ((prev && prev.id) !== (info && info.id)) setHover(c, info);
  }
}
const ndc = new THREE.Vector2();
function pick(e) { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return hitInfo(ray.intersectObjects(targets, true)[0]); }
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
function startAuto(i) { startScenario(i); if (mode === 'dispatch') confirmDispatch(); }
function startCaseAuto(scn) { startCase(scn); if (mode === 'dispatch') confirmDispatch(); }
window.__emt = { P, start: startAuto, startCase: startCaseAuto, makeCase, makeTemplate, TEMPLATE_IDS, pickSkill, skills: skillData, topSkills, act: doAction, answer: answerPrompt, state: () => S, tick, mode: () => mode, onButton, camera, renderer, scene, trayItems, hover: setHover, confirmDispatch, pending: () => pendingScn, localOn: isLocalOn, toggleLocal, locations: LOCATIONS, station: STATION, mapProviderInfo, attribution: ATTRIBUTION };
