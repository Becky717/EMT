// =====================================================================
//  EMT SIM VR — DATA & PHYSIOLOGY RULES
//  Everything medical lives in this file: actions, generic treatment
//  rules, and the scenarios (findings, vitals, how the patient responds).
//  Standards: AHA 2020 Guidelines + 2023/2024 focused updates (BLS/PALS),
//  NREMT EMT scope / National EMS Education Standards. Local protocols vary.
// =====================================================================
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- ACTIONS (tab: 0 Assess, 1 Tools, 2 Airway/CPR, 3 Meds, 4 Trauma)
export const TABS = ['ASSESS', 'TOOLS', 'AIRWAY/CPR', 'MEDS', 'TRAUMA'];
export const ACTIONS = {
  scene:      { label: 'Scene safe + BSI', tab: 0 },
  resp:       { label: 'Responsiveness (AVPU)', tab: 0 },
  airway:     { label: 'Open/check airway', tab: 0 },
  breathing:  { label: 'Check breathing', tab: 0 },
  pulse:      { label: 'Check pulse', tab: 0 },
  skin:       { label: 'Check skin', tab: 0 },
  pupils:     { label: 'Check pupils', tab: 0 },
  sample:     { label: 'SAMPLE history', tab: 0 },
  opqrst:     { label: 'OPQRST', tab: 0 },
  bleeding:   { label: 'Rapid scan: bleeding', tab: 0 },
  spo2:       { label: 'Pulse oximeter', tab: 1 },
  bp:         { label: 'BP cuff', tab: 1 },
  lungs:      { label: 'Stethoscope: lungs', tab: 1 },
  glucose:    { label: 'Glucometer', tab: 1 },
  posSit:     { label: 'Position: sit up', tab: 1 },
  posSupine:  { label: 'Position: lay flat', tab: 1 },
  posRecovery:{ label: 'Recovery position', tab: 1 },
  als:        { label: 'Call ALS', tab: 1 },
  transport:  { label: 'Begin transport', tab: 1 },
  nc:         { label: 'Nasal cannula 2-6 L', tab: 2 },
  nrb:        { label: 'NRB mask 15 L', tab: 2 },
  bvm:        { label: 'BVM', tab: 2 },
  opa:        { label: 'OPA', tab: 2 },
  npa:        { label: 'NPA', tab: 2 },
  suction:    { label: 'Suction', tab: 2 },
  cpap:       { label: 'CPAP', tab: 2 },
  cpr:        { label: 'Start CPR', tab: 2 },
  aed:        { label: 'AED', tab: 2 },
  asa:        { label: 'Aspirin', tab: 3 },
  ntg:        { label: 'Nitroglycerin', tab: 3 },
  oralglucose:{ label: 'Oral glucose', tab: 3 },
  albuterol:  { label: 'Albuterol inhaler', tab: 3 },
  epi:        { label: 'Epi auto-injector', tab: 3 },
  naloxone:   { label: 'Naloxone (IN)', tab: 3 },
  tourniquet: { label: 'Tourniquet', tab: 4 },
  dressing:   { label: 'Pressure dressing', tab: 4 },
  collar:     { label: 'Cervical collar', tab: 4 },
  blanket:    { label: 'Blanket', tab: 4 },
};
const TREATMENTS = new Set(['nc','nrb','bvm','opa','npa','suction','cpap','cpr','aed','asa','ntg','oralglucose','albuterol','epi','naloxone','tourniquet','dressing','collar','blanket']);
export const isTreatment = id => TREATMENTS.has(id);

const AVPU_TEXT = { A: 'Alert, answers you (A).', V: 'Drowsy; only responds to your voice (V).', P: 'Only responds to pain (P).', U: 'Unresponsive (U).' };
const SKIN_TEXT = { normal: 'pink, warm', pale: 'pale, cool', cyanotic: 'blue-gray (cyanotic)', flushed: 'red, flushed', mottled: 'mottled, cool' };

// ---------- shared prompts (her weak spots live here)
export function bvmRatePrompt(s) {
  const kid = s.age !== 'adult';
  if (s.pulseless || s.flags.cprIndicated) {
    return s.twoRescuer && kid
      ? { q: 'Two-rescuer infant/child CPR, no advanced airway. Breaths?', options: ['2 breaths after every 30 compressions', '2 breaths after every 15 compressions', '1 breath every 6 s, no pauses', '1 breath every 2-3 s'], correct: 1, explain: 'Two rescuers on a child or infant use 15:2. One rescuer uses 30:2 at any age.', skill: 'ventRate' }
      : { q: 'CPR, no advanced airway yet. Breaths?', options: ['2 breaths after every 30 compressions', '2 breaths after every 15 compressions', '1 breath every 6 s, no pauses', '1 breath every 2-3 s'], correct: 0, explain: 'Adult CPR is 30:2 (each breath over 1 second, just enough for chest rise) until an advanced airway is placed.', skill: 'ventRate' };
  }
  return kid
    ? { q: 'Pulse present, breathing inadequate. Ventilation rate?', options: ['1 breath every 6 s', '1 breath every 2-3 s (20-30/min)', '1 breath every 10 s', 'As fast as you can squeeze'], correct: 1, explain: 'Infants/children with a pulse: 1 breath every 2-3 s. Adults: 1 every 6 s.', skill: 'ventRate' }
    : { q: 'Pulse present, breathing inadequate. Ventilation rate?', options: ['1 breath every 6 s (10/min)', '1 breath every 2-3 s', '1 breath every 10 s', 'As fast as you can squeeze'], correct: 0, explain: 'Adult with a pulse: 1 breath every 6 s, over 1 s each. Over-bagging raises chest pressure and inflates the stomach.', skill: 'ventRate' };
}
export const BVM_FLOW_PROMPT = { q: 'Hooking up the BVM. Oxygen flow?', options: ['2-6 L/min', '6-10 L/min', '10-12 L/min', '15 L/min'], correct: 3, explain: 'BVM: 15 L/min (or more) so the reservoir fills, giving nearly 100% O2.', skill: 'ventRate' };
export const ADV_AIRWAY_PROMPT = { q: 'Paramedic placed an advanced airway. How do you ventilate now?', options: ['Keep 30:2, pause for breaths', '1 breath every 6 s, compressions never stop', '1 breath every 2-3 s', '1 breath every 10 s'], correct: 1, explain: 'With an advanced airway: 1 breath every 6 s (10/min) and continuous compressions, no pauses.', skill: 'ventRate' };

