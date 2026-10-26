# Bottega dei Meccanismi: a Renaissance Engineering Lab

An *Incredible Machine*-style physics puzzle workshop in the notebooks of Archimedes, Leonardo, Galileo, Stevin, Torricelli and friends.
Each puzzle is a working contraption: water tanks, levers, pulleys, gears, ramps, pendulums, balloons and crossbows. You pick a number (a counterweight, gear size, angle, or amount of fuel), place the parts, press **Start**, and the real 2D physics shows whether your maths was right.

Concepts build from **water displacement → ratios → algebra → moments & work → gear trains → trigonometry & square roots → gas laws & chemistry (stoichiometry) → calculus (rates, related rates, optimisation)**.

Runs in any modern browser (desktop, tablet, phone in landscape) and in **WebXR on Meta Quest 2/3** (Quest Browser) as a 3D Renaissance workshop. It's a static site with no build step.

## Play

* **Hosted:** open the GitHub Pages URL.
* **Locally:** `python3 -m http.server 8000` in this folder, then open <http://localhost:8000>. A `file://` URL won't work because ES modules need a server.

### How a puzzle works
1. Read the **goal** and the **Given** lines on the lectern (right panel). The mentor's quote frames the idea.
2. Set your answer with the **– / +** dial or by typing digits. Some puzzles want you to drag parts from the **parts bin** onto the glowing sockets first (the Start button tells you what's missing), and a few want a part rotated with its round handle.
3. Press **Start ▶**. The machine runs on real physics (planck.js / Box2D plus a custom Archimedes buoyancy model). Win and the page is sealed into your Codex.
4. **↺** resets the board. **?** gives a hint; each press gives a stronger one (up to 3). Three misses in a row bring up a worked solution.

### Controls
| | Desktop / touch | Quest (WebXR) |
|---|---|---|
| Press buttons, place parts | click / tap, drag | point laser + trigger, hold trigger to drag |
| Answer | dial buttons, or type digits + **Enter** | dial buttons on the lectern |
| Shortcuts | **Enter** = Start (or confirm typed number), **R** = reset, **H** = hint, **Esc** = clear typing, **Backspace** | n/a |
| Enter 3D | **🏛 3D Workshop** (mouse-look preview) | **ENTER VR** button (appears only when WebXR is available) |

In VR you stand in a workshop. The puzzle board is on an easel in front of you and the lectern (controls) sits at your right hand, surrounded by framed public-domain drawings, a pendulum clock, an Archimedes screw, gears, a Montgolfier balloon and a candle chandelier. **Seated mode** (title screen) lowers everything for chair play.

## Chapters & puzzles (22 handcrafted, 4 tiers each)
| Book | Puzzles | Maths & science |
|---|---|---|
| I. Liber Aquae: Water | Eureka! The Crown · Float the Barge · The Diving Bell | displacement, density, Archimedes' principle, solving for x |
| II. Liber Vectis: Levers | Balance the Scales · Give Me a Place to Stand · Leonardo's Steelyard | ratios, moments (F·d), linear equations |
| III. Liber Trochleae: Pulleys | The Well Bucket · Brunelleschi's Hoist · Taccola's Crane: Work | mechanical advantage, work = F·d, energy conservation |
| IV. Liber Rotarum: Gears | The Mill Wheel · Leonardo's Windlass · The Clockwork Train | gear ratios, compound trains, torque |
| V. Liber Galilaei | Stevin's Inclined Plane · Galileo's Pendulum Clock · Galileo's Table (f.116v) | sin θ, T = 2π√(L/g), projectile time-of-flight |
| VI. Liber Aeris: Gases | The Montgolfier Lantern · Descartes' Diver · Charles's Hydrogen Globe | Kelvin, ideal gas law, Boyle's law, moles & stoichiometry (Fe/Al + acid → H₂) |
| VII. Liber Fluxionum: Calculus | The Leaning Tower · Torricelli's Fountain · The Cistern Clock · Leonardo's Great Crossbow | kinematics, v = √(2gh), optimisation (max range), integrating rates, quadratics |

**Tiers:** Apprentice → Journeyman → Master → Maestro. Each tier is a freshly randomised, more demanding variant (new numbers, extra unknowns, or a harder concept). The physics engine checks every variant.

## Adaptive tutor
* A **fast, unaided win** (no hints, under 2 minutes) promotes that puzzle to the next tier, so you never redo what you've mastered.
* **Two misses in a row** drop to an easier variant of the same idea. **Three** show a worked solution.
* Each puzzle **diagnoses common mistakes** (inverted ratio, forgot Kelvin, used diameter for radius, and so on) and tells you which one you made.
* Skills such as *ratio, algebra, density, moments, trig, gas law, stoichiometry, calculus* are tracked. The **Codex** (progress map) shows sealed pages, your tier on each, weak spots, and a recommended next page.
* Pages unlock in order: seal a page to open the next one. *Free roam* on the title screen opens everything.
* Progress is stored in `localStorage` (`renlab.v1`). *Reset progress* is in the Codex.

The **Gallery** shows all 28 drawings with captions and credits.

## Files
```
index.html         page shell, importmap (three.js from jsDelivr CDN), font
js/main.js         boot, render loop, 2D ↔ 3D switching, window.__ren test API
js/ui.js           game screens, lectern panel, parts bin, drag/rotate, sounds
js/render.js       ink-and-parchment renderer, gears, decorations
js/sim.js          planck.js wrapper + Archimedes fluid model (polygon clipping, buoyancy, drag)
js/puzzles_a.js    chapters I–III      js/puzzles_b.js  chapters IV–VII
js/puzzles.js      puzzle registry
js/adaptive.js     skills, chapters, adaptive Tutor (tiers, diagnosis, recommendation)
js/vr.js           3D workshop (three.js) + WebXR session, laser pointers, haptics
lib/planck.mjs     planck.js 1.4.2 (MIT), vendored
assets/img/        28 public-domain drawings (~3 MB)    assets/credits.json + CREDITS.md
test/              Node + Playwright tests, asset fetch scripts
shots/             screenshots from the browser test
```

## Tests
```
cd test && npm install            # playwright (for browser tests)
node physics.mjs                  # every puzzle × 4 tiers × 4 seeds in headless physics
node texts.mjs                    # all generated text checked for float noise/NaN
# browser test: serve the folder on port 8777 first
(cd .. && python3 -m http.server 8777 &) ; node browser.mjs
```
`physics.mjs` checks that the correct answer (and any equivalent alternative) wins, wrong answers fail, and answers stay within the dial range.
`browser.mjs` plays every puzzle through the UI, does a real mouse/keyboard play-through, checks adaptive behaviour and persistence, renders the 3D room (draw-call budget, raycast clicks) and the phone layout, and saves screenshots to `shots/`.

## Hosting on GitHub Pages
Push the folder (minus `test/node_modules`, already in `.gitignore`) to a repo, then go to *Settings → Pages → Deploy from branch → main / root*. WebXR needs HTTPS, which Pages provides. On Quest, open the URL in Quest Browser and press **ENTER VR**.

## Performance notes (Quest 2)
Lambert materials, no shadows, instanced beams and candles, under 100 draw calls, foveation on. In VR the two canvases are re-uploaded only when they change (≤36 Hz while running, 15 Hz idle) and physics runs at a fixed 60 Hz.

Credits: see [CREDITS.md](CREDITS.md).
