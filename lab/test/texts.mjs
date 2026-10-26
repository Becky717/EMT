import { PUZZLES } from '../js/puzzles.js';
import { mulberry } from '../js/adaptive.js';
const bad = new Set();
for (const P of PUZZLES) for (let t = 0; t < 4; t++) for (let s = 0; s < 30; s++) {
  const v = P.gen(t, mulberry(s * 977 + t));
  const strs = [...v.given, v.q.text, ...P.hints(v), P.goal(v), ...P.bin(v).map(b => b.label)];
  for (const x of strs) if (/\d\.\d{4,}|NaN|undefined|Infinity/.test(x)) bad.add(`${P.id} t${t}: ${x}`);
  for (const x of v.given) if (x.length > 44) bad.add(`LONG ${P.id} t${t}: ${x} (${x.length})`);
}
console.log([...bad].join('\n') || 'all texts clean');
