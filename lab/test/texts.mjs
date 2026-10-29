// At mathLevel 0, player-facing strings must not show formulas / equation symbols.
import { PUZZLES } from '../js/puzzles.js';
import { mulberry } from '../js/adaptive.js';

const bad = [];
const FORMULA = /[=√]|\bsin\s|\bcos\s|÷|∫|½·|4π|θ|\bkg\s*×|\bm\s*=/;
for (const P of PUZZLES) {
  if (/[=√]/.test(P.concept.line)) bad.push(`concept.line math ${P.id}: ${P.concept.line}`);
  for (let t = 0; t < 4; t++) for (let s = 0; s < 12; s++) {
    const v = P.gen(t, mulberry(s * 977 + t));
    for (const g of v.given || []) {
      if (FORMULA.test(g)) bad.push(`given math ${P.id} t${t}: ${g}`);
    }
    for (const h of P.hints(v)) {
      if (FORMULA.test(h)) bad.push(`hint math ${P.id} t${t}: ${h}`);
    }
    const goal = P.goal(v);
    if (/[=√]/.test(goal)) bad.push(`goal math ${P.id}: ${goal}`);
    for (const x of [...(v.given || []), ...P.hints(v), goal]) {
      if (/\d\.\d{4,}|NaN|undefined|Infinity/.test(x)) bad.push(`noise ${P.id} t${t}: ${x}`);
    }
  }
}
console.log(bad.join('\n') || 'all widget texts clean (no formula glyphs in default copy)');
process.exit(bad.length ? 1 : 0);
