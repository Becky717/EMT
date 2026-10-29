// Headless physics: every puzzle × tier × seeds; correct solution wins, wrong fails.
import { Sim, DT } from '../js/sim.js';
const mod = process.argv[2] || 'all';
const { PUZZLES } = await import('../js/puzzles.js');
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function placeFor(P, v, a) {
  const placed = new Set();
  for (const b of P.bin(v)) {
    if (b.req) placed.add(b.key);
    if (b.rail) placed.add(b.key);
    if (b.teeth != null && b.teeth === a) placed.add(b.key);
    if (b.value != null && Math.abs(b.value - a) < 1e-6) placed.add(b.key);
  }
  if (v.q.kind === 'gear') placed.add('g' + a);
  return placed;
}

function run(P, v, a) {
  const sim = new Sim();
  const placed = placeFor(P, v, a);
  const judge = P.build(sim, v, a, placed);
  let res = null;
  const maxT = (typeof P.maxT === 'function' ? P.maxT(v, a) : P.maxT);
  while (!res && sim.t < maxT) { sim.step(DT); res = judge(sim); }
  return res || { win: false, msg: 'timeout' };
}

let pass = 0, fail = 0; const rows = [];
for (const P of PUZZLES) {
  if (mod !== 'all' && !mod.split(',').includes(P.id)) continue;
  for (let t = 0; t < 4; t++) for (let seed = 1; seed <= 4; seed++) {
    const v = P.gen(t, mulberry(seed * 7919 + t));
    const ans = v.q.ans;
    if (v.q.min != null && (ans < v.q.min || ans > v.q.max)) { fail++; rows.push(`FAIL-range ${P.id} t${t} ans=${ans} not in [${v.q.min},${v.q.max}]`); }
    // Prefer explicit wrongs; else other discrete choices; else ±15%
    const alts = new Set([ans, ...(v.q.alt || [])].map(x => +x));
    const farEnough = w => {
      const rel = Math.max(0.12 * Math.abs(ans), Math.abs(v.q.step || 0.01) * 3);
      return ![...alts].some(a => Math.abs(w - a) < rel);
    };
    let wrongs = (v.q.wrong || []).filter(farEnough);
    if (!wrongs.length && v.q.choices) wrongs = v.q.choices.filter(farEnough).slice(0, 2);
    if (!wrongs.length && v.q.kind !== 'gear') wrongs = [ans * 0.7, ans * 1.35].map(x => +x.toFixed(3)).filter(farEnough);

    const r = run(P, v, ans);
    const ok = r.win; ok ? pass++ : fail++;
    if (!ok) rows.push(`FAIL-correct ${P.id} t${t} s${seed} ans=${ans} -> ${r.msg}`);
    for (const alt of v.q.alt || []) { const ra = run(P, v, alt); ra.win ? pass++ : (fail++, rows.push(`FAIL-alt ${P.id} t${t} alt=${alt} -> ${ra.msg}`)); }
    for (const w of wrongs) { const rw = run(P, v, w); if (rw.win) { fail++; rows.push(`FAIL-wrongwon ${P.id} t${t} s${seed} ans=${ans} wrong=${w} -> ${rw.msg}`); } else pass++; }
  }
}
console.log(rows.join('\n'));
console.log(`physics checks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
