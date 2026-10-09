// Level packs: the campaign (LEVELS) and the Hardcore Pack (HARDCORE) are separate worlds of progress.
// Each pack owns its storage keys, par times, stars, best times, ghosts and death map. The Hardcore Pack never reads or writes the
// campaign's keys and pays nothing into the shop. No DOM here, so tests/packs.mjs can verify all of it in Node.
import { LEVELS, ACTS } from './levels.js';
import { HARDCORE } from './levels-hardcore.js';
import { PAR, PAR_HC, starsFor, sanitizeGhosts, sanitizeDeaths } from './progress.js';
import { SLOTS } from './shop.js';

export const PACKS = {
  main: {
    id: 'main', name: 'Campaign', levels: LEVELS, acts: ACTS, par: PAR,
    // the save key is kept from the first release (renamed game, same progress)
    keys: { save: 'zwielicht.save.v1', ghosts: 'dusklight.ghosts.v1', deaths: 'dusklight.deaths.v1' },
  },
  hc: {
    id: 'hc', name: 'Hardcore Pack', levels: HARDCORE, acts: [], par: PAR_HC,
    keys: { save: 'dusklight.hc.save.v1', ghosts: 'dusklight.hc.ghosts.v1', deaths: 'dusklight.hc.deaths.v1' },
  },
};
export const PACK_LIST = [PACKS.main, PACKS.hc];

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const copy = (v) => JSON.parse(JSON.stringify(v));

// ---------- rewards: one unique cosmetic per level, stored in the pack's own save ----------
// Every level may carry `reward: { id, slot, name, desc, style }` (see levels-hardcore.js).
export function rewardsOf(pack) {
  return pack.levels.flatMap((lv, level) => (lv.reward ? [{ ...lv.reward, level }] : []));
}
export const rewardForLevel = (pack, i) => (pack.levels[i] && pack.levels[i].reward ? { ...pack.levels[i].reward, level: i } : null);

// ---------- Hardcore save: { unlocked, best: { [level]: { time, shards, deathless } }, rewards: [id], equip: { [slot]: id } } ----------
export const newHc = () => ({ unlocked: 0, best: {}, rewards: [], equip: {} });

// Stored data comes from localStorage and may be corrupt: keep only well-formed entries.
export function sanitizeHc(raw, pack = PACKS.hc) {
  const out = newHc();
  if (!isPlainObject(raw)) return out;
  const n = pack.levels.length;
  if (isPlainObject(raw.best)) {
    for (const [k, e] of Object.entries(raw.best)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i >= n || !isPlainObject(e) || !Number.isFinite(e.time) || !Number.isFinite(e.shards)) continue;
      out.best[i] = { time: e.time, shards: e.shards, deathless: !!e.deathless };
    }
  }
  // a level counts as unlocked when the one before it was cleared; the pack's first level is always open
  const cleared = Object.keys(out.best).map((k) => Math.min(Number(k) + 1, n - 1));
  const stored = Number.isInteger(raw.unlocked) ? raw.unlocked : 0;
  out.unlocked = Math.max(0, Math.min(Math.max(stored, ...cleared), n - 1));
  const known = new Map(rewardsOf(pack).map((r) => [r.id, r]));
  if (Array.isArray(raw.rewards)) out.rewards = [...new Set(raw.rewards.filter((id) => typeof id === 'string' && known.has(id)))];
  if (isPlainObject(raw.equip)) {
    for (const [slot, id] of Object.entries(raw.equip)) {
      if (SLOTS.includes(slot) && out.rewards.includes(id) && known.get(id).slot === slot) out.equip[slot] = id;
    }
  }
  return out;
}

// read(key) -> parsed JSON or null. Only this pack's three keys are ever asked for.
export function loadPack(read, pack = PACKS.hc) {
  return {
    prog: sanitizeHc(read(pack.keys.save), pack),
    ghosts: sanitizeGhosts(read(pack.keys.ghosts)),
    deaths: sanitizeDeaths(read(pack.keys.deaths)),
  };
}

// A finished run. run = { time, shards, deaths }. Returns the new save (the input is not touched), whether it is a best time,
// the previous best, and the reward if this clear earned it for the first time.
export function recordClear(prog, pack, i, run) {
  const out = copy(prog);
  const prev = prog.best[i];
  const isBest = !prev || run.time < prev.time;
  out.best[i] = {
    time: isBest ? run.time : prev.time,
    shards: Math.max(prev ? prev.shards : 0, run.shards),
    deathless: (prev && prev.deathless) || run.deaths === 0,
  };
  out.unlocked = Math.max(prog.unlocked, Math.min(i + 1, pack.levels.length - 1));
  const reward = rewardForLevel(pack, i);
  const earned = !!reward && !prog.rewards.includes(reward.id);
  if (earned) out.rewards = [...prog.rewards, reward.id];
  return { prog: out, prev, isBest, reward, earned };
}

// Wear or take off an earned reward (one per slot). Unknown or unearned ids change nothing.
export function toggleEquip(prog, pack, id) {
  const r = rewardsOf(pack).find((x) => x.id === id);
  if (!r || !prog.rewards.includes(id)) return prog;
  const out = copy(prog);
  if (out.equip[r.slot] === id) delete out.equip[r.slot];
  else out.equip[r.slot] = id;
  return out;
}

// { slot: style } of the worn rewards, for lookFor(equip, overrides) in shop.js.
export function rewardStyles(prog, pack = PACKS.hc) {
  const out = {};
  for (const r of rewardsOf(pack)) if (prog.equip[r.slot] === r.id) out[r.slot] = r.style;
  return out;
}

export const packStars = (pack, prog) => pack.levels.reduce((s, lv, i) => s + starsFor(prog.best[i], i, lv.rows.join('').split('o').length - 1, pack.par).count, 0);
