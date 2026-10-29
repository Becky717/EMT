// Procedural environments for Quest 2: instancing, no realtime shadows, capped particles.
import * as THREE from 'three';

const TIME_LIGHT = {
  dawn:   { hemi: ['#ffc9a0', '#4a5a70', 0.7], sun: ['#ffb070', 1.4], sunDir: [-0.6, 0.25, 0.4], fog: 0.9, sky: ['#f5c89a', '#7aa0c8'] },
  noon:   { hemi: ['#e8f0ff', '#6a7a50', 1.0], sun: ['#fff4d6', 1.8], sunDir: [0.3, 1.0, 0.2], fog: 0.55, sky: ['#7ec8ff', '#cfe9ff'] },
  sunset: { hemi: ['#ff9a5a', '#3a3050', 0.75], sun: ['#ff6a30', 1.6], sunDir: [0.85, 0.15, -0.2], fog: 0.85, sky: ['#ff6b3d', '#2a1a40'] },
  night:  { hemi: ['#6a7aaa', '#0a0e18', 0.35], sun: ['#c0d0ff', 0.25], sunDir: [-0.4, 0.5, 0.3], fog: 1.1, sky: ['#050814', '#1a2040'] }
};

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function skyDome(top, bottom) {
  const g = new THREE.SphereGeometry(80, 16, 10);
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, top); grd.addColorStop(0.45, top); grd.addColorStop(1, bottom);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 4, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.sky = true;
  return mesh;
}

function waterMesh(size = 40, color = '#1a6a8a') {
  const geo = new THREE.PlaneGeometry(size, size, 24, 24);
  const mat = new THREE.MeshLambertMaterial({
    color, transparent: true, opacity: 0.82, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.userData.water = true;
  // store base positions for cheap wave
  const pos = geo.attributes.position;
  mesh.userData.base = new Float32Array(pos.array);
  return mesh;
}

function makeTerrain(opts) {
  const { size = 50, segs = 32, height = 2, seed = 1, color = '#3d6b3a', flat = false } = opts;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  if (!flat) {
    const rnd = mulberry32(seed);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const n = Math.sin(x * 0.15 + rnd() * 3) * Math.cos(y * 0.12) * height
        + Math.sin(x * 0.4) * Math.cos(y * 0.35) * height * 0.35;
      pos.setZ(i, n);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = false;
  return mesh;
}

function instanceFrom(geo, mat, count, placeFn) {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    const { x, y, z, sy = 1, sx = 1, sz = 1, ry = 0 } = placeFn(i);
    p.set(x, y, z); e.set(0, ry, 0); q.setFromEuler(e); s.set(sx, sy, sz);
    m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = true;
  return mesh;
}

function treeGeo() {
  const g = new THREE.Group();
  // We'll use a merged-ish approach: cone + trunk as one InstancedMesh of cone for canopy, another for trunk
  return null;
}

function particles(count, color, spread, y0, y1) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  const rnd = mulberry32(42 + count);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (rnd() - 0.5) * spread;
    arr[i * 3 + 1] = y0 + rnd() * (y1 - y0);
    arr[i * 3 + 2] = (rnd() - 0.5) * spread;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.08, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.userData.particles = true;
  pts.userData.kind = 'generic';
  return pts;
}

function makeCampfire() {
  const g = new THREE.Group();
  const logMat = new THREE.MeshLambertMaterial({ color: '#4a2e14' });
  const logGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 4) * Math.PI;
    log.position.y = 0.06;
    g.add(log);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.5, 7),
    new THREE.MeshBasicMaterial({ color: '#ff8844', transparent: true, opacity: 0.9 })
  );
  flame.position.y = 0.4;
  flame.userData.flame = true;
  g.add(flame);
  const glow = new THREE.PointLight('#ff7030', 1.2, 8, 2);
  glow.position.y = 0.5;
  g.add(glow);
  g.userData.object = 'campfire';
  return g;
}

function makeTent() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#8b5a2b', side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 4), mat);
  cone.position.y = 0.7;
  cone.rotation.y = Math.PI / 4;
  g.add(cone);
  g.userData.object = 'tent';
  return g;
}

function makeBoat() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.35, 0.55),
    new THREE.MeshLambertMaterial({ color: '#6b3a1e' })
  );
  hull.position.y = 0.2;
  g.add(hull);
  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.7, 4),
    new THREE.MeshLambertMaterial({ color: '#7a4524' })
  );
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(0.95, 0.2, 0);
  g.add(bow);
  g.userData.object = 'boat';
  return g;
}

