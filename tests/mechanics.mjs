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

// ---------- phase flip twist (Hardcore 2) ----------
{
  const lv = build({ name: 't', w: 40, h: 10, seed: 1, twist: { id: 'invertedWithPhaseToggle' } }, ({ ground, put }) => { ground(0, 39, 8); put(4, 7, 'P'); });
  const R = { ...idle, right: true }, L = { ...idle, left: true }, SW = { ...idle, swapPressed: true };
  const x0 = new World(lv, 0).player.x;
  const w = new World(lv, 0);
  check('flip: starts inverted (right runs left)', w.tw.inv === 1);
  run(w, 0.3, R);
  check('flip: inverted at the start', w.player.x < x0 - 10);
  w.update(STEP, SW);
  check('flip: one switch turns the controls normal', w.phase === 1 && w.tw.inv === 0);
  const x1 = w.player.x;
  run(w, 0.3, R);
  check('flip: normal in Frost (right runs right)', w.player.x > x1 + 10);
  w.update(STEP, SW);
  check('flip: two switches are inverted again', w.phase === 0 && w.tw.inv === 1);
  const x2 = w.player.x;
  run(w, 0.3, R);
  check('flip: inverted again in Ember', w.player.x < x2 - 10);
  // a denied switch (player inside a wall of the other world) does not flip
  const lv2 = build({ name: 't', w: 20, h: 10, seed: 1, twist: { id: 'invertedWithPhaseToggle' } }, ({ ground, put }) => { ground(0, 19, 8); put(4, 7, 'P'); });
  const d = new World(lv2, 0);
  d.grid[7][4] = 'B';
  d.update(STEP, SW);
  check('flip: a denied switch does not flip the controls', d.phase === 0 && d.tw.inv === 1);
  // clone is independent and the state is part of stateKey
  const a = new World(lv, 0), b = a.clone();
  b.update(STEP, SW);
  check('flip: clone is independent, stateKey sees the flip', a.tw.inv === 1 && b.tw.inv === 0 && a.stateKey() !== b.stateKey());
  const g = new World(lv, 0);
  g.update(STEP, SW); g.update(STEP, SW);
  check('flip: two switches give the same key as none', g.stateKey().endsWith('|t1') && new World(lv, 0).stateKey().endsWith('|t1'));
}

