# Bottega dei Meccanismi — Renaissance Engineering Lab

An *Incredible Machine*-style physics puzzle workshop in the notebooks of Archimedes, Leonardo, Galileo, Stevin, Torricelli and friends.

**Default mode is widgets only.** Each puzzle is a working contraption: water tanks, levers, pulleys, gears, ramps, pendulums, balloons and crossbows. You drag parts from the bin, slide them on rails, turn handles, press **Start**, and the real 2D physics shows whether your machine works. No number dials, typed answers, or formulas in the default experience.

Math can be layered back in later (see **Progressive math layer** below). Hidden for now behind `?math=N`.

Runs in any modern browser and in **WebXR on Meta Quest 2/3** (Quest Browser) as a 3D Renaissance workshop. Static site, no build step.

## Play

* **Hosted:** open the GitHub Pages URL (`…/EMT/lab/`).
* **Locally:** `python3 -m http.server 8000` in this folder, then open <http://localhost:8000>.

### How a puzzle works
1. Read the **goal** on the lectern. The mentor's quote frames the machine.
2. Drag parts from the **parts bin** onto glowing sockets, slide along rails, or turn an aim handle. Some puzzles offer several weights/gears — pick one and tinker.
3. Press **Start ▶**. Win when the machine achieves the goal (hover, balance, catch, fill…).
4. **↺** resets. **?** gives a plain-language hint; stronger hints add a **green ghost outline** of a working placement.

### Controls
| | Desktop / touch | Quest (WebXR) |
|---|---|---|
| Place parts | click / tap, drag | point laser + trigger |
| Shortcuts | **Enter** = Start, **R** = reset, **H** = hint | n/a |
| Enter 3D | **3D Workshop** | **ENTER VR** |

**Seated mode** (title screen) lowers the VR workshop for chair play.

## Chapters & puzzles (22 machines)

| Book | Machines | What you build |
|---|---|---|
| I. Liber Aquae | Eureka! The Crown · Float the Barge · The Diving Bell | cistern mark, cargo crates, ballast |
| II. Liber Vectis | Balance the Scales · Give Me a Place to Stand · Leonardo's Steelyard | sliding weights, counterweights |
| III. Liber Trochleae | The Well Bucket · Brunelleschi's Hoist · Taccola's Crane | pulley counterweights, floor stops |
| IV. Liber Rotarum | The Mill Wheel · Leonardo's Windlass · The Clockwork Train | gears, effort weights |
| V. Liber Galilaei | Stevin's Inclined Plane · Galileo's Pendulum · Galileo's Table | hang weights, bob rail, landing bucket |
| VI. Liber Aeris | Montgolfier Lantern · Descartes' Diver · Charles's Hydrogen Globe | payload / burner, squeeze stops, metal scoops |
| VII. Liber Fluxionum | Leaning Tower · Torricelli's Fountain · Cistern Clock · Great Crossbow | cart rail, pail/drill, sand-timers, aim handle |

**Tiers:** Apprentice → Journeyman → Master → Maestro. Faster unaided wins unlock harder machines (more awkward numbers under the hood, tighter windows). Struggles step down and eventually show a ghost placement.

## Adaptive tutor (tinkering)
* Fast unaided win → harder tier.
* Two misses → easier variant. Three → ghost outline of a working spot.
* Codex tracks sealed machines, stars, weak spots (placement, levers, pulleys…).
* Progress: `localStorage` key **`renlab.v2`** (bumped so old math-dial progress does not break this build).

## Progressive math layer (plan — default OFF)

Setting: `mathLevel` 0–5, default **0**. No player UI yet. Dev only: append `?math=N` to the URL.

| Level | What appears |
|---|---|
| **0** (default) | Pure widgets. No dials, formulas, equation hints, or worksheet "Given" sheets. |
| **1** | After a win, optional one-line observation (*"the longer side lifted the heavier weight"*). |
| **2** | Before Start, optional predict-before-run multiple choice (*which side goes up?*). |
| **3** | Picture-friendly ratio / data sheet on the lectern (`mathGiven`). |
| **4** | Numbers and simple dials return; algebra-style hints allowed. |
| **5** | Full classic math: formulas on the concept card, Kelvin, stoichiometry, calculus worked solutions. |

**Rollout idea:** keep players on 0 until the Quest feel is solid; then enable 1 for a week of play, then 2, etc. Each puzzle already stores `concept.formula`, `mathHints`, `mathGiven`, `observe()`, `predict()`, and `diagnose()` for the higher levels.

## Files
```
index.html         shell + three.js importmap
js/main.js         boot, VR wiring, window.__ren test API
js/ui.js           screens, parts bin, drag/ghost hints
js/render.js       ink-and-parchment board
js/sim.js          planck.js + Archimedes buoyancy
js/puzzles_a.js    chapters I–III
js/puzzles_b.js    chapters IV–VII
js/puzzles.js      registry
js/adaptive.js     tutor (renlab.v2)
js/mathlayer.js    mathLevel helpers + progressive gates
js/vr.js           3D workshop + WebXR
lib/planck.mjs     vendored physics
assets/            drawings + credits
test/              physics / texts / browser
shots/             screenshots (w_*.png = widget pass)
```

## Tests
```
cd test && npm install
node physics.mjs                  # every puzzle × 4 tiers × 4 seeds
node texts.mjs                    # no formula glyphs in default copy
(cd .. && python3 -m http.server 8777 &) ; node browser.mjs
```

## Hosting
Publish the `lab/` folder with the parent EMT Pages site (or any static host). WebXR needs HTTPS.

## Performance (Quest 2)
Lambert materials, no shadows, ≤100 draw calls, canvas re-upload capped in VR. Soft lighting can be cut if frames drop.

Credits: see [CREDITS.md](CREDITS.md).
