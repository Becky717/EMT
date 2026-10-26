// The 3D Renaissance workshop: WebXR room with the puzzle on an easel and the controls on a lectern.
// Draw-call budget ~70, Lambert materials, one point light, no shadows: aimed at 72 fps on Quest 2.
import * as THREE from 'three';
import { BW, BH } from './render.js';
import { PW, PH } from './ui.js';

let R = null; // { renderer, scene, camera, board, panel, ... }
const BOARD_W = 1.75, BOARD_H = BOARD_W * BH / BW, PANEL_H = BOARD_H, PANEL_W = PANEL_H * PW / PH;

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function noise(g, w, h, base, n, alpha, seed = 3) { g.fillStyle = base; g.fillRect(0, 0, w, h); let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${r() * 60 | 0},${r() * 40 | 0},${r() * 20 | 0},${r() * alpha})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); } }
const woodTex = () => canvasTex(512, 512, (g, w, h) => { noise(g, w, h, '#6e4524', 3000, 0.25); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(40,20,5,0.18)' : 'rgba(255,220,160,0.06)'; g.fillRect(0, i * 64, w, 64); g.fillStyle = 'rgba(20,10,0,0.6)'; g.fillRect(0, i * 64, w, 3); } for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(30,15,5,0.25)'; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 8, w * 2 / 3, y - 8, w, y + 3); g.stroke(); } });
const plasterTex = () => canvasTex(512, 512, (g, w, h) => { noise(g, w, h, '#cdb68c', 9000, 0.12, 9); });
const leather = c => new THREE.MeshLambertMaterial({ color: c });

function gearShape(N, r) { const s = new THREE.Shape(); const ro = r * 1.08, ri = r * 0.9; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, d = Math.PI / N; const pts = [[ri, a], [ro, a + d * 0.25], [ro, a + d * 0.85], [ri, a + d * 1.1]]; pts.forEach(([rr, aa], k) => (i === 0 && k === 0 ? s.moveTo : s.lineTo).call(s, Math.cos(aa) * rr, Math.sin(aa) * rr)); s.lineTo(Math.cos(a + 2 * d) * ri, Math.sin(a + 2 * d) * ri); } const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.18, 0, Math.PI * 2, true); s.holes.push(hole); return s; }

