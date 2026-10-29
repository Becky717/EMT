// =====================================================================
 //  EMT SIM VR — LOCAL CALLS (North Alabama real roads)
 //  OpenStreetMap locations (static JSON). Optional Google Maps hook later.
 //  Toggle: "Local calls (North Alabama)" — default ON.
 // =====================================================================
import { LOCATIONS, STATION, ATTRIBUTION, AREA } from './locations.js';

const KEY = 'emtvr_local_calls';
export function isLocalOn() {
  try { const v = localStorage.getItem(KEY); return v == null ? true : v === '1'; } catch (e) { return true; }
}
export function setLocalOn(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
}
export function toggleLocal() { const n = !isLocalOn(); setLocalOn(n); return n; }

export { LOCATIONS, STATION, ATTRIBUTION, AREA };

// ---------- scenario / template → preferred location tags ----------
const SCN_TAGS = {
  asthma: ['home', 'asthma', 'school'],
  chf: ['home', 'chf', 'store', 'church'],
  opioid: ['opioid', 'store', 'home'],
  arrest: ['arrest', 'school', 'store', 'sca'],
  infant: ['infant', 'home', 'school'],
  acs: ['acs', 'store', 'industrial', 'church'],
  anaph: ['anaph', 'farm', 'field', 'boat'],
  bleed: ['bleed', 'mvc', 'trauma', 'industrial', 'highway'],
};
const TPL_TAGS = {
  co: ['co', 'industrial', 'home', 'farm'],
  cardioShock: ['chf', 'boat', 'church', 'home', 'store'],
  pde5: ['acs', 'store', 'home'],
  asaAllergy: ['acs', 'asa', 'store'],
  gagTrap: ['opioid', 'store', 'home'],
  hypo: ['hypo', 'store', 'home', 'school'],
  hypox: ['acs', 'store', 'home'],
  ptx: ['home', 'school', 'field'],
  sca: ['sca', 'school', 'field', 'arrest'],
  hiddenBleed: ['bleed', 'farm', 'home', 'industrial'],
  ntgDrop: ['acs', 'store', 'home'],
  sedOD: ['opioid', 'home', 'store'],
  anaNoHives: ['anaph', 'store', 'farm', 'school'],
};
const SCN_NATURE = {
  asthma: 'difficulty breathing / asthma',
  chf: 'difficulty breathing / possible CHF',
  opioid: 'unresponsive / possible overdose',
  arrest: 'unresponsive / cardiac arrest',
  infant: 'infant not breathing',
  acs: 'chest pain',
  anaph: 'allergic reaction',
  bleed: 'traumatic bleeding / possible MVC',
};
const TPL_NATURE = {
  co: 'altered / "acting drunk"',
  cardioShock: 'difficulty breathing',
  pde5: 'chest pain',
  asaAllergy: 'chest pain',
  gagTrap: 'seizure / unresponsive',
  hypo: 'altered mental status',
  hypox: 'short of breath / weakness',
  ptx: 'difficulty breathing',
  sca: '"seizure" / unresponsive',
  hiddenBleed: 'trauma / bleeding',
  ntgDrop: 'chest pain',
  sedOD: 'unresponsive / possible OD',
  anaNoHives: 'allergic reaction / trouble breathing',
};
const SCN_PRIORITY = {
  asthma: 1, chf: 1, opioid: 1, arrest: 1, infant: 1, acs: 1, anaph: 1, bleed: 1,
};

