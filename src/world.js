// Pure simulation: no DOM, no rendering. Runs at a fixed timestep.
import { TILE as T } from './levels.js';

export const STEP = 1 / 120;

export const PHYS = {
  W: 18, H: 26,
  RUN: 250,
  ACC_G: 2600, ACC_A: 1700, DEC_G: 3000, DEC_A: 1000,
  G: 2100, FALL: 880, CUT: 2.6, APEX: 0.55,
  JUMP: 700, COYOTE: 0.1, BUFFER: 0.12,
  DASH: 640, DASH_T: 0.14,
  SPRING: 1150,
  CRUMBLE_DELAY: 0.45, // crumbling stone breaks this long after it is stepped on
  CRUMBLE_BACK: 2.4, // ...and comes back after this long
  ORB_CD: 2.5, // dash orb recharge time
  PULSE_WARN: 0.4, // pulse levels: warning window before the world flips
};

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

export class World {
  constructor(level, index = 0) {
    this.level = level;
    this.index = index;
    this.w = level.w;
    this.h = level.h;
    this.grid = level.rows.map((r) => r.split(''));
    this.shards = [];
    this.checkpoints = [];
    this.springs = [];
    this.orbs = [];
    this.crumbles = new Map(); // tile index -> { state: 0 solid | 1 shaking | 2 gone, t }
    this.activeCrumbles = new Set();
    this.exit = null;
    let start = { x: 2, y: 2 };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.grid[y][x];
        if (c === 'P') start = { x, y };
        else if (c === 'o') this.shards.push({ x: x * T + T / 2, y: y * T + T / 2, taken: false, seed: x * 1.7 + y });
        else if (c === 'C') this.checkpoints.push({ x: x * T + T / 2, y: (y + 1) * T, active: false });
        else if (c === 'E') this.exit = { x: x * T + T / 2, y: (y + 1) * T };
        else if (c === 'S') this.springs.push({ tx: x, ty: y, anim: 0 });
        else if (c === 'd') this.orbs.push({ i: this.orbs.length, x: x * T + T / 2, y: y * T + T / 2, cd: 0 });
        else if (c === 'x') { this.crumbles.set(y * this.w + x, { tx: x, ty: y, state: 0, t: 0 }); continue; }
        else continue;
        this.grid[y][x] = '.';
      }
    }
    this.spawn = { x: start.x * T + (T - PHYS.W) / 2, y: (start.y + 1) * T - PHYS.H, phase: level.startPhase };
    this.phase = this.spawn.phase;
    this.pulse = level.pulse || 0; // seconds per world in pulse levels (0 = player switches manually)
    this.clock = 0; // keeps running while the player is dead, drives pulse levels
    this.pulseWarned = false;
    this.events = [];
    this.time = 0;
    this.deaths = 0;
    this.collected = 0;
    this.won = false;
    this.player = this.makePlayer();
  }

  makePlayer() {
    return {
      x: this.spawn.x, y: this.spawn.y, vx: 0, vy: 0,
      onGround: true, coyote: 0, buffer: 0,
      canDash: true, dashT: 0, dashDir: 1, facing: 1,
      alive: true, deadT: 0,
    };
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  charAt(tx, ty) {
    if (ty < 0 || ty >= this.h || tx < 0 || tx >= this.w) return '.';
    return this.grid[ty][tx];
  }

  solid(tx, ty, phase = this.phase) {
    if (tx < 0 || tx >= this.w) return true;
    const c = this.charAt(tx, ty);
    if (c === 'x') return this.crumbles.get(ty * this.w + tx).state !== 2;
    return c === '#' || (c === 'A' && phase === 0) || (c === 'B' && phase === 1);
  }

  // Independent copy for search/replay: the grid is shared (never mutated), all live state is copied.
  clone() {
    const c = Object.create(World.prototype);
    Object.assign(c, this);
    c.player = { ...this.player };
    c.spawn = { ...this.spawn };
    c.events = [];
    c.crumbles = new Map([...this.crumbles].map(([k, v]) => [k, { ...v }]));
    c.activeCrumbles = new Set(this.activeCrumbles);
    c.orbs = this.orbs.map((o) => ({ ...o }));
    c.shards = this.shards.map((o) => ({ ...o }));
    c.checkpoints = this.checkpoints.map((o) => ({ ...o }));
    c.springs = this.springs.map((o) => ({ ...o }));
    return c;
  }

  // Quantised state for the solver's visited set: position/velocity buckets plus every piece of
  // time-dependent world state that can change what happens next.
  stateKey() {
    const p = this.player;
    let k = `${Math.round(p.x / 5)},${Math.round(p.y / 5)},${Math.round(p.vx / 90)},${Math.round(p.vy / 120)},${this.phase},${p.canDash ? 1 : 0},${p.onGround ? 1 : 0}`;
    if (this.pulse) k += `|${Math.floor((this.clock % (2 * this.pulse)) / 0.1)}`;
    if (this.activeCrumbles.size) {
      k += `|${[...this.activeCrumbles].sort((a, b) => a - b).map((i) => { const c = this.crumbles.get(i); return `${i}:${c.state}:${Math.round(c.t * 5)}`; }).join(';')}`;
    }
    for (const o of this.orbs) if (o.cd > 0) k += `|o${o.i}:${Math.round(o.cd * 5)}`;
    return k;
  }

  // Seconds until the next automatic flip (pulse levels only).
  get pulseLeft() { return this.pulse ? this.pulse - (this.clock % this.pulse) : Infinity; }

  tickWorld(dt) {
    for (const i of this.activeCrumbles) {
      const c = this.crumbles.get(i);
      c.t -= dt;
      if (c.t > 0) continue;
      if (c.state === 1) {
        c.state = 2;
        c.t = PHYS.CRUMBLE_BACK;
        this.emit('crumbleFall', { x: c.tx * T + T / 2, y: c.ty * T + T / 2 });
      } else if (this.player.alive && overlap(this.player.x, this.player.y, PHYS.W, PHYS.H, c.tx * T, c.ty * T, T, T)) {
        c.t = 0.1; // never reappear inside the player
      } else {
        c.state = 0;
        this.activeCrumbles.delete(i);
        this.emit('crumbleBack', { x: c.tx * T + T / 2, y: c.ty * T + T / 2 });
      }
    }
    for (const o of this.orbs) if (o.cd > 0) o.cd = Math.max(0, o.cd - dt);
    if (!this.pulse) return;
    const want = (Math.floor(this.clock / this.pulse) % 2) ^ this.level.startPhase;
    if (!this.pulseWarned && this.pulseLeft <= PHYS.PULSE_WARN) {
      this.pulseWarned = true;
      this.emit('pulseWarn', { phase: 1 - this.phase });
    }
    if (want !== this.phase) {
      this.pulseWarned = false;
      this.phase = want;
      const p = this.player;
      this.emit('swap', { x: p.x + PHYS.W / 2, y: p.y + PHYS.H / 2, phase: want, pulse: true });
      if (p.alive && this.overlapsPhase(want)) this.kill(); // the world closed around the player
    }
  }

  update(dt, inp) {
    const p = this.player;
    for (const s of this.springs) s.anim = Math.max(0, s.anim - dt);
    if (this.won) return;
    this.clock += dt;
    this.tickWorld(dt);
    if (!p.alive) {
      p.deadT -= dt;
      if (p.deadT <= 0) this.respawn();
      return;
    }
    this.time += dt;

    if (inp.swapPressed) this.trySwap();

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) p.facing = dir;

    p.buffer = inp.jumpPressed ? PHYS.BUFFER : Math.max(0, p.buffer - dt);
    p.coyote = p.onGround ? PHYS.COYOTE : Math.max(0, p.coyote - dt);
    if (p.onGround && p.dashT <= 0) p.canDash = true;

    if (inp.dashPressed && p.canDash && p.dashT <= 0) {
      p.dashT = PHYS.DASH_T;
      p.dashDir = dir || p.facing;
      p.canDash = false;
      this.emit('dash', { x: p.x + PHYS.W / 2, y: p.y + PHYS.H / 2, dir: p.dashDir });
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDir * PHYS.DASH;
      p.vy = 0;
      if (p.dashT <= 0) p.vx = p.dashDir * PHYS.RUN;
    } else {
      const target = dir * PHYS.RUN;
      const accel = dir
        ? (p.onGround ? PHYS.ACC_G : PHYS.ACC_A)
        : (p.onGround ? PHYS.DEC_G : PHYS.DEC_A);
      p.vx = approach(p.vx, target, accel * dt);
      let g = PHYS.G;
      if (p.vy < 0 && !inp.jumpHeld) g *= PHYS.CUT;
      else if (Math.abs(p.vy) < 90 && inp.jumpHeld) g *= PHYS.APEX;
      p.vy = Math.min(p.vy + g * dt, PHYS.FALL);
    }

    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PHYS.JUMP;
      p.buffer = 0;
      p.coyote = 0;
      p.onGround = false;
      p.dashT = 0; // dash-jump keeps horizontal momentum
      this.emit('jump', { x: p.x + PHYS.W / 2, y: p.y + PHYS.H });
    }

    this.moveX(p, p.vx * dt);
    const wasGround = p.onGround;
    const impact = p.vy;
    this.moveY(p, p.vy * dt);
    if (!wasGround && p.onGround) this.emit('land', { x: p.x + PHYS.W / 2, y: p.y + PHYS.H, v: impact });
    if (p.onGround && this.crumbles.size) this.stepOnCrumbles(p);

    this.interact(p);
    if (p.y > this.h * T + 96) this.kill();
  }

  moveX(p, dx) {
    if (!dx) return;
    p.x += dx;
    const top = Math.floor(p.y / T);
    const bot = Math.floor((p.y + PHYS.H - 0.01) / T);
    if (dx > 0) {
      const tx = Math.floor((p.x + PHYS.W - 0.01) / T);
      for (let ty = top; ty <= bot; ty++) if (this.solid(tx, ty)) { p.x = tx * T - PHYS.W; p.vx = 0; break; }
    } else {
      const tx = Math.floor(p.x / T);
      for (let ty = top; ty <= bot; ty++) if (this.solid(tx, ty)) { p.x = (tx + 1) * T; p.vx = 0; break; }
    }
  }

  moveY(p, dy) {
    p.onGround = false;
    const prevBottom = p.y + PHYS.H;
    p.y += dy;
    const l = Math.floor(p.x / T);
    const r = Math.floor((p.x + PHYS.W - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor((p.y + PHYS.H - 0.01) / T);
      for (let tx = l; tx <= r; tx++) {
        const oneWay = this.charAt(tx, ty) === '=' && prevBottom <= ty * T + 0.5;
        if (this.solid(tx, ty) || oneWay) { p.y = ty * T - PHYS.H; p.vy = 0; p.onGround = true; break; }
      }
    } else if (dy < 0) {
      const ty = Math.floor(p.y / T);
      for (let tx = l; tx <= r; tx++) {
        if (this.solid(tx, ty)) { p.y = (ty + 1) * T; p.vy = 0; break; }
      }
    }
    // ground probe: keeps onGround true while standing still or dashing
    if (!p.onGround && p.vy >= 0) {
      const feet = p.y + PHYS.H;
      const ty = Math.floor((feet + 0.5) / T);
      if (Math.abs(feet - ty * T) < 0.6) {
        for (let tx = l; tx <= r; tx++) {
          if (this.solid(tx, ty) || this.charAt(tx, ty) === '=') { p.onGround = true; break; }
        }
      }
    }
  }

  stepOnCrumbles(p) {
    const ty = Math.floor((p.y + PHYS.H + 0.5) / T);
    const l = Math.floor(p.x / T), r = Math.floor((p.x + PHYS.W - 0.01) / T);
    for (let tx = l; tx <= r; tx++) {
      if (this.charAt(tx, ty) !== 'x') continue;
      const i = ty * this.w + tx;
      const c = this.crumbles.get(i);
      if (c.state !== 0) continue;
      c.state = 1;
      c.t = PHYS.CRUMBLE_DELAY;
      this.activeCrumbles.add(i);
      this.emit('crumble', { x: tx * T + T / 2, y: ty * T + T / 2 });
    }
  }

  overlapsPhase(phase) {
    const p = this.player;
    const ch = phase === 0 ? 'A' : 'B';
    const x0 = Math.floor((p.x + 0.01) / T), x1 = Math.floor((p.x + PHYS.W - 0.01) / T);
    const y0 = Math.floor((p.y + 0.01) / T), y1 = Math.floor((p.y + PHYS.H - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.charAt(tx, ty) === ch) return true;
    return false;
  }

  trySwap() {
    const p = this.player;
    if (this.pulse) { this.emit('deny', { x: p.x + PHYS.W / 2, y: p.y + PHYS.H / 2 }); return false; } // the beat decides
    const next = 1 - this.phase;
    const cx = p.x + PHYS.W / 2, cy = p.y + PHYS.H / 2;
    if (this.overlapsPhase(next)) { this.emit('deny', { x: cx, y: cy }); return false; }
    this.phase = next;
    this.emit('swap', { x: cx, y: cy, phase: next });
    return true;
  }

  interact(p) {
    const px = p.x, py = p.y, pw = PHYS.W, ph = PHYS.H;
    const cx = px + pw / 2, cy = py + ph / 2;

    for (const s of this.springs) {
      if (p.vy >= 0 && overlap(px, py, pw, ph, s.tx * T + 4, s.ty * T + 18, T - 8, T - 18)) {
        p.vy = -PHYS.SPRING;
        p.dashT = 0;
        p.canDash = true;
        p.onGround = false;
        p.coyote = 0;
        s.anim = 0.3;
        this.emit('spring', { x: s.tx * T + T / 2, y: s.ty * T + T });
      }
    }

    // spikes (forgiving hitbox)
    const x0 = Math.floor(px / T), x1 = Math.floor((px + pw) / T);
    const y0 = Math.floor(py / T), y1 = Math.floor((py + ph) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.spikeHit(this.charAt(tx, ty), tx, ty, px, py, pw, ph)) {
          this.kill();
          return;
        }
      }
    }

    for (const o of this.orbs) {
      if (o.cd <= 0 && !p.canDash && !p.onGround && Math.hypot(o.x - cx, o.y - cy) < 22) {
        p.canDash = true;
        o.cd = PHYS.ORB_CD;
        this.emit('orb', { x: o.x, y: o.y });
      }
    }

    for (const s of this.shards) {
      if (!s.taken && Math.hypot(s.x - cx, s.y - cy) < 22) {
        s.taken = true;
        this.collected++;
        this.emit('collect', { x: s.x, y: s.y, n: this.collected });
      }
    }

    for (const c of this.checkpoints) {
      if (!c.active && Math.abs(c.x - cx) < 22 && py + ph > c.y - 56 && py + ph <= c.y + 2) {
        c.active = true;
        this.spawn = { x: c.x - pw / 2, y: c.y - ph, phase: this.phase };
        this.emit('checkpoint', { x: c.x, y: c.y });
      }
    }

    if (this.exit && Math.hypot(this.exit.x - cx, this.exit.y - 18 - cy) < 26) {
      this.won = true;
      p.vx = 0; p.vy = 0;
      this.emit('win', { x: this.exit.x, y: this.exit.y - 18 });
    }
  }

  // ^ floor spikes, v hanging spikes, a/b floor spikes that are only deadly in Glut/Frost
  spikeHit(c, tx, ty, px, py, pw, ph) {
    if (c === 'a' && this.phase !== 0) return false;
    if (c === 'b' && this.phase !== 1) return false;
    const X = tx * T + 5, W = T - 10, H = T - 14;
    if (c === '^' || c === 'a' || c === 'b') return overlap(px + 3, py + 4, pw - 6, ph - 4, X, ty * T + 14, W, H);
    if (c === 'v') return overlap(px + 3, py, pw - 6, ph - 4, X, ty * T, W, H);
    return false;
  }

  kill() {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    p.deadT = 0.75;
    this.deaths++;
    this.emit('die', { x: p.x + PHYS.W / 2, y: Math.min(p.y + PHYS.H / 2, this.h * T) });
  }

  respawn() {
    if (!this.pulse) this.phase = this.spawn.phase; // in pulse levels the beat owns the world
    this.player = this.makePlayer();
    this.emit('respawn', { x: this.spawn.x + PHYS.W / 2, y: this.spawn.y + PHYS.H / 2 });
  }
}
