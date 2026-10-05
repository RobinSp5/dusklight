// Cosmetics: theme palettes and the drawing helpers for the player's look (body, scarf, accessory,
// trail, death effect). Rendering only, no simulation state. The look object comes from shop.js lookFor().
//
// Animated colours rotate the hue at a fixed perceived lightness (OKLCH, converted to sRGB here), so
// rainbow items never flash bright/dark. renderer.reduced slows every animation 4x and thins particles.

// ---------- themes ----------
// Each world needs: a dark sky (white player + white text stay readable), a bright accent
// (contrast >= 4.5:1 against the UI background #0b0a10) and a pale accent2 for highlights.
export const THEMES = {
  dusk: {
    name: 'Dusk',
    ember: { skyTop: '#1c0c17', skyBot: '#6e2b2b', far: '#4a1b2a', mid: '#2f1221', near: '#1a0a13', stone: '#1b1219', accent: '#ff8a4c', accent2: '#ffd38a', disc: '#ffb26b' },
    frost: { skyTop: '#050a18', skyBot: '#1b4668', far: '#173456', mid: '#0f2442', near: '#08142b', stone: '#0e1524', accent: '#5ee0ff', accent2: '#d4f7ff', disc: '#e6f6ff' },
    css: { glut: '#ff8a4c', frost: '#5ee0ff' },
  },
  sakura: {
    name: 'Sakura & Ice',
    ember: { skyTop: '#1a0b19', skyBot: '#5c2448', far: '#45193b', mid: '#2e1029', near: '#190915', stone: '#1d1220', accent: '#ff8fb8', accent2: '#ffe0ec', disc: '#ffc4da' },
    frost: { skyTop: '#090e20', skyBot: '#33507a', far: '#25395c', mid: '#192843', near: '#0c1528', stone: '#111a2b', accent: '#8ecbff', accent2: '#eaf6ff', disc: '#f2f8ff' },
    css: { glut: '#ff8fb8', frost: '#8ecbff' },
  },
  neon: {
    name: 'Neon Night',
    ember: { skyTop: '#12031b', skyBot: '#4a0d55', far: '#3a0b46', mid: '#25072f', near: '#13041a', stone: '#170a1e', accent: '#ff4fd8', accent2: '#ffc2f2', disc: '#ff8ae6' },
    frost: { skyTop: '#020f14', skyBot: '#0a4048', far: '#0a3138', mid: '#062228', near: '#031318', stone: '#0a1619', accent: '#3dffc8', accent2: '#d0fff0', disc: '#b4ffe8' },
    css: { glut: '#ff4fd8', frost: '#3dffc8' },
  },
  goldvoid: {
    name: 'Gold & Void',
    ember: { skyTop: '#120c04', skyBot: '#4d3610', far: '#3b290c', mid: '#271b08', near: '#140e04', stone: '#19130a', accent: '#ffc94d', accent2: '#fff0c2', disc: '#ffe08a' },
    frost: { skyTop: '#06040f', skyBot: '#261b4a', far: '#1d1539', mid: '#140e29', near: '#0a0716', stone: '#100c1c', accent: '#b18cff', accent2: '#ece3ff', disc: '#d9ccff' },
    css: { glut: '#ffc94d', frost: '#b18cff' },
  },
};

// ---------- look ----------
const KINDS = {
  body: ['solid', 'shifter', 'aurora', 'prism', 'supernova'],
  scarf: ['world', 'solid', 'aurora', 'starlight', 'comet', 'rainbow', 'phoenix'],
  hat: ['none', 'antenna', 'horns', 'halo', 'lantern', 'crown', 'wings', 'orbit'],
  trail: ['none', 'embers', 'snow', 'stardust', 'echo', 'prism'],
  death: ['classic', 'confetti', 'shatter', 'blackhole', 'fireworks'],
};
const HEX = /^#[0-9a-f]{6}$/i;
export const DEFAULT_LOOK = {
  body: { kind: 'solid', color: '#f3efe7', visor: '#16131c', outline: false },
  scarf: { kind: 'world' },
  hat: 'none', trail: 'none', death: 'classic', theme: 'dusk',
};

