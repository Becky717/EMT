// Chapters I-III: water, levers, pulleys
import { G, RHO_W } from './sim.js';
export const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
export const r2 = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
export const fmt = (x, d = 2) => { const s = (+r2(x, d)).toString(); return s; };
export function floor(sim) { sim.box(6, 0.15, 12.6, 0.3, { static: true, kind: 'floor' }); }
export function hoverJudge(sim, body, y0, o = {}) {
  const win = o.win ?? 0.15, hold = o.hold ?? 4;
  return () => {
    const y = body.getPosition().y;
    if (y > y0 + win) return { win: false, dir: 'up', msg: o.up || 'It rose: too much lift.' };
    if (y < y0 - win) return { win: false, dir: 'down', msg: o.down || 'It sank: not enough lift.' };
    if (sim.t >= hold) return { win: true, msg: o.ok || 'It hovers. Perfect balance!' };
    return null;
  };
}
export function balanceJudge(sim, beam, o = {}) {
  const lim = (o.deg ?? 2.5) * Math.PI / 180, hold = o.hold ?? 3.5;
  return () => {
    const a = beam.getAngle();
    if (a > lim) return { win: false, dir: 'ccw', msg: o.ccw || 'It tipped left: the left side turns harder.' };
    if (a < -lim) return { win: false, dir: 'cw', msg: o.cw || 'It tipped right: the right side turns harder.' };
    if (sim.t >= hold) return { win: true, msg: o.ok || 'Level and still. Balanced!' };
    return null;
  };
}
const near = (a, b, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel + 1e-9;

// ---------- I. Liber Aquae ----------
const eureka = {
  id: 'eureka', ch: 0, title: 'Eureka! The Crown', who: 'Archimedes', img: 'archimedes_fetti',
  quote: 'Water steps aside for whatever sinks into it.', skills: ['volume', 'ratio'],
  concept: { line: 'A sunk object pushes aside its own volume of water.', formula: 'rise = volume ÷ floor area' },
  gen(t, rnd) {
    const A = 0.3; // m² (3.0 m × 0.1 m)
    let V, given;
    if (t === 0) { V = pick(rnd, [60, 75, 90, 105, 120]); given = [`Crown volume: ${V} L`, `Tank floor: ${A} m²  (= ${A * 10000} cm²)`]; }
    else if (t === 1) { V = pick(rnd, [66, 81, 96, 111]); given = [`Crown volume: ${V} L`, `Tank floor: 3.0 m × 0.1 m`]; }
    else if (t === 2) { const m = pick(rnd, [1544, 1737, 1351, 1930]); V = m / 19.3; given = [`Crown: ${m} kg of pure gold`, `Gold: 19.3 kg per litre`, `Tank floor: ${A} m²`]; }
    else { const half = pick(rnd, [579, 482.5, 675.5]); V = half / 19.3 + half / 10.5; given = [`Crown: ${2 * half} kg, half gold, half silver`, `Gold 19.3 kg/L · Silver 10.5 kg/L`, `Tank floor: ${A} m²`]; }
    const rise = V / 1000 / A * 100; // cm
    return { t, V, A, given, q: { text: 'How many cm will the water rise?', unit: 'cm', step: t < 2 ? 1 : 0.1, ans: r2(rise, 1), min: 0, max: 100, kind: 'number' } };
  },
  goal: () => 'Set your mark, then drop the crown in the tank.',
  hints: v => ['1 L = 1000 cm³. Floor area in cm²: 0.3 m² = 3000 cm².', v.t >= 2 ? 'First find volume: V = mass ÷ density.' : `Rise = ${v.V * 1000} cm³ ÷ 3000 cm².`, `Rise = ${r2(v.V * 1000, 0)} ÷ 3000 = ${v.q.ans} cm.`],
  diagnose(v, a) { const e = v.q.ans; if (near(a, e * 10, 0.05) || near(a, e / 10, 0.05)) return 'Units slip: check cm vs mm, L vs cm³ (1 L = 1000 cm³).'; if (near(a, e * 100, 0.05)) return 'That looks like metres → cm twice. 0.3 m² = 3000 cm².'; return null; },
  bin: v => [{ key: 'crown', label: 'Crown', icon: 'crown', req: true, snap: { x: 5.7, y: 5.2, r: 2.2 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const x0 = 4.2, x1 = 7.2, y0 = 0.9, lvl0 = 2.4;
    sim.box(5.7, 0.6, 3.6, 0.6, { static: true, kind: 'stand' });
    const tank = sim.tank(x0, x1, y0, lvl0, { D: 0.1, top: 3.6, label: 'cistern' });
    const w = 1.2, h = v.V / 100 / w;
    const mark = lvl0 + a / 100;
    sim.decor.push({ type: 'marker', x0: x0 - 0.3, x1: x1 + 0.3, y: mark, label: `your mark +${a} cm` });
    sim.decor.push({ type: 'marker', x0: x1 + 0.1, x1: x1 + 0.9, y: lvl0, label: 'start', faint: true });
    let crown = null;
    if (placed.has('crown')) crown = sim.box(5.7, Math.max(lvl0, mark) + h / 2 + 0.5, w, h, { mass: v.V * 19.3, kind: 'crown', float: true, fixedRotation: true });
    sim.state.tank = tank;
    return () => {
      if (!crown) return null;
      const sp = crown.getLinearVelocity().length();
      if (sim.t > 2.5 && sp < 0.02) {
        const rise = (tank.level - lvl0) * 100;
        sim.state.measured = rise;
        return Math.abs(rise - a) <= 1.2 ? { win: true, msg: `Water rose ${r2(rise, 1)} cm. Right on your mark!` } : { win: false, dir: a > rise ? 'high' : 'low', msg: `Water rose ${r2(rise, 1)} cm, not ${a}.` };
      }
      return null;
    };
  },
  maxT: 8,
};

const barge = {
  id: 'barge', ch: 0, title: 'Float the Barge', who: 'Archimedes', img: 'archimedes_claw',
  quote: 'A floating body sinks until it pushes aside its own weight of water.', skills: ['density', 'algebra'],
  concept: { line: 'A boat floats when the water it displaces weighs as much as the boat.', formula: 'mass = ρ × hull area × draft' },
  gen(t, rnd) {
    const W = 2.4, D = 0.1; let rho = 1000, mb = pick(rnd, [30, 40, 48]), d, given, ans, step = 1, unit = 'kg', text = 'How much cargo (kg)?', blk = 0;
    if (t === 0) { d = pick(rnd, [0.4, 0.45, 0.5, 0.55]); given = [`Each 10 cm of draft = 24 kg`, `Empty barge: ${mb} kg`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; }
    else if (t === 1) { d = pick(rnd, [0.35, 0.42, 0.47, 0.53]); given = [`Hull bottom: 2.4 m × 0.1 m`, `Empty barge: ${mb} kg · water 1000 kg/m³`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; }
    else if (t === 2) { rho = 1025; d = pick(rnd, [0.4, 0.44, 0.48]); given = [`Sea water: 1025 kg/m³`, `Hull bottom: 2.4 m × 0.1 m · empty ${mb} kg`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; step = 0.1; }
    else { blk = 7.5; const k = pick(rnd, [9, 10, 11]); mb = 40.5; d = (mb + k * blk) / 240; given = [`Hull bottom: 2.4 m × 0.1 m · empty 40.5 kg`, `Stones: 7.5 kg each`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; text = 'How many stones?'; unit = 'stones'; }
    const cargo = rho * W * D * d - mb;
    ans = blk ? Math.round(cargo / blk) : r2(cargo, step < 1 ? 1 : 0);
    if (blk) d = (mb + ans * blk) / (rho * W * D);
    return { t, W, D, rho, mb, d, blk, given, q: { text, unit, step, ans, min: 0, max: 200, kind: 'number' } };
  },
  goal: () => 'Load it so the barge clears the bridge AND the rock.',
  hints: v => ['Sink depth (draft) grows with total mass.', `Total mass = water density × ${v.W} × ${v.D} × draft.`, `Total = ${v.rho}×${v.W}×${v.D}×${r2(v.d, 4)} = ${r2(v.rho * v.W * v.D * v.d, 1)} kg; minus barge ${v.mb} kg.`],
  diagnose(v, a) { const tot = v.rho * v.W * v.D * v.d; if (!v.blk && near(a, tot, 0.03)) return 'You found the TOTAL. Subtract the empty barge.'; return null; },
  bin: v => [{ key: 'cargo', label: 'Cargo', icon: 'crate', req: true, snap: { x: 1.9, y: 3.2, r: 1.8 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const y0 = 0.5, lvl = 2.5;
    const tank = sim.tank(0.2, 11.8, y0, lvl, { D: v.D, rho: v.rho, top: 3.0, label: 'canal', drag: 1.0 });
    const mass = v.mb + (placed.has('cargo') ? (v.blk ? a * v.blk : a) : 0);
    const d = mass / (v.rho * v.W * v.D);
    const hullH = 0.85, mastTop = 2.1;
    const b = sim.box(1.9, lvl - d + hullH / 2, v.W, hullH, { mass, kind: 'barge', float: true, fixedRotation: true, friction: 0.3 });
    sim.addBoxFixture(b, 0.1, hullH / 2 + (mastTop - hullH) / 2, 0.1, mastTop - hullH, { mass: 1e-4, kind: 'mast', noBuoy: true });
    tank.Aw -= v.W * Math.min(d, 0.85); // canal level stays at lvl with the barge in it
    b.getUserData().cargo = placed.has('cargo') ? (v.blk ? `${a} stones` : `${a} kg`) : '';
    const dt = v.d; // target draft
    const yBr = lvl - (dt - 0.025) + mastTop - hullH / 2 + hullH / 2; // underside of bridge
    sim.box(5.2, yBr + 0.25, 1.2, 0.5, { static: true, kind: 'bridge' });
    sim.decor.push({ type: 'pillar', x: 5.2, y0: yBr + 0.5, y1: 8.9 });
    const yRock = lvl - (dt + 0.025);
    sim.poly(8.3, y0, [[-1.0, 0], [1.0, 0], [0.4, yRock - y0], [-0.4, yRock - y0]], { static: true, kind: 'rock' });
    sim.decor.push({ type: 'dock', x: 10.6, y: lvl });
    sim.decor.push({ type: 'marker', x0: 0.9, x1: 3.0, y: lvl, label: '', faint: true });
    sim.forces.push(s => { if (s.t < 0.3) return; const vx = b.getLinearVelocity().x; b.applyForceToCenter({ x: 4.0 * b.getMass() * (1.4 - vx), y: 0 }, true); });
    let stuck = 0;
    return () => {
      const p = b.getPosition(), vx = b.getLinearVelocity().x;
      if (p.x > 10.2) return { win: true, msg: 'Through the bridge, over the rock, safe at the dock!' };
      if (sim.t > 1.5 && vx < 0.05) stuck += 1 / 60; else stuck = 0;
      if (stuck > 0.6) return p.x < 6.6 ? { win: false, dir: 'low', msg: 'Riding too high: the mast hit the bridge.' } : { win: false, dir: 'high', msg: 'Riding too deep: the hull hit the rock.' };
      return null;
    };
  },
  maxT: 16,
};

const bell = {
  id: 'bell', ch: 0, title: 'The Diving Bell', who: 'Archimedes', img: 'galileo_bilancetta',
  quote: 'Make the weight equal the water pushed aside, and it will hang like a cloud.', skills: ['density', 'algebra'],
  concept: { line: 'Hover = weight equals the weight of water displaced.', formula: 'total mass = ρ_water × volume' },
  gen(t, rnd) {
    let V, m0, rho = 1, given, lead = 0, step = 1;
    if (t === 0) { V = pick(rnd, [80, 90, 100, 120]); m0 = pick(rnd, [40, 45, 50]); given = [`Bell displaces ${V} L`, `Bell weighs ${m0} kg`, `Water: 1 kg per litre`]; }
    else if (t === 1) { const r = pick(rnd, [0.3, 0.25]), h = pick(rnd, [0.4, 0.5]); V = Math.PI * r * r * h * 1000; m0 = pick(rnd, [30, 35, 40]); given = [`Bell: cylinder r=${r} m, h=${h} m`, `Bell weighs ${m0} kg`, `V = π r² h · 1 m³ = 1000 L`]; step = 0.1; }
    else if (t === 2) { rho = 1.025; V = pick(rnd, [90, 110, 120]); m0 = pick(rnd, [40, 50]); given = [`Bell displaces ${V} L`, `Bell weighs ${m0} kg`, `Sea water: 1.025 kg per litre`]; step = 0.1; }
    else { lead = 11.3; V = pick(rnd, [100, 120]); m0 = pick(rnd, [45, 55]); given = [`Bell displaces ${V} L · weighs ${m0} kg`, `Ballast is lead: 11.3 kg/L`, `(The lead displaces water too!)`]; step = 0.1; }
    const ans = lead ? (V - m0) / (1 - 1 / lead) : rho * V - m0;
    return { t, V, m0, rho, lead, given, q: { text: 'Ballast to hover (kg)?', unit: 'kg', step, ans: r2(ans, step < 1 ? 1 : 0), min: 0, max: 300, kind: 'number' } };
  },
  goal: () => 'Add ballast so the bell hovers on the line.',
  hints: v => ['Hover: total mass = mass of water displaced.', v.lead ? 'Lead adds volume: ρ(V + m/11.3) = m0 + m. Solve for m.' : `Water displaced weighs ${r2(v.rho * v.V, 2)} kg.`, `Ballast = ${v.q.ans} kg.`],
  diagnose(v, a) { if (near(a, v.rho * v.V, 0.03)) return 'That is the total. The bell already weighs some of it.'; if (v.lead && near(a, v.V - v.m0, 0.02)) return 'Close! But lead displaces water too, so you need a bit more.'; return null; },
  bin: v => [{ key: 'ballast', label: 'Ballast', icon: 'weight', req: true, snap: { x: 6, y: 3.6, r: 1.5 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const tank = sim.tank(2.8, 9.2, 0.5, 7.6, { D: 0.1, top: 8.2, drag: 3 });
    const y0 = 4.6;
    const extra = placed.has('ballast') ? a : 0;
    const Vtot = v.V + (v.lead ? extra / v.lead : 0); // litres
    const b = sim.box(6, y0, 1.0, 1.0, { mass: v.m0 + extra, kind: 'divingbell', float: true, fixedRotation: true });
    b.getUserData().volScale = Vtot / 100; // 1x1 m face × 0.1 m depth = 100 L
    b.getUserData().ballast = extra ? `${extra} kg` : '';
    tank.rho = v.rho * 1000;
    sim.decor.push({ type: 'marker', x0: 3.2, x1: 4.9, y: y0, label: 'hover line' });
    sim.decor.push({ type: 'band', x0: 3.0, x1: 9.0, y0: y0 - 0.2, y1: y0 + 0.2 });
    if (!placed.has('ballast')) return () => null;
    return hoverJudge(sim, b, y0, { win: 0.2, hold: 4.5, up: 'It floated up: too light.', down: 'It sank: too heavy.' });
  },
  maxT: 6,
};

// ---------- II. Liber Vectis ----------
function beamWorld(sim, o) {
  // o: px, py, x0, x1 (beam ends), mass, loads:[{x, m, label, kind}], limit
  floor(sim);
  sim.poly(o.px, 0.3, [[-0.6, 0], [0.6, 0], [0, o.py - 0.3 - 0.12]], { static: true, kind: 'fulcrum', mask: 0 });
  const cx = (o.x0 + o.x1) / 2, len = o.x1 - o.x0;
  const beam = sim.box(cx, o.py, len, 0.24, { mass: o.mass, kind: 'beam', angularDamping: 0 });
  for (const L of o.loads) { const s = 0.24 + 0.1 * Math.cbrt(L.m); sim.addBoxFixture(beam, L.x - cx, 0.12 + s / 2, s, s, { mass: L.m, kind: L.kind || 'weight', label: L.label }); }
  sim.revolute(beam, o.px, o.py, { limit: 15 * Math.PI / 180 });
  sim.box(o.x0 + 0.3, 0.3 + 0.2, 0.4, 0.4, { static: true, kind: 'stop', draw: false, mask: 0 });
  beam.getUserData().pivot = { x: o.px, y: o.py }; beam.getUserData().ticks = o.ticks || null;
  return beam;
}
const balance = {
  id: 'balance', ch: 1, title: 'Balance the Scales', who: 'Archimedes', img: 'archimedes_lever',
  quote: 'Unequal weights balance at distances in inverse proportion.', skills: ['ratio', 'algebra'],
  concept: { line: 'Turning force = weight × distance from the pivot.', formula: 'm₁·d₁ = m₂·d₂' },
  gen(t, rnd) {
    let L = [], m2, given;
    if (t === 0) { const c = pick(rnd, [[6, 2, 4], [6, 2, 3], [8, 1.5, 4], [9, 2, 6], [4, 3, 6]]); L = [{ m: c[0], d: c[1] }]; m2 = c[2]; }
    else if (t === 1) { const c = pick(rnd, [[5, 1.8, 4], [7, 1.2, 3], [3, 2.6, 2], [9, 1.4, 6]]); L = [{ m: c[0], d: c[1] }]; m2 = c[2]; }
    else if (t === 2) { const c = pick(rnd, [[4, 1, 3, 2.5, 5], [2, 3, 6, 1, 4], [5, 1.5, 3, 3, 8]]); L = [{ m: c[0], d: c[1] }, { m: c[2], d: c[3] }]; m2 = c[4]; }
    else { const c = pick(rnd, [[6, 3, 4, 1.5, 5], [8, 2.5, 5, 2, 4], [9, 2, 2, 3, 6]]); L = [{ m: c[0], d: c[1] }, { m: c[2], d: -c[3] }]; m2 = c[4]; }
    const left = L.filter(l => l.d > 0), right = L.filter(l => l.d < 0);
    const ans = (left.reduce((s, l) => s + l.m * l.d, 0) - right.reduce((s, l) => s + l.m * -l.d, 0)) / m2;
    given = [...left.map(l => `Left: ${l.m} kg at ${l.d} m`), ...right.map(l => `Right: ${l.m} kg at ${-l.d} m`), `Your weight: ${m2} kg`];
    return { t, L, m2, given, q: { text: `Where does ${m2} kg go (m right of pivot)?`, unit: 'm', step: 0.05, ans: r2(ans, 2), min: 0.1, max: 3.9, kind: 'place' } };
  },
  goal: v => `Hang the ${v.m2} kg weight so the beam stays level.`,
  hints: v => ['Balance when left turning = right turning.', 'Turning = kg × metres. Add up each side.', `d = ${v.L.map(l => `${l.m}×${Math.abs(l.d)}`).join(v.L.length > 1 && v.L[1].d < 0 ? ' − ' : ' + ')} ÷ ${v.m2} = ${v.q.ans} m`],
  diagnose(v, a) { const e = v.q.ans, L0 = v.L[0]; if (v.L.length === 1 && near(a, L0.d * v.m2 / L0.m, 0.03)) return 'Flipped ratio! Heavier weight goes CLOSER to the pivot.'; return null; },
  bin: v => [{ key: 'w', label: `${v.m2} kg`, icon: 'weight', req: true, rail: { x0: 6.1, x1: 9.9, y: 3.0, toAns: x => r2(Math.round((x - 6) / 0.05) * 0.05, 2), fromAns: a => 6 + a } }],
  build(sim, v, a, placed) {
    const loads = v.L.map(l => ({ x: 6 - l.d, m: l.m, label: `${l.m} kg` }));
    if (placed.has('w')) loads.push({ x: 6 + a, m: v.m2, label: `${v.m2} kg`, kind: 'myweight' });
    const beam = beamWorld(sim, { px: 6, py: 2.6, x0: 1.8, x1: 10.2, mass: 3, loads, ticks: { from: 6, step: 0.5, n: 8 } });
    if (!placed.has('w')) { sim.state.noRun = true; return () => null; }
    return balanceJudge(sim, beam, { ccw: 'Tipped left: move your weight farther out.', cw: 'Tipped right: move your weight closer in.' });
  },
  maxT: 5,
};
const liftstone = {
  id: 'liftstone', ch: 1, title: 'Give Me a Place to Stand', who: 'Archimedes', img: 'archimedes_lever',
  quote: 'Give me a place to stand, and I will move the Earth.', skills: ['algebra', 'moments'],
  concept: { line: 'A long arm lets a small weight hold a big one.', formula: 'M·d₁ = m·d₂ (+ beam weight × its offset)' },
  gen(t, rnd) {
    // pivot at x=4, beam from 2.6 to x1; stone at d1 left, counterweight at d2 right
    let M, d1, d2, mb = 0.0001, x1 = 10.6, given, step = 0.5;
    if (t === 0) { const c = pick(rnd, [[60, 1.2, 6], [90, 1.0, 6], [75, 1.2, 4.5], [80, 1.2, 6]]); [M, d1, d2] = c; given = [`Stone: ${M} kg, ${d1} m left of pivot`, `Counterweight: ${d2} m right`, `Beam weight: ignore`]; }
    else if (t === 1) { const c = pick(rnd, [[64, 1.3, 5.2], [95, 1.1, 5.5], [72, 1.25, 6]]); [M, d1, d2] = c; given = [`Stone: ${M} kg at ${d1} m`, `Counterweight at ${d2} m`, `Beam weight: ignore`]; step = 0.1; }
    else if (t === 2) { const c = pick(rnd, [[80, 1.2, 6, 4], [100, 1.1, 6, 6], [90, 1.3, 6, 5]]); [M, d1, d2, mb] = c; x1 = 4 + d2; given = [`Stone: ${M} kg at ${d1} m`, `Counterweight at ${d2} m`, `Beam: ${mb} kg, centre ${r2((2.6 + x1) / 2 - 4, 2)} m right`]; step = 0.01; }
    else { const c = pick(rnd, [[30, 1.2, 6, 4], [35, 1.0, 6, 5], [25, 1.3, 6, 6]]); let V; [V, d1, d2, mb] = c; M = V * 2.7; x1 = 4 + d2; given = [`Granite stone: ${V} L (2.7 kg/L) at ${d1} m`, `Counterweight at ${d2} m`, `Beam: ${mb} kg, centre ${r2((2.6 + x1) / 2 - 4, 2)} m right`]; step = 0.01; }
    const off = (2.6 + x1) / 2 - 4;
    const ans = (M * d1 - mb * off) / d2;
    return { t, M, d1, d2, mb, x1, off, given, q: { text: 'Counterweight (kg) to hold it level?', unit: 'kg', step, ans: r2(ans, 2), min: 0, max: 200, kind: 'number' } };
  },
  goal: () => 'Pick the counterweight that holds the stone level.',
  hints: v => ['Turning force = kg × distance from the pivot.', v.mb > 0.01 ? `The beam helps: ${v.mb} kg × ${r2(v.off, 2)} m on the right.` : `Left turning = ${v.M}×${v.d1}.`, `m = (${r2(v.M, 1)}×${v.d1}${v.mb > 0.01 ? ` − ${v.mb}×${r2(v.off, 2)}` : ''}) ÷ ${v.d2} = ${v.q.ans} kg`],
  diagnose(v, a) { if (v.mb > 0.01 && near(a, v.M * v.d1 / v.d2, 0.01)) return 'Nearly! You forgot the beam\'s own weight helping on the right.'; if (near(a, v.M * v.d2 / v.d1, 0.03)) return 'Flipped ratio: the long arm needs LESS weight.'; return null; },
  bin: v => [{ key: 'cw', label: 'Counterweight', icon: 'weight', req: true, snap: { x: 4 + v.d2, y: 3.6, r: 1.6 } }],
  build(sim, v, a, placed) {
    const loads = [{ x: 4 - v.d1, m: v.M, label: `${r2(v.M, 1)} kg`, kind: 'stone' }];
    if (placed.has('cw')) loads.push({ x: 4 + v.d2, m: a, label: `${a} kg`, kind: 'myweight' });
    const beam = beamWorld(sim, { px: 4, py: 2.4, x0: 2.6, x1: v.x1, mass: v.mb, loads });
    if (!placed.has('cw')) return () => null;
    return balanceJudge(sim, beam, { ccw: 'The stone side dropped: add counterweight.', cw: 'Your side dropped: too much counterweight.' });
  },
  maxT: 5,
};
const moments = {
  id: 'moments', ch: 1, title: "Leonardo's Steelyard", who: 'Leonardo da Vinci', img: 'leonardo_flywheel',
  quote: 'Mechanics is the paradise of the mathematical sciences.', skills: ['algebra', 'moments'],
  concept: { line: 'Add every turning force on each side. Balanced when sums match.', formula: 'Σ(m·d) left = Σ(m·d) right' },
  gen(t, rnd) {
    let L, R, dx, given;
    if (t === 0) { const c = pick(rnd, [[[3, 2], [2, 1], 3, 2], [[4, 2], [2, 3], 4, 3], [[5, 1], [3, 2], 2, 2.75]]); L = [{ m: c[0][0], d: c[0][1] }, { m: c[1][0], d: c[1][1] }]; R = []; dx = c[2] === undefined ? 2 : c[3]; }
    else if (t === 1) { const c = pick(rnd, [[[2.5, 3], [4, 1.5], 3.2], [[3.5, 2.4], [1.5, 3.6], 2.8]]); L = [{ m: c[0][0], d: c[0][1] }, { m: c[1][0], d: c[1][1] }]; R = []; dx = c[2]; }
    else if (t === 2) { const c = pick(rnd, [[[2, 3.5], [3, 2], [4, 1]], [[1.5, 3.8], [2.5, 2.2], [5, 0.8]]]); L = c.map(x => ({ m: x[0], d: x[1] })); R = []; dx = 3.4; }
    else { const c = pick(rnd, [[[3, 3], [4, 2], [2, 1.5], 3.5], [[5, 2.5], [2, 3.5], [3, 1], 3.0]]); L = [{ m: c[0][0], d: c[0][1] }, { m: c[1][0], d: c[1][1] }]; R = [{ m: c[2][0], d: c[2][1] }]; dx = c[3]; }
    const ans = (L.reduce((s, l) => s + l.m * l.d, 0) - R.reduce((s, l) => s + l.m * l.d, 0)) / dx;
    given = [L.map(l => `${l.m}kg@${l.d}m`).join(' + ') + ' (left)', ...(R.length ? [R.map(l => `${l.m}kg@${l.d}m`).join(' + ') + ' (right)'] : []), `Your hook: ${dx} m right`];
    return { t, L, R, dx, given, q: { text: 'What weight on your hook (kg)?', unit: 'kg', step: 0.01, ans: r2(ans, 2), min: 0, max: 60, kind: 'number' } };
  },
  goal: () => 'Choose the hook weight that levels the steelyard.',
  hints: v => ['Multiply each weight by its distance.', `Left total = ${v.L.map(l => `${l.m}×${l.d}`).join(' + ')} = ${r2(v.L.reduce((s, l) => s + l.m * l.d, 0), 3)}.`, `m = (left${v.R.length ? ' − right' : ''}) ÷ ${v.dx} = ${v.q.ans} kg`],
  diagnose(v, a) { const sm = v.L.reduce((s, l) => s + l.m, 0); if (near(a, sm, 0.02)) return 'Weights alone don\'t balance. Distance matters: use kg × m.'; return null; },
  bin: v => [{ key: 'hook', label: 'Your weight', icon: 'weight', req: true, snap: { x: 6 + v.dx, y: 3.6, r: 1.6 } }],
  build(sim, v, a, placed) {
    const loads = [...v.L.map(l => ({ x: 6 - l.d, m: l.m, label: `${l.m}` })), ...v.R.map(l => ({ x: 6 + l.d, m: l.m, label: `${l.m}` }))];
    if (placed.has('hook')) loads.push({ x: 6 + v.dx, m: a, label: `${a}`, kind: 'myweight' });
    const beam = beamWorld(sim, { px: 6, py: 2.6, x0: 1.9, x1: 10.1, mass: 2, loads, ticks: { from: 6, step: 0.5, n: 8 } });
    if (!placed.has('hook')) return () => null;
    return balanceJudge(sim, beam, { ccw: 'Left side won: your weight is too light.', cw: 'Right side won: your weight is too heavy.' });
  },
  maxT: 5,
};

// ---------- III. Liber Trochleae ----------
function hangWorld(sim, o) {
  // load at xL hanging from (xL, top), effort at xE hanging from (xE, top); ratio r (effort = r × load)
  floor(sim);
  sim.box(6, 8.15, 9.5, 0.3, { static: true, kind: 'gantry' });
  const load = sim.box(o.xL, o.yL, o.wL || 1.0, o.hL || 0.8, { mass: o.mL, kind: o.kindL || 'load', label: o.labelL });
  const eff = sim.box(o.xE, o.yE, 0.6, 0.6, { mass: o.mE, kind: 'myweight', label: o.labelE });
  const top = 7.7;
  sim.prismatic(load, o.xL, o.yL, 0, 1); sim.prismatic(eff, o.xE, o.yE, 0, 1);
  const j = sim.pulley(load, eff, [o.xL, top], [o.xE, top], [o.xL, o.yL + (o.hL || 0.8) / 2], [o.xE, o.yE + 0.3], o.ratio);
  sim.decor.push({ type: 'tackle', load, eff, xL: o.xL, xE: o.xE, top, n: o.n, n2: o.n2 || 0, hL: o.hL || 0.8 });
  sim.airDamp = 0.8;
  return { load, eff, j };
}
const wellbucket = {
  id: 'wellbucket', ch: 2, title: 'The Well Bucket', who: 'Hero of Alexandria', img: 'hero_aeolipile',
  quote: 'A fixed wheel changes the direction of a force, not its size.', skills: ['density', 'ratio'],
  concept: { line: 'One fixed pulley: the effort equals the load.', formula: 'effort = load' },
  gen(t, rnd) {
    let mb, V, rho = 1, given, step = 0.5;
    if (t === 0) { mb = pick(rnd, [2, 3, 4]); V = pick(rnd, [8, 10, 12, 15]); given = [`Bucket: ${mb} kg`, `Water inside: ${V} L`, `Water: 1 kg per litre`]; }
    else if (t === 1) { mb = pick(rnd, [2.5, 3.5]); V = pick(rnd, [12.5, 9.5, 14]); given = [`Bucket: ${mb} kg`, `Water: ${V} L`, `Water: 1 kg per litre`]; step = 0.1; }
    else if (t === 2) { mb = pick(rnd, [2, 3]); V = pick(rnd, [12, 14, 16]); rho = 1.025; given = [`Bucket: ${mb} kg`, `Sea water: ${V} L at 1.025 kg/L`]; step = 0.01; }
    else { mb = pick(rnd, [2.4, 3.1]); const L = pick(rnd, [0.12, 0.15]); V = Math.PI * L * L * 0.25 * 1000; given = [`Bucket: ${mb} kg`, `Full cylinder: r = ${L} m, h = 0.25 m`, `Water 1 kg/L · 1 m³ = 1000 L`]; step = 0.01; }
    const ans = mb + rho * V;
    return { t, mb, V, rho, given, q: { text: 'Counterweight (kg) to hold it still?', unit: 'kg', step, ans: r2(ans, 2), min: 0, max: 100, kind: 'number' } };
  },
  goal: () => 'Hang a counterweight that holds the full bucket still.',
  hints: v => ['A single fixed pulley gives no advantage.', `Load = bucket + water = ${v.mb} + ${r2(v.rho * v.V, 3)} kg.`, `Counterweight = ${v.q.ans} kg.`],
  diagnose(v, a) { if (near(a, v.rho * v.V, 0.02)) return 'Don\'t forget the bucket itself!'; if (near(a, v.q.ans / 2, 0.03)) return 'A FIXED pulley has no advantage. Effort = load.'; return null; },
  bin: v => [{ key: 'cw', label: 'Counterweight', icon: 'weight', req: true, snap: { x: 7.0, y: 4.5, r: 1.6 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const top = 7.4, xL = 5.0, xE = 7.0;
    sim.box(6, 8.0, 3, 0.25, { static: true, kind: 'gantry' });
    sim.decor.push({ type: 'wheel', x: 6, y: top, r: 1.0 });
    const load = sim.box(xL, 4.0, 0.9, 0.9, { mass: v.mb + v.rho * v.V, kind: 'bucket' });
    sim.decor.push({ type: 'well', x: xL, y: 0.3 });
    if (!placed.has('cw')) { sim.decor.push({ type: 'rope', pts: () => [[xL, top], [xL, load.getPosition().y + 0.45]] }); return () => null; }
    const eff = sim.box(xE, 4.5, 0.6, 0.6, { mass: a, kind: 'myweight', label: `${a}` });
    sim.prismatic(load, xL, 4.0, 0, 1); sim.prismatic(eff, xE, 4.5, 0, 1);
    sim.pulley(load, eff, [xL, top], [xE, top], [xL, 4.45], [xE, 4.8], 1);
    sim.decor.push({ type: 'rope', pts: () => [[xL, load.getPosition().y + 0.45], [xL, top], [xE, top], [xE, eff.getPosition().y + 0.3]] });
    sim.airDamp = 0.8;
    return hoverJudge(sim, load, 4.0, { win: 0.12, hold: 4.5, up: 'Bucket rose: counterweight too heavy.', down: 'Bucket fell: counterweight too light.' });
  },
  maxT: 6,
};
const tackle = {
  id: 'tackle', ch: 2, title: "Brunelleschi's Hoist", who: 'Brunelleschi & Taccola', img: 'taccola_crane',
  quote: 'Many ropes share the load; each one carries only its part.', skills: ['ratio', 'algebra'],
  concept: { line: 'n ropes hold the moving block, so effort = load ÷ n.', formula: 'effort = load ÷ n' },
  gen(t, rnd) {
    let M, n, n2 = 0, given, text = 'Effort weight (kg) to hold it?', unit = 'kg', step = 0.5, ans, kind = 'number';
    if (t === 0) { n = pick(rnd, [2, 3, 4]); M = n * pick(rnd, [10, 12, 15]); given = [`Marble block: ${M} kg`, `Ropes holding the moving block: ${n}`]; ans = M / n; }
    else if (t === 1) { n = pick(rnd, [4, 5, 6]); M = pick(rnd, [90, 130, 155]); given = [`Marble block: ${M} kg`, `Count the ropes on the lower block!`]; ans = M / n; step = 0.01; }
    else if (t === 2) { n = pick(rnd, [3, 4, 6]); const e = pick(rnd, [20, 25, 30]); M = n * e; given = [`Marble block: ${M} kg`, `Your effort weight: ${e} kg`]; text = 'How many ropes (n) do you need?'; unit = 'ropes'; step = 1; ans = n; kind = 'number'; }
    else { n = pick(rnd, [2, 3]); n2 = pick(rnd, [3, 4]); M = n * n2 * pick(rnd, [10, 12.5, 15]); given = [`Ship's cargo: ${M} kg`, `Two hoists in series: ${n} ropes × ${n2} ropes`, `(Archimedes lifted a ship this way)`]; ans = M / (n * n2); step = 0.1; }
    return { t, M, n, n2, e: t === 2 ? M / n : null, given, q: { text, unit, step, ans: r2(ans, 2), min: 0, max: 200, kind } };
  },
  goal: v => v.t === 2 ? 'Choose how many ropes so your weight holds the block.' : 'Hang the effort weight that holds the block still.',
  hints: v => ['Each rope on the moving block carries an equal share.', v.n2 ? 'Two hoists multiply: total share = n₁ × n₂.' : `Share per rope = load ÷ ${v.t === 2 ? 'n' : v.n}.`, v.t === 2 ? `n = ${v.M} ÷ ${v.e} = ${v.n}` : `${v.M} ÷ ${v.n2 ? v.n * v.n2 : v.n} = ${v.q.ans} kg`],
  diagnose(v, a) { if (v.t !== 2 && near(a, v.M * (v.n2 ? v.n * v.n2 : v.n), 0.02)) return 'Multiplied instead of divided: pulleys make effort SMALLER.'; if (v.n2 && near(a, v.M / (v.n + v.n2), 0.02)) return 'Series hoists multiply (n₁ × n₂), not add.'; return null; },
  bin: v => [{ key: 'eff', label: v.t === 2 ? `${v.e} kg` : 'Effort', icon: 'weight', req: true, snap: { x: 9.0, y: 4.6, r: 1.6 } }],
  build(sim, v, a, placed) {
    const n = v.t === 2 ? Math.max(1, Math.round(a)) : v.n, MA = v.n2 ? v.n * v.n2 : n;
    const mE = v.t === 2 ? v.e : a;
    if (!placed.has('eff')) { floor(sim); sim.box(6, 8.15, 9.5, 0.3, { static: true, kind: 'gantry' }); const load = sim.box(4, 3.0, 1.4, 0.9, { static: true, kind: 'marble', label: `${v.M} kg` }); sim.decor.push({ type: 'tackle', load, eff: null, xL: 4, xE: 9, top: 7.7, n, n2: v.n2, hL: 0.9 }); return () => null; }
    const w = hangWorld(sim, { xL: 4, yL: 3.0, mL: v.M, wL: 1.4, hL: 0.9, kindL: 'marble', labelL: `${v.M} kg`, xE: 9, yE: 4.6, mE, labelE: `${mE}`, ratio: 1 / MA, n, n2: v.n2 });
    return hoverJudge(sim, w.load, 3.0, { win: 0.1, hold: 5, up: 'Block rose: too much effort (or too many ropes).', down: 'Block dropped: not enough effort.' });
  },
  maxT: 6.5,
};
const crane = {
  id: 'crane', ch: 2, title: "Taccola's Crane: Work", who: 'Mariano Taccola', img: 'agricola_mining',
  quote: 'What you gain in force, you pay back in distance.', skills: ['ratio', 'work'],
  concept: { line: 'Pulleys trade force for distance. Work in = work out.', formula: 'effort distance = n × load height' },
  gen(t, rnd) {
    let n, h, given;
    if (t === 0) { n = pick(rnd, [2, 3]); h = pick(rnd, [0.5, 0.6, 0.8]); }
    else if (t === 1) { n = pick(rnd, [3, 4]); h = pick(rnd, [0.45, 0.55, 0.65]); }
    else if (t === 2) { n = pick(rnd, [4, 5]); h = pick(rnd, [0.62, 0.74, 0.5]); }
    else { n = pick(rnd, [5, 6]); h = pick(rnd, [0.55, 0.6]); }
    given = [`Ropes on the moving block: ${n}`, `Lift the block ${h} m to the ledge`, `F × d is the same on both sides`];
    if (t >= 3) given[2] = `Work = ${r2(40 * G * h, 1)} J for the ${40} kg block`;
    return { t, n, h, M: 40, given, q: { text: 'How far must the effort drop (m)?', unit: 'm', step: 0.05, ans: r2(n * h, 2), min: 0.2, max: 4.5, kind: 'place' } };
  },
  goal: () => 'Set the floor stop so the block stops exactly at the ledge.',
  hints: v => ['Each metre of block lift pulls n metres of rope.', `Drop = ${v.n} × lift height.`, `Drop = ${v.n} × ${v.h} = ${v.q.ans} m`],
  diagnose(v, a) { if (near(a, v.h / v.n, 0.05)) return 'Flipped: the light effort must move FARTHER.'; return null; },
  bin: v => [{ key: 'stop', label: 'Floor stop', icon: 'stop', req: true, rail: { axis: 'y', x: 9.0, y0: 1.6, y1: 5.9, toAns: y => r2(Math.round((6.2 - 0.3 - y) / 0.05) * 0.05, 2), fromAns: a => 6.2 - 0.3 - a } }],
  build(sim, v, a, placed) {
    const mE = v.M / v.n * 1.12;
    const w = hangWorld(sim, { xL: 3.8, yL: 3.0, mL: v.M, wL: 1.2, hL: 0.8, kindL: 'marble', labelL: `${v.M} kg`, xE: 9, yE: 6.2, mE, labelE: `${r2(mE, 1)}`, ratio: 1 / v.n, n: v.n });
    sim.airDamp = 0;
    const ledgeY = 3.0 + 0.4 + v.h; // block top must reach this
    sim.decor.push({ type: 'ledge', x: 3.8, y: ledgeY, w: 2.4 });
    sim.decor.push({ type: 'marker', x0: 2.2, x1: 5.4, y: ledgeY, label: 'ledge', faint: true });
    if (placed.has('stop')) { const yTop = 6.2 - 0.3 - a; sim.box(9, yTop - 0.15, 0.9, 0.3, { static: true, kind: 'stopblock' }); }
    else sim.state.noRun = true;
    let still = 0;
    return () => {
      const vL = w.load.getLinearVelocity().y, top = w.load.getPosition().y + 0.4;
      if (top > ledgeY + 0.08) return { win: false, dir: 'high', msg: 'The block overshot the ledge: the stop is too low.' };
      if (sim.t > 0.5 && Math.abs(vL) < 0.01) still += 1 / 60; else still = 0;
      if (still > 0.4) return Math.abs(top - ledgeY) <= 0.06 ? { win: true, msg: 'Stopped right at the ledge. Work balanced!' } : { win: false, dir: 'low', msg: `The block stopped ${r2((ledgeY - top) * 100, 0)} cm short: the stop is too high.` };
      return null;
    };
  },
  maxT: 8,
};
export const CH_A = [eureka, barge, bell, balance, liftstone, moments, wellbucket, tackle, crane];
