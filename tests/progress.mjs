// Stars, ghost encoding (incl. a deterministic replay through the real World), death log.
import { LEVELS } from '../src/levels.js';
import { World, STEP } from '../src/world.js';
import { DEMOS, demoInput } from '../src/demos.js';
import {
  PAR, starsFor, inputToMask, maskToInput, encodeRun, decodeRun, levelHash,
  addDeath, DEATH_CAP, sanitizeGhosts, sanitizeDeaths,
} from '../src/progress.js';

let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`); };

// stars
check('par for every level', PAR.length === LEVELS.length);
const s = starsFor({ time: PAR[2] - 0.1, shards: 8, deathless: true }, 2, 8);
check('three stars', s.count === 3 && s.fast && s.shards && s.deathless);
check('slow + missing shard', starsFor({ time: PAR[2] + 1, shards: 7, deathless: false }, 2, 8).count === 0);
check('no entry', starsFor(undefined, 0, 9).count === 0);

// ghost: record a demo run, encode, decode, replay -> identical end state
for (const d of DEMOS) {
  const a = new World(d.level, 0);
  const masks = [];
  let t = 0;
  while (t < d.duration) { const prev = t; t += STEP; const inp = demoInput(d, prev, t); masks.push(inputToMask(inp)); a.update(STEP, inp); }
  const rle = encodeRun(masks);
  const back = decodeRun(rle);
  const b = new World(d.level, 0);
  for (const m of back) b.update(STEP, maskToInput(m));
  const same = a.player.x === b.player.x && a.player.y === b.player.y && a.phase === b.phase && a.won === b.won;
  check(`ghost replay ${d.id}`, same && back.length === masks.length, `steps=${masks.length} rle=${rle.length}`);
}
check('mask roundtrip', [0, 1, 5, 63].every((m) => inputToMask(maskToInput(m)) === m));
check('level hash stable + distinct', levelHash(LEVELS[0]) === levelHash(LEVELS[0]) && new Set(LEVELS.map(levelHash)).size === LEVELS.length);

// death log cap
const log = {};
for (let i = 0; i < DEATH_CAP + 20; i++) addDeath(log, 1, i, 2);
check('death log capped', log[1].length === DEATH_CAP && log[1][0][0] === 20);

// corrupt storage (review bugs 4 + 5)
check('ghosts: non-object storage', Object.keys(sanitizeGhosts('oops')).length === 0 && Object.keys(sanitizeGhosts([1, 2])).length === 0);
const g = sanitizeGhosts({ 0: { hash: 'a', rle: [1, 5, 0, 3] }, 1: { hash: 'b', rle: null }, 2: { hash: 'c', rle: [1, -4] }, 3: { hash: 'd', rle: [1, 1e9] }, 4: { hash: 'e', rle: [99, 2] }, 5: { rle: [1, 1] }, 6: { hash: 'f', rle: [1] } });
check('ghosts: only well-formed entries survive', Object.keys(g).join() === '0' && decodeRun(g[0].rle).length === 8);
check('deaths: non-object storage', Object.keys(sanitizeDeaths('x')).length === 0);
const d = sanitizeDeaths({ 0: 5, 1: [[1, 2], ['a', 'b'], [3], [4, 5]], 2: [] });
check('deaths: only finite pairs survive', JSON.stringify(d) === JSON.stringify({ 1: [[1, 2], [4, 5]] }));

process.exit(failed ? 1 : 0);