function makeRock(scale = 1) {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.4 * scale, 0),
    new THREE.MeshLambertMaterial({ color: '#6a6a68' })
  );
  m.scale.y = 0.7;
  m.userData.object = 'rocks';
  return m;
}

function placeObject(kind, root, rnd) {
  const x = (rnd() - 0.5) * 12;
  const z = -2 - rnd() * 10;
  let obj;
  if (kind === 'campfire' || kind === 'fire') obj = makeCampfire();
  else if (kind === 'tent') obj = makeTent();
  else if (kind === 'boat') { obj = makeBoat(); obj.position.set(x * 0.3, 0.05, z); root.add(obj); return obj; }
  else if (kind === 'rocks' || kind === 'rock') { obj = makeRock(0.8 + rnd()); }
  else if (kind === 'moon') {
    obj = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#e8eef8' })
    );
    obj.position.set(8, 14, -20);
    obj.userData.object = 'moon';
    root.add(obj);
    return obj;
  } else if (kind === 'trees' || kind === 'tree') {
    // single decorative tree group
    obj = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6), new THREE.MeshLambertMaterial({ color: '#4a3020' }));
    trunk.position.y = 0.6;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 7), new THREE.MeshLambertMaterial({ color: '#2d6b2e' }));
    leaf.position.y = 1.7;
    obj.add(trunk, leaf);
    obj.userData.object = 'trees';
  } else if (kind === 'palms' || kind === 'palm') {
    obj = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.2, 6), new THREE.MeshLambertMaterial({ color: '#6b5030' }));
    trunk.position.y = 1.1; trunk.rotation.z = 0.15;
    const leafMat = new THREE.MeshLambertMaterial({ color: '#2f8a3a', side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.2), leafMat);
      leaf.position.set(0, 2.2, 0);
      leaf.rotation.set(0.9, (i / 5) * Math.PI * 2, 0);
      obj.add(leaf);
    }
    obj.add(trunk);
    obj.userData.object = 'palms';
  } else if (kind === 'fireflies' || kind === 'birds') {
    // handled as particles in applyExtras
    return null;
  } else {
    return null;
  }
  if (obj) {
    obj.position.set(x, 0, z);
    root.add(obj);
  }
  return obj;
}

