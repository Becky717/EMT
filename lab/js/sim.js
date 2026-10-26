// Bottega physics core: planck.js (Box2D) world + Archimedes fluid + custom forces.
// Pure module (no DOM) so it runs in the browser and in Node tests.
import * as pl from '../lib/planck.mjs';
const { World, Vec2, Box, Circle, Polygon, RevoluteJoint, PrismaticJoint, PulleyJoint, GearJoint, DistanceJoint } = pl;

export const G = 9.81;
export const RHO_W = 1000;
export const DT = 1 / 60;

function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q.x * r.y - r.x * q.y; } return a / 2; }
function polyCentroid(p) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], c = q.x * r.y - r.x * q.y; a += c; cx += (q.x + r.x) * c; cy += (q.y + r.y) * c; }
  a /= 2; if (Math.abs(a) < 1e-12) return { x: p[0]?.x || 0, y: p[0]?.y || 0 };
  return { x: cx / (6 * a), y: cy / (6 * a) };
}
// Sutherland-Hodgman clip against half-plane f(pt) <= 0 where f is linear
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  }
  return out;
}
export function fixtureWorldPoly(body, fx) {
  const s = fx.getShape();
  if (s.getType() === 'circle') {
    const c = body.getWorldPoint(s.getCenter()), r = s.getRadius(), n = 20, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }); }
    return pts;
  }
  if (s.getType() === 'polygon') return s.m_vertices.map(v => { const w = body.getWorldPoint(v); return { x: w.x, y: w.y }; });
  return null;
}
export function submerged(body, x0, x1, level) {
  let A = 0, cx = 0, cy = 0, Atot = 0;
  for (let fx = body.getFixtureList(); fx; fx = fx.getNext()) {
    if (fx.isSensor() || fx.getUserData()?.noBuoy) continue;
    const p = fixtureWorldPoly(body, fx); if (!p) continue;
    Atot += Math.abs(polyArea(p));
    let q = clip(p, v => v.y - level); q = clip(q, v => x0 - v.x); q = clip(q, v => v.x - x1);
    if (q.length < 3) continue;
    const a = Math.abs(polyArea(q)), c = polyCentroid(q);
    A += a; cx += c.x * a; cy += c.y * a;
  }
  return { A, Atot, cx: A ? cx / A : 0, cy: A ? cy / A : 0 };
}

