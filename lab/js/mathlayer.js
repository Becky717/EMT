// Progressive math layer. Default mathLevel=0 = pure widgets (Incredible Machine).
// Re-enable later with ?math=1..5 (hidden for now; no UI control).
//
// Level 0: contraption puzzles only — no formulas, dials, or equation hints.
// Level 1: after a win, optional one-line "what happened" observation.
// Level 2: before Start, optional predict-before-run multiple choice (which side goes up?).
// Level 3: ratios with pictures (no bare algebra).
// Level 4: numbers / simple algebra on the lectern.
// Level 5: full classic math (formulas, Kelvin, stoichiometry, calculus).

export const MATH_MAX = 5;

export function getMathLevel(search = typeof location !== 'undefined' ? location.search : '') {
  try {
    const n = parseInt(new URLSearchParams(search).get('math') ?? '0', 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(MATH_MAX, n));
  } catch { return 0; }
}

/** Observation after a win (level ≥ 1). Prefer puzzle.observe(v, result); else a generic line. */
export function observation(P, v, result) {
  if (typeof P.observe === 'function') return P.observe(v, result);
  if (result?.win) return 'The machine found a balance — every force had a match.';
  return null;
}

/** Predict-before-run prompt (level ≥ 2). */
export function predictPrompt(P, v) {
  if (typeof P.predict === 'function') return P.predict(v);
  return null;
}

/** Whether the lectern may show numeric dials / typed answers. */
export function showNumberDial(level) { return level >= 4; }

/** Whether concept cards may show a formula strip. */
export function showFormula(level) { return level >= 5; }

/** Whether hints may include equations / worked algebra. */
export function showMathHints(level) { return level >= 4; }

/** Whether "Given" lines that look like numeric data sheets are shown. */
export function showGivenSheet(level) { return level >= 3; }
