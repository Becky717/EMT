// Grid chamber + arch control panel (original sci-fi style; no franchise assets).
import * as THREE from 'three';

export const PROGRAMS = [
  { id: 'emt', title: 'EMT Patient Simulator', subtitle: 'Quest · laser + trigger', href: '../', color: '#2f9e6a' },
  { id: 'lab', title: 'Renaissance Workshop', subtitle: 'Pulleys · levers · gears', href: '../lab/', color: '#c4a035' },
  { id: 'create', title: 'Create a World', subtitle: 'Voice or type a scene', href: null, color: '#4a8fd8' },
  // Room for more:
  // { id: 'future', title: '…', subtitle: '', href: '../x/', color: '#888' },
];

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#050508';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#e8a020';
  g.lineWidth = 3;
  g.globalAlpha = 0.95;
  const step = 64;
  for (let i = 0; i <= 512; i += step) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  // brighter crossings
  g.fillStyle = '#ffc14a';
  for (let x = 0; x <= 512; x += step) for (let y = 0; y <= 512; y += step) {
    g.globalAlpha = 0.9;
    g.fillRect(x - 2, y - 2, 4, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function panelCanvas(w, h, programs, hoverId, seated) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  // dark arch console
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c1520'); bg.addColorStop(1, '#061018');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // amber frame
  g.strokeStyle = '#e8a020'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
  g.strokeStyle = '#7a5010'; g.lineWidth = 2; g.strokeRect(18, 18, w - 36, h - 36);

  g.fillStyle = '#e8a020';
  g.font = '700 36px system-ui,sans-serif';
  g.textAlign = 'center';
  g.fillText('ARCH CONTROL', w / 2, 60);
  g.font = '500 18px system-ui,sans-serif';
  g.fillStyle = '#8ab0c8';
  g.fillText('Select a program', w / 2, 92);

  const buttons = [];
  const bw = w - 80, bh = 88, bx = 40;
  let by = 120;
  for (const p of programs) {
    const hot = hoverId === p.id;
    g.fillStyle = hot ? p.color : '#1a2838';
    roundRect(g, bx, by, bw, bh, 12); g.fill();
    g.strokeStyle = hot ? '#fff0c0' : p.color;
    g.lineWidth = hot ? 3 : 2;
    g.stroke();
    g.fillStyle = '#f2f6ff';
    g.font = '700 26px system-ui,sans-serif';
    g.textAlign = 'left';
    g.fillText(p.title, bx + 20, by + 38);
    g.font = '500 16px system-ui,sans-serif';
    g.fillStyle = '#9fb8cc';
    g.fillText(p.subtitle, bx + 20, by + 64);
    buttons.push({ id: p.id, x: bx, y: by, w: bw, h: bh, href: p.href });
    by += bh + 16;
  }

  // seated + utility row
  by += 8;
  const util = [
    { id: 'seat', label: seated ? 'Seated: ON' : 'Seated: OFF', color: '#5a6a80' },
    { id: 'mic', label: '🎤 Voice', color: '#4a8fd8' },
    { id: 'type', label: '⌨ Type', color: '#4a8fd8' }
  ];
  const uw = (bw - 16) / 3;
  util.forEach((u, i) => {
    const x = bx + i * (uw + 8);
    const hot = hoverId === u.id;
    g.fillStyle = hot ? u.color : '#152030';
    roundRect(g, x, by, uw, 56, 10); g.fill();
    g.strokeStyle = u.color; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#e8eef7'; g.font = '700 16px system-ui'; g.textAlign = 'center';
    g.fillText(u.label, x + uw / 2, by + 34);
    buttons.push({ id: u.id, x, y: by, w: uw, h: 56 });
  });

  by += 76;
  g.fillStyle = '#6a8098';
  g.font = '500 14px system-ui';
  g.textAlign = 'center';
  g.fillText('Say or type: “beach at sunset”', w / 2, by);

  return { canvas: c, buttons };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function buildHub(opts = {}) {
  const group = new THREE.Group();
  group.name = 'hub';

  const tex = gridTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
  // inward-facing box room
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), mat);
  room.position.y = 3;
  group.add(room);

  // floor glow plane (slightly above so lines read)
  const floorTex = gridTexture();
  floorTex.repeat.set(6, 6);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshBasicMaterial({ map: floorTex })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  group.add(floor);

  // ceiling
  const ceil = floor.clone();
  ceil.position.y = 5.98;
  ceil.rotation.x = Math.PI / 2;
  group.add(ceil);

  // soft ambient so grid isn't pure black on some displays
  group.add(new THREE.AmbientLight(0x406080, 0.35));
  const key = new THREE.PointLight('#e8a020', 1.2, 14, 2);
  key.position.set(0, 3, 0);
  group.add(key);

  // Arch doorway frame at -Z
  const archMat = new THREE.MeshLambertMaterial({ color: '#1a2430', emissive: '#3a2810' });
  const amber = new THREE.MeshBasicMaterial({ color: '#e8a020' });
  const arch = new THREE.Group();
  // pillars
  const pillarGeo = new THREE.BoxGeometry(0.35, 3.2, 0.35);
  const pL = new THREE.Mesh(pillarGeo, archMat); pL.position.set(-1.6, 1.6, -5.7);
  const pR = new THREE.Mesh(pillarGeo, archMat); pR.position.set(1.6, 1.6, -5.7);
  arch.add(pL, pR);
  // lintel
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 0.4), archMat);
  lintel.position.set(0, 3.3, -5.7);
  arch.add(lintel);
  // amber trim strips
  for (const [x, y] of [[-1.6, 1.6], [1.6, 1.6]]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.0, 0.05), amber);
    strip.position.set(x + (x < 0 ? 0.2 : -0.2), y, -5.5);
    arch.add(strip);
  }
  group.add(arch);

  // Control panel (canvas) floating near arch, angled toward player
  const PW = 768, PH = 768;
  const drawn = panelCanvas(PW, PH, PROGRAMS, null, !!opts.seated);
  const panelTex = new THREE.CanvasTexture(drawn.canvas);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  panelTex.minFilter = THREE.LinearFilter;
  panelTex.generateMipmaps = false;
  const panelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ map: panelTex })
  );
  panelMesh.position.set(0, opts.seated ? 1.15 : 1.45, -4.4);
  panelMesh.userData.panel = true;
  group.add(panelMesh);

  // frame around panel
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.7, 0.06),
    new THREE.MeshLambertMaterial({ color: '#121a24', emissive: '#2a1a08' })
  );
  frame.position.copy(panelMesh.position);
  frame.position.z -= 0.04;
  group.add(frame);

  const state = {
    group,
    panelMesh,
    panelTex,
    buttons: drawn.buttons,
    hoverId: null,
    seated: !!opts.seated,
    PW, PH,
    dissolve: 0 // 0..1 during transition
  };

  state._canvas = drawn.canvas;
  state.panelTex.image = state._canvas;
  state.panelTex.needsUpdate = true;

  state.setHover = (id) => {
    if (state.hoverId === id) return;
    state.hoverId = id;
    const d = panelCanvas(PW, PH, PROGRAMS, id, state.seated);
    state.buttons = d.buttons;
    const ctx = state._canvas.getContext('2d');
    ctx.clearRect(0, 0, PW, PH);
    ctx.drawImage(d.canvas, 0, 0);
    state.panelTex.needsUpdate = true;
  };

  state.hitButton = (uv) => {
    if (!uv) return null;
    const x = uv.x * PW, y = (1 - uv.y) * PH;
    return state.buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  };

  state.setSeated = (v) => {
    state.seated = !!v;
    panelMesh.position.y = state.seated ? 1.15 : 1.45;
    frame.position.y = panelMesh.position.y;
    state.setHover(state.hoverId);
  };

  // Grid dissolve helper: scales/fades grid materials
  state.playDissolve = (amount) => {
    state.dissolve = amount;
    const opacity = Math.max(0, 1 - amount);
    room.material.opacity = opacity;
    room.material.transparent = amount > 0;
    floor.material.opacity = opacity;
    floor.material.transparent = amount > 0;
    ceil.material.opacity = opacity;
    ceil.material.transparent = amount > 0;
  };

  return state;
}

export function getProgram(id) {
  return PROGRAMS.find(p => p.id === id);
}
