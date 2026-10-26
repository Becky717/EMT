// Adaptive tutor: tracks every attempt in localStorage, scales numbers up on fast wins,
// steps down to an easier variant after repeated misses, and targets weak skills.
export const SKILLS = {
  volume: 'Volume & displacement', density: 'Density', ratio: 'Ratios & proportion', algebra: 'Algebra', moments: 'Moments (torque)',
  work: 'Work & energy', trig: 'Trigonometry', sqrt: 'Roots & powers', kinematics: 'Motion (kinematics)', kelvin: 'Kelvin scale',
  gaslaw: 'Gas laws', stoich: 'Stoichiometry', rates: 'Rates of change', calculus: 'Calculus', optimization: 'Optimization',
};
export const CHAPTERS = [
  { latin: 'Liber Aquae', en: 'Water & Buoyancy', who: 'Archimedes' },
  { latin: 'Liber Vectis', en: 'Levers & Moments', who: 'Archimedes · Leonardo' },
  { latin: 'Liber Trochleae', en: 'Pulleys & Work', who: 'Hero · Brunelleschi · Taccola' },
  { latin: 'Liber Rotarum', en: 'Gears & Ratios', who: 'Leonardo · de Dondi' },
  { latin: 'Liber Galilaei', en: 'Ramps, Pendulums, Flight', who: 'Galileo · Stevin' },
  { latin: 'Liber Aeris', en: 'Airs, Gases & Balloons', who: 'Boyle · Charles · Montgolfier' },
  { latin: 'Liber Fluxionum', en: 'Rates & Change (Calculus)', who: 'Galileo · Torricelli · Leonardo' },
];
export const TIER_NAMES = ['Apprentice', 'Journeyman', 'Master', 'Maestro'];
const KEY = 'renlab.v1';
const FAST_MS = 120000;
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const memStore = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); } }; };

export class Tutor {
  constructor(puzzles, storage) {
    this.P = puzzles; this.store = storage || (typeof localStorage !== 'undefined' ? localStorage : memStore());
    let s = null; try { s = JSON.parse(this.store.getItem(KEY) || 'null'); } catch { s = null; }
    this.s = s && s.v === 1 ? s : { v: 1, p: {}, skills: {}, freeRoam: false, created: Date.now(), wins: 0, seated: false };
    for (const p of puzzles) this.p(p.id);
  }
  p(id) { return this.s.p[id] ||= { tier: 0, stars: 0, wins: 0, fails: 0, streak: 0, failRow: 0, seen: 0, hints: 0, history: [] }; }
  save() { try { this.store.setItem(KEY, JSON.stringify(this.s)); } catch { } }
  reset() { this.s = { v: 1, p: {}, skills: {}, freeRoam: false, created: Date.now(), wins: 0, seated: this.s.seated }; for (const p of this.P) this.p(p.id); this.save(); }
  index(id) { return this.P.findIndex(p => p.id === id); }
  unlocked(id) { const i = this.index(id); if (i <= 0 || this.s.freeRoam) return true; const prev = this.P[i - 1]; return this.p(prev.id).wins > 0 || this.p(id).wins > 0; }
  // Build the next variant for a puzzle: tier follows performance; repeated misses drop to an easier variant.
  variant(id, forceTier) {
    const st = this.p(id), P = this.P[this.index(id)];
    let tier = forceTier ?? st.tier;
    if (forceTier == null && st.failRow >= 2) tier = Math.max(0, st.tier - 1);
    st.seen++; this.save();
    const rnd = mulberry(hash(id) ^ (st.seen * 2654435761));
    const v = P.gen(tier, rnd);
    v.tier = tier; v.seed = st.seen;
    return v;
  }
  record(id, r) {
    const st = this.p(id), P = this.P[this.index(id)];
    const entry = { ok: !!r.win, ms: Math.round(r.ms || 0), tier: r.tier, ans: r.answer, hints: r.hints || 0, ts: Date.now(), diag: r.diag || null };
    st.history.push(entry); if (st.history.length > 40) st.history.shift();
    for (const k of P.skills) { const sk = this.s.skills[k] ||= { ok: 0, bad: 0 }; r.win ? sk.ok++ : sk.bad++; }
    let out;
    if (r.win) {
      st.wins++; st.streak++; st.failRow = 0; this.s.wins++;
      st.stars = Math.max(st.stars, (r.tier ?? 0) + 1);
      if ((r.hints || 0) === 0 && r.ms < FAST_MS && st.tier < 3 && r.tier >= st.tier) { st.tier++; out = { kind: 'levelup', text: `Harder numbers unlocked: ${TIER_NAMES[st.tier]} level.` }; }
      else if (st.tier >= 3 && r.tier >= 3) out = { kind: 'mastered', text: 'Maestro! This concept is mastered.' };
      else out = { kind: 'same', text: r.hints ? 'Solved with a hint. One more without, to level up.' : 'Solved! Do one more a bit faster to level up.' };
    } else {
      st.fails++; st.streak = 0; st.failRow++;
      if (st.failRow >= 2 && st.tier > 0) out = { kind: 'easier', text: 'Let\'s try an easier version of the same idea.' };
      else if (st.failRow >= 3) out = { kind: 'worked', text: 'Here is the worked solution. Then a fresh one.' };
      else out = { kind: 'retry', text: 'Close. Use the hint and try again.' };
    }
    this.save();
    return out;
  }
  weakSkills() {
    return Object.entries(this.s.skills).map(([k, v]) => ({ k, name: SKILLS[k] || k, ok: v.ok, bad: v.bad, score: (v.ok + 1) / (v.ok + v.bad + 2) }))
      .filter(x => x.bad > 0).sort((a, b) => a.score - b.score);
  }
  chapterProgress(ch) { const ps = this.P.filter(p => p.ch === ch); const stars = ps.reduce((s, p) => s + this.p(p.id).stars, 0); return { stars, max: ps.length * 4, solved: ps.filter(p => this.p(p.id).wins > 0).length, n: ps.length }; }
  // What to play next: retry a recent miss, then a weak skill, then the next new puzzle, then the lowest-star review.
  recommend() {
    const un = this.P.filter(p => this.unlocked(p.id));
    const missed = un.filter(p => this.p(p.id).failRow > 0 && this.p(p.id).wins === 0);
    if (missed.length) return { id: missed[0].id, why: 'Finish what you started' };
    const fresh = un.find(p => this.p(p.id).wins === 0);
    const weak = this.weakSkills()[0];
    if (weak && weak.score < 0.5 && this.s.wins % 3 === 2) {
      const cand = un.filter(p => p.skills.includes(weak.k) && this.p(p.id).wins > 0).sort((a, b) => this.p(a.id).stars - this.p(b.id).stars)[0];
      if (cand) return { id: cand.id, why: `Review: ${weak.name}` };
    }
    if (fresh) return { id: fresh.id, why: 'Next new machine' };
    const low = [...un].sort((a, b) => this.p(a.id).stars - this.p(b.id).stars || this.p(a.id).tier - this.p(b.id).tier)[0];
    return { id: low.id, why: 'Level it up' };
  }
  next(id) { const i = this.index(id); for (let k = i + 1; k < this.P.length; k++) if (this.unlocked(this.P[k].id)) return this.P[k].id; return this.recommend().id; }
}
