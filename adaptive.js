// =====================================================================
//  EMT SIM VR — ADAPTIVE LEARNING ("Miss-Spotlight")
//  1) Tracks the skills you miss (saved in localStorage across sessions).
//     Each skill has a weight: it goes UP when you miss it and decays
//     when you get it right (spaced-repetition style).
//  2) Builds a NEW case around your top weak spot, where skipping that
//     exact detail causes a big, realistic problem on the patient/monitor.
//  Standards: NREMT EMT scope / National EMS Education Standards,
//  AHA 2020 + focused updates. Local protocols vary.
// =====================================================================
import { clamp, SCENARIOS } from './rules.js';

// ---------- SKILLS (short text: she reads these in VR)
export const SKILLS = {
  scene:      { label: 'Scene safety + BSI first', why: 'An unsafe scene makes YOU the next patient.' },
  bpCpap:     { label: 'BP before CPAP', why: 'SBP under 90 = no CPAP. It drops the BP even more.' },
  medHx:      { label: 'Ask about ED/PDE5 meds before nitro', why: 'Sildenafil/tadalafil + nitro = BP crash.' },
  allergy:    { label: 'Ask allergies before any med', why: 'A med allergy turns help into anaphylaxis.' },
  bpNitro:    { label: 'BP before EVERY nitro dose', why: 'Nitro drops BP. No dose if SBP under 100.' },
  reassess:   { label: 'Reassess vitals after treatment', why: 'Patients change. Recheck after every intervention.' },
  gag:        { label: 'Gag reflex check before OPA', why: 'OPA + gag reflex = vomiting and aspiration. Use an NPA.' },
  glucose:    { label: 'Glucose on every altered patient', why: 'Low sugar looks like drunk, stroke, or seizure.' },
  spo2:       { label: 'Get SpO2 early', why: 'Low oxygen can look like "just tired" or anxious.' },
  lungs:      { label: 'Listen to lung sounds', why: 'Lungs tell asthma vs CHF vs collapsed lung.' },
  pulseCheck: { label: 'Pulse + breathing check (5-10 s)', why: 'Gasping is NOT breathing. Missed arrest = no CPR.' },
  cpr:        { label: 'High-quality CPR + fast AED', why: 'Each minute without CPR cuts survival 7-10%.' },
  bleedFirst: { label: 'Find + stop big bleeding first', why: 'Massive bleeding kills in minutes - before ABCs.' },
  vent:       { label: 'BVM for inadequate breathing', why: 'Slow or shallow breathing = bag them. A mask alone fails.' },
  ventRate:   { label: 'Correct ventilation rate', why: 'Adult 1 breath every 6 s. Child/infant every 2-3 s.' },
  airwayAdj:  { label: 'Adjunct sizing + suction limits', why: 'OPA mouth-to-jaw, NPA nose-to-ear. Suction 15/10/5 s.' },
  epi:        { label: 'Early epi for anaphylaxis', why: 'Epi is the only drug that reverses anaphylaxis.' },
  medDose:    { label: 'Med doses + 5 rights', why: 'Right patient, med, dose, route, time.' },
};
// mistake keys from rules.js / templates -> skill
const MISTAKE_SKILL = {
  sceneFirst: 'scene', coCrew: 'scene',
  cpapNoBP: 'bpCpap', cpapHypo: 'bpCpap', cpapAMS: 'bpCpap', cpapRR: 'vent', cpapVomit: 'gag', cpapPtx: 'lungs',
  ntgPDE5: 'medHx', ntgNoBP: 'bpNitro', ntgLowBP: 'bpNitro', ntgHypo: 'bpNitro', ntgRepeatNoBP: 'bpNitro',
  asaAllergy: 'allergy', asaGivenAllergic: 'allergy',
  opaGag: 'gag', aspirate: 'gag', npaFace: 'airwayAdj',
  ogAMS: 'medDose', albAMS: 'medDose',
  noCheck: 'pulseCheck', cprPulse: 'pulseCheck', aedPulse: 'pulseCheck', scaSeizure: 'pulseCheck',
  noFlow: 'cpr', postShock: 'cpr', cprCombo: 'cpr', cprROSC: 'pulseCheck',
  bvmRate: 'ventRate', bvmFlow: 'ventRate', rescueRate: 'ventRate', advRate: 'ventRate',
  o2inad: 'vent', bvmAlert: 'vent', nalNoVent: 'vent',
  tqPlace: 'bleedFirst', collarDelay: 'bleedFirst',
  epiDose: 'epi', albAnaph: 'epi',
};
const MEDS = ['asa', 'ntg', 'albuterol', 'epi', 'naloxone', 'oralglucose', 'cpap'];
const RECHECK = ['bp', 'spo2', 'pulse', 'breathing', 'lungs', 'resp', 'glucose'];

// ---------- small helpers (prefixed: the single-file build shares one scope)
const adPick = a => a[Math.floor(Math.random() * a.length)];
const adInt = (a, b) => Math.round(a + Math.random() * (b - a));
const adTalk = (s, who, txt) => { if (s.speech !== txt) { s.speech = txt; s.who = who; } };
const adAfter = (s, id, t) => (s.flags.seq || []).some(([a, at]) => a === id && at >= t);
const adSince = (s, id) => { const t = s.flags.at?.[id]; return t == null ? null : t - (s.flags.firstT || 0); };
const SHIRTS = [0x4a6fa5, 0x6a4c93, 0x2a9d8f, 0xe76f51, 0x8d99ae, 0x588157, 0xbc4749, 0x3d405b, 0xf4a261, 0x264653];
const person = (min, max, sex) => { sex = sex || adPick(['m', 'f']); return { sex, age: adInt(min, max), he: sex === 'm' ? 'he' : 'she', He: sex === 'm' ? 'He' : 'She', his: sex === 'm' ? 'his' : 'her', him: sex === 'm' ? 'him' : 'her', man: sex === 'm' ? 'male' : 'female', shirt: adPick(SHIRTS) }; };
const adVar = (store, key, n) => { let i = Math.floor(Math.random() * n); if (n > 1 && store.lastVar[key] === i) i = (i + 1) % n; store.lastVar[key] = i; return i; };

// ---------- did she do it? per-skill check of a finished round: ['hit'] | ['miss', note] | null (not tested)
const tagged = (s, k) => (s.scn.tags || []).includes(k);
const DETECT = {
  scene: s => s.flags.sceneFirst === true ? ['hit'] : s.flags.sceneFirst === false ? ['miss', 'Started before scene safety/BSI.'] : null,
  bpCpap: s => { const at = s.flags.at || {}; if (!tagged(s, 'bpCpap') && at.cpap == null) return null;
    return at.bp != null && (at.cpap == null || at.bp <= at.cpap) ? ['hit'] : ['miss', at.cpap != null ? 'CPAP before a BP.' : 'No BP taken.']; },
  medHx: s => { const at = s.flags.at || {}; if (at.ntg != null) return at.sample != null && at.sample <= at.ntg ? ['hit'] : ['miss', 'Nitro before asking meds.'];
    return tagged(s, 'medHx') ? (at.sample != null ? ['hit'] : ['miss', 'Never asked SAMPLE/meds.']) : null; },
  allergy: s => { const at = s.flags.at || {}; if (at.asa != null) return at.sample != null && at.sample <= at.asa ? ['hit'] : ['miss', 'Aspirin before asking allergies.'];
    return tagged(s, 'allergy') ? (at.sample != null ? ['hit'] : ['miss', 'Never asked allergies.']) : null; },
  bpNitro: s => (s.flags.at || {}).ntg != null ? ['hit'] : null,
  reassess: s => { const seq = s.flags.seq || [], i = seq.findIndex(([a]) => MEDS.includes(a)); if (i < 0) return null;
    if (seq.slice(i + 1).some(([a]) => RECHECK.includes(a))) return ['hit'];
    return s.t - seq[i][1] > 45 ? ['miss', 'No vitals recheck after treatment.'] : null; },
  gag: s => { const at = s.flags.at || {}; if (!tagged(s, 'gag') && at.opa == null) return null;
    if (s.flags.mistakeKeys.has('opaGag')) return ['miss', 'OPA with a gag reflex.'];
    return at.npa != null || at.airway != null || at.resp != null ? ['hit'] : null; },
  glucose: s => tagged(s, 'glucose') ? ((s.flags.at || {}).glucose != null ? ['hit'] : ['miss', 'No glucose check on an altered patient.']) : null,
  spo2: s => { if (!tagged(s, 'spo2')) return null; const t = adSince(s, 'spo2');
    return t == null ? ['miss', 'Never put the pulse ox on.'] : t > 90 ? ['miss', `Pulse ox at ${Math.round(t)} s (goal: first 90 s).`] : ['hit']; },
  lungs: s => tagged(s, 'lungs') ? (s.flags.lungs ? ['hit'] : ['miss', 'Never listened to lungs.']) : null,
  pulseCheck: s => { if (!tagged(s, 'pulseCheck')) return null; const t = adSince(s, 'pulse');
    return t == null ? ['miss', 'No pulse check.'] : t > 30 ? ['miss', `Pulse check at ${Math.round(t)} s (goal: under 30 s).`] : ['hit']; },
  cpr: s => { if (!tagged(s, 'cpr')) return null; const f = s.flags;
    if (tagged(s, 'aed')) { const t = adSince(s, 'aed'); if (t == null || t > 75) return ['miss', t == null ? 'AED never used.' : `AED at ${Math.round(t)} s (goal: under 75 s).`]; }
    return f.cprQ === 'good' ? ['hit'] : ['miss', f.cprQ ? 'CPR numbers off.' : 'CPR never started.']; },
  bleedFirst: s => { if (!tagged(s, 'bleedFirst')) return null; const f = s.flags, lim = s.scn.tqLimit || 45;
    if (!f.tq) return ['miss', 'No tourniquet.']; const t = f.tqT - (f.firstT || 0);
    return t > lim ? ['miss', `Tourniquet at ${Math.round(t)} s (goal: under ${lim} s).`] : f.tqOK ? ['hit'] : ['miss', 'Tourniquet placed wrong.']; },
  vent: s => { if (!tagged(s, 'vent')) return null; const t = adSince(s, 'bvm');
    return t == null ? ['miss', 'Never bagged.'] : t > 60 ? ['miss', `BVM at ${Math.round(t)} s (goal: under 60 s).`] : ['hit']; },
  epi: s => { if (!tagged(s, 'epi')) return null; const f = s.flags;
    if (f.epiT == null) return ['miss', 'No epi.']; const t = f.epiT - (f.firstT || 0);
    return t > 90 ? ['miss', `Epi at ${Math.round(t)} s (goal: under 90 s).`] : f.epiOK ? ['hit'] : ['miss', 'Epi dose/route wrong.']; },
};

// ---------- persistent store
const AD_KEY = 'emtvr_adaptive_v1';
let AD_MEM = null;
function adLoad() {
  if (AD_MEM) return AD_MEM;
  let d = null; try { d = JSON.parse(localStorage.getItem(AD_KEY)); } catch (e) {}
  if (!d || !d.skills) d = { skills: {}, rounds: 0, lastSkill: null, lastVar: {} };
  d.lastVar = d.lastVar || {};
  if (!d.seeded) { d.seeded = 1; d.skills.bpCpap = { w: 3, miss: 1, hit: 0, last: 0 }; } // her known weak spot: CPAP with SBP < 90
  AD_MEM = d; adSave(); return d;
}
function adSave() { try { localStorage.setItem(AD_KEY, JSON.stringify(AD_MEM)); } catch (e) {} }
const skillRec = (d, k) => (d.skills[k] = d.skills[k] || { w: 0, miss: 0, hit: 0, last: 0 });
export function resetSkills() { AD_MEM = { skills: {}, rounds: 0, lastSkill: null, lastVar: {}, seeded: 1 }; adSave(); }
export function skillData() { return adLoad(); }

