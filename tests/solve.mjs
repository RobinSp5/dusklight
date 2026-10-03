// Best-first search over macro-actions using the real World simulation.
// Proves every level can be finished; reports how many shards lie on reachable states.
import { LEVELS, TILE } from '../src/levels.js';
import { World, STEP, PHYS } from '../src/world.js';

const FRAMES = Number(process.env.FRAMES || 8);
const LIMIT = Number(process.env.LIMIT || 600000);
const SHARD_LIMIT = Number(process.env.SHARD_LIMIT || 200000);
const ONLY = process.env.ONLY ? process.env.ONLY.split(",").map(Number) : null;
const ACTIONS = [];
for (const dir of [-1, 0, 1]) for (const jump of [0, 1]) for (const dash of [0, 1]) for (const swap of [0, 1]) ACTIONS.push({ dir, jump, dash, swap });

function clone(w) {
  const c = Object.create(World.prototype);
  Object.assign(c, w);
  c.player = { ...w.player };
  c.events = [];
  return c;
}

function step(w, a) {
  const c = clone(w);
  for (let f = 0; f < FRAMES; f++) {
    c.update(STEP, {
      left: a.dir < 0, right: a.dir > 0,
      jumpHeld: !!a.jump, jumpPressed: !!a.jump && f === 0,
      dashPressed: !!a.dash && f === 0, swapPressed: !!a.swap && f === 0,
    });
    if (!c.player.alive || c.won) break;
  }
  return c;
}

const key = (w) => {
  const p = w.player;
  return [Math.round(p.x / 5), Math.round(p.y / 5), Math.round(p.vx / 90), Math.round(p.vy / 120), w.phase, p.canDash ? 1 : 0, p.onGround ? 1 : 0].join(',');
};

let failed = 0;
for (const [i, level] of LEVELS.entries()) {
  if (ONLY && !ONLY.includes(i + 1)) continue;
  const start = new World(level, i);
  const goal = start.exit;
  const reach = new Set();
  const h = (w) => Math.abs(w.player.x - goal.x) + Math.abs(w.player.y - goal.y) * 0.5;
  const open = [{ w: start, f: h(start) }];
  const seen = new Set([key(start)]);
  let found = null, n = 0;
  const explored = [start];
  while (open.length && n < LIMIT) {
    // cheap priority queue: pop min
    let bi = 0;
    for (let j = 1; j < open.length; j++) if (open[j].f < open[bi].f) bi = j;
    const { w } = open[bi];
    open[bi] = open[open.length - 1]; open.pop();
    n++;
    for (const a of ACTIONS) {
      const c = step(w, a);
      if (!c.player.alive) continue;
      const p = c.player;
      for (const s of start.shards) if (Math.hypot(s.x - (p.x + PHYS.W / 2), s.y - (p.y + PHYS.H / 2)) < 22) reach.add(s);
      if (c.won) { found = c; break; }
      const k = key(c);
      if (seen.has(k)) continue;
      seen.add(k);
      open.push({ w: c, f: h(c) });
      explored.push(c);
    }
    if (found) break;
  }
  if (process.env.NOSHARDS) { console.log(`${found ? "PASS" : "FAIL"}  Level ${i + 1} ${level.name.padEnd(12)} frames=${FRAMES} expansions=${n}`); if (!found) failed++; continue; }
  // targeted search for every shard the exit-run did not touch
  for (const s of start.shards) {
    if (reach.has(s)) continue;
    const dist = (w) => Math.hypot(s.x - (w.player.x + PHYS.W / 2), s.y - (w.player.y + PHYS.H / 2));
    // seed from the 25 explored states closest to the shard
    const seeds = explored.map((w) => [dist(w), w]).sort((a, b) => a[0] - b[0]).slice(0, 25).map((x) => x[1]);
    const o2 = seeds.map((w) => ({ w, f: dist(w) })), seen2 = new Set(seeds.map(key));
    let m = 0, got = false;
    while (o2.length && m < SHARD_LIMIT && !got) {
      let bi = 0;
      for (let j = 1; j < o2.length; j++) if (o2[j].f < o2[bi].f) bi = j;
      const { w } = o2[bi]; o2[bi] = o2[o2.length - 1]; o2.pop(); m++;
      for (const a of ACTIONS) {
        const c = step(w, a);
        if (!c.player.alive || c.won) continue;
        const p = c.player, d = Math.hypot(s.x - (p.x + PHYS.W / 2), s.y - (p.y + PHYS.H / 2));
        if (d < 22) { got = true; break; }
        const k = key(c); if (seen2.has(k)) continue; seen2.add(k);
        o2.push({ w: c, f: d });
      }
    }
    if (got) reach.add(s); else console.log(`   unreachable shard at tile ${Math.floor(s.x / TILE)},${Math.floor(s.y / TILE)}`);
  }
  const ok = !!found && reach.size === start.shards.length;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  Level ${i + 1} ${level.name.padEnd(12)} expansions=${n} time=${found ? found.time.toFixed(1) + 's' : '-'} shardsTouched=${reach.size}/${start.shards.length}`);
}
process.exit(failed ? 1 : 0);
