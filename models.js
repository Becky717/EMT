// EMT SIM VR — procedural 3D models (equipment tray items + geometry helpers).
// Everything is built from three.js primitives; each item is merged into 1-2 meshes
// (vertex colors) so the whole tray costs only ~30 draw calls on Quest 2.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const GEO = {
  box: (w, h, d, sx = 1, sy = 1, sz = 1) => new THREE.BoxGeometry(w, h, d, sx, sy, sz),
  rbox: (w, h, d, r = Math.min(w, h, d) * 0.3) => new RoundedBoxGeometry(w, h, d, 2, r),
  cyl: (rt, rb, h, seg = 16, open = false, ts = 0, tl = PI * 2) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl),
  sph: (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h),
  dome: (r, w = 18, h = 8, frac = 0.5) => new THREE.SphereGeometry(r, w, h, 0, PI * 2, 0, PI * frac),
  cap: (r, len, cs = 4, rs = 12) => new THREE.CapsuleGeometry(r, len, cs, rs),
  tor: (R, r, arc = PI * 2, rs = 8, ts = 24) => new THREE.TorusGeometry(R, r, rs, ts, arc),
  tube: (pts, r, seg = 32, rs = 8, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p)), closed), seg, r, rs, closed),
  lathe: (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg),
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
// Kit: collect primitive parts (with transform + color), then merge them.
export class Kit {
  constructor() { this.op = []; this.tr = []; }
  add(geo, color, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const s = o.s == null ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
    if (o.q) _q.copy(o.q); else _q.setFromEuler(_e.set(...(o.r || [0, 0, 0]), o.order || 'XYZ'));
    _m.compose(_p.set(...(o.p || [0, 0, 0])), _q, _s.set(...s));
    g.applyMatrix4(_m);
    _c.set(color); const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    (o.clear ? this.tr : this.op).push(g); return this;
  }
  geometry(clear = false) { const L = clear ? this.tr : this.op; return L.length ? mergeGeometries(L, false) : null; }
  build(opts = {}) {
    const grp = new THREE.Group(); grp.userData.mats = [];
    const og = this.geometry(false), tg = this.geometry(true);
    if (og) { const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.rough ?? 0.5, metalness: 0.05, side: THREE.DoubleSide });
      grp.add(new THREE.Mesh(og, mat)); grp.userData.mats.push(mat); }
    if (tg) { const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0, transparent: true, opacity: opts.opacity ?? 0.5, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(tg, mat); m.renderOrder = 2; grp.add(m); grp.userData.mats.push(mat); }
    return grp;
  }
}
export function mergeKit(fn) { const k = new Kit(); fn(k); return k.geometry(false); }
export function kitGroup(fn, opts) { const k = new Kit(); fn(k); return k.build(opts); }

// corrugated hose: tube + rings along a curve
export function hose(k, pts, r, col, rings = 14) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V(...p)));
  k.add(new THREE.TubeGeometry(curve, 40, r, 8, false), col);
  const z = V(0, 0, 1);
  for (let i = 1; i < rings; i++) {
    const t = i / rings, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    k.add(GEO.tor(r * 1.05, r * 0.28, PI * 2, 5, 12), col, { p: [p.x, p.y, p.z], q: new THREE.Quaternion().setFromUnitVectors(z, tan) });
  }
}
// heart symbol lying flat (for AED)
function heart(k, x, y, z, s, col) {
  k.add(GEO.sph(s * 0.5, 10, 8), col, { p: [x - s * 0.33, y, z - s * 0.2], s: [1, 0.25, 1] });
  k.add(GEO.sph(s * 0.5, 10, 8), col, { p: [x + s * 0.33, y, z - s * 0.2], s: [1, 0.25, 1] });
  k.add(GEO.cyl(0, s * 0.62, s * 0.1, 3), col, { p: [x, y, z + s * 0.25], r: [0, PI / 3, 0], s: [1.25, 1, 1] });
}