// Score a finished round, update weights, return a short report for the debrief.
export function recordRound(s) {
  const d = adLoad(), res = {};
  const set = (k, st, note, severe) => { if (!SKILLS[k]) return; const r = res[k];
    if (st === 'miss') res[k] = { st, note: (r && r.st === 'miss' && r.note) || note || '', severe: severe || (r && r.severe) }; else if (!r) res[k] = { st }; };
  for (const k in DETECT) { const r = DETECT[k](s); if (r) set(k, r[0], r[1]); }
  for (const m of s.mistakes) if (MISTAKE_SKILL[m.key]) set(MISTAKE_SKILL[m.key], 'miss', m.t, m.severe);
  for (const q of s.flags.qRes || []) set(q.skill, q.ok ? 'hit' : 'miss', q.ok ? '' : 'Wrong answer: ' + q.q);
  d.rounds++;
  const misses = [], hits = [];
  for (const k in res) {
    const r = skillRec(d, k), x = res[k];
    if (x.st === 'miss') { r.w = Math.min(10, r.w + 2 + (x.severe ? 1 : 0)); r.miss++; misses.push({ skill: k, ...SKILLS[k], note: x.note, severe: !!x.severe }); }
    else { r.w = r.w * 0.55; if (r.w < 0.3) r.w = 0; r.hit++; hits.push({ skill: k, ...SKILLS[k] }); }
    r.w = Math.round(r.w * 100) / 100; r.last = d.rounds;
  }
  const testedSkill = s.scn.tested;
  const tested = s.scn.tested ? { skill: s.scn.tested, ...SKILLS[s.scn.tested], ok: !(res[s.scn.tested] && res[s.scn.tested].st === 'miss'), trap: s.scn.trap } : null;
  d.lastOk = testedSkill ? tested.ok : true; if (!testedSkill) d.lastSkill = null;
  adSave();
  const rank = m => (m.skill === s.scn.tested ? 2 : 0) + (m.severe ? 1 : 0);
  misses.sort((a, b) => rank(b) - rank(a));
  return { misses, hits, tested, next: pickSkill() };
}
// Highest weight wins; skills not tested lately get a small boost (spaced repetition).
export function pickSkill() {
  const d = adLoad();
  const ranked = Object.entries(d.skills).filter(([k, r]) => r.w > 0 && TEMPLATE_FOR[k])
    .map(([k, r]) => [k, r.w + 0.2 * Math.min(10, d.rounds - (r.last || 0))]).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  // Missed the trap? Re-test it with a fresh case. Beat it (or 2 in a row)? Interleave the next weak spot.
  if (!d.lastOk && d.lastSkill && (d.streak || 0) < 2 && d.skills[d.lastSkill]?.w > 0) return d.lastSkill;
  const rotate = ranked[0][0] === d.lastSkill && (d.lastOk || (d.streak || 0) >= 2);
  if (ranked.length > 1 && rotate && ranked[1][1] >= ranked[0][1] - 3) return ranked[1][0];
  return ranked[0][0];
}
export function topSkills(n = 6) {
  const d = adLoad();
  return Object.entries(d.skills).filter(([k, r]) => r.w > 0 && SKILLS[k]).sort((a, b) => b[1].w - a[1].w).slice(0, n)
    .map(([k, r]) => ({ skill: k, ...SKILLS[k], w: r.w, miss: r.miss, hit: r.hit }));
}
export const skillLabel = k => k && SKILLS[k] ? SKILLS[k].label : 'Mixed review';

// ---------- CASE TEMPLATES: miss -> a new case where that miss is major
// Each make(store, skill) returns a scenario object in the same shape as rules.js SCENARIOS.
const T = {};