// ---------- twist: dash only (Hardcore 3) ----------
{
  const mk = (twist) => build({ name: 't', w: 60, h: 12, seed: 1, ...(twist ? { twist: { id: 'dashOnlyMovement' } } : {}) }, ({ ground, put }) => { ground(0, 59, 10); put(20, 9, 'P'); put(26, 9, 'd'); });
  const dd = mk(true), plain = mk(false);
  const R = { ...idle, right: true }, L = { ...idle, left: true };
  const dx = (lv, inp, secs = 0.6) => { const w = new World(lv, 0), x = w.player.x; run(w, secs, inp); return w.player.x - x; };
  check('dash only: walking does nothing', Math.abs(dx(dd, R)) < 1e-9 && Math.abs(dx(dd, L)) < 1e-9 && dx(plain, R) > 50);
  const jw = new World(dd, 0);
  run(jw, 0.2);
  jw.update(STEP, { ...idle, jumpPressed: true, jumpHeld: true });
  run(jw, 0.1, { ...idle, jumpHeld: true });
  check('dash only: jump does nothing', jw.player.onGround && Math.abs(jw.player.vy) < 1e-6 && jw.player.y === new World(dd, 0).player.y);
  const aim = (inp, secs = 0.3) => { const w = new World(dd, 0), x = w.player.x; w.update(STEP, { ...inp, dashPressed: true }); run(w, secs, inp); return { w, dx: w.player.x - x }; };
  check('dash only: a dash goes the way it is aimed', aim(R).dx > 60 && aim(L).dx < -60);
  const stay = new World(dd, 0);
  stay.update(STEP, { ...R, dashPressed: true });
  stay.player.canDash = false; stay.player.dashT = 0;
  const vx0 = stay.player.vx;
  run(stay, 0.5, R);
  check('dash only: holding a direction after the dash does not walk on', Math.abs(stay.player.vx) <= Math.abs(vx0) && stay.player.vx === 0);
  const nd = new World(dd, 0);
  nd.update(STEP, { ...idle, dashPressed: true });
  check('dash only: a dash without direction follows the facing', nd.player.dashDir === 1);
  // dash orbs still work: in the air a dash through an orb refills the dash and the chain goes on
  const ow = new World(dd, 0);
  ow.player.x = 24 * T; ow.player.y = 9 * T + 3 - 10; ow.player.onGround = false; ow.player.vy = 0; ow.player.canDash = true;
  ow.update(STEP, { ...R, dashPressed: true });
  let refilled = false;
  for (let t = 0; t < 0.3; t += STEP) { ow.update(STEP, R); if (ow.player.canDash) refilled = true; }
  check('dash only: dash orbs still refill the dash', refilled && ow.orbs[0].cd > 0);
  // the world switch still works
  const sw = new World(dd, 0);
  sw.update(STEP, { ...idle, swapPressed: true });
  check('dash only: the world switch still works', sw.phase === 1);
  // raw input stays untouched (ghosts and the solver replay raw input)
  const raw = Object.freeze({ ...R, jumpPressed: true, dashPressed: true });
  let threw = false;
  try { new World(dd, 0).update(STEP, raw); } catch { threw = true; }
  check('dash only: raw input is left alone', !threw);
  // clone is independent
  const a = new World(dd, 0), b = a.clone();
  a.update(STEP, { ...R, dashPressed: true }); run(a, 0.3, R);
  check('dash only: clone is independent and keeps the rule', b.player.x !== a.player.x && b.twistImpl === a.twistImpl && new World(dd, 0).stateKey() === new World(plain, 0).stateKey());
}

// ---------- the Dash Only level (Hardcore 3) ----------
{
  const lv = HARDCORE.find((l) => l.twist && l.twist.id === 'dashOnlyMovement');
  check('dash level: carries the twist and a unique reward', !!lv && lv.reward && lv.reward.id === 'hc.trail.streak' && lv.reward.slot === 'trail');
  check('dash level: the rule is on a sign in the first section', lv.signs.some((s) => s.x / T < 25 && /\{dash\}/.test(s.text) && /orbs/.test(s.text)));
  const w = new World(lv, 0);
  const sx = Math.floor(w.player.x / T);
  const flat = lv.rows[Math.floor(w.player.y / T) + 1].slice(0, 25).split('').every((c) => c === '#');
  check('dash level: a flat, harmless practice area of at least 20 tiles', sx >= 3 && flat);
  const pw = new World(lv, 0);
  run(pw, 10);
  for (let t = 0; t < 4; t++) run(pw, 0.6, { ...idle, right: t % 2 === 0, left: t % 2 === 1, dashPressed: true });
  check('dash level: standing and dashing in the practice area is safe', pw.player.alive && pw.deaths === 0);
}