// Anything unknown falls back to the default, so a bad look can never break the frame loop.
export function normalizeLook(look) {
  const l = look && typeof look === 'object' ? look : {};
  const b = l.body && typeof l.body === 'object' ? l.body : {};
  const s = l.scarf && typeof l.scarf === 'object' ? l.scarf : {};
  const pick = (part, v) => (KINDS[part].includes(v) ? v : DEFAULT_LOOK[part]);
  return {
    body: {
      kind: KINDS.body.includes(b.kind) ? b.kind : 'solid',
      color: HEX.test(b.color) ? b.color : DEFAULT_LOOK.body.color,
      visor: HEX.test(b.visor) ? b.visor : DEFAULT_LOOK.body.visor,
      outline: !!b.outline,
    },
    scarf: { kind: KINDS.scarf.includes(s.kind) ? s.kind : 'world', color: HEX.test(s.color) ? s.color : null },
    hat: pick('hat', l.hat), trail: pick('trail', l.trail), death: pick('death', l.death),
    theme: THEMES[l.theme] ? l.theme : 'dusk',
  };
}

// The pre-shop renderer.skin shape ({ body: '#hex' | 'prism', visor, outline, scarf: null | '#hex' | name, hat }).
export function lookFromSkin(skin) {
  const s = skin && typeof skin === 'object' ? skin : {};
  const body = s.body === 'prism' ? { kind: 'prism' } : { kind: 'solid', color: s.body };
  const scarf = !s.scarf ? { kind: 'world' } : HEX.test(s.scarf) ? { kind: 'solid', color: s.scarf } : { kind: s.scarf };
  return normalizeLook({ body: { ...body, visor: s.visor, outline: s.outline }, scarf, hat: s.hat });
}

// ---------- colour ----------
// OKLCH -> sRGB. Constant L keeps perceived brightness steady while the hue turns.
const hueCache = new Map();
export function hueRGB(h, L = 0.84, C = 0.12) {
  const hi = ((Math.round(h) % 360) + 360) % 360;
  const key = hi * 1e6 + Math.round(L * 1000) * 1e3 + Math.round(C * 1000);
  let v = hueCache.get(key);
  if (v) return v;
  const r = (hi * Math.PI) / 180, a = C * Math.cos(r), b = C * Math.sin(r);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  v = lin.map((c) => {
    const x = Math.min(1, Math.max(0, c));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  });
  hueCache.set(key, v);
  return v;
}
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
const TAU = Math.PI * 2;

// Animation clock: 4x slower with reduced effects.
const clock = (r) => (r.reduced ? r.time / 4 : r.time);
// Particle budget multiplier for continuous emitters.
const budget = (r) => (r.reduced ? 0.3 : 1);

// Hue of the rainbow bodies at this moment (degrees).
function bodyHue(r, kind) {
  const c = clock(r);
  if (kind === 'aurora') return 150 + c * 0.06 * 360;
  return c * 0.5 * 360; // prism, supernova
}

// Main colour of the body as [r, g, b] (also used for particles and death bits).
export function bodyRGB(r, body, t) {
  switch (body.kind) {
    case 'shifter': return mix(r.pal('accent', t), r.pal('accent2', t), 0.42);
    case 'aurora': return hueRGB(bodyHue(r, 'aurora'), 0.86, 0.1);
    case 'prism': case 'supernova': return hueRGB(bodyHue(r, body.kind), 0.82, 0.15);
    default: return r.rgbOf(body.color);
  }
}