function buildRoom(game, opts) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1d140b'); scene.fog = new THREE.Fog('#1d140b', 7, 16);
  scene.add(new THREE.HemisphereLight('#ffe2b0', '#3a2410', 1.6));
  const candle = new THREE.PointLight('#ffb35c', 14, 9, 1.6); candle.position.set(0, 2.9, -0.8); scene.add(candle);
  const wood = woodTex(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(4, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshLambertMaterial({ map: wood })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const plaster = plasterTex(); plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping; plaster.repeat.set(3, 1.2);
  const wallMat = new THREE.MeshLambertMaterial({ map: plaster });
  const room = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 9), [wallMat, wallMat, new THREE.MeshLambertMaterial({ color: '#3b2814' }), wallMat, wallMat, wallMat].map(m => { m.side = THREE.BackSide; return m; }));
  room.position.set(0, 2.1, -1); scene.add(room);
  const beamMat = new THREE.MeshLambertMaterial({ color: '#3d2614' });
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(9, 0.25, 0.3), beamMat, 6); const m4 = new THREE.Matrix4();
  for (let i = 0; i < 5; i++) { m4.makeTranslation(0, 4.0, -5 + i * 2); beams.setMatrixAt(i, m4); } m4.makeRotationY(Math.PI / 2).setPosition(0, 3.85, -1); beams.setMatrixAt(5, m4); scene.add(beams);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 4.2, 0.3), beamMat, 4); [[-4.35, -5.35], [4.35, -5.35], [-4.35, 3.35], [4.35, 3.35]].forEach(([x, z], i) => { m4.makeTranslation(x, 2.1, z); posts.setMatrixAt(i, m4); }); scene.add(posts);
  // easel + lectern carrying the live canvases
  const seated = !!game.tutor.s.seated, cy = seated ? 1.2 : 1.5;
  const boardTex = new THREE.CanvasTexture(game.bc), panelTex = new THREE.CanvasTexture(game.pc);
  for (const t of [boardTex, panelTex]) { t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.anisotropy = 4; }
  const rig = new THREE.Group(); scene.add(rig);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_H), new THREE.MeshBasicMaterial({ map: boardTex })); board.position.set(-0.28, cy, -1.45); board.userData.target = 'board'; rig.add(board);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), new THREE.MeshBasicMaterial({ map: panelTex }));
  panel.position.set(-0.28 + BOARD_W / 2 + PANEL_W / 2 * Math.cos(0.45) + 0.06, cy, -1.45 + PANEL_W / 2 * Math.sin(0.45) + 0.02); panel.rotation.y = -0.45; panel.userData.target = 'panel'; rig.add(panel);
  const frameMat = new THREE.MeshLambertMaterial({ color: '#5a3518' });
  const fr = (w, h, x, y, z, ry = 0) => { const g = new THREE.Group(); const t = 0.06; for (const [bw, bh, bx, by] of [[w + 2 * t, t, 0, h / 2 + t / 2], [w + 2 * t, t, 0, -h / 2 - t / 2], [t, h, -w / 2 - t / 2, 0], [t, h, w / 2 + t / 2, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), frameMat); m.position.set(bx, by, -0.01); g.add(m); } const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), frameMat); back.position.z = -0.03; g.add(back); g.position.set(x, y, z); g.rotation.y = ry; return g; };
  rig.add(fr(BOARD_W, BOARD_H, board.position.x, cy, board.position.z));
  rig.add(fr(PANEL_W, PANEL_H, panel.position.x, cy, panel.position.z, panel.rotation.y));
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1, 0.07), frameMat, 3);
  [[-0.9, -1.0, 0.12], [0.6, -1.0, -0.12], [-0.15, -1.75, 0]].forEach(([x, z, rz], i) => { m4.makeRotationZ(rz).setPosition(x - 0.13, (cy - BOARD_H / 2) / 2, z - 0.42); m4.scale(new THREE.Vector3(1, Math.max(0.2, cy - BOARD_H / 2 + 0.2), 1)); legs.setMatrixAt(i, m4); }); rig.add(legs);
  // workbench with codices, globe, candles
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.8), new THREE.MeshLambertMaterial({ map: wood })); bench.position.set(-2.6, 0.85, -1.6); scene.add(bench);
  const benchLegs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.85, 0.08), frameMat, 4); [[-1.1, -0.35], [1.1, -0.35], [-1.1, 0.35], [1.1, 0.35]].forEach(([x, z], i) => { m4.makeTranslation(-2.6 + x, 0.42, -1.6 + z); benchLegs.setMatrixAt(i, m4); }); scene.add(benchLegs);
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.07, 0.42), leather('#ffffff'), 5); const cols = ['#6b1f14', '#3e2a14', '#24391f', '#5a3a12', '#2d1f3a'];
  for (let i = 0; i < 5; i++) { m4.makeRotationY((i * 0.37) % 0.6 - 0.3).setPosition(-3.3, 0.93 + i * 0.072, -1.65); books.setMatrixAt(i, m4); books.setColorAt(i, new THREE.Color(cols[i])); } scene.add(books);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshLambertMaterial({ map: opts.images.galileo_moon ? new THREE.Texture(opts.images.galileo_moon) : null, color: '#d8c49a' })); if (globe.material.map) { globe.material.map.needsUpdate = true; globe.material.map.colorSpace = THREE.SRGBColorSpace; } globe.position.set(-1.9, 1.15, -1.6); scene.add(globe);
  const brass = new THREE.MeshLambertMaterial({ color: '#b88a2e', emissive: '#2a1a05' });
  const gA = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(16, 0.18), { depth: 0.04, bevelEnabled: false }), brass); gA.position.set(-2.75, 1.12, -1.75);
  const gB = new THREE.Mesh(new THREE.ExtrudeGeometry(gearShape(24, 0.27), { depth: 0.04, bevelEnabled: false }), brass); gB.position.set(-2.75 + 0.45 + 0.015, 1.12 + 0.0, -1.75);
  scene.add(gA, gB);
  // Archimedes screw on a trestle (right side)
  const screw = new THREE.Group(); const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#8b5a2b', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  const pts = []; for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 14; pts.push(new THREE.Vector3(Math.cos(a) * 0.13, -0.9 + i / 120 * 1.8, Math.sin(a) * 0.13)); }
  const helix = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.02, 5), brass); screw.add(tube, helix); screw.rotation.z = -0.65; screw.position.set(3.4, 1.0, -3.4); scene.add(screw);
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.35, 18), new THREE.MeshLambertMaterial({ color: '#5a3518' })); tub.position.set(2.8, 0.18, -3.2); scene.add(tub);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshLambertMaterial({ color: '#3f6f8a' })); water.rotation.x = -Math.PI / 2; water.position.set(2.8, 0.33, -3.2); scene.add(water);
  // Montgolfier balloon model hanging from the beams
  const balloon = new THREE.Group(); const env = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 16), new THREE.MeshLambertMaterial({ color: '#b5442e' })); env.scale.y = 1.25;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 24), brass); band.rotation.x = Math.PI / 2;
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.12, 10), leather('#7a5530')); basket.position.y = -0.8;
  balloon.add(env, band, basket); balloon.position.set(1.8, 3.0, -0.4); scene.add(balloon);
  // pendulum clock on the left wall
  const clock = new THREE.Group(); const case_ = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 0.25), leather('#4a2c14')); case_.position.y = 0.95;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshLambertMaterial({ color: '#efe2c2' })); face.position.set(0, 1.6, 0.13);
  const pend = new THREE.Group(); const rod = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.8, 0.015), brass); rod.position.y = -0.4; const bob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), brass); bob.position.y = -0.8; pend.add(rod, bob); pend.position.set(0, 1.35, 0.14);
  clock.add(case_, face, pend); clock.position.set(-4.3, 0, 0.2); clock.rotation.y = Math.PI / 2; scene.add(clock);
  // chandelier & candles (emissive flames, no extra lights)
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcc66' }), waxMat = new THREE.MeshLambertMaterial({ color: '#efe6cf' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 6, 32), new THREE.MeshLambertMaterial({ color: '#2a1a0e' })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 3.1, -0.8); scene.add(ring);
  const wax = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), waxMat, 9), flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.022, 0.07, 6), flameMat, 9);
  const candlePos = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; candlePos.push([Math.cos(a) * 0.55, 3.18, -0.8 + Math.sin(a) * 0.55]); } candlePos.push([-3.0, 0.97, -1.4], [-2.1, 0.97, -1.35], [-1.6, 0.97, -1.75]);
  candlePos.forEach(([x, y, z], i) => { m4.makeTranslation(x, y, z); wax.setMatrixAt(i, m4); m4.makeTranslation(x, y + 0.11, z); flames.setMatrixAt(i, m4); }); scene.add(wax, flames);
  const benchLight = new THREE.PointLight('#ffae55', 3, 3, 2); benchLight.position.set(-2.4, 1.3, -1.4); scene.add(benchLight);
  // framed drawings around the walls
  const art = [['leonardo_flying_machine', -4.45, 2.2, -2.6, Math.PI / 2], ['leonardo_vitruvian', -4.45, 2.2, -0.9, Math.PI / 2], ['leonardo_gears', -4.45, 2.2, 1.6, Math.PI / 2], ['galileo_portrait', -2.9, 2.6, -5.45, 0], ['galileo_moon', -1.4, 2.75, -5.45, 0], ['archimedes_lever', 0.2, 2.75, -5.45, 0], ['archimedes_fetti', 1.8, 2.6, -5.45, 0], ['hero_aeolipile', 3.1, 2.6, -5.45, 0], ['taccola_crane', 4.45, 2.2, -2.8, -Math.PI / 2], ['montgolfier_balloon', 4.45, 2.2, -1.0, -Math.PI / 2], ['ramelli_bookwheel', 4.45, 2.2, 0.8, -Math.PI / 2], ['agricola_mining', 4.45, 2.2, 2.4, -Math.PI / 2], ['stevin_clootcrans', -1.5, 2.3, 3.3, Math.PI], ['torricelli_barometer', 1.5, 2.3, 3.3, Math.PI]];
  const capOf = k => opts.credits.find(c => c.key === k);
  for (const [k, x, y, z, ry] of art) {
    const im = opts.images[k]; if (!im || !im.naturalWidth) continue;
    const h = 1.0, w = Math.min(1.3, h * im.naturalWidth / im.naturalHeight), cap = capOf(k);
    const tex = canvasTex(512, Math.round(512 * (h + 0.16) / w), (g, cw, ch) => { const ih = cw * h / w; g.fillStyle = '#e9d8b0'; g.fillRect(0, 0, cw, ch); g.drawImage(im, 0, 0, cw, ih); g.fillStyle = '#3a2716'; g.font = `italic ${Math.round(cw / 22)}px Georgia, serif`; g.textAlign = 'center'; g.fillText((cap?.credit_name || '').slice(0, 40), cw / 2, ih + (ch - ih) * 0.45); g.font = `${Math.round(cw / 28)}px Georgia, serif`; g.fillText((cap?.caption || '').slice(0, 52), cw / 2, ih + (ch - ih) * 0.85); });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h + 0.16), new THREE.MeshLambertMaterial({ map: tex })); pic.position.set(x, y, z); pic.rotation.y = ry; pic.translateZ(0.04); scene.add(pic);
    const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.28, 0.04), new THREE.MeshLambertMaterial({ color: '#6b4423' })); f.position.set(x, y, z); f.rotation.y = ry; scene.add(f);
  }
  return { scene, board, panel, boardTex, panelTex, rig, anim: t => { gA.rotation.z = t * 0.6; gB.rotation.z = -t * 0.6 * 16 / 24 + 0.13; helix.rotation.y = t * 1.5; pend.rotation.z = Math.sin(t * Math.PI) * 0.2; balloon.position.y = 3.0 + Math.sin(t * 0.7) * 0.05; balloon.rotation.y = t * 0.1; const s = 1 + Math.sin(t * 17) * 0.12; flames.scale.set(1, s, 1); candle.intensity = 14 + Math.sin(t * 9) * 0.8; } };
}

