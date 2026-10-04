// Fairness audit: finds hanging-spike ('v') spots where a fully held jump (or a spring launch)
// misses or touches the spike hitbox by only a few pixels. Such outcomes are unreadable:
// a good spot is clearly deadly (overlap >= 12 px) or clearly safe (clearance >= 12 px).
// Uses the real World; 'v' contact is measured instead of killing so the full arc is seen.
import { LEVELS, TILE as T } from '../src/levels.js';
import { World, STEP, PHYS } from '../src/world.js';

const NEAR = 11; // |margin| <= NEAR px is a near miss
const MAX_T = 2.5;

class Probe extends World {
  spikeHit(c, ...rest) { return c === 'v' ? false : super.spikeHit(c, ...rest); }
}

// signed vertical distance from the player's spike box top to the closest 'v' hitbox it is under
// (negative = overlap = death in the real game); null when not under any 'v'
function vMargin(w) {
  const p = w.player, bx = p.x + 3, bw = PHYS.W - 6;
  let best = null;
  const x0 = Math.floor(bx / T), x1 = Math.floor((bx + bw) / T);
  for (let tx = x0; tx <= x1; tx++) {
    const X = tx * T + 5;
    if (!(bx < X + T - 10 && bx + bw > X)) continue;
    for (let ty = Math.floor(p.y / T); ty >= 0; ty--) {
      if (w.solid(tx, ty)) break;
      if (w.charAt(tx, ty) !== 'v') continue;
      const m = p.y - (ty * T + T - 14);
      if (best === null || m < best) best = m;
      break;
    }
  }
  return best;
}

// runs one held input until landing / death / timeout; returns min 'v' margin and ceiling bonks.
// apexOnly: only frames of the apex hang (|vy| < 90) count. That is where a held jump lingers and a
// few pixels decide; elsewhere the player crosses a spike edge at speed, a horizontal corner case.
function run(w, inp0, inp, apexOnly) {
  let min = null, bonk = false, left = false;
  for (let t = 0; t < MAX_T; t += STEP) {
    const vyBefore = w.player.vy;
    w.update(STEP, t === 0 ? inp0 : inp);
    const p = w.player;
    if (!p.alive) break;
    if (vyBefore < 0 && p.vy === 0 && !p.onGround) bonk = true;
    if (apexOnly && (p.onGround || Math.abs(p.vy) >= 90)) { if (!p.onGround) left = true; else if (left) break; continue; }
    const m = vMargin(w);
    if (m !== null && (min === null || m < min)) min = m;
    if (!p.onGround) left = true;
    else if (left) break;
  }
  return { min, bonk };
}

const input = (dir, held, pressed) => ({
  left: dir < 0, right: dir > 0, jumpHeld: held, jumpPressed: pressed, dashPressed: false, swapPressed: false,
});

const rows = [];
const info = [];
for (const [li, level] of LEVELS.entries()) {
  const base = new Probe(level, li);
  const phases = level.rows.some((r) => /[ABab]/.test(r)) ? [0, 1] : [0];
  // one row per (level, tile): worst near miss plus every phase/kind that produced a near miss
  const spots = new Map();
  const note = (tile, phase, kind, margin) => {
    if (Math.abs(margin) > NEAR) return;
    const r = spots.get(tile) ?? { level: li + 1, tile, phases: new Set(), kinds: new Set(), margin };
    r.phases.add(phase); r.kinds.add(kind);
    if (Math.abs(margin) < Math.abs(r.margin)) r.margin = margin;
    spots.set(tile, r);
  };

  for (const phase of phases) {
    base.phase = phase;
    // ---- jumps from every standing position with 'v' above ----
    for (let ty = 1; ty < base.h; ty++) {
      for (let tx = 0; tx < base.w; tx++) {
        const land = base.solid(tx, ty, phase) || base.charAt(tx, ty) === '=';
        if (!land || base.solid(tx, ty - 1, phase) || base.charAt(tx, ty - 1) === '=') continue;
        for (let o = -12; o < T; o += 3) {
          const px = tx * T + o, py = ty * T - PHYS.H;
          // column range of the player must have a 'v' above (first non-air tile looking up)
          const cols = [Math.floor((px + 3) / T), Math.floor((px + PHYS.W - 3) / T)];
          const under = cols.some((cx) => {
            for (let y = ty - 1; y >= 0; y--) {
              const c = base.charAt(cx, y);
              if (c === 'v') return true;
              if (base.solid(cx, y, phase)) return false;
            }
            return false;
          });
          if (!under) continue;
          // must be a real standing spot: one idle frame keeps us alive and grounded at the same place
          const chk = new Probe(level, li);
          chk.phase = phase;
          Object.assign(chk.player, { x: px, y: py, vx: 0, vy: 0, onGround: true });
          chk.update(STEP, input(0, false, false));
          if (!chk.player.alive || !chk.player.onGround || Math.abs(chk.player.y - py) > 0.01 || Math.abs(chk.player.x - px) > 0.01) continue;
          for (const dir of [0, -1, 1]) {
            const w = new Probe(level, li);
            w.phase = phase;
            Object.assign(w.player, { x: px, y: py, vx: dir * PHYS.RUN, vy: 0, onGround: true });
            const { min } = run(w, input(dir, true, true), input(dir, true, false), true);
            if (min === null) continue;
            const kind = `${dir === 0 ? 'still' : dir < 0 ? 'runL' : 'runR'}${base.charAt(tx, ty) === '=' ? ' one-way' : ''} jump`;
            note(`${tx},${ty}`, phase, kind, Math.round(min));
          }
        }
      }
    }

    // ---- spring launches ----
    for (const s of base.springs) {
      for (const dir of [0, -1, 1]) for (const held of [true, false]) for (const v0 of [0, 1]) {
        const w = new Probe(level, li);
        w.phase = phase;
        Object.assign(w.player, { x: s.tx * T + (T - PHYS.W) / 2, y: (s.ty + 1) * T - PHYS.H, vx: dir * PHYS.RUN * v0, vy: 0 });
        const { min, bonk } = run(w, input(dir, held, false), input(dir, held, false), false);
        const kind = `spring ${dir === 0 ? 'still' : dir < 0 ? 'L' : 'R'}${v0 && dir ? ' running' : ''} ${held ? 'held' : 'no-hold'}`;
        if (bonk) info.push(`L${li + 1} phase ${phase} spring ${s.tx},${s.ty}: ${kind} bumps a stone ceiling (harmless)`);
        if (min === null) continue;
        note(`${s.tx},${s.ty}`, phase, kind, Math.round(min));
      }
    }
  }
  rows.push(...spots.values());
}

console.log(`near misses under hanging spikes (|margin| <= ${NEAR} px; negative = touches spikes)`);
if (rows.length) {
  console.log('lvl  tile     margin  phase  kinds');
  for (const r of rows) console.log(`${String(r.level).padStart(3)}  ${r.tile.padEnd(8)} ${String(r.margin).padStart(6)}  ${[...r.phases].join('/').padEnd(5)}  ${[...r.kinds].join(', ')}`);
} else console.log('none');
for (const s of new Set(info)) console.log(`info: ${s}`);
console.log(rows.length ? `FAIL ${rows.length} near-miss spot(s)` : 'PASS every hanging-spike encounter is clearly deadly or clearly safe');
process.exit(rows.length ? 1 : 0);
