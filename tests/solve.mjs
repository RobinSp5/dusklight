// Proves every level can be finished and every shard reached, using the real World simulation.
// Best-first search over 8-frame macro actions, split into segments between checkpoints
// (with backtracking over several arrival states per segment), then a targeted search per shard.
//   ONLY=9,10 node tests/solve.mjs     solve selected levels (numbers within the chosen packs)
//   PACK=hc node tests/solve.mjs       solve one pack (main = campaign, hc = Hardcore Pack); default: all packs,
//                                      or only the campaign when ONLY is given without PACK
//   JSON=1 ...                          also print machine-readable results (route seconds for par times)
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { PACKS, PACK_LIST } from '../src/packs.js';
import { World, STEP, PHYS } from '../src/world.js';

const FRAMES = Number(process.env.FRAMES || 8);
const SEG_LIMIT = Number(process.env.LIMIT || 250000);
const BRANCH = 6; // arrival states kept per segment for backtracking
const SHARD_SEEDS = 3;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const PACK_IDS = process.env.PACK ? process.env.PACK.split(',') : ONLY ? ['main'] : PACK_LIST.map((p) => p.id);
// one job per level of every chosen pack; `n` is the level number within its pack
const JOBS = PACK_LIST.filter((p) => PACK_IDS.includes(p.id)).flatMap((p) => p.levels.map((level, i) => ({ pack: p, level, i, n: i + 1 })))
  .filter((j) => !ONLY || ONLY.includes(j.n));
const tag = (j) => (j.pack.id === 'main' ? '' : `${j.pack.id.toUpperCase()} `);

const ACTIONS = [];
for (const dir of [1, -1, 0]) for (const jump of [0, 1]) for (const dash of [0, 1]) for (const swap of [0, 1]) ACTIONS.push({ dir, jump, dash, swap });
const inputFor = (a, f) => ({
  left: a.dir < 0, right: a.dir > 0, jumpHeld: !!a.jump, jumpPressed: !!a.jump && f === 0,
  dashPressed: !!a.dash && f === 0, swapPressed: !!a.swap && f === 0,
});

function step(w, a) {
  const c = w.clone();
  for (let f = 0; f < FRAMES; f++) {
    c.update(STEP, inputFor(a, f));
    if (!c.player.alive || c.won) break;
  }
  return c;
}

// minimal binary heap keyed by f
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const center = (w) => ({ x: w.player.x + PHYS.W / 2, y: w.player.y + PHYS.H / 2 });

// Lazily yields up to BRANCH distinct states that satisfy `done`, searching from `start`.
// The search only continues past the first arrival if the caller asks for another one.
function* search(start, goal, done, explored, stats, deathOk = false) {
  const open = new Heap();
  const seen = new Set([start.stateKey()]);
  const h = (w) => { const c = center(w); return Math.abs(c.x - goal.x) + Math.abs(c.y - goal.y) * 0.5; };
  open.push({ w: start, f: h(start) });
  let found = 0, n = 0;
  while (open.size && n < SEG_LIMIT && found < BRANCH) {
    const { w } = open.pop();
    n++;
    stats.n++;
    for (const a of ACTIONS) {
      const c = step(w, a);
      if (!c.player.alive) {
        if (deathOk) { found++; yield c; } // dying respawns at the last checkpoint with the shard kept
        continue;
      }
      if (done(c)) { found++; yield c; continue; } // goal test before the visited check: reaching it changes no key
      const k = c.stateKey();
      if (seen.has(k)) continue;
      seen.add(k);
      if (explored && (seen.size & 3) === 0) explored.push(c);
      open.push({ w: c, f: h(c) });
    }
  }
}