// Fill style for the body rectangle in local player space (feet at 0, head at -H).
export function bodyFill(r, ctx, body, t, W, H) {
  if (body.kind === 'solid') return body.color;
  if (body.kind === 'shifter') return rgba(bodyRGB(r, body, t));
  const h = bodyHue(r, body.kind);
  const span = body.kind === 'aurora' ? 55 : body.kind === 'prism' ? 110 : 150;
  const L = body.kind === 'aurora' ? 0.86 : 0.82, C = body.kind === 'aurora' ? 0.1 : 0.15;
  const g = ctx.createLinearGradient(-W / 2, -H, W / 2, 0);
  g.addColorStop(0, rgba(hueRGB(h, L, C)));
  g.addColorStop(0.5, rgba(hueRGB(h + span / 2, L, C)));
  g.addColorStop(1, rgba(hueRGB(h + span, L, C)));
  return g;
}

// A soft radial glow in any colour (for things whose colour changes every frame).
export function softGlow(ctx, x, y, rad, c, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.3, rgba(c, a * 0.4));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

// Supernova halo (behind the scarf) with a soft 1 Hz pulse.
export function drawAura(r, ctx, body, cx, cy) {
  if (body.kind !== 'supernova') return;
  const c = clock(r);
  const pulse = 0.5 + 0.5 * Math.sin(c * TAU);
  ctx.globalCompositeOperation = 'lighter';
  softGlow(ctx, cx, cy, 34 + 5 * pulse, hueRGB(bodyHue(r, 'supernova') + 40, 0.8, 0.14), 0.26 + 0.14 * pulse);
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- scarf ----------
export const scarfLength = (kind) => (kind === 'comet' ? 12 : kind === 'phoenix' ? 10 : kind === 'rainbow' ? 9 : 7);

const FLAME = ['#fff1b8', '#ffd25a', '#ffa23a', '#ff6a2a', '#f0403e', '#c92a4f'];
function flameRGB(r, k) {
  const x = Math.min(FLAME.length - 1.001, k * (FLAME.length - 1));
  const i = Math.floor(x);
  return mix(r.rgbOf(FLAME[i]), r.rgbOf(FLAME[i + 1]), x - i);
}

// Outline of a tapered ribbon through pts (round tip, flat end at the neck, hidden by the body).
function ribbon(ctx, pts, widthAt) {
  const n = pts.length, L = [], R = [];
  let nx = 0, ny = 1;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > 1e-3) { nx = -dy / d; ny = dx / d; }
    const h = widthAt(i) / 2;
    L.push([pts[i].x + nx * h, pts[i].y + ny * h]);
    R.push([pts[i].x - nx * h, pts[i].y - ny * h]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  const a0 = Math.atan2(ny, nx);
  ctx.arc(pts[n - 1].x, pts[n - 1].y, widthAt(n - 1) / 2, a0, a0 - Math.PI, true);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}

export function drawScarf(r, ctx, scarf, pts, t) {
  const kind = scarf.kind, n = pts.length, c = clock(r);
  ctx.lineCap = 'round';
  const tail = pts[n - 1];
  if (kind === 'starlight' || kind === 'comet' || kind === 'phoenix') {
    ctx.globalCompositeOperation = 'lighter';
    if (kind === 'starlight') r.drawGlow('accent2', tail.x, tail.y, 14, 0.7, t);
    else if (kind === 'comet') softGlow(ctx, tail.x, tail.y, 16, [150, 225, 255], 0.55);
    else if (kind === 'phoenix') softGlow(ctx, pts[(n / 2) | 0].x, pts[(n / 2) | 0].y, 22, r.rgbOf('#ff8a3a'), 0.35);
    ctx.globalCompositeOperation = 'source-over';
  }
  // the scarf itself: one tapered ribbon filled with a colour gradient from neck to tip
  let widthAt = (i) => 5 - i * 0.5;
  let fill;
  const grad = (stops) => {
    const g = ctx.createLinearGradient(pts[0].x, pts[0].y, tail.x + 0.5, tail.y + 0.5);
    stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
    return g;
  };
  const steps = (m, f) => Array.from({ length: m }, (_, i) => f(i / (m - 1)));
  switch (kind) {
    case 'solid': fill = scarf.color || r.css(r.pal('accent', t)); break;
    case 'aurora': {
      const A = r.rgbOf(r.P[0].accent), B = r.rgbOf(r.P[1].accent);
      fill = grad(steps(5, (k) => rgba(mix(A, B, 0.5 + 0.5 * Math.sin(c * 0.9 - k * (n - 1) * 0.55)))));
      break;
    }
    case 'starlight': fill = '#fff6d6'; break;
    case 'comet':
      fill = grad(['#fafdff', '#c4e6ff', '#60b2f0']);
      widthAt = (i) => 5.2 - (i / (n - 1)) * 3.8;
      break;
    case 'rainbow':
      fill = grad(steps(6, (k) => rgba(hueRGB(c * 180 + k * (n - 1) * 30, 0.84, 0.14))));
      widthAt = (i) => 5.4 - (i / (n - 1)) * 2.8;
      break;
    case 'phoenix':
      fill = grad(FLAME);
      // flames flicker in width, never in brightness
      widthAt = (i) => 6 - (i / (n - 1)) * 3.4 + (r.reduced ? 0 : Math.sin(r.time * 13 + i * 1.7) * 0.7);
      break;
    default: fill = r.css(r.pal('accent', t));
  }
  ribbon(ctx, pts, (i) => Math.max(0.8, widthAt(i)));
  ctx.fillStyle = fill;
  // the light scarves glow a little (shadowBlur is in device pixels, so scale it)
  const glow = kind === 'rainbow' ? rgba(hueRGB(c * 180 + 60, 0.8, 0.14), 0.8)
    : kind === 'comet' ? 'rgba(130,205,255,0.7)' : kind === 'phoenix' ? 'rgba(255,120,50,0.7)' : null;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 7 * r.scale * r.dpr; }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  // starlight: a tiny four-point star at the tip
  if (kind === 'starlight') {
    ctx.globalCompositeOperation = 'lighter';
    drawSparkle(ctx, tail.x, tail.y, 4 + Math.sin(c * 3) * 1, c * 1.5, '#fff6d6');
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Particles shed by the fancy scarves (called every frame from update).
export function scarfParticles(r, scarf, pts, dt, moving) {
  if (!pts) return;
  const tail = pts[pts.length - 1];
  if (scarf.kind === 'phoenix') {
    r.trickle('phoenix', dt, 9 * budget(r), () => r.particles.push(particle({
      x: tail.x + (Math.random() - 0.5) * 6, y: tail.y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 0.5 + Math.random() * 0.5,
      size: 1.6 + Math.random() * 1.6, color: rgba(flameRGB(r, 0.2 + Math.random() * 0.6)), g: -40, drag: 1.2, glow: true,
    })));
  } else if (scarf.kind === 'comet' && moving) {
    r.trickle('comet', dt, 14 * budget(r), () => r.particles.push(particle({
      x: tail.x, y: tail.y, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0.35 + Math.random() * 0.3,
      size: 1.4 + Math.random(), color: 'rgba(190,235,255,0.9)', drag: 2, glow: true,
    })));
  } else if (scarf.kind === 'starlight') {
    r.trickle('starlight', dt, 2.5 * budget(r), () => r.particles.push(particle({
      x: tail.x + (Math.random() - 0.5) * 10, y: tail.y + (Math.random() - 0.5) * 10, vx: 0, vy: -8, life: 0.7,
      size: 4, color: '#fff6d6', drag: 1, glow: true, shape: 'star',
    })));
  }
}

// ---------- body extras ----------
export function bodyParticles(r, body, cx, cy, dt) {
  if (body.kind !== 'supernova') return;
  r.trickle('supernova', dt, 5 * budget(r), () => {
    const a = Math.random() * TAU, d = 10 + Math.random() * 14;
    r.particles.push(particle({
      x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 1.2, vx: 0, vy: -12, life: 0.6 + Math.random() * 0.4,
      size: 4 + Math.random() * 3, color: rgba(hueRGB(bodyHue(r, 'supernova') + Math.random() * 120, 0.88, 0.1)),
      drag: 1, glow: true, shape: 'star', rot: Math.random() * TAU, vr: 1.5,
    }));
  });
}

// Four-point sparkle centred on (x, y).
export function drawSparkle(ctx, x, y, s, rot, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, d = i % 2 ? s * 0.28 : s;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------- accessories ----------
// Drawn in the player's local space (origin at the feet, top of the head at -H).
// layer 'back' is drawn before the body, 'front' after it (only the orbit uses both).
export function drawHat(r, ctx, hat, layer, facing, t, H, visor) {
  const time = r.time;
  if (hat === 'orbit') return drawOrbit(r, ctx, layer, H, t);
  if (layer !== 'back') return;
  if (hat === 'antenna') {
    ctx.strokeStyle = visor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-facing * 2, -H + 1);
    ctx.quadraticCurveTo(-facing * 3, -H - 6, -facing * 6, -H - 10);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    r.drawGlow('accent', -facing * 6, -H - 10, 10, 0.9, t);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = r.css(r.pal('accent2', t));
    ctx.beginPath(); ctx.arc(-facing * 6, -H - 10, 2.6, 0, TAU); ctx.fill();
  } else if (hat === 'horns') {
    ctx.fillStyle = '#2b2533';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 3, -H + 2);
      ctx.quadraticCurveTo(side * 10, -H - 2, side * 9, -H - 9);
      ctx.quadraticCurveTo(side * 6, -H - 3, side * 8, -H + 3);
      ctx.closePath();
      ctx.fill();
    }
  } else if (hat === 'halo') {
    const bob = r.reduced ? 0 : Math.sin(time * 3) * 1.2;
    ctx.globalCompositeOperation = 'lighter';
    r.drawGlow('accent2', 0, -H - 7 + bob, 16, 0.5, t);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffd36b';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -H - 7 + bob, 8, 2.6, 0, 0, TAU); ctx.stroke();
  } else if (hat === 'lantern') {
    const sway = r.reduced ? 0 : Math.sin(time * 2.2) * 2;
    ctx.strokeStyle = visor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(facing * 4, -H + 1); ctx.lineTo(facing * 4 + sway, -H - 11); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    r.drawGlow('accent', facing * 4 + sway, -H - 14, 18, 0.9, t);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffe2a8';
    ctx.fillRect(facing * 4 + sway - 3, -H - 18, 6, 7);
  } else if (hat === 'wings') {
    const flap = r.reduced ? 0 : Math.sin(time * 9) * 0.35;
    ctx.fillStyle = 'rgba(243,239,231,0.9)';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 9, -H + 10);
      ctx.rotate(side * (0.5 + flap));
      ctx.beginPath();
      ctx.ellipse(side * 6, 0, 8, 3.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  } else if (hat === 'crown') {
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.moveTo(-7, -H + 2); ctx.lineTo(-7, -H - 6); ctx.lineTo(-3.5, -H - 2); ctx.lineTo(0, -H - 8);
    ctx.lineTo(3.5, -H - 2); ctx.lineTo(7, -H - 6); ctx.lineTo(7, -H + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = r.css(r.pal('accent', t));
    ctx.beginPath(); ctx.arc(0, -H - 1.5, 1.6, 0, TAU); ctx.fill();
  }
}

// Two moons circle the head on a tilted ellipse: one in the Ember colour, one in the Frost colour.
// The half of the orbit behind the head is drawn in the back layer.
function drawOrbit(r, ctx, layer, H, t) {
  const c = clock(r);
  const cy = -H + 7, rx = 15, ry = 4.5, tilt = -0.18;
  if (layer === 'back') {
    // faint orbit path
    ctx.save();
    ctx.translate(0, cy);
    ctx.rotate(tilt);
    ctx.strokeStyle = r.css(r.pal('accent2', t), 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  for (let m = 0; m < 2; m++) {
    const a = c * 0.6 * TAU + m * Math.PI;
    const front = Math.sin(a) > 0;
    if (front !== (layer === 'front')) continue;
    const ox = Math.cos(a) * rx, oy = Math.sin(a) * ry;
    const x = ox * Math.cos(tilt) - oy * Math.sin(tilt);
    const y = cy + ox * Math.sin(tilt) + oy * Math.cos(tilt);
    const P = r.P[m];
    const depth = front ? 1 : 0.72; // moons behind the head look a touch smaller
    ctx.globalCompositeOperation = 'lighter';
    softGlow(ctx, x, y, 11 * depth, r.rgbOf(P.accent), 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = P.accent2;
    ctx.beginPath(); ctx.arc(x, y, 3 * depth, 0, TAU); ctx.fill();
    ctx.fillStyle = r.css(r.rgbOf(P.accent), 0.85);
    ctx.beginPath(); ctx.arc(x + 0.8 * depth, y + 0.6 * depth, 2 * depth, 0, TAU); ctx.fill();
  }
}

// ---------- particles ----------
// Fills in the defaults of the shared particle record.
export function particle(o) {
  return {
    x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, life: o.life, max: o.life, size: o.size || 3, color: o.color,
    g: o.g || 0, drag: o.drag ?? 2, glow: !!o.glow, shape: o.shape || null, rot: o.rot || 0, vr: o.vr || 0, pull: o.pull || null,
  };
}

// ---------- trails ----------
// Called every frame while the player is visible. fx = feet x, fy = feet y.
export function trailParticles(r, kind, p, fx, fy, dt, t) {
  const speed = Math.hypot(p.vx, p.vy);
  if (speed <= 40 || kind === 'none') return;
  if (kind === 'prism') r.ribbon.push({ x: fx, y: fy - 3, life: 0.42, max: 0.42, h: clock(r) * 600 }); // ~250 deg along the ribbon
  const rate = Math.min(1, speed / 420) * budget(r);
  const jitter = () => (Math.random() - 0.5);
  switch (kind) {
    case 'embers':
      r.trickle('trail', dt, 50 * rate, () => r.particles.push(particle({
        x: fx + jitter() * 10, y: fy - 2, vx: jitter() * 40 - p.vx * 0.1, vy: -30 - Math.random() * 40, life: 0.45 + Math.random() * 0.4,
        size: 1.6 + Math.random() * 1.8, color: rgba(flameRGB(r, 0.15 + Math.random() * 0.7)), g: -50, drag: 1.5, glow: true,
      })));
      break;
    case 'snow':
      r.trickle('trail', dt, 38 * rate, () => r.particles.push(particle({
        x: fx + jitter() * 14, y: fy - 4 - Math.random() * 10, vx: jitter() * 30 - p.vx * 0.08, vy: 10 + Math.random() * 20, life: 0.8 + Math.random() * 0.5,
        size: 1.8 + Math.random() * 1.8, color: 'rgba(240,248,255,0.9)', g: 30, drag: 2.5, shape: 'flake',
      })));
      break;
    case 'stardust':
      r.trickle('trail', dt, 32 * rate, () => r.particles.push(particle({
        x: fx + jitter() * 12, y: fy - 2 - Math.random() * 8, vx: jitter() * 20, vy: -10 - Math.random() * 15, life: 0.5 + Math.random() * 0.5,
        size: 3 + Math.random() * 3, color: Math.random() < 0.5 ? '#fff3c4' : r.css(r.pal('accent2', t)), drag: 2, glow: true,
        shape: 'star', rot: Math.random() * TAU, vr: 2,
      })));
      break;
    case 'echo':
      r.trickle('trail', dt, 16 * Math.min(1, speed / 300) * (r.reduced ? 0.5 : 1), () => r.after.push({ x: p.x, y: p.y, life: 0.3, max: 0.3, echo: true }));
      break;
    case 'prism':
      r.trickle('trail', dt, 8 * rate, () => r.particles.push(particle({
        x: fx + jitter() * 8, y: fy - 3, vx: jitter() * 30, vy: -10 - Math.random() * 20, life: 0.5,
        size: 3.5 + Math.random() * 2, color: rgba(hueRGB(clock(r) * 360 + Math.random() * 60, 0.86, 0.12)), drag: 2, glow: true,
        shape: 'star', rot: Math.random() * TAU, vr: 2,
      })));
      break;
    default:
  }
}

// Rainbow ribbon from the recent foot positions: one tapered shape, thick at the newest point.
export function drawRibbon(r, ctx) {
  const n = r.ribbon.length;
  if (n < 2) return;
  const pts = r.ribbon.slice().reverse(); // newest first
  const head = pts[0], tail = pts[n - 1];
  const g = ctx.createLinearGradient(head.x, head.y, tail.x + 0.5, tail.y + 0.5);
  for (let i = 0; i < 5; i++) {
    const q = pts[Math.round((i / 4) * (n - 1))];
    g.addColorStop(i / 4, rgba(hueRGB(q.h, 0.82, 0.14), 0.9 * Math.min(1, (q.life / q.max) * 1.6)));
  }
  ribbon(ctx, pts, (i) => 0.6 + 4.4 * (pts[i].life / pts[i].max));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.shadowColor = rgba(hueRGB(head.h, 0.8, 0.14), 0.8);
  ctx.shadowBlur = 8 * r.scale * r.dpr;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- death effects ----------
// Variants of the classic 'die' burst. bodyColor is a CSS colour, acc/acc2 the world accents.
export function deathFx(r, kind, e, t, bodyColor) {
  const acc = r.css(r.pal('accent', t)), acc2 = r.css(r.pal('accent2', t));
  const n = (k) => Math.ceil(k * (r.reduced ? 0.5 : 1));
  const rnd = (a, b) => a + Math.random() * (b - a);
  switch (kind) {
    case 'confetti': {
      r.addShake(6);
      r.flash = 0.3;
      for (let i = 0; i < n(46); i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = rnd(150, 380);
        r.particles.push(particle({
          x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(1.1, 1.7), size: rnd(5, 7.5),
          color: rgba(hueRGB((i * 47) % 360, 0.8, 0.15)), g: 520, drag: 1.6, shape: 'confetti', rot: Math.random() * TAU, vr: rnd(-14, 14),
        }));
      }
      r.emit(8, { x: e.x, y: e.y, speed: 160, color: bodyColor, size: 3, g: 500, life: 0.6, drag: 1.5 });
      break;
    }
    case 'shatter': {
      r.addShake(12);
      r.flash = 0.5;
      for (let i = 0; i < n(16); i++) {
        const a = Math.random() * TAU, sp = rnd(140, 340);
        r.particles.push(particle({
          x: e.x + rnd(-8, 8), y: e.y + rnd(-12, 12), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: rnd(0.8, 1.2),
          size: rnd(5, 9), color: bodyColor, g: 800, drag: 0.8, shape: 'tri', rot: Math.random() * TAU, vr: rnd(-10, 10),
        }));
      }
      r.emit(14, { x: e.x, y: e.y, speed: 260, color: acc2, size: 2, life: 0.5, glow: true, drag: 2 });
      r.rings.push({ x: e.x, y: e.y, r: 4, life: 0.3, max: 0.3, color: '#f3efe7', w: 1.5, grow: 40 });
      break;
    }
    case 'blackhole': {
      r.addShake(5);
      r.rings.push({ x: e.x, y: e.y, r: 22, life: 1.0, max: 1.0, color: acc, rgb: r.pal('accent', t), w: 2, hole: true });
      for (let i = 0; i < n(34); i++) {
        const a = Math.random() * TAU, d = rnd(36, 86), tang = rnd(90, 150);
        r.particles.push(particle({
          x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d,
          vx: -Math.sin(a) * tang, vy: Math.cos(a) * tang, life: rnd(0.6, 0.95), size: rnd(1.8, 3.2),
          color: i % 3 ? acc : acc2, drag: 0.6, glow: true, pull: { x: e.x, y: e.y, k: 1400 },
        }));
      }
      // the body is torn apart and swallowed first
      for (let i = 0; i < n(10); i++) {
        const a = Math.random() * TAU, sp = rnd(30, 80);
        r.particles.push(particle({
          x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.4, 0.6), size: rnd(2.5, 4),
          color: bodyColor, drag: 0.5, pull: { x: e.x, y: e.y, k: 1600 },
        }));
      }
      break;
    }
    case 'fireworks': {
      r.addShake(6);
      r.flash = 0.25;
      const base = Math.random() * 360;
      const bursts = [[0, 0, -6], [0.22, -36, -58], [0.42, 40, -46]];
      bursts.forEach(([delay, dx, dy], j) => {
        r.later(delay, () => {
          const x = e.x + dx, y = e.y + dy, h = base + j * 120;
          const col = hueRGB(h, 0.84, 0.15), core = hueRGB(h + 20, 0.93, 0.07);
          const k = n(32);
          for (let i = 0; i < k; i++) {
            const a = (i / k) * TAU + rnd(-0.1, 0.1), sp = rnd(150, 210);
            r.particles.push(particle({
              x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.8, 1.1), size: rnd(2.6, 3.8),
              color: rgba(i % 4 ? col : core), g: 170, drag: 1.7, glow: true,
            }));
          }
          for (let i = 0; i < n(6); i++) {
            r.particles.push(particle({
              x: x + rnd(-24, 24), y: y + rnd(-24, 24), vy: 20, life: rnd(0.5, 0.9), size: rnd(4, 6),
              color: rgba(core), drag: 1, glow: true, shape: 'star', rot: Math.random() * TAU, vr: 2,
            }));
          }
          r.rings.push({ x, y, r: 3, life: 0.35, max: 0.35, color: rgba(col), w: 1.2, grow: 26 });
        });
      });
      r.emit(10, { x: e.x, y: e.y, speed: 200, color: bodyColor, size: 3, g: 600, life: 0.7, drag: 1 });
      break;
    }
    default: // classic
      r.addShake(10);
      r.flash = 0.7;
      r.emit(20, { x: e.x, y: e.y, speed: 300, color: bodyColor, size: 4, g: 600, life: 0.9, drag: 1 });
      r.emit(16, { x: e.x, y: e.y, speed: 220, color: acc, size: 2.6, life: 0.7, glow: true });
  }
}

// Draws one particle; shapes beyond the default square come from the cosmetics.
export function drawParticleShape(ctx, p, k) {
  switch (p.shape) {
    case 'star': {
      const s = p.size * Math.sin(Math.PI * Math.min(1, (1 - k) * 1.4 + 0.15)); // grows in, shrinks out
      drawSparkle(ctx, p.x, p.y, Math.max(0.5, s), p.rot, p.color);
      return;
    }
    case 'confetti': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7)); // tumbling paper
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
      return;
    }
    case 'tri': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.size / 2); ctx.lineTo(p.size / 2, p.size / 2); ctx.lineTo(-p.size / 3, p.size / 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'flake': {
      const s = p.size;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, TAU); ctx.fill();
      return;
    }
    default: {
      const s = p.size * (0.5 + 0.5 * k);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
}

// Black hole: a dark disc with a glowing rim that opens and closes again.
export function drawHole(r, ctx, ring) {
  const k = 1 - ring.life / ring.max;
  const open = Math.sin(Math.PI * Math.min(1, k * 1.15));
  const rad = ring.r * open;
  if (rad < 0.5) return;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  softGlow(ctx, ring.x, ring.y, rad * 2.4, ring.rgb, 0.45 * open);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#040308';
  ctx.beginPath(); ctx.arc(ring.x, ring.y, rad, 0, TAU); ctx.fill();
  ctx.strokeStyle = ring.color;
  ctx.lineWidth = ring.w;
  ctx.globalAlpha = 0.9 * open;
  const spin = (r.reduced ? r.time / 4 : r.time) * 5;
  ctx.beginPath(); ctx.arc(ring.x, ring.y, rad + 1, spin, spin + Math.PI * 1.4); ctx.stroke();
  ctx.globalAlpha = 0.5 * open;
  ctx.beginPath(); ctx.arc(ring.x, ring.y, rad + 4, -spin * 0.7, -spin * 0.7 + Math.PI); ctx.stroke();
  ctx.globalAlpha = 1;
}
