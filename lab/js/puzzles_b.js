// Chapters IV-VII: gears, Galileo, balloons, rates — widget mode.
import { G, RHO_W, pl } from './sim.js';
import { pick, r2, floor, hoverJudge, choicesAround } from './puzzles_a.js';

// re-export helper inline (partsQ was not exported — redefine locally)
function partsQ(ans, rnd, o = {}) {
  const dec = (o.step && o.step < 1) ? (o.step >= 0.1 ? 1 : 2) : 0;
  const ansR = r2(ans, dec);
  const ch = choicesAround(ansR, rnd, o);
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
    key: `${key}${i}`, label: `${v}${unit ? ' ' + unit : ''}`,
    icon, value: v, group: key, req: false, snap: { x, y, r: o.r ?? 1.8 },
  }));
}
const near = (a, b, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel + 1e-9;
const MOD = 0.025;
const RPM = x => x * 2 * Math.PI / 60;
const gearBin = (choices, x, y) => choices.map(N => ({ key: 'g' + N, label: `${N} teeth`, icon: 'gear', teeth: N, value: N, group: 'gear', req: false, snap: { x, y, r: 2.2 } }));
function gearSet(rnd, ans, pool = [12, 16, 18, 20, 24, 30, 36, 40, 48]) { const s = new Set([ans]); while (s.size < 5) s.add(pick(rnd, pool)); return [...s].sort((a, b) => a - b); }
function gearBody(sim, x, y, N, o = {}) {
  const r = MOD * N;
  const b = sim.circle(x, y, r, { mass: o.mass ?? 2 * r * r + 0.2, kind: 'gear', mask: 0, cat: 0 });
  Object.assign(b.getUserData(), { teeth: N, r, style: o.style || {}, drum: o.drum || 0, extra: o.extra || null });
  const j = sim.revolute(b, x, y, o.motor ? { motorSpeed: o.motor, maxTorque: 1e6 } : {});
  return { b, j, r };
}
function speedJudge(sim, body, target) {
  let acc = 0, n = 0;
  return () => {
    if (sim.t < 0.8) return null;
    acc += Math.abs(body.getAngularVelocity()); n++;
    if (sim.t >= 2.8) {
      const w = acc / n, rpm = w * 60 / (2 * Math.PI), tr = Math.abs(target) * 60 / (2 * Math.PI);
      sim.state.measured = rpm;
      if (Math.abs(rpm - tr) <= tr * 0.02) return { win: true, msg: 'Exactly on speed!' };
      return rpm > tr ? { win: false, dir: 'fast', msg: 'Too fast. Try a bigger gear.' } : { win: false, dir: 'slow', msg: 'Too slow. Try a smaller gear.' };
    }
    return null;
  };
}

// ---------- IV. Liber Rotarum ----------
const millgear = {
  id: 'millgear', ch: 3, title: 'The Mill Wheel', who: 'Leonardo da Vinci', img: 'leonardo_gears',
  quote: 'The wheel with more teeth turns more slowly.', skills: ['gears', 'placement'],
  concept: { line: 'Fit a gear on the millstone so it turns at the right speed.', formula: 'N₁ · ω₁ = N₂ · ω₂' },
  gen(t, rnd) {
    let N1, w1, w2, mathGiven, N2;
    if (t === 0) { [N1, w1, N2] = pick(rnd, [[12, 60, 24], [12, 60, 36], [16, 60, 24], [12, 40, 24]]); w2 = N1 * w1 / N2; mathGiven = [`Water wheel: ${N1} teeth at ${w1} rpm`, `Stone: ${r2(w2, 2)} rpm`]; }
    else if (t === 1) { [N1, w1, N2] = pick(rnd, [[18, 40, 24], [20, 45, 30], [15, 48, 36], [18, 50, 30]]); w2 = N1 * w1 / N2; mathGiven = [`Driver: ${N1} at ${w1} rpm`, `Stone: ${r2(w2, 2)} rpm`]; }
    else if (t === 2) { const k = pick(rnd, [3, 2.5, 2, 1.5]); N1 = k === 2.5 ? 16 : 12 + (k === 1.5 ? 4 : 0); N2 = N1 * k; w1 = 60; w2 = w1 / k; mathGiven = [`Driver: ${N1} teeth`, `${k}× slower stone`]; }
    else { const c = pick(rnd, [[16, 2, 5, 40], [12, 1, 3, 36], [20, 1.5, 3, 40]]); N1 = c[0]; w1 = 60 / c[1]; w2 = 60 / c[2]; N2 = c[3]; mathGiven = [`Driver ${N1} teeth`, `Timing marks on the stone`]; }
    const choices = gearSet(rnd, N2);
    const given = ['Fit one gear from the bin onto the empty axle.', 'Bigger gear → slower stone. Match the water wheel\'s pace.'];
    return { t, N1, w1, w2, given, mathGiven, choices, q: { kind: 'gear', text: 'Fit a gear', unit: 'teeth', step: 1, ans: N2, choices, wrong: choices.filter(c => c !== N2) } };
  },
  goal: () => 'Fit the gear that spins the millstone at the right speed.',
  hints: () => ['More teeth means slower turning.', 'Listen to the water wheel — match its rhythm.', 'Too fast? Bigger gear. Too slow? Smaller.'],
  mathHints: v => [`N₂ = ${v.q.ans} teeth`],
  diagnose(v, a) { if (near(a, v.N1 * v.w2 / v.w1, 0.05)) return 'Flipped: to go SLOWER, need MORE teeth.'; return null; },
  observe: () => 'The wheel with more teeth turned more slowly.',
  predict: () => ({ text: 'A gear with more teeth will turn…', options: ['Faster', 'Slower', 'The same'], ans: 1 }),
  bin: v => gearBin(v.choices, 3.2 + MOD * (v.N1 + 30), 4.6),
  build(sim, v, a, placed) {
    floor(sim);
    const x1 = 3.0, y = 4.6;
    const g1 = gearBody(sim, x1, y, v.N1, { motor: RPM(v.w1), extra: 'waterwheel' });
    sim.decor.push({ type: 'waterwheel', body: g1.b, x: x1, y, r: 1.6 });
    if (!a) return () => null;
    const x2 = x1 + MOD * (v.N1 + a);
    const g2 = gearBody(sim, x2, y, a, { extra: 'millstone' });
    sim.gear(sim.ground, g2.b, g1.j, g2.j, a / v.N1);
    g2.b.setAngle(Math.PI / a);
    return speedJudge(sim, g2.b, RPM(v.w2));
  },
  maxT: 3.2,
};

const windlass = {
  id: 'windlass', ch: 3, title: "Leonardo's Windlass", who: 'Leonardo da Vinci', img: 'leonardo_flywheel',
  quote: 'Force is multiplied as the wheel is greater than the axle.', skills: ['gears', 'placement'],
  concept: { line: 'Hang an effort weight that holds the load still through the gear train.', formula: 'm = M · (r₂ ÷ r₁) · (N₁ ÷ N₂)' },
  gen(t, rnd) {
    let N1, N2, r1, r2_, M, mathGiven;
    if (t === 0) { [N1, N2, M] = pick(rnd, [[12, 36, 60], [12, 24, 50], [16, 48, 75]]); r1 = r2_ = 0.3; mathGiven = [`Load: ${M} kg`, `Gears ${N1} → ${N2}`]; }
    else if (t === 1) { [N1, N2, r1, r2_, M] = pick(rnd, [[12, 24, 0.4, 0.2, 90], [12, 36, 0.3, 0.2, 81], [16, 40, 0.4, 0.25, 64]]); mathGiven = [`Load ${M} kg`, `Drums ${r1} / ${r2_} m`, `Gears ${N1}→${N2}`]; }
    else if (t === 2) { [N1, N2, r1, r2_, M] = pick(rnd, [[12, 30, 0.35, 0.25, 70], [16, 36, 0.4, 0.3, 66]]); mathGiven = [`Load ${M} kg`, `Drum diameters differ`, `Gears ${N1}→${N2}`]; }
    else { [N1, N2, r1, r2_, M] = pick(rnd, [[12, 40, 0.3, 0.2, 120], [16, 48, 0.4, 0.25, 96]]); mathGiven = [`Bell ${M} kg`, `Gears ${N1}→${N2}`]; }
    const ans = M * (r2_ / r1) * (N1 / N2);
    const given = ['Hang an effort weight on the small drum.', 'Gears multiply your pull — try lighter pieces first.'];
    return { t, N1, N2, r1, r2: r2_, M, given, mathGiven, q: partsQ(ans, rnd, { step: 0.01, unit: 'kg', text: 'Pick effort', min: 1, max: 200, spread: 0.4 }) };
  },
  goal: () => 'Hang the effort weight that holds the load still.',
  hints: () => ['The big gear multiplies your pull.', 'Load falls? Heavier effort. Rises? Lighter.', 'Start light — the gears help a lot.'],
  mathHints: v => [`m = ${v.q.ans} kg`],
  diagnose() { return null; },
  observe: () => 'Force grew as the wheel grew greater than the axle.',
  predict: () => ({ text: 'A bigger driven gear means you need…', options: ['More effort', 'Less effort', 'The same'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 3.4 - v.r1, y: 3.6, key: 'eff', r: 1.6 }),
  build(sim, v, a, placed) {
    floor(sim);
    const x1 = 3.4, y = 6.2, x2 = x1 + MOD * (v.N1 + v.N2);
    const g1 = gearBody(sim, x1, y, v.N1, { drum: v.r1 }), g2 = gearBody(sim, x2, y, v.N2, { drum: v.r2 });
    g2.b.setAngle(Math.PI / v.N2);
    sim.gear(g1.b, g2.b, g1.j, g2.j, v.N2 / v.N1);
    const yL = 2.8, load = sim.box(x2 - v.r2, yL, 0.9, 0.8, { mass: v.M, kind: 'bellload', label: `${v.M} kg` });
    const pL = sim.prismatic(load, x2 - v.r2, yL, 0, 1);
    sim.gear(g2.b, load, g2.j, pL, 1 / v.r2);
    sim.decor.push({ type: 'rope', pts: () => [[x2 - v.r2, y], [x2 - v.r2, load.getPosition().y + 0.4]] });
    sim.box(x1 + (x2 - x1) / 2, 7.9, x2 - x1 + 2.4, 0.25, { static: true, kind: 'gantry' });
    const has = [...placed].some(k => k.startsWith('eff'));
    if (!has) { load.setType('static'); return () => null; }
    const yE = 3.6, eff = sim.box(x1 - v.r1, yE, 0.6, 0.6, { mass: a, kind: 'myweight', label: `${a}` });
    const pE = sim.prismatic(eff, x1 - v.r1, yE, 0, 1);
    sim.gear(g1.b, eff, g1.j, pE, 1 / v.r1);
    sim.decor.push({ type: 'rope', pts: () => [[x1 - v.r1, y], [x1 - v.r1, eff.getPosition().y + 0.3]] });
    sim.airDamp = 0.8;
    return hoverJudge(sim, load, yL, { win: 0.1, hold: 4.5, up: 'Load rose: effort too heavy.', down: 'Load fell: effort too light.' });
  },
  maxT: 6,
};

const clocktrain = {
  id: 'clocktrain', ch: 3, title: 'The Clockwork Train', who: 'Giovanni de Dondi', img: 'huygens_clock',
  quote: 'Gear upon gear, the hours are made from seconds.', skills: ['gears', 'placement'],
  concept: { line: 'Pick the last gear so the clock hand turns at the right pace.', formula: 'ω_out = ω_in · (N₁/N₂) · (N₃/N₄)' },
  gen(t, rnd) {
    const c = t === 0 ? pick(rnd, [[12, 36, 12, 36, 36], [12, 24, 12, 36, 24]]) : t === 1 ? pick(rnd, [[10, 40, 12, 36, 60], [12, 48, 12, 30, 40]]) : t === 2 ? pick(rnd, [[12, 48, 10, 40, 24], [16, 40, 12, 48, 30]]) : pick(rnd, [[12, 36, 10, 40, 72], [10, 30, 12, 48, 60]]);
    const [N1, N2, N3, N4, w1] = c; const w4 = w1 * N1 / N2 * N3 / N4;
    const mathGiven = [`Drive ${N1}→${N2}`, `Then ${N3}→?`, `Hand ${r2(w4, 3)} rpm`];
    const choices = gearSet(rnd, N4, [24, 30, 36, 40, 48]);
    const given = ['Fit the last gear onto the hand axle.', 'Watch the ticking marks — match their speed.'];
    return { t, N1, N2, N3, w1, w4, given, mathGiven, choices, q: { kind: 'gear', text: 'Fit the hand gear', unit: 'teeth', step: 1, ans: N4, choices, wrong: choices.filter(x => x !== N4) } };
  },
  goal: () => 'Pick the last gear so the hand turns at clock speed.',
  hints: () => ['Each pair of gears divides the speed again.', 'Hand too fast? Bigger last gear.', 'Hand too slow? Smaller last gear.'],
  mathHints: v => [`N₄ = ${v.q.ans}`],
  diagnose() { return null; },
  observe: () => 'Gear upon gear, the hours were made from seconds.',
  predict: () => ({ text: 'Adding another gear pair usually makes the hand…', options: ['Faster', 'Slower', 'Reverse only'], ans: 1 }),
  bin: v => gearBin(v.choices, 2.6 + MOD * (v.N1 + v.N2) + 0.9, 3.5),
  build(sim, v, a, placed) {
    floor(sim);
    const y = 5.6, x1 = 2.6, x2 = x1 + MOD * (v.N1 + v.N2);
    const g1 = gearBody(sim, x1, y, v.N1, { motor: RPM(v.w1) });
    const g2 = gearBody(sim, x2, y, v.N2, { extra: 'compound', style: { inner: v.N3 } });
    g2.b.setAngle(Math.PI / v.N2);
    sim.gear(g1.b, g2.b, g1.j, g2.j, v.N2 / v.N1);
    if (!a) return () => null;
    const d = MOD * (v.N3 + a), ang = -0.55, x4 = x2 + d * Math.cos(ang), y4 = y + d * Math.sin(ang);
    const g4 = gearBody(sim, x4, y4, a, { extra: 'hand' });
    sim.gear(g2.b, g4.b, g2.j, g4.j, a / v.N3);
    return speedJudge(sim, g4.b, RPM(v.w4));
  },
  maxT: 3.2,
};

// ---------- V. Liber Galilaei ----------
const ramp = {
  id: 'ramp', ch: 4, title: "Stevin's Inclined Plane", who: 'Simon Stevin & Galileo', img: 'stevin_clootcrans',
  quote: 'Wonder en is gheen wonder: a wonder, yet no wonder.', skills: ['placement', 'ramps'],
  concept: { line: 'Hang a weight (or tilt the ramp) so the block stays put on the slope.', formula: 'pull = M · sin θ' },
  gen(t, rnd) {
    let M, th, m, mathGiven, q;
    if (t === 0) { M = pick(rnd, [20, 30, 40, 50]); th = 30; mathGiven = [`Block ${M} kg`, `Angle 30°`]; m = M / 2; q = partsQ(m, rnd, { step: 0.5, unit: 'kg', text: 'Pick hanging weight', min: 1, max: 100, spread: 0.4 }); }
    else if (t === 1) { const c = pick(rnd, [[25, 3], [40, 3], [30, 4], [45, 4]]); M = c[0]; th = Math.asin(c[1] / 5) * 180 / Math.PI; mathGiven = [`Block ${M} kg`, `Rise ${c[1]} in 5`]; m = M * c[1] / 5; q = partsQ(m, rnd, { step: 0.5, unit: 'kg', text: 'Pick hanging weight', min: 1, max: 100, spread: 0.4 }); }
    else if (t === 2) { M = pick(rnd, [30, 40, 50]); th = pick(rnd, [35, 40, 25]); mathGiven = [`Block ${M} kg`, `Angle ${th}°`]; m = M * Math.sin(th * Math.PI / 180); q = partsQ(m, rnd, { step: 0.01, unit: 'kg', text: 'Pick hanging weight', min: 1, max: 100, spread: 0.4 }); }
    else { const c = pick(rnd, [[40, 20], [50, 30], [40, 25], [60, 33]]); M = c[0]; m = c[1]; th = Math.asin(m / M) * 180 / Math.PI; mathGiven = [`Block ${M} kg`, `Hang ${m} kg`]; q = { kind: 'angle', text: 'Tilt the ramp', unit: '°', step: 0.5, ans: r2(th, 1), min: 5, max: 60, wrong: [r2(th * 0.7, 1), r2(Math.min(60, th * 1.3), 1)] }; }
    const given = t === 3
      ? ['Turn the ramp handle until the block stays put.', 'Steeper → needs more hanging pull.']
      : ['Hang a weight over the top wheel so the block holds still.', 'Block slides down → heavier hang. Up → lighter.'];
    return { t, M, th, m, given, mathGiven, q };
  },
  rotate: () => ({ x: 1.2, y: 0.3, len: 7 }),
  goal: v => v.t === 3 ? 'Tilt the ramp until the block stays put.' : 'Hang the weight that holds the block on the ramp.',
  hints: () => ['Only part of the weight pulls down the slope.', 'Slides down? More pull (or steeper). Slides up? Less.', 'Feel for the quiet spot where nothing moves.'],
  mathHints: v => [`Answer: ${v.q.ans}`],
  diagnose() { return null; },
  observe: () => 'Only the slope part of the weight pulled — a wonder, yet no wonder.',
  predict: () => ({ text: 'Make the ramp steeper and the block will tend to…', options: ['Slide down more', 'Slide down less', 'Float'], ans: 0 }),
  bin: v => v.t === 3
    ? [{ key: 'ramp', label: 'Ramp', icon: 'ramp', req: true, snap: { x: 4.5, y: 2.5, r: 3 } }]
    : weightBin(v.q.choices, { x: 7.5, y: 3.5, key: 'cw', r: 2.5 }),
  build(sim, v, a, placed) {
    floor(sim);
    const th = (v.t === 3 ? a : v.th) * Math.PI / 180, Lr = 7, bx = 1.2, by = 0.3;
    const c = Math.cos(th), s = Math.sin(th), nx = -s, ny = c;
    sim.box(bx + Lr / 2 * c + nx * -0.12, by + Lr / 2 * s + ny * -0.12, Lr, 0.24, { static: true, angle: th, kind: 'ramp', mask: 0 });
    sim.poly(0, 0, [[bx, by], [bx + Lr * c, by], [bx + Lr * c, by + Lr * s - 0.24]], { static: true, kind: 'rampfill', mask: 0 });
    const top = { x: bx + Lr * c + nx * 0.3, y: by + Lr * s + ny * 0.3 };
    sim.decor.push({ type: 'wheel', x: top.x, y: top.y, r: 0.3 });
    const s0 = 3.6, bc = { x: bx + s0 * c + nx * 0.3, y: by + s0 * s + ny * 0.3 };
    const block = sim.box(bc.x, bc.y, 0.9, 0.6, { mass: v.M, angle: th, kind: 'stone', label: `${v.M} kg`, mask: 0 });
    sim.prismatic(block, bc.x, bc.y, c, s);
    const need = v.t === 3 ? placed.has('ramp') : [...placed].some(k => k.startsWith('cw'));
    if (!need) { block.setType('static'); return () => null; }
    const mH = v.t === 3 ? v.m : a;
    const hx = top.x + 0.3, hy = top.y - 1.6;
    const hang = sim.box(hx, hy, 0.55, 0.55, { mass: mH, kind: 'myweight', label: `${mH}`, mask: 0 });
    sim.prismatic(hang, hx, hy, 0, 1);
    sim.pulley(block, hang, [top.x, top.y], [hx, top.y], [bc.x, bc.y], [hx, hy + 0.275], 1);
    sim.decor.push({ type: 'rope', pts: () => { const p = block.getPosition(), q = hang.getPosition(); return [[p.x, p.y], [top.x, top.y], [hx, top.y], [hx, q.y + 0.275]]; } });
    sim.airDamp = 0.8;
    return () => {
      const p = block.getPosition(), d = (p.x - bc.x) * c + (p.y - bc.y) * s;
      if (d > 0.12) return { win: false, dir: 'up', msg: 'The block slid UP: too much pull.' };
      if (d < -0.12) return { win: false, dir: 'down', msg: 'The block slid DOWN: not enough pull.' };
      if (sim.t > 4.5) return { win: true, msg: 'It holds still on the slope!' };
      return null;
    };
  },
  maxT: 5,
};

const pendulum = {
  id: 'pendulum', ch: 4, title: "Galileo's Pendulum Clock", who: 'Galileo Galilei', img: 'galileo_pendulum_clock',
  quote: 'Each swing takes the same time, wide or narrow.', skills: ['placement', 'timing'],
  concept: { line: 'Slide the brass bob until the pendulum matches the metronome.', formula: 'T = 2π √(L ÷ g)' },
  gen(t, rnd) {
    let T, g = G, mathGiven;
    if (t === 0) { T = pick(rnd, [2, 3, 2.5]); mathGiven = [`Period ${T} s`, `g = 9.81`]; }
    else if (t === 1) { const h = pick(rnd, [1.5, 1.25, 1.75]); T = 2 * h; mathGiven = [`Tick ${h} s one way`]; }
    else if (t === 2) { const [L0, k] = pick(rnd, [[0.5, 2], [0.5, 3], [0.8, 2], [0.8, 3], [1.0, 2]]); T = k * 2 * Math.PI * Math.sqrt(L0 / G); mathGiven = [`Make period ${k}× a ${L0} m pendulum`]; }
    else { const c = pick(rnd, [['Moon', 1.62, 4], ['Mars', 3.71, 3], ['Moon', 1.62, 5]]); g = c[1]; T = c[2]; mathGiven = [`${c[0]} g=${g}`, `Period ${T} s`]; }
    const L = g * T * T / (4 * Math.PI * Math.PI);
    const given = ['Slide the brass bob up or down the rod.', 'Match the swinging metronome on the right.'];
    return { t, T, g, given, mathGiven, q: { kind: 'place', text: 'Slide the bob', unit: 'm', step: 0.01, ans: r2(L, 2), min: 0.2, max: 7.5 } };
  },
  goal: () => 'Set the length so it swings in time with the metronome.',
  hints: () => ['Longer string → slower swing.', 'Running ahead of the metronome? Lengthen it.', 'Lagging behind? Shorten it.'],
  mathHints: v => [`L = ${v.q.ans} m`],
  diagnose() { return null; },
  observe: () => 'Each swing took the same time, wide or narrow — only length mattered.',
  predict: () => ({ text: 'A longer pendulum will swing…', options: ['Faster', 'Slower', 'With bigger arcs only'], ans: 1 }),
  bin: () => [{ key: 'bob', label: 'Brass bob', icon: 'ball', req: true, rail: { axis: 'y', x: 6, y0: 0.9, y1: 8.2, toAns: y => r2(Math.round((8.4 - y) / 0.01) * 0.01, 2), fromAns: a => 8.4 - a } }],
  build(sim, v, a, placed) {
    floor(sim);
    sim.world.setGravity(pl.Vec2(0, -v.g));
    const px = 6, py = 8.4, A0 = 8 * Math.PI / 180;
    sim.box(px, py + 0.2, 2.2, 0.3, { static: true, kind: 'gantry' });
    sim.decor.push({ type: 'metronome', T: v.T, x: 10.4, y: 1.6 });
    if (!placed.has('bob')) return () => null;
    const L = Math.max(0.1, a);
    const bob = sim.circle(px + L * Math.sin(A0), py - L * Math.cos(A0), 0.16, { mass: 2, kind: 'bob', mask: 0 });
    sim.rod(sim.ground, bob, [px, py], [bob.getPosition().x, bob.getPosition().y]);
    sim.decor.push({ type: 'rod', x: px, y: py, body: bob });
    sim.decor.push({ type: 'bell', x: px, y: Math.max(0.6, py - L - 0.5) });
    const cross = []; let prev = bob.getPosition().x - px;
    const DTf = 1 / 60;
    return () => {
      const x = bob.getPosition().x - px;
      if (prev > 0 && x <= 0) { const tc = sim.t - DTf * (-x) / (prev - x + 1e-12); cross.push(tc); sim.event('tick'); }
      prev = x;
      if (cross.length >= 3) {
        const Tm = cross[2] - cross[1]; sim.state.measured = Tm;
        if (Math.abs(Tm - v.T) <= v.T * 0.015) return { win: true, msg: 'In perfect time with the metronome!' };
        return Tm > v.T ? { win: false, dir: 'slow', msg: 'Too slow. Shorten it.' } : { win: false, dir: 'fast', msg: 'Too fast. Lengthen it.' };
      }
      return null;
    };
  },
  maxT: (v, a) => 3 * 2 * Math.PI * Math.sqrt(Math.max(0.1, a) / v.g) + 1,
};

const table = {
  id: 'table', ch: 4, title: "Galileo's Table (f.116v)", who: 'Galileo Galilei', img: 'galileo_portrait',
  quote: 'Sideways speed stays; downward speed grows. The path is a parabola.', skills: ['placement', 'timing'],
  concept: { line: 'Slide the bucket so the ball lands in it after flying off the table.', formula: 'x = v · √(2h ÷ g)' },
  gen(t, rnd) {
    let h, v, mathGiven;
    if (t === 0) { h = pick(rnd, [1.8, 2.0, 2.5]); v = pick(rnd, [2.5, 3]); mathGiven = [`Table ${h} m`, `Speed ${v} m/s`]; }
    else if (t === 1) { h = pick(rnd, [3.2, 2.7, 3.6]); v = pick(rnd, [1.8, 2.2, 2.4]); mathGiven = [`Table ${h} m`, `Speed ${v} m/s`]; }
    else if (t === 2) { const k = pick(rnd, [400, 300]), x = pick(rnd, [0.2, 0.25]); v = x * Math.sqrt(k / 1); h = pick(rnd, [1.5, 1.2]); mathGiven = [`Spring shot`, `Table ${h} m`]; }
    else { const H = pick(rnd, [0.5, 0.4, 0.3]); h = pick(rnd, [2.0, 2.5]); v = Math.sqrt(2 * G * H); mathGiven = [`Ramp then table ${h} m`]; }
    const x = v * Math.sqrt(2 * h / G);
    const given = ['Slide the bucket along the floor rail.', 'The ball flies off — catch it!'];
    return { t, h, v, given, mathGiven, q: { kind: 'place', text: 'Slide the bucket', unit: 'm', step: 0.05, ans: r2(x, 2), min: 0.3, max: 6, wrong: [r2(x - 0.4, 2), r2(x + 0.4, 2)] } };
  },
  goal: () => 'Place the bucket where the ball will land.',
  hints: () => ['Higher table → longer hang time → lands farther.', 'Ball short? Slide bucket closer. Past it? Slide farther.', 'Watch one practice bounce in your mind, then place.'],
  mathHints: v => [`x = ${v.q.ans} m`],
  diagnose() { return null; },
  observe: () => 'Sideways speed stayed steady while falling sped up — a parabola.',
  predict: () => ({ text: 'A faster launch makes the ball land…', options: ['Closer', 'Farther', 'Straight down'], ans: 1 }),
  bin: () => [{ key: 'bucket', label: 'Bucket', icon: 'bucket', req: true, rail: { x0: 3.4, x1: 9.6, y: 0.62, toAns: x => r2(Math.round((x - 2.8) / 0.05) * 0.05, 2), fromAns: a => 2.8 + a } }],
  build(sim, v, a, placed) {
    floor(sim);
    const edge = 2.8, rim = 0.3 + 0.6, top = rim + v.h;
    sim.box(edge - 1.3, (0.3 + top) / 2, 2.6, top - 0.3, { static: true, kind: 'table', friction: 0 });
    sim.decor.push({ type: 'ruler', x0: edge, x1: 10, y: 0.3, origin: edge });
    if (v.t === 2) sim.decor.push({ type: 'spring', x: edge - 2.4, y: top + 0.15 }); if (v.t === 3) sim.decor.push({ type: 'smallramp', x: edge - 2.5, y: top });
    const ball = sim.circle(edge - 0.8, top + 0.13, 0.13, { mass: 1, kind: 'ball', friction: 0, bullet: true, fixedRotation: true });
    ball.setLinearVelocity(pl.Vec2(v.v, 0));
    if (!placed.has('bucket')) { ball.setType('static'); return () => null; }
    const bx = edge + a, iw = 0.62;
    sim.box(bx - iw / 2 - 0.05, 0.3 + 0.3, 0.1, 0.6, { static: true, kind: 'bucketwall', mask: 0 });
    sim.box(bx + iw / 2 + 0.05, 0.3 + 0.3, 0.1, 0.6, { static: true, kind: 'bucketwall', mask: 0 });
    sim.decor.push({ type: 'bucket', x: bx, y: 0.3, w: iw + 0.2, h: 0.6 });
    return () => {
      const p = ball.getPosition();
      if (p.y < rim + 0.13) {
        if (Math.abs(p.x - bx) < iw / 2 - 0.02) return { win: true, msg: 'Plop! Right in the bucket.' };
        return p.x < bx ? { win: false, dir: 'short', msg: 'Landed short: slide the bucket closer.' } : { win: false, dir: 'long', msg: 'Flew past: slide the bucket farther out.' };
      }
      return null;
    };
  },
  maxT: 4,
};

// ---------- VI. Liber Aeris ----------
const PATM = 101325, MAIR = 0.028964, RGAS = 8.314462;
const rhoAir = Tk => PATM * MAIR / (RGAS * Tk);
function balloonBody(sim, x, y, V, mass, o = {}) {
  const rd = Math.min(2.2, 0.75 * Math.cbrt(V) * (o.scale || 1));
  const b = sim.box(x, y, 0.7, 0.45, { mass, kind: 'basket', fixedRotation: true, label: o.label || '' });
  Object.assign(b.getUserData(), { balloon: { rd, kind: o.kind || 'hot', V } });
  return b;
}
const montgolfier = {
  id: 'montgolfier', ch: 5, title: 'The Montgolfier Lantern', who: 'Montgolfier brothers', img: 'montgolfier_balloon',
  quote: 'Heat the air and it grows light, and it will rise.', skills: ['placement', 'balloons'],
  concept: { line: 'Load the basket (or set the burner) so the lantern hovers on the line.', formula: 'ρ_hot = ρ_air · T_air ÷ T_hot' },
  gen(t, rnd) {
    let V, me, ra, rh, Ta = 293, Th, mathGiven, q, pay;
    if (t === 0) { V = pick(rnd, [2, 3, 4]); me = pick(rnd, [0.2, 0.3]); ra = 1.2; rh = pick(rnd, [0.9, 1.0]); pay = V * (ra - rh) - me; mathGiven = [`${V} m³ · envelope ${me} kg`, `Hot ${rh} / cold 1.2`]; q = partsQ(pay, rnd, { step: 0.01, unit: 'kg', text: 'Pick payload', min: 0.05, max: 10, spread: 0.45 }); }
    else if (t === 1 || t === 3) { V = pick(rnd, [3, 4, 5]); me = pick(rnd, [0.3, 0.4]); if (t === 1) { Ta = 293; Th = pick(rnd, [373, 393, 353]); ra = 1.2; } else { Ta = pick(rnd, [288, 283]); Th = pick(rnd, [383, 373]); ra = r2(rhoAir(Ta), 3); } rh = ra * Ta / Th; pay = V * (ra - rh) - me; mathGiven = [`${V} m³`, `Hot air vs cold`]; q = partsQ(pay, rnd, { step: 0.01, unit: 'kg', text: 'Pick payload', min: 0.05, max: 10, spread: 0.45 }); }
    else { V = pick(rnd, [4, 5]); me = 0.4; ra = 1.2; pay = pick(rnd, [0.5, 0.6, 0.4]); Ta = 293; Th = Ta / (1 - (pay + me) / (V * ra)); rh = ra * Ta / Th; mathGiven = [`Payload ${pay} kg`, `Find burner heat`]; q = partsQ(r2(Th - 273, 0), rnd, { step: 1, unit: '°C', text: 'Pick burner setting', min: 50, max: 400, spread: 0.35 }); }
    const given = t === 2
      ? ['Set the burner notch so the balloon hovers.', 'Hotter → more lift.']
      : ['Load one sack into the basket so it hovers on the line.', 'Too heavy → sinks. Too light → soars.'];
    return { t, V, me, ra, rh, Ta, Th, pay, given, mathGiven, q };
  },
  goal: v => v.t === 2 ? 'Set the burner so the balloon hovers.' : 'Load the basket so the balloon hovers.',
  hints: () => ['Hot air is lighter — that\'s the lift.', 'Sinks? Less payload (or more heat). Soars? More payload (or less heat).', 'Aim for the painted hover band.'],
  mathHints: v => [`Answer: ${v.q.ans}`],
  diagnose() { return null; },
  observe: () => 'Heat made the air light, and the lantern rose.',
  predict: () => ({ text: 'Heating the air inside makes the balloon…', options: ['Heavier', 'Lighter (more lift)', 'Unchanged'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 6, y: 3.6, unit: v.t === 2 ? '°C' : 'kg', icon: v.t === 2 ? 'flame' : 'sack', key: 'pay', r: 2 }),
  build(sim, v, a, placed) {
    floor(sim);
    const y0 = 3.6;
    let pay = v.pay, rh = v.rh;
    if (v.t === 2) rh = v.ra * v.Ta / (a + 273); else pay = a;
    const has = [...placed].some(k => k.startsWith('pay'));
    const mass = v.me + (v.t === 2 ? v.pay : (has ? pay : 0));
    const b = balloonBody(sim, 6, y0, v.V, mass, { kind: 'hot', label: v.t === 2 ? `${v.pay} kg` : (has ? `${a} kg` : '') });
    b.getUserData().balloon.flame = v.t !== 2 || has;
    sim.decor.push({ type: 'marker', x0: 2.6, x1: 4.6, y: y0, label: 'hover line' });
    sim.decor.push({ type: 'band', x0: 2.6, x1: 9.4, y0: y0 - 0.25, y1: y0 + 0.25 });
    if (!has) { b.setType('static'); return () => null; }
    const lift = v.V * (v.ra - rh) * G;
    sim.forces.push(() => b.applyForceToCenter(pl.Vec2(0, lift), true));
    sim.airDamp = 0.8;
    return hoverJudge(sim, b, y0, { win: 0.25, hold: 5, up: 'It soared: too much lift.', down: 'It sank: not enough lift.' });
  },
  maxT: 6,
};

const diver = {
  id: 'diver', ch: 5, title: "Descartes' Diver", who: 'Robert Boyle & Descartes', img: 'guericke_magdeburg',
  quote: 'Squeeze the air and it shrinks; the pressure and volume trade places.', skills: ['placement', 'balloons'],
  concept: { line: 'Squeeze the bottle (pick a pressure stop) until the diver hovers.', formula: 'P₁·V₁ = P₂·V₂' },
  gen(t, rnd) {
    let P0 = 100, V0, Vs, m, mathGiven, unit = 'kPa', step = 0.1, P;
    if (t === 0) { [V0, Vs, m] = pick(rnd, [[9, 2, 8], [10, 2, 10], [8, 2, 7], [12, 3, 11]]); mathGiven = [`Diver ${m} g`, `Bubble ${V0} mL`]; }
    else if (t === 1) { P0 = 101.3; [V0, Vs, m] = pick(rnd, [[8.4, 2.1, 8.1], [9.2, 2.4, 8.4], [7.8, 1.6, 7.0]]); mathGiven = [`Diver ${m} g`, `Bubble ${V0} mL`]; }
    else if (t === 2) { P0 = 101.3; const mg = pick(rnd, [5, 6]), wire = pick(rnd, [1.5, 2]); Vs = mg / 2.5; m = mg + wire; V0 = pick(rnd, [7, 8]); mathGiven = [`Glass + wire`, `Bubble ${V0} mL`]; }
    else { P0 = 760; unit = 'mmHg'; step = 1; [V0, Vs, m] = pick(rnd, [[9, 2, 8], [8.5, 2.5, 8], [10, 2, 9.5]]); mathGiven = [`Mercury gauge`, `Bubble ${V0} mL`]; }
    const Va = m - Vs; P = P0 * V0 / Va;
    const given = ['Put the squeeze-cap on, choosing a pressure stop.', 'Harder squeeze → diver sinks. Ease off → it rises.'];
    return { t, P0, V0, Vs, m, given, mathGiven, q: partsQ(P, rnd, { step, unit, text: 'Pick squeeze stop', min: P0 * 0.5, max: unit === 'mmHg' ? 2000 : 400, spread: 0.3 }) };
  },
  goal: () => 'Squeeze the bottle until the diver hovers.',
  hints: () => ['Squeezing shrinks the bubble — the diver gets denser.', 'Rises? Squeeze harder. Sinks? Ease off.', 'Aim for the mid-bottle mark.'],
  mathHints: v => [`P = ${v.q.ans}`],
  diagnose() { return null; },
  observe: () => 'Squeeze the air and it shrinks — pressure and volume traded places.',
  predict: () => ({ text: 'Squeeze the bottle and the diver will…', options: ['Rise', 'Sink', 'Explode'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 6, y: 8.4, unit: v.q.unit, icon: 'cap', key: 'cap', r: 2 }),
  build(sim, v, a, placed) {
    floor(sim);
    const tank = sim.tank(4.6, 7.4, 0.5, 7.6, { D: 0.1, top: 8.0, walls: true, drag: 0 });
    sim.decor.push({ type: 'bottle', x0: 4.6, x1: 7.4, y0: 0.5, y1: 8.0 });
    const y0 = 4.4;
    const has = [...placed].some(k => k.startsWith('cap'));
    const P = has ? a : v.P0;
    const Va = v.V0 * v.P0 / Math.max(P, 1e-6);
    const d = sim.box(6, y0, 0.5, 0.9, { mass: v.m / 1000, kind: 'diver', fixedRotation: true });
    Object.assign(d.getUserData(), { bubble: Va / v.V0 });
    sim.decor.push({ type: 'marker', x0: 4.7, x1: 5.5, y: y0, label: '' });
    sim.decor.push({ type: 'gauge', x: 9.2, y: 6.6, P, unit: v.q.unit });
    if (!has) { d.setType('static'); return () => null; }
    sim.forces.push(() => { const F = RHO_W * G * (v.Vs + Va) * 1e-6, vel = d.getLinearVelocity(); d.applyForceToCenter(pl.Vec2(-3 * d.getMass() * vel.x, F - 3 * d.getMass() * vel.y), true); });
    return hoverJudge(sim, d, y0, { win: 0.2, hold: 5, up: 'The diver rose: squeeze harder.', down: 'The diver sank: squeeze less.' });
  },
  maxT: 6,
};

const hydrogen = {
  id: 'hydrogen', ch: 5, title: "Charles's Hydrogen Globe", who: 'Jacques Charles (1783)', img: 'charles_balloon',
  quote: 'Iron and oil of vitriol give the lightest air.', skills: ['placement', 'balloons'],
  concept: { line: 'Drop metal filings into the flask until the gas lifts the globe to hover.', formula: 'Fe + H₂SO₄ → FeSO₄ + H₂' },
  gen(t, rnd) {
    const T = 293.15, Vm = RGAS * T / PATM * 1000;
    const ra = rhoAir(T), rH = PATM * 0.002016 / (RGAS * T);
    let metal = 'Fe', M = 55.845, ratio = 1, n, mathGiven, me = 20, pay;
    if (t === 0) { n = pick(rnd, [2, 3, 4]); mathGiven = [`Need ${n} mol H₂`, `Fe 1:1`]; M = 55.85; }
    else if (t === 1) { const VL = pick(rnd, [60, 72, 84]); n = VL / Vm; mathGiven = [`Fill ${VL} L H₂`]; M = 55.85; }
    else if (t === 2) { const tot = pick(rnd, [90, 100, 110]); n = tot / 1000 / (ra - rH) * 1000 / Vm; mathGiven = [`Lift ${tot} g`]; M = 55.85; }
    else { metal = 'Al'; M = 26.98; ratio = 2 / 3; n = pick(rnd, [3, 4.5, 6]); mathGiven = [`Need ${n} mol H₂`, `Al reaction`]; }
    const grams = n * ratio * M;
    const lift = n * Vm / 1000 * (ra - rH) * 1000;
    pay = lift - me;
    const given = ['Drop one scoop of metal into the acid flask.', 'More metal → more gas → more lift. Hover on the line.'];
    return { t, metal, M, ratio, n, Vm, ra, rH, me, pay, given, mathGiven, q: partsQ(grams, rnd, { step: 0.1, unit: 'g', text: 'Pick metal scoop', min: 1, max: 1000, spread: 0.4 }) };
  },
  goal: () => 'Drop in enough metal so the gas lifts the globe to hover.',
  hints: () => ['Metal + acid makes light gas that fills the globe.', 'Stays down? Bigger scoop. Shoots up? Smaller scoop.', 'Aim for the hover band.'],
  mathHints: v => [`${v.q.ans} g`],
  diagnose() { return null; },
  observe: () => 'Iron and oil of vitriol gave the lightest air — and the globe rose.',
  predict: () => ({ text: 'More metal in the flask means…', options: ['Less gas', 'More lifting gas', 'Heavier balloon only'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 3.2, y: 2.0, unit: 'g', icon: 'flask', key: 'metal', r: 2 }),
  build(sim, v, a, placed) {
    floor(sim);
    sim.decor.push({ type: 'flask', x: 3.0, y: 0.3 });
    const y0 = 4.0;
    const has = [...placed].some(k => k.startsWith('metal'));
    const nH = has ? a / v.M / v.ratio : 0, Vm3 = nH * v.Vm / 1000;
    const b = balloonBody(sim, 6.4, y0, Math.max(Vm3, 0.005), (v.me + v.pay) / 1000, { kind: 'hydrogen', scale: 4, label: `${r2(v.pay, 1)} g` });
    sim.decor.push({ type: 'hose', x0: 3.0, y0: 1.6, body: b });
    sim.decor.push({ type: 'marker', x0: 8.0, x1: 9.8, y: y0, label: 'hover line' });
    sim.decor.push({ type: 'band', x0: 2.6, x1: 9.8, y0: y0 - 0.25, y1: y0 + 0.25 });
    if (!has) { b.setType('static'); return () => null; }
    const lift = Vm3 * (v.ra - v.rH) * G;
    sim.forces.push(() => b.applyForceToCenter(pl.Vec2(0, lift), true));
    sim.airDamp = 0.8;
    return hoverJudge(sim, b, y0, { win: 0.25, hold: 5, up: 'It shot up: too much gas.', down: 'It stayed down: not enough gas.' });
  },
  maxT: 6,
};

// ---------- VII. Liber Fluxionum ----------
const tower = {
  id: 'tower', ch: 6, title: 'The Leaning Tower', who: 'Galileo Galilei', img: 'galileo_moon',
  quote: 'Distance fallen grows as the square of the time.', skills: ['placement', 'timing'],
  concept: { line: 'Slide the cart so it arrives under the tower just as the ball lands.', formula: 'h = ½·g·t²' },
  gen(t, rnd) {
    let h, v, u = 0, mathGiven;
    if (t === 0) { h = pick(rnd, [4.9, 4.4, 5.5]); v = pick(rnd, [2, 1.5]); mathGiven = [`Drop ${h} m`, `Cart ${v} m/s`]; }
    else if (t === 1) { h = pick(rnd, [6.5, 7.0, 6.0]); v = pick(rnd, [2.4, 1.8, 2.2]); mathGiven = [`Drop ${h} m`, `Cart ${v} m/s`]; }
    else if (t === 2) { const tf = pick(rnd, [1.1, 1.2, 1.0]); h = 0.5 * G * tf * tf; v = pick(rnd, [2, 2.5]); mathGiven = [`Impact speed known`, `Cart ${v} m/s`]; }
    else { h = pick(rnd, [7.0, 6.0]); u = pick(rnd, [2, 3]); v = pick(rnd, [2.4, 2]); mathGiven = [`Thrown down at ${u}`, `Cart ${v} m/s`]; }
    const tf = (-u + Math.sqrt(u * u + 2 * G * h)) / G, d = v * tf;
    const given = ['Slide the cart along the rail.', 'Start it so it catches the falling ball.'];
    return { t, h, v, u, tf, given, mathGiven, q: { kind: 'place', text: 'Slide the cart', unit: 'm', step: 0.05, ans: r2(d, 2), min: 0.3, max: 8, wrong: [r2(d - 0.5, 2), r2(d + 0.5, 2)] } };
  },
  goal: () => 'Place the cart so it arrives just as the ball lands.',
  hints: () => ['Higher drop → more fall time → start the cart farther out.', 'Cart late? Start closer. Early? Start farther.', 'Watch the ball\'s fall — match its timing.'],
  mathHints: v => [`d = ${v.q.ans} m`],
  diagnose() { return null; },
  observe: () => 'Distance fallen grew as the square of the time.',
  predict: () => ({ text: 'From a higher tower, the cart should start…', options: ['Closer', 'Farther away', 'At the same spot'], ans: 1 }),
  bin: () => [{ key: 'cart', label: 'Cart', icon: 'cart', req: true, rail: { x0: 3.4, x1: 11.4, y: 0.62, toAns: x => r2(Math.round((x - 2.9) / 0.05) * 0.05, 2), fromAns: a => 2.9 + a } }],
  build(sim, v, a, placed) {
    floor(sim);
    const xd = 2.9, rim = 0.3 + 0.62;
    sim.decor.push({ type: 'tower', x: 1.7, y: 0.3, h: rim + v.h + 0.2, top: rim + v.h });
    sim.decor.push({ type: 'ruler', x0: xd, x1: 11.8, y: 0.3, origin: xd });
    const ball = sim.circle(xd, rim + v.h, 0.14, { mass: 1, kind: 'ball', bullet: true });
    if (!placed.has('cart')) { ball.setType('static'); return () => null; }
    ball.setLinearVelocity(pl.Vec2(0, -v.u));
    const cx = xd + a, cart = sim.box(cx, 0.3 + 0.2, 1.1, 0.12, { kinematic: true, kind: 'cart' });
    sim.addBoxFixture(cart, -0.55, 0.2, 0.08, 0.5, { kind: 'cartwall', mask: 0 }); sim.addBoxFixture(cart, 0.55, 0.2, 0.08, 0.5, { kind: 'cartwall', mask: 0 });
    cart.setLinearVelocity(pl.Vec2(-v.v, 0));
    return () => {
      const p = ball.getPosition(), c = cart.getPosition();
      if (p.y < rim + 0.17) {
        if (Math.abs(p.x - c.x) < 0.42) return { win: true, msg: 'Caught! Perfect timing.' };
        return c.x > p.x ? { win: false, dir: 'far', msg: 'The cart arrived late: start it closer.' } : { win: false, dir: 'near', msg: 'The cart passed too early: start it farther.' };
      }
      return null;
    };
  },
  maxT: 3.5,
};

const torricelli = {
  id: 'torricelli', ch: 6, title: "Torricelli's Fountain", who: 'Evangelista Torricelli', img: 'torricelli_barometer',
  quote: 'Water leaves the hole as fast as if it had fallen from the surface.', skills: ['placement', 'timing'],
  concept: { line: 'Slide the pail (or drill the hole) so the jet fills it.', formula: 'x = 2·√(H·y)' },
  gen(t, rnd) {
    let ys, yh, mathGiven, q;
    if (t === 0) { ys = 2.6; yh = pick(rnd, [0.8, 1.0, 1.3]); mathGiven = [`Surface ${ys} m`, `Hole ${yh} m`]; q = { kind: 'place', text: 'Slide the pail', unit: 'm', step: 0.05 }; }
    else if (t === 1) { ys = pick(rnd, [3.2, 3.0]); yh = pick(rnd, [1.1, 0.7, 2.1]); mathGiven = [`Surface ${ys}`, `Hole ${yh}`]; q = { kind: 'place', text: 'Slide the pail', unit: 'm', step: 0.05 }; }
    else if (t === 2) { ys = pick(rnd, [3.0, 3.4, 2.8]); yh = ys / 2; mathGiven = [`Max range`, `Surface ${ys}`]; q = { kind: 'place', text: 'Slide the drill height', unit: 'm', step: 0.05 }; }
    else { ys = pick(rnd, [3.4, 3.0]); const X = ys === 3.4 ? 3.0 : 2.4; yh = (ys - Math.sqrt(ys * ys - X * X)) / 2; mathGiven = [`Pail at ${X} m`]; q = { kind: 'place', text: 'Slide the drill height', unit: 'm', step: 0.05, alt: [r2((ys + Math.sqrt(ys * ys - X * X)) / 2, 2)] }; q.X = X; }
    const x = 2 * Math.sqrt((ys - yh) * yh);
    q.ans = (t < 2) ? r2(x, 2) : r2(yh, 2); q.min = 0.1; q.max = t < 2 ? 7 : ys - 0.1;
    if (t < 2) q.wrong = [r2(x - 0.45, 2), r2(x + 0.45, 2)];
    else if (t === 2) q.wrong = [r2(ys * 0.2, 2), r2(ys * 0.8, 2)];
    else {
      // Both quadratic roots work; pick heights far from either
      const a1 = q.ans, a2 = (q.alt && q.alt[0]) || a1;
      q.wrong = [0.25, r2(ys - 0.15, 2)].filter(w => Math.abs(w - a1) > 0.35 && Math.abs(w - a2) > 0.35);
      if (q.wrong.length < 2) q.wrong.push(r2((a1 + a2) / 2, 2)); // midpoint between roots misses the pail
    }
    const given = t < 2
      ? ['Slide the pail to catch the jet.', 'Watch where the arc lands.']
      : ['Slide the drill up/down the wall.', 'Find a height whose jet reaches the pail.'];
    return { t, ys, yh, x, X: q.X ?? x, given, mathGiven, q };
  },
  goal: v => v.t < 2 ? 'Set the pail where the jet lands.' : 'Drill the hole so the jet reaches the pail.',
  hints: () => ['A mid-height hole usually shoots farthest.', 'Jet short of the pail? Move pail closer (or drill higher/lower).', 'Feel for the sweet spot on the rail.'],
  mathHints: v => [`Answer: ${v.q.ans}`],
  diagnose() { return null; },
  observe: () => 'Water left the hole as fast as if it had fallen from the surface.',
  predict: () => ({ text: 'A hole halfway up usually shoots…', options: ['Shortest', 'Farthest', 'Straight up'], ans: 1 }),
  bin: v => v.t < 2
    ? [{ key: 'pail', label: 'Pail', icon: 'bucket', req: true, rail: { x0: 3.6, x1: 10.6, y: 0.5, toAns: x => r2(Math.round((x - 3.12) / 0.05) * 0.05, 2), fromAns: a => 3.12 + a } }]
    : [{ key: 'drill', label: 'Drill', icon: 'drill', req: true, rail: { axis: 'y', x: 3.12, y0: 0.4, y1: v.ys - 0.05, toAns: y => r2(Math.round(y / 0.05) * 0.05, 2), fromAns: a => a } }],
  build(sim, v, a, placed) {
    floor(sim);
    const wallX = 3.12, ys = v.ys + 0.3;
    sim.tank(1.0, 3.0, 0.3, ys, { D: 0.1, top: ys + 0.4 });
    sim.decor.push({ type: 'screw', x0: 0.2, y0: 0.4, x1: 1.3, y1: ys + 0.4, speed: 1 });
    sim.decor.push({ type: 'ruler', x0: wallX, x1: 11.5, y: 0.3, origin: wallX });
    const yh = v.t < 2 ? v.yh : a;
    const cupX = v.t < 2 ? wallX + a : wallX + v.X;
    const hasPart = v.t < 2 ? placed.has('pail') : placed.has('drill');
    sim.decor.push({ type: 'bucket', x: cupX, y: 0.3, w: 0.8, h: 0.5, sunk: true });
    if (hasPart || v.t < 2) sim.decor.push({ type: 'hole', x: wallX - 0.06, y: yh + 0.3 });
    if (!hasPart) return () => null;
    const vj = Math.sqrt(2 * G * Math.max(0, v.ys - yh));
    let caught = 0, missed = 0, k = 0;
    sim.state.caught = 0;
    sim.forces.push(s => { if (k++ % 3 === 0) s.emit({ x: wallX, y: yh + 0.3, vx: vj, vy: 0, kind: 'drop', floor: 0.3, onStep: (p) => { if (!p.counted && p.y <= 0.3 + 0.02) { p.counted = true; if (Math.abs(p.x - cupX) < 0.36) caught++; else missed++; p.dead = true; } } }); });
    return () => {
      sim.state.caught = caught;
      if (caught >= 20) return { win: true, msg: 'The pail fills!' };
      if (missed >= 12) { const land = wallX + 2 * Math.sqrt(Math.max(0, v.ys - yh) * yh); return land < cupX ? { win: false, dir: 'short', msg: 'The jet falls short of the pail.' } : { win: false, dir: 'long', msg: 'The jet flies past the pail.' }; }
      return null;
    };
  },
  maxT: 4,
};

const cistern = {
  id: 'cistern', ch: 6, title: 'The Cistern Clock', who: 'Archimedes & Ctesibius', img: 'ramelli_water',
  quote: 'Add up every little sip, and you have the whole drink.', skills: ['placement', 'timing'],
  concept: { line: 'Pick a sand-timer bell that rings when the cistern hits the fill line.', formula: 'V(t) = ∫ Q dt' },
  gen(t, rnd) {
    const A = 0.4, VOL = 600; let H = 1.5, a = 0, b = 0, mathGiven, tt;
    if (t === 0) { a = pick(rnd, [100, 120, 75, 150]); mathGiven = [`Steady ${a} L/s`, `Fill line`]; tt = VOL / a; }
    else if (t === 1) { [a, b] = pick(rnd, [[40, 20], [50, 20], [60, 30], [30, 30]]); mathGiven = [`Speeding flow`, `Fill ${VOL} L`]; tt = (-a + Math.sqrt(a * a + 2 * b * VOL)) / b; }
    else if (t === 2) { b = pick(rnd, [30, 40, 25]); mathGiven = [`From rest`, `Fill ${VOL} L`]; tt = Math.sqrt(2 * VOL / b); }
    else { [a, b] = pick(rnd, [[120, -10], [150, -15], [130, -10]]); mathGiven = [`Tiring horse`, `Fill ${VOL} L`]; tt = (-a + Math.sqrt(a * a + 2 * b * VOL)) / b; }
    const given = ['Pick a sand-timer bell from the bin.', 'It should ring just as water kisses the fill line.'];
    return { t, A, H, a, b, tt, VOL, given, mathGiven, q: partsQ(tt, rnd, { step: 0.1, unit: 's', text: 'Pick a timer', min: 0.5, max: 14, spread: 0.35 }) };
  },
  goal: () => 'Set the bell to ring the moment the water hits the line.',
  hints: () => ['Watch how fast the screw pours — pick a matching timer.', 'Bell early? Longer timer. Late? Shorter.', 'The graph on the wall shows if the flow speeds up or slows.'],
  mathHints: v => [`t = ${v.q.ans} s`],
  diagnose() { return null; },
  observe: () => 'Every little sip added up — and the whole cistern was full.',
  predict: () => ({ text: 'If the screw pours faster, you need a timer that is…', options: ['Longer', 'Shorter', 'The same'], ans: 1 }),
  bin: v => weightBin(v.q.choices, { x: 9.6, y: 6.5, unit: 's', icon: 'bell', key: 'bell', r: 2.2 }),
  build(sim, v, a, placed) {
    floor(sim);
    const x0 = 5.8, x1 = 8.3, W = x1 - x0, D = v.A / W, y0 = 0.6;
    sim.box(7.05, 0.45, 2.9, 0.3, { static: true, kind: 'stand' });
    const tank = sim.tank(x0, x1, y0, y0 + 0.0001, { D, top: y0 + v.H + 0.6 });
    sim.decor.push({ type: 'marker', x0: x0 - 0.3, x1: x1 + 0.3, y: y0 + v.H, label: 'fill line' });
    sim.decor.push({ type: 'screw', x0: 1.2, y0: 0.4, x1: 5.6, y1: y0 + v.H + 0.8, speed: 1, tank });
    sim.decor.push({ type: 'qgraph', x: 0.6, y: 6.2, a: v.a, b: v.b, T: Math.max(v.tt, a) });
    const has = [...placed].some(k => k.startsWith('bell'));
    if (has) sim.decor.push({ type: 'timer', x: 9.6, y: 6.5, T: a });
    const DTf = 1 / 60;
    tank.inflow = tt => Math.max(0, v.a + v.b * (tt + DTf / 2)) / 1000 / D;
    if (!has) { tank.inflow = null; return () => null; }
    return () => {
      if (sim.t >= a - 1e-9) {
        const lv = tank.level - y0, err = lv - v.H; sim.state.measured = lv;
        sim.event('bell');
        if (Math.abs(err) <= Math.max(0.04, 0.02 * v.H)) return { win: true, msg: 'Ding! Full to the line, right on time.' };
        return err < 0 ? { win: false, dir: 'early', msg: 'Bell rang early — water still below the line.' } : { win: false, dir: 'late', msg: 'Bell rang late — water already passed the line.' };
      }
      if (tank.level - y0 > v.H + 0.08) return { win: false, dir: 'late', msg: 'The water passed the line before the bell rang.' };
      return null;
    };
  },
  maxT: (v, a) => Math.min(15, a + 0.5),
};

const siege = {
  id: 'siege', ch: 6, title: "Leonardo's Great Crossbow", who: 'Leonardo da Vinci', img: 'leonardo_crossbow',
  quote: 'At half a right angle the shot flies farthest.', skills: ['placement', 'timing'],
  concept: { line: 'Aim the great crossbow so the bolt lands in the basket.', formula: 'R = v² · sin 2θ ÷ g' },
  gen(t, rnd) {
    let v, R, mathGiven, ans, alt = [];
    if (t === 0) { v = pick(rnd, [7, 6.5, 7.5]); R = v * v / G; mathGiven = [`Max range ${r2(R, 2)} m`]; ans = 45; }
    else if (t === 1 || t === 3) { v = t === 1 ? 7 : 8; R = t === 1 ? pick(rnd, [4.0, 3.5]) : pick(rnd, [5.0, 4.5]); const s2 = G * R / (v * v); ans = 0.5 * Math.asin(s2) * 180 / Math.PI; alt = [r2(90 - ans, 1)]; mathGiven = [`Target ${R} m`]; }
    else { const Rm = pick(rnd, [5.5, 6.0]); v = Math.sqrt(G * Rm); R = pick(rnd, [4.2, 4.5]); const s2 = R / Rm; ans = 0.5 * Math.asin(s2) * 180 / Math.PI; alt = [r2(90 - ans, 1)]; mathGiven = [`Max ${Rm} m`, `Target ${R} m`]; }
    const given = ['Turn the aim handle, then load the bolt.', 'Around halfway up often flies farthest.'];
    return { t, v, R, given, mathGiven, q: { kind: 'angle', text: 'Aim the crossbow', unit: '°', step: 0.5, ans: r2(ans, 1), alt, min: 5, max: 85, wrong: t === 0 ? [30, 60] : [r2(ans * 0.7, 1), 45] } };
  },
  rotate: () => ({ x: 1.4, y: 1.3, len: 1.0 }),
  goal: () => 'Aim the crossbow so the bolt lands in the basket.',
  hints: () => ['About halfway to straight up often shoots farthest.', 'Short of the basket? Aim a bit higher or lower toward 45°.', 'Load the bolt after you like the aim.'],
  mathHints: v => [`θ = ${v.q.ans}°`],
  diagnose() { return null; },
  observe: () => 'At half a right angle the shot flew farthest.',
  predict: () => ({ text: 'The farthest shot is usually aimed…', options: ['Straight up', 'Near 45°', 'Along the ground'], ans: 1 }),
  bin: () => [{ key: 'bolt', label: 'Ball', icon: 'ball', req: true, snap: { x: 1.4, y: 1.6, r: 2 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const lx = 1.4, ly = 1.3, th = a * Math.PI / 180;
    sim.decor.push({ type: 'crossbow', x: lx, y: ly, ang: th });
    const bx = lx + v.R, iw = 0.7;
    sim.box(bx, (0.3 + ly - 0.5) / 2, 0.5, ly - 0.5 - 0.3, { static: true, kind: 'pedestal' });
    sim.box(bx, ly - 0.45, iw + 0.2, 0.1, { static: true, kind: 'bucketwall' });
    sim.box(bx - iw / 2 - 0.05, ly - 0.27, 0.1, 0.36, { static: true, kind: 'bucketwall' });
    sim.box(bx + iw / 2 + 0.05, ly - 0.27, 0.1, 0.36, { static: true, kind: 'bucketwall' });
    sim.decor.push({ type: 'bucket', x: bx, y: ly - 0.5, w: iw + 0.2, h: 0.41 });
    sim.decor.push({ type: 'marker', x0: bx - 0.9, x1: bx + 0.9, y: ly + 0.05, label: '', faint: true });
    sim.decor.push({ type: 'ruler', x0: lx, x1: 11.6, y: 0.3, origin: lx });
    if (!placed.has('bolt')) return () => null;
    const ball = sim.circle(lx, ly + 0.05, 0.1, { mass: 0.5, kind: 'ball', bullet: true });
    ball.setLinearVelocity(pl.Vec2(v.v * Math.cos(th), v.v * Math.sin(th)));
    return () => {
      const p = ball.getPosition();
      if (sim.t > 0.1 && p.y < ly + 0.05 && ball.getLinearVelocity().y < 0) {
        if (Math.abs(p.x - bx) < iw / 2 - 0.04) return { win: true, msg: 'Bullseye! Into the basket.' };
        return p.x < bx ? { win: false, dir: 'short', msg: 'Short of the basket.' } : { win: false, dir: 'long', msg: 'Over the basket.' };
      }
      return null;
    };
  },
  maxT: 3.5,
};

export const CH_B = [millgear, windlass, clocktrain, ramp, pendulum, table, montgolfier, diver, hydrogen, tower, torricelli, cistern, siege];
