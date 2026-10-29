// Grid Chamber — WebXR hub + voice-built worlds for Quest 2.
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildHub, getProgram, PROGRAMS } from './hub.js';
import { buildWorld, countDrawish } from './worlds.js';
import { createComputerUI, writeSave, readSave, listSaveNames } from './computer.js';
import { parseCommand } from './parser.js';
import { ensureAudio, chirpLoad, chirpFreeze } from './audio.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('view').appendChild(renderer.domElement);

const vrBtn = VRButton.createButton(renderer);
document.body.appendChild(vrBtn);
setTimeout(() => { if (!/ENTER/i.test(vrBtn.textContent || '')) vrBtn.style.display = 'none'; }, 2500);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050508);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
camera.position.set(0, 1.6, 2.2);
camera.lookAt(0, 1.3, -4);

// Player rig for locomotion (VR + desktop)
const player = new THREE.Group();
player.position.set(0, 0, 0);
scene.add(player);
player.add(camera);

let seated = false;
let mode = 'hub'; // hub | world | loading
let frozen = false;
let voiceReply = true;
let hub = buildHub({ seated });
scene.add(hub.group);

const worldRoot = new THREE.Group();
worldRoot.visible = false;
scene.add(worldRoot);
let worldState = null;
let currentSpec = null;
let loadGate = Promise.resolve();

// Dissolve overlay (full-screen grid flash)
const dissolveMat = new THREE.MeshBasicMaterial({ color: 0xe8a020, transparent: true, opacity: 0, depthTest: false });
const dissolveMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dissolveMat);
dissolveMesh.position.z = -1.2;
dissolveMesh.visible = false;
camera.add(dissolveMesh);

// Controllers + lasers
const controllers = [];
const ray = new THREE.Raycaster();
const tmpM = new THREE.Matrix4();
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xffc14a })
  );
  line.scale.z = 5; c.add(line); c.userData.line = line;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  dot.visible = false; scene.add(dot); c.userData.dot = dot;
  c.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.1), new THREE.MeshLambertMaterial({ color: 0x445566 })));
  c.addEventListener('connected', e => { c.userData.gamepad = e.data.gamepad; c.userData.handedness = e.data.handedness; });
  c.addEventListener('selectstart', () => onSelect(c));
  player.add(c);
  controllers.push(c);
}

// Teleport marker
const teleportMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.28, 24),
  new THREE.MeshBasicMaterial({ color: 0xe8a020, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
);
teleportMarker.rotation.x = -Math.PI / 2;
teleportMarker.visible = false;
scene.add(teleportMarker);

function pulse(c, s = 0.4, ms = 40) {
  try { c?.userData?.gamepad?.hapticActuators?.[0]?.pulse(s, ms); } catch {}
}

function panelTargets() {
  const t = [];
  if (mode === 'hub' && hub.group.visible) t.push(hub.panelMesh);
  return t;
}

function hitFromController(c) {
  tmpM.identity().extractRotation(c.matrixWorld);
  ray.ray.origin.setFromMatrixPosition(c.matrixWorld);
  ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
  const floors = [];
  worldRoot.traverse(o => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && Math.abs(o.rotation.x + Math.PI / 2) < 0.2) floors.push(o); });
  if (hub.group.visible) {
    hub.group.traverse(o => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry') floors.push(o); });
  }
  const panelHit = ray.intersectObjects(panelTargets(), false)[0];
  const floorHit = ray.intersectObjects(floors.length ? floors : [hub.group], true).find(h => h.face && h.point.y < 0.5);
  return { panelHit, floorHit, origin: ray.ray.origin.clone(), dir: ray.ray.direction.clone() };
}

function onSelect(c) {
  ensureAudio();
  const { panelHit, floorHit } = hitFromController(c);
  if (panelHit && mode === 'hub') {
    const btn = hub.hitButton(panelHit.uv);
    if (btn) { pulse(c, 0.6, 50); activateButton(btn); return; }
  }
  // teleport if aiming at floor
  if (floorHit && teleportMarker.visible) {
    player.position.x = teleportMarker.position.x;
    player.position.z = teleportMarker.position.z;
    pulse(c, 0.5, 40);
  }
}

