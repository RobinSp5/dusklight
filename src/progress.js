// Progress rules that do not touch the DOM: stars, ghost encoding, skins, death log.
// Pure functions so tests/progress.mjs can verify them in Node.

// Par times (seconds) for the "fast" star. Derived from the solver's route time per level
// (route * 1.8 + 5, rounded up): beatable after a few attempts, not on a first blind run.
// Levels 1-8 keep their original values so stars players already earned do not disappear.
export const PAR = [20, 24, 29, 26, 25, 23, 31, 31, 31, 30, 36, 33, 38, 32, 38, 36, 38, 57, 43, 53, 56, 43, 39, 51, 47];

// entry = { time, shards, deathless } best values for a level (any may come from different runs)
export function starsFor(entry, levelIndex, shardTotal) {
  if (!entry) return { fast: false, shards: false, deathless: false, count: 0 };
  const fast = entry.time <= PAR[levelIndex];
  const shards = entry.shards >= shardTotal;
  const deathless = !!entry.deathless;
  return { fast, shards, deathless, count: (fast ? 1 : 0) + (shards ? 1 : 0) + (deathless ? 1 : 0) };
}

// ---------- ghost: one input bitmask per simulation step, run-length encoded ----------
const BITS = ['left', 'right', 'jumpHeld', 'jumpPressed', 'dashPressed', 'swapPressed'];

export function inputToMask(inp) {
  let m = 0;
  BITS.forEach((k, i) => { if (inp[k]) m |= 1 << i; });
  return m;
}

export function maskToInput(m) {
  const inp = {};
  BITS.forEach((k, i) => { inp[k] = !!(m & (1 << i)); });
  return inp;
}

// [mask, count, mask, count, ...]
export function encodeRun(masks) {
  const out = [];
  for (const m of masks) {
    if (out.length && out[out.length - 2] === m) out[out.length - 1]++;
    else out.push(m, 1);
  }
  return out;
}

export function decodeRun(rle) {
  let n = 0;
  for (let i = 1; i < rle.length; i += 2) n += rle[i];
  const masks = new Uint8Array(n);
  let k = 0;
  for (let i = 0; i < rle.length; i += 2) masks.fill(rle[i], k, (k += rle[i + 1]));
  return masks;
}

// A ghost is only valid for the exact level geometry it was recorded on.
const PHYSICS_VERSION = 2; // bump when mechanics timings change so old ghosts are dropped
export function levelHash(level) {
  const s = `${PHYSICS_VERSION}|${level.w}x${level.h}|${level.startPhase}|${level.pulse || 0}|${level.rows.join('/')}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// ---------- skins: unlocked by total shards collected (thresholds, nothing is spent) ----------
export const SKINS = {
  body: [
    { id: 'paper', name: 'Paper', color: '#f3efe7', visor: '#16131c', need: 0 },
    { id: 'ash', name: 'Ash', color: '#a49db0', visor: '#16131c', need: 5 },
    { id: 'rose', name: 'Rose', color: '#ffa3bb', visor: '#2a1420', need: 10 },
    { id: 'moss', name: 'Moss', color: '#a6dc8f', visor: '#13210f', need: 18 },
    { id: 'gold', name: 'Gold', color: '#ffd36b', visor: '#2a1d06', need: 28 },
    { id: 'void', name: 'Void', color: '#211d2b', visor: '#3d3650', outline: true, need: 40 },
    { id: 'prism', name: 'Prism', color: 'prism', visor: '#16131c', need: 100 },
  ],
  scarf: [
    { id: 'world', name: 'World', color: null, need: 0 }, // follows the active world colour
    { id: 'crimson', name: 'Crimson', color: '#e5484d', need: 3 },
    { id: 'violet', name: 'Violet', color: '#a78bfa', need: 8 },
    { id: 'lime', name: 'Lime', color: '#c6f432', need: 14 },
    { id: 'aurora', name: 'Aurora', color: 'aurora', need: 24 },
    { id: 'starlight', name: 'Starlight', color: 'starlight', need: 34 },
    { id: 'comet', name: 'Comet', color: 'comet', need: 80 },
  ],
  hat: [
    { id: 'none', name: 'None', need: 0 },
    { id: 'antenna', name: 'Antenna', need: 12 },
    { id: 'horns', name: 'Horns', need: 20 },
    { id: 'halo', name: 'Halo', need: 30 },
    { id: 'crown', name: 'Crown', need: 45 },
    { id: 'lantern', name: 'Lantern', need: 60 },
    { id: 'wings', name: 'Wings', need: 115 },
  ],
};
export const DEFAULT_SKIN = { body: 'paper', scarf: 'world', hat: 'none' };

export function shardPoints(best) {
  return Object.values(best || {}).reduce((s, e) => s + (e && Number.isFinite(e.shards) ? e.shards : 0), 0);
}

export const isUnlocked = (part, id, points) => {
  const item = SKINS[part].find((x) => x.id === id);
  return !!item && points >= item.need;
};

// Falls back to the default for anything unknown or not (yet) unlocked.
export function resolveSkin(choice, points) {
  const out = {};
  for (const part of Object.keys(SKINS)) {
    const id = choice && choice[part];
    out[part] = id && isUnlocked(part, id, points) ? id : DEFAULT_SKIN[part];
  }
  return out;
}

export function skinStyle(skin) {
  const body = SKINS.body.find((x) => x.id === skin.body);
  const scarf = SKINS.scarf.find((x) => x.id === skin.scarf);
  return { body: body.color, visor: body.visor, outline: !!body.outline, scarf: scarf.color, hat: skin.hat };
}

// Stored data comes from localStorage and may be corrupt: keep only well-formed entries.
const MAX_GHOST_STEPS = 120 * 60 * 10; // ten minutes of play
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function sanitizeGhosts(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [k, g] of Object.entries(raw)) {
    if (!isPlainObject(g) || typeof g.hash !== 'string' || !Array.isArray(g.rle) || g.rle.length % 2) continue;
    let steps = 0, ok = true;
    for (let i = 0; i < g.rle.length && ok; i += 2) {
      const m = g.rle[i], n = g.rle[i + 1];
      ok = Number.isInteger(m) && m >= 0 && m < 64 && Number.isInteger(n) && n > 0;
      steps += n;
    }
    if (ok && steps <= MAX_GHOST_STEPS) out[k] = { hash: g.hash, rle: g.rle };
  }
  return out;
}

export function sanitizeDeaths(raw) {
  const out = {};
  if (!isPlainObject(raw)) return out;
  for (const [k, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const clean = list.filter((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (clean.length) out[k] = clean.slice(-DEATH_CAP);
  }
  return out;
}

// ---------- death log for the heatmap ----------
export const DEATH_CAP = 300;
export function addDeath(log, levelIndex, x, y) {
  const list = (log[levelIndex] = log[levelIndex] || []);
  list.push([Math.round(x), Math.round(y)]);
  if (list.length > DEATH_CAP) list.splice(0, list.length - DEATH_CAP);
  return log;
}
