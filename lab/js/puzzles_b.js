// Chapters IV-VII: gears, Galileo, airs & balloons, rates & change
import { G, RHO_W, pl } from './sim.js';
import { pick, r2, floor, hoverJudge } from './puzzles_a.js';
const near = (a, b, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel + 1e-9;
const MOD = 0.025; // pitch radius per tooth (m)
const RPM = x => x * 2 * Math.PI / 60;
const gearBin = (choices, x, y) => choices.map(N => ({ key: 'g' + N, label: `${N} teeth`, icon: 'gear', teeth: N, group: 'gear', req: false, snap: { x, y, r: 2.2 } }));
function gearSet(rnd, ans, pool = [12, 16, 18, 20, 24, 30, 36, 40, 48]) { const s = new Set([ans]); while (s.size < 5) s.add(pick(rnd, pool)); return [...s].sort((a, b) => a - b); }
function gearBody(sim, x, y, N, o = {}) {
  const r = MOD * N;
  const b = sim.circle(x, y, r, { mass: o.mass ?? 2 * r * r + 0.2, kind: 'gear', mask: 0, cat: 0 });
  Object.assign(b.getUserData(), { teeth: N, r, style: o.style || {}, drum: o.drum || 0, extra: o.extra || null });
  const j = sim.revolute(b, x, y, o.motor ? { motorSpeed: o.motor, maxTorque: 1e6 } : {});
  return { b, j, r };
}
function speedJudge(sim, body, target, o = {}) {
  let acc = 0, n = 0;
  return () => {
    if (sim.t < 0.8) return null;
    acc += Math.abs(body.getAngularVelocity()); n++;
    if (sim.t >= 2.8) {
      const w = acc / n, rpm = w * 60 / (2 * Math.PI), tr = Math.abs(target) * 60 / (2 * Math.PI);
      sim.state.measured = rpm;
      if (Math.abs(rpm - tr) <= tr * 0.02) return { win: true, msg: `${r2(rpm, 2)} rpm. Exactly on speed!` };
      return rpm > tr ? { win: false, dir: 'fast', msg: `${r2(rpm, 1)} rpm: too fast. Bigger gear slows it.` } : { win: false, dir: 'slow', msg: `${r2(rpm, 1)} rpm: too slow. Smaller gear speeds it.` };
    }
    return null;
  };
}

// ---------- IV. Liber Rotarum ----------
const millgear = {
  id: 'millgear', ch: 3, title: 'The Mill Wheel', who: 'Leonardo da Vinci', img: 'leonardo_gears',
  quote: 'The wheel with more teeth turns more slowly.', skills: ['ratio'],
  concept: { line: 'Meshing gears trade speed: teeth × rpm is the same for both.', formula: 'N₁ · ω₁ = N₂ · ω₂' },
  gen(t, rnd) {
    let N1, w1, w2, given, N2;
    if (t === 0) { [N1, w1, N2] = pick(rnd, [[12, 60, 24], [12, 60, 36], [16, 60, 24], [12, 40, 24]]); w2 = N1 * w1 / N2; given = [`Water wheel gear: ${N1} teeth at ${w1} rpm`, `Millstone must turn at ${r2(w2, 2)} rpm`]; }
    else if (t === 1) { [N1, w1, N2] = pick(rnd, [[18, 40, 24], [20, 45, 30], [15, 48, 36], [18, 50, 30]]); w2 = N1 * w1 / N2; given = [`Driver: ${N1} teeth at ${w1} rpm`, `Millstone: ${r2(w2, 2)} rpm`]; }
    else if (t === 2) { const k = pick(rnd, [3, 2.5, 2, 1.5]); N1 = k === 2.5 ? 16 : 12 + (k === 1.5 ? 4 : 0); N2 = N1 * k; w1 = 60; w2 = w1 / k; given = [`Driver: ${N1} teeth`, `It turns ${k}× per turn of the stone`]; }
    else { const c = pick(rnd, [[16, 2, 5, 40], [12, 1, 3, 36], [20, 1.5, 3, 40]]); N1 = c[0]; w1 = 60 / c[1]; w2 = 60 / c[2]; N2 = c[3]; given = [`Driver: ${N1} teeth, 1 turn every ${c[1]} s`, `Stone: 1 turn every ${c[2]} s`]; }
    const choices = gearSet(rnd, N2);
    return { t, N1, w1, w2, given, choices, q: { text: 'Which gear (teeth) fits the stone?', unit: 'teeth', step: 1, ans: N2, kind: 'gear', choices, wrong: choices.filter(c => c !== N2) } };
  },
  goal: () => 'Fit the gear that spins the millstone at the right speed.',
  hints: v => ['More teeth = slower turning.', `N₂ = N₁ × ω₁ ÷ ω₂ = ${v.N1} × ${r2(v.w1, 2)} ÷ ${r2(v.w2, 2)}`, `N₂ = ${v.q.ans} teeth`],
  diagnose(v, a) { if (near(a, v.N1 * v.w2 / v.w1, 0.05)) return 'Flipped: to go SLOWER, the driven gear needs MORE teeth.'; return null; },
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
  quote: 'Force is multiplied as the wheel is greater than the axle.', skills: ['algebra', 'moments', 'ratio'],
  concept: { line: 'Gears multiply turning force; drums turn it back into pull.', formula: 'm = M · (r₂ ÷ r₁) · (N₁ ÷ N₂)' },
  gen(t, rnd) {
    let N1, N2, r1, r2_, M, given;
    if (t === 0) { [N1, N2, M] = pick(rnd, [[12, 36, 60], [12, 24, 50], [16, 48, 75]]); r1 = r2_ = 0.3; given = [`Load: ${M} kg`, `Small gear ${N1} teeth → big gear ${N2} teeth`, `Both drums the same size`]; }
    else if (t === 1) { [N1, N2, r1, r2_, M] = pick(rnd, [[12, 24, 0.4, 0.2, 90], [12, 36, 0.3, 0.2, 81], [16, 40, 0.4, 0.25, 64]]); given = [`Load: ${M} kg on a ${r2_} m drum`, `Your drum: ${r1} m`, `Gears: ${N1} → ${N2} teeth`]; }
    else if (t === 2) { [N1, N2, r1, r2_, M] = pick(rnd, [[12, 30, 0.35, 0.25, 70], [16, 36, 0.4, 0.3, 66]]); given = [`Load: ${M} kg, drum diameter ${r2(2 * r2_, 2)} m`, `Your drum diameter ${r2(2 * r1, 2)} m`, `Gears: ${N1} → ${N2} teeth`]; }
    else { [N1, N2, r1, r2_, M] = pick(rnd, [[12, 40, 0.3, 0.2, 120], [16, 48, 0.4, 0.25, 96]]); given = [`Bronze bell: ${M} kg on a ${r2_} m drum`, `Your drum ${r1} m · gears ${N1} → ${N2}`, `Mechanical advantage = ?`]; }
    const ans = M * (r2_ / r1) * (N1 / N2);
    return { t, N1, N2, r1, r2: r2_, M, given, q: { text: 'Effort weight (kg) to hold the load?', unit: 'kg', step: 0.01, ans: r2(ans, 2), min: 0, max: 200, kind: 'number' } };
  },
  goal: () => 'Hang the effort weight that holds the load still.',
  hints: v => ['Turning force (torque) = weight × drum radius.', 'The big gear multiplies torque by N₂ ÷ N₁.', `m = ${v.M} × (${v.r2} ÷ ${v.r1}) × (${v.N1} ÷ ${v.N2}) = ${v.q.ans} kg`],
  diagnose(v, a) { if (near(a, v.M * (v.r2 / v.r1) * (v.N2 / v.N1), 0.03)) return 'Gear ratio flipped: the small gear drives the big one, so you gain force.'; if (near(a, v.M * (v.r1 / v.r2) * (v.N1 / v.N2), 0.03)) return 'Drum ratio flipped: a bigger effort drum needs LESS weight.'; return null; },
  bin: v => [{ key: 'eff', label: 'Effort', icon: 'weight', req: true, snap: { x: 3.4 - v.r1, y: 3.6, r: 1.6 } }],
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
    if (!placed.has('eff')) { load.setType('static'); return () => null; }
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
  quote: 'Gear upon gear, the hours are made from seconds.', skills: ['ratio', 'algebra'],
  concept: { line: 'Gear trains multiply: each pair divides the speed again.', formula: 'ω_out = ω_in · (N₁/N₂) · (N₃/N₄)' },
  gen(t, rnd) {
    const c = t === 0 ? pick(rnd, [[12, 36, 12, 36, 36], [12, 24, 12, 36, 24]]) : t === 1 ? pick(rnd, [[10, 40, 12, 36, 60], [12, 48, 12, 30, 40]]) : t === 2 ? pick(rnd, [[12, 48, 10, 40, 24], [16, 40, 12, 48, 30]]) : pick(rnd, [[12, 36, 10, 40, 72], [10, 30, 12, 48, 60]]);
    const [N1, N2, N3, N4, w1] = c; const w4 = w1 * N1 / N2 * N3 / N4;
    const given = t < 3 ? [`Drive: ${N1} teeth at ${w1} rpm → ${N2}`, `Same shaft: ${N3} teeth → your gear`, `Hand must turn at ${r2(w4, 3)} rpm`]
      : [`Drive: ${N1} teeth at ${w1} rpm → ${N2}`, `Same shaft: ${N3} teeth → your gear`, `Hand: one turn every ${r2(60 / w4, 2)} s`];
    const choices = gearSet(rnd, N4, [24, 30, 36, 40, 48]);
    return { t, N1, N2, N3, w1, w4, given, choices, q: { text: 'Which gear (teeth) for the hand?', unit: 'teeth', step: 1, ans: N4, kind: 'gear', choices, wrong: choices.filter(x => x !== N4) } };
  },
  goal: () => 'Pick the last gear so the hand turns at clock speed.',
  hints: v => ['First pair: speed × N₁ ÷ N₂.', `Middle shaft: ${r2(v.w1 * v.N1 / v.N2, 3)} rpm.`, `N₄ = ${v.N3} × ${r2(v.w1 * v.N1 / v.N2, 3)} ÷ ${r2(v.w4, 3)} = ${v.q.ans}`],
  diagnose(v, a) { return null; },
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
  quote: 'Wonder en is gheen wonder: a wonder, yet no wonder.', skills: ['trig'],
  concept: { line: 'On a smooth ramp, only the slope part of the weight pulls.', formula: 'pull = M · sin θ' },
  gen(t, rnd) {
    let M, th, m, given, q;
    if (t === 0) { M = pick(rnd, [20, 30, 40, 50]); th = 30; given = [`Block: ${M} kg on a smooth ramp`, `Ramp angle: 30°`, `sin 30° = 0.5`]; m = M / 2; q = { text: 'Hanging weight (kg) to hold it?', unit: 'kg', step: 0.5, ans: m, kind: 'number' }; }
    else if (t === 1) { const c = pick(rnd, [[25, 3], [40, 3], [30, 4], [45, 4]]); M = c[0]; th = Math.asin(c[1] / 5) * 180 / Math.PI; given = [`Block: ${M} kg`, `Ramp rises ${c[1]} m for every 5 m of slope`]; m = M * c[1] / 5; q = { text: 'Hanging weight (kg)?', unit: 'kg', step: 0.5, ans: r2(m, 2), kind: 'number' }; }
    else if (t === 2) { M = pick(rnd, [30, 40, 50]); th = pick(rnd, [35, 40, 25]); given = [`Block: ${M} kg`, `Ramp angle: ${th}°`]; m = M * Math.sin(th * Math.PI / 180); q = { text: 'Hanging weight (kg)?', unit: 'kg', step: 0.01, ans: r2(m, 2), kind: 'number' }; }
    else { const c = pick(rnd, [[40, 20], [50, 30], [40, 25], [60, 33]]); M = c[0]; m = c[1]; th = Math.asin(m / M) * 180 / Math.PI; given = [`Block: ${M} kg`, `Hanging weight: ${m} kg`, `Tilt the ramp to balance`]; q = { text: 'Ramp angle (°)?', unit: '°', step: 0.5, ans: r2(th, 1), kind: 'angle' }; }
    q.min = 0; q.max = q.kind === 'angle' ? 60 : 100;
    return { t, M, th, m, given, q };
  },
  rotate: () => ({ x: 1.2, y: 0.3, len: 7 }),
  goal: v => v.t === 3 ? 'Tilt the ramp until the block stays put.' : 'Hang the weight that holds the block on the ramp.',
  hints: v => ['Only the slope part pulls: M × sin θ.', v.t === 3 ? `sin θ = ${v.m} ÷ ${v.M} = ${r2(v.m / v.M, 4)}` : `sin ${r2(v.th, 2)}° = ${r2(Math.sin(v.th * Math.PI / 180), 4)}`, v.t === 3 ? `θ = sin⁻¹(${r2(v.m / v.M, 4)}) = ${v.q.ans}°` : `m = ${v.M} × ${r2(Math.sin(v.th * Math.PI / 180), 4)} = ${v.q.ans} kg`],
  diagnose(v, a) { const c = v.M * Math.cos(v.th * Math.PI / 180); if (v.t < 3 && near(a, c, 0.02)) return 'You used cos. Down-the-slope pull uses sin θ.'; if (v.t < 3 && near(a, v.M, 0.01)) return 'A ramp helps! Only part of the weight pulls along it.'; if (v.t === 3 && near(a, Math.acos(v.m / v.M) * 180 / Math.PI, 0.02)) return 'That is cos⁻¹. Use sin⁻¹(m ÷ M).'; return null; },
  bin: v => [{ key: v.t === 3 ? 'ramp' : 'cw', label: v.t === 3 ? 'Ramp' : 'Weight', icon: v.t === 3 ? 'ramp' : 'weight', req: true, snap: v.t === 3 ? { x: 4.5, y: 2.5, r: 3 } : { x: 7.5, y: 3.5, r: 2.5 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const th = (v.t === 3 ? a : v.th) * Math.PI / 180, Lr = 7, bx = 1.2, by = 0.3;
    const c = Math.cos(th), s = Math.sin(th), nx = -s, ny = c;
    const ramp = sim.box(bx + Lr / 2 * c + nx * -0.12, by + Lr / 2 * s + ny * -0.12, Lr, 0.24, { static: true, angle: th, kind: 'ramp', mask: 0 });
    sim.poly(0, 0, [[bx, by], [bx + Lr * c, by], [bx + Lr * c, by + Lr * s - 0.24]], { static: true, kind: 'rampfill', mask: 0 });
    const top = { x: bx + Lr * c + nx * 0.3, y: by + Lr * s + ny * 0.3 };
    sim.decor.push({ type: 'wheel', x: top.x + 0.0, y: top.y, r: 0.3 });
    const s0 = 3.6, bc = { x: bx + s0 * c + nx * 0.3, y: by + s0 * s + ny * 0.3 };
    const block = sim.box(bc.x, bc.y, 0.9, 0.6, { mass: v.M, angle: th, kind: 'stone', label: `${v.M} kg`, mask: 0 });
    const pj = sim.prismatic(block, bc.x, bc.y, c, s);
    sim.state.rampAngle = th * 180 / Math.PI;
    const need = v.t === 3 ? placed.has('ramp') : placed.has('cw');
    if (!need) { block.setType('static'); return () => null; }
    const mH = v.t === 3 ? v.m : a;
    const hx = top.x + 0.3, hy = top.y - 1.6;
    const hang = sim.box(hx, hy, 0.55, 0.55, { mass: mH, kind: 'myweight', label: `${mH}`, mask: 0 });
    sim.prismatic(hang, hx, hy, 0, 1);
    sim.pulley(block, hang, [top.x, top.y], [hx, top.y], [bc.x, bc.y], [hx, hy + 0.275], 1);
    sim.decor.push({ type: 'rope', pts: () => { const p = block.getPosition(), q = hang.getPosition(); return [[p.x, p.y], [top.x, top.y], [hx, top.y], [hx, q.y + 0.275]]; } });
    sim.airDamp = 0.8;
    let s1 = null;
    return () => {
      const p = block.getPosition(), d = (p.x - bc.x) * c + (p.y - bc.y) * s;
      if (d > 0.12) return { win: false, dir: 'up', msg: 'The block slid UP: too much pull.' };
      if (d < -0.12) return { win: false, dir: 'down', msg: 'The block slid DOWN: not enough pull.' };
      if (sim.t > 4.5) return { win: true, msg: 'It holds still on the slope. Stevin would cheer!' };
      return null;
    };
  },
  maxT: 5,
};
const pendulum = {
  id: 'pendulum', ch: 4, title: "Galileo's Pendulum Clock", who: 'Galileo Galilei', img: 'galileo_pendulum_clock',
  quote: 'Each swing takes the same time, wide or narrow.', skills: ['sqrt', 'algebra'],
  concept: { line: 'Period depends only on length (and gravity), not on the weight.', formula: 'T = 2π √(L ÷ g)   →   L = g·T² ÷ 4π²' },
  gen(t, rnd) {
    let T, g = G, given;
    if (t === 0) { T = pick(rnd, [2, 3, 2.5]); given = [`One full swing (there and back): ${T} s`, `g = 9.81 m/s²`]; }
    else if (t === 1) { const h = pick(rnd, [1.5, 1.25, 1.75]); T = 2 * h; given = [`Each tick (one way) = ${h} s`, `Full period = 2 ticks`, `g = 9.81 m/s²`]; }
    else if (t === 2) { const [L0, k] = pick(rnd, [[0.5, 2], [0.5, 3], [0.8, 2], [0.8, 3], [1.0, 2]]); T = k * 2 * Math.PI * Math.sqrt(L0 / G); given = [`A ${L0} m pendulum ticks too fast`, `Make the period ${k}× longer`]; }
    else { const c = pick(rnd, [['Moon', 1.62, 4], ['Mars', 3.71, 3], ['Moon', 1.62, 5]]); g = c[1]; T = c[2]; given = [`Clock for the ${c[0]}: g = ${g} m/s²`, `Period: ${T} s`]; }
    const L = g * T * T / (4 * Math.PI * Math.PI);
    return { t, T, g, given, q: { text: 'Pendulum length (m)?', unit: 'm', step: 0.01, ans: r2(L, 2), min: 0.2, max: 7.5, kind: 'number' } };
  },
  goal: () => 'Set the length so it swings in time with the metronome.',
  hints: v => ['Square the period, times g, divide by 4π² (≈ 39.48).', v.t === 2 ? 'k× the period needs k² × the length.' : `L = ${v.g} × ${r2(v.T, 3)}² ÷ 39.48`, `L = ${v.q.ans} m`],
  diagnose(v, a) { const L = v.g * v.T * v.T / (4 * Math.PI ** 2); if (near(a, v.g * v.T / (4 * Math.PI ** 2), 0.03) || near(a, Math.sqrt(L), 0.03)) return 'Remember to SQUARE the period.'; if (near(a, L * 4, 0.03)) return 'Use the FULL period (there and back), or ÷4π² not ÷π².'; return null; },
  bin: v => [{ key: 'bob', label: 'Brass bob', icon: 'ball', req: true, snap: { x: 6, y: 5, r: 3 } }],
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
    return () => {
      const x = bob.getPosition().x - px;
      if (prev > 0 && x <= 0) { const tc = sim.t - DTf * (-x) / (prev - x + 1e-12); cross.push(tc); sim.event('tick'); }
      prev = x;
      if (cross.length >= 3) {
        const Tm = cross[2] - cross[1]; sim.state.measured = Tm;
        if (Math.abs(Tm - v.T) <= v.T * 0.015) return { win: true, msg: `Period ${r2(Tm, 2)} s. In perfect time!` };
        return Tm > v.T ? { win: false, dir: 'slow', msg: `Period ${r2(Tm, 2)} s: too slow. Shorten it.` } : { win: false, dir: 'fast', msg: `Period ${r2(Tm, 2)} s: too fast. Lengthen it.` };
      }
      return null;
    };
  },
  maxT: (v, a) => 3 * 2 * Math.PI * Math.sqrt(Math.max(0.1, a) / v.g) + 1,
};
const DTf = 1 / 60;
const table = {
  id: 'table', ch: 4, title: "Galileo's Table (f.116v)", who: 'Galileo Galilei', img: 'galileo_portrait',
  quote: 'Sideways speed stays; downward speed grows. The path is a parabola.', skills: ['sqrt', 'kinematics'],
  concept: { line: 'Fall time depends only on height. Sideways speed stays the same.', formula: 'x = v · √(2h ÷ g)' },
  gen(t, rnd) {
    let h, v, given;
    if (t === 0) { h = pick(rnd, [1.8, 2.0, 2.5]); v = pick(rnd, [2.5, 3]); given = [`Table: ${h} m above the bucket rim`, `Ball leaves at ${v} m/s`, `g = 9.81 m/s²`]; }
    else if (t === 1) { h = pick(rnd, [3.2, 2.7, 3.6]); v = pick(rnd, [1.8, 2.2, 2.4]); given = [`Table: ${h} m above the rim`, `Ball speed: ${v} m/s`]; }
    else if (t === 2) { const k = pick(rnd, [400, 300]), x = pick(rnd, [0.2, 0.25]); v = x * Math.sqrt(k / 1); h = pick(rnd, [1.5, 1.2]); given = [`Spring k = ${k} N/m pushed ${x} m`, `Ball: 1 kg, ½kx² = ½mv²`, `Table: ${h} m above the rim`]; }
    else { const H = pick(rnd, [0.5, 0.4, 0.3]); h = pick(rnd, [2.0, 2.5]); v = Math.sqrt(2 * G * H); given = [`Ball slides down a ${H} m smooth ramp`, `(v = √(2gH)) then off a table`, `Table: ${h} m above the rim`]; }
    const x = v * Math.sqrt(2 * h / G);
    return { t, h, v, given, q: { text: 'Bucket distance from the table edge (m)?', unit: 'm', step: 0.05, ans: r2(x, 2), min: 0.3, max: 6, kind: 'place', wrong: [r2(x - 0.4, 2), r2(x + 0.4, 2)] } };
  },
  goal: () => 'Place the bucket where the ball will land.',
  hints: v => ['First find the fall time from the height.', `t = √(2×${v.h}÷9.81) = ${r2(Math.sqrt(2 * v.h / G), 3)} s`, `x = ${r2(v.v, 3)} × ${r2(Math.sqrt(2 * v.h / G), 3)} = ${v.q.ans} m`],
  diagnose(v, a) { if (near(a, v.v * Math.sqrt(v.h / G), 0.04)) return 'Forgot the 2 inside √(2h/g).'; if (near(a, v.v * 2 * v.h / G, 0.04)) return 'Take the square root for the fall time.'; return null; },
  bin: v => [{ key: 'bucket', label: 'Bucket', icon: 'bucket', req: true, rail: { x0: 3.4, x1: 9.6, y: 0.62, toAns: x => r2(Math.round((x - 2.8) / 0.05) * 0.05, 2), fromAns: a => 2.8 + a } }],
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
        return p.x < bx ? { win: false, dir: 'short', msg: 'Landed short: bucket too far.' } : { win: false, dir: 'long', msg: 'Flew past: bucket too close.' };
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
  quote: 'Heat the air and it grows light, and it will rise.', skills: ['density', 'kelvin', 'gaslaw'],
  concept: { line: 'Hot air is less dense. Lift = volume × (ρ_cold − ρ_hot).', formula: 'ρ_hot = ρ_air · T_air ÷ T_hot   (kelvin!)' },
  gen(t, rnd) {
    let V, me, ra, rh, Ta = 293, Th, given, q, pay;
    if (t === 0) { V = pick(rnd, [2, 3, 4]); me = pick(rnd, [0.2, 0.3]); ra = 1.2; rh = pick(rnd, [0.9, 1.0]); pay = V * (ra - rh) - me; given = [`Balloon: ${V} m³ · envelope ${me} kg`, `Cold air 1.2 kg/m³ · hot air ${rh} kg/m³`]; q = { text: 'Payload (kg) to hover?', unit: 'kg', step: 0.01, ans: r2(pay, 2), kind: 'number' }; }
    else if (t === 1 || t === 3) { V = pick(rnd, [3, 4, 5]); me = pick(rnd, [0.3, 0.4]); if (t === 1) { Ta = 293; Th = pick(rnd, [373, 393, 353]); ra = 1.2; } else { Ta = pick(rnd, [288, 283]); Th = pick(rnd, [383, 373]); ra = r2(rhoAir(Ta), 3); } rh = ra * Ta / Th; pay = V * (ra - rh) - me;
      given = t === 1 ? [`Balloon ${V} m³ · envelope ${me} kg`, `Air: 20 °C (293 K), 1.2 kg/m³`, `Hot air: ${Th - 273} °C (${Th} K)`] : [`Balloon ${V} m³ · envelope ${me} kg`, `Air: ${Ta - 273} °C, ${ra} kg/m³`, `Hot air: ${Th - 273} °C  (K = °C + 273)`];
      q = { text: 'Payload (kg) to hover?', unit: 'kg', step: 0.01, ans: r2(pay, 2), kind: 'number' }; }
    else { V = pick(rnd, [4, 5]); me = 0.4; ra = 1.2; pay = pick(rnd, [0.5, 0.6, 0.4]); Ta = 293; Th = Ta / (1 - (pay + me) / (V * ra)); rh = ra * Ta / Th; given = [`Balloon ${V} m³ · envelope ${me} kg`, `Payload ${pay} kg · air 20 °C, 1.2 kg/m³`]; q = { text: 'Burner temperature (°C)?', unit: '°C', step: 1, ans: r2(Th - 273, 0), kind: 'number', wrong: [r2((Th - 273) * 0.85, 0), r2((Th - 273) * 1.15, 0)] }; }
    q.min = 0; q.max = t === 2 ? 400 : 10;
    return { t, V, me, ra, rh, Ta, Th, pay, given, q };
  },
  goal: v => v.t === 2 ? 'Set the burner so the balloon hovers.' : 'Load the basket so the balloon hovers.',
  hints: v => ['Lift = V × (ρ_air − ρ_hot). It must carry envelope + payload.', v.t === 0 ? `Lift = ${v.V} × ${r2(v.ra - v.rh, 3)} = ${r2(v.V * (v.ra - v.rh), 3)} kg` : `Charles: ρ_hot = ${v.ra} × ${v.Ta} ÷ T_hot (in kelvin)`, v.t === 2 ? `T_hot = ${v.Ta} ÷ (1 − ${r2(v.pay + v.me, 2)}/${r2(v.V * v.ra, 2)}) = ${r2(v.Th, 1)} K = ${v.q.ans} °C` : `Payload = ${r2(v.V * (v.ra - v.rh), 3)} − ${v.me} = ${v.q.ans} kg`],
  diagnose(v, a) {
    if (v.t === 1 || v.t === 3) { const rhC = v.ra * (v.Ta - 273) / (v.Th - 273); const pC = v.V * (v.ra - rhC) - v.me; if (near(a, pC, 0.04)) return 'Celsius trap! Gas laws need kelvin (°C + 273).'; if (near(a, v.V * (v.ra - v.rh), 0.02)) return 'Subtract the envelope\'s own weight.'; }
    if (v.t === 0 && near(a, v.V * (v.ra - v.rh), 0.02)) return 'Subtract the envelope\'s own weight.';
    if (v.t === 2 && near(a, v.Th, 0.01)) return 'That is kelvin. Convert: °C = K − 273.';
    return null;
  },
  bin: v => [{ key: 'pay', label: v.t === 2 ? 'Burner' : 'Payload', icon: v.t === 2 ? 'flame' : 'sack', req: true, snap: { x: 6, y: 3.6, r: 2 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const y0 = 3.6;
    let pay = v.pay, rh = v.rh;
    if (v.t === 2) rh = v.ra * v.Ta / (a + 273); else pay = a;
    const has = placed.has('pay');
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
  quote: 'Squeeze the air and it shrinks; the pressure and volume trade places.', skills: ['gaslaw', 'algebra', 'density'],
  concept: { line: 'Boyle: squeeze a gas and its volume shrinks in proportion.', formula: 'P₁·V₁ = P₂·V₂' },
  gen(t, rnd) {
    let P0 = 100, V0, Vs, m, given, unit = 'kPa', step = 0.1, P;
    if (t === 0) { [V0, Vs, m] = pick(rnd, [[9, 2, 8], [10, 2, 10], [8, 2, 7], [12, 3, 11]]); given = [`Diver: ${m} g, glass ${Vs} mL`, `Air bubble: ${V0} mL at ${P0} kPa`, `Water: 1 g per mL`]; }
    else if (t === 1) { P0 = 101.3; [V0, Vs, m] = pick(rnd, [[8.4, 2.1, 8.1], [9.2, 2.4, 8.4], [7.8, 1.6, 7.0]]); given = [`Diver ${m} g · glass ${Vs} mL`, `Bubble: ${V0} mL at ${P0} kPa`]; }
    else if (t === 2) { P0 = 101.3; const mg = pick(rnd, [5, 6]), wire = pick(rnd, [1.5, 2]); Vs = mg / 2.5; m = mg + wire; V0 = pick(rnd, [7, 8]); given = [`Glass ${mg} g (2.5 g/mL) + wire ${wire} g`, `Bubble: ${V0} mL at ${P0} kPa`, `(ignore the wire's volume)`]; }
    else { P0 = 760; unit = 'mmHg'; step = 1; [V0, Vs, m] = pick(rnd, [[9, 2, 8], [8.5, 2.5, 8], [10, 2, 9.5]]); given = [`Diver ${m} g · glass ${Vs} mL`, `Bubble ${V0} mL at 760 mmHg`, `(Torricelli's mercury gauge)`]; }
    const Va = m - Vs; P = P0 * V0 / Va;
    return { t, P0, V0, Vs, m, given, q: { text: `Pressure to make it hover (${unit})?`, unit, step, ans: r2(P, step < 1 ? 1 : 0), min: 0, max: 2000, kind: 'number', wrong: [r2(P * 0.9, 1), r2(P * 1.1, 1)] } };
  },
  goal: () => 'Squeeze the bottle until the diver hovers.',
  hints: v => ['Hover: bubble + glass must displace the diver\'s mass in water.', `Bubble needed: ${v.m} − ${v.Vs} = ${r2(v.m - v.Vs, 2)} mL`, `P = ${v.P0} × ${v.V0} ÷ ${r2(v.m - v.Vs, 2)} = ${v.q.ans}`],
  diagnose(v, a) { if (near(a, v.P0 * (v.m - v.Vs) / v.V0, 0.03)) return 'Flipped: smaller bubble needs MORE pressure. P₂ = P₁V₁/V₂.'; return null; },
  bin: v => [{ key: 'cap', label: 'Squeeze cap', icon: 'cap', req: true, snap: { x: 6, y: 8.4, r: 2 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const tank = sim.tank(4.6, 7.4, 0.5, 7.6, { D: 0.1, top: 8.0, walls: true, drag: 0 });
    sim.decor.push({ type: 'bottle', x0: 4.6, x1: 7.4, y0: 0.5, y1: 8.0 });
    const y0 = 4.4, P = placed.has('cap') ? a : v.P0;
    const Va = v.V0 * v.P0 / Math.max(P, 1e-6);
    const d = sim.box(6, y0, 0.5, 0.9, { mass: v.m / 1000, kind: 'diver', fixedRotation: true });
    Object.assign(d.getUserData(), { bubble: Va / v.V0 });
    sim.decor.push({ type: 'marker', x0: 4.7, x1: 5.5, y: y0, label: '' });
    sim.decor.push({ type: 'gauge', x: 9.2, y: 6.6, P, unit: v.q.unit });
    if (!placed.has('cap')) { d.setType('static'); return () => null; }
    sim.forces.push(() => { const F = RHO_W * G * (v.Vs + Va) * 1e-6, vel = d.getLinearVelocity(); d.applyForceToCenter(pl.Vec2(-3 * d.getMass() * vel.x, F - 3 * d.getMass() * vel.y), true); });
    return hoverJudge(sim, d, y0, { win: 0.2, hold: 5, up: 'The diver rose: squeeze harder.', down: 'The diver sank: squeeze less.' });
  },
  maxT: 6,
};
const hydrogen = {
  id: 'hydrogen', ch: 5, title: "Charles's Hydrogen Globe", who: 'Jacques Charles (1783)', img: 'charles_balloon',
  quote: 'Iron and oil of vitriol give the lightest air.', skills: ['stoich', 'gaslaw', 'density'],
  concept: { line: 'Metal + acid makes H₂ gas. Moles of gas set the balloon volume.', formula: 'Fe + H₂SO₄ → FeSO₄ + H₂ ↑      n = PV ÷ RT' },
  gen(t, rnd) {
    const T = 293.15, Vm = RGAS * T / PATM * 1000; // L/mol ≈ 24.06
    const ra = rhoAir(T), rH = PATM * 0.002016 / (RGAS * T);
    let metal = 'Fe', M = 55.845, ratio = 1, n, given, me = 20, pay;
    if (t === 0) { n = pick(rnd, [2, 3, 4]); given = [`The balloon needs ${n} mol of H₂`, `Fe + H₂SO₄ → FeSO₄ + H₂  (1 Fe : 1 H₂)`, `Iron: 55.85 g/mol`]; M = 55.85; }
    else if (t === 1) { const VL = pick(rnd, [60, 72, 84]); n = VL / Vm; given = [`Fill: ${VL} L of H₂ at 20 °C, 1 atm`, `1 mol of gas = 24.06 L here`, `Fe → H₂ is 1 : 1 · Fe 55.85 g/mol`]; M = 55.85; }
    else if (t === 2) { const tot = pick(rnd, [90, 100, 110]); n = tot / 1000 / (ra - rH) * 1000 / Vm; given = [`Lift needed: ${tot} g (balloon + payload)`, `Air 1.204, H₂ 0.084 kg/m³ → 1.120 kg/m³ lift`, `24.06 L/mol · Fe 55.85 g/mol`]; M = 55.85; }
    else { metal = 'Al'; M = 26.98; ratio = 2 / 3; n = pick(rnd, [3, 4.5, 6]); given = [`The balloon needs ${n} mol of H₂`, `2 Al + 6 HCl → 2 AlCl₃ + 3 H₂`, `Aluminium: 26.98 g/mol`]; }
    const grams = n * ratio * M;
    const lift = n * Vm / 1000 * (ra - rH) * 1000; // grams of lift
    pay = lift - me;
    return { t, metal, M, ratio, n, Vm, ra, rH, me, pay, given, q: { text: `Grams of ${metal === 'Fe' ? 'iron' : 'aluminium'}?`, unit: 'g', step: 0.1, ans: r2(grams, 1), min: 0, max: 1000, kind: 'number' } };
  },
  goal: () => 'Drop in enough metal so the gas lifts the globe to hover.',
  hints: v => [v.t === 2 ? 'Lift ÷ 1.120 kg/m³ gives the volume of H₂.' : 'Moles of H₂ → moles of metal → grams.', v.ratio !== 1 ? '2 Al make 3 H₂: Al moles = ⅔ × H₂ moles.' : 'grams = moles × molar mass.', `${r2(v.n, 4)} mol × ${r2(v.ratio, 4)} × ${v.M} = ${v.q.ans} g`],
  diagnose(v, a) { if (v.ratio !== 1 && near(a, v.n * v.M, 0.02)) return 'Check the balanced equation: 2 Al give 3 H₂, not 1 : 1.'; if (v.ratio !== 1 && near(a, v.n * 1.5 * v.M, 0.02)) return 'Ratio upside down: Al = ⅔ × H₂, not 3/2.'; if (v.t === 1 && near(a, v.n * 22.4 / v.Vm * v.M * 0 + (v.n * v.Vm / 22.4) * v.M, 0.02)) return '22.4 L/mol is for 0 °C. At 20 °C use 24.06.'; return null; },
  bin: v => [{ key: 'metal', label: v.metal === 'Fe' ? 'Iron filings' : 'Aluminium', icon: 'flask', req: true, snap: { x: 3.2, y: 2.0, r: 2 } }],
  build(sim, v, a, placed) {
    floor(sim);
    sim.decor.push({ type: 'flask', x: 3.0, y: 0.3 });
    const y0 = 4.0, has = placed.has('metal');
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
  quote: 'Distance fallen grows as the square of the time.', skills: ['kinematics', 'calculus', 'sqrt'],
  concept: { line: 'Speed grows steadily (v = g·t). Distance = area under the v–t line.', formula: 'h = ½·g·t²   →   t = √(2h ÷ g)' },
  gen(t, rnd) {
    let h, v, u = 0, given;
    if (t === 0) { h = pick(rnd, [4.9, 4.4, 5.5]); v = pick(rnd, [2, 1.5]); given = [`Drop height to the cart rim: ${h} m`, `Cart speed: ${v} m/s toward the tower`]; }
    else if (t === 1) { h = pick(rnd, [6.5, 7.0, 6.0]); v = pick(rnd, [2.4, 1.8, 2.2]); given = [`Drop: ${h} m · cart ${v} m/s`, `Distance = area under v–t = ½ g t²`]; }
    else if (t === 2) { const tf = pick(rnd, [1.1, 1.2, 1.0]); h = 0.5 * G * tf * tf; v = pick(rnd, [2, 2.5]); given = [`Ball hits at ${r2(G * tf, 2)} m/s (v = g·t)`, `Cart speed ${v} m/s`, `(Find t from the speed!)`]; }
    else { h = pick(rnd, [7.0, 6.0]); u = pick(rnd, [2, 3]); v = pick(rnd, [2.4, 2]); given = [`Ball THROWN down at ${u} m/s from ${h} m`, `h = u·t + ½ g t²  (quadratic)`, `Cart speed ${v} m/s`]; }
    const tf = (-u + Math.sqrt(u * u + 2 * G * h)) / G, d = v * tf;
    return { t, h, v, u, tf, given, q: { text: 'Start the cart how far from the drop line (m)?', unit: 'm', step: 0.05, ans: r2(d, 2), min: 0.3, max: 8, kind: 'place', wrong: [r2(d - 0.5, 2), r2(d + 0.5, 2)] } };
  },
  goal: () => 'Place the cart so it arrives just as the ball lands.',
  hints: v => [v.t === 2 ? 'From v = g·t, t = v ÷ g.' : v.u ? 'Solve ½g t² + u t − h = 0 with the quadratic formula.' : 't = √(2h ÷ g).', `Fall time = ${r2(v.tf, 3)} s`, `d = ${v.v} × ${r2(v.tf, 3)} = ${v.q.ans} m`],
  diagnose(v, a) { if (near(a, v.v * Math.sqrt(v.h / G), 0.04)) return 'Missing the ½: h = ½ g t².'; if (near(a, v.v * 2 * v.h / G, 0.04)) return 'Remember the square root for the time.'; return null; },
  bin: v => [{ key: 'cart', label: 'Cart', icon: 'cart', req: true, rail: { x0: 3.4, x1: 11.4, y: 0.62, toAns: x => r2(Math.round((x - 2.9) / 0.05) * 0.05, 2), fromAns: a => 2.9 + a } }],
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
  quote: 'Water leaves the hole as fast as if it had fallen from the surface.', skills: ['sqrt', 'calculus', 'optimization'],
  concept: { line: 'Jet speed v = √(2gH). Max range when the derivative is zero.', formula: 'x = 2·√(H·y)   (H = depth of hole, y = hole height)' },
  gen(t, rnd) {
    let ys, yh, given, q;
    if (t === 0) { ys = 2.6; yh = pick(rnd, [0.8, 1.0, 1.3]); given = [`Water surface: ${ys} m above floor`, `Hole: ${yh} m above floor`, `v = √(2gH) · fall t = √(2y/g)`]; q = { text: 'Where will the jet land (m from wall)?', unit: 'm', step: 0.05, kind: 'place' }; }
    else if (t === 1) { ys = pick(rnd, [3.2, 3.0]); yh = pick(rnd, [1.1, 0.7, 2.1]); given = [`Surface ${ys} m · hole ${yh} m (above floor)`, `x = 2√(H·y)`]; q = { text: 'Landing spot (m from wall)?', unit: 'm', step: 0.05, kind: 'place' }; }
    else if (t === 2) { ys = pick(rnd, [3.0, 3.4, 2.8]); yh = ys / 2; given = [`Surface ${ys} m above floor`, `Pail sits at the MAXIMUM range`, `Maximize x(y) = 2√((${ys}−y)·y)`]; q = { text: 'Drill the hole at what height (m)?', unit: 'm', step: 0.05, kind: 'number', wrong: [r2(ys * 0.2, 2), r2(ys * 0.8, 2)] }; }
    else { ys = pick(rnd, [3.4, 3.0]); const X = ys === 3.4 ? 3.0 : 2.4; yh = (ys - Math.sqrt(ys * ys - X * X)) / 2; given = [`Surface ${ys} m · pail at ${X} m from wall`, `2√((${ys}−y)·y) = ${X}`]; q = { text: 'Hole height (m)? (two answers work!)', unit: 'm', step: 0.05, kind: 'number', alt: [r2((ys + Math.sqrt(ys * ys - X * X)) / 2, 2)], wrong: [r2(ys / 2, 2)] }; q.X = X; }
    const x = 2 * Math.sqrt((ys - yh) * yh);
    q.ans = q.kind === 'place' ? r2(x, 2) : r2(yh, 2); q.min = 0.1; q.max = q.kind === 'place' ? 7 : ys - 0.1;
    if (q.kind === 'place') q.wrong = [r2(x - 0.45, 2), r2(x + 0.45, 2)];
    return { t, ys, yh, x, X: q.X ?? x, given, q };
  },
  goal: v => v.q.kind === 'place' ? 'Set the pail where the jet lands.' : 'Drill the hole so the jet reaches the pail.',
  hints: v => v.t === 2 ? ['x is biggest where dx/dy = 0.', 'd/dy[(H₀−y)·y] = H₀ − 2y = 0', `y = ${v.ys} ÷ 2 = ${v.q.ans} m`] : v.t === 3 ? ['Square both sides: (H₀−y)·y = x²/4.', `y² − ${v.ys}y + ${r2(v.X * v.X / 4, 3)} = 0`, `y = ${v.q.ans} m or ${v.q.alt[0]} m`] : ['Depth of hole H = surface − hole.', `H = ${r2(v.ys - v.yh, 2)} m; x = 2√(${r2(v.ys - v.yh, 2)}×${v.yh})`, `x = ${v.q.ans} m`],
  diagnose(v, a) { if (v.t < 2 && near(a, Math.sqrt((v.ys - v.yh) * v.yh), 0.04)) return 'Missing the factor 2: x = 2√(H·y).'; if (v.t < 2 && near(a, 2 * Math.sqrt(v.ys * v.yh), 0.04)) return 'H is the depth BELOW the surface, not the surface height.'; return null; },
  bin: v => v.q.kind === 'place' ? [{ key: 'pail', label: 'Pail', icon: 'bucket', req: true, rail: { x0: 3.6, x1: 10.6, y: 0.5, toAns: x => r2(Math.round((x - 3.12) / 0.05) * 0.05, 2), fromAns: a => 3.12 + a } }] : [{ key: 'drill', label: 'Drill', icon: 'drill', req: true, snap: { x: 3.12, y: 1.8, r: 2.5 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const wallX = 3.12, ys = v.ys + 0.3;
    const tank = sim.tank(1.0, 3.0, 0.3, ys, { D: 0.1, top: ys + 0.4 });
    sim.decor.push({ type: 'screw', x0: 0.2, y0: 0.4, x1: 1.3, y1: ys + 0.4, speed: 1 });
    sim.decor.push({ type: 'ruler', x0: wallX, x1: 11.5, y: 0.3, origin: wallX });
    const yh = v.q.kind === 'place' ? v.yh : a;
    const cupX = v.q.kind === 'place' ? wallX + a : wallX + v.X;
    const hasPart = v.q.kind === 'place' ? placed.has('pail') : placed.has('drill');
    sim.decor.push({ type: 'bucket', x: cupX, y: 0.3, w: 0.8, h: 0.5, sunk: true });
    if (hasPart || v.q.kind === 'place') sim.decor.push({ type: 'hole', x: wallX - 0.06, y: yh + 0.3 });
    if (!hasPart) return () => null;
    const vj = Math.sqrt(2 * G * Math.max(0, v.ys - yh));
    let caught = 0, missed = 0, k = 0;
    sim.state.caught = 0;
    sim.forces.push(s => { if (k++ % 3 === 0) s.emit({ x: wallX, y: yh + 0.3, vx: vj, vy: 0, kind: 'drop', floor: 0.3, onStep: (p) => { if (!p.counted && p.y <= 0.3 + 0.02) { p.counted = true; if (Math.abs(p.x - cupX) < 0.36) caught++; else missed++; p.dead = true; } } }); });
    return () => {
      sim.state.caught = caught;
      if (caught >= 20) return { win: true, msg: 'The pail fills. Torricelli is proud!' };
      if (missed >= 12) { const land = wallX + 2 * Math.sqrt(Math.max(0, v.ys - yh) * yh); return land < cupX ? { win: false, dir: 'short', msg: 'The jet falls short of the pail.' } : { win: false, dir: 'long', msg: 'The jet flies past the pail.' }; }
      return null;
    };
  },
  maxT: 4,
};
const cistern = {
  id: 'cistern', ch: 6, title: 'The Cistern Clock', who: 'Archimedes & Ctesibius', img: 'ramelli_water',
  quote: 'Add up every little sip, and you have the whole drink.', skills: ['rates', 'calculus', 'algebra'],
  concept: { line: 'Volume = area under the flow-rate curve Q(t).', formula: 'V(t) = ∫ Q dt  →  Q = a + b·t gives V = a·t + ½·b·t²' },
  gen(t, rnd) {
    const A = 0.4, VOL = 600; let H = 1.5, a = 0, b = 0, given, tt;
    if (t === 0) { a = pick(rnd, [100, 120, 75, 150]); given = [`Screw pours a steady ${a} L/s`, `Cistern floor: ${A} m² · fill line ${H} m`, `1 m³ = 1000 L`]; tt = VOL / a; }
    else if (t === 1) { [a, b] = pick(rnd, [[40, 20], [50, 20], [60, 30], [30, 30]]); given = [`Flow speeds up: Q = ${a} + ${b}·t  L/s`, `Fill ${VOL} L (to the line)`, `V = ${a}t + ½·${b}t²`]; const V = VOL; tt = (-a + Math.sqrt(a * a + 2 * b * V)) / b; }
    else if (t === 2) { b = pick(rnd, [30, 40, 25]); given = [`The horse starts from rest: Q = ${b}·t  L/s`, `Fill ${VOL} L`, `V = ½·${b}·t²`]; tt = Math.sqrt(2 * VOL / b); }
    else { [a, b] = pick(rnd, [[120, -10], [150, -15], [130, -10]]); given = [`The horse tires: Q = ${a} − ${-b}·t  L/s`, `Fill ${VOL} L`, `Take the first time it fills`]; const V = VOL; tt = (-a + Math.sqrt(a * a + 2 * b * V)) / b; }
    return { t, A, H, a, b, tt, VOL, given, q: { text: 'Set the bell: seconds until full?', unit: 's', step: 0.1, ans: r2(tt, 1), min: 0.5, max: 14, kind: 'number', wrong: [r2(tt * 0.85, 1), r2(tt * 1.15, 1)] } };
  },
  goal: () => 'Set the bell to ring the moment the water hits the line.',
  hints: v => [v.b === 0 ? 'Time = volume ÷ rate.' : 'Integrate Q(t) to get V(t), then solve V(t) = target.', v.b === 0 ? `${v.VOL} L ÷ ${v.a} L/s` : v.a === 0 ? `½·${v.b}·t² = ${v.VOL}  →  t = √(2·${v.VOL}÷${v.b})` : `${r2(v.b / 2, 2)}t² + ${v.a}t − ${v.VOL} = 0`, `t = ${v.q.ans} s`],
  diagnose(v, a) { if (v.b && near(a, v.VOL / v.a, 0.02)) return 'The flow changes: integrate Q(t), don\'t just divide.'; if (v.b > 0 && v.a && near(a, (-v.a + Math.sqrt(v.a * v.a + 4 * v.b * v.VOL)) / (2 * v.b), 0.03)) return 'Missing the ½ in ½·b·t².'; return null; },
  bin: v => [{ key: 'bell', label: 'Bell timer', icon: 'bell', req: true, snap: { x: 9.6, y: 6.5, r: 2.2 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const x0 = 5.8, x1 = 8.3, W = x1 - x0, D = v.A / W, y0 = 0.6;
    sim.box(7.05, 0.45, 2.9, 0.3, { static: true, kind: 'stand' });
    const tank = sim.tank(x0, x1, y0, y0 + 0.0001, { D, top: y0 + v.H + 0.6 });
    sim.decor.push({ type: 'marker', x0: x0 - 0.3, x1: x1 + 0.3, y: y0 + v.H, label: 'fill line' });
    sim.decor.push({ type: 'screw', x0: 1.2, y0: 0.4, x1: 5.6, y1: y0 + v.H + 0.8, speed: 1, tank });
    sim.decor.push({ type: 'qgraph', x: 0.6, y: 6.2, a: v.a, b: v.b, T: Math.max(v.tt, a) });
    const has = placed.has('bell');
    if (has) sim.decor.push({ type: 'timer', x: 9.6, y: 6.5, T: a });
    tank.inflow = tt => Math.max(0, v.a + v.b * (tt + DTf / 2)) / 1000 / D;
    if (!has) { tank.inflow = null; return () => null; }
    return () => {
      if (sim.t >= a - 1e-9) {
        const lv = tank.level - y0, err = lv - v.H; sim.state.measured = lv;
        sim.event('bell');
        if (Math.abs(err) <= Math.max(0.04, 0.02 * v.H)) return { win: true, msg: 'Ding! Full to the line, right on time.' };
        return err < 0 ? { win: false, dir: 'early', msg: `Bell rang early: only ${r2(lv * 100, 0)} of ${v.H * 100} cm.` } : { win: false, dir: 'late', msg: 'Bell rang late: the water passed the line.' };
      }
      if (tank.level - y0 > v.H + 0.08) return { win: false, dir: 'late', msg: 'The water passed the line before the bell rang.' };
      return null;
    };
  },
  maxT: (v, a) => Math.min(15, a + 0.5),
};
const siege = {
  id: 'siege', ch: 6, title: "Leonardo's Great Crossbow", who: 'Leonardo da Vinci', img: 'leonardo_crossbow',
  quote: 'At half a right angle the shot flies farthest.', skills: ['trig', 'optimization', 'calculus'],
  concept: { line: 'Range R = v²·sin(2θ) ÷ g. It peaks where dR/dθ = 0: θ = 45°.', formula: 'R = v² · sin 2θ ÷ g' },
  gen(t, rnd) {
    let v, R, given, ans, alt = [];
    if (t === 0) { v = pick(rnd, [7, 6.5, 7.5]); R = v * v / G; given = [`Bolt speed: ${v} m/s`, `Target at MAX range: ${r2(R, 2)} m`, `Find θ where dR/dθ = 0`]; ans = 45; }
    else if (t === 1 || t === 3) { v = t === 1 ? 7 : 8; R = t === 1 ? pick(rnd, [4.0, 3.5]) : pick(rnd, [5.0, 4.5]); const s2 = G * R / (v * v); ans = 0.5 * Math.asin(s2) * 180 / Math.PI; alt = [r2(90 - ans, 1)]; given = [`Bolt speed: ${v} m/s`, `Target: ${R} m away (same height)`, t === 3 ? 'Two angles work. Find either.' : 'sin 2θ = gR ÷ v²']; }
    else { const Rm = pick(rnd, [5.5, 6.0]); v = Math.sqrt(G * Rm); R = pick(rnd, [4.2, 4.5]); const s2 = R / Rm; ans = 0.5 * Math.asin(s2) * 180 / Math.PI; alt = [r2(90 - ans, 1)]; given = [`At 45° the bolt flies ${Rm} m (max)`, `So v² = g × ${Rm}`, `Target: ${R} m`]; }
    return { t, v, R, given, q: { text: 'Aim angle (°)?', unit: '°', step: 0.5, ans: r2(ans, 1), alt, min: 5, max: 85, kind: 'angle', wrong: t === 0 ? [30, 60] : [r2(ans * 0.7, 1), 45] } };
  },
  rotate: () => ({ x: 1.4, y: 1.3, len: 1.0 }),
  goal: () => 'Aim the crossbow so the bolt lands in the basket.',
  hints: v => v.t === 0 ? ['R = v² sin 2θ / g. Biggest when sin 2θ = 1.', 'dR/dθ = 2v² cos 2θ / g = 0 → 2θ = 90°', 'θ = 45°'] : ['sin 2θ = g·R ÷ v²', `sin 2θ = ${r2(G * v.R / (v.v * v.v), 4)}`, `θ = ${v.q.ans}° (or ${v.q.alt[0]}°)`],
  diagnose(v, a) { if (v.t > 0 && near(a, Math.asin(G * v.R / (v.v * v.v)) * 180 / Math.PI, 0.02)) return 'Halve it! sin⁻¹ gives 2θ, not θ.'; return null; },
  bin: v => [{ key: 'bolt', label: 'Ball', icon: 'ball', req: true, snap: { x: 1.4, y: 1.6, r: 2 } }],
  build(sim, v, a, placed) {
    floor(sim);
    const lx = 1.4, ly = 1.3, th = a * Math.PI / 180;
    sim.decor.push({ type: 'crossbow', x: lx, y: ly, ang: th });
    const bx = lx + v.R, iw = 0.7;
    sim.box(bx, (0.3 + ly - 0.5) / 2 + 0.0, 0.5, ly - 0.5 - 0.3, { static: true, kind: 'pedestal' });
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
