// Chapters I-III: water, levers, pulleys — widget (Incredible Machine) mode.
// Math content kept in .math* fields for the progressive math layer.
import { G, RHO_W } from './sim.js';
export const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
export const r2 = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
export const fmt = (x, d = 2) => (+r2(x, d)).toString();

/** Discrete numeric options around the correct answer (always includes ans).
 *  Distractors stay ≥ sepRel (default 18%) away so physics judges reject them. */
export function choicesAround(ans, rnd, o = {}) {
  const step = o.step ?? (Math.abs(ans) >= 10 ? 1 : Math.abs(ans) >= 1 ? 0.1 : 0.01);
  const n = o.n ?? 5, spread = o.spread ?? 0.45;
  const lo = o.min ?? 0.05, hi = o.max ?? 300;
  const sepRel = o.sepRel ?? 0.18;
  const sepAbs = Math.max(step * 2.5, Math.abs(ans) * sepRel);
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const snap = v => r2(Math.round(v / step) * step, dec);
  const ansS = snap(ans);
  const far = v => Math.abs(v - ansS) >= sepAbs - 1e-9;
  const set = new Set([ansS]);
  // Prefer factor-based distractors well away from ans
  const factors = [0.55, 0.65, 0.75, 1.25, 1.4, 1.55, 0.45, 1.7, 0.35, 1.9];
  for (const f of factors) {
    if (set.size >= n) break;
    const v = snap(ans * (f + (rnd() - 0.5) * 0.06));
    if (v > lo && v < hi && far(v)) set.add(v);
  }
  let tries = 0;
  while (set.size < n && tries++ < 160) {
    const f = 1 + (rnd() < 0.5 ? -1 : 1) * (sepRel + rnd() * spread);
    const v = snap(ans * f);
    if (v > lo && v < hi && far(v)) set.add(v);
  }
  let k = Math.max(3, Math.ceil(sepAbs / step));
  while (set.size < n && k < 80) {
    for (const d of [step * k, -step * k]) {
      const v = snap(ansS + d);
      if (v > lo && v < hi && far(v)) set.add(v);
      if (set.size >= n) break;
    }
    k++;
  }
  return [...set].sort((a, b) => a - b).slice(0, n);
}

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

function partsQ(ans, rnd, o = {}) {
  const dec = (o.step && o.step < 1) ? (o.step >= 0.1 ? 1 : 2) : 0;
  const ansR = r2(ans, dec);
  const ch = choicesAround(ansR, rnd, o);
  // Ensure ans is in choices (snap may have drifted)
  if (!ch.some(c => Math.abs(c - ansR) < 1e-9)) { ch.push(ansR); ch.sort((a, b) => a - b); }
  const sepAbs = Math.max((o.step ?? 1) * 2.5, Math.abs(ansR) * (o.sepRel ?? 0.18));
  return {
    kind: 'parts', text: o.text || 'Pick a part from the bin', unit: o.unit || '',
    step: o.step ?? 1, ans: ansR,
    choices: ch, wrong: ch.filter(c => Math.abs(c - ansR) >= sepAbs - 1e-9),
    min: o.min ?? 0, max: o.max ?? 300,
  };
}
function weightBin(choices, o = {}) {
  const x = o.x ?? 6, y = o.y ?? 3.6, unit = o.unit || 'kg', icon = o.icon || 'weight', key = o.key || 'w';
  return choices.map((v, i) => ({
    key: `${key}${i}`, label: unit === 'stones' || unit === 'ropes' ? `${v}` : `${v} ${unit}`,
    icon, value: v, group: key, req: false, snap: { x, y, r: o.r ?? 1.8 },
  }));
}

