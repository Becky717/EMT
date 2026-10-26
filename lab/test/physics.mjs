// Headless physics verification: every puzzle × tier × seeds; correct answer must win, wrong answers must fail.
import { Sim, DT } from '../js/sim.js';
const mod = process.argv[2] || 'all';
const { PUZZLES } = await import('../js/puzzles.js');
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function run(P, v, a) {
  const sim = new Sim();
  const placed = new Set(P.bin(v).filter(b => b.req).map(b => b.key));
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
    const wrongs = v.q.wrong || (v.q.unit === 'stones' || v.q.unit === 'ropes' ? [ans - 1, ans + 1] : v.q.kind === 'gear' ? [] : [ans * 0.85, ans * 1.15].map(x => +x.toFixed(3)));
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