// ---------- EQUIPMENT MODELS (table coords: y = up off the tray, z = toward the label) ----------
export const EQUIP = {
  npa(k) { // nasopharyngeal airway: soft curved tan/orange tube with flared flange + bevel
    const c = 0xe39463;
    k.add(GEO.tube([[-0.07, 0.008, 0], [-0.03, 0.008, -0.006], [0.01, 0.008, -0.004], [0.045, 0.008, 0.008], [0.07, 0.008, 0.026]], 0.0058, 40, 10), c);
    k.add(GEO.cyl(0.015, 0.0064, 0.014, 20, true), c, { p: [-0.077, 0.008, 0], r: [0, 0, PI / 2] });
    k.add(GEO.tor(0.0148, 0.0024, PI * 2, 8, 24), c, { p: [-0.084, 0.008, 0], r: [0, PI / 2, 0] });
    k.add(GEO.cyl(0.0058, 0.0012, 0.014, 10), c, { p: [0.075, 0.008, 0.031], r: [PI / 2, 0, -0.95] });
    k.add(GEO.tor(0.0045, 0.0016, PI * 2, 6, 14), 0x7a3b1c, { p: [-0.0855, 0.008, 0], r: [0, PI / 2, 0] }); // dark lumen
  },
  opa(k) { // oropharyngeal airway: rigid J-curve with flange
    const c = 0xf2c230, hw = 0.0068, R = 0.032, cl = [];
    for (let u = -0.05; u <= 0.0001; u += 0.01) cl.push([u, 0, 0, -1]);
    for (let a = -PI / 2 + 0.15; a <= PI / 3; a += 0.15) cl.push([R * Math.cos(a), R + R * Math.sin(a), Math.cos(a), Math.sin(a)]);
    const outer = cl.map(([x, y, nx, ny]) => new THREE.Vector2(x + nx * hw, y + ny * hw));
    const inner = cl.map(([x, y, nx, ny]) => new THREE.Vector2(x - nx * hw, y - ny * hw)).reverse();
    const ex = new THREE.ExtrudeGeometry(new THREE.Shape([...outer, ...inner]), { depth: 0.014, bevelEnabled: false, curveSegments: 4 });
    k.add(ex, c, { r: [-PI / 2, 0, 0] });
    k.add(GEO.rbox(0.006, 0.02, 0.048, 0.002), 0xd9a514, { p: [-0.053, 0.007, 0] });
    k.add(GEO.box(0.05, 0.002, 0.004), 0x8a6a08, { p: [-0.026, 0.0145, 0] }); // channel
  },
  bvm(k) { // bag-valve mask: clear mask + valve + bag + reservoir + O2 tubing
    const y = 0.04;
    k.add(GEO.dome(0.5, 20, 8), 0xdff3ff, { p: [-0.15, y, 0], r: [0, 0, -PI / 2], s: [0.08, 0.05, 0.07], clear: true });
    k.add(GEO.tor(0.5, 0.09, PI * 2, 8, 24), 0x56677a, { p: [-0.15, y, 0], r: [0, PI / 2, 0], s: [0.07, 0.08, 0.08] });
    k.add(GEO.cyl(0.013, 0.013, 0.04, 14), 0xf1f5f9, { p: [-0.108, y, 0], r: [0, 0, PI / 2] });
    k.add(GEO.cyl(0.008, 0.008, 0.02, 10), 0x60a5fa, { p: [-0.108, y + 0.018, 0] });
    k.add(GEO.sph(0.5, 22, 16), 0x2f6fd0, { p: [-0.015, y, 0], s: [0.16, 0.085, 0.09] });
    k.add(GEO.cyl(0.012, 0.012, 0.03, 12), 0xf1f5f9, { p: [0.078, y, 0], r: [0, 0, PI / 2] });
    k.add(GEO.sph(0.5, 16, 12), 0x7fe0a6, { p: [0.14, y, 0], s: [0.11, 0.055, 0.07], clear: true });
    k.add(GEO.tube([[0.195, y - 0.01, 0], [0.22, 0.008, 0.04], [0.17, 0.006, 0.075], [0.08, 0.006, 0.07], [0.02, 0.006, 0.08]], 0.0035, 40, 6), 0x3fbf7f);
  },
  nrb(k) { // non-rebreather: clear mask, flap valves, reservoir bag, green tubing, elastic
    k.add(GEO.dome(0.5, 20, 8), 0xc9f2df, { p: [0, 0, -0.03], s: [0.085, 0.06, 0.1], clear: true });
    k.add(GEO.tor(0.5, 0.04, PI * 2, 6, 24), 0x9ad9bb, { p: [0, 0.002, -0.03], r: [PI / 2, 0, 0], s: [0.085, 0.1, 0.1] });
    k.add(GEO.cyl(0.007, 0.007, 0.003, 12), 0x2f9e6a, { p: [0.03, 0.027, -0.035], r: [0, 0, 0.9] });
    k.add(GEO.cyl(0.007, 0.007, 0.003, 12), 0x2f9e6a, { p: [-0.03, 0.027, -0.035], r: [0, 0, -0.9] });
    k.add(GEO.cyl(0.008, 0.008, 0.03, 10), 0x9ad9bb, { p: [0, 0.012, 0.025], r: [PI / 2, 0, 0] });
    k.add(GEO.sph(0.5, 18, 12), 0x5fd391, { p: [0, 0.018, 0.075], s: [0.09, 0.036, 0.09], clear: true });
    k.add(GEO.tor(0.06, 0.0016, PI * 2, 4, 28), 0xf1f5f9, { p: [0, 0.002, -0.04], r: [PI / 2, 0, 0], s: [1.15, 1, 1] });
    k.add(GEO.tube([[0, 0.012, 0.12], [0.03, 0.006, 0.14], [0.08, 0.006, 0.12], [0.085, 0.006, 0.05], [0.1, 0.006, -0.02], [0.08, 0.006, -0.07]], 0.0034, 48, 6), 0x2fb36f);
  },
  nc(k) { // nasal cannula: loop with two prongs + supply tubing
    const c = 0x86dcb2, pts = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; pts.push([0.05 * Math.cos(a), 0.006, -0.02 + 0.038 * Math.sin(a)]); }
    k.add(GEO.tube(pts, 0.003, 60, 6, true), c);
    k.add(GEO.cap(0.0032, 0.01, 2, 8), c, { p: [-0.007, 0.013, 0.018], r: [-0.3, 0, 0] });
    k.add(GEO.cap(0.0032, 0.01, 2, 8), c, { p: [0.007, 0.013, 0.018], r: [-0.3, 0, 0] });
    k.add(GEO.rbox(0.03, 0.007, 0.01, 0.003), 0x5cc596, { p: [0, 0.006, 0.018] });
    k.add(GEO.cyl(0.006, 0.006, 0.012, 10), 0x5cc596, { p: [0, 0.006, -0.058], r: [PI / 2, 0, 0] });
    k.add(GEO.tube([[0, 0.006, -0.064], [0, 0.006, -0.085], [0.05, 0.006, -0.09], [0.085, 0.006, -0.055], [0.09, 0.006, 0.01], [0.07, 0.006, 0.06], [0.02, 0.006, 0.075]], 0.0034, 48, 6), c);
  },
  cpap(k) { // CPAP: clear mask w/ blue cushion, headgear, corrugated hose, flow generator
    k.add(GEO.dome(0.5, 20, 8), 0xe3f0ff, { p: [-0.045, 0, -0.01], s: [0.095, 0.065, 0.115], clear: true });
    k.add(GEO.tor(0.5, 0.07, PI * 2, 8, 24), 0x2b78e4, { p: [-0.045, 0.004, -0.01], r: [PI / 2, 0, 0], s: [0.095, 0.115, 0.1] });
    k.add(GEO.tor(0.075, 0.003, PI * 2, 4, 28), 0x1f2937, { p: [-0.075, 0.003, -0.01], r: [PI / 2, 0, 0], s: [1, 0.8, 1] });
    k.add(GEO.cyl(0.011, 0.011, 0.02, 12), 0xf1f5f9, { p: [-0.045, 0.04, -0.01] });
    hose(k, [[-0.045, 0.05, -0.01], [-0.02, 0.06, 0.04], [0.03, 0.03, 0.07], [0.075, 0.02, 0.05]], 0.0085, 0xb9c6d6, 12);
    k.add(GEO.rbox(0.05, 0.03, 0.045, 0.006), 0x4b5563, { p: [0.095, 0.015, 0.035] });
    k.add(GEO.cyl(0.009, 0.009, 0.006, 14), 0xf8fafc, { p: [0.095, 0.032, 0.03] });
    k.add(GEO.box(0.002, 0.002, 0.008), 0xdc2626, { p: [0.095, 0.036, 0.027] });
    k.add(GEO.cyl(0.004, 0.004, 0.02, 8), 0x22c55e, { p: [0.125, 0.015, 0.035], r: [0, 0, PI / 2] });
  },
  suction(k) { // portable suction unit + canister + tubing + Yankauer tip
    k.add(GEO.rbox(0.09, 0.05, 0.065, 0.008), 0x334155, { p: [-0.045, 0.025, -0.01] });
    k.add(GEO.tor(0.025, 0.004, PI, 6, 14), 0x111827, { p: [-0.045, 0.05, -0.01] });
    k.add(GEO.cyl(0.013, 0.013, 0.004, 16), 0xf8fafc, { p: [-0.06, 0.028, 0.0235], r: [PI / 2, 0, 0] });
    k.add(GEO.box(0.0015, 0.009, 0.002), 0xdc2626, { p: [-0.06, 0.031, 0.026], r: [0, 0, -0.6] });
    k.add(GEO.rbox(0.012, 0.008, 0.004, 0.0015), 0x22c55e, { p: [-0.025, 0.035, 0.0235] });
    k.add(GEO.cyl(0.019, 0.019, 0.055, 18), 0xdbe7f2, { p: [0.022, 0.0275, -0.012], clear: true });
    k.add(GEO.cyl(0.02, 0.02, 0.007, 18), 0x2563eb, { p: [0.022, 0.058, -0.012] });
    k.add(GEO.tube([[0.022, 0.062, -0.012], [0.05, 0.066, 0.015], [0.07, 0.025, 0.05], [0.05, 0.008, 0.075]], 0.004, 30, 6), 0xbcd7ea);
    k.add(GEO.tube([[0.05, 0.008, 0.075], [-0.02, 0.008, 0.077], [-0.065, 0.008, 0.07], [-0.095, 0.008, 0.052]], 0.0058, 30, 8), 0xeaf6ff);
    k.add(GEO.sph(0.0075, 10, 8), 0xeaf6ff, { p: [-0.097, 0.008, 0.05] });
  },
  aed(k, noPads) { // AED: lime case, dark face, screen, on + shock buttons, heart, handle, pads + wires
    k.add(GEO.rbox(0.14, 0.04, 0.11, 0.012), 0xc4d82e, { p: [-0.02, 0.02, -0.01] });
    k.add(GEO.rbox(0.12, 0.004, 0.088, 0.002), 0x2b2f36, { p: [-0.02, 0.0405, -0.01] });
    k.add(GEO.box(0.05, 0.002, 0.026), 0x8fd3ff, { p: [-0.045, 0.043, -0.03] });
    k.add(GEO.cyl(0.009, 0.009, 0.005, 14), 0x22c55e, { p: [0.02, 0.043, -0.03] });
    k.add(GEO.cyl(0.013, 0.013, 0.006, 16), 0xf97316, { p: [0.015, 0.044, 0.015] });
    heart(k, -0.045, 0.0435, 0.015, 0.022, 0xe11d48);
    k.add(GEO.tor(0.03, 0.006, PI, 6, 14), 0x8ea12a, { p: [-0.02, 0.02, -0.065], r: [-PI / 2, 0, 0] });
    if (!noPads) for (const [x, w] of [[0.1, 0xdc2626], [0.16, 0x111827]]) {
      k.add(GEO.rbox(0.05, 0.004, 0.068, 0.002), 0xf8fafc, { p: [x, 0.002, 0.065] });
      k.add(GEO.rbox(0.032, 0.003, 0.045, 0.0015), 0x9ca3af, { p: [x, 0.004, 0.068] });
      k.add(GEO.tube([[0.04, 0.02, 0.03], [0.07, 0.01, 0.02], [x, 0.006, 0.03]], 0.0022, 16, 5), w);
    }
  },
  spo2(k) { // fingertip pulse oximeter
    k.add(GEO.rbox(0.058, 0.016, 0.032, 0.006), 0xe5e7eb, { p: [0, 0.008, 0] });
    k.add(GEO.rbox(0.058, 0.019, 0.032, 0.007), 0x334155, { p: [0.003, 0.027, 0], r: [0, 0, 0.14] });
    k.add(GEO.box(0.032, 0.002, 0.02), 0x0b1220, { p: [0.005, 0.0375, 0], r: [0, 0, 0.14] });
    k.add(GEO.box(0.012, 0.002, 0.006), 0x22d3ee, { p: [0.0, 0.039, -0.004], r: [0, 0, 0.14] });
    k.add(GEO.box(0.01, 0.002, 0.006), 0x4ade80, { p: [0.012, 0.0405, 0.004], r: [0, 0, 0.14] });
    k.add(GEO.cyl(0.004, 0.004, 0.034, 10), 0x94a3b8, { p: [-0.028, 0.017, 0], r: [PI / 2, 0, 0] });
    k.add(GEO.sph(0.003, 8, 6), 0xff2a2a, { p: [0.015, 0.017, 0] });
  },
  bp(k) { // BP cuff + tubing + aneroid gauge + bulb
    k.add(GEO.cyl(0.036, 0.036, 0.11, 26, true, 0.4, PI * 1.75), 0x1e3a8a, { p: [-0.01, 0.036, -0.03], r: [0, 0, PI / 2] });
    k.add(GEO.cyl(0.032, 0.032, 0.108, 26, true, 0.4, PI * 1.75), 0x334f9e, { p: [-0.01, 0.036, -0.03], r: [0, 0, PI / 2] });
    k.add(GEO.box(0.11, 0.003, 0.045), 0x1e3a8a, { p: [-0.01, 0.0015, 0.005] });
    k.add(GEO.tube([[0.0, 0.06, -0.01], [0.04, 0.05, 0.02], [0.07, 0.014, 0.05]], 0.0026, 20, 6), 0x111827);
    k.add(GEO.tube([[-0.02, 0.06, -0.01], [-0.05, 0.05, 0.03], [-0.05, 0.018, 0.06]], 0.0026, 20, 6), 0x111827);
    k.add(GEO.cyl(0.025, 0.025, 0.012, 22), 0xf8fafc, { p: [0.072, 0.006, 0.06] });
    k.add(GEO.tor(0.025, 0.0035, PI * 2, 6, 24), 0x334155, { p: [0.072, 0.012, 0.06], r: [PI / 2, 0, 0] });
    k.add(GEO.box(0.0018, 0.0015, 0.018), 0xdc2626, { p: [0.075, 0.0135, 0.055], r: [0, 0.7, 0] });
    k.add(GEO.sph(0.5, 16, 12), 0x1f2937, { p: [-0.055, 0.02, 0.085], s: [0.04, 0.036, 0.058] });
    k.add(GEO.cyl(0.005, 0.005, 0.012, 10), 0xc0c7d1, { p: [-0.055, 0.02, 0.058], r: [PI / 2, 0, 0] });
  },
  lungs(k) { // stethoscope
    const T = 0x1f2937, M = 0xcbd5e1;
    k.add(GEO.cyl(0.022, 0.022, 0.011, 22), M, { p: [0.07, 0.0055, 0.05] });
    k.add(GEO.cyl(0.0195, 0.0195, 0.002, 22), 0xf1f5f9, { p: [0.07, 0.0115, 0.05] });
    k.add(GEO.cyl(0.004, 0.004, 0.026, 8), M, { p: [0.07, 0.006, 0.025], r: [PI / 2, 0, 0] });
    k.add(GEO.tube([[0.07, 0.006, 0.012], [0.065, 0.006, -0.02], [0.03, 0.006, -0.04], [-0.01, 0.006, -0.02]], 0.0045, 24, 8), T);
    k.add(GEO.tube([[-0.01, 0.006, -0.02], [-0.045, 0.006, 0.0], [-0.07, 0.006, 0.03]], 0.0038, 16, 8), T);
    k.add(GEO.tube([[-0.01, 0.006, -0.02], [-0.045, 0.006, -0.04], [-0.075, 0.006, -0.06]], 0.0038, 16, 8), T);
    k.add(GEO.tube([[-0.07, 0.006, 0.03], [-0.09, 0.006, 0.042], [-0.105, 0.006, 0.025]], 0.0025, 12, 6), M);
    k.add(GEO.tube([[-0.075, 0.006, -0.06], [-0.1, 0.006, -0.058], [-0.112, 0.006, -0.038]], 0.0025, 12, 6), M);
    k.add(GEO.sph(0.0065, 10, 8), 0x111111, { p: [-0.105, 0.006, 0.022] });
    k.add(GEO.sph(0.0065, 10, 8), 0x111111, { p: [-0.112, 0.006, -0.035] });
  },
  glucose(k) { // glucometer + strip + lancet pen
    k.add(GEO.rbox(0.05, 0.016, 0.082, 0.007), 0xf1f5f9, { p: [-0.02, 0.008, 0] });
    k.add(GEO.box(0.036, 0.002, 0.03), 0xa9bfa0, { p: [-0.02, 0.0165, -0.016] });
    k.add(GEO.box(0.006, 0.002, 0.014), 0x1f2937, { p: [-0.03, 0.018, -0.016] });
    k.add(GEO.box(0.006, 0.002, 0.014), 0x1f2937, { p: [-0.02, 0.018, -0.016] });
    k.add(GEO.box(0.006, 0.002, 0.014), 0x1f2937, { p: [-0.01, 0.018, -0.016] });
    k.add(GEO.cyl(0.006, 0.006, 0.004, 12), 0x3b82f6, { p: [-0.031, 0.017, 0.02] });
    k.add(GEO.cyl(0.006, 0.006, 0.004, 12), 0x64748b, { p: [-0.009, 0.017, 0.02] });
    k.add(GEO.box(0.01, 0.002, 0.03), 0xf8fafc, { p: [-0.02, 0.008, -0.055] });
    k.add(GEO.box(0.01, 0.0025, 0.008), 0xf59e0b, { p: [-0.02, 0.008, -0.068] });
    k.add(GEO.cyl(0.008, 0.008, 0.07, 14), 0x7c3aed, { p: [0.035, 0.008, 0.0], r: [PI / 2, 0, 0] });
    k.add(GEO.cyl(0.0085, 0.0085, 0.018, 14), 0xe5e7eb, { p: [0.035, 0.008, -0.042], r: [PI / 2, 0, 0] });
  },
  asa(k) { // chewable aspirin bottle + orange tablets
    k.add(GEO.lathe([[0, 0], [0.022, 0], [0.024, 0.004], [0.024, 0.05], [0.018, 0.058], [0.0145, 0.06], [0, 0.06]], 24), 0xfafafa);
    k.add(GEO.cyl(0.0245, 0.0245, 0.03, 24, true), 0xfff1d6, { p: [0, 0.027, 0] });
    k.add(GEO.cyl(0.0247, 0.0247, 0.007, 24, true), 0xdc2626, { p: [0, 0.033, 0] });
    k.add(GEO.cyl(0.0165, 0.0165, 0.015, 20), 0xf97316, { p: [0, 0.067, 0] });
    for (const [x, z] of [[0.042, 0.03], [0.055, 0.012], [0.035, 0.05], [0.058, 0.042]]) k.add(GEO.cyl(0.0065, 0.0065, 0.004, 14), 0xfb923c, { p: [x, 0.002, z] });
  },
  ntg(k) { // nitroglycerin pump spray + small amber tablet bottle
    k.add(GEO.lathe([[0, 0], [0.012, 0], [0.013, 0.004], [0.013, 0.07], [0.009, 0.077], [0, 0.078]], 20), 0x8a2b14, { p: [-0.018, 0, 0] });
    k.add(GEO.cyl(0.0134, 0.0134, 0.028, 20, true), 0xf5efe6, { p: [-0.018, 0.035, 0] });
    k.add(GEO.cyl(0.0135, 0.0135, 0.006, 20, true), 0xdc2626, { p: [-0.018, 0.035, 0] });
    k.add(GEO.cyl(0.0085, 0.0085, 0.018, 16), 0xf8fafc, { p: [-0.018, 0.087, 0] });
    k.add(GEO.cyl(0.003, 0.003, 0.012, 8), 0xf8fafc, { p: [-0.012, 0.091, 0], r: [0, 0, PI / 2] });
    k.add(GEO.lathe([[0, 0], [0.013, 0], [0.014, 0.003], [0.014, 0.034], [0, 0.036]], 18), 0xb45309, { p: [0.026, 0, 0.02], clear: false });
    k.add(GEO.cyl(0.0145, 0.0145, 0.01, 18), 0xf8fafc, { p: [0.026, 0.04, 0.02] });
  },
  oralglucose(k) { // oral glucose gel tube
    const g = new THREE.CylinderGeometry(0.017, 0.017, 0.11, 22, 10), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const t = (pos.getY(i) + 0.055) / 0.11; pos.setZ(i, pos.getZ(i) * (1 - 0.82 * t * t)); pos.setX(i, pos.getX(i) * (1 + 0.32 * t * t)); }
    g.computeVertexNormals();
    k.add(g, 0xf6a623, { p: [0.005, 0.014, 0], r: [0, 0, -PI / 2], s: [1, 1, 0.8] });
    k.add(GEO.box(0.03, 0.002, 0.022), 0xffffff, { p: [-0.005, 0.0275, 0], r: [0, 0, 0.0] });
    k.add(GEO.box(0.009, 0.006, 0.046), 0xd97706, { p: [0.062, 0.014, 0] });
    k.add(GEO.cyl(0.0095, 0.0095, 0.02, 16), 0xf8fafc, { p: [-0.06, 0.014, 0], r: [0, 0, PI / 2] });
  },
  albuterol(k) { // metered-dose inhaler (boot + canister + mouthpiece)
    const c = 0x5b7db1;
    k.add(GEO.rbox(0.036, 0.075, 0.028, 0.008), c, { p: [0, 0.04, -0.008] });
    k.add(GEO.rbox(0.032, 0.024, 0.036, 0.007), c, { p: [0, 0.012, 0.018] });
    k.add(GEO.rbox(0.026, 0.016, 0.006, 0.003), 0x1e293b, { p: [0, 0.013, 0.036] });
    k.add(GEO.cyl(0.0115, 0.0115, 0.04, 18), 0xd1d5db, { p: [0, 0.085, -0.008] });
    k.add(GEO.dome(0.0115, 18, 6), 0xd1d5db, { p: [0, 0.105, -0.008] });
    k.add(GEO.box(0.03, 0.03, 0.002), 0xf8fafc, { p: [0, 0.045, 0.0065] });
  },
  epi(k) { // epinephrine auto-injector: blue safety release, orange tip
    k.add(GEO.cyl(0.011, 0.011, 0.11, 20), 0xfacc15, { p: [0, 0.011, 0], r: [0, 0, PI / 2] });
    k.add(GEO.cyl(0.0113, 0.0113, 0.02, 20, true), 0xe5e7eb, { p: [0.022, 0.011, 0], r: [0, 0, PI / 2] });
    k.add(GEO.cyl(0.0105, 0.0105, 0.024, 20), 0x2563eb, { p: [-0.066, 0.011, 0], r: [0, 0, PI / 2] });
    k.add(GEO.sph(0.0105, 14, 10), 0x2563eb, { p: [-0.078, 0.011, 0], s: [0.6, 1, 1] });
    k.add(GEO.cyl(0.0105, 0.0105, 0.02, 20), 0xf97316, { p: [0.065, 0.011, 0], r: [0, 0, PI / 2] });
    k.add(GEO.sph(0.0105, 14, 10), 0xf97316, { p: [0.075, 0.011, 0], s: [0.7, 1, 1] });
    k.add(GEO.box(0.04, 0.002, 0.012), 0xb45309, { p: [-0.015, 0.0222, 0] });
  },
  naloxone(k) { // naloxone nasal spray device
    const w = 0xf1f5f9;
    k.add(GEO.cyl(0.012, 0.012, 0.024, 18), w, { p: [-0.045, 0.012, 0], r: [0, 0, PI / 2] });
    k.add(GEO.cyl(0.009, 0.009, 0.03, 16), 0xe2e8f0, { p: [-0.018, 0.012, 0], r: [0, 0, PI / 2] });
    k.add(GEO.cyl(0.0093, 0.0093, 0.012, 16, true), 0xea580c, { p: [-0.02, 0.012, 0], r: [0, 0, PI / 2] });
    k.add(GEO.rbox(0.008, 0.012, 0.052, 0.003), w, { p: [0.0, 0.012, 0] });
    k.add(GEO.cyl(0.0065, 0.0075, 0.032, 16), w, { p: [0.02, 0.012, 0], r: [0, 0, -PI / 2] });
    k.add(GEO.sph(0.0065, 12, 8), w, { p: [0.036, 0.012, 0] });
    k.add(GEO.rbox(0.06, 0.003, 0.03, 0.0015), 0xea580c, { p: [-0.005, 0.0015, 0.04] });
  },
  tourniquet(k) { // CAT-style tourniquet: band, windlass rod, clip, red tab
    const B = 0x1c1c1c;
    k.add(GEO.cyl(0.042, 0.042, 0.026, 30, true), B, { p: [0, 0.013, 0], s: [1, 1, 0.7] });
    k.add(GEO.cyl(0.039, 0.039, 0.024, 30, true), 0x2b2b2b, { p: [0, 0.013, 0], s: [1, 1, 0.7] });
    k.add(GEO.rbox(0.05, 0.008, 0.026, 0.003), 0x262626, { p: [0, 0.028, 0.026] });
    k.add(GEO.cyl(0.0055, 0.0055, 0.075, 12), 0x333333, { p: [0, 0.035, 0.026], r: [0, 0, PI / 2] });
    k.add(GEO.rbox(0.014, 0.018, 0.02, 0.003), 0x262626, { p: [0.045, 0.02, 0.028] });
    k.add(GEO.box(0.03, 0.002, 0.012), 0xf8fafc, { p: [0, 0.033, 0.012] });
    k.add(GEO.box(0.06, 0.003, 0.025), B, { p: [0.072, 0.002, 0.02] });
    k.add(GEO.rbox(0.014, 0.005, 0.026, 0.002), 0xdc2626, { p: [0.104, 0.003, 0.02] });
  },
  dressing(k) { // trauma (pressure) dressing: pad, elastic roll, pressure bar, gauze
    k.add(GEO.rbox(0.065, 0.014, 0.05, 0.004), 0xf8fafc, { p: [-0.035, 0.007, -0.01] });
    k.add(GEO.box(0.04, 0.002, 0.042), 0xe8dcc0, { p: [0.005, 0.002, -0.01] });
    k.add(GEO.cyl(0.018, 0.018, 0.045, 20), 0xe8dcc0, { p: [0.04, 0.018, -0.01], r: [PI / 2, 0, 0] });
    k.add(GEO.cyl(0.006, 0.006, 0.0455, 12), 0xc9b98f, { p: [0.04, 0.018, -0.01], r: [PI / 2, 0, 0] });
    k.add(GEO.rbox(0.012, 0.01, 0.048, 0.003), 0x6b7280, { p: [0.0, 0.016, -0.01] });
    for (let i = 0; i < 3; i++) k.add(GEO.box(0.04, 0.004, 0.04), 0xffffff, { p: [-0.03 + i * 0.003, 0.002 + i * 0.0042, 0.05], r: [0, i * 0.15, 0] });
  },
  collar(k) { // cervical collar: rigid shell, foam liner, chin piece, trach hole, velcro
    const gap = 0.36 * PI, ts = PI + gap / 2, tl = PI * 2 - gap;
    k.add(GEO.cyl(0.046, 0.05, 0.05, 30, true, ts, tl), 0x2f4f86, { p: [0, 0.025, 0] });
    k.add(GEO.cyl(0.042, 0.046, 0.053, 30, true, ts, tl), 0xb8bec8, { p: [0, 0.026, 0] });
    k.add(GEO.sph(0.5, 18, 10), 0x2f4f86, { p: [0, 0.05, 0.028], s: [0.06, 0.022, 0.04] });
    k.add(GEO.cyl(0.0085, 0.0085, 0.006, 14), 0x111827, { p: [0, 0.022, 0.049], r: [PI / 2, 0, 0] });
    for (const sg of [-1, 1]) { const a = PI + sg * gap / 2; k.add(GEO.rbox(0.008, 0.04, 0.02, 0.003), 0x111111, { p: [0.049 * Math.sin(a), 0.025, 0.049 * Math.cos(a)], r: [0, a, 0] }); }
  },
  blanket(k) { // folded blanket
    k.add(GEO.rbox(0.15, 0.016, 0.1, 0.006), 0x3d5a80, { p: [0, 0.008, 0] });
    k.add(GEO.rbox(0.148, 0.016, 0.1, 0.006), 0x4a6a96, { p: [0.003, 0.024, 0] });
    k.add(GEO.rbox(0.146, 0.016, 0.1, 0.006), 0x3d5a80, { p: [0, 0.04, 0] });
    k.add(GEO.box(0.154, 0.05, 0.012), 0xe5e7eb, { p: [0, 0.024, 0.025] });
  },
  cpr(k) { // stacked gloved hands (CPR)
    const g = 0x5b6ee1;
    for (const [y, rot, dz] of [[0.009, 0, 0], [0.026, 0.25, -0.012]]) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), at = (x, yy, z) => { const v = V(x, yy, z).applyQuaternion(q); return [v.x, v.y + y, v.z + dz]; };
      k.add(GEO.rbox(0.052, 0.018, 0.062, 0.008), g, { p: at(0, 0, 0), r: [0, rot, 0] });
      for (let i = 0; i < 4; i++) k.add(GEO.cap(0.0078, 0.038, 3, 8), g, { p: at(-0.019 + i * 0.0127, -0.003, 0.054 - Math.abs(i - 1.5) * 0.004), r: [PI / 2 + 0.25, rot, 0], order: 'YXZ' });
      k.add(GEO.cap(0.0088, 0.03, 3, 8), g, { p: at(0.032, 0.0, 0.012), r: [PI / 2, rot + 0.8, 0], order: 'YXZ' });
      k.add(GEO.cyl(0.03, 0.03, 0.03, 16, true), 0x4c5fd0, { p: at(0, 0.004, -0.045), r: [PI / 2, 0, rot], order: 'YXZ', s: [1, 1, 0.45] });
    }
  },
  als(k) { // handheld radio
    k.add(GEO.rbox(0.046, 0.022, 0.092, 0.007), 0x1f2937, { p: [0, 0.011, 0] });
    k.add(GEO.box(0.03, 0.002, 0.02), 0x86efac, { p: [0, 0.0225, -0.025] });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) k.add(GEO.rbox(0.008, 0.003, 0.006, 0.001), 0x6b7280, { p: [-0.011 + c * 0.011, 0.0225, 0.0 + r * 0.009] });
    for (let i = 0; i < 4; i++) k.add(GEO.box(0.03, 0.0015, 0.0015), 0x0b0f17, { p: [0, 0.0225, 0.03 + i * 0.004] });
    k.add(GEO.cyl(0.005, 0.0035, 0.065, 10), 0x111827, { p: [0.012, 0.011, -0.078], r: [PI / 2, 0, 0] });
    k.add(GEO.sph(0.005, 8, 6), 0x111827, { p: [0.012, 0.011, -0.11] });
    k.add(GEO.cyl(0.0075, 0.0075, 0.012, 12), 0x374151, { p: [-0.012, 0.011, -0.052], r: [PI / 2, 0, 0] });
    k.add(GEO.rbox(0.004, 0.012, 0.026, 0.0015), 0xf97316, { p: [-0.025, 0.011, -0.005] });
  },
};
export const EQUIP_LABEL = { spo2: 'Pulse Ox', bp: 'BP Cuff', lungs: 'Stethoscope', glucose: 'Glucometer', nc: 'Nasal Cannula', nrb: 'NRB Mask', bvm: 'BVM', opa: 'OPA', npa: 'NPA', suction: 'Suction', cpap: 'CPAP', aed: 'AED', asa: 'Aspirin', ntg: 'Nitro', oralglucose: 'Oral Glucose', albuterol: 'Albuterol', epi: 'EpiPen', naloxone: 'Naloxone', tourniquet: 'Tourniquet', dressing: 'Dressing', collar: 'C-Collar', blanket: 'Blanket', cpr: 'CPR', als: 'Radio: ALS' };

