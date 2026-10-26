# EMT Sim VR

A WebXR EMT patient-simulation game for Meta Quest 2 (Quest Browser). It also works as a normal web page on a phone or computer.

Renaissance engineering lab: https://becky717.github.io/EMT/lab/

- Open the page in Quest Browser and tap **ENTER VR**. Point the controller laser and pull the trigger to choose.
- 8 NREMT-level patients: asthma, CHF (CPAP decision), opioid overdose, adult arrest with AED, infant arrest with 2 rescuers, ACS chest pain, anaphylaxis, and a severe bleed with shock. Plus 13 adaptive weak-spot case templates (see below).
- Equipment and meds sit on a red crash cart as real-looking 3D models (NPA, OPA, BVM, NRB, AED, tourniquet, EpiPen, and more), each with its name underneath. Point at the item (or its label) to use it.
- The patient shows signs you can see: skin color (pale, cyanotic, flushed, mottled), sweat, breathing rate and depth, eyes open or closed by responsiveness, tripod position, hives, lip swelling, vomit, a bleeding wound, and every device you apply.

## Adaptive learning (🎯 Weak spots)

The game remembers what you miss and builds new cases around it.

- **Tracks misses** (saved on this device in `localStorage`, so it carries across sessions): skipped key checks (scene safety/BSI, BP before CPAP or nitro, SpO2, lung sounds, glucose, SAMPLE allergies/meds, gag reflex before an OPA, pulse check, bleeding control, reassessment), harmful choices, wrong A-D answers, and slow critical actions (tourniquet, AED, epi, BVM).
- **Weights:** each skill's weight goes up when you miss it and shrinks when you get it right (spaced-repetition style). Skills you haven't seen in a while slowly come back.
- **Miss-Spotlight cases:** tap **🎯 Weak spots** on the menu (or **🎯 Weak-spot case** on the debrief). It picks your top weak spot and generates a new case where skipping that exact detail causes a major problem on the patient and monitor. Setting, age, sex, and story change every time. Miss the trap and the next case re-tests it in a new setting; beat it and you move to the next weak spot.
- **Debrief:** shows the trap, what you missed and why it matters, and "Next case will test: ...".
- **📊 My weak spots:** your top weak spots as short bars, plus days until the NREMT.
- It starts with one known weak spot seeded: **BP before CPAP** (SBP under 90 = no CPAP). **Reset progress** on the weak-spots screen clears everything.

| Miss | Case it builds (randomized) | What goes wrong if you skip it |
|---|---|---|
| Scene safety + BSI | CO in a garage / ice-fishing shack / generator basement | Crew gets CO poisoning; pulse ox reads a falsely normal 98% |
| BP before CPAP | "CHF" on a fishing boat / church / assisted living, SBP 76-86 (cardiogenic shock) | CPAP crashes the BP |
| PDE5/ED meds before nitro | Chest pain with tadalafil for the prostate / sildenafil (Revatio) for lung pressure / vardenafil | Nitro drops BP into the 60s |
| Allergies before meds | Chest pain at bowling / shoveling snow / rest stop, allergic to aspirin | Aspirin causes anaphylaxis (needs epi) |
| BP before every nitro / reassess | Chest pain + vomiting / hot barn / pharmacy (dry, likely inferior MI) | BP falls to ~90 after dose 1; repeat dose without a new BP = collapse |
| Gag reflex before OPA / suction | Postictal at a festival / laundromat, drunk at a wedding | OPA causes vomiting and aspiration |
| Glucose on altered patients | "Drunk" at a bar / "stroke" at home / combative teen athlete | Gets drowsier, then seizes; oral glucose no longer allowed |
| SpO2 early | "Panic attack" after a flight (PE) / "just tired" at a nursing home / rehab after surgery | Silent hypoxia leads to confusion, then arrest |
| Lung sounds | "COPD flare" / tall thin teen / smoker: one-sided absent breath sounds | CPAP or forced BVM causes a tension pneumothorax |
| Pulse + breathing check / CPR + AED | "Seizure" on a soccer field / spin class / baseball to the chest | Treated as a seizure, so no CPR; VF turns into asystole |
| Find + stop big bleeding first | Glass table / chainsaw / hockey skate, loud distracting complaint, bleed hidden under dark clothes | Bleeds out without a rapid scan |
| BVM for inadequate breathing / ventilation rate | Sleeping pills + wine / toddler + grandpa's clonidine / Xanax + vodka | NRB and naloxone don't fix it; hypoxic arrest without BVM |
| Early epi | Peanut "asthma" in a child (EpiPen Jr 0.15 mg) / restaurant "panic attack" / hornet sting, all with no hives | Anaphylactic shock closes the airway |

## Files
- `rules.js`: all of the medical and physiology rules (AHA 2020 guidelines plus later focused updates, EMT scope). Local protocols vary.
- `models.js`: the procedural 3D equipment models (three.js primitives, no downloads).
- `adaptive.js`: adaptive learning: miss tracking, weights, and the 13 Miss-Spotlight case templates.
- `game.js`: the scene, patient model, panels, VR input, and 2D fallback.

For study use only, not medical advice.
