// Canvas renderer: parallax backdrop, tiles, entities, player, particles, post effects.
import { TILE as T } from './levels.js';
import { PHYS } from './world.js';
import {
  THEMES, normalizeLook, lookFromSkin, bodyRGB, bodyFill, drawAura, scarfLength, drawScarf, scarfParticles,
  bodyParticles, drawHat, trailParticles, drawRibbon, deathFx, drawParticleShape, drawHole,
} from './cosmetics.js';

export const VIEW_H = 544;

// Default (Dusk) palette: [Ember, Frost]. Each renderer keeps its own copy in this.P (see setTheme).
export const PAL = [THEMES.dusk.ember, THEMES.dusk.frost];
const BODY = '#f3efe7';
// Minimap colours follow the theme of the main (full-window) renderer.
let minimapTheme = 'dusk';

const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
const mixRGB = (a, b, t) => { const A = rgb(a), B = rgb(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

function makeGlow(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const [r, gg, b] = rgb(hex);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(0.25, `rgba(${r},${gg},${b},0.45)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export class Renderer {
  // opts.fit: size to the canvas element instead of the window; opts.viewH: world height in view
  constructor(canvas, opts = {}) {
    this.fit = !!opts.fit;
    this.viewH = opts.viewH || VIEW_H;
    this.minW = opts.minW || 600; // never show less world width than this
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.particles = [];
    this.rings = [];
    this.after = [];
    this.shake = 0;
    this.flash = 0;
    this.sq = { x: 1, y: 1 };
    this.scarf = null;
    this.blinkT = 2.5;
    this.blink = 0;
    this.glow = { body: [makeGlow(BODY), makeGlow(BODY)] };
    this.theme = null;
    this.setTheme('dusk');
    this.bottomPad = 0; // reserved space under the world for touch controls
    this.shakeOn = true;
    this.labelFor = (action) => action; // set by main.js: current key label or touch button symbol
    this.lastCam = { x: 0, y: 0 };
    this.look = normalizeLook(null); // player look, see setLook (renderer.skin is the old alias)
    this.ribbon = []; // prism trail points
    this.trickles = {}; // fractional particle counts of continuous emitters
    this.timers = []; // delayed effects (fireworks)
    this.playerShown = false;
    this.lastT = 0;
    this.time = 0;
    this.resize();
  }

  resize() {
    const w = this.fit ? this.canvas.clientWidth || 1 : innerWidth;
    const h = this.fit ? this.canvas.clientHeight || 1 : innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(h / (this.viewH + this.bottomPad), w / this.minW);
    this.vw = w / this.scale;
    this.vh = h / this.scale;
    this.vignette = null;
  }

  // ---------- cosmetics ----------
  // look: see shop.js lookFor(). look.theme is ignored here, the theme is applied with setTheme().
  setLook(look) {
    const prev = this.look;
    this.look = normalizeLook(look);
    if (prev && prev.trail !== this.look.trail) { this.ribbon.length = 0; this.after = this.after.filter((a) => !a.echo); }
  }

  // Compatibility alias for the pre-shop skin object ({ body, visor, outline, scarf, hat }).
  get skin() { return this.look; }
  set skin(s) { this.setLook(s && typeof s.body === 'object' ? s : lookFromSkin(s)); }

  // Swaps the palette used everywhere (sky, stone, accents, glow sprites, minimap of the main renderer).
  setTheme(id) {
    const th = THEMES[id] ? id : 'dusk';
    if (th === this.theme) return;
    this.theme = th;
    this.P = [THEMES[th].ember, THEMES[th].frost];
    for (const k of ['accent', 'accent2', 'disc']) this.glow[k] = [makeGlow(this.P[0][k]), makeGlow(this.P[1][k])];
    if (!this.fit) minimapTheme = th;
  }

  pal(key, t) { return mixRGB(this.P[0][key], this.P[1][key], t); }
  rgbOf(hex) { return rgb(hex); }
  css(c, a = 1) { return css(c, a); }

  // Continuous emitter: calls fn about `rate` times per second.
  trickle(key, dt, rate, fn) {
    let a = (this.trickles[key] || 0) + dt * rate;
    for (; a >= 1; a--) fn();
    this.trickles[key] = a;
  }

  later(delay, fn) {
    if (delay <= 0) fn();
    else this.timers.push({ t: delay, fn });
  }

  setBottomPad(px) {
    if (this.bottomPad === px) return;
    this.bottomPad = px;
    this.resize();
  }

  setLevel(world) {
    const rnd = mulberry32(world.level.seed || 7);
    const levelW = world.w * T;
    this.stars = Array.from({ length: 170 }, () => ({ x: rnd() * 3000, y: rnd() * 380, s: rnd() * 1.5 + 0.4, tw: rnd() * 6.28 }));
    this.motes = Array.from({ length: this.reduced ? 20 : 55 }, () => ({ x: rnd() * 2000, y: rnd() * 600, s: rnd() * 2 + 0.6, v: rnd() * 12 + 4, ph: rnd() * 6.28 }));

    const mount = (p, step, base, amp) => {
      const n = Math.ceil((3000 + levelW * p) / step) + 2;
      const a = rnd() * 9, b = rnd() * 9, c = rnd() * 9;
      return { p, step, pts: Array.from({ length: n }, (_, i) => base + amp * (0.55 * Math.sin(i * step * 0.0035 + a) + 0.3 * Math.sin(i * step * 0.011 + b) + 0.15 * Math.sin(i * step * 0.031 + c))) };
    };
    const spires = (p) => {
      const out = [];
      let x = -60;
      const end = 3000 + levelW * p;
      while (x < end) {
        const w = 22 + rnd() * 58, h = 70 + rnd() * 200;
        const wins = [];
        const wn = (rnd() * 4) | 0;
        for (let i = 0; i < wn; i++) wins.push({ x: 6 + rnd() * (w - 14), y: 16 + rnd() * (h - 40) });
        out.push({ x, w, h, cap: rnd(), wins });
        x += w + 8 + rnd() * 90;
      }
      return { p, items: out };
    };
    this.far = mount(0.1, 40, 190, 90);
    this.mid = spires(0.28);
    this.near = mount(0.55, 18, 70, 38);

    // depth map: how many stone tiles above each stone tile (for shading)
    this.depth = world.grid.map((row, y) => row.map((c, x) => {
      if (c !== '#') return 0;
      let d = 0;
      while (y - d - 1 >= 0 && world.grid[y - d - 1][x] === '#') d++;
      return d;
    }));
    this.particles.length = 0;
    this.rings.length = 0;
    this.after.length = 0;
    this.ribbon.length = 0;
    this.timers.length = 0;
    this.scarf = null;
  }

  // ---------- effects ----------
  emit(n, o) {
    if (this.reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = (o.speed ?? 100) * (0.4 + Math.random() * 0.8);
      const life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x: o.x + (Math.random() - 0.5) * (o.jx ?? 0), y: o.y + (Math.random() - 0.5) * (o.jy ?? 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life,
        size: (o.size ?? 3) * (0.6 + Math.random() * 0.8), color: o.color, g: o.g ?? 0, drag: o.drag ?? 2, glow: !!o.glow,
        shape: null, rot: 0, vr: 0, pull: null,
      });
    }
  }

  addShake(v) { if (this.shakeOn && !this.reduced) this.shake = Math.max(this.shake, v); }

  fx(e, t) {
    const acc = css(this.pal('accent', t)), acc2 = css(this.pal('accent2', t));
    switch (e.type) {
      case 'jump':
        this.sq = { x: 0.72, y: 1.32 };
        this.emit(7, { x: e.x, y: e.y, angle: -Math.PI / 2, spread: 2.4, speed: 90, color: 'rgba(243,239,231,0.55)', size: 2.5, g: 300, life: 0.4, jx: 10 });
        break;
      case 'land':
        if (e.v > 260) {
          const k = Math.min(1, e.v / 880);
          this.sq = { x: 1 + 0.35 * k, y: 1 - 0.32 * k };
          this.emit(4 + (k * 8) | 0, { x: e.x, y: e.y, angle: -Math.PI / 2, spread: 3, speed: 70 + 80 * k, color: 'rgba(243,239,231,0.5)', size: 2.5, g: 250, life: 0.45, jx: 12 });
          if (e.v > 860) this.addShake(3);
        }
        break;
      case 'dash':
        this.sq = { x: 1.35, y: 0.75 };
        this.emit(14, { x: e.x, y: e.y, angle: e.dir > 0 ? Math.PI : 0, spread: 0.9, speed: 220, color: acc, size: 2.5, life: 0.35, glow: true, jy: 16 });
        this.addShake(2.5);
        break;
      case 'swap':
        this.rings.push({ x: e.x, y: e.y, r: 6, life: 0.55, max: 0.55, color: e.phase ? this.P[1].accent : this.P[0].accent, w: 3 });
        this.flash = 1;
        this.emit(16, { x: e.x, y: e.y, speed: 170, color: css(rgb(e.phase ? this.P[1].accent2 : this.P[0].accent2)), size: 2.2, life: 0.55, glow: true });
        break;
      case 'deny':
        this.addShake(4);
        this.rings.push({ x: e.x, y: e.y, r: 22, life: 0.25, max: 0.25, color: '#f3efe7', w: 1.5, shrink: true });
        break;
      case 'collect':
        this.emit(16, { x: e.x, y: e.y, speed: 160, color: acc2, size: 2.4, life: 0.6, glow: true, drag: 3 });
        this.rings.push({ x: e.x, y: e.y, r: 4, life: 0.4, max: 0.4, color: this.P[t > 0.5 ? 1 : 0].accent2, w: 2, grow: 30 });
        break;
      case 'checkpoint':
        this.emit(24, { x: e.x, y: e.y - 44, angle: -Math.PI / 2, spread: 1.4, speed: 200, color: acc2, size: 2.6, g: 160, life: 0.9, glow: true });
        this.rings.push({ x: e.x, y: e.y - 44, r: 6, life: 0.6, max: 0.6, color: this.P[t > 0.5 ? 1 : 0].accent, w: 2, grow: 60 });
        break;
      case 'spring':
        this.sq = { x: 0.65, y: 1.45 };
        this.emit(12, { x: e.x, y: e.y - 8, angle: -Math.PI / 2, spread: 1.6, speed: 180, color: acc2, size: 2.4, g: 300, life: 0.5, glow: true });
        break;
      case 'die':
        this.ribbon.length = 0;
        deathFx(this, this.look.death, e, t, css(bodyRGB(this, this.look.body, t)));
        break;
      case 'respawn':
        this.scarf = null;
        this.ribbon.length = 0;
        this.rings.push({ x: e.x, y: e.y, r: 46, life: 0.4, max: 0.4, color: this.P[t > 0.5 ? 1 : 0].accent2, w: 2, shrink: true });
        this.sq = { x: 0.6, y: 1.4 };
        break;
      case 'crumble':
        this.emit(5, { x: e.x, y: e.y - 14, angle: -Math.PI / 2, spread: 2, speed: 60, color: 'rgba(200,190,210,0.6)', size: 2, g: 400, life: 0.4, jx: 26 });
        break;
      case 'crumbleFall':
        this.emit(12, { x: e.x, y: e.y, angle: Math.PI / 2, spread: 1.2, speed: 90, color: 'rgba(170,160,185,0.85)', size: 4, g: 900, life: 0.8, jx: 28, jy: 20, drag: 0.5 });
        break;
      case 'crumbleBack':
        this.rings.push({ x: e.x, y: e.y, r: 4, life: 0.35, max: 0.35, color: 'rgba(200,190,210,0.6)', w: 1.5, grow: 22 });
        break;
      case 'orb':
        this.emit(18, { x: e.x, y: e.y, speed: 200, color: '#c9fbff', size: 2.4, life: 0.5, glow: true, drag: 3 });
        this.rings.push({ x: e.x, y: e.y, r: 6, life: 0.45, max: 0.45, color: '#c9fbff', w: 2.5, grow: 50 });
        this.sq = { x: 1.25, y: 0.8 };
        break;
      case 'win':
        this.flash = 1;
        this.emit(40, { x: e.x, y: e.y, speed: 280, color: acc2, size: 3, life: 1.1, glow: true, drag: 1.5 });
        this.rings.push({ x: e.x, y: e.y, r: 10, life: 0.9, max: 0.9, color: this.P[t > 0.5 ? 1 : 0].accent, w: 3 });
        break;
      default:
    }
  }

  update(dt, world, time) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    const k = Math.min(1, dt * 14);
    this.sq.x += (1 - this.sq.x) * k;
    this.sq.y += (1 - this.sq.y) * k;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.vy += p.g * dt;
      if (p.pull) {
        // black hole: accelerate towards the centre, vanish when swallowed
        const dx = p.pull.x - p.x, dy = p.pull.y - p.y, d = Math.hypot(dx, dy);
        if (d < 3) { this.particles.splice(i, 1); continue; }
        p.vx += (dx / d) * p.pull.k * dt;
        p.vy += (dy / d) * p.pull.k * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    for (let i = this.ribbon.length - 1; i >= 0; i--) {
      this.ribbon[i].life -= dt;
      if (this.ribbon[i].life <= 0) this.ribbon.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.after.length - 1; i >= 0; i--) {
      this.after[i].life -= dt;
      if (this.after[i].life <= 0) this.after.splice(i, 1);
    }
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = 2 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt);

    if (!world) return;
    const p = world.player;
    if (p.dashT > 0 && p.alive) this.after.push({ x: p.x, y: p.y, f: p.facing, life: 0.22, max: 0.22 });
    if (p.alive && !world.won && Math.random() < dt * 2 && world.exit) {
      // portal pulls a few motes inwards
      const a = Math.random() * 6.28;
      this.particles.push({ x: world.exit.x + Math.cos(a) * 50, y: world.exit.y - 18 + Math.sin(a) * 50, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60, life: 0.8, max: 0.8, size: 2, color: '#ffffff', g: 0, drag: 0, glow: true });
    }
    this.updateScarf(dt, p, time);
    // cosmetic emitters only run while the player is actually drawn (not in the attract backdrop)
    if (this.playerShown && p.alive && !world.won) {
      const moving = Math.hypot(p.vx, p.vy) > 40;
      trailParticles(this, this.look.trail, p, p.x + PHYS.W / 2, p.y + PHYS.H, dt, this.lastT);
      scarfParticles(this, this.look.scarf, this.scarf, dt, moving);
      bodyParticles(this, this.look.body, p.x + PHYS.W / 2, p.y + PHYS.H / 2, dt);
    }
  }

  updateScarf(dt, p, time) {
    const ax = p.x + PHYS.W / 2 - p.facing * 3;
    const ay = p.y + 11;
    const len = scarfLength(this.look.scarf.kind);
    if (!this.scarf || this.scarf.length !== len) this.scarf = Array.from({ length: len }, (_, i) => ({ x: ax - p.facing * i * 4, y: ay, ox: ax - p.facing * i * 4, oy: ay }));
    const s = this.scarf;
    s[0].x = s[0].ox = ax;
    s[0].y = s[0].oy = ay;
    const f = Math.min(2, dt * 60);
    for (let i = 1; i < s.length; i++) {
      const q = s[i];
      const vx = (q.x - q.ox) * 0.86, vy = (q.y - q.oy) * 0.86;
      q.ox = q.x; q.oy = q.y;
      q.x += vx + (-p.facing * 0.35 + Math.sin(time * 9 + i * 0.9) * 0.18) * f;
      q.y += vy + 0.32 * f;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1], b = s[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const L = 4.2;
        b.x = a.x + (dx / d) * L;
        b.y = a.y + (dy / d) * L;
      }
    }
  }

  drawGlow(kind, x, y, r, a, t) {
    const ctx = this.ctx;
    const [g0, g1] = this.glow[kind];
    if (t < 1) { ctx.globalAlpha = a * (1 - t); ctx.drawImage(g0, x - r, y - r, r * 2, r * 2); }
    if (t > 0) { ctx.globalAlpha = a * t; ctx.drawImage(g1, x - r, y - r, r * 2, r * 2); }
    ctx.globalAlpha = 1;
  }

  // ---------- frame ----------
  render(world, cam, t, time, { showPlayer = true, showSigns = true, ghost = null } = {}) {
    this.time = time;
    this.lastT = t;
    this.playerShown = showPlayer;
    const ctx = this.ctx;
    const S = this.scale * this.dpr;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = true;
    this.drawBackdrop(cam, t, time);

    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const cx = Math.round((cam.x + sx) * S) / S;
    const cy = Math.round((cam.y + sy) * S) / S;
    this.lastCam = { x: cx, y: cy };
    ctx.save();
    ctx.translate(-cx, -cy);
    if (showSigns) this.drawSigns(world, t);
    this.drawPortal(world, t, time);
    this.drawCheckpoints(world, t, time);
    this.drawTiles(world, cam, t, time);
    this.drawCrumbles(world, t, time);
    this.drawSprings(world, t);
    this.drawShards(world, t, time);
    this.drawOrbs(world, t, time);
    if (ghost) this.drawGhost(ghost, t);
    if (showPlayer) this.drawPlayer(world, t);
    this.drawParticles();
    ctx.restore();

    ctx.setTransform(S, 0, 0, S, 0, 0);
    if (this.flash > 0) {
      ctx.fillStyle = css(this.pal('accent2', t), this.flash * 0.12);
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    if (!this.vignette) {
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * 0.35, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.75);
      g.addColorStop(0, 'rgba(5,4,10,0)');
      g.addColorStop(1, 'rgba(5,4,10,0.55)');
      this.vignette = g;
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, this.vw, this.vh);
  }

  drawBackdrop(cam, t, time) {
    const ctx = this.ctx;
    const vw = this.vw, vh = this.vh;
    const floorY = this.viewH - cam.y; // world bottom in screen space
    const top = this.pal('skyTop', t), bot = this.pal('skyBot', t);
    const sky = ctx.createLinearGradient(0, 0, 0, floorY);
    sky.addColorStop(0, css(top));
    sky.addColorStop(1, css(bot));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, vw, vh);

    // stars fade in with Frost
    if (t > 0.02) {
      ctx.fillStyle = '#f4f8ff';
      for (const s of this.stars) {
        const x = ((s.x - cam.x * 0.02) % 3000 + 3000) % 3000;
        if (x > vw) continue;
        ctx.globalAlpha = t * (0.35 + 0.5 * Math.sin(time * 1.4 + s.tw) ** 2);
        ctx.fillRect(x, s.y - cam.y * 0.02, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    // sun becomes moon
    const dx = vw * 0.68 - cam.x * 0.025, dy = floorY * 0.34;
    const r = 58;
    this.drawGlow('disc', dx, dy, 300, 0.32, t);
    // carve the crescent on an offscreen canvas so the sky gradient stays untouched
    if (!this.moon) { this.moon = document.createElement('canvas'); this.moon.width = this.moon.height = 160; }
    const m2 = this.moon.getContext('2d');
    m2.clearRect(0, 0, 160, 160);
    m2.globalCompositeOperation = 'source-over';
    m2.fillStyle = css(this.pal('disc', t));
    m2.beginPath(); m2.arc(80, 80, r, 0, Math.PI * 2); m2.fill();
    if (t > 0.01) {
      m2.globalCompositeOperation = 'destination-out';
      m2.globalAlpha = Math.min(1, t * 1.1);
      m2.beginPath(); m2.arc(80 + r * 0.5 * t, 80 - r * 0.22 * t, r * 0.94, 0, Math.PI * 2); m2.fill();
      m2.globalAlpha = 1;
    }
    ctx.drawImage(this.moon, dx - 80, dy - 80);

    // far mountains
    this.drawRidge(this.far, cam, floorY - 70, css(this.pal('far', t)));
    this.haze(floorY - 260, floorY, bot, 0.45);
    // mid spires
    const m = this.mid, off = cam.x * m.p;
    ctx.fillStyle = css(this.pal('mid', t));
    const base = floorY - 40;
    const win = css(this.pal('accent2', t), 0.55);
    for (const s of m.items) {
      const x = s.x - off;
      if (x > vw + 10 || x + s.w < -10) continue;
      ctx.beginPath();
      ctx.moveTo(x, vh + 10);
      ctx.lineTo(x, base - s.h);
      if (s.cap < 0.4) ctx.lineTo(x + s.w / 2, base - s.h - s.w * 0.9);
      else if (s.cap < 0.7) ctx.lineTo(x + s.w * 0.15, base - s.h - 8), ctx.lineTo(x + s.w * 0.85, base - s.h - 8);
      else ctx.arc(x + s.w / 2, base - s.h, s.w / 2, Math.PI, 0);
      ctx.lineTo(x + s.w, base - s.h);
      ctx.lineTo(x + s.w, vh + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = win;
    for (const s of m.items) {
      const x = s.x - off;
      if (x > vw + 10 || x + s.w < -10) continue;
      for (const w of s.wins) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.4 + w.x));
        ctx.fillRect(x + w.x, base - s.h + w.y, 3, 5);
      }
    }
    ctx.globalAlpha = 1;
    this.haze(floorY - 180, floorY, bot, 0.35);
    this.drawRidge(this.near, cam, floorY - 8, css(this.pal('near', t)));

    // drifting motes
    ctx.globalCompositeOperation = 'lighter';
    const mc = css(this.pal('accent2', t), 0.5);
    ctx.fillStyle = mc;
    for (const q of this.motes) {
      const x = (((q.x - cam.x * 0.7 + Math.sin(time * 0.3 + q.ph) * 20) % (vw + 40)) + vw + 40) % (vw + 40) - 20;
      const y = (((q.y - time * q.v - cam.y * 0.7) % (vh + 40)) + vh + 40) % (vh + 40) - 20;
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(time * 2 + q.ph) ** 2;
      ctx.fillRect(x, y, q.s, q.s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawRidge(layer, cam, baseY, color) {
    const ctx = this.ctx;
    const off = cam.x * layer.p;
    const i0 = Math.max(0, Math.floor(off / layer.step) - 1);
    const i1 = Math.min(layer.pts.length - 1, Math.ceil((off + this.vw) / layer.step) + 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(i0 * layer.step - off, this.vh + 10);
    for (let i = i0; i <= i1; i++) ctx.lineTo(i * layer.step - off, baseY - layer.pts[i]);
    ctx.lineTo(i1 * layer.step - off, this.vh + 10);
    ctx.closePath();
    ctx.fill();
  }

  haze(y0, y1, color, a) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, css(color, 0));
    g.addColorStop(1, css(color, a));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, this.vw, Math.max(this.vh, y1) - y0 + 10);
  }

  drawTiles(world, cam, t, time) {
    const ctx = this.ctx;
    const g = world.grid;
    const x0 = Math.max(0, Math.floor(cam.x / T) - 1), x1 = Math.min(world.w - 1, Math.ceil((cam.x + this.vw) / T) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.min(world.h - 1, Math.ceil((cam.y + this.vh) / T) + 1);
    const at = (x, y) => (y < 0 || y >= world.h || x < 0 || x >= world.w ? '.' : g[y][x]);
    const rim = this.pal('accent', t);

    // stone body with depth shading
    ctx.fillStyle = css(this.pal('stone', t));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y][x] === '#') ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
    if (this.bottomPad && y1 === world.h - 1) {
      // extend the bedrock below the world when the view reserves space for touch controls
      ctx.fillStyle = 'rgba(8,6,12,0.97)';
      for (let x = x0; x <= x1; x++) if (g[world.h - 1][x] === '#') ctx.fillRect(x * T, world.h * T, T + 0.5, this.bottomPad + 40);
    }
    for (let d = 1; d <= 4; d++) {
      ctx.fillStyle = `rgba(4,3,8,${d * 0.11})`;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y][x] === '#' && Math.min(4, this.depth[y][x]) === d) ctx.fillRect(x * T, y * T, T + 0.5, T + 0.5);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (g[y][x] !== '#') continue;
      const h1 = hash(x, y), h2 = hash(y, x);
      ctx.fillRect(x * T + h1 * 26, y * T + 6 + h2 * 20, 3, 2);
      ctx.fillRect(x * T + h2 * 24, y * T + 4 + h1 * 22, 2, 2);
    }
    // rims & light
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (g[y][x] !== '#') continue;
      if (at(x, y - 1) !== '#') {
        ctx.fillStyle = css(rim, 0.95);
        ctx.fillRect(x * T, y * T, T, 2);
        ctx.fillStyle = css(rim, 0.13);
        ctx.fillRect(x * T, y * T + 2, T, 5);
      }
      ctx.fillStyle = css(rim, 0.16);
      if (at(x - 1, y) !== '#') ctx.fillRect(x * T, y * T, 1.5, T);
      if (at(x + 1, y) !== '#') ctx.fillRect(x * T + T - 1.5, y * T, 1.5, T);
    }
    // glowing grass
    ctx.strokeStyle = css(rim, 0.6);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (g[y][x] !== '#' || at(x, y - 1) !== '.') continue;
      for (let i = 0; i < 4; i++) {
        const hh = hash(x * 4 + i, y);
        if (hh < 0.3) continue;
        const bx = x * T + hash(y, x * 4 + i) * T;
        const len = 3 + hh * 7;
        const sway = this.reduced ? 0 : Math.sin(time * 1.7 + bx * 0.06) * 2;
        ctx.moveTo(bx, y * T);
        ctx.quadraticCurveTo(bx, y * T - len * 0.6, bx + sway, y * T - len);
      }
    }
    ctx.stroke();

    // phase tiles
    const warn = world.pulse && world.pulseLeft <= PHYS.PULSE_WARN;
    for (const ch of ['A', 'B']) {
      const P = ch === 'A' ? this.P[0] : this.P[1];
      const incoming = warn && (ch === 'A') === (world.phase === 1); // the world about to arrive
      const blink = incoming ? (this.reduced ? 0.3 : 0.4 * (0.5 + 0.5 * Math.sin(time * 38))) : 0;
      const s = Math.min(1, (ch === 'A' ? 1 - t : t) + blink);
      const ac = rgb(P.accent), ac2 = rgb(P.accent2);
      ctx.fillStyle = css(ac, 0.07 + 0.6 * s);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y][x] === ch) ctx.fillRect(x * T, y * T, T, T);
      // energy stripes
      ctx.strokeStyle = css(ac2, 0.06 + 0.16 * s);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const shift = this.reduced ? 0 : (time * 14) % 12;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (g[y][x] !== ch) continue;
        for (let k = -T; k < T; k += 12) {
          const o = k + shift;
          const ax = Math.max(0, o), ay = Math.max(0, -o);
          const len = T - Math.max(ax, ay);
          if (len <= 0) continue;
          ctx.moveTo(x * T + ax, y * T + T - ay);
          ctx.lineTo(x * T + ax + len, y * T + T - ay - len);
        }
      }
      ctx.stroke();
      // outlines on shape edges
      ctx.strokeStyle = css(s > 0.5 ? ac2 : ac, s > 0.5 ? 0.55 + 0.45 * s : 0.6);
      ctx.lineWidth = s > 0.5 ? 2 : 1.5;
      ctx.setLineDash(s > 0.5 ? [] : [4, 4]);
      ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (g[y][x] !== ch) continue;
        const X = x * T, Y = y * T;
        if (at(x, y - 1) !== ch) { ctx.moveTo(X, Y + 1); ctx.lineTo(X + T, Y + 1); }
        if (at(x, y + 1) !== ch) { ctx.moveTo(X, Y + T - 1); ctx.lineTo(X + T, Y + T - 1); }
        if (at(x - 1, y) !== ch) { ctx.moveTo(X + 1, Y); ctx.lineTo(X + 1, Y + T); }
        if (at(x + 1, y) !== ch) { ctx.moveTo(X + T - 1, Y); ctx.lineTo(X + T - 1, Y + T); }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // one-way slabs
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (g[y][x] !== '=') continue;
      ctx.fillStyle = css(this.pal('stone', t));
      ctx.fillRect(x * T, y * T, T, 8);
      ctx.fillStyle = css(rim, 0.9);
      ctx.fillRect(x * T, y * T, T, 2);
      ctx.fillStyle = css(rim, 0.25);
      ctx.fillRect(x * T + 6, y * T + 8, 2, 5);
      ctx.fillRect(x * T + 24, y * T + 8, 2, 5);
    }

    // spikes: ^ floor, v hanging, a/b phase spikes (solid colour when deadly, dashed ghost when harmless)
    const spikePath = (ch, shade) => {
      ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (g[y][x] !== ch) continue;
        const X = x * T;
        const down = ch === 'v';
        const B = down ? y * T : y * T + T;
        const tip = down ? B + 19 : B - 19;
        for (const o of [0, 14]) {
          if (shade) { ctx.moveTo(X + 9 + o, tip); ctx.lineTo(X + 16 + o, B); ctx.lineTo(X + 9 + o, B); }
          else { ctx.moveTo(X + 2 + o, B); ctx.lineTo(X + 9 + o, tip); ctx.lineTo(X + 16 + o, B); }
        }
      }
    };
    for (const ch of ['^', 'v']) {
      spikePath(ch, false);
      ctx.fillStyle = '#ece3d6';
      ctx.fill();
      spikePath(ch, true);
      ctx.fillStyle = 'rgba(30,18,30,0.35)';
      ctx.fill();
    }
    for (const ch of ['a', 'b']) {
      const P = ch === 'a' ? this.P[0] : this.P[1];
      const live = ch === 'a' ? 1 - t : t;
      spikePath(ch, false);
      ctx.fillStyle = css(rgb(P.accent), 0.12 + 0.88 * live);
      ctx.fill();
      if (live < 0.5) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = css(rgb(P.accent), 0.7);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        spikePath(ch, true);
        ctx.fillStyle = css(rgb(P.accent2), 0.45 * live);
        ctx.fill();
      }
    }
  }

  drawCrumbles(world, t, time) {
    if (!world.crumbles.size) return;
    const ctx = this.ctx;
    for (const c of world.crumbles.values()) {
      const X = c.tx * T, Y = c.ty * T;
      if (X + T < this.lastCam.x - T || X > this.lastCam.x + this.vw + T) continue;
      if (c.state === 2) {
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(200,190,210,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(X + 2.5, Y + 2.5, T - 5, T - 5);
        ctx.setLineDash([]);
        continue;
      }
      const shake = c.state === 1 && !this.reduced ? Math.sin(time * 70 + c.tx) * 1.6 : 0;
      ctx.save();
      ctx.translate(X + shake, Y);
      ctx.fillStyle = c.state === 1 ? '#4a3f55' : '#3a3244';
      ctx.fillRect(0, 0, T, T);
      ctx.fillStyle = css(this.pal('accent', t), 0.75);
      ctx.fillRect(0, 0, T, 2);
      // cracks (deterministic per tile), brighter while it breaks
      ctx.strokeStyle = c.state === 1 ? 'rgba(255,230,210,0.75)' : 'rgba(10,8,14,0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const h = hash(c.tx, c.ty);
      ctx.moveTo(4 + h * 10, 2); ctx.lineTo(12 + h * 6, 13); ctx.lineTo(8 + h * 12, 22); ctx.lineTo(16, 30);
      ctx.moveTo(12 + h * 6, 13); ctx.lineTo(26, 10 + h * 8);
      ctx.moveTo(30, 20); ctx.lineTo(22, 26 - h * 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawOrbs(world, t, time) {
    const ctx = this.ctx;
    for (const o of world.orbs) {
      const ready = o.cd <= 0;
      const bob = this.reduced ? 0 : Math.sin(time * 3 + o.i) * 2.5;
      const y = o.y + bob;
      if (ready) {
        ctx.globalCompositeOperation = 'lighter';
        this.drawGlow('accent2', o.x, y, 34, 0.75, t);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#e9fdff';
        ctx.beginPath(); ctx.arc(o.x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#7ef0ff';
        ctx.lineWidth = 2;
        const spin = this.reduced ? 0 : time * 2.4;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(o.x, y, 11, spin + (k * Math.PI * 2) / 3, spin + (k * Math.PI * 2) / 3 + 1.2);
          ctx.stroke();
        }
      } else {
        // recharging: faint core plus a ring that fills up
        ctx.strokeStyle = 'rgba(126,240,255,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(o.x, y, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(126,240,255,0.7)';
        ctx.beginPath(); ctx.arc(o.x, y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - o.cd / PHYS.ORB_CD)); ctx.stroke();
      }
    }
  }

  drawSprings(world, t) {
    const ctx = this.ctx;
    for (const s of world.springs) {
      const X = s.tx * T, B = s.ty * T + T;
      const ext = s.anim > 0 ? (s.anim / 0.3) * 12 : 0;
      const topY = B - 12 - ext;
      ctx.fillStyle = '#3a3242';
      ctx.fillRect(X + 5, B - 4, T - 10, 4);
      ctx.strokeStyle = css(this.pal('accent2', t));
      ctx.lineWidth = 2;
      ctx.beginPath();
      const n = 4;
      for (let i = 0; i <= n; i++) {
        const yy = B - 4 - ((B - 4 - topY) * i) / n;
        ctx.lineTo(X + (i % 2 ? 9 : T - 9), yy);
      }
      ctx.stroke();
      ctx.fillStyle = css(this.pal('accent', t));
      ctx.fillRect(X + 4, topY - 4, T - 8, 4);
      this.drawGlow('accent', X + T / 2, topY, 22, 0.35, t);
    }
  }

  drawShards(world, t, time) {
    const ctx = this.ctx;
    for (const s of world.shards) {
      if (s.taken) continue;
      const bob = this.reduced ? 0 : Math.sin(time * 2.6 + s.seed) * 3;
      const y = s.y + bob;
      ctx.globalCompositeOperation = 'lighter';
      this.drawGlow('accent2', s.x, y, 26, 0.55, t);
      ctx.globalCompositeOperation = 'source-over';
      const w = 2 + 6 * Math.abs(Math.cos(time * 2 + s.seed));
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.moveTo(s.x, y - 10); ctx.lineTo(s.x + w, y); ctx.lineTo(s.x, y + 10); ctx.lineTo(s.x - w, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = css(this.pal('accent', t), 0.7);
      ctx.beginPath();
      ctx.moveTo(s.x, y - 10); ctx.lineTo(s.x + w, y); ctx.lineTo(s.x, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawCheckpoints(world, t, time) {
    const ctx = this.ctx;
    for (const c of world.checkpoints) {
      const top = c.y - 40;
      if (c.active) {
        const beam = ctx.createLinearGradient(0, top - 120, 0, top);
        beam.addColorStop(0, css(this.pal('accent', t), 0));
        beam.addColorStop(1, css(this.pal('accent', t), 0.22));
        ctx.fillStyle = beam;
        ctx.fillRect(c.x - 5, top - 120, 10, 120);
      }
      ctx.fillStyle = '#2b2433';
      ctx.beginPath();
      ctx.moveTo(c.x - 5, c.y); ctx.lineTo(c.x - 3, top); ctx.lineTo(c.x + 3, top); ctx.lineTo(c.x + 5, c.y);
      ctx.closePath();
      ctx.fill();
      const cy = top - 8 + (c.active && !this.reduced ? Math.sin(time * 3) * 2 : 0);
      if (c.active) {
        ctx.globalCompositeOperation = 'lighter';
        this.drawGlow('accent', c.x, cy, 34, 0.8, t);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = c.active ? css(this.pal('accent2', t)) : '#5b5266';
      ctx.beginPath();
      ctx.moveTo(c.x, cy - 8); ctx.lineTo(c.x + 5, cy); ctx.lineTo(c.x, cy + 8); ctx.lineTo(c.x - 5, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawPortal(world, t, time) {
    const e = world.exit;
    if (!e) return;
    const ctx = this.ctx;
    const x = e.x, y = e.y - 22;
    ctx.globalCompositeOperation = 'lighter';
    this.drawGlow('accent', x, y, 90, 0.5, t);
    this.drawGlow('accent2', x, y, 40, 0.6, t);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0b0a10';
    ctx.beginPath(); ctx.ellipse(x, y, 13, 20, 0, 0, Math.PI * 2); ctx.fill();
    const spin = this.reduced ? 0 : time;
    for (let i = 0; i < 3; i++) {
      const dir = i % 2 ? -1 : 1;
      ctx.strokeStyle = css(this.pal(i === 1 ? 'accent2' : 'accent', t), 0.9 - i * 0.2);
      ctx.lineWidth = 2.5 - i * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, 17 + i * 6, 24 + i * 6, 0, spin * (1.2 + i * 0.4) * dir, spin * (1.2 + i * 0.4) * dir + Math.PI * 1.3);
      ctx.stroke();
    }
  }

  drawSigns(world, t) {
    const ctx = this.ctx;
    ctx.font = '600 13px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'top';
    for (const s of world.level.signs) {
      ctx.fillStyle = css(this.pal('accent2', t), 0.75);
      ctx.fillText(s.text.replace(/\{(\w+)\}/g, (_, act) => this.labelFor(act)), s.x, s.y);
      ctx.fillStyle = css(this.pal('accent', t), 0.5);
      ctx.fillRect(s.x, s.y + 20, 18, 2);
    }
  }

  drawPlayer(world, t) {
    const ctx = this.ctx;
    const p = world.player;
    const W = PHYS.W, H = PHYS.H;
    const look = this.look;
    drawRibbon(this, ctx);
    // afterimages: dash streak (filled) and the World Echo trail (outlined)
    for (const a of this.after) {
      const k = a.life / (a.max || 0.22);
      ctx.beginPath();
      ctx.roundRect(a.x, a.y, W, H, a.echo ? 7 : 6);
      if (a.echo) {
        ctx.fillStyle = css(this.pal('accent', t), k * 0.16);
        ctx.fill();
        ctx.strokeStyle = css(this.pal('accent2', t), k * 0.55);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = css(this.pal('accent', t), k * 0.45);
        ctx.fill();
      }
    }
    if (!p.alive || world.won) return;
    const cx = p.x + W / 2, by = p.y + H;
    ctx.globalCompositeOperation = 'lighter';
    this.drawGlow('accent', cx, by - H / 2, 46, 0.28, t);
    ctx.globalCompositeOperation = 'source-over';
    drawAura(this, ctx, look.body, cx, by - H / 2);

    // scarf behind body
    if (this.scarf) drawScarf(this, ctx, look.scarf, this.scarf, t);

    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(this.sq.x, this.sq.y);
    const visor = look.body.visor;
    drawHat(this, ctx, look.hat, 'back', p.facing, t, H, visor);
    ctx.fillStyle = bodyFill(this, ctx, look.body, t, W, H);
    ctx.beginPath();
    ctx.roundRect(-W / 2, -H, W, H, 7);
    ctx.fill();
    if (look.body.outline) {
      ctx.strokeStyle = css(this.pal('accent', t), 0.9);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (look.body.kind === 'supernova') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,30,45,0.12)';
    ctx.fillRect(-W / 2 + 2, -6, W - 4, 4);
    ctx.fillStyle = visor;
    ctx.beginPath();
    ctx.roundRect(-W / 2 + 2, -H + 6, W - 4, 9, 4.5);
    ctx.fill();
    const f = p.facing;
    const eh = this.blink > 0 ? 1 : 4;
    ctx.fillStyle = css(this.pal('accent2', t));
    ctx.fillRect(-4 + f * 3 - 1.5, -H + 8.5 + (4 - eh) / 2, 3, eh);
    ctx.fillRect(3 + f * 3 - 1.5, -H + 8.5 + (4 - eh) / 2, 3, eh);
    // dash spent: dim the body until the player lands again
    if (!p.canDash && p.dashT <= 0) {
      ctx.fillStyle = 'rgba(22,19,28,0.5)';
      ctx.beginPath();
      ctx.roundRect(-W / 2, -H, W, H, 7);
      ctx.fill();
    }
    drawHat(this, ctx, look.hat, 'front', p.facing, t, H, visor);
    ctx.restore();
  }

  // Best-run ghost: a translucent outline that runs the stored inputs in its own world.
  drawGhost(g, t) {
    const ctx = this.ctx;
    const W = PHYS.W, H = PHYS.H;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(243,239,231,0.22)';
    ctx.strokeStyle = css(this.pal('accent2', t), 0.8);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, W, H, 7);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(22,19,28,0.55)';
    ctx.beginPath();
    ctx.roundRect(g.x + 2, g.y + 6, W - 4, 9, 4.5);
    ctx.fill();
    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const r of this.rings) if (r.hole) drawHole(this, ctx, r); // particles fall into it, so it goes first
    for (const pass of [false, true]) {
      if (pass) ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        if (p.glow !== pass) continue;
        const k = Math.max(0, p.life / p.max);
        ctx.globalAlpha = p.shape === 'confetti' || p.shape === 'tri' ? Math.min(1, k * 3) : k; // paper and shards fade late
        drawParticleShape(ctx, p, k);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const r of this.rings) {
      if (r.hole) continue;
      const k = 1 - r.life / r.max;
      const e = 1 - (1 - k) ** 3;
      const rad = r.shrink ? r.r * (1 - e) : r.r + e * (r.grow ?? 160);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.lineWidth = r.w * (1 - k * 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(0.1, rad), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// Tiny level map for the level-select cards, with an optional death heatmap ([[x, y], ...] in world px).
// theme: theme id for the colours; defaults to the theme of the main renderer.
export function drawMinimap(canvas, level, deaths = [], theme = minimapTheme) {
  const PAL = THEMES[theme] ? [THEMES[theme].ember, THEMES[theme].frost] : [THEMES.dusk.ember, THEMES.dusk.frost];
  const s = 3;
  canvas.width = level.w * s;
  canvas.height = level.h * s;
  const g = canvas.getContext('2d');
  const colors = { '#': '#3b3443', x: '#7d718a', d: '#7ef0ff', A: PAL[0].accent, B: PAL[1].accent, '^': '#ece3d6', v: '#ece3d6', a: PAL[0].accent2, b: PAL[1].accent2, '=': '#6b6075', o: '#fffaf0', E: '#ffffff', C: '#8d82a0', S: PAL[0].accent2 };
  level.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (!c) continue;
      g.fillStyle = c;
      g.globalAlpha = row[x] === 'A' || row[x] === 'B' ? 0.85 : 1;
      g.fillRect(x * s, y * s, s, s);
    }
  });
  // soft red blobs that stack up where the player dies most often
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'lighter';
  for (const [x, y] of deaths) {
    const px = (x / T) * s, py = (y / T) * s;
    const grad = g.createRadialGradient(px, py, 0, px, py, 11);
    grad.addColorStop(0, 'rgba(255,70,90,0.85)');
    grad.addColorStop(0.45, 'rgba(255,70,90,0.35)');
    grad.addColorStop(1, 'rgba(255,70,90,0)');
    g.fillStyle = grad;
    g.fillRect(px - 11, py - 11, 22, 22);
  }
  g.globalCompositeOperation = 'source-over';
}