// ---------- GENERIC RULES (used unless a scenario overrides an action)
export const GENERIC = {
  scene: (s, api) => { s.flags.scene = true; api.info(s.find.scene || 'Scene is safe. Gloves on.'); },
  resp: (s, api) => { s.reveal.avpu = true; api.info(s.find.resp || AVPU_TEXT[s.v.avpu]); },
  airway: (s, api) => { s.flags.airwayChecked = true; api.info(s.find.airway || (s.v.avpu === 'A' ? 'Airway open and clear; talking.' : 'Airway open, no obstruction.')); },
  breathing: (s, api) => {
    s.reveal.rr = true; s.flags.breathingChecked = true;
    if (s.find.breathing) return api.info(s.find.breathing);
    const rr = Math.round(s.v.rr);
    if (rr === 0) return api.info('NOT breathing.');
    api.info(`RR ${rr}, ${s.chest < 0.45 ? 'shallow' : 'adequate depth'}${rr < 8 ? ' - inadequate!' : rr > 24 ? ', labored' : ''}.`);
  },
  pulse: (s, api) => {
    s.reveal.hr = true; s.flags.pulseChecked = true;
    if (s.pulseless) return api.info(s.find.pulse || 'No carotid pulse (checked under 10 s).');
    if (s.find.pulse && !s.flags.rosc) return api.info(s.find.pulse);
    const hr = Math.round(s.v.hr);
    api.info(`Pulse ${hr}, ${hr > 100 ? 'rapid' : hr < 60 ? 'slow' : 'regular'}${s.v.sbp < 90 ? ', weak and thready' : ''}.`);
  },
  skin: (s, api) => api.info(`Skin ${SKIN_TEXT[s.skin]}${s.sweat ? ', sweaty (diaphoretic)' : ', dry'}${s.hives ? ', HIVES on arms and neck' : ''}.`),
  pupils: (s, api) => api.info(s.find.pupils || 'Pupils equal, round, reactive (PERRL).'),
  sample: (s, api) => { s.flags.sample = true; api.info(s.find.sample || 'No significant history.'); },
  opqrst: (s, api) => { s.flags.opqrst = true; api.info(s.find.opqrst || 'Patient cannot describe.'); },
  bleeding: (s, api) => { s.flags.scanned = true; api.info(s.find.bleeding || 'No major bleeding found.'); },
  spo2: (s, api) => { s.reveal.spo2 = true; s.reveal.hr = true; s.flags.spo2 = true; api.info(s.pulseless ? 'Pulse ox reads nothing - no perfusion.' : `Pulse ox on: SpO2 ${Math.round(s.v.spo2)}%.`); },
  bp: (s, api) => { s.reveal.bp = true; s.flags.bpChecked = true; s.flags.bpT = s.t; api.info(s.pulseless ? 'No BP obtainable.' : `BP ${Math.round(s.v.sbp)}/${Math.round(s.v.dbp)}.`); },
  lungs: (s, api) => { s.flags.lungs = true; api.info('Lungs: ' + (s.lungs || 'clear and equal.')); },
  glucose: (s, api) => { s.reveal.bgl = true; api.info(`Blood glucose ${Math.round(s.v.bgl ?? 104)} mg/dL.`); },
  posSit: (s, api) => { if (s.v.avpu !== 'A') return api.bad('posSitU', 'Patient can\'t protect their airway sitting up.', 'Altered patients go supine or in the recovery position.'); s.pose = s.flags.sev > 0.4 ? 'tripod' : 'sitting'; s.flags.posSit = true; api.info('Sitting up in a position of comfort.'); },
  posSupine: (s, api) => { s.pose = 'supine'; s.flags.supine = true; api.info('Patient laid flat.'); },
  posRecovery: (s, api) => { s.pose = 'supine'; api.info('Recovery position helps drainage if breathing adequately and no spine concern.'); },
  als: (s, api) => { if (!s.flags.als) { s.flags.als = true; s.flags.alsT = s.t; } api.info('ALS requested. Medic unit about 3 minutes out.'); },
  transport: (s, api) => api.prompt({ q: 'Begin transport now? (Ends the scenario.)', options: ['Yes, load and go', 'Not yet'], correct: -1, then: (ok, i) => { if (i === 0) { s.flags.transport = true; api.end('transport'); } } }),
  nc: (s, api) => {
    if (s.v.rr < 8 || s.pulseless) return api.bad('o2inad', 'Cannula can\'t help - patient isn\'t moving enough air.', 'Inadequate breathing needs BVM ventilation, not passive O2.');
    s.flags.o2 = 'nc'; s.devices.delete('nrb'); s.devices.delete('cpap'); s.devices.add('nc'); api.info('Nasal cannula at 4 L/min.');
  },
  nrb: (s, api) => {
    if (s.v.rr < 8 || s.pulseless) { s.devices.add('nrb'); return api.bad('o2inad', 'No change - O2 mask does nothing if they aren\'t breathing enough.', 'RR under 8 or apnea = ventilate with BVM at 15 L/min.'); }
    s.flags.o2 = 'nrb'; s.devices.delete('nc'); s.devices.delete('cpap'); s.devices.delete('bvm'); s.devices.add('nrb'); api.info('NRB at 15 L/min, reservoir full.');
  },
  bvm: (s, api) => {
    if (s.v.avpu === 'A' && s.v.rr >= 10 && !s.pulseless) return api.bad('bvmAlert', 'Patient is alert and breathing - fights the BVM.', 'BVM is for inadequate or absent breathing. Alert + adequate = NRB.');
    const doRate = () => api.prompt({ ...bvmRatePrompt(s), then: ok => {
      s.flags.bvm = true; s.flags.bvmRateOK = ok; s.devices.delete('nrb'); s.devices.delete('nc'); s.devices.add('bvm');
      if (s.pulseless) s.reveal.etco2 = true;
      if (!ok) api.bad('bvmRate', 'Rate corrected by your partner.', 'Wrong ventilation rate; see explanation.');
      s.scn.onBVM && s.scn.onBVM(s, api);
    } });
    if (!s.flags.bvmFlowAsked) { s.flags.bvmFlowAsked = true; api.prompt({ ...BVM_FLOW_PROMPT, then: ok => { if (!ok) api.bad('bvmFlow', 'Flow set to 15 L/min.', 'BVM O2 flow is 15 L/min.'); doRate(); } }); }
    else doRate();
  },
  opa: (s, api) => {
    if (s.v.avpu === 'A' || s.v.avpu === 'V' || s.flags.gag) {
      s.vomit = true; s.flags.vomitedFromOPA = true;
      api.say('Partner', 'He\'s gagging - he\'s vomiting! Suction!');
      return api.bad('opaGag', 'Patient gagged and vomited.', 'OPA only if there\'s no gag reflex. A gag reflex = use an NPA instead.', true);
    }
    api.prompt({ q: 'How do you size the OPA?', options: ['Tip of nose to earlobe', 'Corner of mouth to earlobe / angle of jaw', 'Lips to chin', 'Width of their pinky'], correct: 1, explain: 'OPA: corner of mouth to earlobe or angle of jaw. Nose-to-earlobe is the NPA.', skill: 'airwayAdj', then: () => { s.flags.adjunct = 'opa'; s.flags.airwayOpen = true; s.devices.add('opa'); s.scn.onAdjunct && s.scn.onAdjunct(s, api); } });
  },
  npa: (s, api) => {
    if (s.v.avpu === 'A') return api.bad('npaAlert', 'Alert patient doesn\'t need an airway adjunct.', 'Adjuncts are for patients who can\'t keep their own airway open.');
    if (s.flags.facialTrauma) return api.bad('npaFace', 'Facial trauma - avoid NPA.', 'Suspected basilar skull/facial fractures are an NPA contraindication.', true);
    api.prompt({ q: 'How do you size the NPA?', options: ['Corner of mouth to angle of jaw', 'Tip of nose (nostril) to earlobe', 'Lips to chin', 'Any size, lube optional'], correct: 1, explain: 'NPA: nostril to earlobe, lubricated, bevel toward the septum.', skill: 'airwayAdj', then: () => { s.flags.adjunct = 'npa'; s.flags.airwayOpen = true; s.devices.add('npa'); s.scn.onAdjunct && s.scn.onAdjunct(s, api); } });
  },
  suction: (s, api) => {
    if (!s.vomit && !s.flags.secretions) return api.info('Airway is clear - nothing to suction.');
    const lim = s.age === 'infant' ? 2 : s.age === 'child' ? 1 : 0;
    api.prompt({ q: `Suctioning this ${s.age}. Max time per attempt?`, options: ['15 seconds', '10 seconds', '5 seconds', '30 seconds'], correct: lim, explain: 'Suction limits: adult 15 s, child 10 s, infant 5 s. Suction on the way OUT, then re-oxygenate.', skill: 'airwayAdj', then: () => { s.vomit = false; s.flags.secretions = false; s.flags.suctioned = true; api.good('Airway cleared.'); s.scn.onSuction && s.scn.onSuction(s, api); } });
  },
  cpap: (s, api) => {
    s.devices.add('cpap');
    if (!s.flags.bpChecked) api.bad('cpapNoBP', 'CPAP applied without checking BP.', 'Always get a BP before CPAP: SBP under 90 is a contraindication.');
    if (s.v.avpu !== 'A' || s.pulseless) { s.devices.delete('cpap'); return api.bad('cpapAMS', 'Can\'t use CPAP - patient can\'t follow commands/protect airway.', 'CPAP needs an alert patient who can protect their airway and breathe on their own. Ventilate with BVM.', true); }
    if (s.v.rr < 10) { s.devices.delete('cpap'); return api.bad('cpapRR', 'CPAP won\'t work - breathing too slow.', 'CPAP needs adequate spontaneous breathing.', true); }
    if (s.v.sbp < 90) { s.flags.cpapHarm = true; s.flags.o2 = 'cpap'; return api.bad('cpapHypo', 'BP is dropping and patient getting dizzy.', 'SBP under 90 = no CPAP. It raises chest pressure, cuts blood return to the heart, and BP falls further.', true); }
    if (s.vomit) { s.devices.delete('cpap'); return api.bad('cpapVomit', 'Vomiting - CPAP removed.', 'Active vomiting is a CPAP contraindication (aspiration).', true); }
    if (s.flags.pneumo) { s.flags.cpapHarm = true; return api.bad('cpapPtx', 'Breathing worse.', 'Suspected pneumothorax or chest trauma is a CPAP contraindication.', true); }
    s.flags.o2 = 'cpap'; s.devices.delete('nrb'); s.devices.delete('nc');
    if (s.flags.cpapIndicated) api.good('CPAP on, about 5-10 cmH2O. Coaching patient to breathe with it.');
    else api.info('CPAP applied - acceptable per protocol, but not the key treatment here.');
  },
  cpr: (s, api) => { if (!s.pulseless && !s.flags.cprIndicated) return api.bad('cprPulse', 'Patient has a pulse - no CPR!', 'Never do compressions on a patient with an adequate pulse.', true); },
  aed: (s, api) => { if (!s.pulseless) return api.bad('aedPulse', 'AED is for pulseless patients only.', 'Patient has a pulse; AED pads are not indicated.'); },
  asa: (s, api) => api.bad('asaNI', 'Aspirin isn\'t indicated here.', 'Aspirin is for suspected ACS (cardiac chest pain).'),
  ntg: (s, api) => api.bad('ntgNI', 'Nitro isn\'t indicated here.', 'EMTs assist with the patient\'s own nitro for cardiac chest pain, SBP OK, no PDE5 drugs.', s.v.sbp < 100),
  oralglucose: (s, api) => s.v.avpu !== 'A' ? api.bad('ogAMS', 'Can\'t give oral glucose - can\'t swallow safely.', 'Oral glucose needs an alert patient who can swallow and protect the airway.', true) : api.info(`Not needed - glucose is ${s.v.bgl ?? 104} mg/dL.`),
  albuterol: (s, api) => api.bad('albNI', 'Albuterol isn\'t indicated here.', 'EMTs assist with the patient\'s own inhaler for bronchospasm (wheezing).'),
  epi: (s, api) => api.bad('epiNI', 'Epi raises HR and BP - not indicated here.', 'Epinephrine auto-injector is for anaphylaxis.', true),
  naloxone: (s, api) => api.info('No change - no opioid toxicity signs here.'),
  tourniquet: (s, api) => api.info('No extremity bleeding that needs a tourniquet.'),
  dressing: (s, api) => api.info('No wound that needs a dressing.'),
  collar: (s, api) => api.info('No spinal-injury mechanism - collar not needed.'),
  blanket: (s, api) => { s.devices.add('blanket'); s.flags.blanket = true; api.info('Covered with a blanket to stay warm.'); },
};