// ---------- I. Liber Aquae ----------
const eureka = {
  id: 'eureka', ch: 0, title: 'Eureka! The Crown', who: 'Archimedes', img: 'archimedes_fetti',
  quote: 'Water steps aside for whatever sinks into it.', skills: ['placement', 'buoyancy'],
  concept: { line: 'Drop the crown so the water rises to the cork float and rings the little bell.', formula: 'rise = volume ÷ floor area' },
  gen(t, rnd) {
    const A = 0.3; let V, given, mathGiven;
    if (t === 0) { V = pick(rnd, [60, 75, 90, 105, 120]); mathGiven = [`Crown volume: ${V} L`, `Tank floor: ${A} m²`]; }
    else if (t === 1) { V = pick(rnd, [66, 81, 96, 111]); mathGiven = [`Crown volume: ${V} L`, `Tank floor: 3.0 m × 0.1 m`]; }
    else if (t === 2) { const m = pick(rnd, [1544, 1737, 1351, 1930]); V = m / 19.3; mathGiven = [`Crown: ${m} kg of pure gold`, `Gold: 19.3 kg per litre`, `Tank floor: ${A} m²`]; }
    else { const half = pick(rnd, [579, 482.5, 675.5]); V = half / 19.3 + half / 10.5; mathGiven = [`Crown: ${2 * half} kg, half gold, half silver`, `Gold 19.3 kg/L · Silver 10.5 kg/L`, `Tank floor: ${A} m²`]; }
    const rise = V / 1000 / A * 100;
    given = ['Drag the mark float to where you think the water will stop.', 'Drop the crown into the cistern.', 'Win if your mark matches the rise.'];
    return { t, V, A, given, mathGiven, q: { kind: 'place', text: 'Slide the mark float', unit: 'cm', step: t < 2 ? 1 : 0.1, ans: r2(rise, 1), min: 0, max: 100 } };
  },
  goal: () => 'Mark the waterline, then drop the crown.',
  hints: () => ['Slide the cork mark up or down the tank wall.', 'A bigger crown pushes the water higher.', 'Watch the glowing rail — park the mark just above the starting water.'],
  mathHints: v => ['1 L = 1000 cm³. Floor area: 0.3 m² = 3000 cm².', v.t >= 2 ? 'First find volume: V = mass ÷ density.' : `Rise = ${v.V * 1000} cm³ ÷ 3000 cm².`, `Rise = ${r2(v.V * 1000, 0)} ÷ 3000 = ${v.q.ans} cm.`],
  diagnose(v, a) { const e = v.q.ans; if (near(a, e * 10, 0.05) || near(a, e / 10, 0.05)) return 'Units slip: check cm vs mm.'; return null; },
  observe: () => 'The water rose by exactly the space the crown took up.',
  predict: () => ({ text: 'When the crown sinks, the water will…', options: ['Rise', 'Fall', 'Stay put'], ans: 0 }),
  bin: () => [
    { key: 'mark', label: 'Mark float', icon: 'stop', req: true, rail: { axis: 'y', x: 7.55, y0: 2.4, y1: 3.5, toAns: y => r2(Math.round(((y - 2.4) * 100) / 1) * 1, 0), fromAns: a => 2.4 + a / 100 } },
    { key: 'crown', label: 'Crown', icon: 'crown', req: true, snap: { x: 5.7, y: 5.2, r: 2.2 } },
  ],
  build(sim, v, a, placed) {
    floor(sim);
    const x0 = 4.2, x1 = 7.2, y0 = 0.9, lvl0 = 2.4;
    sim.box(5.7, 0.6, 3.6, 0.6, { static: true, kind: 'stand' });
    const tank = sim.tank(x0, x1, y0, lvl0, { D: 0.1, top: 3.6, label: 'cistern' });
    const w = 1.2, h = v.V / 100 / w;
    const mark = lvl0 + (a || 0) / 100;
    sim.decor.push({ type: 'marker', x0: x0 - 0.3, x1: x1 + 0.3, y: mark, label: 'your mark' });
    sim.decor.push({ type: 'marker', x0: x1 + 0.1, x1: x1 + 0.9, y: lvl0, label: 'start', faint: true });
    let crown = null;
    if (placed.has('crown')) crown = sim.box(5.7, Math.max(lvl0, mark) + h / 2 + 0.5, w, h, { mass: v.V * 19.3, kind: 'crown', float: true, fixedRotation: true });
    sim.state.tank = tank;
    return () => {
      if (!crown || !placed.has('mark')) return null;
      const sp = crown.getLinearVelocity().length();
      if (sim.t > 2.5 && sp < 0.02) {
        const rise = (tank.level - lvl0) * 100;
        sim.state.measured = rise;
        return Math.abs(rise - a) <= 1.2 ? { win: true, msg: 'Water kissed your mark. Eureka!' } : { win: false, dir: a > rise ? 'high' : 'low', msg: a > rise ? 'Mark too high — the water never reached it.' : 'Mark too low — water climbed past it.' };
      }
      return null;
    };
  },
  maxT: 8,
};