const UNITS = ['Medic 2', 'Medic 4', 'Rescue 3', 'Engine 2'];
const CALLERS = ['passing motorist', 'family member', 'store employee', 'bystander', 'security', 'coworker', 'neighbor'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Prefer locations matching any of the tags; fall back to all. Avoid immediate repeats. */
let _lastLocId = null;
export function pickLocation(tags = []) {
  const want = new Set(tags);
  let pool = LOCATIONS.filter(l => l.tags.some(t => want.has(t)));
  if (!pool.length) pool = LOCATIONS.slice();
  if (_lastLocId && pool.length > 1) pool = pool.filter(l => l.id !== _lastLocId);
  const loc = pick(pool);
  _lastLocId = loc.id;
  return loc;
}

function tagsForScenario(scn) {
  if (scn.template && TPL_TAGS[scn.template]) return TPL_TAGS[scn.template];
  if (scn.id && SCN_TAGS[scn.id]) return SCN_TAGS[scn.id];
  const bySkill = {
    scene: ['co', 'industrial', 'farm'], bpCpap: ['chf', 'boat', 'home'], medHx: ['acs', 'store'],
    allergy: ['acs', 'store'], gag: ['opioid', 'store'], glucose: ['hypo', 'home'], spo2: ['acs', 'store'],
    lungs: ['home', 'school'], pulseCheck: ['sca', 'school'], bleedFirst: ['bleed', 'farm', 'industrial'],
    ventRate: ['opioid', 'home'], epi: ['anaph', 'farm', 'store'], bpNitro: ['acs', 'store'],
  };
  if (scn.tested && bySkill[scn.tested]) return bySkill[scn.tested];
  return scn.tags || [];
}

function natureFor(scn) {
  if (scn.template && TPL_NATURE[scn.template]) return TPL_NATURE[scn.template];
  if (scn.id && SCN_NATURE[scn.id]) return SCN_NATURE[scn.id];
  return (scn.dispatch || 'sick person').split('.')[0].slice(0, 60);
}

/** Short radio-style CAD string. */
export function buildCad(loc, nature, opts = {}) {
  const unit = opts.unit || pick(UNITS);
  const pri = opts.priority || 1;
  const caller = opts.caller || pick(CALLERS);
  const ageSex = opts.ageSex || '';
  const extra = ageSex ? `, ${ageSex}` : '';
  // Keep ADHD-friendly: one tight block
  return `${unit}, priority ${pri}. ${loc.cadPlace}. ${nature}${extra}. Caller: ${caller}.`;
}

function sceneLead(loc) {
  const by = {
    roadside: `Roadside on ${loc.road}${loc.cross ? ' at ' + loc.cross : ''}, ${loc.town}. Traffic slowed; scene made safe.`,
    rural: `Rural property off ${loc.road}, ${loc.town}. Dogs secured; scene safe.`,
    home: `Residence in ${loc.town} (${loc.road}). Scene safe.`,
    school: `${loc.name}, ${loc.town}. Campus staff present; scene safe.`,
    store: `${loc.name}, ${loc.town}. Staff cleared a path; scene safe.`,
    dock: `${loc.name}. Shoreline / dock area; scene stable.`,
    field: `${loc.name}, ${loc.town}. Open area; scene safe.`,
    industrial: `${loc.name}, ${loc.town}. Shop floor / lot; scene safe.`,
  };
  return by[loc.scene] || `${loc.cadPlace}. Scene safe.`;
}

/** Strip leading generic place phrases so we can prepend the real address. */
function stripPlace(scene) {
  if (!scene) return 'Gloves on.';
  // Drop a leading "X, safe." / "X. Gloves" style prefix up to first "Gloves" or second sentence if short
  const g = scene.search(/Gloves on/i);
  if (g > 0 && g < 120) return scene.slice(g).trim();
  // otherwise keep from first period+space after a short lead-in
  const m = scene.match(/^.{8,90}?\.\s+(.*)$/);
  if (m) return m[1];
  return scene;
}

/**
 * Return a shallow-cloned scenario with local dispatch + scene framing.
 * Does NOT change physiology. Attaches scn.local for UI/map.
 */
export function localizeScenario(scn) {
  if (!scn || !isLocalOn()) return scn;
  const loc = pickLocation(tagsForScenario(scn));
  const nature = natureFor(scn);
  const ageSex = (() => {
    // try pull "NN y/o sex" from original dispatch
    const m = (scn.dispatch || '').match(/(\d+\s*y\/o\s+\w+)/i);
    return m ? m[1] : '';
  })();
  const cad = buildCad(loc, nature, { ageSex, priority: SCN_PRIORITY[scn.id] || 1 });
  const lead = sceneLead(loc);
  const rest = stripPlace(scn.find?.scene || '');
  const out = {
    ...scn,
    dispatch: cad,
    find: { ...(scn.find || {}), scene: `${lead} Gloves on. ${rest.replace(/^Gloves on\.\s*/i, '')}` },
    local: {
      loc,
      etaMin: loc.etaMin,
      mi: loc.mi,
      from: STATION.name,
      cad,
      nature,
      sceneType: loc.scene,
      attribution: ATTRIBUTION,
    },
  };
  return out;
}

// ---------- Map card (canvas) — OSM tile + schematic fallback ----------
function lon2tile(lon, z) { return ((lon + 180) / 360) * Math.pow(2, z); }
function lat2tile(lat, z) {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
}

const _tileCache = new Map();
function loadTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (_tileCache.has(key)) return _tileCache.get(key);
  const p = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Standard OSM raster tiles; browser User-Agent applies. Attribution required.
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
  _tileCache.set(key, p);
  return p;
}