export class Sim {
  constructor() {
    this.world = new World({ gravity: Vec2(0, -G) });
    this.ground = this.world.createBody();
    this.bodies = []; this.decor = []; this.tanks = []; this.forces = []; this.joints = [];
    this.t = 0; this.events = []; this.state = {}; this.particles = [];
    this.airDamp = 0; // extra linear damping for "hover" puzzles (air/water drag)
  }
  _body(type, x, y, o) {
    const b = this.world.createBody({ type, position: Vec2(x, y), angle: o.angle || 0, fixedRotation: !!o.fixedRotation, bullet: !!o.bullet,
      linearDamping: o.linearDamping || 0, angularDamping: o.angularDamping || 0 });
    b.setUserData({ kind: o.kind || 'block', label: o.label || '', style: o.style || {}, float: !!o.float, id: o.id || null, draw: o.draw !== false });
    this.bodies.push(b); return b;
  }
  box(x, y, w, h, o = {}) {
    const b = this._body(o.static ? 'static' : o.kinematic ? 'kinematic' : 'dynamic', x, y, o);
    this.addBoxFixture(b, 0, 0, w, h, o);
    Object.assign(b.getUserData(), { w, h });
    return b;
  }
  addBoxFixture(b, cx, cy, w, h, o = {}) {
    const area = w * h, mass = o.mass ?? area * 50;
    const f = b.createFixture(Box(w / 2, h / 2, Vec2(cx, cy), o.fangle || 0), { density: mass / area, friction: o.friction ?? 0.5, restitution: o.restitution ?? 0, isSensor: !!o.sensor,
      filterGroupIndex: o.group || 0, filterCategoryBits: o.cat ?? 1, filterMaskBits: o.mask ?? 0xffff });
    f.setUserData({ w, h, cx, cy, kind: o.kind, label: o.label, style: o.style || {}, noBuoy: !!o.noBuoy });
    return f;
  }
  circle(x, y, r, o = {}) {
    const b = this._body(o.static ? 'static' : o.kinematic ? 'kinematic' : 'dynamic', x, y, o);
    const area = Math.PI * r * r, mass = o.mass ?? area * 50;
    b.createFixture(Circle(r), { density: mass / area, friction: o.friction ?? 0.5, restitution: o.restitution ?? 0, isSensor: !!o.sensor,
      filterGroupIndex: o.group || 0, filterCategoryBits: o.cat ?? 1, filterMaskBits: o.mask ?? 0xffff });
    Object.assign(b.getUserData(), { r });
    return b;
  }
  poly(x, y, pts, o = {}) {
    const b = this._body(o.static ? 'static' : 'dynamic', x, y, o);
    const shape = Polygon(pts.map(p => Vec2(p[0], p[1])));
    const area = Math.abs(polyArea(pts.map(p => ({ x: p[0], y: p[1] })))), mass = o.mass ?? area * 50;
    b.createFixture(shape, { density: mass / area, friction: o.friction ?? 0.5, isSensor: !!o.sensor, filterCategoryBits: o.cat ?? 1, filterMaskBits: o.mask ?? 0xffff });
    Object.assign(b.getUserData(), { pts });
    return b;
  }
  revolute(b, x, y, o = {}, a = this.ground) {
    const j = this.world.createJoint(new RevoluteJoint({ enableLimit: o.limit != null, lowerAngle: o.limit ? -o.limit : 0, upperAngle: o.limit || 0,
      enableMotor: o.motorSpeed != null, motorSpeed: o.motorSpeed || 0, maxMotorTorque: o.maxTorque || 0 }, a, b, Vec2(x, y)));
    this.joints.push(j); return j;
  }
  prismatic(b, x, y, ax, ay, o = {}) {
    const j = this.world.createJoint(new PrismaticJoint({ enableLimit: o.lower != null, lowerTranslation: o.lower ?? 0, upperTranslation: o.upper ?? 0 },
      this.ground, b, Vec2(x, y), Vec2(ax, ay)));
    this.joints.push(j); return j;
  }
  pulley(bA, bB, gA, gB, aA, aB, ratio = 1) {
    const j = this.world.createJoint(new PulleyJoint({}, bA, bB, Vec2(...gA), Vec2(...gB), Vec2(...aA), Vec2(...aB), ratio));
    this.joints.push(j); return j;
  }
  gear(bA, bB, j1, j2, ratio) {
    const j = this.world.createJoint(new GearJoint({}, bA, bB, j1, j2, ratio));
    this.joints.push(j); return j;
  }
  rod(bA, bB, aA, aB) {
    const j = this.world.createJoint(new DistanceJoint({ frequencyHz: 0, dampingRatio: 0 }, bA, bB, Vec2(...aA), Vec2(...aB)));
    this.joints.push(j); return j;
  }
  // Water tank: x0..x1 interior, floor y0, initial level, depth D (m, into the board)
  tank(x0, x1, y0, level, o = {}) {
    const t = { x0, x1, y0, D: o.D ?? 0.1, rho: o.rho ?? RHO_W, level, Aw: (x1 - x0) * (level - y0), inflow: o.inflow || null, label: o.label || '', wall: o.wall ?? 0.12, top: o.top ?? level + 1, drag: o.drag ?? 3 };
    if (o.walls !== false) {
      const wt = t.wall, top = t.top;
      this.box(x0 - wt / 2, (y0 + top) / 2, wt, top - y0 + wt, { static: true, kind: 'tankwall' });
      this.box(x1 + wt / 2, (y0 + top) / 2, wt, top - y0 + wt, { static: true, kind: 'tankwall' });
      this.box((x0 + x1) / 2, y0 - wt / 2, x1 - x0 + 2 * wt, wt, { static: true, kind: 'tankwall' });
    }
    this.tanks.push(t); return t;
  }
  _fluid(dt) {
    for (const t of this.tanks) {
      if (t.inflow) { const q = t.inflow(this.t); t.Aw += q * dt; t.lastQ = q; }
      const W = t.x1 - t.x0; let L = t.level;
      const floats = this.bodies.filter(b => b.getUserData().float && b.isDynamic());
      for (let it = 0; it < 5; it++) {
        let As = 0; for (const b of floats) As += submerged(b, t.x0, t.x1, L).A;
        L = t.y0 + (t.Aw + As) / W;
      }
      t.level = L;
      for (const b of floats) {
        const s = submerged(b, t.x0, t.x1, L); if (s.A <= 0) continue;
        const F = t.rho * G * s.A * t.D * (b.getUserData().volScale ?? 1);
        b.applyForce(Vec2(0, F), Vec2(s.cx, s.cy), true);
        const frac = s.A / Math.max(s.Atot, 1e-9), v = b.getLinearVelocity(), m = b.getMass();
        b.applyForceToCenter(Vec2(-t.drag * m * frac * v.x, -t.drag * m * frac * v.y), true);
        b.applyTorque(-t.drag * b.getInertia() * frac * b.getAngularVelocity(), true);
      }
    }
  }
  step(dt = DT) {
    for (const f of this.forces) f(this, dt);
    this._fluid(dt);
    if (this.airDamp) for (const b of this.bodies) if (b.isDynamic()) { const v = b.getLinearVelocity(), m = b.getMass(); b.applyForceToCenter(Vec2(-this.airDamp * m * v.x, -this.airDamp * m * v.y), true); }
    this.world.step(dt, 10, 8);
    this.t += dt;
    for (const p of this.particles) { if (p.dead) continue; p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt; if (p.y < (p.floor ?? 0) || p.age > 6) p.dead = true; if (p.onStep) p.onStep(p, this); }
    if (this.particles.length > 120) this.particles = this.particles.filter(p => !p.dead);
  }
  emit(p) { const alive = this.particles.filter(q => !q.dead).length; if (alive < 90) this.particles.push(Object.assign({ age: 0 }, p)); }
  event(type, data = {}) { this.events.push({ type, t: this.t, ...data }); }
}
export { pl };
