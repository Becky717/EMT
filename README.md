# EMT Sim VR

A WebXR EMT patient-simulation game for Meta Quest 2 (Quest Browser). It also works as a normal web page on a phone or computer.

- Open the page in Quest Browser and tap **ENTER VR**. Point the controller laser and pull the trigger to choose.
- 8 NREMT-level patients: asthma, CHF (CPAP decision), opioid overdose, adult arrest with AED, infant arrest with 2 rescuers, ACS chest pain, anaphylaxis, and a severe bleed with shock.
- Equipment and meds sit on a red crash cart as real-looking 3D models (NPA, OPA, BVM, NRB, AED, tourniquet, EpiPen, and more), each with its name underneath. Point at the item (or its label) to use it.
- The patient shows signs you can see: skin color (pale, cyanotic, flushed, mottled), sweat, breathing rate and depth, eyes open or closed by responsiveness, tripod position, hives, lip swelling, vomit, a bleeding wound, and every device you apply.

Files:
- `rules.js`: all of the medical and physiology rules (AHA 2020 guidelines plus later focused updates, EMT scope). Local protocols vary.
- `models.js`: the procedural 3D equipment models (three.js primitives, no downloads).
- `game.js`: the scene, patient model, panels, VR input, and 2D fallback.

For study use only, not medical advice.