/** Draw a CAD map card into a 2D canvas context. Returns a promise (tiles may load). */
export async function paintMapCard(ctx, W, H, local, opts = {}) {
  const loc = local?.loc;
  ctx.clearRect(0, 0, W, H);
  // CAD chrome
  ctx.fillStyle = '#0b1220';
  roundRect(ctx, 0, 0, W, H, 16); ctx.fill();
  ctx.strokeStyle = '#2f9e6a'; ctx.lineWidth = 3; ctx.stroke();

  const mapX = 12, mapY = 44, mapW = Math.floor(W * 0.55), mapH = H - 56;
  ctx.fillStyle = '#1a2332'; ctx.fillRect(mapX, mapY, mapW, mapH);

  if (loc) {
    const z = 13;
    const xf = lon2tile(loc.lon, z), yf = lat2tile(loc.lat, z);
    const tx = Math.floor(xf), ty = Math.floor(yf);
    // try center tile
    const img = await loadTile(z, tx, ty);
    if (img) {
      ctx.drawImage(img, mapX, mapY, mapW, mapH);
    } else {
      drawSchematic(ctx, mapX, mapY, mapW, mapH, loc);
    }
    // pin
    const px = mapX + mapW / 2, py = mapY + mapH / 2;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, py + 8); ctx.lineTo(px - 7, py + 20); ctx.lineTo(px + 7, py + 20); ctx.closePath(); ctx.fill();
  } else {
    drawSchematic(ctx, mapX, mapY, mapW, mapH, null);
  }

  // header
  ctx.fillStyle = '#5ee08a'; ctx.font = 'bold 18px ui-monospace, monospace';
  ctx.fillText('CAD · LOCAL DISPATCH', 14, 28);
  ctx.fillStyle = '#9fb0c8'; ctx.font = '12px system-ui';
  ctx.fillText(AREA.replace('North Alabama — ', ''), 200, 28);

  // right text panel
  const rx = mapX + mapW + 14, rw = W - rx - 12;
  ctx.fillStyle = '#e8eef7'; ctx.font = 'bold 15px system-ui';
  const place = loc?.cadPlace || 'Unknown';
  wrapText(ctx, place, rx, mapY + 18, rw, 18);
  ctx.fillStyle = '#7fd6ff'; ctx.font = '13px ui-monospace, monospace';
  if (loc) {
    ctx.fillText(`${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`, rx, mapY + 70);
    ctx.fillStyle = '#ffc857';
    ctx.fillText(`ETA ${local.etaMin} min · ${local.mi} mi`, rx, mapY + 92);
    ctx.fillStyle = '#9fb0c8';
    ctx.fillText(`from ${local.from}`, rx, mapY + 112);
    ctx.fillText(`Scene: ${local.sceneType}`, rx, mapY + 132);
  }
  ctx.fillStyle = '#6b7c93'; ctx.font = '10px system-ui';
  wrapText(ctx, ATTRIBUTION, rx, H - 28, rw, 12);

  if (opts.cad) {
    ctx.fillStyle = '#ffc857'; ctx.font = 'bold 12px system-ui';
    wrapText(ctx, opts.cad, 14, H - 14, W - 28, 14);
  }
}