function solveLevel(level, index) {
  const start = new World(level, index);
  const cps = start.checkpoints.map((c, i) => ({ ...c, i })).sort((a, b) => a.x - b.x);
  const goals = [
    ...cps.map((c) => ({ x: c.x, y: c.y - 20, done: (w) => w.checkpoints[c.i].active })),
    { x: start.exit.x, y: start.exit.y - 18, done: (w) => w.won },
  ];
  const explored = [start];
  const stats = { n: 0 };
  // depth-first over segments, breadth limited to BRANCH arrival states each
  function solveFrom(w, gi) {
    const g = goals[gi];
    for (const a of search(w, g, g.done, explored, stats)) {
      const end = gi === goals.length - 1 ? a : solveFrom(a, gi + 1);
      if (end) return end;
    }
    return null;
  }
  const end = solveFrom(start, 0);

  // shards: targeted search seeded from the explored states closest to each shard. A shard only
  // counts if the run can go on afterwards: reach the next save point / exit, or die and respawn
  // (the shard is kept). This rules out shards in dead ends that would soft-lock the "all shards" star.
  const reached = [];
  const goOn = (w) => {
    const gi = goals.findIndex((g) => !g.done(w));
    if (gi < 0) return true;
    return !search(w, goals[gi], goals[gi].done, null, stats, true).next().done;
  };
  for (const s of start.shards) {
    const dist = (w) => Math.hypot(s.x - center(w).x, s.y - center(w).y);
    const idx = start.shards.indexOf(s);
    const seeds = explored.map((w) => [dist(w), w]).sort((a, b) => a[0] - b[0]).slice(0, SHARD_SEEDS).map((x) => x[1]);
    let got = false;
    for (const seed of seeds) {
      if (got) break;
      const taken = seed.shards[idx].taken ? [seed] : search(seed, s, (w) => w.shards[idx].taken, null, stats);
      for (const at of taken) { if (goOn(at)) { got = true; break; } }
    }
    if (got) reached.push(s);
  }
  return {
    finished: !!end,
    seconds: end ? end.time : null,
    expansions: stats.n,
    shards: reached.length,
    total: start.shards.length,
    missing: start.shards.filter((s) => !reached.includes(s)).map((s) => [Math.floor(s.x / 32), Math.floor(s.y / 32)]),
  };
}

function report(j, r, ms) {
  const ok = r.finished && r.shards === r.total;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${tag(j)}Level ${String(j.n).padStart(2)} ${j.level.name.padEnd(16)} route=${r.seconds ? r.seconds.toFixed(1) + 's' : '-'} shards=${r.shards}/${r.total} expansions=${r.expansions} (${(ms / 1000).toFixed(0)}s)`);
  if (!r.finished) console.log('        no route to the exit');
  for (const [x, y] of r.missing) console.log(`        unreachable shard at tile ${x},${y}`);
  return ok;
}

if (process.env.SOLVE_WORKER) {
  // child process: solve one level (SOLVE_WORKER = index, SOLVE_PACK = pack id), send the result to the parent
  const i = Number(process.env.SOLVE_WORKER);
  const t0 = Date.now();
  process.send({ i, r: solveLevel(PACKS[process.env.SOLVE_PACK].levels[i], i), ms: Date.now() - t0 }, () => process.exit(0));
} else {
  // parent: one child process per level, as many at once as there are CPU cores
  const results = new Array(JOBS.length);
  const queue = JOBS.map((j, k) => k);
  let running = 0, failed = 0;
  await new Promise((resolve) => {
    const next = () => {
      if (!queue.length && !running) return resolve();
      while (running < Math.max(1, availableParallelism() - 1) && queue.length) {
        const k = queue.shift();
        const j = JOBS[k];
        running++;
        const child = fork(new URL(import.meta.url).pathname, [], { env: { ...process.env, SOLVE_WORKER: String(j.i), SOLVE_PACK: j.pack.id }, execArgv: ['--max-old-space-size=6000'] });
        child.on('message', (m) => { results[k] = m; });
        child.on('close', () => {
          running--;
          const m = results[k];
          if (!m) { failed++; console.log(`FAIL  ${tag(j)}Level ${j.n} worker crashed`); } else if (!report(j, m.r, m.ms)) failed++;
          next();
        });
      }
    };
    next();
  });
  if (process.env.JSON) console.log(JSON.stringify(results.map((m, k) => m && ({ pack: JOBS[k].pack.id, level: m.i + 1, name: JOBS[k].level.name, ...m.r })).filter(Boolean)));
  process.exit(failed ? 1 : 0);
}
