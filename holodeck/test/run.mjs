import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const ROOT = '/workspace/holodeck';
const OUT = join(ROOT, 'shots');
const PORT = 8788;
mkdirSync(OUT, { recursive: true });

// Static server
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown' };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const URL = `http://127.0.0.1:${PORT}/index.html`;

const results = [];
const ok = (name, cond, extra = '') => {
  results.push([cond ? 'PASS' : 'FAIL', name, extra]);
  console.log(cond ? 'PASS' : 'FAIL', name, extra);
};

// Parser unit tests first
console.log('\n=== parser unit ===');
const parserProc = spawn('node', [join(ROOT, 'test/parser.test.mjs')], { stdio: ['ignore', 'pipe', 'pipe'] });
let parserOut = '';
parserProc.stdout.on('data', d => { parserOut += d; process.stdout.write(d); });
parserProc.stderr.on('data', d => { parserOut += d; process.stderr.write(d); });
const parserCode = await new Promise(r => parserProc.on('close', r));
ok('parser suite exit 0', parserCode === 0);

console.log('\n=== browser ===');
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await pg.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await pg.waitForFunction(() => window.__holodeck?.screenshotReady, null, { timeout: 60000 });
await pg.waitForTimeout(800);

ok('page loaded with __holodeck', await pg.evaluate(() => !!window.__holodeck));
ok('no console errors on load', errs.length === 0, errs.slice(0, 5).join(' | '));

// Hub links
const progs = await pg.evaluate(() => __holodeck.programs.map(p => ({ id: p.id, href: p.href })));
ok('EMT href is ../', progs.find(p => p.id === 'emt')?.href === '../', JSON.stringify(progs));
ok('Lab href is ../lab/', progs.find(p => p.id === 'lab')?.href === '../lab/', JSON.stringify(progs));

await pg.screenshot({ path: join(OUT, '01_grid_room.png') });

// Look at arch panel
await pg.evaluate(() => {
  __holodeck.player.position.set(0, 0, 0);
  __holodeck.setView([0, 1.5, 1.5], [0, 1.3, -4.4]);
});
await pg.waitForTimeout(400);
await pg.screenshot({ path: join(OUT, '02_arch_panel.png') });

// Environments to build + shoot
const scenes = [
  ['03_beach_sunset', 'create a beach at sunset'],
  ['04_forest_night_fireflies', 'create a forest at night with fireflies'],
  ['05_snow_storm', 'create snow storm'],
  ['06_space', 'create space'],
  ['07_city_night', 'create a city at night'],
];

for (const [name, cmd] of scenes) {
  const r = await pg.evaluate(async (cmd) => {
    const res = await __holodeck.run(cmd);
    return { action: res.action, ok: res.ok, mode: __holodeck.mode(), spec: __holodeck.spec(), draw: __holodeck.drawInfo() };
  }, cmd);
  ok(`${name} builds`, r.ok && r.mode === 'world', JSON.stringify({ action: r.action, env: r.spec?.environment, calls: r.draw?.calls }));
  // budget: allow hub lights etc; world approxCalls + renderer calls
  const calls = r.draw?.calls ?? 999;
  ok(`${name} draw calls < 120`, calls < 120, `calls=${calls} world=${JSON.stringify(r.draw?.world)}`);
  await pg.evaluate((name) => {
    if (name.includes('beach')) {
      __holodeck.player.position.set(0, 0, 6);
      __holodeck.setView([0, 2.2, 8], [0, 0.5, -12]);
    } else if (name.includes('city')) {
      __holodeck.player.position.set(0, 0, 6);
      __holodeck.setView([0, 3.5, 10], [0, 2, -12]);
    } else if (name.includes('space')) {
      __holodeck.player.position.set(0, 0, 2);
      __holodeck.setView([0, 1.4, 4], [8, 2, -20]);
    } else if (name.includes('forest')) {
      __holodeck.player.position.set(0, 0, 4);
      __holodeck.setView([0, 1.4, 5], [0, 1.5, -8]);
    } else {
      __holodeck.player.position.set(0, 0, 3);
      __holodeck.setView([0, 1.8, 5], [0, 1.2, -8]);
    }
  }, name);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: join(OUT, name + '.png') });
}

// Extra env smoke (no screenshot for all)
for (const cmd of [
  'create a desert at noon', 'create mountains at dawn', 'create an ocean',
  'create underwater', 'create a meadow', 'create a cave', 'create a lake',
  'create a canyon at sunset', 'create a planet surface'
]) {
  const r = await pg.evaluate(async (cmd) => {
    const res = await __holodeck.run(cmd);
    return { ok: res.ok, mode: __holodeck.mode(), env: __holodeck.spec()?.environment, calls: __holodeck.drawInfo().calls };
  }, cmd);
  ok(`env ${cmd}`, r.ok && r.mode === 'world', `env=${r.env} calls=${r.calls}`);
}

// Save / load
const saveLoad = await pg.evaluate(async () => {
  await __holodeck.run('create a beach at sunset');
  await __holodeck.run('add a campfire');
  await __holodeck.run('save program as testbeach');
  await __holodeck.run('end program');
  const mode1 = __holodeck.mode();
  await __holodeck.run('load program testbeach');
  return {
    mode1,
    mode2: __holodeck.mode(),
    env: __holodeck.spec()?.environment,
    objs: __holodeck.spec()?.objects,
    saves: __holodeck.saves()
  };
});
ok('end returns to hub', saveLoad.mode1 === 'hub', saveLoad.mode1);
ok('load restores world', saveLoad.mode2 === 'world' && saveLoad.env === 'beach', JSON.stringify(saveLoad));
ok('save listed', saveLoad.saves.includes('testbeach'), JSON.stringify(saveLoad.saves));

// add/remove
const ar = await pg.evaluate(async () => {
  await __holodeck.run('add a boat');
  const withBoat = (__holodeck.spec()?.objects || []).includes('boat');
  await __holodeck.run('remove the boat');
  const without = !(__holodeck.spec()?.objects || []).includes('boat');
  return { withBoat, without };
});
ok('add/remove boat', ar.withBoat && ar.without, JSON.stringify(ar));

// unknown
const unk = await pg.evaluate(async () => __holodeck.run('xyzzy dazzle'));
ok('unknown unable to comply', !unk.ok && /Unable to comply/i.test(unk.reply), unk.reply);

// seated
await pg.evaluate(() => __holodeck.setSeated(true));
ok('seated toggles', await pg.evaluate(() => __holodeck.seated() === true));

await pg.evaluate(async () => { await __holodeck.run('end program'); });
await pg.evaluate(() => __holodeck.setView([0, 1.5, 2], [0, 1.3, -4]));
await pg.waitForTimeout(300);
await pg.screenshot({ path: join(OUT, '08_back_to_grid.png') });

const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\nBrowser+parser checks: ${results.length - failed}/${results.length} passed`);
console.log('Errors log:', errs.length ? errs.join('\n') : 'none');
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
