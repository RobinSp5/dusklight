// Crumbling stone, dash orbs and pulse worlds, each checked in a tiny level with the real World.
import { build, TILE as T } from '../src/levels.js';
import { World, STEP, PHYS } from '../src/world.js';
import { inputToMask, maskToInput, encodeRun, decodeRun, levelHash } from '../src/progress.js';
import { HARDCORE } from '../src/levels-hardcore.js';

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

// ---------- twist: mirror (Hardcore 1) ----------
{
  const mk = (twist) => build({ name: 't', w: 40, h: 10, seed: 1, ...(twist ? { twist: { id: 'mirror' } } : {}) }, ({ ground, put }) => { ground(0, 39, 8); put(20, 7, 'P'); });
  const mirror = mk(true), plain = mk(false);
  const L = { ...idle, left: true }, R = { ...idle, right: true };
  const dx = (lv, inp, s = 0.4) => { const w = new World(lv, 0); const x0 = w.player.x; run(w, s, inp); return w.player.x - x0; };
  check('mirror: right moves left, left moves right', dx(mirror, R) < -50 && dx(mirror, L) > 50);
  check('mirror: without the twist nothing changes', dx(plain, R) > 50 && dx(plain, L) < -50);
  check('mirror: both keys cancel out, as without the twist', Math.abs(dx(mirror, { ...idle, left: true, right: true })) < 1e-9 && Math.abs(dx(plain, { ...idle, left: true, right: true })) < 1e-9);
  check('mirror: same speed in both directions', Math.abs(dx(mirror, R) + dx(plain, R) - 0) < 1e-9 && Math.abs(dx(mirror, R) + dx(mirror, L)) < 1e-9);
  const face = new World(mirror, 0);
  run(face, 0.1, R);
  check('mirror: the player faces the way they actually move', face.player.facing === -1);
  // jump, dash and world switch are not mirrored
  const jw = new World(mirror, 0), jp = new World(plain, 0);
  for (const w of [jw, jp]) { w.update(STEP, { ...idle, jumpHeld: true, jumpPressed: true }); }
  check('mirror: jump is unchanged', jw.player.vy < 0 && jw.player.vy === jp.player.vy);
  const dw = new World(mirror, 0);
  dw.update(STEP, { ...idle, right: true, dashPressed: true });
  check('mirror: a dash goes the way the player moves (right key = left)', dw.player.dashDir === -1 && dw.player.vx < 0);
  const dn = new World(mirror, 0);
  run(dn, 0.1, R); // faces left
  dn.update(STEP, { ...idle, dashPressed: true });
  check('mirror: a dash without direction follows the facing', dn.player.dashDir === -1);
  const sw = new World(mirror, 0);
  sw.update(STEP, { ...idle, swapPressed: true });
  check('mirror: the world switch is unchanged', sw.phase === 1);
  // the input object the caller passes in (the ghost's, the solver's) is never touched
  const raw = Object.freeze({ ...idle, right: true, jumpHeld: true });
  let threw = false;
  try { new World(mirror, 0).update(STEP, raw); } catch { threw = true; }
  check('mirror: raw input is left alone', !threw && raw.right === true && raw.left === false);
  // ghost: raw masks replay to the same run, through encode/decode as stored in localStorage
  const script = (t) => ({ left: t % 300 > 200, right: t % 300 <= 200 && t % 300 > 40, jumpHeld: t % 90 < 30, jumpPressed: t % 90 === 0, dashPressed: t % 170 === 60, swapPressed: t % 130 === 90 });
  const live = new World(mirror, 0), masks = [];
  for (let t = 0; t < 1200; t++) { const inp = script(t); masks.push(inputToMask(inp)); live.update(STEP, inp); }
  const replay = new World(mirror, 0);
  for (const m of decodeRun(encodeRun(masks))) replay.update(STEP, maskToInput(m));
  check('mirror: a ghost of raw inputs replays to the same state', replay.player.x === live.player.x && replay.player.y === live.player.y && replay.stateKey() === live.stateKey() && live.player.x !== new World(mirror, 0).player.x);
  const flat = new World(plain, 0);
  for (let t = 0; t < 1200; t++) flat.update(STEP, script(t));
  check('mirror: the twist really changes the run (ghosts of other levels do not apply)', flat.player.x !== live.player.x && levelHash(mirror) !== levelHash(plain));
  // clone / stateKey: no twist state, so an unchanged key and independent copies
  const c = live.clone();
  run(c, 0.5, R);
  check('mirror: clone is independent and keeps the rule', c.twistImpl === live.twistImpl && c.player.x !== live.player.x && new World(mirror, 0).stateKey() === new World(plain, 0).stateKey());
  const a = new World(mirror, 0), b = a.clone();
  run(a, 0.7, L); run(b, 0.7, L);
  check('mirror: clone with the same inputs, same result', a.player.x === b.player.x && a.stateKey() === b.stateKey());
}

// ---------- the Mirror level (Hardcore 1) ----------
{
  const lv = HARDCORE[0];
  check('mirror level: carries the mirror twist and a unique reward', lv.twist && lv.twist.id === 'mirror' && lv.reward && lv.reward.id === 'hc.body.mirror');
  const w = new World(lv, 0);
  const sx = Math.floor(w.player.x / T);
  check('mirror level: the twist is explained on a sign in the first section', lv.signs.some((s) => s.x / T < 25 && /\{left\}/.test(s.text) && /\{right\}/.test(s.text)));
  // practice area: from the start to the first thorn or pit there is solid ground and nothing deadly
  const rows = lv.rows, firstDanger = (() => {
    for (let x = 0; x < lv.w; x++) {
      if (rows[lv.h - 1][x] !== '#' || [...rows.map((r) => r[x])].some((c) => '^vab'.includes(c))) return x;
    }
    return lv.w;
  })();
  check('mirror level: a harmless practice area of at least 20 tiles around the start', sx >= 3 && firstDanger >= 20, `start ${sx}, first danger at ${firstDanger}`);
  // idle at the start for ten seconds and walk the whole practice area both ways: nobody dies
  const pw = new World(lv, 0);
  run(pw, 10);
  for (let t = 0; t < 4; t++) { run(pw, 1.2, { ...idle, right: t % 2 === 0, left: t % 2 === 1 }); }
  check('mirror level: standing and walking in the practice area is safe', pw.player.alive && pw.deaths === 0);
}

process.exit(failed ? 1 : 0);