function activateButton(btn) {
  if (btn.id === 'seat') {
    seated = !seated;
    hub.setSeated(seated);
    // shift player height feel via camera offset in non-XR; in XR local-floor handles it — nudge world
    if (!renderer.xr.isPresenting) camera.position.y = seated ? 1.2 : 1.6;
    computer.say(seated ? 'Seated mode on.' : 'Seated mode off.');
    return;
  }
  if (btn.id === 'mic') {
    document.getElementById('comp-mic')?.click();
    return;
  }
  if (btn.id === 'type') {
    computer.setVisible(true);
    computer.focus();
    computer.say('Type a command.');
    return;
  }
  const prog = getProgram(btn.id);
  if (!prog) return;
  if (prog.id === 'create') {
    computer.setVisible(true);
    computer.focus();
    computer.say('Describe a world.');
    return;
  }
  if (prog.href) launchExternal(prog);
}

async function launchExternal(prog) {
  computer.say(`Loading ${prog.title}…`);
  chirpLoad();
  await playDissolve(0.9);
  // End XR session gracefully then navigate
  try {
    const session = renderer.xr.getSession?.();
    if (session) await session.end();
  } catch {}
  // Relative path from /EMT/holodeck/ → ../ or ../lab/
  location.href = prog.href;
}

function playDissolve(target = 1) {
  return new Promise(resolve => {
    dissolveMesh.visible = true;
    let a = 0;
    const start = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - start) / 450);
      a = u * target;
      dissolveMat.opacity = Math.sin(u * Math.PI) * 0.85;
      hub.playDissolve(u);
      if (worldRoot.visible) worldRoot.traverse(o => {
        if (o.material && o.material.opacity !== undefined && o.userData.sky) {
          /* keep sky */
        }
      });
      if (u < 1) requestAnimationFrame(step);
      else {
        dissolveMat.opacity = 0;
        dissolveMesh.visible = false;
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

async function enterWorld(spec) {
  mode = 'loading';
  chirpLoad();
  computer.say(spec._reply || 'Creating…');
  await playDissolve(1);
  hub.group.visible = false;
  worldRoot.visible = true;
  worldState = buildWorld(spec, worldRoot);
  currentSpec = worldState.spec;
  const fog = worldState.getFog();
  if (fog) {
    scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
    scene.background = new THREE.Color(fog.color);
  } else {
    scene.fog = null;
    scene.background = new THREE.Color(0x000008);
  }
  hub.playDissolve(0);
  player.position.set(0, 0, 0);
  mode = 'world';
  updateHUD();
}

async function endWorld() {
  await playDissolve(0.8);
  worldRoot.visible = false;
  while (worldRoot.children.length) worldRoot.remove(worldRoot.children[0]);
  worldState = null;
  currentSpec = null;
  hub.group.visible = true;
  hub.playDissolve(0);
  scene.fog = null;
  scene.background = new THREE.Color(0x050508);
  player.position.set(0, 0, 0);
  mode = 'hub';
  updateHUD();
  computer.say('Back in the grid.');
}

async function applyCommand(result) {
  if (!result.ok) return result;
  const { action, payload } = result;
  if (action === 'end') { await endWorld(); return result; }
  if (action === 'arch') {
    if (mode === 'world') await endWorld();
    else computer.say('Arch online.');
    return result;
  }
  if (action === 'freeze') {
    frozen = true;
    if (worldState) worldState.frozen = true;
    chirpFreeze();
    return result;
  }
  if (action === 'unfreeze') {
    frozen = false;
    if (worldState) worldState.frozen = false;
    return result;
  }
  if (action === 'save') {
    if (!currentSpec) { computer.say('Nothing to save.', false); return result; }
    writeSave(payload.name, currentSpec);
    return result;
  }
  if (action === 'load') {
    const s = readSave(payload.name);
    if (!s) { computer.say(`No program named ${payload.name}.`, false); return result; }
    await enterWorld({ ...s.spec, _reply: `Loading ${payload.name}.` });
    return result;
  }
  if (action === 'list') {
    const names = listSaveNames();
    computer.say(names.length ? names.join(', ') : 'No saved programs.');
    return result;
  }
  if (action === 'create') {
    await enterWorld({ ...payload, _reply: result.reply });
    return result;
  }
  if (action === 'add') {
    if (mode !== 'world' || !worldState) {
      await enterWorld({ environment: 'meadow', time: 'noon', weather: 'clear', objects: [payload.object], _reply: result.reply });
      return result;
    }
    worldState.addObject(payload.object);
    currentSpec.objects = currentSpec.objects || [];
    if (!currentSpec.objects.includes(payload.object)) currentSpec.objects.push(payload.object);
    return result;
  }
  if (action === 'remove') {
    if (worldState) {
      worldState.removeObject(payload.object);
      if (currentSpec?.objects) currentSpec.objects = currentSpec.objects.filter(o => o !== payload.object);
    }
    return result;
  }
  if (action === 'time' || action === 'weather') {
    if (!currentSpec) {
      await enterWorld({
        environment: 'meadow',
        time: action === 'time' ? payload.time : 'noon',
        weather: action === 'weather' ? payload.weather : 'clear',
        objects: [],
        _reply: result.reply
      });
      return result;
    }
    const next = {
      ...currentSpec,
      time: action === 'time' ? payload.time : currentSpec.time,
      weather: action === 'weather' ? payload.weather : currentSpec.weather,
      _reply: result.reply
    };
    await enterWorld(next);
  }
  return result;
}

const computer = createComputerUI(document.getElementById('ui'), {
  onCommand: (result) => { loadGate = applyCommand(result); return loadGate; },
  voiceReply: () => voiceReply
});

function updateHUD() {
  const el = document.getElementById('hud-mode');
  if (el) el.textContent = mode === 'hub' ? 'GRID' : mode === 'world' ? (currentSpec?.environment || 'WORLD').toUpperCase() : '…';
  document.body.dataset.mode = mode;
}

// Desktop look + WASD
let yaw = 0, pitch = 0;
const keys = new Set();
const look = () => {
  if (renderer.xr.isPresenting) return;
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
};
look();

const canvas = renderer.domElement;
let dragging = false, lx = 0, ly = 0;
canvas.addEventListener('pointerdown', e => {
  if (e.button === 0) {
    // click panel in desktop
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(panelTargets(), false);
    if (hits[0] && mode === 'hub') {
      const btn = hub.hitButton(hits[0].uv);
      if (btn) { ensureAudio(); activateButton(btn); return; }
    }
  }
  dragging = true; lx = e.clientX; ly = e.clientY;
  canvas.setPointerCapture?.(e.pointerId);
});
addEventListener('pointermove', e => {
  if (!dragging || renderer.xr.isPresenting) {
    // hover panel
    if (!renderer.xr.isPresenting && mode === 'hub') {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      );
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(panelTargets(), false);
      const btn = hits[0] ? hub.hitButton(hits[0].uv) : null;
      hub.setHover(btn?.id || null);
      canvas.style.cursor = btn ? 'pointer' : 'default';
    }
    return;
  }
  yaw -= (e.clientX - lx) * 0.004;
  pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - ly) * 0.004));
  lx = e.clientX; ly = e.clientY;
  look();
});
addEventListener('pointerup', () => { dragging = false; });

addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (e.key === '`' || e.key === 'Tab') {
    if (e.target.tagName === 'INPUT') return;
    e.preventDefault();
    computer.setVisible(true);
    computer.focus();
  }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// Snap-turn state
let snapCooldown = 0;
const SNAP = Math.PI / 6;

function updateLocomotion(dt) {
  // Desktop WASD
  if (!renderer.xr.isPresenting) {
    const sp = (keys.has('shift') ? 4 : 2) * dt;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    if (keys.has('w')) player.position.addScaledVector(forward, sp);
    if (keys.has('s')) player.position.addScaledVector(forward, -sp);
    if (keys.has('a')) player.position.addScaledVector(right, -sp);
    if (keys.has('d')) player.position.addScaledVector(right, sp);
    return;
  }

  // VR: left stick move, right stick snap-turn; show teleport marker along laser
  snapCooldown = Math.max(0, snapCooldown - dt);
  let showTp = false;
  for (const c of controllers) {
    const gp = c.userData.gamepad;
    if (!gp) continue;
    const axes = gp.axes || [];
    // Quest Touch: axes 2,3 often thumbstick
    const ax = axes.length >= 4 ? axes[2] : axes[0] || 0;
    const ay = axes.length >= 4 ? axes[3] : axes[1] || 0;
    const hand = c.userData.handedness;

    if (hand === 'right' || (!hand && controllers.indexOf(c) === 1)) {
      if (Math.abs(ax) > 0.7 && snapCooldown === 0) {
        player.rotation.y -= Math.sign(ax) * SNAP;
        snapCooldown = 0.35;
        pulse(c, 0.3, 30);
      }
    }
    if (hand === 'left' || (!hand && controllers.indexOf(c) === 0)) {
      if (Math.hypot(ax, ay) > 0.15) {
        const speed = 2.5 * dt;
        const facing = player.rotation.y;
        const forward = new THREE.Vector3(-Math.sin(facing), 0, -Math.cos(facing));
        const right = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing));
        player.position.addScaledVector(forward, -ay * speed);
        player.position.addScaledVector(right, ax * speed);
      }
    }

    // teleport aim: when stick clicked (axes button) or secondary — use gamepad buttons[0]
    const { floorHit } = hitFromController(c);
    if (floorHit && gp.buttons?.[0]?.pressed) {
      teleportMarker.position.set(floorHit.point.x, 0.02, floorHit.point.z);
      showTp = true;
    }
  }
  teleportMarker.visible = showTp;
}

