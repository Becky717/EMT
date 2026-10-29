// Local command parser — no network, no API keys.
// Understands environments, time, weather, objects, and program control.

export const ENVIRONMENTS = [
  'beach', 'forest', 'desert', 'snow', 'arctic', 'mountains', 'ocean', 'underwater',
  'space', 'starfield', 'planet', 'city', 'meadow', 'cave', 'lake', 'canyon'
];

export const TIMES = ['dawn', 'noon', 'sunset', 'dusk', 'night', 'day'];
export const WEATHERS = ['clear', 'rain', 'snow', 'fog', 'storm', 'aurora'];
export const OBJECTS = [
  'campfire', 'fire', 'tree', 'trees', 'palm', 'palms', 'rock', 'rocks',
  'boat', 'tent', 'moon', 'fireflies', 'birds', 'sun'
];

const ENV_ALIASES = {
  beach: ['beach', 'shore', 'coast', 'seaside'],
  forest: ['forest', 'woods', 'woodland', 'jungle'],
  desert: ['desert', 'dunes', 'sahara'],
  snow: ['snow', 'snowy', 'winter', 'blizzard'],
  arctic: ['arctic', 'tundra', 'icefield', 'ice'],
  mountains: ['mountain', 'mountains', 'alpine', 'peaks'],
  ocean: ['ocean', 'sea', 'waves'],
  underwater: ['underwater', 'under water', 'reef', 'submerged'],
  space: ['space', 'orbit', 'cosmos'],
  starfield: ['starfield', 'stars', 'nebula'],
  planet: ['planet', 'mars', 'lunar surface', 'moon surface', 'alien'],
  city: ['city', 'skyline', 'downtown', 'neon'],
  meadow: ['meadow', 'field', 'grassland', 'prairie'],
  cave: ['cave', 'cavern', 'grotto'],
  lake: ['lake', 'pond', 'reservoir'],
  canyon: ['canyon', 'gorge', 'ravine']
};

const TIME_ALIASES = {
  dawn: ['dawn', 'sunrise', 'morning', 'sunrise'],
  noon: ['noon', 'midday', 'afternoon', 'daytime', 'day'],
  sunset: ['sunset', 'dusk', 'evening', 'golden hour'],
  night: ['night', 'midnight', 'nighttime', 'dark']
};

const WEATHER_ALIASES = {
  clear: ['clear', 'sunny', 'calm', 'fair'],
  rain: ['rain', 'rainy', 'raining', 'drizzle'],
  snow: ['snow', 'snowing', 'snowfall'],
  fog: ['fog', 'foggy', 'mist', 'misty'],
  storm: ['storm', 'stormy', 'thunder', 'lightning'],
  aurora: ['aurora', 'northern lights', 'borealis']
};

const OBJ_ALIASES = {
  campfire: ['campfire', 'fire', 'bonfire', 'fireplace'],
  trees: ['tree', 'trees', 'pine', 'pines'],
  palms: ['palm', 'palms', 'palm tree', 'palm trees'],
  rocks: ['rock', 'rocks', 'boulder', 'boulders', 'stone', 'stones'],
  boat: ['boat', 'boats', 'canoe', 'raft', 'ship'],
  tent: ['tent', 'tents', 'campsite'],
  moon: ['moon', 'full moon'],
  fireflies: ['firefly', 'fireflies', 'lightning bugs'],
  birds: ['bird', 'birds', 'seagull', 'seagulls']
};