const ray = new THREE.Raycaster(), tmpM = new THREE.Matrix4();
function uvHit(world, origin, dir) { ray.set(origin, dir); const h = ray.intersectObjects([world.board, world.panel], false)[0]; if (!h) return null; const tg = h.object.userData.target; const W = tg === 'board' ? BW : PW, H = tg === 'board' ? BH : PH; return { target: tg, x: h.uv.x * W, y: (1 - h.uv.y) * H, dist: h.distance }; }
// Upload canvases only when they were redrawn; while a machine runs the lectern changes little, so refresh it at ~6 Hz.
let panelSkip = 0;
function syncTex(game, world, drew) { if (!drew) return; world.boardTex.needsUpdate = true; if (!game.running || ++panelSkip % 6 === 0) world.panelTex.needsUpdate = true; }

export async function startXR(game, session, opts) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('view3d').appendChild(renderer.domElement);
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor'); renderer.xr.setFoveation(1);
  const world = buildRoom(game, opts);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 30); camera.position.set(0, 1.6, 0); world.scene.add(camera);
  await renderer.xr.setSession(session);
  const lasers = [];
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffd27a' })); line.scale.z = 3; c.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); c.add(dot); c.userData.dot = dot;
    c.addEventListener('connected', e => { c.userData.gamepad = e.data.gamepad; });
    c.addEventListener('selectstart', () => { active = c; const h = cast(c); if (h) game.pointer('down', h.target, h.x, h.y); pulse(c, 0.3, 30); });
    c.addEventListener('selectend', () => { const h = cast(c); game.pointer('up', h?.target || 'board', h?.x ?? -1, h?.y ?? -1); });
    world.scene.add(c); lasers.push({ c, line });
  }
  let active = lasers[1]?.c;
  const o = new THREE.Vector3(), d = new THREE.Vector3();
  function cast(c) { tmpM.identity().extractRotation(c.matrixWorld); o.setFromMatrixPosition(c.matrixWorld); d.set(0, 0, -1).applyMatrix4(tmpM); return uvHit(world, o, d); }
  function pulse(c, s, ms) { try { c.userData.gamepad?.hapticActuators?.[0]?.pulse(s, ms); } catch { } }
  const prevEvt = game.onEvent; game.onEvent = e => { prevEvt(e); if (e === 'win') pulse(active, 0.8, 200); if (e === 'place') pulse(active, 0.5, 40); };
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(now => {
    const t = clock.getElapsedTime();
    for (const { c, line } of lasers) { const h = cast(c); line.scale.z = h ? h.dist : 3; c.userData.dot.position.set(0, 0, -(h ? h.dist : 3)); if (c === active && h) game.pointer('move', h.target, h.x, h.y); }
    syncTex(game, world, opts.frame(now));
    world.anim(t);
    renderer.render(world.scene, camera);
  });
  session.addEventListener('end', () => { renderer.setAnimationLoop(null); renderer.dispose(); renderer.domElement.remove(); game.onEvent = prevEvt; opts.onEnd?.(); });
  R = { renderer, world, camera, mode: 'xr' };
  return R;
}