const barge = {
  id: 'barge', ch: 0, title: 'Float the Barge', who: 'Archimedes', img: 'archimedes_claw',
  quote: 'A floating body sinks until it pushes aside its own weight of water.', skills: ['placement', 'buoyancy'],
  concept: { line: 'Load just enough cargo so the barge slips under the bridge and clears the rock.', formula: 'mass = ρ × hull area × draft' },
  gen(t, rnd) {
    const W = 2.4, D = 0.1; let rho = 1000, mb = pick(rnd, [30, 40, 48]), d, given, mathGiven, ans, step = 1, unit = 'kg', text = 'Pick a cargo crate', blk = 0;
    if (t === 0) { d = pick(rnd, [0.4, 0.45, 0.5, 0.55]); mathGiven = [`Each 10 cm of draft = 24 kg`, `Empty barge: ${mb} kg`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; }
    else if (t === 1) { d = pick(rnd, [0.35, 0.42, 0.47, 0.53]); mathGiven = [`Hull bottom: 2.4 m × 0.1 m`, `Empty barge: ${mb} kg · water 1000 kg/m³`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; }
    else if (t === 2) { rho = 1025; d = pick(rnd, [0.4, 0.44, 0.48]); mathGiven = [`Sea water: 1025 kg/m³`, `Hull bottom: 2.4 m × 0.1 m · empty ${mb} kg`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; step = 0.1; }
    else { blk = 7.5; const k = pick(rnd, [9, 10, 11]); mb = 40.5; d = (mb + k * blk) / 240; mathGiven = [`Hull bottom: 2.4 m × 0.1 m · empty 40.5 kg`, `Stones: 7.5 kg each`, `Waterline mark: ${r2(d * 100, 1)} cm deep`]; text = 'How many stones?'; unit = 'stones'; }
    const cargo = rho * W * D * d - mb;
    ans = blk ? Math.round(cargo / blk) : r2(cargo, step < 1 ? 1 : 0);
    if (blk) d = (mb + ans * blk) / (rho * W * D);
    given = ['Load one crate so the barge clears the bridge AND the rock.', 'Too light → mast hits the bridge. Too heavy → hull hits the rock.'];
    const q = partsQ(ans, rnd, { step: blk ? 1 : step, unit, text, min: 0, max: blk ? 20 : 200, spread: 0.4 });
    return { t, W, D, rho, mb, d, blk, given, mathGiven, q };
  },
  goal: () => 'Load it so the barge clears the bridge AND the rock.',
  hints: () => ['Try a medium crate first, then adjust.', 'Mast clipped the bridge? Add weight.', 'Hull scraped the rock? Use a lighter crate.'],
  mathHints: v => ['Sink depth grows with total mass.', `Total mass = water density × ${v.W} × ${v.D} × draft.`, `Total = ${v.rho}×${v.W}×${v.D}×${r2(v.d, 4)} = ${r2(v.rho * v.W * v.D * v.d, 1)} kg; minus barge ${v.mb} kg.`],
  diagnose(v, a) { const tot = v.rho * v.W * v.D * v.d; if (!v.blk && near(a, tot, 0.03)) return 'You found the TOTAL. Subtract the empty barge.'; return null; },
  observe: () => 'The barge sank until the water it pushed aside weighed as much as barge + cargo.',
  predict: () => ({ text: 'If you add cargo, the barge will sit…', options: ['Higher', 'Lower', 'The same'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 1.9, y: 3.2, unit: v.blk ? 'stones' : 'kg', icon: 'crate', key: 'cargo', r: 1.8 }),
  build(sim, v, a, placed) {
    floor(sim);
    const y0 = 0.5, lvl = 2.5;
    const tank = sim.tank(0.2, 11.8, y0, lvl, { D: v.D, rho: v.rho, top: 3.0, label: 'canal', drag: 1.0 });
    const has = [...placed].some(k => k.startsWith('cargo'));
    const mass = v.mb + (has ? (v.blk ? a * v.blk : a) : 0);
    const d = mass / (v.rho * v.W * v.D);
    const hullH = 0.85, mastTop = 2.1;
    const b = sim.box(1.9, lvl - d + hullH / 2, v.W, hullH, { mass, kind: 'barge', float: true, fixedRotation: true, friction: 0.3 });
    sim.addBoxFixture(b, 0.1, hullH / 2 + (mastTop - hullH) / 2, 0.1, mastTop - hullH, { mass: 1e-4, kind: 'mast', noBuoy: true });
    tank.Aw -= v.W * Math.min(d, 0.85);
    b.getUserData().cargo = has ? (v.blk ? `${a} stones` : `${a} kg`) : '';
    const dt = v.d;
    const yBr = lvl - (dt - 0.025) + mastTop - hullH / 2 + hullH / 2;
    sim.box(5.2, yBr + 0.25, 1.2, 0.5, { static: true, kind: 'bridge' });
    sim.decor.push({ type: 'pillar', x: 5.2, y0: yBr + 0.5, y1: 8.9 });
    const yRock = lvl - (dt + 0.025);
    sim.poly(8.3, y0, [[-1.0, 0], [1.0, 0], [0.4, yRock - y0], [-0.4, yRock - y0]], { static: true, kind: 'rock' });
    sim.decor.push({ type: 'dock', x: 10.6, y: lvl });
    sim.decor.push({ type: 'marker', x0: 0.9, x1: 3.0, y: lvl, label: '', faint: true });
    sim.forces.push(s => { if (s.t < 0.3) return; const vx = b.getLinearVelocity().x; b.applyForceToCenter({ x: 4.0 * b.getMass() * (1.4 - vx), y: 0 }, true); });
    let stuck = 0;
    return () => {
      if (!has) return null;
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
  quote: 'Make the weight equal the water pushed aside, and it will hang like a cloud.', skills: ['placement', 'buoyancy'],
  concept: { line: 'Hang the right ballast so the diving bell floats on the hover line.', formula: 'total mass = ρ_water × volume' },
  gen(t, rnd) {
    let V, m0, rho = 1, mathGiven, lead = 0, step = 1;
    if (t === 0) { V = pick(rnd, [80, 90, 100, 120]); m0 = pick(rnd, [40, 45, 50]); mathGiven = [`Bell displaces ${V} L`, `Bell weighs ${m0} kg`, `Water: 1 kg per litre`]; }
    else if (t === 1) { const r = pick(rnd, [0.3, 0.25]), h = pick(rnd, [0.4, 0.5]); V = Math.PI * r * r * h * 1000; m0 = pick(rnd, [30, 35, 40]); mathGiven = [`Bell: cylinder r=${r} m, h=${h} m`, `Bell weighs ${m0} kg`, `V = π r² h · 1 m³ = 1000 L`]; step = 0.1; }
    else if (t === 2) { rho = 1.025; V = pick(rnd, [90, 110, 120]); m0 = pick(rnd, [40, 50]); mathGiven = [`Bell displaces ${V} L`, `Bell weighs ${m0} kg`, `Sea water: 1.025 kg per litre`]; step = 0.1; }
    else { lead = 11.3; V = pick(rnd, [100, 120]); m0 = pick(rnd, [45, 55]); mathGiven = [`Bell displaces ${V} L · weighs ${m0} kg`, `Ballast is lead: 11.3 kg/L`, `(The lead displaces water too!)`]; step = 0.1; }
    const ans = lead ? (V - m0) / (1 - 1 / lead) : rho * V - m0;
    const given = ['Hang one ballast weight so the bell sits on the hover line.', 'Too light → floats up. Too heavy → sinks.'];
    return { t, V, m0, rho, lead, given, mathGiven, q: partsQ(ans, rnd, { step, unit: 'kg', text: 'Pick ballast', min: 1, max: 300, spread: 0.35 }) };
  },
  goal: () => 'Add ballast so the bell hovers on the line.',
  hints: () => ['Start with a middle-weight piece.', 'If it floats up, grab a heavier one.', 'If it sinks, try a lighter ballast.'],
  mathHints: v => ['Hover: total mass = mass of water displaced.', v.lead ? 'Lead adds volume: ρ(V + m/11.3) = m0 + m.' : `Water displaced weighs ${r2(v.rho * v.V, 2)} kg.`, `Ballast = ${v.q.ans} kg.`],
  diagnose(v, a) { if (near(a, v.rho * v.V, 0.03)) return 'That is the total. The bell already weighs some of it.'; return null; },
  observe: () => 'Weight matched the water pushed aside — so it hung like a cloud.',
  predict: () => ({ text: 'Add ballast and the bell will…', options: ['Rise', 'Sink (or hover if just right)', 'Spin'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 6, y: 3.6, key: 'ballast', r: 1.5 }),
  build(sim, v, a, placed) {
    floor(sim);
    const tank = sim.tank(2.8, 9.2, 0.5, 7.6, { D: 0.1, top: 8.2, drag: 3 });
    const y0 = 4.6;
    const has = [...placed].some(k => k.startsWith('ballast'));
    const extra = has ? a : 0;
    const Vtot = v.V + (v.lead ? extra / v.lead : 0);
    const b = sim.box(6, y0, 1.0, 1.0, { mass: v.m0 + extra, kind: 'divingbell', float: true, fixedRotation: true });
    b.getUserData().volScale = Vtot / 100;
    b.getUserData().ballast = extra ? `${extra} kg` : '';
    tank.rho = v.rho * 1000;
    sim.decor.push({ type: 'marker', x0: 3.2, x1: 4.9, y: y0, label: 'hover line' });
    sim.decor.push({ type: 'band', x0: 3.0, x1: 9.0, y0: y0 - 0.2, y1: y0 + 0.2 });
    if (!has) return () => null;
    return hoverJudge(sim, b, y0, { win: 0.2, hold: 4.5, up: 'It floated up: too light.', down: 'It sank: too heavy.' });
  },
  maxT: 6,
};

// ---------- II. Liber Vectis ----------
function beamWorld(sim, o) {
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
  quote: 'Unequal weights balance at distances in inverse proportion.', skills: ['placement', 'levers'],
  concept: { line: 'Slide your weight along the beam until both sides hang level.', formula: 'm₁·d₁ = m₂·d₂' },
  gen(t, rnd) {
    let L = [], m2, mathGiven;
    if (t === 0) { const c = pick(rnd, [[6, 2, 4], [6, 2, 3], [8, 1.5, 4], [9, 2, 6], [4, 3, 6]]); L = [{ m: c[0], d: c[1] }]; m2 = c[2]; }
    else if (t === 1) { const c = pick(rnd, [[5, 1.8, 4], [7, 1.2, 3], [3, 2.6, 2], [9, 1.4, 6]]); L = [{ m: c[0], d: c[1] }]; m2 = c[2]; }
    else if (t === 2) { const c = pick(rnd, [[4, 1, 3, 2.5, 5], [2, 3, 6, 1, 4], [5, 1.5, 3, 3, 8]]); L = [{ m: c[0], d: c[1] }, { m: c[2], d: c[3] }]; m2 = c[4]; }
    else { const c = pick(rnd, [[6, 3, 4, 1.5, 5], [8, 2.5, 5, 2, 4], [9, 2, 2, 3, 6]]); L = [{ m: c[0], d: c[1] }, { m: c[2], d: -c[3] }]; m2 = c[4]; }
    const left = L.filter(l => l.d > 0), right = L.filter(l => l.d < 0);
    const ans = (left.reduce((s, l) => s + l.m * l.d, 0) - right.reduce((s, l) => s + l.m * -l.d, 0)) / m2;
    mathGiven = [...left.map(l => `Left: ${l.m} kg at ${l.d} m`), ...right.map(l => `Right: ${l.m} kg at ${-l.d} m`), `Your weight: ${m2} kg`];
    const given = [`Hang the ${m2} kg weight on the right rail.`, 'Slide until the beam stays level.'];
    return { t, L, m2, given, mathGiven, q: { kind: 'place', text: 'Slide your weight', unit: 'm', step: 0.05, ans: r2(ans, 2), min: 0.1, max: 3.9 } };
  },
  goal: v => `Hang the ${v.m2} kg weight so the beam stays level.`,
  hints: () => ['Heavier side needs a shorter arm — slide outward or inward.', 'If it tips left, move your weight farther out.', 'If it tips right, slide closer to the pivot.'],
  mathHints: v => ['Balance when left turning = right turning.', 'Turning = kg × metres.', `d = ${v.q.ans} m`],
  diagnose(v, a) { const L0 = v.L[0]; if (v.L.length === 1 && near(a, L0.d * v.m2 / L0.m, 0.03)) return 'Flipped! Heavier weight goes CLOSER to the pivot.'; return null; },
  observe: () => 'A heavier weight closer in matched a lighter one farther out.',
  predict: () => ({ text: 'Move your weight farther from the pivot and that side will…', options: ['Pull harder', 'Pull softer', 'Do nothing'], ans: 0 }),
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
  quote: 'Give me a place to stand, and I will move the Earth.', skills: ['placement', 'levers'],
  concept: { line: 'Hang a counterweight on the long arm so the stone stays level.', formula: 'M·d₁ = m·d₂' },
  gen(t, rnd) {
    let M, d1, d2, mb = 0.0001, x1 = 10.6, mathGiven, step = 0.5;
    if (t === 0) { const c = pick(rnd, [[60, 1.2, 6], [90, 1.0, 6], [75, 1.2, 4.5], [80, 1.2, 6]]); [M, d1, d2] = c; mathGiven = [`Stone: ${M} kg, ${d1} m left of pivot`, `Counterweight: ${d2} m right`]; }
    else if (t === 1) { const c = pick(rnd, [[64, 1.3, 5.2], [95, 1.1, 5.5], [72, 1.25, 6]]); [M, d1, d2] = c; mathGiven = [`Stone: ${M} kg at ${d1} m`, `Counterweight at ${d2} m`]; step = 0.1; }
    else if (t === 2) { const c = pick(rnd, [[80, 1.2, 6, 4], [100, 1.1, 6, 6], [90, 1.3, 6, 5]]); [M, d1, d2, mb] = c; x1 = 4 + d2; mathGiven = [`Stone: ${M} kg at ${d1} m`, `Counterweight at ${d2} m`, `Beam: ${mb} kg`]; step = 0.01; }
    else { const c = pick(rnd, [[30, 1.2, 6, 4], [35, 1.0, 6, 5], [25, 1.3, 6, 6]]); let V; [V, d1, d2, mb] = c; M = V * 2.7; x1 = 4 + d2; mathGiven = [`Granite stone: ${V} L at ${d1} m`, `Counterweight at ${d2} m`, `Beam: ${mb} kg`]; step = 0.01; }
    const off = (2.6 + x1) / 2 - 4;
    const ans = (M * d1 - mb * off) / d2;
    const given = ['Hang a counterweight on the long arm.', 'Pick the piece that holds the stone level.'];
    return { t, M, d1, d2, mb, x1, off, given, mathGiven, q: partsQ(ans, rnd, { step, unit: 'kg', text: 'Pick counterweight', min: 0.5, max: 200, spread: 0.4 }) };
  },
  goal: () => 'Pick the counterweight that holds the stone level.',
  hints: () => ['The long arm needs less weight than the stone.', 'Stone side drops? Try a heavier piece.', 'Your side drops? Try a lighter piece.'],
  mathHints: v => ['Turning force = kg × distance.', `m = ${v.q.ans} kg`],
  diagnose(v, a) { if (near(a, v.M * v.d2 / v.d1, 0.03)) return 'Flipped ratio: the long arm needs LESS weight.'; return null; },
  observe: () => 'A small weight far out held a huge stone close in.',
  predict: () => ({ text: 'A longer arm means you need…', options: ['More weight', 'Less weight', 'The same'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 4 + v.d2, y: 3.6, key: 'cw', r: 1.6 }),
  build(sim, v, a, placed) {
    const has = [...placed].some(k => k.startsWith('cw'));
    const loads = [{ x: 4 - v.d1, m: v.M, label: `${r2(v.M, 1)} kg`, kind: 'stone' }];
    if (has) loads.push({ x: 4 + v.d2, m: a, label: `${a} kg`, kind: 'myweight' });
    const beam = beamWorld(sim, { px: 4, py: 2.4, x0: 2.6, x1: v.x1, mass: v.mb, loads });
    if (!has) return () => null;
    return balanceJudge(sim, beam, { ccw: 'The stone side dropped: add counterweight.', cw: 'Your side dropped: too much counterweight.' });
  },
  maxT: 5,
};

const moments = {
  id: 'moments', ch: 1, title: "Leonardo's Steelyard", who: 'Leonardo da Vinci', img: 'leonardo_flywheel',
  quote: 'Mechanics is the paradise of the mathematical sciences.', skills: ['placement', 'levers'],
  concept: { line: 'Hang the right hook weight so Leonardo\'s steelyard sits level.', formula: 'Σ(m·d) left = Σ(m·d) right' },
  gen(t, rnd) {
    let L, R, dx, mathGiven;
    if (t === 0) { const c = pick(rnd, [[[3, 2], [2, 1], 3, 2], [[4, 2], [2, 3], 4, 3], [[5, 1], [3, 2], 2, 2.75]]); L = [{ m: c[0][0], d: c[0][1] }, { m: c[1][0], d: c[1][1] }]; R = []; dx = c[3]; }
    else if (t === 1) { const c = pick(rnd, [[[2.5, 3], [4, 1.5], 3.2], [[3.5, 2.4], [1.5, 3.6], 2.8]]); L = [{ m: c[0][0], d: c[0][1] }, { m: c[1][0], d: c[1][1] }]; R = []; dx = c[2]; }
    else if (t === 2) { const c = pick(rnd, [[[2, 3.5], [3, 2], [4, 1]], [[1.5, 3.8], [2.5, 2.2], [5, 0.8]]]); L = c.map(x => ({ m: x[0], d: x[1] })); R = []; dx = 3.4; }
    else { const c = pick(rnd, [[[3, 3], [4, 2], [2, 1.5], 3.5], [[5, 2.5], [2, 3.5], [3, 1], 3.0]]); L = [{ m: c[0][0], d: c[0][1] }, { m: c[1][0], d: c[1][1] }]; R = [{ m: c[2][0], d: c[2][1] }]; dx = c[3]; }
    const ans = (L.reduce((s, l) => s + l.m * l.d, 0) - R.reduce((s, l) => s + l.m * l.d, 0)) / dx;
    mathGiven = [L.map(l => `${l.m}kg@${l.d}m`).join(' + ') + ' (left)', ...(R.length ? [R.map(l => `${l.m}kg@${l.d}m`).join(' + ') + ' (right)'] : []), `Your hook: ${dx} m right`];
    const given = ['Hang one weight on the hook.', 'Choose the piece that levels the steelyard.'];
    return { t, L, R, dx, given, mathGiven, q: partsQ(ans, rnd, { step: 0.01, unit: 'kg', text: 'Pick hook weight', min: 0.5, max: 60, spread: 0.4 }) };
  },
  goal: () => 'Choose the hook weight that levels the steelyard.',
  hints: () => ['Several small weights on the left add up.', 'Tips left? Heavier hook. Tips right? Lighter hook.', 'Try the middle piece, then nudge.'],
  mathHints: v => [`m = ${v.q.ans} kg`],
  diagnose() { return null; },
  observe: () => 'Every weight × its distance added up the same on both sides.',
  predict: () => ({ text: 'Two weights on the left mean your hook needs to be…', options: ['Heavier than either alone', 'Lighter than either', 'Irrelevant'], ans: 0 }),
  bin: v => weightBin(v.q.choices, { x: 6 + v.dx, y: 3.6, key: 'hook', r: 1.6 }),
  build(sim, v, a, placed) {
    const has = [...placed].some(k => k.startsWith('hook'));
    const loads = [...v.L.map(l => ({ x: 6 - l.d, m: l.m, label: `${l.m}` })), ...v.R.map(l => ({ x: 6 + l.d, m: l.m, label: `${l.m}` }))];
    if (has) loads.push({ x: 6 + v.dx, m: a, label: `${a}`, kind: 'myweight' });
    const beam = beamWorld(sim, { px: 6, py: 2.6, x0: 1.9, x1: 10.1, mass: 2, loads, ticks: { from: 6, step: 0.5, n: 8 } });
    if (!has) return () => null;
    return balanceJudge(sim, beam, { ccw: 'Left side won: your weight is too light.', cw: 'Right side won: your weight is too heavy.' });
  },
  maxT: 5,
};

// ---------- III. Liber Trochleae ----------
function hangWorld(sim, o) {
  floor(sim);
  sim.box(6, 8.15, 9.5, 0.3, { static: true, kind: 'gantry' });
  const load = sim.box(o.xL, o.yL, o.wL || 1.0, o.hL || 0.8, { mass: o.mL, kind: o.kindL || 'load', label: o.labelL });
  const eff = sim.box(o.xE, o.yE, 0.6, 0.6, { mass: o.mE, kind: 'myweight', label: o.labelE });
  const top = 7.7;
  sim.prismatic(load, o.xL, o.yL, 0, 1); sim.prismatic(eff, o.xE, o.yE, 0, 1);
  sim.pulley(load, eff, [o.xL, top], [o.xE, top], [o.xL, o.yL + (o.hL || 0.8) / 2], [o.xE, o.yE + 0.3], o.ratio);
  sim.decor.push({ type: 'tackle', load, eff, xL: o.xL, xE: o.xE, top, n: o.n, n2: o.n2 || 0, hL: o.hL || 0.8 });
  sim.airDamp = 0.8;
  return { load, eff };
}
const wellbucket = {
  id: 'wellbucket', ch: 2, title: 'The Well Bucket', who: 'Hero of Alexandria', img: 'hero_aeolipile',
  quote: 'A fixed wheel changes the direction of a force, not its size.', skills: ['placement', 'pulleys'],
  concept: { line: 'Hang a counterweight that holds the full bucket still over the well.', formula: 'effort = load' },
  gen(t, rnd) {
    let mb, V, rho = 1, mathGiven, step = 0.5;
    if (t === 0) { mb = pick(rnd, [2, 3, 4]); V = pick(rnd, [8, 10, 12, 15]); mathGiven = [`Bucket: ${mb} kg`, `Water inside: ${V} L`]; }
    else if (t === 1) { mb = pick(rnd, [2.5, 3.5]); V = pick(rnd, [12.5, 9.5, 14]); mathGiven = [`Bucket: ${mb} kg`, `Water: ${V} L`]; step = 0.1; }
    else if (t === 2) { mb = pick(rnd, [2, 3]); V = pick(rnd, [12, 14, 16]); rho = 1.025; mathGiven = [`Bucket: ${mb} kg`, `Sea water: ${V} L at 1.025 kg/L`]; step = 0.01; }
    else { mb = pick(rnd, [2.4, 3.1]); const L = pick(rnd, [0.12, 0.15]); V = Math.PI * L * L * 0.25 * 1000; mathGiven = [`Bucket: ${mb} kg`, `Full cylinder of water`]; step = 0.01; }
    const ans = mb + rho * V;
    const given = ['One fixed pulley: hang a weight that holds the bucket still.', 'Bucket rises → too heavy. Falls → too light.'];
    return { t, mb, V, rho, given, mathGiven, q: partsQ(ans, rnd, { step, unit: 'kg', text: 'Pick counterweight', min: 1, max: 100, spread: 0.35 }) };
  },
  goal: () => 'Hang a counterweight that holds the full bucket still.',
  hints: () => ['A single fixed pulley doesn\'t multiply force.', 'Match the bucket\'s feel — try the middle weight.', 'Bucket falling? Heavier. Rising? Lighter.'],
  mathHints: v => [`Counterweight = ${v.q.ans} kg`],
  diagnose(v, a) { if (near(a, v.rho * v.V, 0.02)) return 'Don\'t forget the bucket itself!'; return null; },
  observe: () => 'With one fixed pulley, the counterweight had to match the bucket.',
  predict: () => ({ text: 'A fixed pulley mostly…', options: ['Multiplies force', 'Changes direction', 'Removes weight'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 7.0, y: 4.5, key: 'cw', r: 1.6 }),
  build(sim, v, a, placed) {
    floor(sim);
    const top = 7.4, xL = 5.0, xE = 7.0;
    sim.box(6, 8.0, 3, 0.25, { static: true, kind: 'gantry' });
    sim.decor.push({ type: 'wheel', x: 6, y: top, r: 1.0 });
    const load = sim.box(xL, 4.0, 0.9, 0.9, { mass: v.mb + v.rho * v.V, kind: 'bucket' });
    sim.decor.push({ type: 'well', x: xL, y: 0.3 });
    const has = [...placed].some(k => k.startsWith('cw'));
    if (!has) { sim.decor.push({ type: 'rope', pts: () => [[xL, top], [xL, load.getPosition().y + 0.45]] }); return () => null; }
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
  quote: 'Many ropes share the load; each one carries only its part.', skills: ['placement', 'pulleys'],
  concept: { line: 'Hang an effort weight (or choose a tackle) so the marble block holds still.', formula: 'effort = load ÷ n' },
  gen(t, rnd) {
    let M, n, n2 = 0, mathGiven, text = 'Pick effort weight', unit = 'kg', step = 0.5, ans, mode = 'weight';
    if (t === 0) { n = pick(rnd, [2, 3, 4]); M = n * pick(rnd, [10, 12, 15]); mathGiven = [`Marble block: ${M} kg`, `Ropes: ${n}`]; ans = M / n; }
    else if (t === 1) { n = pick(rnd, [4, 5, 6]); M = pick(rnd, [90, 130, 155]); mathGiven = [`Marble block: ${M} kg`, `Count the ropes!`]; ans = M / n; step = 0.01; }
    else if (t === 2) { n = pick(rnd, [3, 4, 6]); const e = pick(rnd, [20, 25, 30]); M = n * e; mathGiven = [`Marble: ${M} kg`, `Effort: ${e} kg`]; text = 'Pick a tackle (ropes)'; unit = 'ropes'; step = 1; ans = n; mode = 'ropes'; }
    else { n = pick(rnd, [2, 3]); n2 = pick(rnd, [3, 4]); M = n * n2 * pick(rnd, [10, 12.5, 15]); mathGiven = [`Cargo: ${M} kg`, `Two hoists: ${n} × ${n2}`]; ans = M / (n * n2); step = 0.1; }
    const given = mode === 'ropes'
      ? [`Your effort weight is fixed. Pick a block-and-tackle with enough ropes.`, 'More ropes → easier hold.']
      : ['Hang an effort weight that holds the block still.', 'More ropes on the moving block → less effort needed.'];
    const e = mode === 'ropes' ? M / n : null;
    return { t, M, n, n2, e, mode, given, mathGiven, q: partsQ(ans, rnd, { step, unit, text, min: mode === 'ropes' ? 1 : 1, max: mode === 'ropes' ? 8 : 200, spread: 0.4 }) };
  },
  goal: v => v.mode === 'ropes' ? 'Choose a tackle so your weight holds the block.' : 'Hang the effort weight that holds the block still.',
  hints: () => ['Count the ropes on the moving block — they share the load.', 'Block drops? More effort (or more ropes).', 'Block rises? Less effort (or fewer ropes).'],
  mathHints: v => [`Answer: ${v.q.ans}`],
  diagnose(v, a) { if (v.mode !== 'ropes' && near(a, v.M * (v.n2 ? v.n * v.n2 : v.n), 0.02)) return 'Pulleys make effort SMALLER, not bigger.'; return null; },
  observe: () => 'Many ropes shared the load — each carried only its part.',
  predict: () => ({ text: 'Adding more ropes to the moving block makes holding…', options: ['Harder', 'Easier', 'No change'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 9.0, y: 4.6, unit: v.q.unit, icon: 'weight', key: 'eff', r: 1.6 }),
  build(sim, v, a, placed) {
    const has = [...placed].some(k => k.startsWith('eff'));
    const n = v.mode === 'ropes' ? Math.max(1, Math.round(a)) : v.n, MA = v.n2 ? v.n * v.n2 : n;
    const mE = v.mode === 'ropes' ? v.e : a;
    if (!has) { floor(sim); sim.box(6, 8.15, 9.5, 0.3, { static: true, kind: 'gantry' }); const load = sim.box(4, 3.0, 1.4, 0.9, { static: true, kind: 'marble', label: `${v.M} kg` }); sim.decor.push({ type: 'tackle', load, eff: null, xL: 4, xE: 9, top: 7.7, n, n2: v.n2, hL: 0.9 }); return () => null; }
    const w = hangWorld(sim, { xL: 4, yL: 3.0, mL: v.M, wL: 1.4, hL: 0.9, kindL: 'marble', labelL: `${v.M} kg`, xE: 9, yE: 4.6, mE, labelE: `${mE}`, ratio: 1 / MA, n, n2: v.n2 });
    return hoverJudge(sim, w.load, 3.0, { win: 0.1, hold: 5, up: 'Block rose: too much effort (or too many ropes).', down: 'Block dropped: not enough effort.' });
  },
  maxT: 6.5,
};

const crane = {
  id: 'crane', ch: 2, title: "Taccola's Crane: Work", who: 'Mariano Taccola', img: 'agricola_mining',
  quote: 'What you gain in force, you pay back in distance.', skills: ['placement', 'pulleys'],
  concept: { line: 'Slide the floor stop so the block lands exactly on the ledge.', formula: 'effort distance = n × load height' },
  gen(t, rnd) {
    let n, h, mathGiven;
    if (t === 0) { n = pick(rnd, [2, 3]); h = pick(rnd, [0.5, 0.6, 0.8]); }
    else if (t === 1) { n = pick(rnd, [3, 4]); h = pick(rnd, [0.45, 0.55, 0.65]); }
    else if (t === 2) { n = pick(rnd, [4, 5]); h = pick(rnd, [0.62, 0.74, 0.5]); }
    else { n = pick(rnd, [5, 6]); h = pick(rnd, [0.55, 0.6]); }
    mathGiven = [`Ropes: ${n}`, `Lift ${h} m to the ledge`];
    const given = ['The effort weight will drop and raise the block.', 'Slide the floor stop so the block stops at the ledge.'];
    return { t, n, h, M: 40, given, mathGiven, q: { kind: 'place', text: 'Slide the floor stop', unit: 'm', step: 0.05, ans: r2(n * h, 2), min: 0.2, max: 4.5 } };
  },
  goal: () => 'Set the floor stop so the block stops exactly at the ledge.',
  hints: () => ['More ropes → the effort must travel farther.', 'Block overshoots? Raise the stop.', 'Block stops short? Lower the stop.'],
  mathHints: v => [`Drop = ${v.n} × ${v.h} = ${v.q.ans} m`],
  diagnose(v, a) { if (near(a, v.h / v.n, 0.05)) return 'Flipped: the light effort must move FARTHER.'; return null; },
  observe: () => 'What you gained in force, you paid back in distance.',
  predict: () => ({ text: 'With more ropes, the effort weight must drop…', options: ['A shorter way', 'A longer way', 'The same'], ans: 1 }),
  bin: () => [{ key: 'stop', label: 'Floor stop', icon: 'stop', req: true, rail: { axis: 'y', x: 9.0, y0: 1.6, y1: 5.9, toAns: y => r2(Math.round((6.2 - 0.3 - y) / 0.05) * 0.05, 2), fromAns: a => 6.2 - 0.3 - a } }],
  build(sim, v, a, placed) {
    const mE = v.M / v.n * 1.12;
    const w = hangWorld(sim, { xL: 3.8, yL: 3.0, mL: v.M, wL: 1.2, hL: 0.8, kindL: 'marble', labelL: `${v.M} kg`, xE: 9, yE: 6.2, mE, labelE: `${r2(mE, 1)}`, ratio: 1 / v.n, n: v.n });
    sim.airDamp = 0;
    const ledgeY = 3.0 + 0.4 + v.h;
    sim.decor.push({ type: 'ledge', x: 3.8, y: ledgeY, w: 2.4 });
    sim.decor.push({ type: 'marker', x0: 2.2, x1: 5.4, y: ledgeY, label: 'ledge', faint: true });
    if (placed.has('stop')) { const yTop = 6.2 - 0.3 - a; sim.box(9, yTop - 0.15, 0.9, 0.3, { static: true, kind: 'stopblock' }); }
    else sim.state.noRun = true;
    let still = 0;
    return () => {
      const vL = w.load.getLinearVelocity().y, top = w.load.getPosition().y + 0.4;
      if (top > ledgeY + 0.08) return { win: false, dir: 'high', msg: 'The block overshot the ledge: the stop is too low.' };
      if (sim.t > 0.5 && Math.abs(vL) < 0.01) still += 1 / 60; else still = 0;
      if (still > 0.4) return Math.abs(top - ledgeY) <= 0.06 ? { win: true, msg: 'Stopped right at the ledge!' } : { win: false, dir: 'low', msg: 'The block stopped short: the stop is too high.' };
      return null;
    };
  },
  maxT: 8,
};

export const CH_A = [eureka, barge, bell, balance, liftstone, moments, wellbucket, tackle, crane];