function updateLasers() {
  for (const c of controllers) {
    if (!c.userData.gamepad && !renderer.xr.isPresenting) {
      c.userData.dot.visible = false;
      continue;
    }
    const { panelHit, floorHit } = hitFromController(c);
    const hit = panelHit || floorHit;
    c.userData.line.scale.z = hit ? hit.distance : 5;
    c.userData.dot.visible = !!hit;
    if (hit) c.userData.dot.position.copy(hit.point);
    if (panelHit && mode === 'hub') {
      const btn = hub.hitButton(panelHit.uv);
      hub.setHover(btn?.id || null);
    }
  }
}

function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);

renderer.xr.addEventListener('sessionstart', () => {
  document.body.classList.add('inxr');
  computer.setVisible(false);
});
renderer.xr.addEventListener('sessionend', () => {
  document.body.classList.remove('inxr');
  computer.setVisible(true);
});

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (!frozen && worldState?.anim) worldState.anim(t, dt);
  updateLocomotion(dt);
  if (renderer.xr.isPresenting) updateLasers();
  renderer.render(scene, camera);
});

updateHUD();
document.getElementById('loading')?.remove();

// Headless / debug API
window.__holodeck = {
  parse: parseCommand,
  run: async (cmd) => { const r = computer.run(cmd); await (r._done || loadGate); return r; },
  ready: () => loadGate,
  mode: () => mode,
  spec: () => currentSpec,
  seated: () => seated,
  setSeated: (v) => { seated = !!v; hub.setSeated(seated); },
  programs: PROGRAMS,
  enterWorld,
  endWorld,
  drawInfo: () => ({
    ...renderer.info.render,
    world: worldRoot.visible ? countDrawish(worldRoot) : countDrawish(hub.group)
  }),
  saves: listSaveNames,
  save: writeSave,
  load: (n) => readSave(n),
  camera, player, scene, renderer, hub, worldRoot,
  setView: (pos, lookAt) => {
    if (pos) camera.position.set(...pos);
    if (lookAt) camera.lookAt(...lookAt);
    yaw = camera.rotation.y; pitch = camera.rotation.x;
  },
  screenshotReady: true
};