// Non-XR preview of the same room (desktop 3D view + headless tests): drag to look, click the easel to play.
export async function startPreview(game, opts) {
  const el = opts.el;
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; el.appendChild(renderer.domElement);
  const world = buildRoom(game, opts);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 30); camera.position.set(0.05, game.tutor.s.seated ? 1.25 : 1.6, 0.35);
  let yaw = 0, pitch = -0.02, dragging = false, moved = 0, lx = 0, ly = 0;
  const look = () => { camera.rotation.set(pitch, yaw, 0, 'YXZ'); }; look();
  const ndc = new THREE.Vector2();
  const hitAt = e => { const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects([world.board, world.panel], false)[0]; if (!h) return null; const tg = h.object.userData.target; return { target: tg, x: h.uv.x * (tg === 'board' ? BW : PW), y: (1 - h.uv.y) * (tg === 'board' ? BH : PH) }; };
  const cv = renderer.domElement;
  const down = e => { const h = hitAt(e); if (h) { game.pointer('down', h.target, h.x, h.y); } else { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; } };
  const move = e => { if (dragging) { yaw -= (e.clientX - lx) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; look(); return; } const h = hitAt(e); if (h) game.pointer('move', h.target, h.x, h.y); };
  const up = e => { if (dragging) { dragging = false; return; } const h = hitAt(e); game.pointer('up', h?.target || 'board', h?.x ?? -1, h?.y ?? -1); };
  cv.addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up);
  const onResize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }; addEventListener('resize', onResize);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(now => { syncTex(game, world, opts.frame(now)); world.anim(clock.getElapsedTime()); renderer.render(world.scene, camera); });
  R = { renderer, world, camera, mode: 'preview', setLook: (y, p) => { yaw = y; pitch = p; look(); }, cleanup: () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('resize', onResize); } };
  return R;
}
export function stopPreview() { if (!R || R.mode !== 'preview') return; R.renderer.setAnimationLoop(null); R.cleanup(); R.renderer.dispose(); R.renderer.domElement.remove(); R = null; }
export function info() { if (!R) return null; return { calls: R.renderer.info.render.calls, triangles: R.renderer.info.render.triangles, textures: R.renderer.info.memory.textures, geometries: R.renderer.info.memory.geometries }; }
export function current() { return R; }
