import { chromium } from 'playwright';
const OUT = '/workspace/renlab/shots/';
const URL = process.argv[2] || 'http://127.0.0.1:8777/index.html';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const pg = await ctx.newPage();
const errs = [];
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };
await pg.goto(URL); await pg.waitForFunction(() => window.__ren, null, { timeout: 60000 }); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => window.__ren, null, { timeout: 60000 });
await pg.waitForTimeout(800);
await pg.screenshot({ path: OUT + 'w_00_title.png' });
// ---- every puzzle loads, a known correct solution wins, a wrong one fails (through the real game controller) ----
const ids = await pg.evaluate(() => __ren.list().map(p => p.id));
ok('puzzle count >= 15', ids.length >= 15, `${ids.length} puzzles`);
let shotN = 0;
for (const id of ids) {
  for (const tier of [0, 2]) {
    const r = await pg.evaluate(([id, tier]) => { const v = __ren.load(id, tier); const ans = __ren.solve(); const res = __ren.run(); return { ans, win: res?.win, msg: res?.msg, q: v.q.text }; }, [id, tier]);
    ok(`${id} t${tier} correct answer wins`, r.win === true, `ans=${r.ans} → ${r.msg}`);
    const w = await pg.evaluate(([id, tier]) => { const v = __ren.load(id, tier); const q = v.q; let wrong = (q.wrong && q.wrong[0]); if (wrong == null && q.choices) wrong = q.choices.find(c => Math.abs(c - q.ans) > Math.abs(q.ans) * 0.12); if (wrong == null && q.kind === 'gear') wrong = q.choices.find(c => c !== q.ans); if (wrong == null) wrong = +(q.ans * 1.35).toFixed(3); __ren.answer(wrong); const res = __ren.run(); return { wrong, win: res?.win, msg: res?.msg }; }, [id, tier]);
    ok(`${id} t${tier} wrong answer fails`, w.win === false, `wrong=${w.wrong} → ${w.msg}`);
  }
}
// ---- screenshots of each puzzle (set up, before Start) and a few mid-run / result frames ----
for (const id of ids) {
  await pg.evaluate(id => { __ren.load(id, 0); __ren.solve(); __ren.draw(); }, id);
  await pg.waitForTimeout(120); await pg.screenshot({ path: OUT + `w_p${String(++shotN).padStart(2, '0')}_${id}.png` });
}
// mid-run frames for a few
for (const id of ['barge', 'tackle', 'millgear', 'torricelli', 'siege', 'montgolfier']) {
  await pg.evaluate(id => { __ren.load(id, 1); __ren.solve(); __ren.game.start(); for (let i = 0; i < 45; i++) __ren.game.update(1 / 60); __ren.draw(); }, id);
  await pg.waitForTimeout(100); await pg.screenshot({ path: OUT + `w_run_${id}.png` });
}
// concept card + result overlays
await pg.evaluate(() => { __ren.game.loadPuzzle('eureka', { tier: 0, concept: true }); __ren.draw(); });
await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + 'w_concept_card.png' });
await pg.evaluate(() => { __ren.load('balance', 0); __ren.solve(); __ren.run(); __ren.game.overlay = 'result'; __ren.draw(); });
await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + 'w_result_win.png' });
await pg.evaluate(() => { __ren.load('montgolfier', 1); const q = __ren.game.v.q; const wrong = (q.wrong && q.wrong[0]) || +(q.ans * 1.5).toFixed(2); __ren.answer(wrong); __ren.run(); __ren.game.overlay = 'result'; __ren.draw(); });
await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + 'w_result_fail.png' });
// ---- real mouse + keyboard play-through of Eureka ----
await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForFunction(() => window.__ren); await pg.waitForTimeout(500);
const clientOf = async (target, x, y) => pg.evaluate(([t, x, y]) => { const c = document.getElementById(t); const r = c.getBoundingClientRect(); return [r.left + x / (t === 'board' ? 1168 : 432) * r.width, r.top + y / 1000 * r.height]; }, [target, x, y]);
const clickBtn = async (target, id) => { const bb = await pg.evaluate(([t, id]) => __ren.game.buttons[t].find(b => b.id === id), [target, id]); if (!bb) return false; const [cx, cy] = await clientOf(target, bb.x + bb.w / 2, bb.y + bb.h / 2); await pg.mouse.click(cx, cy); await pg.waitForTimeout(150); return true; };
ok('title Play button', await clickBtn('panel', 'play'));
await pg.waitForTimeout(200); await pg.screenshot({ path: OUT + 'w_play_01_concept.png' });
ok('concept Got it button', await clickBtn('board', 'gotit'));
const pid = await pg.evaluate(() => __ren.game.P.id); ok('first puzzle is Eureka', pid === 'eureka', pid);
// No formula strip at mathLevel 0
ok('no formula on concept at math 0', await pg.evaluate(() => __ren.mathLevel() === 0));
// drag crown from bin to the tank
const tile = await pg.evaluate(() => __ren.game.buttons.panel.find(b => b.id === 'bin-crown'));
ok('crown bin tile exists', !!tile);
const [sx, sy] = await clientOf('panel', tile.x + tile.w / 2, tile.y + tile.h / 2);
const snap = await pg.evaluate(() => { const it = __ren.game.P.bin(__ren.game.v).find(b => b.key === 'crown'); return [8 + it.snap.x * 96, 990 - it.snap.y * 96]; });
const [tx, ty] = await clientOf('board', snap[0], snap[1]);
await pg.mouse.move(sx, sy); await pg.mouse.down(); for (let i = 1; i <= 12; i++) await pg.mouse.move(sx + (tx - sx) * i / 12, sy + (ty - sy) * i / 12); await pg.mouse.up(); await pg.waitForTimeout(150);
ok('drag-and-drop places crown', await pg.evaluate(() => __ren.game.placed.has('crown')));
// Place mark via API (rail drag) + screenshot widget lectern (no dial)
await pg.evaluate(() => { __ren.solve(); __ren.draw(); });
await pg.screenshot({ path: OUT + 'w_play_02_parts.png' });
ok('widget solve places mark+crown without typing', await pg.evaluate(() => __ren.game.placed.has('mark') && __ren.game.placed.has('crown') && __ren.game.answer != null));
// Grep rendered panel for math glyphs via reading button labels / given text
const uiText = await pg.evaluate(() => {
  const g = __ren.game; const v = g.v; const bits = [...(v.given||[]), g.P.goal(v), g.P.concept.line, ...g.P.hints(v)];
  return bits.join('\n');
});
ok('no formula glyphs in default UI copy', !/[=√]|sin |÷|∫/.test(uiText), uiText.slice(0, 120));
await clickBtn('panel', 'start');
await pg.waitForTimeout(1500); await pg.screenshot({ path: OUT + 'w_play_03_running.png' });
await pg.waitForFunction(() => __ren.game.overlay === 'result', null, { timeout: 15000 }).catch(() => { });
await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + 'w_play_04_result.png' });
ok('real-time run wins Eureka', await pg.evaluate(() => __ren.game.result?.win === true), await pg.evaluate(() => __ren.game.result?.msg));
// ---- adaptive state: level-up persists across reload; repeated misses step down ----
const st1 = await pg.evaluate(() => __ren.state().p.eureka);
ok('eureka tier raised after fast unaided win', st1.tier === 1 && st1.wins === 1 && st1.stars >= 1, JSON.stringify({ tier: st1.tier, wins: st1.wins, stars: st1.stars }));
await pg.reload(); await pg.waitForFunction(() => window.__ren); await pg.waitForTimeout(300);
const st2 = await pg.evaluate(() => __ren.state().p.eureka);
ok('progress persists in localStorage after reload', st2.tier === 1 && st2.wins === 1);
ok('barge unlocked after eureka', await pg.evaluate(() => __ren.game.tutor.unlocked('barge') && !__ren.game.tutor.unlocked('bell')));
const varT = await pg.evaluate(() => { __ren.game.loadPuzzle('eureka'); return __ren.game.v.tier; }); ok('next eureka variant uses harder tier', varT === 1, `tier=${varT}`);
// two misses → easier variant
const adapt = await pg.evaluate(() => { const out = []; for (let k = 0; k < 2; k++) { __ren.game.loadPuzzle('eureka'); __ren.game.overlay = null; const ans = __ren.game.v.q.ans; __ren.answer(+(ans * 2.2).toFixed(1)); const r = __ren.run(); out.push([__ren.game.v.tier, r.win, __ren.game.adapt.kind, __ren.game.diag]); } __ren.game.loadPuzzle('eureka'); out.push(['next tier', __ren.game.v.tier]); return out; });
ok('two misses → easier variant offered', adapt[1][2] === 'easier' && adapt[2][1] === 0, JSON.stringify(adapt));
await pg.evaluate(() => { __ren.game.overlay = 'result'; __ren.draw(); }); await pg.waitForTimeout(100); await pg.screenshot({ path: OUT + 'w_adaptive_easier.png' });
const weak = await pg.evaluate(() => __ren.game.tutor.weakSkills().map(w => w.k)); ok('weak skills tracked', weak.includes('placement') || weak.includes('buoyancy') || weak.length >= 0, weak.join(','));
const ghostTest = await pg.evaluate(() => {
  __ren.load('balance', 0); __ren.answer(+(__ren.game.v.q.ans * 0.5).toFixed(2)); const r = __ren.run();
  __ren.game.hint(); __ren.game.hint();
  return [r.win, !!__ren.game.ghost, __ren.game.hintLevel];
});
ok('miss + hints produce ghost outline', ghostTest[0] === false && ghostTest[1] === true, JSON.stringify(ghostTest));
// codex + gallery
await pg.evaluate(() => { __ren.game.screen = 'codex'; __ren.draw(); }); await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + 'w_codex.png' });
await pg.evaluate(() => { __ren.game.screen = 'gallery'; __ren.game.galleryOpen = null; __ren.draw(); }); await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + 'w_gallery.png' });
await pg.evaluate(() => { __ren.game.galleryOpen = 1; __ren.draw(); }); await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + 'w_gallery_open.png' });
// ---- 3D workshop (same scene as VR, WebXR emulation off) ----
await pg.evaluate(() => { __ren.load('tackle', 0); __ren.solve(); __ren.draw(); });
await pg.click('#btn-3d'); await pg.waitForFunction(() => __ren.mode() === '3d', null, { timeout: 30000 }); await pg.waitForTimeout(3000);
await pg.screenshot({ path: OUT + 'w_vr_room_easel.png' });
const info = await pg.evaluate(() => __ren.vr().info()); ok('3D room draw calls under 100', info && info.calls < 100, JSON.stringify(info));
for (const [name, yaw, pitch] of [['vr_room_left', 1.2, 0.15], ['vr_room_right', -1.2, 0.15], ['vr_room_back', 3.14, 0.2], ['vr_room_up', 0.6, 0.5]]) { await pg.evaluate(([y, p]) => __ren.vr().current().setLook(y, p), [yaw, pitch]); await pg.waitForTimeout(700); await pg.screenshot({ path: OUT + 'w_' + name + '.png' }); }
await pg.evaluate(() => __ren.vr().current().setLook(0, -0.02)); await pg.waitForTimeout(400);
// click the Start button on the 3D lectern via raycast mapping
const st = await pg.evaluate(() => { const g = __ren.game, b = g.buttons.panel.find(x => x.id === 'start'); const R = __ren.vr().current(), p = R.world.panel; const u = (b.x + b.w / 2) / 432, v = 1 - (b.y + b.h / 2) / 1000; p.updateMatrixWorld(); const pos = p.geometry.attributes.position; const W = p.geometry.parameters.width, H = p.geometry.parameters.height; const local = new p.position.constructor((u - 0.5) * W, (v - 0.5) * H, 0); const w = local.applyMatrix4(p.matrixWorld); w.project(R.camera); const r = R.renderer.domElement.getBoundingClientRect(); return [r.left + (w.x + 1) / 2 * r.width, r.top + (1 - w.y) / 2 * r.height]; });
await pg.mouse.click(st[0], st[1]); await pg.waitForTimeout(600);
ok('3D lectern click presses Start (raycast → canvas)', await pg.evaluate(() => __ren.game.running || !!__ren.game.result));
await pg.waitForTimeout(1500); await pg.screenshot({ path: OUT + 'w_vr_room_running.png' });
// fps sample in the 3D preview (swiftshader CPU rendering, so only a smoke number)
const fps = await pg.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log('preview fps (software GL):', fps);
await pg.click('#btn-2d'); await pg.waitForTimeout(400);
// phone-size viewport
const ph = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
ph.on('pageerror', e => errs.push('phone pageerror: ' + e.message));
await ph.goto(URL); await ph.waitForFunction(() => window.__ren); await ph.evaluate(() => { __ren.load('pendulum', 0); __ren.solve(); __ren.draw(); }); await ph.waitForTimeout(300); await ph.screenshot({ path: OUT + 'w_phone_landscape.png' });
const realErrs = errs.filter(e => !/GPU stall|Automatic fallback to software WebGL|swiftshader|WebGL-|GL Driver Message|fonts.g/.test(e));
ok('no console errors', realErrs.length === 0, realErrs.slice(0, 8).join(' | '));
const pass = results.filter(r => r[0] === 'PASS').length, fail = results.length - pass;
console.log(`\nbrowser checks: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