// ---------- twist: inverted gravity (Hardcore 4) ----------
{
  // a stone slab hangs from the ceiling (rows 0-2): the floor of this world, the player stands under it
  const mk = (twist) => build({ name: 't', w: 40, h: 14, seed: 1, ...(twist ? { twist: { id: 'invertedGravity' } } : {}) }, ({ fill, put, row }) => {
    fill(0, 0, 39, 2, '#'); put(20, 3, 'P');
    row(26, 29, 8, 'A'); row(30, 33, 8, 'B'); // slabs below the start: tops are the ceiling of this world
  });
  const inv = mk(true), plain = mk(false);
  const R = { ...idle, right: true };
  const w0 = new World(inv, 0);
  check('inverted: the player starts hanging under the slab and is grounded', Math.abs(w0.player.y - 3 * T) < 1e-9 && w0.gs === -1);
  run(w0, 2);
  check('inverted: standing still stays put and alive', w0.player.alive && w0.player.onGround && Math.abs(w0.player.y - 3 * T) < 1e-9);
  // gravity: in free fall (a pit in the slab) the player accelerates upward, not downward
  const pit = build({ name: 't', w: 40, h: 14, seed: 1, twist: { id: 'invertedGravity' } }, ({ fill, put }) => { fill(0, 0, 39, 2, '#'); fill(18, 0, 22, 2, '.'); put(8, 3, 'P'); });
  const fw = new World(pit, 0);
  fw.player.x = 19 * T; fw.player.y = 5 * T; fw.player.onGround = false;
  const y0 = fw.player.y; run(fw, 0.1);
  check('inverted: free fall accelerates upward', fw.player.vy < -100 && fw.player.y < y0);
  const lim = new World(pit, 0); lim.player.x = 19 * T; lim.player.y = 5 * T; lim.player.onGround = false; run(lim, 0.3);
  check('inverted: terminal speed is the same as normal, upward', Math.abs(lim.player.vy) <= PHYS.FALL + 1e-9);
  const out = new World(pit, 0); out.player.x = 19 * T; out.player.y = 5 * T; out.player.onGround = false; run(out, 1.5);
  check('inverted: falling out of the top of the level is a death', out.deaths === 1);
  // landing: the player rises into the underside of a slab and lands on it
  const lw = new World(inv, 0);
  lw.player.y = 6 * T; lw.player.onGround = false; lw.player.vy = 0; run(lw, 0.5);
  check('inverted: lands against the bottom of the slab and is grounded', lw.player.onGround && Math.abs(lw.player.y - 3 * T) < 1e-9 && lw.player.vy === 0);
  // jump pushes down, and the player comes back up
  const jw = new World(inv, 0), jp = new World(plain, 0);
  jw.update(STEP, { ...idle, jumpPressed: true, jumpHeld: true });
  jp.update(STEP, { ...idle, jumpPressed: true, jumpHeld: true });
  check('inverted: a jump pushes down with the normal strength', jw.player.vy > 0 && Math.abs(jw.player.vy + jp.player.vy) < 1e-9);
  let peak = 0, back = false;
  for (let t = 0; t < 2; t += STEP) { jw.update(STEP, { ...idle, jumpHeld: true }); peak = Math.max(peak, jw.player.y - 3 * T); if (peak > 40 && jw.player.onGround) { back = true; break; } }
  check('inverted: the jump arcs down and returns to the ceiling', peak > 80 && peak < 140 && back);
  // a tap is a short hop, as in the normal world
  const tw = new World(inv, 0);
  let tpeak = 0;
  tw.update(STEP, { ...idle, jumpPressed: true, jumpHeld: true });
  for (let t = 0; t < 1; t += STEP) { tw.update(STEP, idle); tpeak = Math.max(tpeak, tw.player.y - 3 * T); }
  check('inverted: jump cut works (a tap is shorter than a held jump)', tpeak < peak - 20);
  const wall = new World(inv, 0);
  run(wall, 3, R);
  check('inverted: running on the ceiling works, the level edge holds', wall.player.alive && wall.player.x + PHYS.W <= 40 * T + 1e-9 && wall.player.onGround);
  // both worlds: Ember slabs (A) hold only in Ember, Frost slabs (B) only in Frost, the landing side is inverted for both
  for (const [phase, c] of [[0, 'A'], [1, 'B']]) {
    const w = new World(inv, 0);
    w.phase = phase;
    w.player.x = (c === 'A' ? 27 : 31) * T; w.player.y = 11 * T; w.player.onGround = false; w.player.vy = 0;
    run(w, 0.45, idle);
    check(`inverted: a ${c === 'A' ? 'Ember' : 'Frost'} slab is solid in its own world (rising into it from below stops under it)`, Math.abs(w.player.y - 9 * T) < 1e-9 && w.player.onGround);
    const o = new World(inv, 0);
    o.phase = 1 - phase;
    o.player.x = (c === 'A' ? 27 : 31) * T; o.player.y = 11 * T; o.player.onGround = false; o.player.vy = 0;
    run(o, 0.45, idle);
    check(`inverted: a ${c === 'A' ? 'Ember' : 'Frost'} slab does not hold in the other world`, o.player.y < 9 * T - 1);
  }
  // a thorn hanging off the slab (v) kills a walker, a thorn on top of a slab (^) kills the player who is pushed down onto it
  const th = build({ name: 't', w: 40, h: 14, seed: 1, twist: { id: 'invertedGravity' } }, ({ fill, put }) => { fill(0, 0, 39, 2, '#'); put(4, 3, 'P'); put(10, 3, 'v'); });
  const tw2 = new World(th, 0); run(tw2, 2, R);
  check('inverted: a thorn that hangs from the slab is a floor thorn and kills a walker', tw2.deaths === 1);
  // dash, checkpoint, spawn
  const cp = build({ name: 't', w: 40, h: 14, seed: 1, twist: { id: 'invertedGravity' } }, ({ fill, put }) => { fill(0, 0, 39, 2, '#'); put(4, 3, 'P'); put(10, 3, 'C'); put(14, 3, 'v'); });
  const cw = new World(cp, 0);
  for (let t = 0; t < 3 && cw.deaths === 0; t += STEP) cw.update(STEP, R);
  check('inverted: a checkpoint is touched on the ceiling, then the thorn kills', cw.checkpoints[0].active && cw.deaths === 1);
  run(cw, 1.2);
  check('inverted: the respawn hangs from the slab again', cw.player.alive && cw.player.onGround && Math.abs(cw.player.y - 3 * T) < 1e-9);
  const dw = new World(inv, 0); dw.update(STEP, { ...R, dashPressed: true }); run(dw, 0.1, R);
  check('inverted: the dash is horizontal and does not fall', dw.player.vx > PHYS.RUN * 0.9 && Math.abs(dw.player.y - 3 * T) < 1e-9);
  // determinism: clone with the same inputs gives the same result, inputs replay identically
  const a = new World(inv, 0); run(a, 0.3, R);
  const b = a.clone();
  run(a, 0.5, { ...R, jumpHeld: true, jumpPressed: true }); run(b, 0.5, { ...R, jumpHeld: true, jumpPressed: true });
  check('inverted: clone replays identically and keeps the gravity', a.player.y === b.player.y && a.stateKey() === b.stateKey() && b.gs === -1 && b.twistImpl === a.twistImpl);
  check('inverted: a level without the twist keeps normal gravity', new World(plain, 0).gs === 1);
  check('inverted: the twist changes the level hash (ghosts of other levels do not apply)', levelHash(inv) !== levelHash(plain));
}