// Build an equipment item scaled to fit a w x d footprint and h height; returns a wrapper group.
export function buildEquip(id, w, d, h) {
  const inner = kitGroup(EQUIP[id], { rough: 0.45 });
  const wrap = new THREE.Group(); wrap.add(inner);
  const b = new THREE.Box3().setFromObject(inner), sz = b.getSize(V()), c = b.getCenter(V());
  const s = Math.min(w / sz.x, d / sz.z, h / sz.y);
  inner.scale.setScalar(s); inner.position.set(-c.x * s, -b.min.y * s, -c.z * s);
  wrap.userData.mats = inner.userData.mats;
  return wrap;
}

// O2 "D" cylinder with regulator (decor)
export function buildO2Tank() {
  return kitGroup(k => {
    k.add(GEO.lathe([[0, 0], [0.05, 0], [0.056, 0.01], [0.056, 0.5], [0.045, 0.55], [0.02, 0.57], [0, 0.57]], 24), 0x1f8f4e);
    k.add(GEO.cyl(0.012, 0.012, 0.05, 12), 0xc7ccd4, { p: [0, 0.59, 0] });
    k.add(GEO.rbox(0.05, 0.05, 0.04, 0.008), 0xb8bec8, { p: [0, 0.63, 0] });
    k.add(GEO.cyl(0.024, 0.024, 0.012, 20), 0xf8fafc, { p: [0, 0.645, 0.026], r: [PI / 2, 0, 0] });
    k.add(GEO.tor(0.024, 0.003, PI * 2, 6, 20), 0x334155, { p: [0, 0.645, 0.032] });
    k.add(GEO.cyl(0.012, 0.012, 0.03, 12), 0x16a34a, { p: [0.035, 0.63, 0], r: [0, 0, PI / 2] });
  }, { rough: 0.35 });
}
