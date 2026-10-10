// Progress rules that do not touch the DOM: stars, ghost encoding, death log (cosmetics and the shop live in shop.js).
// Pure functions so tests/progress.mjs can verify them in Node.

// Par times (seconds) for the "fast" star. Derived from the solver's route time per level
// (route * 1.8 + 5, rounded up): beatable after a few attempts, not on a first blind run.
// Levels 1-8 keep their original values so stars players already earned do not disappear.
export const PAR = [20, 24, 29, 26, 25, 23, 31, 31, 31, 30, 36, 33, 38, 32, 38, 36, 38, 57, 43, 53, 56, 43, 39, 51, 47];

// Par times of the Hardcore Pack (src/levels-hardcore.js), same rule: route * 1.8 + 5 from `JSON=1 PACK=hc node tests/solve.mjs`.
// One entry per level in HARDCORE, in order (tests/packs.mjs checks the length).
export const PAR_HC = [16];

// entry = { time, shards, deathless } best values for a level (any may come from different runs); par defaults to the campaign's
export function starsFor(entry, levelIndex, shardTotal, par = PAR) {
  if (!entry) return { fast: false, shards: false, deathless: false, count: 0 };
  const fast = entry.time <= par[levelIndex];
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
  // a twist changes how the same geometry plays; levels without one keep their original hash (and their ghosts)
  const twist = level.twist ? `|${JSON.stringify(level.twist)}` : '';
  const s = `${PHYSICS_VERSION}|${level.w}x${level.h}|${level.startPhase}|${level.pulse || 0}|${level.rows.join('/')}${twist}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
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