function drawSchematic(ctx, x, y, w, h, loc) {
  ctx.fillStyle = '#243044'; ctx.fillRect(x, y, w, h);
  // fake roads
  ctx.strokeStyle = '#4b5a70'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x + 10, y + h * 0.55); ctx.lineTo(x + w - 10, y + h * 0.45); ctx.stroke();
  ctx.strokeStyle = '#3d4d63'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x + w * 0.4, y + 10); ctx.lineTo(x + w * 0.55, y + h - 10); ctx.stroke();
  ctx.fillStyle = '#7fd6ff'; ctx.font = 'bold 13px system-ui';
  ctx.fillText(loc ? loc.road : 'MAP', x + 12, y + 22);
  if (loc) { ctx.fillStyle = '#9fb0c8'; ctx.font = '11px system-ui'; ctx.fillText(loc.town, x + 12, y + 38); }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(/\s+/); let line = '', yy = y;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); yy += lh; line = w; }
    else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
}

/** Sync paint for VR panel texture (schematic only — no await). */
export function paintMapCardSync(ctx, W, H, local) {
  const loc = local?.loc;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0b1220'; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.strokeStyle = '#2f9e6a'; ctx.lineWidth = 4; ctx.stroke();
  const mapX = 16, mapY = 56, mapW = Math.floor(W * 0.5), mapH = H - 72;
  drawSchematic(ctx, mapX, mapY, mapW, mapH, loc);
  if (loc) {
    const px = mapX + mapW / 2, py = mapY + mapH / 2;
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(px, py, 10, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#5ee08a'; ctx.font = 'bold 28px ui-monospace, monospace';
  ctx.fillText('CAD · LOCAL DISPATCH', 20, 36);
  const rx = mapX + mapW + 20;
  ctx.fillStyle = '#e8eef7'; ctx.font = 'bold 26px system-ui';
  wrapText(ctx, loc?.cadPlace || '', rx, mapY + 24, W - rx - 16, 30);
  ctx.fillStyle = '#ffc857'; ctx.font = '22px ui-monospace, monospace';
  if (local) ctx.fillText(`ETA ${local.etaMin} min · ${local.mi} mi from ${local.from}`, rx, mapY + 120);
  ctx.fillStyle = '#7fd6ff'; ctx.font = '20px system-ui';
  if (loc) ctx.fillText(`${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`, rx, mapY + 150);
  ctx.fillStyle = '#9fb0c8'; ctx.font = '18px system-ui';
  if (local) wrapText(ctx, local.cad || '', 20, H - 36, W - 40, 22);
  ctx.fillStyle = '#6b7c93'; ctx.font = '14px system-ui';
  ctx.fillText(ATTRIBUTION, 20, H - 12);
}

// ---------- Google Maps Platform hook (not implemented — no API key) ----------
/**
 * Pluggable map provider. Current: 'osm' (static locations + OSM tiles).
 * To enable Google later:
 *   1. Get a Google Maps Platform key (Maps JavaScript API; optionally Map Tiles API for Photorealistic 3D).
 *   2. Set window.EMT_GOOGLE_MAPS_KEY = 'YOUR_KEY' before load (never commit the key; repo is public).
 *   3. Call setMapProvider('google') — then map cards can use google.maps.Map / 3D tiles.
 * Do NOT put keys in this repo.
 */
export const MAP_PROVIDER = { id: 'osm', googleKey: null };
export function setMapProvider(id) {
  if (id === 'google') {
    const k = (typeof window !== 'undefined' && window.EMT_GOOGLE_MAPS_KEY) || null;
    if (!k) { console.warn('Google Maps: set window.EMT_GOOGLE_MAPS_KEY first'); return false; }
    MAP_PROVIDER.id = 'google'; MAP_PROVIDER.googleKey = k; return true;
  }
  MAP_PROVIDER.id = 'osm'; MAP_PROVIDER.googleKey = null; return true;
}
export function mapProviderInfo() {
  return {
    current: MAP_PROVIDER.id,
    osm: 'Static OSM locations (Nominatim-verified) + optional raster tiles. ' + ATTRIBUTION,
    google: 'Not active. Needs Maps JavaScript API key (and Map Tiles API for Photorealistic 3D). Pass via window.EMT_GOOGLE_MAPS_KEY; never commit keys.',
  };
}