// ---------- the Inverted Gravity level (Hardcore 4) ----------
{
  const lv = HARDCORE.find((l) => l.twist && l.twist.id === 'invertedGravity');
  check('inverted level: carries the twist and a unique reward', !!lv && lv.reward && lv.reward.id === 'hc.hat.flipcrown' && lv.reward.slot === 'hat');
  check('inverted level: the rule is on a sign in the first section', lv.signs.some((s) => s.x / T < 25 && /upward/.test(s.text) && /\{jump\}/.test(s.text)));
  const w = new World(lv, 0);
  const sx = Math.floor(w.player.x / T);
  const sy = Math.round(w.player.y / T);
  const flat = lv.rows[sy - 1].slice(0, 24).split('').every((c) => c === '#') && lv.rows[sy].slice(0, 24).split('').every((c) => c === '.' || c === 'P' || c === 'o' || c === 'C' || c === '#');
  const danger = lv.rows.slice(0, 5).some((r) => /[v^ab]/.test(r.slice(0, 24)));
  check('inverted level: a flat, harmless practice area of at least 20 tiles', sx >= 3 && flat && !danger);
  const pw = new World(lv, 0);
  run(pw, 10);
  for (let t = 0; t < 4; t++) run(pw, 1.2, { ...idle, right: t % 2 === 0, left: t % 2 === 1 });
  check('inverted level: standing and walking in the practice area is safe', pw.player.alive && pw.deaths === 0);
  check('inverted level: no springs and no phase thorns (they cannot hang from the ceiling)', !lv.rows.some((r) => /[Sab=]/.test(r)));
}

process.exit(failed ? 1 : 0);
