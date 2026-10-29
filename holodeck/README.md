# Grid Chamber

Holodeck-inspired WebXR room for Meta Quest 2 (Quest Browser) with a 2D desktop/phone fallback.

**Live path (when published):** `https://becky717.github.io/EMT/holodeck/`  
**Sibling programs:** [EMT Patient Simulator](../) · [Renaissance Workshop](../lab/)

Original sci-fi styling. No Paramount / Star Trek logos, sounds, names, or assets.

## Controls

| Where | What |
|--------|------|
| Quest | Tap **ENTER VR**. Point the Touch laser, pull trigger to press arch buttons or teleport. |
| Left stick | Smooth move |
| Right stick | Snap turn |
| Trigger (at floor) | Teleport marker + confirm with stick button / select |
| Desktop | Drag to look · **WASD** move · click arch buttons · type commands |
| Seated | Toggle on the arch panel (lowers the panel) |
| Tab / \` | Focus the command box |

**VR note:** Launching EMT or the Renaissance lab ends the WebXR session and opens that page. Tap **ENTER VR** again there — browsers cannot keep one VR session across page loads.

## Computer commands

Type in the box, tap a preset, or use 🎤 when SpeechRecognition is available (Quest support varies — typing always works with the Quest keyboard).

### Worlds
`beach` · `forest` · `desert` · `snow` / `arctic` · `mountains` · `ocean` · `underwater` · `space` / `starfield` · `planet` · `city` · `meadow` · `cave` · `lake` · `canyon`

### Time
`dawn` · `noon` / `day` · `sunset` / `dusk` · `night`

### Weather
`clear` · `rain` · `snow` · `fog` · `storm` · `aurora`

### Examples
- `Computer, create a beach at sunset`
- `forest at night with fireflies`
- `snow storm`
- `make it night`
- `add rain` / `add a campfire` / `add a boat`
- `remove the boat`
- `freeze program` / `unfreeze`
- `save program as beach1` / `load program beach1`
- `end program` · `arch`

Unknown phrases get a short **Unable to comply** reply with suggestions.

Saves are stored in `localStorage` on this device/browser only.

## Performance (Quest 2 target)

- Pixel ratio capped · foveation on · no realtime shadows  
- Instanced trees/buildings · particle caps  
- Aim: under ~100 draw calls per scene  

If it stutters, say so — soft effects can be trimmed further.

## Files

```
index.html
js/main.js      boot, XR, locomotion, command wiring
js/hub.js       grid room + arch panel
js/worlds.js    procedural environments
js/parser.js    local command parser (no API keys)
js/computer.js  typed/voice UI + saves
js/audio.js     original WebAudio chirps
test/           headless Playwright checks
shots/          screenshots
```

## Local test

```bash
cd /workspace/holodeck
python3 -m http.server 8788 --bind 127.0.0.1
cd test && node run.mjs
```

## Credits

Built for Rebecca’s Quest 2 practice suite. three.js (MIT). Map/program links are relative so the game can sit under the EMT Pages site.