const SUGGESTIONS = [
  'beach at sunset', 'forest at night', 'snow storm', 'space',
  'city at night', 'add a campfire', 'make it night', 'end program'
];

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^computer[,:]?\s*/i, '')
    .replace(/[^\w\s\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findAlias(map, text) {
  for (const [key, aliases] of Object.entries(map)) {
    for (const a of aliases) {
      if (text === a || text.includes(' ' + a + ' ') || text.startsWith(a + ' ') || text.endsWith(' ' + a) || text.includes(a)) {
        // prefer longer alias matches; caller sorts by length
        return { key, alias: a, len: a.length };
      }
    }
  }
  return null;
}

function bestAlias(map, text) {
  let best = null;
  for (const [key, aliases] of Object.entries(map)) {
    for (const a of aliases) {
      const re = new RegExp(`(?:^|\\s)${a.replace(/\s+/g, '\\s+')}(?:\\s|$)`);
      if (re.test(text) || text === a) {
        if (!best || a.length > best.len) best = { key, alias: a, len: a.length };
      }
    }
  }
  return best;
}

function parseSaveName(text, prefix) {
  const m = text.match(new RegExp(`^${prefix}\\s+(?:program\\s+)?(?:as\\s+)?["']?([\\w\\- ]{1,40})["']?$`));
  return m ? m[1].trim() : null;
}

/**
 * @returns {{ ok: boolean, action: string, payload?: object, reply: string }}
 */
export function parseCommand(raw) {
  const text = norm(raw);
  if (!text) {
    return { ok: false, action: 'empty', reply: 'State a command.' };
  }

  // End / exit program → return to grid
  if (/^(end|exit|stop|quit)(\s+program)?$/.test(text) || text === 'return to grid' || text === 'grid') {
    return { ok: true, action: 'end', reply: 'Ending program.' };
  }

  // Arch / programs panel
  if (/^(arch|programs?|menu|hub)$/.test(text) || text === 'show arch' || text === 'open arch') {
    return { ok: true, action: 'arch', reply: 'Arch online.' };
  }

  // Freeze / pause
  if (/^(freeze|pause)(\s+program)?$/.test(text)) {
    return { ok: true, action: 'freeze', reply: 'Program frozen.' };
  }
  if (/^(unfreeze|resume|continue)(\s+program)?$/.test(text)) {
    return { ok: true, action: 'unfreeze', reply: 'Program resumed.' };
  }

  // Save / load
  if (text.startsWith('save')) {
    const name = parseSaveName(text, 'save') || parseSaveName(text.replace(/^save\s+program\s+as\s+/, 'save '), 'save');
    // also: "save program as X", "save as X", "save X"
    let n = null;
    const m1 = text.match(/^save(?:\s+program)?(?:\s+as)?\s+(.+)$/);
    if (m1) n = m1[1].replace(/^["']|["']$/g, '').trim();
    if (!n) return { ok: false, action: 'save', reply: 'Unable to comply. Try: save program as beach1' };
    return { ok: true, action: 'save', payload: { name: n }, reply: `Saved as ${n}.` };
  }
  if (text.startsWith('load')) {
    const m1 = text.match(/^load(?:\s+program)?\s+(.+)$/);
    const n = m1 ? m1[1].replace(/^["']|["']$/g, '').trim() : null;
    if (!n) return { ok: false, action: 'load', reply: 'Unable to comply. Try: load program beach1' };
    return { ok: true, action: 'load', payload: { name: n }, reply: `Loading ${n}.` };
  }
  if (text === 'list programs' || text === 'list saves' || text === 'saved programs') {
    return { ok: true, action: 'list', reply: 'Listing saved programs.' };
  }

  // Remove object
  if (/^(remove|delete|clear)\b/.test(text)) {
    const rest = text.replace(/^(remove|delete|clear)\s+(the\s+)?/, '');
    const obj = bestAlias(OBJ_ALIASES, rest);
    if (obj) return { ok: true, action: 'remove', payload: { object: obj.key }, reply: `Removing ${obj.key}.` };
    if (/^(all|everything|world|program)$/.test(rest)) {
      return { ok: true, action: 'end', reply: 'Ending program.' };
    }
    return { ok: false, action: 'remove', reply: `Unable to comply. Try: remove the boat. Options: ${OBJECTS.slice(0, 8).join(', ')}` };
  }

  // Add object OR weather ("add rain")
  if (/^(add|place|put|spawn|start|enable)\b/.test(text)) {
    const rest = text.replace(/^(add|place|put|spawn|start|enable)\s+(a\s+|an\s+|some\s+|the\s+)?/, '');
    const weather = bestAlias(WEATHER_ALIASES, rest);
    if (weather && !bestAlias(OBJ_ALIASES, rest)) {
      return { ok: true, action: 'weather', payload: { weather: weather.key }, reply: `Setting ${weather.key}.` };
    }
    const obj = bestAlias(OBJ_ALIASES, rest);
    if (obj) return { ok: true, action: 'add', payload: { object: obj.key }, reply: `Adding ${obj.key}.` };
    return { ok: false, action: 'add', reply: `Unable to comply. Try: add a campfire. Options: ${OBJECTS.slice(0, 8).join(', ')}` };
  }

  // Make it / set time or weather only
  if (/^(make it|set|change to|turn to)\b/.test(text) || /^(make|set)\s+\w+$/.test(text)) {
    const rest = text.replace(/^(make it|make|set|change to|turn to)\s+/, '');
    const time = bestAlias(TIME_ALIASES, rest);
    const weather = bestAlias(WEATHER_ALIASES, rest);
    if (time) return { ok: true, action: 'time', payload: { time: time.key === 'dusk' ? 'sunset' : time.key }, reply: `Setting ${time.key}.` };
    if (weather) return { ok: true, action: 'weather', payload: { weather: weather.key }, reply: `Setting ${weather.key}.` };
    return { ok: false, action: 'set', reply: 'Unable to comply. Try: make it night, or add rain.' };
  }

  // Standalone weather verbs: "add rain", "rain", "start raining"
  {
    const weather = bestAlias(WEATHER_ALIASES, text);
    if (weather && (text === weather.alias || /^(add|start|enable)\s/.test(text) || text.endsWith(weather.alias))) {
      // Only treat as pure weather if no environment word present
      const env = bestAlias(ENV_ALIASES, text);
      if (!env) {
        return { ok: true, action: 'weather', payload: { weather: weather.key }, reply: `Setting ${weather.key}.` };
      }
    }
  }

  // Standalone time: "night", "sunset"
  {
    const time = bestAlias(TIME_ALIASES, text);
    if (time && text === time.alias) {
      return { ok: true, action: 'time', payload: { time: time.key === 'dusk' ? 'sunset' : time.key }, reply: `Setting ${time.key}.` };
    }
  }

  // Create / go to / take me to environment
  const createLike = /^(create|build|make|generate|show|go to|take me to|load|run|start)(\s+a|\s+an|\s+the)?\s+/.test(text)
    || text.includes(' at ')
    || bestAlias(ENV_ALIASES, text);

  if (createLike || bestAlias(ENV_ALIASES, text)) {
    let body = text.replace(/^(create|build|make|generate|show|go to|take me to|run|start)(\s+a|\s+an|\s+the)?\s+/, '');
    body = body.replace(/^program\s+/, '');

    const env = bestAlias(ENV_ALIASES, body) || bestAlias(ENV_ALIASES, text);
    const time = bestAlias(TIME_ALIASES, body);
    const weather = bestAlias(WEATHER_ALIASES, body);

    // Objects mentioned in create: "beach with a campfire"
    const extras = [];
    for (const [key, aliases] of Object.entries(OBJ_ALIASES)) {
      for (const a of aliases) {
        if (new RegExp(`(?:^|\\s)${a.replace(/\s+/g, '\\s+')}(?:\\s|$)`).test(body)) {
          extras.push(key);
          break;
        }
      }
    }

    if (!env) {
      return {
        ok: false,
        action: 'create',
        reply: `Unable to comply. Try: ${SUGGESTIONS[0]}. Worlds: beach, forest, desert, snow, mountains, ocean, space, city, meadow, cave, lake, canyon.`
      };
    }

    let t = time ? (time.key === 'dusk' ? 'sunset' : time.key) : null;
    // defaults by vibe
    if (!t) {
      if (env.key === 'city') t = 'night';
      else if (env.key === 'space' || env.key === 'starfield') t = 'night';
      else if (env.key === 'cave') t = 'night';
      else t = 'noon';
    }
    let w = weather ? weather.key : 'clear';
    if (env.key === 'snow' || env.key === 'arctic') {
      if (!weather) w = 'snow';
    }

    // Normalize env keys used by worlds.js
    let environment = env.key;
    if (environment === 'arctic') environment = 'snow';
    if (environment === 'starfield') environment = 'space';
    if (environment === 'planet') environment = 'planet';

    return {
      ok: true,
      action: 'create',
      payload: { environment, time: t, weather: w, objects: extras },
      reply: `Creating ${environment}${t ? ' · ' + t : ''}${w !== 'clear' ? ' · ' + w : ''}.`
    };
  }

  return {
    ok: false,
    action: 'unknown',
    reply: `Unable to comply. Try: ${SUGGESTIONS.join(' · ')}`
  };
}

export function listSuggestions() {
  return SUGGESTIONS.slice();
}

export const PRESETS = [
  { label: '🏖 Beach sunset', cmd: 'create a beach at sunset' },
  { label: '🌲 Forest night', cmd: 'create a forest at night with fireflies' },
  { label: '🏔 Mountains dawn', cmd: 'create mountains at dawn' },
  { label: '❄ Snow storm', cmd: 'create snow storm' },
  { label: '🌌 Space', cmd: 'create space' },
  { label: '🌃 City night', cmd: 'create a city at night' },
  { label: '🔥 + Campfire', cmd: 'add a campfire' },
  { label: '🌙 Make night', cmd: 'make it night' },
  { label: '⏹ End', cmd: 'end program' }
];