function addVegetation(root, kind, count, rnd, color) {
  if (kind === 'pine') {
    const trunk = instanceFrom(
      new THREE.CylinderGeometry(0.08, 0.12, 1, 5),
      new THREE.MeshLambertMaterial({ color: '#4a3020' }),
      count,
      i => {
        const x = (rnd() - 0.5) * 36, z = (rnd() - 0.5) * 36;
        const sy = 0.8 + rnd() * 1.4;
        return { x, y: sy * 0.5, z, sy, sx: 1, sz: 1, ry: rnd() * 6 };
      }
    );
    const canopy = instanceFrom(
      new THREE.ConeGeometry(0.55, 1.5, 6),
      new THREE.MeshLambertMaterial({ color: color || '#1f5a28' }),
      count,
      i => {
        // match trunk positions — re-seed
        return { x: 0, y: 0, z: 0, sy: 1 }; // filled below
      }
    );
    // rebuild canopy with same RNG sequence
    const rnd2 = mulberry32(99);
    // Actually trunks used rnd which advanced — store positions
    // Simpler: rebuild both with dedicated seed
    root.remove(trunk); root.remove(canopy);
  }
  const seed = kind === 'palm' ? 77 : kind === 'cactus' ? 55 : 99;
  const r = mulberry32(seed);
  if (kind === 'pine') {
    const n = count;
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.08, 0.12, 1, 5),
      new THREE.MeshLambertMaterial({ color: '#4a3020' }), n
    );
    const leaves = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.6, 1.6, 6),
      new THREE.MeshLambertMaterial({ color: color || '#1f5a28' }), n
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 38, z = (r() - 0.5) * 38;
      if (x * x + z * z < 9) { i--; continue; } // keep clear near player — can't easily redo; just skip close
      const sy = 0.9 + r() * 1.5;
      m4.makeTranslation(x, sy * 0.5, z); trunks.setMatrixAt(i, m4);
      m4.makeTranslation(x, sy * 0.5 + sy * 0.7, z);
      m4.scale(new THREE.Vector3(0.9 + r() * 0.4, sy * 0.7, 0.9 + r() * 0.3));
      // makeTranslation overwrites scale — compose properly
      const q = new THREE.Quaternion();
      const p = new THREE.Vector3(x, sy * 0.5 + 0.9 * sy, z);
      const s = new THREE.Vector3(1, sy * 0.85, 1);
      m4.compose(p, q, s);
      leaves.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, sy * 0.5, z), q, new THREE.Vector3(1, sy, 1));
      trunks.setMatrixAt(i, m4);
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    root.add(trunks, leaves);
    return;
  }
  if (kind === 'palm') {
    const n = Math.min(count, 24);
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.07, 0.12, 2.2, 5),
      new THREE.MeshLambertMaterial({ color: '#6b5030' }), n
    );
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 30, z = (r() - 0.5) * 30;
      e.set(0.1, r() * 6, 0.12); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 1.1, z), q, new THREE.Vector3(1, 1, 1));
      trunks.setMatrixAt(i, m4);
    }
    trunks.instanceMatrix.needsUpdate = true;
    root.add(trunks);
    // one shared leaf spray as few meshes
    const leafMat = new THREE.MeshLambertMaterial({ color: '#2f8a3a', side: THREE.DoubleSide });
    const leafGeo = new THREE.PlaneGeometry(0.35, 1.4);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, n * 4);
    let idx = 0;
    const r2 = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const x = (r2() - 0.5) * 30, z = (r2() - 0.5) * 30;
      r2(); // consume same as trunk loop's extra r() calls roughly
      for (let k = 0; k < 4; k++) {
        e.set(1.0, (k / 4) * Math.PI * 2 + i, 0); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(x, 2.2, z), q, new THREE.Vector3(1, 1, 1));
        leaves.setMatrixAt(idx++, m4);
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    root.add(leaves);
    return;
  }
  if (kind === 'cactus') {
    const n = count;
    const body = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.15, 0.18, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: '#3d7a3a' }), n
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 36, z = (r() - 0.5) * 36;
      const sy = 0.6 + r() * 1.2;
      m4.compose(new THREE.Vector3(x, sy * 0.5, z), new THREE.Quaternion(), new THREE.Vector3(1, sy, 1));
      body.setMatrixAt(i, m4);
    }
    body.instanceMatrix.needsUpdate = true;
    root.add(body);
  }
  if (kind === 'grass') {
    const n = count;
    const blades = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.05, 0.4, 3),
      new THREE.MeshLambertMaterial({ color: color || '#5a9a3a' }), n
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 30, z = (r() - 0.5) * 30;
      m4.compose(new THREE.Vector3(x, 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(1, 0.8 + r(), 1));
      blades.setMatrixAt(i, m4);
    }
    blades.instanceMatrix.needsUpdate = true;
    root.add(blades);
  }
}

function addStars(root, count = 400) {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(count * 3);
  const rnd = mulberry32(7);
  for (let i = 0; i < count; i++) {
    const r = 40 + rnd() * 30;
    const theta = rnd() * Math.PI * 2;
    const phi = rnd() * Math.PI;
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = Math.abs(r * Math.cos(phi));
    arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.15, depthWrite: false, fog: false }));
  pts.userData.stars = true;
  root.add(pts);
}

function addCity(root, rnd) {
  const n = 48;
  const buildings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: '#2a3040' }),
    n
  );
  const windows = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.85, 0.85, 0.85),
    new THREE.MeshBasicMaterial({ color: '#ffdd77' }),
    n
  );
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const x = ((i % 8) - 3.5) * 3.2 + (rnd() - 0.5);
    const z = (Math.floor(i / 8) - 3) * 3.2 - 8;
    const h = 2 + rnd() * 8;
    m4.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1.4 + rnd(), h, 1.4 + rnd()));
    buildings.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, h / 2, z + 0.05), new THREE.Quaternion(), new THREE.Vector3(1.2, h * 0.92, 1.2));
    windows.setMatrixAt(i, m4);
    windows.setColorAt?.(i, new THREE.Color().setHSL(0.12 + rnd() * 0.05, 0.9, 0.55 + rnd() * 0.25));
  }
  buildings.instanceMatrix.needsUpdate = true;
  windows.instanceMatrix.needsUpdate = true;
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  root.add(buildings, windows);
  // street glow
  const street = new THREE.PointLight('#ffaa55', 1.4, 30, 2);
  street.position.set(0, 3, -8); root.add(street);
  // ground plane dark
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshLambertMaterial({ color: '#1a1e28' })
  );
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);
}

/**
 * Build a world into `root` Group. Returns { anim, dispose extras handlers }.
 */
