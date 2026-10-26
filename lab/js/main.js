// Boot: load art, start the game loop, wire mouse/touch/keyboard, and offer VR / 3D workshop.
import { Game } from './ui.js';
import { PUZZLES } from './puzzles.js';
import { DT } from './sim.js';
const $ = id => document.getElementById(id);
const boardC = $('board'), panelC = $('panel');
const credits = await fetch('./assets/credits.json').then(r => r.json()).catch(() => []);
const images = {};
await Promise.all(credits.map(c => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = `./assets/img/${c.key}.jpg`; images[c.key] = im; })));
try { await Promise.race([document.fonts.load('30px "IM Fell English"'), new Promise(r => setTimeout(r, 2500))]); } catch { }
const game = new Game(boardC, panelC, { images, credits, onEvent: e => window.__renEvents?.push(e) });
window.__renEvents = [];
$('loading').remove();

function fit() {
  const W = innerWidth - 16, H = innerHeight - 16, s = Math.min(W / 1600, H / 1000);
  boardC.style.width = 1168 * s + 'px'; boardC.style.height = 1000 * s + 'px'; panelC.style.width = 432 * s + 'px'; panelC.style.height = 1000 * s + 'px';
}
addEventListener('resize', fit); fit();
function hit(e) {
  for (const [name, c, W, H] of [['board', boardC, 1168, 1000], ['panel', panelC, 432, 1000]]) {
    const r = c.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return [name, (e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
  }
  return null;
}
let mode = '2d';
addEventListener('pointerdown', e => { if (mode !== '2d') return; const h = hit(e); if (h) { e.preventDefault(); game.pointer('down', ...h); } });
addEventListener('pointermove', e => { if (mode !== '2d') return; const h = hit(e); if (h) game.pointer('move', ...h); });
addEventListener('pointerup', e => { if (mode !== '2d') return; const h = hit(e) || [game.drag?.target || 'board', -1, -1]; game.pointer('up', ...h); });
addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Backspace') e.preventDefault(); game.key(e.key); });

let last = performance.now(), lastDraw = 0;
export function frame(now, force) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  game.update(dt);
  const minGap = mode === 'vr' ? (game.running || game.drag ? 1000 / 36 : 1000 / 15) : 1000 / 60;
  if (force || ((game.dirty || game.screen === 'puzzle') && now - lastDraw >= minGap - 1)) { game.draw(); lastDraw = now; game.drawCount = (game.drawCount || 0) + 1; return true; }
  return false;
}
function loop(now) { if (mode === '2d') frame(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

// ---- VR & 3D workshop ----
let vrMod = null;
async function vr() { if (!vrMod) vrMod = await import('./vr.js'); return vrMod; }
if (navigator.xr?.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (ok) $('btn-vr').hidden = false; }).catch(() => { });
$('btn-vr').onclick = async () => {
  let session;
  try { session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); } catch (e) { game.toast('Could not start VR: ' + e.message); return; }
  const m = await vr(); mode = 'vr'; game.vrCursor = true; document.body.classList.add('in3d');
  await m.startXR(game, session, { frame, images, credits, onEnd: () => { mode = '2d'; game.vrCursor = false; document.body.classList.remove('in3d'); game.dirty = true; } });
};
$('btn-3d').onclick = async () => { const m = await vr(); mode = '3d'; game.vrCursor = true; document.body.classList.add('in3d'); $('btn-3d').hidden = true; $('btn-2d').hidden = false; await m.startPreview(game, { frame, images, credits, el: $('view3d') }); };
$('btn-2d').onclick = async () => { const m = await vr(); m.stopPreview(); mode = '2d'; game.vrCursor = false; document.body.classList.remove('in3d'); $('btn-3d').hidden = false; $('btn-2d').hidden = true; game.dirty = true; fit(); };

// ---- test hooks ----
window.__ren = {
  game, PUZZLES, DT,
  list: () => PUZZLES.map(p => ({ id: p.id, ch: p.ch, title: p.title })),
  load: (id, tier) => { game.loadPuzzle(id, { tier }); game.overlay = null; game.draw(); return game.v; },
  solve: () => { const q = game.v.q; game.placeAll(); if (q.kind === 'gear') { game.answer = q.ans; game.placed.add('g' + q.ans); game.rebuild(); } else game.setAnswer(q.ans); game.placeAll(); return q.ans; },
  answer: a => { game.placeAll(); if (game.v.q.kind === 'gear') { game.answer = a; for (const c of game.v.q.choices) game.placed.delete('g' + c); game.placed.add('g' + a); game.rebuild(); } else game.setAnswer(a); game.placeAll(); },
  run: () => { const r = game.runToEnd(); game.draw(); return r; },
  state: () => JSON.parse(localStorage.getItem('renlab.v1') || 'null'),
  draw: () => game.draw(),
  mode: () => mode,
  vr: () => vrMod,
};