// 1) SCENE SAFETY -> carbon monoxide
T.co = { skills: ['scene'], make(st) {
  const p = person(34, 78), v = adVar(st, 'co', 3);
  const V = [
    { title: 'Confused in the garage', disp: `${p.age} y/o ${p.man}, "acting drunk." Home garage.`, scene: `Closed garage, car engine RUNNING. Your CO meter alarms: 380 ppm! You back out, call fire to ventilate, and drag ${p.him} to fresh air. Gloves on.`, sample: `(Neighbor) ${p.He} was "warming up the car" about 40 min. A: none. M: none known. P: healthy. L: unknown. E: headache, then confused.` },
    { title: 'Ice-fishing shack', disp: `${p.age} y/o ${p.man}, headache and vomiting. Ice-fishing shack on the lake.`, scene: `Tiny shack, propane heater on, door shut. Your CO meter alarms: 290 ppm! You prop the door, shut off the heater, and pull ${p.him} out onto the ice. Gloves on.`, sample: `S: bad headache, nausea, dizzy. A: none. M: none. P: none. L: coffee. E: fishing 4 h with the heater on; buddy has a headache too.` },
    { title: 'Storm power outage', disp: `${p.age} y/o ${p.man}, "flu-like," confused. Basement, power outage after a storm.`, scene: `Gas generator running INSIDE the basement. Your CO meter alarms: 420 ppm! You back out, call fire, and carry ${p.him} outside. Gloves on.`, sample: `S: headache, nausea, confused. A: sulfa. M: none. P: none. L: canned soup. E: generator on all night; the family dog is lethargic too.` },
  ][v];
  return { id: 'ad_co', cat: 'Adaptive', tested: 'scene', tags: ['scene', 'glucose'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: 'Invisible CO. No scene check = the crew gets poisoned. Pulse ox reads falsely normal.',
    setup: s => { Object.assign(s.v, { hr: 112, sbp: 132, dbp: 82, rr: 22, spo2: 98, etco2: 34, avpu: 'V', bgl: adInt(95, 125) }); Object.assign(s, { pose: 'sitting', skin: 'normal', sweat: false, chest: 0.7, sex: p.sex, shirt: p.shirt }); s.flags.sev = 0.65; },
    find: { scene: V.scene, sample: V.sample, pupils: 'Pupils equal and reactive.', opqrst: 'Headache 8/10, "like a band." Came on slowly.' },
    update(s, dt, api) {
      const f = s.flags;
      if (f.sceneFirst === false && !f.removed && !f.crewHit) { f.crewHit = true; f.crewT = s.t; api.say('Partner', 'My head is pounding... I feel sick...'); api.bad('coCrew', 'Your CO meter is screaming - you and your partner are breathing carbon monoxide!', 'Scene safety FIRST. CO is invisible. Back out, call fire, then move the patient.', true); }
      if (f.crewHit && !f.removed && s.t - f.crewT > 20) return api.end('fail', 'You and your partner got CO poisoning too - now there are 3 patients. Scene safety + BSI is step one, every call.');
      const o2 = f.o2 === 'nrb' || f.bvm || f.o2 === 'cpap';
      f.sev = clamp(f.sev + (!f.removed ? 0.006 : o2 ? -0.006 : f.o2 === 'nc' ? 0.0005 : 0.0015) * dt, 0.15, 1.6);
      s.v.avpu = f.sev > 1.15 ? 'P' : f.sev > 0.55 ? 'V' : 'A';
      Object.assign(s.target, { hr: 84 + f.sev * 36, sbp: 130 - (f.sev > 1.1 ? 26 : 0), dbp: 80, rr: 16 + f.sev * 8, spo2: 98, etco2: 35 });
      if (s.v.avpu === 'P') s.pose = 'supine'; s.sweat = f.sev > 0.9;
      if (f.sev >= 1.55) return api.end('fail', 'CO kept building in the blood - seizure, then coma. Fresh air + NRB 15 L right away, whatever the pulse ox says.');
      adTalk(s, 'Patient', s.v.avpu === 'A' ? (f.sev < 0.3 ? 'Head\'s clearing... what happened?' : 'My head is killing me... I feel sick.') : s.v.avpu === 'V' ? '(confused) ...where\'s my phone?...' : '(moans only)');
    },
    actions: {
      scene: (s, api) => { s.flags.scene = true; s.flags.removed = true; api.info(s.find.scene); if (s.flags.crewHit) api.log('Fresh air - your partner\'s headache eases. That was close.', 'warn'); },
      spo2: (s, api) => { s.reveal.spo2 = s.reveal.hr = true; s.flags.spo2 = true; api.info(`SpO2 ${Math.round(s.v.spo2)}% - but a pulse ox can't tell CO from O2. A normal number does NOT rule out CO.`); },
    },
    critical: s => [
      { label: 'Scene safety first (CO meter)', why: 'CO is invisible. Rescuers become patients.', ok: s.flags.sceneFirst },
      { label: 'Moved patient to fresh air', why: 'Remove from the source first.', ok: s.flags.removed },
      { label: 'NRB 15 L despite "normal" SpO2', why: 'Pulse ox reads CO as oxygen. High-flow O2 for any CO exposure.', ok: s.flags.o2 === 'nrb' || s.flags.bvm },
      { label: 'Checked glucose (altered)', why: 'Rule out low sugar in any confused patient.', ok: !!s.reveal.bgl },
      { label: 'ALS / transport', why: 'May need a hyperbaric chamber.', ok: s.flags.als || s.flags.transport },
    ] };
} };

// 2) BP BEFORE CPAP -> cardiogenic shock that looks like CHF
T.cardioShock = { skills: ['bpCpap'], make(st) {
  const p = person(66, 84), v = adVar(st, 'cshock', 3), sbp = adInt(76, 86);
  const V = [
    { title: 'Short of breath on a boat', disp: `${p.age} y/o ${p.man}, trouble breathing. Fishing boat at the marina.`, scene: `Boat tied off at the dock, stable. Gloves on. ${p.He} is sitting on the deck cooler, gasping, gray and sweaty.`, sample: `S: can't breathe, weak. A: none. M: metoprolol, furosemide. P: heart attack 2 yrs ago. L: sandwich at noon. E: "chest felt heavy yesterday, I ignored it." Worse since dawn.` },
    { title: 'Church potluck', disp: `${p.age} y/o ${p.man}, short of breath. Church basement.`, scene: `Church hall, safe. Gloves on. ${p.He} is sitting in a folding chair, gasping, cold and clammy.`, sample: `S: short of breath, dizzy. A: codeine. M: lisinopril, aspirin. P: diabetes, CHF. L: potluck 1 h ago. E: "indigestion" all night.` },
    { title: 'Assisted living', disp: `${p.age} y/o ${p.man}, difficulty breathing. Assisted-living apartment.`, scene: `Apartment, safe. Gloves on. Aide says ${p.he} "sounds wet." Swollen ankles, pillows stacked.`, sample: `(Aide) S: breathing worse 2 days, a bit confused today. A: penicillin. M: furosemide, carvedilol, warfarin. P: CHF, MI. L: breakfast. E: refused meds since Monday.` },
  ][v];
  return { id: 'ad_cshock', cat: 'Adaptive', tested: 'bpCpap', tags: ['bpCpap', 'lungs', 'spo2'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: `Looked like CHF, but SBP was ${sbp}. CPAP cuts blood return to the heart - BP crashes.`,
    setup: s => { Object.assign(s.v, { hr: 124, sbp, dbp: Math.round(sbp * 0.62), rr: 30, spo2: 84, etco2: 38, avpu: 'A', bgl: adInt(110, 160) }); Object.assign(s, { pose: 'tripod', skin: 'pale', sweat: true, chest: 0.5, sex: p.sex, shirt: p.shirt, lungs: 'Crackles (rales) in both lungs, halfway up.' }); s.flags.sev = 0.6; s.flags.base = sbp + 5; },
    find: { scene: V.scene, sample: V.sample, opqrst: 'Mild chest heaviness since yesterday. Breathing worse lying flat.' },
    update(s, dt, api) {
      const f = s.flags, cpapOn = s.devices.has('cpap'), o2 = f.o2 === 'nrb' || f.bvm;
      f.sev = clamp(f.sev + (o2 ? -0.0015 : 0.003) * dt, 0.3, 1.6);
      const sbp = f.base - f.sev * 8 - (cpapOn ? 28 : 0) - (f.ntgCrash ? 18 : 0);
      Object.assign(s.target, { sbp, dbp: sbp * 0.62, hr: 112 + f.sev * 14 + (cpapOn ? 12 : 0), rr: 22 + f.sev * 14, spo2: clamp(96 - f.sev * 15 + (o2 ? 6 : f.o2 === 'nc' ? 2 : 0) + (cpapOn ? 3 : 0), 70, 97), etco2: 38 });
      s.v.avpu = s.v.sbp < 70 || f.sev > 1.4 ? 'V' : 'A';
      if (s.v.avpu === 'V' && s.pose === 'tripod') s.pose = 'sitting';
      s.skin = f.sev > 1.05 ? 'cyanotic' : 'pale'; s.chest = clamp(1 - f.sev * 0.55, 0.3, 1);
      s.lungs = f.sev > 0.9 ? 'Crackles all the way up, gurgling.' : 'Crackles (rales) in both lungs, halfway up.';
      if (cpapOn && s.v.sbp < 72 && !f.warn) { f.warn = true; api.say('Partner', 'BP is tanking! Get that CPAP off - NRB!'); }
      if (s.v.sbp < 62) { f.lowT = (f.lowT || 0) + dt; if (f.lowT > 20) return api.end('fail', 'BP fell until the heart stopped. This was cardiogenic shock: SBP under 90 = NO CPAP. NRB + ALS.'); }
      adTalk(s, 'Patient', s.v.avpu === 'V' ? '(gray, eyes rolling) ...so dizzy...' : cpapOn ? 'Everything\'s... going gray...' : f.sev > 0.9 ? 'Feel... like... drowning...' : 'Can\'t... catch... my breath.');
    },
    actions: {
      ntg: (s, api) => { s.flags.ntgCrash = true; api.bad('ntgHypo', 'BP drops even lower!', 'Never nitro with SBP under 100. And EMTs assist nitro for chest pain only.', true); },
      posSupine: (s, api) => { s.pose = 'supine'; s.flags.supine = true; s.flags.sev += 0.1; api.bad('supine', 'Lying flat floods the lungs - SpO2 drops.', 'Keep a short-of-breath patient sitting up (semi-sitting if BP is low).'); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'BP BEFORE any CPAP decision', why: `SBP was ${sbp}. Under 90 = no CPAP.`, ok: s.flags.at?.bp != null && s.flags.at.bp <= (s.flags.at.cpap ?? 1e9) },
      { label: 'Listened to lungs (crackles)', why: 'Crackles = fluid in the lungs.', ok: s.flags.lungs },
      { label: 'NO CPAP - used NRB 15 L instead', why: 'CPAP raises chest pressure and drops BP further.', ok: !s.flags.cpapHarm && (s.flags.o2 === 'nrb' || s.flags.bvm) },
      { label: 'Early ALS', why: 'Cardiogenic shock needs ALS + a cath lab.', ok: s.flags.als },
      { label: 'Transported', why: 'Don\'t delay.', ok: s.flags.transport },
    ] };
} };

// shared chest-pain physiology for templates 3, 4, 11
function cpUpdate(s, dt, api, extra) {
  const f = s.flags;
  if (f.crash) {
    Object.assign(s.target, { sbp: (f.supine ? 80 : 68), dbp: 40, hr: f.bradyCrash ? 48 : 124, spo2: 93 + (f.o2 ? 3 : 0) });
    s.skin = 'pale'; s.sweat = true; s.v.avpu = s.v.sbp < 76 ? 'V' : 'A'; if (s.v.avpu === 'V' && s.pose === 'tripod') s.pose = 'sitting';
    adTalk(s, 'Patient', s.v.avpu === 'V' ? '(gray, slumping) ...' : 'I feel... like I\'m going to pass out...');
    if (!f.crashLog) { f.crashLog = true; api.say('Partner', 'BP is in the 60s! Lay them flat, NRB, get ALS!'); }
    return;
  }
  Object.assign(s.target, { hr: f.hr0 + f.pain * 1.2, sbp: f.sbp0 - (f.ntgDrop || 0) + (f.supine && f.ntgDrop ? 8 : 0), dbp: f.sbp0 * 0.6, rr: 16 + f.pain * 0.5, spo2: 95 + (f.o2 ? 2 : 0) });
  s.sweat = f.pain > 4;
  extra && extra(s, dt, api);
}
function cpAsa(allergic) {
  return (s, api) => {
    const f = s.flags;
    if (f.asa) return api.info('Aspirin already given.');
    if (!f.sample) api.bad('asaAllergy', 'Gave aspirin without asking allergies.', 'Ask SAMPLE (A = allergies, recent GI bleed) before aspirin.');
    else if (allergic) api.bad('asaGivenAllergic', 'Gave aspirin to someone ALLERGIC to it.', 'Aspirin allergy = never give aspirin. Tell ALS.', true);
    api.prompt({ q: 'Aspirin dose for suspected ACS?', options: ['81 mg swallowed whole', '162-324 mg chewed', '650 mg', '1,000 mg chewed'], correct: 1, explain: '162-324 mg (2-4 baby aspirin), chewed.', skill: 'medDose', then: ok => {
      f.asa = true; f.asaOK = ok && !allergic;
      if (allergic) { f.rxT = s.t; api.log('Chewed. A minute later: "My lips are tingling..."', 'bad'); } else api.good('Aspirin chewed.');
    } });
  };
}
// was BP checked since the previous nitro dose? (the current ntg action is the last seq entry)
const adBpSinceNtg = s => { const q = s.flags.seq || []; for (let i = q.length - 2; i >= 0; i--) { if (q[i][0] === 'bp') return true; if (q[i][0] === 'ntg') return false; } return true; };
const adBpAfterFirstNtg = s => { const q = s.flags.seq || [], i = q.findIndex(([a]) => a === 'ntg'); return i >= 0 && q.slice(i + 1).some(([a]) => a === 'bp'); };
const ntgGive = (s, api) => { const f = s.flags; f.ntg = (f.ntg || 0) + 1; f.ntgGiven = true; f.lastNtgT = s.t; f.pain = Math.max(2, f.pain - 3); api.good(`Assisted nitro 0.4 mg SL (dose ${f.ntg}). Recheck BP before any repeat (3-5 min).`); };

// 3) MED HISTORY -> PDE5 inhibitor + nitro
T.pde5 = { skills: ['medHx'], make(st) {
  const v = adVar(st, 'pde5', 3);
  const p = v === 1 ? person(46, 58, 'f') : person(54, 72, 'm');
  const V = [
    { title: 'Chest pain at a casino', disp: `${p.age} y/o male, chest pain. Casino hotel room.`, scene: 'Hotel room, safe. Gloves on. Man on the bed edge, fist on chest, sweaty.', say: 'I take nitro for this. Just give me one, quick!', sample: 'S: crushing chest pressure. A: none. M: his own nitro 0.4 mg SL (not expired), lisinopril, and TADALAFIL (Cialis) 5 mg every morning "for my prostate" - took it today. P: angina. L: buffet 1 h ago. E: walking from the parking garage.', drug: 'tadalafil (Cialis) "for my prostate" - it counts, and lasts 48 h.' },
    { title: 'Chest pain at the gym', disp: `${p.age} y/o female, chest pain. Gym locker room.`, scene: 'Locker room, safe. Gloves on. Woman on a bench, pale, rubbing her chest.', say: 'I have nitro in my bag. Please, it always helps.', sample: 'S: chest pressure into her jaw. A: none. M: her own nitro 0.4 mg SL, and SILDENAFIL (Revatio) 20 mg 3x/day for pulmonary hypertension - last dose 2 h ago. P: pulmonary hypertension, angina. L: smoothie. E: treadmill.', drug: 'sildenafil (Revatio) for lung pressure - same drug as Viagra.' },
    { title: 'Chest pain at a wedding', disp: `${p.age} y/o male, chest pain. Wedding reception hall.`, scene: 'Reception hall, music off, guests back. Gloves on. Man in a suit, sweaty, holding his chest.', say: 'Doc gave me nitro for this... it\'s in my jacket.', sample: 'S: chest pressure, nausea. A: none. M: his own nitro 0.4 mg SL, atorvastatin, and VARDENAFIL (Levitra) about 4 h ago - "didn\'t think that counted." P: angina. L: wedding dinner. E: dancing.', drug: 'vardenafil (Levitra) 4 h ago.' },
  ][v];
  return { id: 'ad_pde5', cat: 'Adaptive', tested: 'medHx', tags: ['medHx', 'allergy', 'bpNitro', 'spo2'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: `Meds list had ${V.drug} Nitro + PDE5 drug = severe BP crash.`,
    setup: s => { Object.assign(s.v, { hr: 96, sbp: adInt(138, 154), dbp: 90, rr: 20, spo2: 95, etco2: 36, avpu: 'A', bgl: 118 }); Object.assign(s, { pose: 'sitting', skin: 'pale', sweat: true, chest: 0.75, sex: p.sex, shirt: p.shirt }); Object.assign(s.flags, { pain: 8, hr0: 86, sbp0: s.v.sbp - 10 }); s.say('Patient', V.say); },
    find: { scene: V.scene, opqrst: 'O: sudden, with exertion. P: nothing helps. Q: pressure. R: left arm/jaw. S: 8/10. T: 25 min.' },
    update(s, dt, api) { cpUpdate(s, dt, api, s => adTalk(s, 'Patient', s.flags.pain >= 7 ? 'Pressure... like a weight on my chest.' : 'A little better.')); },
    actions: {
      sample: (s, api) => { s.flags.sample = true; api.info(V.sample); },
      asa: cpAsa(false),
      ntg: (s, api) => { const f = s.flags; if (!f.bpChecked) api.bad('ntgNoBP', 'Nitro given without a BP.', 'Always check BP before nitro.', true);
        f.crash = true; f.ntgGiven = true; api.bad('ntgPDE5', 'BP CRASHES into the 60s!', 'PDE5 drugs (sildenafil, tadalafil, vardenafil) + nitro = severe low BP. Ask EVERY time - including pills for prostate or lung pressure.', true); },
      nrb: (s, api) => { s.flags.o2 = 'nrb'; s.devices.add('nrb'); s.devices.delete('nc'); api.info(s.flags.crash ? 'Good - hypotensive now.' : 'OK. AHA: O2 if SpO2 under 94% or distress.'); },
      posSupine: (s, api) => { s.pose = 'supine'; s.flags.supine = true; api.info(s.flags.crash ? 'Good - lying flat helps BP.' : 'Most chest-pain patients prefer sitting.'); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'SAMPLE before any med', why: 'That is where the PDE5 drug shows up.', ok: !!s.flags.sample && s.flags.at.sample <= (s.flags.at.ntg ?? 1e9) },
      { label: 'Aspirin 162-324 mg chewed', why: 'No allergy here - aspirin is still right.', ok: s.flags.asaOK },
      { label: 'WITHHELD nitro (PDE5 drug)', why: 'Sildenafil/vardenafil 24 h, tadalafil 48 h = no nitro.', ok: !s.flags.ntgGiven },
      { label: 'ALS / early transport', why: 'Possible STEMI.', ok: s.flags.als || s.flags.transport },
    ] };
} };

// 4) ALLERGIES -> aspirin allergy in ACS
T.asaAllergy = { skills: ['allergy', 'medDose'], make(st) {
  const v = adVar(st, 'asa', 3), p = person(55, 76, v === 0 ? 'f' : 'm');
  const V = [
    { title: 'Chest pain at bowling', disp: `${p.age} y/o female, chest pain. Bowling alley.`, scene: 'Bowling alley, safe. Gloves on. Woman sitting at the lane, sweaty, hand on her chest.', say: 'My friend says chew an aspirin. Should I?', allergy: 'ASPIRIN - "my throat swelled shut in 2019"' },
    { title: 'Shoveling snow', disp: `${p.age} y/o male, chest pain. Driveway, shoveling snow.`, scene: 'Icy driveway - you salt a path. Gloves on. Man sitting on his porch step, gray and sweaty.', say: 'Just give me an aspirin, I\'ll be fine.', allergy: 'ASPIRIN and ibuprofen - "hives and wheezing, ended up in the ER"' },
    { title: 'Rest-stop trucker', disp: `${p.age} y/o male, chest pain. Highway rest stop.`, scene: 'Rest stop, truck parked, engine off. Gloves on. Driver in the cab doorway, clutching his chest.', say: 'Got any aspirin? That\'s what you do, right?', allergy: 'ASPIRIN - "ICU, they had to put a tube in"' },
  ][v];
  return { id: 'ad_asa', cat: 'Adaptive', tested: 'allergy', tags: ['allergy', 'medHx', 'bpNitro', 'spo2'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: `Allergies: ${V.allergy}. Aspirin without asking = anaphylaxis.`,
    setup: s => { Object.assign(s.v, { hr: 94, sbp: adInt(144, 158), dbp: 90, rr: 20, spo2: 95, etco2: 36, avpu: 'A', bgl: 124 }); Object.assign(s, { pose: 'sitting', skin: 'pale', sweat: true, chest: 0.75, sex: p.sex, shirt: p.shirt }); Object.assign(s.flags, { pain: 8, hr0: 84, sbp0: s.v.sbp - 10, ana: 0 }); s.say('Patient', V.say); },
    find: { scene: V.scene, opqrst: 'O: sudden. P: nothing helps. Q: squeezing. R: left arm. S: 8/10. T: 20 min.',
      sample: `S: chest squeezing, nausea. A: ${V.allergy}. M: own nitro 0.4 mg SL (not expired), metformin. No ED drugs. P: diabetes, angina. L: 2 h ago. E: exertion.` },
    update(s, dt, api) {
      const f = s.flags;
      if (f.rxT != null && s.t - f.rxT > 15) {
        f.ana = clamp(f.ana + (f.epiT != null && s.t - f.epiT > 8 ? -0.012 : 0.009) * dt, 0, 1.6);
        if (!f.anaLog && f.ana > 0.25) { f.anaLog = true; api.say('Patient', 'My throat... it\'s getting tight...'); api.log('Allergic reaction to the aspirin: hives, swelling, wheeze, BP falling. Treat as anaphylaxis.', 'bad'); }
        s.hives = f.ana > 0.2; s.swelling = f.ana > 0.45; s.lungs = f.ana > 0.4 ? 'Wheezes everywhere + stridor starting.' : '';
        Object.assign(s.target, { hr: 100 + f.ana * 40, sbp: f.sbp0 - f.ana * 75, dbp: 80 - f.ana * 40, rr: 18 + f.ana * 16, spo2: clamp(96 - f.ana * 16 + (f.o2 === 'nrb' ? 5 : 0), 70, 99) });
        s.v.avpu = f.ana > 1.25 ? 'V' : 'A'; s.skin = f.ana > 1 ? 'pale' : f.ana > 0.3 ? 'flushed' : 'pale';
        if (f.ana > 0.2) adTalk(s, 'Patient', f.ana > 0.5 ? 'Can\'t... swallow... throat...' : 'I itch all over...');
        if (f.ana >= 1.55) return api.end('fail', 'Anaphylaxis to the aspirin closed the airway. Ask allergies BEFORE every med.');
        if (f.ana > 0.2) return;
      }
      cpUpdate(s, dt, api, s => adTalk(s, 'Patient', s.flags.pain >= 7 ? 'It\'s squeezing... down my arm.' : 'Better... still some pressure.'));
    },
    actions: {
      asa: cpAsa(true),
      ntg: (s, api) => { const f = s.flags; if (!f.bpChecked) api.bad('ntgNoBP', 'Nitro given without a BP.', 'Always check BP before nitro.', true);
        if (s.v.sbp < 100) { f.crash = true; return api.bad('ntgLowBP', 'SBP too low for nitro - BP falls more.', 'No nitro if SBP under 100.', true); }
        if ((f.ntg || 0) >= 3) return api.info('Max 3 doses - contact medical control.'); ntgGive(s, api); },
      epi: (s, api) => { const f = s.flags; if (f.rxT == null) return api.bad('epiNI', 'Epi raises HR and BP - not indicated now.', 'Epi is for anaphylaxis.', true);
        if (f.epiT != null) return api.info('Repeat epi per medical control in 5-15 min if no better.');
        api.prompt({ q: 'Anaphylaxis from the aspirin. Epi auto-injector how?', options: ['0.3 mg IM, outer thigh, hold about 3 s', 'Into a vein', 'Under the tongue', 'Into the buttock'], correct: 0, explain: 'Adult 0.3 mg IM, lateral thigh (per protocol).', skill: 'epi', then: ok => { f.epiT = s.t; f.epiOK = ok; api.good('Epi in. Watch for improvement. Reassess vitals.'); } }); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'SAMPLE (allergies) BEFORE aspirin', why: 'The aspirin allergy was on the list.', ok: !!s.flags.sample && s.flags.at.sample <= (s.flags.at.asa ?? 1e9) },
      { label: 'Withheld aspirin', why: 'Allergy = contraindication. Tell ALS / the ED.', ok: !s.flags.asa },
      { label: 'BP before nitro', why: 'SBP must be 100+.', ok: !!s.flags.bpChecked && !s.flags.mistakeKeys.has('ntgNoBP') },
      ...(s.flags.rxT != null ? [{ label: 'Epi for the reaction', why: 'Hives + wheeze + low BP = anaphylaxis = epi.', ok: s.flags.epiT != null }] : []),
      { label: 'ALS / early transport', why: 'Possible STEMI.', ok: s.flags.als || s.flags.transport },
    ] };
} };

// 5) GAG REFLEX -> semi-responsive patient who vomits + aspirates with an OPA
T.gagTrap = { skills: ['gag', 'airwayAdj'], make(st) {
  const v = adVar(st, 'gag', 3), p = person(v === 0 ? 18 : 30, v === 0 ? 24 : 52);
  const V = [
    { title: 'Seizure at a festival', disp: `${p.age} y/o ${p.man}, seizure. Music festival, medical tent.`, scene: 'Festival medical tent, security present. Gloves on. Friends say the seizure lasted about 2 min and stopped.', sample: '(Friend) S: seizure, now "out of it." A: unknown. M: none. P: no seizures before. L: no food all day, hot. E: dancing in the heat, no sleep 2 days.', drunk: false },
    { title: 'Laundromat collapse', disp: `${p.age} y/o ${p.man}, seizure. Laundromat.`, scene: 'Laundromat, safe. Gloves on. Bystander says the shaking stopped 3 min ago. Wet pants (incontinent).', sample: '(Bracelet + bystander) S: seizure. A: none. M: levetiracetam - "ran out last week." P: epilepsy. L: unknown. E: dropped while folding clothes.', drunk: false },
    { title: 'Wedding after-party', disp: `${p.age} y/o ${p.man}, "passed out drunk." Hotel ballroom.`, scene: 'Ballroom, safe. Gloves on. Strong smell of alcohol. Friends say 10+ drinks.', sample: '(Friend) S: passed out. A: none. M: none. P: none. L: wedding dinner. E: heavy drinking for 4 h.', drunk: true },
  ][v];
  return { id: 'ad_gag', cat: 'Adaptive', tested: 'gag', tags: ['gag', 'glucose', 'spo2'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: 'Responds to pain + gags = OPA causes vomiting and aspiration. NPA + recovery position + suction.',
    setup: s => { Object.assign(s.v, { hr: 104, sbp: 136, dbp: 84, rr: 12, spo2: 88, etco2: 44, avpu: 'P', bgl: adInt(86, 120) }); Object.assign(s, { pose: 'supine', skin: 'pale', sweat: !V.drunk, chest: 0.5, sex: p.sex, shirt: p.shirt, lungs: 'Snoring up top; lungs clear.' }); s.flags.gag = true; s.flags.drunk = V.drunk; },
    find: { scene: V.scene, sample: V.sample, resp: 'Moans and pulls away from a sternal rub (P).',
      airway: 'SNORING = tongue blocking. Head-tilt chin-lift opens it (no trauma). When you look in the mouth: a strong GAG.', pupils: 'Equal, sluggish.', bleeding: 'Bit tongue; no major bleeding.' },
    update(s, dt, api) {
      const f = s.flags;
      if (f.airwayChecked || f.adjunct) f.airwayOpen = true;
      if (f.drunk && !f.spontV && s.t > 80 && !f.recovery && !f.suctioned) { f.spontV = true; s.vomit = true; api.say('Partner', 'Vomiting! Roll them and suction!'); }
      if (s.vomit) { f.vomT = (f.vomT || 0) + dt * (f.recovery ? 0.4 : 1);
        if (f.vomT > 12 && !f.aspirated) { f.aspirated = true; api.bad('aspirate', 'Vomit went into the lungs (aspiration).', 'Gag + vomit = suction now (adult max 15 s) and recovery position. That\'s why no OPA with a gag.', true); }
        if (f.vomT > 70) return api.end('fail', 'Vomit blocked the airway. Gag reflex = NPA, not OPA. Suction + recovery position.');
      }
      if (f.aspirated) s.lungs = 'Gurgling; coarse crackles (rhonchi) on the right - aspiration.';
      const o2 = { nc: 3, nrb: 7 }[f.o2] || (f.bvm ? 7 : 0);
      s.target.spo2 = clamp(88 + (f.airwayOpen ? 4 : 0) + o2 - (s.vomit ? 9 : 0) - (f.aspirated ? 7 : 0), 66, 99);
      Object.assign(s.target, { hr: s.v.spo2 < 85 ? 122 : 100, rr: f.aspirated ? 26 : 14, sbp: 134, etco2: 42 });
      if (s.v.spo2 > 92 && !f.drunk) { f.wake = (f.wake || 0) + dt; s.v.avpu = f.wake > 150 ? 'A' : f.wake > 70 ? 'V' : 'P'; }
      s.skin = s.v.spo2 < 85 ? 'cyanotic' : 'pale'; s.chest = 0.6;
      adTalk(s, s.v.avpu === 'P' ? 'Bystander' : 'Patient', s.v.avpu === 'A' ? 'Wh... what happened? My tongue hurts.' : s.v.avpu === 'V' ? '(groggy) ...mm...' : s.vomit ? 'Are they choking?!' : 'Why the snoring sound?');
    },
    actions: {
      posRecovery: (s, api) => { s.pose = 'supine'; s.flags.recovery = true; api.good('Recovery position - fluids drain out of the mouth.'); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'Opened the airway', why: 'Snoring = tongue. Head-tilt chin-lift or NPA.', ok: s.flags.airwayOpen },
      { label: 'NPA, NOT OPA (gag reflex)', why: 'OPA only with NO gag reflex.', ok: !s.flags.mistakeKeys.has('opaGag') },
      ...(s.flags.vomitedFromOPA || s.flags.spontV ? [{ label: 'Suctioned the vomit fast', why: 'Adult max 15 s per try, then re-oxygenate.', ok: s.flags.suctioned && !s.flags.aspirated }] : []),
      { label: 'Recovery position', why: 'Drains vomit when they can\'t protect the airway.', ok: s.flags.recovery },
      { label: 'Checked glucose', why: 'Low sugar causes seizures and mimics drunk.', ok: !!s.reveal.bgl },
      { label: 'O2 + transport', why: 'Monitor the airway all the way.', ok: !!(s.flags.o2 || s.flags.bvm) && s.flags.transport },
    ] };
} };

// 6) GLUCOSE -> hypoglycemia mimic
T.hypo = { skills: ['glucose'], make(st) {
  const v = adVar(st, 'hypo', 3), p = v === 1 ? person(68, 82, 'f') : v === 2 ? person(15, 17) : person(30, 55, 'm');
  const V = [
    { title: '"Drunk" at a bar', disp: `${p.age} y/o male, "intoxicated," police on scene. Sports bar.`, scene: 'Bar, police present, safe. Gloves on. Man slumped on a stool, slurring, sweaty. Officer: "He\'s just drunk."', sample: 'S: confused. A: none. M: insulin pump (on his belt). P: type 1 diabetes. L: "two beers, no dinner." E: played basketball after work.', say: 'I\'m fine... jus\' lemme go home...', mimic: 'drunk' },
    { title: 'Stroke? at home', disp: `${p.age} y/o female, possible stroke. Home.`, scene: 'Kitchen, safe. Gloves on. Woman at the table, slurred speech, right arm weak. Daughter: "It\'s a stroke, take her to the stroke center!"', sample: '(Daughter) S: slurred speech, right arm weak 30 min. A: none. M: insulin glargine + lispro, lisinopril. P: diabetes, high BP. L: "I don\'t think she ate breakfast." E: took her insulin this morning.', say: 'M-my... arm... won\'t...', mimic: 'stroke' },
    { title: 'Combative athlete', disp: `${p.age} y/o ${p.man}, combative after practice. High-school locker room.`, scene: 'Locker room, coach present, safe. Gloves on. Teen pacing, sweaty, swinging at teammates.', sample: '(Coach) S: confused, aggressive. A: none. M: insulin. P: type 1 diabetes. L: skipped lunch. E: 2-h practice.', say: 'Get OFF me! Leave me alone!', mimic: 'combative' },
  ][v];
  return { id: 'ad_hypo', cat: 'Adaptive', tested: 'glucose', tags: ['glucose', 'spo2'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: `Looked ${V.mimic === 'stroke' ? 'like a stroke' : V.mimic}. Glucose was in the 30s. Only a glucometer finds it.`,
    setup: s => { const bgl = adInt(28, 40); Object.assign(s.v, { hr: 108, sbp: 142, dbp: 86, rr: 18, spo2: 97, etco2: 35, avpu: 'A', bgl }); Object.assign(s, { pose: 'sitting', skin: 'pale', sweat: true, chest: 0.85, sex: p.sex, shirt: p.shirt }); s.flags.bgl = bgl; s.say('Patient', V.say); },
    find: { scene: V.scene, sample: V.sample, resp: 'Eyes open, but confused - doesn\'t know the day or place (A, disoriented).', pupils: 'Equal and reactive.', opqrst: 'Can\'t give a clear history.' },
    update(s, dt, api) {
      const f = s.flags;
      if (f.ogT != null && s.t - f.ogT > 15) f.bgl = Math.min(96, f.bgl + 0.9 * dt);
      else if (f.d10T != null && s.t - f.d10T > 5) f.bgl = Math.min(120, f.bgl + 3 * dt);
      else f.bgl = Math.max(18, f.bgl - 0.05 * dt);
      s.v.bgl = Math.round(f.bgl);
      if (f.als && s.v.avpu !== 'A' && f.d10T == null && s.t - f.alsT > 30) { f.d10T = s.t; api.say('Paramedic', 'IV in. Giving D10 now.'); }
      if (f.bgl >= 70) { s.v.avpu = 'A'; s.sweat = f.bgl < 80; s.skin = 'normal'; Object.assign(s.target, { hr: 92, sbp: 136, rr: 16, spo2: 98 });
        adTalk(s, 'Patient', V.mimic === 'stroke' ? 'Oh my... my arm works again. Did I skip breakfast?' : 'Whoa... what happened? I skipped a meal...'); return; }
      const low = s.t - (f.firstT || 0);
      if (low > 110 && s.v.avpu === 'A' && f.ogT == null) { s.v.avpu = 'V'; api.log('Harder to wake now - can\'t safely swallow oral glucose anymore.', 'bad'); }
      if (low > 180 && !f.seized && f.ogT == null) { f.seized = true; f.seizeT = s.t; s.v.avpu = 'P'; s.pose = 'supine'; api.say('Partner', 'Seizure! Protect the head! Sugar must be really low!'); api.log('Hypoglycemic seizure. Oral glucose is off the table - ALS for IV dextrose.', 'bad'); }
      Object.assign(s.target, { hr: 108 + (f.seized ? 15 : 0), sbp: 140, rr: f.seized ? 10 : 18, spo2: f.seized ? 90 + (f.o2 ? 6 : 0) : 97 });
      adTalk(s, 'Patient', s.v.avpu === 'P' ? (s.t - f.seizeT < 40 ? '(unresponsive, jerking)' : '(unresponsive)') : s.v.avpu === 'V' ? '(mumbles) ...' : V.say);
    },
    actions: {
      oralglucose: (s, api) => {
        const f = s.flags; if (s.v.avpu !== 'A') return api.bad('ogAMS', 'Can\'t give oral glucose - can\'t swallow safely.', 'Oral glucose needs an alert patient who can swallow. Call ALS for IV dextrose.', true);
        if (f.ogT != null) return api.info('Already given. Recheck glucose in a few minutes.');
        if (!s.reveal.bgl) api.log('Tip: check the glucose first when you can - it proves the cause.', 'warn');
        api.prompt({ q: 'Oral glucose. How?', options: ['1 tube (15-24 g) between cheek and gum; alert, can swallow', 'Squeeze it down the throat fast', 'Wait for a phone order first', 'Mix it with water and pour it in'], correct: 0, explain: 'Oral glucose: 15-24 g, between cheek and gum, only if alert and able to swallow.', skill: 'medDose', then: () => { f.ogT = s.t; api.good('Oral glucose given. Recheck BGL in a few minutes.'); } });
      },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'Glucose checked in the first 90 s', why: `Altered = check sugar. It ${V.mimic === 'stroke' ? 'mimics a stroke' : 'looks like ' + V.mimic}.`, ok: s.flags.at?.glucose != null && adSince(s, 'glucose') <= 90 },
      { label: 'Oral glucose while still alert (or ALS)', why: 'Once drowsy, oral glucose is out - ALS gives IV dextrose.', ok: s.flags.ogT != null || s.flags.d10T != null },
      { label: 'Rechecked glucose after treatment', why: 'Reassess: did it work?', ok: (s.flags.ogT != null && adAfter(s, 'glucose', s.flags.ogT + 1)) || (s.flags.d10T != null && adAfter(s, 'glucose', s.flags.d10T)) },
      { label: 'Transport / ALS', why: 'Insulin outlasts oral glucose.', ok: s.flags.transport || s.flags.als },
    ] };
} };

// 7) SpO2 -> silent hypoxia (PE / pneumonia)
T.hypox = { skills: ['spo2'], make(st) {
  const v = adVar(st, 'hypox', 3), p = v === 0 ? person(28, 40, 'f') : v === 1 ? person(78, 90) : person(38, 52, 'm');
  const V = [
    { title: 'Anxious after a flight', disp: `${p.age} y/o female, "panic attack." Airport arrivals.`, scene: 'Airport, safe. Gloves on. Woman sitting on her suitcase, breathing fast. Friend: "She gets anxious."', sample: 'S: short of breath, "racing heart." A: none. M: birth control pills. P: anxiety. L: airplane snack. E: just off a 14-h flight; left calf sore.', lungs: 'Clear and equal.', say: 'I\'m fine... it\'s just anxiety...', pe: true },
    { title: '"Just tired" grandparent', disp: `${p.age} y/o ${p.man}, weakness. Nursing home.`, scene: `Nursing home, safe. Gloves on. Resident in a recliner. Nurse: "${p.He}'s just more tired today."`, sample: '(Nurse) S: tired, eating less, mild cough. A: none. M: donepezil, amlodipine. P: dementia, high BP. L: barely ate. E: worse over 2 days.', lungs: 'Crackles in the RIGHT lower lung.', say: 'I\'m just tired, honey...', pe: false },
    { title: 'Short of breath at rehab', disp: `${p.age} y/o male, short of breath. Physical-therapy clinic.`, scene: 'PT clinic, safe. Gloves on. Man on an exercise bike, breathing fast. 10 days after knee surgery.', sample: 'S: sudden short of breath, sharp chest pain on breathing in. A: none. M: oxycodone; stopped his blood thinner early. P: knee replacement 10 days ago. L: breakfast. E: started 10 min ago on the bike.', lungs: 'Clear and equal.', say: 'Just out of shape, I guess...', pe: true },
  ][v];
  return { id: 'ad_hypox', cat: 'Adaptive', tested: 'spo2', tags: ['spo2', 'lungs'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: `SpO2 was ~84% under "${V.pe ? 'just anxiety' : 'just tired'}". Without high-flow O2 ${p.he} slid into confusion and shock.`,
    setup: s => { Object.assign(s.v, { hr: 118, sbp: 124, dbp: 78, rr: 26, spo2: 84, etco2: 30, avpu: 'A', bgl: 112 }); Object.assign(s, { pose: 'sitting', skin: 'pale', sweat: V.pe, chest: 0.55, sex: p.sex, shirt: p.shirt, lungs: V.lungs }); s.flags.sev = 0.6; s.say('Patient', V.say); },
    find: { scene: V.scene, sample: V.sample, opqrst: V.pe ? 'Sudden. Sharp pain on a deep breath. 6/10.' : 'Gradual, 2 days. No pain.' },
    update(s, dt, api) {
      const f = s.flags, o2 = { nc: 4, nrb: 11, cpap: 9 }[f.o2] || (f.bvm ? 11 : 0);
      f.sev = clamp(f.sev + (o2 >= 9 ? -0.002 : 0.004) * dt, 0.3, 1.6);
      Object.assign(s.target, { spo2: clamp(96 - f.sev * 20 + o2, 62, 98), hr: 96 + f.sev * 36, rr: 18 + f.sev * 14, sbp: 128 - (f.sev > 1.1 ? (f.sev - 1.1) * 90 : 0), dbp: 78, etco2: 30 });
      s.v.avpu = f.sev > 1.15 ? 'V' : 'A'; s.skin = s.v.spo2 < 80 ? 'cyanotic' : 'pale'; s.chest = clamp(1 - f.sev * 0.5, 0.35, 1);
      if (f.sev > 1.15 && !f.confLog) { f.confLog = true; api.log('Now confused and drowsy - the brain is starving for oxygen.', 'bad'); }
      if (f.sev >= 1.55) return api.end('fail', 'Hypoxia led to arrest. Pulse ox on early: SpO2 84% needs high-flow O2, no matter how calm they look.');
      adTalk(s, 'Patient', s.v.avpu === 'V' ? '(confused) ...where am I?...' : f.sev < 0.4 ? 'That oxygen helps... I can think.' : V.say);
    },
    actions: {
      spo2: (s, api) => { s.reveal.spo2 = s.reveal.hr = true; s.flags.spo2 = true; api.info(`SpO2 ${Math.round(s.v.spo2)}%${s.v.spo2 < 90 ? ' - LOW, even though they look calm.' : '.'}`); },
      cpap: (s, api) => { if (V.pe) return api.bad('cpapPE', 'CPAP isn\'t the fix here.', 'Clear lungs + low SpO2 + fast HR = think PE: NRB 15 L, position of comfort, transport.');
        s.devices.add('cpap'); s.flags.o2 = 'cpap'; api.info('CPAP on - OK per some protocols, but NRB is the main move.'); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'SpO2 in the first 60 s', why: '"Fine, just anxious/tired" hid an SpO2 of 84%.', ok: !!s.flags.spo2 && adSince(s, 'spo2') <= 60 },
      { label: 'High-flow O2 (NRB 15 L)', why: 'SpO2 under 90 + distress = NRB. A cannula isn\'t enough.', ok: s.flags.o2 === 'nrb' || s.flags.bvm },
      { label: 'Listened to lungs', why: V.pe ? 'Clear lungs + hypoxia = think PE.' : 'One-sided crackles = pneumonia.', ok: s.flags.lungs },
      { label: 'ALS / transport', why: V.pe ? 'Possible PE needs the ED fast.' : 'Hypoxic elderly = ED.', ok: s.flags.als || s.flags.transport },
    ] };
} };

// 8) LUNG SOUNDS -> pneumothorax in someone who "looks like" COPD
T.ptx = { skills: ['lungs'], make(st) {
  const v = adVar(st, 'ptx', 3), p = v === 1 ? person(19, 24, 'm') : person(58, 74);
  const V = [
    { title: 'COPD flare?', disp: `${p.age} y/o ${p.man}, COPD, can't breathe. Home.`, scene: `Home, safe; home O2 tubing everywhere - no smoking or flames nearby. Gloves on. ${p.He} is tripoding.`, sample: 'S: sudden short of breath + sharp right chest pain after a coughing fit. A: none. M: home O2 2 L, tiotropium, albuterol inhaler. P: COPD (emphysema). L: lunch. E: coughing fit 20 min ago.', side: 'Left: scattered wheezes.', copd: true },
    { title: 'Tall teen, sudden SOB', disp: `${p.age} y/o male, sudden trouble breathing. Basketball court.`, scene: 'Outdoor court, safe. Gloves on. Very tall, thin young man on the bench, holding his right side.', sample: 'S: sudden sharp right chest pain, short of breath. A: none. M: none. P: "collapsed lung" once at 17. L: chips. E: started while shooting free throws.', side: 'Left: clear.', copd: false },
    { title: 'Breathless at bingo', disp: `${p.age} y/o ${p.man}, difficulty breathing. Bingo hall.`, scene: `Bingo hall, safe. Gloves on. ${p.He} is leaning on a table, lips pursed, gasping.`, sample: 'S: sudden short of breath, sharp right-sided pain. A: none. M: albuterol inhaler, tiotropium. P: COPD, 50 years of smoking. L: snack. E: sudden, while laughing.', side: 'Left: diminished, few wheezes.', copd: true },
  ][v];
  return { id: 'ad_ptx', cat: 'Adaptive', tested: 'lungs', tags: ['lungs', 'spo2'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: 'Right side had almost NO breath sounds = pneumothorax. CPAP/forced air turns it into a tension pneumothorax.',
    setup: s => { Object.assign(s.v, { hr: 118, sbp: 132, dbp: 84, rr: 30, spo2: 86, etco2: 40, avpu: 'A', bgl: 118 }); Object.assign(s, { pose: 'tripod', skin: 'pale', sweat: true, chest: 0.45, sex: p.sex, shirt: p.shirt, lungs: 'RIGHT side: almost NO breath sounds. ' + V.side }); Object.assign(s.flags, { pneumo: true, sev: 0.6, ten: 0 }); },
    find: { scene: V.scene, sample: V.sample, opqrst: 'O: sudden. P: worse breathing in. Q: sharp, stabbing. R: right chest. S: 7/10. T: 20 min.' },
    update(s, dt, api) {
      const f = s.flags, o2 = { nc: 3, nrb: 7 }[f.o2] || (f.bvm ? 7 : 0);
      if ((f.cpapHarm || f.bvmPP) && !f.decomp) {
        f.ten += dt;
        if (!f.tLog) { f.tLog = true; api.say('Partner', 'Neck veins bulging - BP dropping! Tension pneumo?'); }
        Object.assign(s.target, { sbp: Math.max(56, 132 - f.ten * 1.7), dbp: 50, hr: 142, spo2: Math.max(68, 86 - f.ten * 0.3), rr: 38 });
        s.lungs = 'RIGHT: silent. Neck veins bulging. Trachea shifting left (late sign)!';
        s.v.avpu = s.v.sbp < 80 ? 'V' : 'A'; s.skin = 'cyanotic';
        if (f.als && s.t - f.alsT > 25) { f.decomp = true; s.devices.delete('cpap'); api.say('Paramedic', 'Needle decompression, right chest... rush of air!'); api.log('Paramedic decompressed the chest. BP recovering.', 'good'); }
        if (s.v.sbp < 62) { f.lowT = (f.lowT || 0) + dt; if (f.lowT > 20) return api.end('fail', 'Tension pneumothorax: the heart couldn\'t fill. One-sided absent breath sounds = NO CPAP. NRB, ALS, rapid transport.'); }
        adTalk(s, 'Patient', s.v.avpu === 'V' ? '(gasping, barely responding)' : 'Can\'t... get... air...');
        return;
      }
      f.sev = clamp(f.sev + (o2 ? 0.0004 : 0.002) * dt, 0.3, 1.4);
      Object.assign(s.target, { sbp: 130, dbp: 84, hr: 104 + f.sev * 20, rr: 22 + f.sev * 12, spo2: clamp(95 - f.sev * 15 + o2, 72, 97), etco2: 40 });
      s.v.avpu = 'A'; s.skin = s.v.spo2 < 82 ? 'cyanotic' : 'pale';
      if (f.decomp) s.lungs = 'Right side: air moving again (needle in). ' + V.side;
      adTalk(s, 'Patient', f.decomp ? 'Oh... I can breathe again...' : 'It... stabs... when I breathe.');
    },
    actions: {
      albuterol: (s, api) => { if (!V.copd) return api.bad('albNI', 'No prescribed inhaler here.', 'EMTs assist only with the patient\'s own inhaler.');
        api.prompt({ q: 'Before assisting with the inhaler, you confirm:', options: ['Patient\'s own Rx, not expired, right dose, alert', 'Any inhaler on the rig', 'Only the color', 'Nothing - speed matters'], correct: 0, explain: '5 rights: patient, med, dose, route, date.', skill: 'medDose', then: () => api.info('Left-side wheezes ease a bit. RIGHT side still silent - this isn\'t just COPD.') }); },
      bvm: (s, api) => { if (s.v.avpu === 'A' && s.v.rr >= 10) { s.flags.bvmPP = true; return api.bad('bvmAlert', 'Forcing air into an alert patient with a collapsed lung.', 'BVM is for inadequate breathing. Positive pressure worsens a pneumothorax.', true); } api.info('Bagging gently.'); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'Lungs: found right side absent', why: 'One-sided absent sounds + sudden sharp pain = pneumothorax.', ok: !!s.flags.lungs && s.flags.at.lungs <= (s.flags.at.cpap ?? 1e9) },
      { label: 'NO CPAP / no forced ventilation', why: 'Pneumothorax is a CPAP contraindication.', ok: !s.flags.cpapHarm && !s.flags.bvmPP },
      { label: 'NRB 15 L', why: 'Hypoxic: high-flow O2 (yes, even with COPD).', ok: s.flags.o2 === 'nrb' },
      { label: 'Early ALS + rapid transport', why: 'ALS can decompress a tension pneumo.', ok: s.flags.als && s.flags.transport },
    ] };
} };

// 9) PULSE CHECK -> cardiac arrest that looks like a seizure
const AD_ARREST = SCENARIOS.find(x => x.id === 'arrest');
T.sca = { skills: ['pulseCheck', 'cpr'], make(st) {
  const v = adVar(st, 'sca', 3), p = v === 0 ? person(15, 17) : v === 1 ? person(38, 50, 'f') : person(24, 34, 'm');
  const V = [
    { title: 'Seizure on the field', disp: `${p.age} y/o ${p.man}, "seizure." High-school soccer game.`, scene: 'Soccer field, game stopped, safe. Gloves on. Coach is bringing the school AED.', say: `It's a seizure! Should we put something in ${p.his} mouth?!` },
    { title: 'Spin-class "seizure"', disp: `${p.age} y/o female, seizure. Fitness studio.`, scene: 'Spin studio, music off, safe. Gloves on. The gym\'s AED is on the wall by the door.', say: 'She shook all over and now she\'s snoring! A seizure?' },
    { title: 'Hit by a baseball', disp: `${p.age} y/o male, hit in the chest by a ball, "having a seizure." Softball field.`, scene: 'Softball field, safe. Gloves on. A line drive hit his chest, then he dropped. The dugout has an AED.', say: 'Ball hit him in the chest, he dropped and twitched! Now he\'s gasping!' },
  ][v];
  return { ...AD_ARREST, id: 'ad_sca', cat: 'Adaptive', tested: 'pulseCheck', tags: ['pulseCheck', 'cpr', 'aed'], title: V.title, dispatch: V.disp,
    trap: 'Jerking + gasping after a collapse looked like a seizure. It was cardiac arrest (VF): pulse check, CPR, AED.',
    setup: s => { AD_ARREST.setup(s); Object.assign(s, { sex: p.sex, shirt: p.shirt }); s.say('Bystander', V.say); },
    find: { scene: V.scene, resp: 'No response. A few jerks a moment ago; now limp.', breathing: 'Only AGONAL gasps (snoring-like) - that is NOT breathing.', pulse: 'NO carotid pulse (checked under 10 s).', sample: 'Bystander: healthy, no seizures before, no meds.' },
    actions: { ...AD_ARREST.actions,
      posRecovery: (s, api) => api.bad('scaSeizure', 'Recovery position - but there\'s no pulse. No CPR is happening.', 'Collapse + gasping = check breathing and pulse (5-10 s). No pulse = CPR + AED now.', true),
      glucose: (s, api) => { s.reveal.bgl = true; api.bad('scaSeizure', 'BGL 98... and still no CPR.', 'Pulse/breathing check before anything else on a collapse.', true); },
      suction: (s, api) => api.info('Little to suction. Did you check for a pulse?'),
    },
    critical: s => [...AD_ARREST.critical(s), { label: 'Did NOT treat it as a seizure', why: 'Brief jerks + agonal gasps are common at the start of cardiac arrest.', ok: !s.flags.mistakeKeys.has('scaSeizure') }] };
} };

// 10) BLEEDING FIRST -> hidden life-threatening bleed with a distracting complaint
const AD_BLEED = SCENARIOS.find(x => x.id === 'bleed');
T.hiddenBleed = { skills: ['bleedFirst'], make(st) {
  const v = adVar(st, 'hb', 3), p = v === 2 ? person(14, 17, 'f') : person(20, 55);
  const V = [
    { title: 'Fall through a glass table', disp: `${p.age} y/o ${p.man}, wrist injury. House party.`, scene: 'House party, music off, broken glass swept aside. Gloves + eye protection. Patient on a DARK rug, holding a wrist.', bleeding: 'Rapid scan: a deep cut on the upper right thigh, hidden by dark pants. Bright red blood SPURTING into the dark rug. Life-threatening!', say: 'My WRIST! I think it\'s broken!' },
    { title: 'Firewood accident', disp: `${p.age} y/o ${p.man}, hand cut by a chainsaw. Backyard woodpile.`, scene: 'Chainsaw OFF and set down. Gloves + eye protection. Patient on the ground in dark brown work pants, holding a bloody hand.', bleeding: 'Rapid scan: the hand cut is small. The chainsaw also hit the RIGHT THIGH - blood SPURTING, soaking the dark work pants. Life-threatening!', say: 'Just wrap my hand, it\'s fine. I\'m kinda cold though.' },
    { title: 'Hockey rink fall', disp: `${p.age} y/o female, shoulder injury. Ice rink.`, scene: 'Rink, play stopped, safe footing on the mat. Gloves + eye protection. Player in dark padded pants, holding her shoulder.', bleeding: 'Rapid scan: a skate blade sliced the RIGHT THIGH under the dark pads - blood SPURTING. Life-threatening!', say: 'My shoulder! I hit the boards so hard!' },
  ][v];
  return { ...AD_BLEED, id: 'ad_hbleed', cat: 'Adaptive', tested: 'bleedFirst', tags: ['bleedFirst', 'spo2'], tqLimit: 60, title: V.title, dispatch: V.disp,
    trap: 'The loud complaint was a distraction. A spurting thigh bleed hid under dark clothes - the rapid scan finds it.',
    setup: s => { AD_BLEED.setup(s); Object.assign(s.v, { hr: 112, sbp: 114 }); s.flags.loss = 0.2; s.bleed = 0; Object.assign(s, { sex: p.sex, shirt: p.shirt }); s.say('Patient', V.say); },
    find: { ...AD_BLEED.find, scene: V.scene, bleeding: V.bleeding, sample: `S: "${V.say}" A: none. M: none. P: none. L: 2 h ago. E: see dispatch.`, opqrst: 'Points only to the distracting injury.' },
    update(s, dt, api) {
      const f = s.flags;
      const rate = f.tq ? 0 : f.dressing ? 0.0025 : 0.0065;
      f.loss = clamp(f.loss + rate * dt, 0, 1.6);
      const sup = s.pose === 'supine' ? 0 : -6, warm = f.blanket ? 3 : 0;
      Object.assign(s.target, { hr: 96 + f.loss * 45, sbp: 128 - f.loss * 62 + sup + warm, dbp: 80 - f.loss * 40, rr: 18 + f.loss * 12, spo2: clamp(98 - f.loss * 6 + (f.o2 ? 3 : 0), 80, 99), etco2: 34 - f.loss * 8 });
      s.v.avpu = f.loss > 1.05 ? 'V' : 'A'; s.skin = f.loss > 0.3 ? 'pale' : 'normal'; s.sweat = f.loss > 0.4;
      const seen = f.scanned || f.tq;
      s.bleed = seen ? clamp(0.25 + f.loss * 0.9, 0, 1.4) : 0;
      if (!seen && f.loss > 0.75 && !f.hint) { f.hint = true; api.say('Partner', 'Pulse is racing and they\'re pale... where is this coming from?'); }
      adTalk(s, 'Patient', s.v.avpu === 'V' ? '(confused) ...so cold...' : f.tq ? 'Ow, that\'s tight... but I feel a little better.' : seen ? 'Is that all MY blood?!' : V.say);
      if (f.loss > 1.5) api.end('fail', 'Bled out from a wound nobody looked for. Rapid scan for big bleeding FIRST - before the wrist or shoulder.');
    },
    actions: { ...AD_BLEED.actions,
      bleeding: (s, api) => { s.flags.scanned = true; api.info(s.find.bleeding); },
      collar: (s, api) => { s.devices.add('collar'); api.bad('collarDelay', 'Collar wasn\'t needed and it cost time.', 'No head/neck mechanism. Uncontrolled bleeding comes first.'); },
    },
    critical: s => [
      { label: 'Scene safety + BSI (eye protection)', why: 'Spurting blood = splash risk.', ok: s.flags.sceneFirst },
      { label: 'Rapid scan for bleeding in the first 30 s', why: 'Look head to toe - don\'t trust the loudest complaint.', ok: !!s.flags.scanned && adSince(s, 'bleeding') <= 30 },
      { label: 'Tourniquet within 60 s', why: 'Life-threatening bleeding comes before ABC (X-ABC).', ok: !!s.flags.tq && s.flags.tqT - (s.flags.firstT || 0) <= 60 },
      { label: 'Tourniquet placed correctly', why: '2-3 in above the wound, not on a joint, time noted.', ok: s.flags.tqOK },
      { label: 'Kept warm + NRB', why: 'Shock: oxygen and prevent hypothermia.', ok: !!s.flags.blanket && s.flags.o2 === 'nrb' },
      { label: 'Rapid transport', why: 'Needs a surgeon.', ok: s.flags.transport },
    ] };
} };

// 11) BP BEFORE EVERY NITRO / REASSESS -> nitro-sensitive hypotension
T.ntgDrop = { skills: ['bpNitro', 'reassess'], make(st) {
  const v = adVar(st, 'ntgd', 3), p = v === 0 ? person(72, 84, 'f') : person(60, 74, 'm');
  const V = [
    { title: 'Chest pain + vomiting', disp: `${p.age} y/o female, chest pain and nausea. Kitchen.`, scene: 'Home, safe. Gloves on. Woman at the kitchen table, gray, a bucket beside her.', sample: 'S: chest pressure, vomiting x2 days. A: none. M: her own nitro 0.4 mg SL (not expired), metoprolol. No ED drugs. P: angina, high BP. L: crackers. E: woke up with it.' },
    { title: 'Farmer in the barn', disp: `${p.age} y/o male, chest pain. Dairy barn, hot day.`, scene: 'Barn, animals penned, safe. Gloves on. Farmer sitting on a hay bale, sweaty, pale.', sample: 'S: chest pressure + nausea. A: none. M: his own nitro 0.4 mg SL, metoprolol. No ED drugs. P: angina. L: water only - "too hot to eat." E: hauling hay all morning.' },
    { title: 'Chest pain at the pharmacy', disp: `${p.age} y/o male, chest pain. Pharmacy aisle.`, scene: 'Pharmacy, safe. Gloves on. Man sitting on the floor against a shelf, pale.', sample: 'S: chest pressure, nausea, lightheaded. A: none. M: his own nitro 0.4 mg SL, amlodipine, metoprolol. No ED drugs. P: angina, high BP. L: breakfast. E: walking.' },
  ][v];
  return { id: 'ad_ntgdrop', cat: 'Adaptive', tested: 'bpNitro', tags: ['bpNitro', 'medHx', 'allergy', 'spo2'], title: V.title, age: 'adult', dispatch: V.disp,
    trap: 'SBP started OK but fell to ~90 after nitro #1 (dry + likely inferior MI). Repeat nitro without a new BP = collapse.',
    setup: s => { const sbp = adInt(112, 120); Object.assign(s.v, { hr: adInt(54, 62), sbp, dbp: 72, rr: 20, spo2: 95, etco2: 35, avpu: 'A', bgl: 132 }); Object.assign(s, { pose: 'sitting', skin: 'pale', sweat: true, chest: 0.75, sex: p.sex, shirt: p.shirt }); Object.assign(s.flags, { pain: 7, hr0: s.v.hr - 8, sbp0: sbp }); },
    find: { scene: V.scene, sample: V.sample, opqrst: 'O: 40 min ago. P: nothing helps. Q: pressure + nausea. R: upper belly/jaw. S: 7/10. T: 40 min.' },
    update(s, dt, api) {
      if (s.flags.crash) s.flags.bradyCrash = true;
      cpUpdate(s, dt, api, s => {
        const f = s.flags; if (f.ntg) s.target.hr = f.hr0 + 10;
        adTalk(s, 'Patient', f.ntg ? 'Pressure\'s a bit better... but I feel lightheaded.' : 'Pressure... and I feel sick to my stomach.');
      });
    },
    actions: {
      asa: cpAsa(false),
      ntg: (s, api) => {
        const f = s.flags;
        if (!f.bpChecked) api.bad('ntgNoBP', 'Nitro given without a BP.', 'Always check BP before nitro (SBP 100+).', true);
        if (f.ntg && !adBpSinceNtg(s)) { f.crash = true; f.ntg++; return api.bad('ntgRepeatNoBP', 'Repeat nitro with no new BP - BP collapses, nearly faints!', 'Recheck BP before EVERY dose. After dose 1 it had fallen to about 90.', true); }
        if (s.v.sbp < 100) { f.crash = true; return api.bad('ntgLowBP', 'SBP was under 100 - nitro dropped it into the 60s.', 'No nitro if SBP under 100 (some protocols 90).', true); }
        if ((f.ntg || 0) >= 3) return api.info('Max 3 doses - contact medical control.');
        ntgGive(s, api); f.ntgDrop = 26;
      },
      posSupine: (s, api) => { s.pose = 'supine'; s.flags.supine = true; api.info(s.flags.crash || s.flags.ntgDrop ? 'Good - lying flat helps the BP.' : 'Most chest-pain patients prefer sitting.'); },
      nrb: (s, api) => { s.flags.o2 = 'nrb'; s.devices.add('nrb'); s.devices.delete('nc'); api.info('OK. AHA: O2 if SpO2 under 94% or shock.'); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'SAMPLE (meds, ED drugs, allergies)', why: 'Clears aspirin + nitro.', ok: s.flags.sample },
      { label: 'Aspirin 162-324 mg chewed', why: 'Suspected ACS.', ok: s.flags.asaOK },
      { label: 'BP before nitro #1', why: 'SBP 100+ required.', ok: s.flags.at?.bp != null && s.flags.at.bp <= (s.flags.at.ntg ?? 1e9) },
      { label: 'Rechecked BP after nitro', why: 'Reassess: it fell to about 90.', ok: !s.flags.ntg || adBpAfterFirstNtg(s) },
      { label: 'Held nitro once SBP was under 100', why: 'Protocol: no nitro under 100.', ok: !s.flags.crash },
      { label: 'ALS / transport', why: 'Possible inferior MI.', ok: s.flags.als || s.flags.transport },
    ] };
} };

// 12) VENTILATION -> sedative overdose where naloxone won't fix it
T.sedOD = { skills: ['vent', 'ventRate'], make(st, skill) {
  const v = skill === 'ventRate' && Math.random() < 0.6 ? 1 : adVar(st, 'sed', 3);
  const kid = v === 1, p = kid ? person(3, 5) : v === 0 ? person(34, 48, 'f') : person(48, 62, 'm');
  const V = [
    { title: 'Sleeping pills + wine', disp: `${p.age} y/o female, won't wake up. Apartment.`, scene: 'Apartment, safe. Gloves on. Empty wine bottle and a zolpidem (Ambien) bottle on the nightstand.', sample: '(Partner) S: can\'t wake her. A: none. M: zolpidem, sertraline. P: depression, insomnia. L: dinner + a bottle of wine. E: found 20 min ago.', pupils: 'Mid-size, sluggish.' },
    { title: 'Toddler + grandpa\'s pills', disp: `${p.age} y/o child, very sleepy. Grandparents' house.`, scene: 'Living room, safe. Gloves on. Open pill organizer on the floor: CLONIDINE (blood-pressure pills).', sample: '(Grandma) S: very sleepy, floppy. A: none. M: none. P: healthy. L: lunch 2 h ago. E: found with Grandpa\'s pill box 30 min ago.', pupils: 'Small (pinpoint) - clonidine can mimic opioids.' },
    { title: 'Anxiety pills + vodka', disp: `${p.age} y/o male, unresponsive. Motel room.`, scene: 'Motel room, manager let you in, safe. Gloves on. Alprazolam (Xanax) bottle and vodka on the table.', sample: '(Manager) S: unresponsive. A: unknown. M: alprazolam. P: anxiety. L: unknown. E: friend called - "took a handful of Xanax with vodka."', pupils: 'Mid-size, sluggish.' },
  ][v];
  const rr0 = kid ? 8 : 5;
  return { id: 'ad_sed', cat: 'Adaptive', tested: skill === 'ventRate' ? 'ventRate' : 'vent', tags: ['vent', 'gag', 'glucose', 'spo2'], title: V.title, age: kid ? 'child' : 'adult', dispatch: V.disp,
    trap: `RR ${rr0} = inadequate${kid ? ' for a child (normal 20-30)' : ''}. Not an opioid, so naloxone did little. Only BVM (${kid ? '1 breath every 2-3 s' : '1 breath every 6 s'}) fixes it.`,
    setup: s => { Object.assign(s.v, { hr: kid ? 72 : 58, sbp: kid ? 86 : 102, dbp: kid ? 50 : 64, rr: rr0, spo2: 80, etco2: 64, avpu: 'P', bgl: adInt(88, 118) }); Object.assign(s, { pose: 'supine', skin: 'cyanotic', sweat: false, chest: 0.15, sex: p.sex, shirt: p.shirt, lungs: 'Slow, shallow; snoring up top.' }); Object.assign(s.flags, { gag: true, hr0: s.v.hr }); s.say(kid ? 'Grandma' : 'Bystander', kid ? 'She won\'t wake up right! Please!' : 'Is that normal breathing?! Do something!'); },
    find: { scene: V.scene, sample: V.sample, pupils: V.pupils, resp: 'Only moans to pain (P). Gags a little when you look in the mouth.',
      airway: 'Snoring = tongue. Head-tilt chin-lift opens it.', breathing: `RR ${rr0}, very shallow - INADEQUATE.${kid ? ' (Normal at this age: 20-30.)' : ''} Ventilate!` },
    update(s, dt, api) {
      const f = s.flags;
      if (f.airwayChecked || f.adjunct) f.airwayOpen = true;
      let spo2 = 80 - s.t * 0.13, hr = f.hr0;
      if (f.bvm) { const eff = f.airwayOpen && !s.vomit; spo2 = eff ? 96 : 86; hr = f.hr0 + (eff ? 30 : 10); if (!eff && !f.ventWarn) { f.ventWarn = true; api.log('Bagging is hard - open/clear the airway.', 'bad'); } }
      s.target.spo2 = clamp(spo2, 50, 99);
      if (s.v.spo2 < 65) hr = kid ? 50 : 40;
      Object.assign(s.target, { hr, rr: rr0, etco2: f.bvm ? 42 : 66, sbp: s.v.spo2 < 65 ? (kid ? 64 : 80) : (kid ? 86 : 102) });
      s.skin = s.v.spo2 > 92 ? 'pale' : 'cyanotic'; s.chest = f.bvm ? 0.85 : 0.15;
      if (s.v.spo2 < 62) { f.lowT = (f.lowT || 0) + dt; if (f.lowT > 25) return api.end('fail', 'Hypoxia slowed the heart to a stop. Inadequate breathing = BVM right away. Naloxone only reverses opioids.'); }
      if (f.als && !f.alsSaid && s.t - f.alsT > 40) { f.alsSaid = true; api.say('Paramedic', f.bvm ? 'Good bagging - keep that rate.' : 'Why isn\'t anyone bagging?!'); }
      adTalk(s, kid ? 'Grandma' : 'Bystander', s.v.spo2 < 70 ? 'They\'re turning blue!' : f.bvm ? 'Is that helping?' : 'Is that normal breathing?!');
    },
    actions: {
      // RR is inadequate for this age (a child's RR 8 is as bad as an adult's 5): passive O2 alone fails
      nrb: (s, api) => { if (s.flags.bvm) return api.info('Already bagging at 15 L/min - keep going.'); s.devices.add('nrb'); api.bad('o2inad', 'No change - an O2 mask does nothing if they aren\'t breathing enough.', `RR ${rr0} is inadequate${kid ? ' for a child' : ''}. Ventilate with BVM at 15 L/min.`); },
      nc: (s, api) => { if (s.flags.bvm) return api.info('Already bagging at 15 L/min - keep going.'); api.bad('o2inad', 'Cannula can\'t help - not moving enough air.', `RR ${rr0} is inadequate. Ventilate with BVM.`); },
      naloxone: (s, api) => {
        const f = s.flags; if (f.nalT != null) return api.info('Already given. Little change. Keep bagging.');
        api.prompt({ q: 'Naloxone dose/route at EMT level?', options: ['4 mg intranasal (per protocol)', '50 mg by mouth', '0.4 mg chewed', 'Into the airway'], correct: 0, explain: 'Intranasal naloxone 4 mg. But it only reverses OPIOIDS.', skill: 'medDose', then: () => {
          f.nalT = s.t; if (!f.bvm) api.bad('nalNoVent', 'Naloxone before bagging - SpO2 keeps falling.', 'Inadequate breathing = BVM first. Naloxone takes minutes and only helps opioids.');
          api.log(`Little to no change. ${kid ? 'Clonidine' : 'Sedatives + alcohol'} - not an opioid. Ventilation is the fix.`, 'warn'); } });
      },
    },
    onBVM: (s, api) => api.good(`Bagging at 15 L/min - chest rising.${s.flags.airwayOpen ? '' : ' (open the airway first!)'}`),
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Check for pills, needles, hazards.', ok: s.flags.sceneFirst },
      { label: 'Opened the airway', why: 'Snoring = tongue.', ok: s.flags.airwayOpen },
      { label: 'BVM within 60 s', why: `RR ${rr0} is inadequate: an NRB alone does nothing.`, ok: !!s.flags.bvm && adSince(s, 'bvm') <= 60 },
      { label: kid ? 'Rate: 1 breath every 2-3 s' : 'Rate: 1 breath every 6 s', why: kid ? 'Child with a pulse: every 2-3 s.' : 'Adult with a pulse: every 6 s.', ok: s.flags.bvmRateOK },
      { label: 'Didn\'t rely on naloxone', why: 'Not an opioid - BVM first.', ok: !s.flags.mistakeKeys.has('nalNoVent') },
      { label: 'Checked glucose', why: 'Any altered patient.', ok: !!s.reveal.bgl },
      { label: 'Transported', why: 'Poison Control + ED.', ok: s.flags.transport },
    ] };
} };

// 13) EARLY EPI -> anaphylaxis with NO hives
T.anaNoHives = { skills: ['epi'], make(st) {
  const v = adVar(st, 'anh', 3), kid = v === 0, p = kid ? person(8, 10, 'm') : v === 1 ? person(22, 32, 'f') : person(28, 44, 'm');
  const V = [
    { title: 'Birthday-party "asthma"', disp: `${p.age} y/o child, asthma attack. Birthday party.`, scene: 'Backyard party, safe. Gloves on. Boy on a lawn chair, wheezing. Parent: "It\'s his asthma." His backpack has an inhaler AND an EpiPen Jr.', sample: '(Parent) S: wheezing, throat "itchy," threw up once. A: PEANUTS. M: his own albuterol inhaler, EpiPen Jr 0.15 mg. P: asthma, peanut allergy. L: a cookie 10 min ago. E: started right after the cookie.', say: 'My throat... feels funny...' },
    { title: 'Restaurant "panic attack"', disp: `${p.age} y/o female, panic attack. Seafood restaurant.`, scene: 'Restaurant, safe. Gloves on. Woman on the bench outside, breathing fast. Friend: "She has panic attacks." No hives.', sample: 'S: throat tight, dizzy, belly cramps. A: SHELLFISH. M: her own EpiPen 0.3 mg (in her purse). P: anxiety. L: "crab cakes - I thought they were fish cakes." E: 15 min after eating.', say: 'I can\'t... I\'m just panicking...' },
    { title: 'Mowing the lawn', disp: `${p.age} y/o male, dizzy, vomiting. Front yard.`, scene: 'Yard, mower off, safe. Gloves on. Man sitting on the grass, pale. A hornet nest by the fence. No hives.', sample: 'S: dizzy, throwing up, chest tight. A: hornets/wasps (bad reaction 2 yrs ago). M: his own EpiPen 0.3 mg (in the garage). P: none. L: lunch. E: stung on the neck 10 min ago.', say: 'Just dizzy... maybe the heat...' },
  ][v];
  return { id: 'ad_anh', cat: 'Adaptive', tested: 'epi', tags: ['epi', 'lungs', 'spo2'], title: V.title, age: kid ? 'child' : 'adult', dispatch: V.disp,
    trap: `No hives - but allergen + wheeze + SBP in the 70s-80s = anaphylaxis. Epi ${kid ? '0.15 mg' : '0.3 mg'} IM thigh, early.`,
    setup: s => { Object.assign(s.v, kid ? { hr: 142, sbp: 76, dbp: 40, rr: 34, spo2: 89, etco2: 32, avpu: 'A', bgl: 104 } : { hr: 128, sbp: 80, dbp: 46, rr: 28, spo2: 90, etco2: 33, avpu: 'A', bgl: 104 }); Object.assign(s, { pose: 'sitting', skin: 'pale', sweat: true, chest: 0.5, hives: false, swelling: false, sex: p.sex, shirt: p.shirt, lungs: 'Wheezes in all fields.' }); s.flags.sev = 0.6; s.say('Patient', V.say); },
    find: { scene: V.scene, sample: V.sample, airway: 'Voice a bit hoarse. No visible swelling yet.' },
    update(s, dt, api) {
      const f = s.flags;
      if (f.epiT != null && s.t - f.epiT > 8) f.sev -= (s.t - f.epiT < 70 ? 0.011 : 0) * dt; else f.sev += (f.albT && s.t - f.albT < 30 ? 0.003 : 0.0045) * dt;
      f.sev = clamp(f.sev, 0.12, 1.6);
      const o2 = { nc: 2, nrb: 6 }[f.o2] || (f.bvm ? 6 : 0);
      Object.assign(s.target, { hr: (kid ? 104 : 92) + f.sev * 50, sbp: (kid ? 112 : 122) - f.sev * 62, dbp: 76 - f.sev * 45, rr: (kid ? 22 : 16) + f.sev * 18, spo2: clamp(99 - f.sev * 15 + o2, 70, 99), etco2: 34 });
      s.v.avpu = f.sev > 1.2 ? 'V' : 'A'; s.hives = false; s.swelling = f.sev > 1.0; s.skin = f.sev > 0.3 ? 'pale' : 'normal'; s.sweat = f.sev > 0.4; s.chest = clamp(1 - f.sev * 0.5, 0.3, 1);
      s.lungs = f.sev > 0.9 ? 'Wheezes + high-pitched STRIDOR.' : f.sev > 0.3 ? 'Wheezes in all fields.' : 'Clear.';
      adTalk(s, 'Patient', s.v.avpu === 'V' ? '(barely responding)' : f.sev < 0.3 ? 'I can breathe again...' : V.say);
      if (f.sev > 1.55) api.end('fail', 'Anaphylactic shock closed the airway. No hives doesn\'t mean no anaphylaxis: allergen + low BP or breathing trouble = EPI.');
    },
    actions: {
      bp: (s, api) => { s.reveal.bp = true; s.flags.bpChecked = true; s.flags.bpT = s.t; api.info(`BP ${Math.round(s.v.sbp)}/${Math.round(s.v.dbp)}${s.v.sbp < 90 ? ' - LOW.' : '.'}`); },
      epi: (s, api) => {
        const f = s.flags; if (f.epiT != null) return api.info('Repeat epi per medical control in 5-15 min if no better.');
        const q = kid ? { q: 'EpiPen for this child (about 25 kg)?', options: ['0.15 mg (EpiPen Jr), outer thigh, IM', '0.3 mg into an arm vein', '0.15 mg under the tongue', '0.5 mg into the buttock'], correct: 0, explain: 'Child 15-30 kg: 0.15 mg. 30 kg+: 0.3 mg. Outer thigh IM, hold about 3 s.' }
          : { q: 'Assisting with the EpiPen. How?', options: ['0.3 mg, outer thigh, IM (through clothes OK), hold 3 s', 'Into a vein', 'Center of the buttock', 'Under the tongue'], correct: 0, explain: 'Adult 0.3 mg IM, outer thigh, hold about 3 s.' };
        api.prompt({ ...q, skill: 'epi', then: ok => { f.epiT = s.t; f.epiOK = ok; if (!ok) api.bad('epiDose', 'Partner corrects the dose/site.', q.explain); api.good('Epi in. Reassess in 1-2 min.'); } });
      },
      albuterol: (s, api) => { if (!kid) return api.info('No prescribed inhaler. EMTs assist only with the patient\'s own. Epi treats the wheeze too.');
        api.prompt({ q: 'Before assisting with his inhaler, you confirm:', options: ['His own Rx, not expired, right dose, alert', 'Any inhaler', 'Only the color', 'Nothing'], correct: 0, explain: '5 rights: patient, med, dose, route, date.', skill: 'medDose', then: () => { s.flags.albT = s.t; api.bad('albAnaph', 'Wheeze eases a little... but BP keeps falling.', 'Albuterol doesn\'t treat anaphylaxis. Epi first.'); } }); },
    },
    critical: s => [
      { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
      { label: 'Checked BP (found shock)', why: 'SBP in the 70s-80s = anaphylactic shock.', ok: s.flags.bpChecked },
      { label: 'SAMPLE: found the allergen', why: 'Allergen + symptoms = anaphylaxis, even with no hives.', ok: s.flags.sample },
      { label: 'Epi within 90 s, right dose', why: kid ? 'Child 15-30 kg: 0.15 mg IM thigh.' : 'Adult 0.3 mg IM thigh.', ok: !!s.flags.epiOK && s.flags.epiT - (s.flags.firstT || 0) <= 90 },
      { label: 'High-flow O2 (NRB)', why: 'Hypoxic, airway at risk.', ok: s.flags.o2 === 'nrb' || s.flags.bvm },
      { label: 'ALS / transport', why: 'It can come back (biphasic).', ok: s.flags.als || s.flags.transport },
    ] };
} };

// skill -> template
const TEMPLATE_FOR = { scene: 'co', bpCpap: 'cardioShock', medHx: 'pde5', allergy: 'asaAllergy', medDose: 'asaAllergy', bpNitro: 'ntgDrop', reassess: 'ntgDrop',
  gag: 'gagTrap', airwayAdj: 'gagTrap', glucose: 'hypo', spo2: 'hypox', lungs: 'ptx', pulseCheck: 'sca', cpr: 'sca', bleedFirst: 'hiddenBleed',
  vent: 'sedOD', ventRate: 'sedOD', epi: 'anaNoHives' };
export const TEMPLATES = T;
export const TEMPLATE_IDS = Object.keys(T);
export const TEMPLATE_SKILL = TEMPLATE_FOR;

// Build a new case for a skill (or the top weak spot, or a random review case if nothing is weak).
export function makeCase(skill) {
  const d = adLoad();
  skill = skill || pickSkill();
  const tid = skill && TEMPLATE_FOR[skill] ? TEMPLATE_FOR[skill] : adPick(Object.keys(T));
  const scn = T[tid].make(d, skill);
  if (skill && SKILLS[skill]) scn.tested = skill;
  scn.title = '🎯 ' + scn.title; scn.template = tid;
  d.streak = d.lastSkill === scn.tested ? (d.streak || 0) + 1 : 1; d.lastSkill = scn.tested; adSave();
  return scn;
}
export function makeTemplate(tid, skill) { const d = adLoad(); const scn = T[tid].make(d, skill); scn.title = '🎯 ' + scn.title; scn.template = tid; adSave(); return scn; }
