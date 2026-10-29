// Unit tests for the local command parser (~40 cases).
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';

const parserPath = path.resolve('/workspace/holodeck/js/parser.js');
const { parseCommand, PRESETS, ENVIRONMENTS } = await import(pathToFileURL(parserPath).href);

const results = [];
const ok = (name, cond, extra = '') => {
  results.push([cond ? 'PASS' : 'FAIL', name, extra]);
  console.log(cond ? 'PASS' : 'FAIL', name, extra);
};

const cases = [
  ['create beach sunset', 'create a beach at sunset', 'create', { environment: 'beach', time: 'sunset' }],
  ['create forest night fireflies', 'forest at night with fireflies', 'create', { environment: 'forest', time: 'night' }],
  ['snow storm', 'snow storm', 'create', { environment: 'snow', weather: 'storm' }],
  ['space', 'create space', 'create', { environment: 'space' }],
  ['city night', 'create a city at night', 'create', { environment: 'city', time: 'night' }],
  ['mountains dawn', 'create mountains at dawn', 'create', { environment: 'mountains', time: 'dawn' }],
  ['desert noon', 'desert at noon', 'create', { environment: 'desert', time: 'noon' }],
  ['ocean', 'create an ocean', 'create', { environment: 'ocean' }],
  ['underwater', 'underwater', 'create', { environment: 'underwater' }],
  ['meadow', 'create a meadow', 'create', { environment: 'meadow' }],
  ['cave', 'create a cave', 'create', { environment: 'cave' }],
  ['lake', 'create a lake', 'create', { environment: 'lake' }],
  ['canyon', 'canyon at sunset', 'create', { environment: 'canyon', time: 'sunset' }],
  ['planet', 'create a planet surface', 'create', { environment: 'planet' }],
  ['starfield', 'starfield', 'create', { environment: 'space' }],
  ['arctic', 'arctic', 'create', { environment: 'snow' }],
  ['computer prefix', 'Computer, create a beach at sunset', 'create', { environment: 'beach' }],
  ['make night', 'make it night', 'time', { time: 'night' }],
  ['make sunset', 'make it sunset', 'time', { time: 'sunset' }],
  ['add rain', 'add rain', 'weather', { weather: 'rain' }],
  ['fog', 'make it foggy', 'weather', { weather: 'fog' }],
  ['storm weather', 'add storm', 'weather', { weather: 'storm' }],
  ['aurora', 'make it aurora', 'weather', { weather: 'aurora' }],
  ['add campfire', 'add a campfire', 'add', { object: 'campfire' }],
  ['add boat', 'add a boat', 'add', { object: 'boat' }],
  ['add tent', 'add tent', 'add', { object: 'tent' }],
  ['add palms', 'add palm trees', 'add', { object: 'palms' }],
  ['add fireflies', 'add fireflies', 'add', { object: 'fireflies' }],
  ['remove boat', 'remove the boat', 'remove', { object: 'boat' }],
  ['remove campfire', 'remove the campfire', 'remove', { object: 'campfire' }],
  ['end', 'end program', 'end', null],
  ['exit', 'exit', 'end', null],
  ['arch', 'arch', 'arch', null],
  ['freeze', 'freeze program', 'freeze', null],
  ['unfreeze', 'unfreeze', 'unfreeze', null],
  ['save', 'save program as beach1', 'save', { name: 'beach1' }],
  ['load', 'load program beach1', 'load', { name: 'beach1' }],
  ['list', 'list programs', 'list', null],
  ['unknown', 'beam me up', 'unknown', null],
  ['empty', '', 'empty', null],
];

for (const [name, input, action, payload] of cases) {
  const r = parseCommand(input);
  const actionOk = r.action === action;
  let payloadOk = true;
  if (payload) {
    for (const [k, v] of Object.entries(payload)) {
      if (r.payload?.[k] !== v) payloadOk = false;
    }
  }
  const expectOk = action !== 'unknown' && action !== 'empty';
  ok(name, actionOk && payloadOk && r.ok === expectOk, JSON.stringify({ in: input, got: r.action, payload: r.payload, reply: r.reply }));
}

ok('presets >= 8', PRESETS.length >= 8, String(PRESETS.length));
ok('environments >= 12', ENVIRONMENTS.length >= 12, String(ENVIRONMENTS.length));

const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\nParser: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