// helper to set breathing visuals from vitals
const speech = (s, who, txt) => { if (s.speech !== txt) { s.speech = txt; s.who = who; } };

// ---------- SCENARIOS
// update(s, dt, api): set s.target vitals + visible signs. Engine drifts real vitals toward s.target.
// critical(s): list of { label, why, ok } for the debrief.
export const SCENARIOS = [
// 1 ------------------------------------------------------------------
{
  id: 'asthma', tags: ['spo2','lungs'], cat: 'Airway', title: 'Asthma attack', age: 'adult',
  dispatch: '24 y/o female, difficulty breathing. Apartment.',
  setup: s => {
    Object.assign(s.v, { hr: 122, sbp: 142, dbp: 88, rr: 30, spo2: 88, etco2: 48, avpu: 'A', bgl: 112 });
    Object.assign(s, { pose: 'tripod', skin: 'pale', sweat: true, chest: 0.4, sex: 'f', shirt: 0x6a4c93 });
    s.flags.sev = 0.55;
  },
  find: {
    scene: 'Apartment, safe. Strong bleach smell. Gloves on. Woman sitting on the couch edge, leaning on her knees (tripod).',
    airway: 'Airway open; she can only speak 2-3 words at a time.',
    sample: 'S: SOB 30 min. A: none. M: albuterol inhaler (hers, not expired) - 2 puffs, no relief. P: asthma, hospitalized last year. L: lunch 3 h ago. E: started while cleaning with bleach.',
    opqrst: 'O: sudden while cleaning. P: worse lying down. Q: tight chest. R: none. S: 8/10. T: 30 min.',
  },
  update(s, dt, api) {
    const f = s.flags;
    if (f.albT > 0) { f.albT -= dt; f.sev -= 0.0075 * dt; } else f.sev += (f.o2 ? 0.002 : 0.0035) * dt;
    if (f.supineT > 0) { f.supineT -= dt; f.sev += 0.003 * dt; }
    f.sev = clamp(f.sev, 0.1, 1.7);
    const o2 = { nc: 3, nrb: 7, cpap: 8 }[f.o2] || 0;
    if (f.sev > 1.25 && !f.bvm) {
      if (!f.failing) { f.failing = true; api.say('Partner', 'She\'s getting sleepy and her breathing is slowing down!'); api.log('Respiratory FAILURE: falling mental status + slowing RR. Ventilate!', 'bad'); }
      Object.assign(s.target, { rr: 7, hr: 56, spo2: 70, sbp: 118, etco2: 70 }); s.v.avpu = 'V';
      Object.assign(s, { skin: 'cyanotic', chest: 0.2, pose: 'supine' }); speech(s, 'Patient', '(eyes closing, not speaking)');
      s.lungs = 'Almost silent chest - very little air moving.';
      return;
    }
    if (f.failing && f.bvm) { Object.assign(s.target, { rr: 12, hr: 112, spo2: 93, sbp: 130, etco2: 50 }); s.chest = 0.8; s.skin = 'pale'; speech(s, 'Patient', '(drowsy, moaning)'); return; }
    s.v.avpu = 'A';
    Object.assign(s.target, { rr: 18 + f.sev * 16, hr: 92 + f.sev * 38, spo2: clamp(98 - f.sev * 15 + o2, 70, 99), sbp: 128 + f.sev * 16, dbp: 80 + f.sev * 8, etco2: 36 + f.sev * 14 });
    s.chest = clamp(1.05 - f.sev * 0.6, 0.3, 1);
    s.skin = f.sev > 0.95 ? 'cyanotic' : f.sev > 0.35 ? 'pale' : 'normal'; s.sweat = f.sev > 0.45;
    if (s.pose !== 'supine') s.pose = f.sev > 0.4 ? 'tripod' : 'sitting';
    s.lungs = f.sev > 0.9 ? 'Very diminished, faint wheezes - poor air movement (worrying!).' : f.sev > 0.4 ? 'Diffuse expiratory wheezes, diminished in the bases.' : 'Few scattered wheezes, air moving well.';
    speech(s, 'Patient', f.sev > 0.9 ? 'Can\'t... breathe...' : f.sev > 0.4 ? 'Chest... so... tight.' : 'That\'s helping. I can breathe better.');
  },
  actions: {
    albuterol: (s, api) => {
      if (s.v.avpu !== 'A') return api.bad('albAMS', 'She can\'t use the inhaler now - too drowsy.', 'MDI needs an alert patient who can coordinate a deep breath. Ventilate with BVM.');
      s.flags.alb = (s.flags.alb || 0) + 1;
      if (s.flags.alb > 2) return api.info('Contact medical control before more doses.');
      api.prompt({ q: 'Before assisting with her inhaler, you confirm:', options: ['Her own Rx, not expired, right dose, alert enough', 'Any inhaler from the ambulance', 'Only that it is blue', 'Nothing - speed matters'], correct: 0, explain: 'EMTs assist with the PATIENT\'S OWN prescribed inhaler: right patient, med, dose, route, date.', skill: 'medDose', then: () => { s.flags.albT = 45; api.good('Assisted 1-2 puffs (spacer). Bronchodilator working...'); } });
    },
    posSupine: (s, api) => { s.pose = 'supine'; s.flags.supineT = 25; s.flags.supine = true; api.bad('supine', 'She panics - lying flat makes breathing harder.', 'Breathing-trouble patients usually stay sitting up (position of comfort).'); },
    epi: (s, api) => api.bad('epiAsthma', 'Not in EMT asthma protocol (no anaphylaxis signs).', 'Epi auto-injector is for anaphylaxis; asthma = O2 + her own albuterol.'),
  },
  critical: s => [
    { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
    { label: 'Listened to lung sounds', why: 'Wheezing confirms bronchospasm and guides albuterol.', ok: s.flags.lungs },
    { label: 'Checked SpO2', why: 'Hypoxia + distress = high-flow O2.', ok: s.flags.spo2 },
    { label: 'High-flow O2 (NRB 15 L/min)', why: 'She is hypoxic and in distress.', ok: ['nrb','cpap'].includes(s.flags.o2) || s.flags.bvm },
    { label: 'Assisted with HER albuterol', why: 'Bronchodilator is the key treatment for asthma at EMT level.', ok: s.flags.alb > 0 },
    { label: 'Kept her sitting up', why: 'Position of comfort; lying flat worsens dyspnea.', ok: !s.flags.supine },
    ...(s.flags.failing ? [{ label: 'BVM when she tired out', why: 'Falling mental status + slow RR = failure; ventilate at 1 breath every 6 s.', ok: s.flags.bvm }] : []),
    { label: 'Transported', why: 'Severe asthma needs the ED.', ok: s.flags.transport },
  ],
},
// 2 ------------------------------------------------------------------
{
  id: 'chf', tags: ['bpCpap','lungs','spo2'], cat: 'Airway', title: 'CHF / pulmonary edema (CPAP?)', age: 'adult',
  dispatch: '72 y/o male, can\'t breathe, woke up gasping. 2 AM.',
  setup: s => {
    s.variant = Math.random() < 0.5 ? 'hypo' : 'hyper';
    if (s.variant === 'hyper') Object.assign(s.v, { hr: 112, sbp: 178, dbp: 102, rr: 32, spo2: 86, etco2: 40, avpu: 'A' });
    else Object.assign(s.v, { hr: 118, sbp: 84, dbp: 52, rr: 30, spo2: 85, etco2: 38, avpu: 'A' });
    Object.assign(s, { pose: 'tripod', skin: 'pale', sweat: true, chest: 0.5, sex: 'm', shirt: 0x4a6fa5, lungs: 'Crackles (rales) in both lungs, halfway up.' });
    s.flags.sev = 0.6; s.flags.cpapIndicated = s.variant === 'hyper';
  },
  find: {
    scene: 'Home, safe. Gloves on. Man sitting on the edge of his bed, pillows stacked, ankles swollen. Pink frothy sputum in a tissue.',
    sample: 'S: woke up gasping, coughing pink froth. A: penicillin. M: furosemide (ran out 4 days ago), lisinopril, metoprolol. P: CHF, MI 2019. L: salty dinner. E: worse over 3 days; can\'t lie flat.',
    opqrst: 'No chest pain. Gradual over 3 days, much worse lying flat tonight.',
  },
  update(s, dt, api) {
    const f = s.flags, hyper = s.variant === 'hyper';
    const cpapOn = s.devices.has('cpap');
    if (cpapOn && hyper && s.v.avpu === 'A') f.sev -= 0.007 * dt; else f.sev += (f.o2 ? 0.0015 : 0.003) * dt;
    if (f.supineT > 0) { f.supineT -= dt; f.sev += 0.004 * dt; }
    f.sev = clamp(f.sev, 0.1, 1.6);
    const o2 = { nc: 2, nrb: 6, cpap: 9 }[f.o2] || 0;
    let sbp = hyper ? 150 + f.sev * 40 - (cpapOn ? 10 : 0) : 90 - f.sev * 10;
    if (!hyper && cpapOn) { sbp -= 20; f.cpapHarm = true; }
    s.target.sbp = sbp; s.target.dbp = sbp * 0.6;
    s.target.hr = 98 + f.sev * 25 + (hyper ? 0 : 8) + (sbp < 75 ? 10 : 0);
    s.target.rr = 20 + f.sev * 16; s.target.spo2 = clamp(97 - f.sev * 16 + (cpapOn && !hyper ? 2 : o2), 70, 99);
    s.chest = clamp(1 - f.sev * 0.55, 0.3, 1);
    s.v.avpu = (s.v.sbp < 76 || f.sev > 1.35) ? 'V' : 'A';
    if (s.v.avpu === 'V' && s.pose !== 'supine') s.pose = 'sitting';
    s.skin = f.sev > 1 ? 'cyanotic' : 'pale'; s.sweat = f.sev > 0.35;
    s.lungs = f.sev > 0.9 ? 'Crackles all the way up both lungs, gurgling.' : f.sev > 0.4 ? 'Crackles (rales) in both lungs, halfway up.' : 'Fine crackles only in the bases - improving.';
    speech(s, 'Patient', s.v.avpu === 'V' ? '(dizzy, confused) ...what?...' : f.sev > 0.9 ? 'Feel... like... drowning...' : f.sev > 0.4 ? 'Can\'t... lie down... can\'t breathe.' : 'Oh... that\'s easier. Thank you.');
  },
  actions: {
    posSupine: (s, api) => { s.pose = 'supine'; s.flags.supineT = 25; s.flags.supine = true; api.bad('supine', 'He\'s drowning lying flat - fluid shifts into the lungs.', 'Pulmonary edema patients sit upright, legs dangling if possible.'); },
    ntg: (s, api) => s.variant === 'hypo' ? api.bad('ntgHypo', 'BP crashes further!', 'Never nitro with SBP under 90-100. And EMTs assist nitro for chest pain only.', true) : api.bad('ntgCHF', 'Not in EMT scope here (no chest pain).', 'EMTs assist with the patient\'s own nitro for chest pain. ALS may give nitro for CHF.'),
  },
  critical: s => [
    { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
    { label: 'Listened to lungs (crackles)', why: 'Crackles + orthopnea + edema = pulmonary edema.', ok: s.flags.lungs },
    { label: 'Checked BP before the CPAP decision', why: 'SBP decides whether CPAP is safe.', ok: s.flags.bpChecked && (!s.devices.has('cpap') || !s.flags.mistakeKeys?.has('cpapNoBP')) },
    s.variant === 'hyper'
      ? { label: 'CPAP for alert pt with good BP', why: 'CPAP pushes fluid out of the alveoli and is the best EMT treatment for CHF with SBP 90+.', ok: s.flags.o2 === 'cpap' }
      : { label: 'NO CPAP (SBP 84), used NRB instead', why: 'SBP under 90 = CPAP contraindicated; give NRB 15 L/min and get ALS.', ok: !s.flags.cpapHarm && (s.flags.o2 === 'nrb' || s.flags.bvm) },
    { label: 'Kept him sitting up', why: 'Lying flat floods the lungs.', ok: !s.flags.supine },
    { label: 'ALS / transport', why: 'Needs meds (nitro, diuretics) and the ED.', ok: s.flags.als || s.flags.transport },
  ],
},
// 3 ------------------------------------------------------------------
{
  id: 'opioid', tags: ['gag','vent','glucose','spo2'], cat: 'Airway', title: 'Opioid overdose', age: 'adult',
  dispatch: '28 y/o male, unresponsive in a restroom.',
  setup: s => {
    Object.assign(s.v, { hr: 54, sbp: 104, dbp: 66, rr: 4, spo2: 76, etco2: 68, avpu: 'P', bgl: 96 });
    Object.assign(s, { pose: 'supine', skin: 'cyanotic', sweat: false, chest: 0.15, sex: 'm', shirt: 0x556b2f, lungs: 'Faint, slow, shallow; snoring and gurgling up top.' });
    s.flags.gag = true; s.flags.secretions = true; s.say('Bystander', 'He stopped answering me! He was using in there.');
  },
  find: {
    scene: 'Gas-station restroom. Used syringe on the floor - you secure it before touching him. Gloves on.',
    resp: 'Only moans to a sternal rub (P). Gags a little when you check his mouth.',
    airway: 'Snoring = tongue blocking. Head-tilt chin-lift helps. Gurgling = fluid in the airway: suction it.',
    breathing: 'RR 4, very shallow - INADEQUATE. He needs ventilation.',
    pupils: 'Pinpoint (very small).',
    sample: '(Bystander) S: unresponsive. A: unknown. M: uses heroin/fentanyl. P: overdosed once before. L: unknown. E: injected about 10 min ago.',
  },
  update(s, dt, api) {
    const f = s.flags;
    if (s.find.airway && f.airwayChecked) f.airwayOpen = true;
    const nal = f.nalT != null ? s.t - f.nalT : -1;
    if (nal > 30) {
      Object.assign(s.target, { rr: 14, hr: 92, spo2: f.o2 || f.bvm ? 97 : 94, sbp: 124, etco2: 40 });
      s.v.avpu = nal > 50 ? 'A' : 'V'; s.chest = 0.9; s.skin = s.v.spo2 > 90 ? 'normal' : 'pale'; f.gag = true;
      if (f.bvm && s.v.avpu === 'A' && !f.bvmOff) { f.bvmOff = true; s.devices.delete('bvm'); api.log('He\'s breathing on his own now - switched him to NRB.', 'good'); s.devices.add('nrb'); f.o2 = 'nrb'; }
      speech(s, 'Patient', s.v.avpu === 'A' ? 'What happened? Why is everyone here?' : '(groggy, mumbling)');
      return;
    }
    let spo2 = 76 - s.t * 0.13, hr = 54;
    if (f.bvm) { const eff = f.airwayOpen && !f.secretions && !s.vomit; spo2 = eff ? 96 : 84; hr = eff ? 88 : 70; if (!eff && !f.ventWarn) { f.ventWarn = true; api.log('Bagging is hard - air is gurgling / not going in well. Open & clear the airway.', 'bad'); } }
    s.target.spo2 = clamp(spo2, 52, 99);
    if (s.v.spo2 < 65) hr = 40;
    Object.assign(s.target, { hr, rr: 4, etco2: f.bvm ? 42 : 70, sbp: s.v.spo2 < 65 ? 84 : 104 });
    s.skin = s.v.spo2 > 92 ? 'pale' : 'cyanotic'; s.chest = f.bvm ? 0.85 : 0.15;
    speech(s, 'Bystander', s.v.spo2 < 70 ? 'He\'s turning blue! Do something!' : f.bvm ? 'Is he going to be OK?' : 'He stopped answering me! He was using in there.');
    if (s.v.spo2 < 62) { f.lowT = (f.lowT || 0) + dt; if (f.lowT > 25) api.end('fail', 'His heart slowed and stopped from lack of oxygen. Ventilation (BVM) is the first fix - naloxone takes minutes.'); }
  },
  onBVM: (s, api) => api.good('Bagging at 15 L/min - chest rising.' + (s.flags.airwayOpen ? '' : ' (open his airway first!)')),
  actions: {
    naloxone: (s, api) => {
      if (s.flags.nalT != null) return api.info('Already given - give it time and keep ventilating.');
      api.prompt({ q: 'Naloxone dose/route at EMT level?', options: ['4 mg intranasal (per protocol)', '50 mg by mouth', '0.4 mg chewed', 'Into the airway'], correct: 0, explain: 'Intranasal naloxone (commonly 2-4 mg; 4 mg nasal spray). Ventilate first - it takes a few minutes to work.', skill: 'medDose', then: () => {
        s.flags.nalT = s.t; if (!s.flags.bvm) api.log('Tip: ventilate first - naloxone takes 2-5 min and he\'s hypoxic NOW.', 'warn'); api.good('Naloxone given. Keep bagging while it works.'); } });
    },
  },
  critical: s => [
    { label: 'Scene safety first (secured the needle)', why: 'Needlesticks are a real risk on OD calls.', ok: s.flags.sceneFirst },
    { label: 'Opened the airway', why: 'Snoring = tongue obstruction; head-tilt chin-lift (or jaw thrust).', ok: s.flags.airwayOpen },
    { label: 'Suctioned the gurgling', why: 'Gurgling = fluid; suction before ventilating (adult max 15 s).', ok: s.flags.suctioned },
    { label: 'NPA, not OPA (he has a gag reflex)', why: 'OPA only with NO gag reflex; NPA is tolerated by semi-responsive patients.', ok: s.flags.adjunct === 'npa' && !s.flags.vomitedFromOPA },
    { label: 'BVM 15 L/min, 1 breath every 6 s', why: 'RR 4 is inadequate: NRB alone does nothing. Ventilate.', ok: s.flags.bvm && s.flags.bvmRateOK },
    { label: 'Naloxone', why: 'Reverses opioid respiratory depression.', ok: s.flags.nalT != null },
    { label: 'Transported', why: 'Naloxone can wear off before the opioid does.', ok: s.flags.transport },
  ],
},
// 4 ------------------------------------------------------------------
{
  id: 'arrest', tags: ['pulseCheck','cpr','aed'], cat: 'Cardiac', title: 'Adult cardiac arrest (AED)', age: 'adult',
  dispatch: '58 y/o male collapsed at a gym. Bystanders on scene.',
  setup: s => {
    Object.assign(s.v, { hr: 0, sbp: 0, dbp: 0, rr: 0, spo2: 0, etco2: 4, avpu: 'U' });
    Object.assign(s, { pose: 'supine', skin: 'cyanotic', sweat: false, chest: 0, agonal: true, sex: 'm', shirt: 0x999999, rhythm: 'VF', pulseless: true, lungs: 'No breath sounds (not breathing).' });
    s.flags.noFlow = 0; s.flags.postCpr = 0; s.say('Bystander', 'He just collapsed on the treadmill! He\'s kind of gasping?');
  },
  find: {
    scene: 'Gym floor, safe. Gloves on. Collapsed about 2 min ago; no CPR yet. Someone is bringing the gym AED.',
    breathing: 'Only occasional AGONAL gasps - that is NOT breathing. Treat as not breathing.',
    pulse: 'No carotid pulse (checked 5-10 s, together with breathing).',
  },
  update(s, dt, api) {
    const f = s.flags;
    s.target.etco2 = s.cpr && !f.analyzing ? (f.cprQ === 'good' ? 18 : 10) : 4;
    if (f.rosc) {
      Object.assign(s.target, { hr: 104, sbp: 98, dbp: 62, rr: 6, spo2: f.bvm ? 96 : 86, etco2: 38 });
      s.chest = f.bvm ? 0.8 : 0.2; s.skin = 'pale'; s.cpr = false; s.agonal = false;
      speech(s, 'Partner', f.bvm ? 'Pulse is strong. Keep bagging, 1 every 6.' : 'Pulse is back but he\'s barely breathing - bag him!');
      return;
    }
    s.agonal = !s.cpr && s.t < 60;
    if (f.analyzing) {
      f.anaT -= dt;
      if (f.anaT <= 0) {
        f.analyzing = false;
        if (s.rhythm === 'VF') {
          s.say('AED', 'Shock advised. Stand clear. Shock delivered.'); f.shocks = (f.shocks || 0) + 1; f.postCpr = 0;
          api.prompt({ q: 'Shock delivered. What do you do RIGHT NOW?', options: ['Resume CPR immediately, starting with compressions', 'Check for a pulse', 'Re-analyze right away', 'Give 2 rescue breaths first'], correct: 0, explain: 'After a shock: straight back to compressions for 2 minutes. Pulse/rhythm checks come at the next analysis. Keep pauses under 10 s.', skill: 'cpr', then: ok => {
            f.shockOK = ok; if (!ok) api.bad('postShock', 'Your partner restarts compressions.', 'Resume CPR immediately after the shock - no pulse check first.', true);
            if (!f.cprQ) GENERIC_CPR_PROMPT(s, api); else s.cpr = true;
          } });
        } else { s.say('AED', 'No shock advised. Start CPR.'); s.cpr = !!f.cprQ; }
      }
      return;
    }
    if (!s.cpr) { f.noFlow += dt; if (f.noFlow > 45 && !f.nfWarn) { f.nfWarn = true; api.bad('noFlow', 'Too long without compressions!', 'Start compressions ASAP; every minute without CPR drops survival 7-10%. Pauses under 10 s.'); } }
    if (f.noFlow > 120 && s.rhythm === 'VF') { s.rhythm = 'Asystole'; api.log('Rhythm deteriorated to asystole (no-flow time too long).', 'bad'); }
    if (f.noFlow > 200) return api.end('fail', 'Too long without CPR. Early compressions + early AED are what save arrests.');
    if (s.cpr && f.shocks > 0) {
      f.postCpr += dt;
      if (f.postCpr > 25 && !f.rosc) { f.rosc = true; s.rhythm = null; s.pulseless = false; s.reveal.hr = true; api.say('Partner', '2-minute check: organized rhythm on the AED... I\'ve got a pulse! ROSC!'); api.log('ROSC! ETCO2 jumped up - a classic sign. He has a pulse but RR 6: keep ventilating.', 'good'); if (f.advOK || f.bvm) s.reveal.etco2 = true; }
    }
    if (f.als && !f.advPrompted && s.cpr && s.t - f.alsT > 15) {
      f.advPrompted = true; s.devices.add('adv'); s.reveal.etco2 = true;
      api.say('Paramedic', 'ALS here. I placed an i-gel. You take ventilations.');
      api.prompt({ ...ADV_AIRWAY_PROMPT, then: ok => { f.advOK = ok; f.bvm = true; s.devices.add('bvm'); if (!ok) api.bad('advRate', 'Medic corrects you.', 'Advanced airway = 1 breath every 6 s with continuous compressions.', true); } });
    }
  },
  actions: {
    cpr: (s, api) => {
      if (s.flags.rosc) return api.bad('cprROSC', 'He has a pulse now - no compressions!', 'After ROSC: support breathing, monitor, transport.', true);
      if (s.cpr) return api.info('CPR is already going. Switch compressors every 2 min.');
      if (!s.flags.pulseChecked && !s.flags.breathingChecked) api.bad('noCheck', 'Started CPR without a pulse/breathing check.', 'Check breathing and carotid pulse together for 5-10 s first.');
      GENERIC_CPR_PROMPT(s, api);
    },
    aed: (s, api) => {
      if (s.flags.rosc) return api.info('Leave the pads on and the AED on. He has a pulse.');
      if (s.flags.analyzing) return;
      s.devices.add('aed'); s.flags.aed = true; if (s.flags.aedT == null) s.flags.aedT = s.t;
      s.flags.analyzing = true; s.flags.anaT = 3; s.cpr = false;
      s.say('AED', 'Pads on. Analyzing heart rhythm. Do not touch the patient.');
    },
    asa: (s, api) => api.bad('asaArrest', 'Can\'t give aspirin - patient is unresponsive.', 'Oral meds need an alert patient who can swallow.', true),
    ntg: (s, api) => api.bad('ntgArrest', 'No nitro in cardiac arrest.', 'Nitro needs an alert patient with a BP.', true),
  },
  critical: s => [
    { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
    { label: 'Checked breathing + pulse (agonal = not breathing)', why: 'Agonal gasps are NOT breathing; check both in 5-10 s.', ok: s.flags.pulseChecked && s.flags.breathingChecked },
    { label: 'High-quality CPR: 30:2, 2-2.4 in, 100-120/min', why: 'Push hard, push fast, full recoil, minimal pauses.', ok: s.flags.cprQ === 'good' },
    { label: 'AED on fast', why: 'VF needs a shock; every minute matters.', ok: s.flags.aed && s.flags.aedT < 75 },
    { label: 'CPR right after the shock', why: 'Resume compressions immediately; no pulse check first.', ok: s.flags.shockOK },
    { label: 'Ventilated with BVM 15 L/min', why: 'Oxygenation during CPR (30:2 without advanced airway).', ok: s.flags.bvm },
    ...(s.flags.advPrompted ? [{ label: 'Advanced airway: 1 breath / 6 s, nonstop compressions', why: 'No more pauses once the airway is in.', ok: s.flags.advOK }] : []),
    { label: 'Called ALS', why: 'ALS brings advanced airway, meds, monitoring.', ok: s.flags.als },
    { label: 'Transported after ROSC', why: 'Post-arrest care in the hospital.', ok: s.flags.transport && s.flags.rosc },
  ],
},
// 5 ------------------------------------------------------------------
{
  id: 'infant', tags: ['pulseCheck','cpr'], cat: 'Cardiac', title: 'Infant arrest (2 rescuers)', age: 'infant',
  dispatch: '6-month-old, not breathing. Parent on scene. You and your partner respond.',
  setup: s => {
    Object.assign(s.v, { hr: 48, sbp: 50, dbp: 30, rr: 0, spo2: 62, etco2: 10, avpu: 'U' });
    Object.assign(s, { pose: 'supine', skin: 'mottled', sweat: false, chest: 0, sex: 'f', shirt: 0xf4c2c2, twoRescuer: true, lungs: 'No breath sounds.' });
    s.flags.cprIndicated = true; s.flags.secretions = true; s.say('Parent', 'She was fine at her nap... now she\'s limp! Please help her!');
  },
  find: {
    scene: 'Home nursery, safe. Gloves on. Your partner is with you - two rescuers.',
    resp: 'No response to tapping her foot or shouting (U).',
    airway: 'Some formula in her mouth - suction it. Neutral (sniffing) position, don\'t over-extend.',
    breathing: 'Not breathing (apneic).',
    pulse: 'Brachial pulse about 48/min, weak, with poor perfusion (mottled). In an infant: HR under 60 + poor perfusion = START CPR.',
  },
  update(s, dt, api) {
    const f = s.flags;
    if (f.rosc) {
      const vent = f.rescueOK;
      Object.assign(s.target, { hr: 138, sbp: 80, dbp: 50, rr: f.breathT && s.t - f.breathT > 15 ? 30 : 0, spo2: vent ? 97 : 85, etco2: 38 });
      s.cpr = false; s.chest = vent ? 0.8 : 0.1; s.skin = s.v.spo2 > 92 ? 'normal' : 'pale';
      if (vent && !f.breathT) f.breathT = s.t;
      if (s.target.rr > 0) { s.chest = 1; speech(s, 'Patient', '(weak cry)'); s.v.avpu = 'V'; }
      return;
    }
    s.target.hr = s.cpr && f.bvm ? 70 : Math.max(30, 48 - s.t * 0.05);
    s.target.spo2 = s.cpr && f.bvm ? 85 : 62 - s.t * 0.05;
    s.chest = 0; s.target.etco2 = s.cpr ? 16 : 8;
    if (s.cpr && f.bvm && !f.secretions) { f.goodT = (f.goodT || 0) + dt; }
    if (f.goodT > 20) {
      f.rosc = true; s.reveal.hr = true; f.cprIndicated = false;
      api.say('Partner', 'Pulse check: brachial 130! Still not breathing though.');
      api.prompt({ q: 'Infant has a pulse of 130 but is NOT breathing. Rescue breathing rate?', options: ['1 breath every 2-3 s (20-30/min)', '1 breath every 6 s', '15:2 with compressions', '1 breath every 10 s'], correct: 0, explain: 'Infants/children with a pulse: 1 breath every 2-3 s. Re-check pulse about every 2 min.', skill: 'ventRate', then: ok => { f.rescueOK = true; f.rescueRight = ok; if (!ok) api.bad('rescueRate', 'Partner corrects the rate.', 'Infant rescue breathing: 1 breath every 2-3 s.'); } });
    }
    if (s.t > 150 && !s.cpr) api.end('fail', 'Without CPR her heart slowed to a stop. HR under 60 with poor perfusion in an infant = start CPR.');
  },
  actions: {
    cpr: (s, api) => {
      if (s.flags.rosc) return api.bad('cprROSC', 'She has a good pulse now - no compressions.', 'Pulse 60+ = rescue breaths only.', true);
      if (s.cpr) return api.info('CPR going. Switch roles every 2 min.');
      api.prompt({ q: 'Two-rescuer infant CPR. Which combo?', options: ['30:2, about 1.5 in, 100-120/min', '15:2, about 1.5 in (1/3 chest), 100-120/min, 2-thumb encircling', '15:2, 2-2.4 in, 100-120/min', '5:1, about 0.5 in'], correct: 1, explain: 'Two rescuers on an infant: 15:2, 1/3 of chest depth (about 1.5 in / 4 cm), 100-120/min, 2-thumb encircling hands.', skill: 'cpr', then: ok => { s.flags.cprQ = ok ? 'good' : 'poor'; s.cpr = true; if (!ok) api.bad('cprCombo', 'Partner coaches you to 15:2 at 1/3 chest depth.', 'Infant 2-rescuer: 15:2, about 1.5 in (4 cm).'); else api.good('Compressions started: 15:2.'); } });
    },
    aed: (s, api) => { s.devices.add('aed'); s.flags.aed = true; s.say('AED', 'Pediatric pads on. Analyzing... No shock advised. Continue CPR.'); api.info('Infant arrests are usually from breathing problems - good CPR + ventilation is the fix.'); },
    posSit: (s, api) => api.info('Keep her flat on a firm surface for CPR.'),
  },
  onBVM: (s, api) => api.good('Infant BVM, 15 L/min, small puffs - just enough for chest rise.'),
  critical: s => [
    { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
    { label: 'Checked breathing + brachial pulse', why: 'Infant pulse = brachial. HR under 60 + poor perfusion = CPR.', ok: s.flags.pulseChecked },
    { label: 'Suctioned the formula (infant max 5 s)', why: 'Clear airway before ventilating.', ok: s.flags.suctioned },
    { label: 'CPR 15:2, about 1.5 in (1/3 chest)', why: 'Two-rescuer infant standard.', ok: s.flags.cprQ === 'good' },
    { label: 'BVM ventilation 15 L/min', why: 'Infant arrests are mostly respiratory - oxygen is the cure.', ok: s.flags.bvm },
    { label: 'Rescue breaths 1 every 2-3 s after pulse returned', why: 'Pulse present but apneic = ventilate, no compressions.', ok: s.flags.rescueRight },
    { label: 'Transported', why: 'Every infant arrest goes to the hospital.', ok: s.flags.transport },
  ],
},
// 6 ------------------------------------------------------------------
{
  id: 'acs', tags: ['medHx','allergy','bpNitro','spo2'], cat: 'Cardiac', title: 'Chest pain (ACS)', age: 'adult',
  dispatch: '61 y/o male, chest pain. Office building.',
  setup: s => {
    s.variant = Math.random() < 0.55 ? 'pde5' : 'ok';
    Object.assign(s.v, { hr: 98, sbp: 150, dbp: 92, rr: 20, spo2: 95, etco2: 36, avpu: 'A', bgl: 118 });
    Object.assign(s, { pose: 'sitting', skin: 'pale', sweat: true, chest: 0.75, sex: 'm', shirt: 0xffffff });
    s.flags.pain = 8;
  },
  find: {
    scene: 'Office, safe. Gloves on. Man sitting in a chair, fist on his chest, sweaty and gray.',
    opqrst: 'O: sudden, climbing stairs. P: nothing helps. Q: crushing pressure "like an elephant". R: left arm and jaw. S: 8/10. T: 30 min.',
  },
  update(s, dt, api) {
    const f = s.flags;
    if (f.crash) { Object.assign(s.target, { sbp: f.supine ? 82 : 72, dbp: 40, hr: 124 }); s.skin = 'pale'; s.v.avpu = s.v.sbp < 80 ? 'V' : 'A'; speech(s, 'Patient', 'I feel... like I\'m going to pass out...'); return; }
    Object.assign(s.target, { hr: 92 + f.pain * 1.5, sbp: 132 + f.pain * 2.2 - (f.ntg || 0) * 6, dbp: 82 + f.pain, rr: 16 + f.pain * 0.5, spo2: 95 + (f.o2 ? 2 : 0) });
    s.sweat = f.pain > 4;
    speech(s, 'Patient', f.pain >= 7 ? 'It feels like an elephant on my chest... down my left arm.' : f.pain >= 4 ? 'Still pressure, but a little better.' : 'Much better. Just a dull ache now.');
  },
  find_sample: null,
  actions: {
    sample: (s, api) => { s.flags.sample = true; api.info(s.variant === 'pde5'
      ? 'S: chest pressure, nausea. A: none. M: his own nitro 0.4 mg SL (not expired), atorvastatin, and SILDENAFIL (Viagra) - took it last night ~12 h ago. P: high cholesterol, angina. L: coffee 1 h ago. E: climbing stairs.'
      : 'S: chest pressure, nausea. A: none. M: his own nitro 0.4 mg SL (not expired), atorvastatin. Denies ED meds (Viagra/Cialis). P: high cholesterol, angina. L: coffee 1 h ago. E: climbing stairs.'); },
    asa: (s, api) => {
      if (s.flags.asa) return api.info('Aspirin already given.');
      if (!s.flags.sample) api.bad('asaAllergy', 'Gave aspirin without asking allergies.', 'Get SAMPLE (allergies, GI bleed) before aspirin.');
      api.prompt({ q: 'Aspirin dose for suspected ACS?', options: ['81 mg swallowed whole', '162-324 mg chewed', '650 mg', '1,000 mg chewed'], correct: 1, explain: '162-324 mg (2-4 baby aspirin), chewed for faster absorption.', skill: 'medDose', then: ok => { s.flags.asa = true; s.flags.asaOK = ok; api.good('Aspirin chewed.'); } });
    },
    ntg: (s, api) => {
      const f = s.flags;
      if (!f.bpChecked) api.bad('ntgNoBP', 'Nitro given without a BP.', 'Always check BP before nitro (SBP must be 100+/protocol).', true);
      if (s.variant === 'pde5') { f.crash = true; f.ntgGiven = true; return api.bad('ntgPDE5', 'BP CRASHES to the 70s - he\'s dizzy and gray.', 'Sildenafil within 24-48 h + nitro = severe hypotension. Ask about ED meds every time. Lay him flat, NRB, ALS.', true); }
      if (s.v.sbp < 100) return api.bad('ntgLowBP', 'SBP too low for nitro.', 'No nitro if SBP under 100 (some protocols 90).', true);
      if ((f.ntg || 0) >= 3) return api.info('Max 3 doses - contact medical control.');
      f.ntg = (f.ntg || 0) + 1; f.ntgGiven = true; f.pain = Math.max(2, f.pain - 3); api.good(`Assisted nitro 0.4 mg SL (dose ${f.ntg}). Pain easing. Recheck BP before the next dose (3-5 min).`);
    },
    nc: (s, api) => { s.flags.o2 = 'nc'; s.devices.add('nc'); api.info('OK. Note: AHA says O2 only if SpO2 under 94%, short of breath, or shock. His SpO2 is 95%.'); },
    nrb: (s, api) => { s.flags.o2 = 'nrb'; s.devices.add('nrb'); api.info(s.flags.crash ? 'Good - he\'s hypotensive now.' : 'Not needed at SpO2 95%. AHA: O2 only if SpO2 under 94% or distress.'); },
    posSupine: (s, api) => { s.pose = 'supine'; s.flags.supine = true; api.info(s.flags.crash ? 'Good - lying flat helps his BP.' : 'Most chest-pain patients prefer sitting up.'); },
  },
  critical: s => [
    { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
    { label: 'OPQRST', why: 'Crushing, radiating, sweaty = treat as heart attack.', ok: s.flags.opqrst },
    { label: 'SAMPLE: asked meds/allergies', why: s.variant === 'pde5' ? 'SAMPLE reveals the Viagra - that is what makes nitro deadly.' : 'Rules out allergies and ED meds before aspirin/nitro.', ok: s.flags.sample },
    { label: 'Aspirin 162-324 mg chewed', why: 'Reduces clot growth in ACS.', ok: s.flags.asaOK },
    { label: 'BP before nitro', why: 'SBP must be over 100 (or per protocol).', ok: s.flags.bpChecked && !s.flags.mistakeKeys?.has('ntgNoBP') },
    s.variant === 'pde5'
      ? { label: 'Withheld nitro (Viagra 12 h ago)', why: 'PDE5 inhibitor within 24-48 h is a nitro contraindication.', ok: !s.flags.ntgGiven }
      : { label: 'Assisted with his own nitro', why: 'SBP OK, no ED meds, his prescription: nitro 0.4 mg SL.', ok: s.flags.ntg > 0 },
    { label: 'ALS / early transport', why: 'Possible STEMI: 12-lead and a cath lab.', ok: s.flags.als || s.flags.transport },
  ],
},
// 7 ------------------------------------------------------------------
{
  id: 'anaph', tags: ['epi','lungs','spo2'], cat: 'Medical', title: 'Anaphylaxis (bee sting)', age: 'adult',
  dispatch: '19 y/o female, allergic reaction at a park.',
  setup: s => {
    Object.assign(s.v, { hr: 128, sbp: 82, dbp: 48, rr: 28, spo2: 90, etco2: 34, avpu: 'A', bgl: 100 });
    Object.assign(s, { pose: 'sitting', skin: 'flushed', sweat: false, chest: 0.5, hives: true, swelling: true, sex: 'f', shirt: 0xe9c46a, lungs: 'Wheezes everywhere + high-pitched STRIDOR on inhale.' });
    s.flags.sev = 0.6;
  },
  find: {
    scene: 'Park picnic, safe. Gloves on. Bee sting on her hand 5 min ago. Hives, swollen lips.',
    airway: 'Lips and tongue swelling; hoarse voice; stridor. Airway is at risk!',
    sample: 'S: throat tight, itchy, dizzy. A: BEE STINGS (severe). M: her own EpiPen 0.3 mg in her bag (not expired). P: anaphylaxis at age 12. L: sandwich 1 h ago. E: stung 5 min ago.',
  },
  update(s, dt, api) {
    const f = s.flags;
    if (f.epiT != null && s.t - f.epiT > 8) f.sev -= (s.t - f.epiT < 70 ? 0.011 : 0) * dt; else f.sev += 0.0045 * dt;
    f.sev = clamp(f.sev, 0.12, 1.6);
    const o2 = { nc: 2, nrb: 6, cpap: 0 }[f.o2] || (f.bvm ? 6 : 0);
    Object.assign(s.target, { hr: 92 + f.sev * 50, sbp: 122 - f.sev * 62, dbp: 76 - f.sev * 45, rr: 16 + f.sev * 18, spo2: clamp(99 - f.sev * 15 + o2, 70, 99), etco2: 36 });
    s.v.avpu = f.sev > 1.2 ? 'V' : 'A';
    s.hives = f.sev > 0.3; s.swelling = f.sev > 0.4; s.skin = f.sev > 1.1 ? 'pale' : f.sev > 0.3 ? 'flushed' : 'normal'; s.chest = clamp(1 - f.sev * 0.5, 0.3, 1);
    s.lungs = f.sev > 0.5 ? 'Wheezes everywhere + high-pitched STRIDOR on inhale.' : f.sev > 0.25 ? 'Mild wheezes, no stridor.' : 'Clear.';
    speech(s, 'Patient', s.v.avpu === 'V' ? '(barely responding, noisy breathing)' : f.sev > 0.5 ? 'My throat... it\'s closing...' : 'I can breathe again. Wow.');
    if (f.sev > 1.55) api.end('fail', 'Her airway swelled shut. Epinephrine early is THE treatment for anaphylaxis.');
  },
  actions: {
    epi: (s, api) => {
      if (s.flags.epiT != null) return api.info(s.t - s.flags.epiT < 300 ? 'Repeat epi is usually 5-15 min later, per medical control, if no improvement.' : 'Second dose given per medical control.');
      api.prompt({ q: 'Assisting with her EpiPen. How?', options: ['Outer thigh, IM (through clothes OK), hold 3 s', 'Into a vein in the arm', 'Center of the buttock', 'Under the tongue'], correct: 0, explain: 'Adult auto-injector 0.3 mg (child 0.15 mg) into the lateral thigh, hold per device (about 3 s), then massage.', skill: 'epi', then: ok => { s.flags.epiT = s.t; s.flags.epiOK = ok; api.good('Epinephrine in. Watch for improvement in 1-2 min; reassess vitals.'); } });
    },
    albuterol: (s, api) => api.info('She has no prescribed inhaler; EMTs only assist with the patient\'s own. Epi treats the wheezing too.'),
    posSupine: (s, api) => { s.pose = 'supine'; s.flags.supine = true; api.info('OK for low BP - but if breathing is hard, many prefer sitting. Either is acceptable.'); },
  },
  critical: s => [
    { label: 'Scene safety + BSI first', why: 'Every call starts here.', ok: s.flags.sceneFirst },
    { label: 'Checked airway/lungs (stridor + wheezes)', why: 'Airway swelling + hypotension = anaphylaxis.', ok: s.flags.lungs || s.flags.airwayChecked },
    { label: 'Checked BP', why: 'SBP 82 = shock: anaphylaxis, not a mild reaction.', ok: s.flags.bpChecked },
    { label: 'Epinephrine IM, outer thigh, EARLY', why: 'Epi is the only drug that reverses anaphylaxis.', ok: s.flags.epiOK && s.flags.epiT < 90 },
    { label: 'High-flow O2 (NRB)', why: 'Hypoxic, airway at risk.', ok: s.flags.o2 === 'nrb' || s.flags.bvm },
    { label: 'ALS / transport', why: 'Biphasic reaction can return; needs ED.', ok: s.flags.als || s.flags.transport },
  ],
},
// 8 ------------------------------------------------------------------
{
  id: 'bleed', tags: ['bleedFirst','spo2'], cat: 'Trauma', title: 'Trauma: severe leg bleed + shock', age: 'adult',
  dispatch: '34 y/o male, leg laceration from a saw. Construction site.',
  setup: s => {
    Object.assign(s.v, { hr: 124, sbp: 100, dbp: 68, rr: 24, spo2: 96, etco2: 32, avpu: 'A', bgl: 110 });
    Object.assign(s, { pose: 'supine', skin: 'pale', sweat: true, chest: 0.7, bleed: 0.3, sex: 'm', shirt: 0xe76f51 });
    s.flags.loss = 0.35;
  },
  find: {
    scene: 'Construction site. Saw unplugged, scene safe. Gloves + eye protection (spurting blood!). Man on the ground, holding his right thigh.',
    bleeding: 'Bright red blood SPURTING from a deep cut on the upper right thigh. Life-threatening bleeding - control it NOW.',
    sample: 'S: leg pain, dizzy, thirsty. A: none. M: none. P: none. L: breakfast. E: saw kicked back into his thigh 4 min ago.',
    opqrst: 'Leg pain 9/10, sharp, at the wound.',
  },
  update(s, dt, api) {
    const f = s.flags;
    const rate = f.tq ? 0 : f.dressing ? 0.0025 : 0.0065;
    f.loss = clamp(f.loss + rate * dt, 0, 1.6);
    s.bleed = clamp(0.25 + f.loss * 0.9, 0, 1.4);
    const sup = s.pose === 'supine' ? 0 : -6, warm = f.blanket ? 3 : 0;
    Object.assign(s.target, { hr: 96 + f.loss * 45, sbp: 128 - f.loss * 62 + sup + warm, dbp: 80 - f.loss * 40, rr: 18 + f.loss * 12, spo2: clamp(98 - f.loss * 6 + (f.o2 ? 3 : 0), 80, 99), etco2: 34 - f.loss * 8 });
    s.v.avpu = f.loss > 1.05 ? 'V' : 'A';
    s.skin = f.loss > 0.3 ? 'pale' : 'normal'; s.sweat = f.loss > 0.4;
    speech(s, 'Patient', s.v.avpu === 'V' ? '(confused) ...so cold...' : f.tq ? (f.loss > 0.6 ? 'I feel weak... and cold.' : 'Ow! That\'s tight... but it stopped.') : 'My leg! There\'s so much blood!');
    if (f.loss > 1.5) api.end('fail', 'He bled out into shock. Life-threatening bleeding comes first - tourniquet in seconds.');
  },
  actions: {
    tourniquet: (s, api) => {
      if (s.flags.tq) return api.info('Tourniquet on and holding. Time is written down.');
      api.prompt({ q: 'Where does the tourniquet go?', options: ['2-3 in above the wound (not on a joint), tighten until bleeding stops, note the time', 'Directly on the wound', 'Below the wound', 'Over the knee joint'], correct: 0, explain: 'High and tight: 2-3 inches above the wound, never over a joint, tighten until bleeding stops and distal pulse is gone, write the time.', skill: 'bleedFirst', then: ok => { s.flags.tq = true; s.flags.tqT = s.t; s.flags.tqOK = ok; s.devices.add('tq'); if (!ok) api.bad('tqPlace', 'Repositioned 2-3 in above the wound.', 'Tourniquet goes proximal, 2-3 in above the wound, not over a joint.'); else api.good('Bleeding STOPPED. Time noted.'); } });
    },
    dressing: (s, api) => { s.flags.dressing = true; s.devices.add('dressing'); api.info(s.flags.tq ? 'Wound dressed. Good.' : 'Direct pressure slows it, but spurting arterial blood soaks through. This needs a tourniquet.'); },
    collar: (s, api) => { s.devices.add('collar'); api.bad('collarDelay', 'Collar wasn\'t needed - he wasn\'t hit in the head or neck, and it cost time.', 'No spinal mechanism here; in uncontrolled bleeding, don\'t delay hemorrhage control.'); },
    posSit: (s, api) => { s.pose = 'sitting'; api.bad('sitShock', 'He gets dizzier sitting up.', 'Shock patients stay supine.'); },
    posSupine: (s, api) => { s.pose = 'supine'; api.info('Supine - good for shock.'); },
    blanket: (s, api) => { s.devices.add('blanket'); s.flags.blanket = true; api.good('Blanket on - preventing hypothermia (it worsens bleeding).'); },
  },
  critical: s => [
    { label: 'Scene safety + BSI (eye protection)', why: 'Spurting blood = splash risk.', ok: s.flags.sceneFirst },
    { label: 'Tourniquet within ~45 s', why: 'Life-threatening bleeding is controlled even before airway (X-ABC).', ok: s.flags.tq && s.flags.tqT < 45 + (s.flags.firstT || 0) },
    { label: 'Tourniquet placed correctly', why: '2-3 in above wound, not on a joint, tight until it stops, time noted.', ok: s.flags.tqOK },
    { label: 'High-flow O2 (NRB)', why: 'Shock = poor oxygen delivery.', ok: s.flags.o2 === 'nrb' },
    { label: 'Kept him warm (blanket)', why: 'Hypothermia worsens bleeding (lethal triad).', ok: s.flags.blanket },
    { label: 'Rapid transport', why: 'Shock needs a surgeon; don\'t stay and play.', ok: s.flags.transport },
  ],
},
];

// shared adult CPR prompt (used by arrest scenario)
export function GENERIC_CPR_PROMPT(s, api) {
  api.prompt({ q: 'Adult CPR, you\'re on compressions. Which combo?', options: ['30:2, 2-2.4 in deep, 100-120/min, full recoil', '15:2, about 1.5 in, 100-120/min', '30:2, about 1 in, 80/min', '15:2, 2-2.4 in, 140/min'], correct: 0, explain: 'Adult: 30:2, at least 2 in but not more than 2.4 in, 100-120/min, let the chest fully recoil, pauses under 10 s.', skill: 'cpr', then: ok => {
    s.flags.cprQ = ok ? 'good' : 'poor'; s.cpr = true; if (!ok) api.bad('cprCombo', 'Partner coaches you: 30:2, 2-2.4 in, 100-120/min.', 'Adult CPR: 30:2, 2-2.4 in, 100-120/min.'); else api.good('High-quality compressions going.'); } });
}
