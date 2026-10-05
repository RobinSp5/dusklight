// Crumbling stone, dash orbs and pulse worlds, each checked in a tiny level with the real World.
import { build, TILE as T } from '../src/levels.js';
import { World, STEP, PHYS } from '../src/world.js';

let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`); };
const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false, dashPressed: false, swapPressed: false };
const run = (w, seconds, inp = idle) => { for (let t = 0; t < seconds - 1e-9; t += STEP) w.update(STEP, inp); };

// ---------- crumbling stone ----------
{
  const lv = build({ name: 't', w: 12, h: 10, seed: 1 }, ({ row, put }) => { row(4, 6, 6, 'x'); put(5, 5, 'P'); });
  const w = new World(lv, 0);
  run(w, 0.05);
  const standing = w.player.onGround && w.activeCrumbles.size > 0;
  run(w, PHYS.CRUMBLE_DELAY - 0.1);
  const stillUp = w.player.y < 6 * T;
  run(w, 0.2);
  const falling = w.player.vy > 0 && !w.player.onGround;
  check('crumble: holds the player for the delay, then breaks', standing && stillUp && falling);
  const w2 = new World(lv, 0);
  run(w2, 0.05);
  w2.player.x = 1 * T; w2.player.y = 0; // step aside so the stone may come back
  run(w2, PHYS.CRUMBLE_DELAY + PHYS.CRUMBLE_BACK + 0.2);
  check('crumble: comes back after its timer', w2.activeCrumbles.size === 0 && w2.solid(5, 6));
  const w3 = new World(lv, 0);
  run(w3, PHYS.CRUMBLE_DELAY + 0.1);
  // park the player inside the gap of the broken stone: it must not reappear inside them
  w3.player.x = 5 * T + 7; w3.player.y = 6 * T; w3.player.vy = 0;
  const p0 = { ...w3.player };
  for (let t = 0; t < PHYS.CRUMBLE_BACK + 0.3; t += STEP) { w3.player.x = p0.x; w3.player.y = p0.y; w3.player.vy = 0; w3.update(STEP, idle); }
  check('crumble: never reappears inside the player', !w3.solid(5, 6));
}

// ---------- dash orb ----------
{
  const lv = build({ name: 't', w: 30, h: 10, seed: 1 }, ({ ground, put }) => { ground(0, 3, 8); put(1, 7, 'P'); put(9, 5, 'd'); });
  const w = new World(lv, 0);
  w.player.x = 6 * T; w.player.y = 5 * T - 10; w.player.onGround = false; w.player.canDash = false;
  w.player.vy = 0;
  // dash right through the orb
  w.player.canDash = true;
  w.update(STEP, { ...idle, right: true, dashPressed: true });
  const usedDash = !w.player.canDash;
  let refilled = false;
  for (let t = 0; t < 0.3; t += STEP) { w.update(STEP, { ...idle, right: true }); if (w.player.canDash) refilled = true; }
  check('orb: refills the dash in mid-air', usedDash && refilled && w.orbs[0].cd > 0);
  const w2 = new World(lv, 0);
  w2.player.x = 9 * T + 7; w2.player.y = 5 * T; w2.player.canDash = true;
  w2.update(STEP, idle);
  check('orb: not used up when the dash is already charged', w2.orbs[0].cd === 0);
  const w4 = new World(build({ name: 't', w: 20, h: 10, seed: 1 }, ({ ground, put }) => { ground(0, 19, 8); put(2, 7, 'P'); put(4, 7, 'd'); }), 0);
  for (let t = 0; t < 0.3; t += STEP) w4.update(STEP, { ...idle, right: true, dashPressed: t === 0 });
  check('orb: a ground dash does not use it up (review)', w4.orbs[0].cd === 0);
}

// ---------- pulse worlds ----------
{
  const lv = build({ name: 't', w: 16, h: 10, seed: 1, pulse: 1.5 }, ({ ground, put, row }) => { ground(0, 15, 8); put(2, 7, 'P'); row(8, 9, 6, 'B'); });
  const w = new World(lv, 0);
  run(w, 1.4);
  const before = w.phase;
  run(w, 0.2);
  check('pulse: world flips on the beat', before === 0 && w.phase === 1);
  w.update(STEP, { ...idle, swapPressed: true });
  check('pulse: manual switching is disabled', w.phase === 1 && w.events.some((e) => e.type === 'deny'));
  // stand where a Frost block appears, in Ember, just before the flip -> crushed
  const w3 = new World(lv, 0);
  run(w3, 1.0);
  w3.player.x = 8 * T + 4; w3.player.y = 6 * T; w3.player.vy = 0;
  let crushed = false;
  for (let t = 0; t < 0.6; t += STEP) { w3.player.x = 8 * T + 4; w3.player.y = 6 * T; w3.player.vy = 0; w3.update(STEP, idle); if (!w3.player.alive) crushed = true; }
  check('pulse: a block that appears around the player crushes them', crushed);
  const warn = new World(lv, 0);
  let warned = false;
  for (let t = 0; t < 1.5; t += STEP) { warn.update(STEP, idle); if (warn.events.some((e) => e.type === 'pulseWarn')) warned = true; warn.events.length = 0; }
  check('pulse: warning fires before the flip', warned);
}

// ---------- clone independence + determinism ----------
{
  const lv = build({ name: 't', w: 20, h: 10, seed: 1, pulse: 1.2 }, ({ ground, row, put }) => { ground(0, 19, 8); row(5, 7, 7, 'x'); put(6, 6, 'P'); put(12, 6, 'd'); });
  const a = new World(lv, 0);
  run(a, 0.2);
  const b = a.clone();
  run(a, 1.0, { ...idle, right: true });
  const untouched = b.player.x !== a.player.x && b.crumbles.get(7 * 20 + 6).state !== a.crumbles.get(7 * 20 + 6).state;
  run(b, 1.0, { ...idle, right: true });
  check('clone: independent copies', untouched);
  check('clone: same inputs, same result', a.player.x === b.player.x && a.player.y === b.player.y && a.phase === b.phase && a.stateKey() === b.stateKey());
}

process.exit(failed ? 1 : 0);