export function buildWorld(spec, root) {
  // clear previous
  while (root.children.length) {
    const c = root.children[0];
    root.remove(c);
    c.traverse?.(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }

  const env = spec.environment || 'meadow';
  const time = spec.time || 'noon';
  const weather = spec.weather || 'clear';
  const objects = spec.objects || [];
  const rnd = mulberry32(hash(env + time + weather));
  const lightCfg = TIME_LIGHT[time] || TIME_LIGHT.noon;

  const hemi = new THREE.HemisphereLight(lightCfg.hemi[0], lightCfg.hemi[1], lightCfg.hemi[2]);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(lightCfg.sun[0], lightCfg.sun[1]);
  sun.position.set(lightCfg.sunDir[0] * 20, lightCfg.sunDir[1] * 20, lightCfg.sunDir[2] * 20);
  root.add(sun);

  // sun/moon disc
  if (time !== 'night') {
    const disc = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 8),
      new THREE.MeshBasicMaterial({ color: time === 'sunset' ? '#ff7030' : '#fff0c0', fog: false })
    );
    disc.position.copy(sun.position).setLength(60);
    root.add(disc);
  } else {
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#dfe8f8', fog: false })
    );
    moon.position.set(-25, 22, -30);
    moon.userData.object = 'moon';
    root.add(moon);
  }

  const sky = skyDome(lightCfg.sky[0], lightCfg.sky[1]);
  root.add(sky);

  const state = { water: null, particles: [], flames: [], weather, time, env, frozen: false };

  // Environment-specific ground + props
  if (env === 'beach') {
    root.add(makeTerrain({ size: 50, segs: 20, height: 0.35, seed: 3, color: '#d2b48c', flat: false }));
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(50, 28), new THREE.MeshLambertMaterial({ color: '#e0c090' }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.04, 2); root.add(sand);
    const w = waterMesh(70, '#1a7aaa'); w.position.set(0, 0.02, -16); root.add(w); state.water = w;
    // shoreline foam strip
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(70, 1.2), new THREE.MeshBasicMaterial({ color: '#d8e8f0', transparent: true, opacity: 0.45 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.06, -2.2); root.add(foam);
    addVegetation(root, 'palm', 18, rnd);
  } else if (env === 'forest') {
    root.add(makeTerrain({ size: 50, segs: 24, height: 1.2, seed: 11, color: '#2f5a28' }));
    addVegetation(root, 'pine', 40, rnd, '#1a4a20');
  } else if (env === 'desert') {
    root.add(makeTerrain({ size: 50, segs: 28, height: 1.8, seed: 5, color: '#c2a060' }));
    addVegetation(root, 'cactus', 28, rnd);
  } else if (env === 'snow' || env === 'arctic') {
    root.add(makeTerrain({ size: 50, segs: 24, height: 2.2, seed: 17, color: '#e8eef5' }));
    addVegetation(root, 'pine', 20, rnd, '#1a3a28');
  } else if (env === 'mountains') {
    root.add(makeTerrain({ size: 60, segs: 36, height: 6, seed: 23, color: '#5a6a50' }));
    // snow caps as second lighter terrain? skip — keep draw calls low
  } else if (env === 'ocean') {
    const w = waterMesh(80, '#146080'); root.add(w); state.water = w;
    root.add(makeTerrain({ size: 20, segs: 8, height: 0.2, seed: 2, color: '#c2a070', flat: true }));
    root.children[root.children.length - 1].position.set(0, 0.1, 8);
  } else if (env === 'underwater') {
    hemi.intensity = 0.4; sun.intensity = 0.3;
    const w = waterMesh(80, '#0a4060'); w.material.opacity = 0.3; root.add(w); state.water = w;
    root.add(makeTerrain({ size: 40, segs: 20, height: 1.5, seed: 9, color: '#3a5a4a' }));
    // bubbles
    const bubbles = particles(60, '#a0d8ff', 20, 0.5, 8);
    bubbles.userData.kind = 'bubbles';
    root.add(bubbles); state.particles.push(bubbles);
  } else if (env === 'space' || env === 'starfield') {
    hemi.intensity = 0.15; sun.intensity = 0.5;
    addStars(root, 500);
    // planet
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(8, 24, 16),
      new THREE.MeshLambertMaterial({ color: '#4a6aaa', emissive: '#101828' })
    );
    planet.position.set(12, -4, -30);
    planet.userData.object = 'planet';
    root.add(planet);
    // floor platform so player isn't falling visually
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.2, 0.15, 16),
      new THREE.MeshLambertMaterial({ color: '#333848', emissive: '#1a2030' })
    );
    pad.position.y = -0.05;
    root.add(pad);
  } else if (env === 'planet') {
    hemi.color.set('#ffaa88'); hemi.groundColor.set('#402010');
    root.add(makeTerrain({ size: 50, segs: 28, height: 2.5, seed: 41, color: '#a05030' }));
    addStars(root, 200);
  } else if (env === 'city') {
    addCity(root, rnd);
  } else if (env === 'meadow') {
    root.add(makeTerrain({ size: 50, segs: 20, height: 0.6, seed: 13, color: '#4a8a3a' }));
    addVegetation(root, 'grass', 120, rnd);
  } else if (env === 'cave') {
    hemi.intensity = 0.2;
    const cave = new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 12),
      new THREE.MeshLambertMaterial({ color: '#2a2420', side: THREE.BackSide })
    );
    cave.position.y = 4;
    root.add(cave);
    root.add(makeTerrain({ size: 20, segs: 12, height: 0.5, seed: 3, color: '#3a342e', flat: false }));
    const torch = new THREE.PointLight('#ff8030', 2, 14, 2);
    torch.position.set(2, 2, -3);
    root.add(torch);
  } else if (env === 'lake') {
    root.add(makeTerrain({ size: 50, segs: 20, height: 0.8, seed: 19, color: '#3d6b3a' }));
    const w = waterMesh(18, '#2a7a9a'); w.position.set(0, 0.08, -6); root.add(w); state.water = w;
    addVegetation(root, 'pine', 18, rnd);
  } else if (env === 'canyon') {
    root.add(makeTerrain({ size: 50, segs: 30, height: 4, seed: 29, color: '#b06030' }));
  } else {
    root.add(makeTerrain({ size: 50, segs: 20, height: 0.8, seed: 1, color: '#4a8a3a' }));
  }

  // Weather particles
  const cold = (env === 'snow' || env === 'mountains');
  if ((weather === 'rain' || weather === 'storm') && !cold) {
    const rain = particles(weather === 'storm' ? 350 : 220, '#aaccff', 30, 0, 12);
    rain.userData.kind = 'rain';
    rain.material.size = 0.05;
    root.add(rain); state.particles.push(rain);
  }
  if (weather === 'storm') {
    hemi.intensity *= 0.7;
    const flash = new THREE.PointLight('#cce0ff', 0, 40);
    flash.position.set(0, 15, 0);
    flash.userData.lightning = true;
    root.add(flash);
    state.lightning = flash;
  }
  if (weather === 'snow' || weather === 'storm' && cold) {
    const snow = particles(weather === 'storm' ? 320 : 280, '#ffffff', 30, 0, 12);
    snow.userData.kind = 'snow';
    snow.material.size = 0.1;
    root.add(snow); state.particles.push(snow);
  }
  if (weather === 'fog') {
    // fog is applied on scene by caller; mark it
    state.fogDensity = 0.06;
  }
  if (weather === 'aurora' || (time === 'night' && (env === 'snow' || env === 'mountains') && weather === 'clear')) {
    // simple aurora ribbons
    const aurMat = new THREE.MeshBasicMaterial({ color: '#40ff99', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, fog: false });
    for (let i = 0; i < 3; i++) {
      const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), aurMat.clone());
      ribbon.material.color.setHSL(0.4 + i * 0.08, 0.9, 0.55);
      ribbon.position.set(i * 5 - 5, 14 + i, -25);
      ribbon.rotation.x = 0.3;
      ribbon.userData.aurora = true;
      root.add(ribbon);
      state.flames.push(ribbon); // reuse anim list
    }
  }

  // Requested objects
  for (const o of objects) {
    if (o === 'fireflies') {
      const ff = particles(40, '#d0ff60', 16, 0.5, 3);
      ff.userData.kind = 'fireflies';
      ff.material.size = 0.12;
      root.add(ff); state.particles.push(ff);
    } else if (o === 'birds') {
      const birds = particles(12, '#222222', 20, 4, 10);
      birds.userData.kind = 'birds';
      birds.material.size = 0.2;
      root.add(birds); state.particles.push(birds);
    } else {
      placeObject(o, root, rnd);
    }
  }

  // Default beach palms already added; if palms requested extra
  state.anim = (t, dt) => {
    if (state.frozen) return;
    if (state.water) {
      const pos = state.water.geometry.attributes.position;
      const base = state.water.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 0.4 + t * 1.5) * 0.08 + Math.cos(y * 0.35 + t * 1.2) * 0.06;
      }
      pos.needsUpdate = true;
    }
    for (const pts of state.particles) {
      const arr = pts.geometry.attributes.position.array;
      const kind = pts.userData.kind;
      for (let i = 0; i < arr.length; i += 3) {
        if (kind === 'rain') {
          arr[i + 1] -= dt * 8;
          if (arr[i + 1] < 0) arr[i + 1] = 12;
        } else if (kind === 'snow') {
          arr[i + 1] -= dt * 1.2;
          arr[i] += Math.sin(t + i) * dt * 0.3;
          if (arr[i + 1] < 0) arr[i + 1] = 12;
        } else if (kind === 'fireflies') {
          arr[i] += Math.sin(t * 2 + i) * dt * 0.4;
          arr[i + 1] += Math.cos(t * 1.7 + i * 0.3) * dt * 0.3;
          arr[i + 2] += Math.sin(t * 1.3 + i) * dt * 0.4;
        } else if (kind === 'birds') {
          arr[i] += dt * 2;
          arr[i + 1] += Math.sin(t + i) * dt * 0.5;
          if (arr[i] > 15) arr[i] = -15;
        } else if (kind === 'bubbles') {
          arr[i + 1] += dt * 0.8;
          if (arr[i + 1] > 8) arr[i + 1] = 0.5;
        }
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }
    root.traverse(o => {
      if (o.userData.flame) o.scale.y = 1 + Math.sin(t * 14) * 0.15;
      if (o.userData.aurora) o.material.opacity = 0.15 + Math.sin(t * 0.7 + o.position.x) * 0.1;
      if (o.userData.lightning && state.weather === 'storm') {
        if (Math.random() < 0.003) o.intensity = 8;
        else o.intensity *= 0.85;
      }
    });
  };

  state.addObject = (kind) => {
    if (kind === 'fireflies') {
      const ff = particles(40, '#d0ff60', 16, 0.5, 3);
      ff.userData.kind = 'fireflies';
      root.add(ff); state.particles.push(ff);
      return;
    }
    if (kind === 'birds') {
      const birds = particles(12, '#222222', 20, 4, 10);
      birds.userData.kind = 'birds';
      root.add(birds); state.particles.push(birds);
      return;
    }
    placeObject(kind, root, mulberry32(Date.now() % 99999));
  };

  state.removeObject = (kind) => {
    const toRemove = [];
    root.traverse(o => {
      if (o.userData.object === kind || o.userData.object === kind.replace(/s$/, '') + 's') toRemove.push(o);
      if (kind === 'fireflies' && o.userData.kind === 'fireflies') toRemove.push(o);
      if (kind === 'birds' && o.userData.kind === 'birds') toRemove.push(o);
      if ((kind === 'campfire' || kind === 'fire') && o.userData.object === 'campfire') toRemove.push(o);
    });
    // also match plural/singular
    const aliases = {
      fire: 'campfire', tree: 'trees', palm: 'palms', rock: 'rocks'
    };
    const k2 = aliases[kind] || kind;
    root.traverse(o => { if (o.userData.object === k2) toRemove.push(o); });
    for (const o of toRemove) {
      if (o.parent) o.parent.remove(o);
      const ix = state.particles.indexOf(o);
      if (ix >= 0) state.particles.splice(ix, 1);
    }
  };

  state.setWeather = (w) => {
    // rebuild is cleaner for weather — caller may rebuild; here we just add particles if missing
    state.weather = w;
  };

  state.getFog = () => {
    const base = lightCfg.fog;
    if (weather === 'fog') return { color: lightCfg.sky[1], near: 2, far: 18 };
    if (weather === 'storm') return { color: '#4a5060', near: 4, far: 35 };
    if (env === 'space' || env === 'starfield') return null;
    if (env === 'underwater') return { color: '#0a3050', near: 1, far: 20 };
    if (time === 'night') return { color: lightCfg.sky[0], near: 5, far: 40 };
    return { color: lightCfg.sky[1], near: 8, far: 55 * (1.2 - base * 0.2) };
  };

  state.spec = { environment: env, time, weather, objects: objects.slice() };
  return state;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function countDrawish(root) {
  let meshes = 0, instances = 0;
  root.traverse(o => {
    if (o.isInstancedMesh) instances++;
    else if (o.isMesh || o.isPoints) meshes++;
  });
  return { meshes, instances, approxCalls: meshes + instances };
}
