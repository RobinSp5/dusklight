import { LEVELS, TILE as T } from './levels.js';
import { World, STEP, PHYS } from './world.js';
import { Renderer, drawMinimap } from './render.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { loadSettings, saveSettings } from './settings.js';
import { DEMOS, demoInput, demoActive } from './demos.js';

const $ = (s) => document.querySelector(s);
const R = new Renderer($('#game'));
const S = new Sound();
const I = new Input();

// One source of truth for every control: the title card and the settings table are built from it.
const CONTROLS = [
  { action: 'Move left', keys: ['A', '←'], pad: 'Left stick / D-pad', title: 'Move', titleKeys: ['A', 'D', '←', '→'] },
  { action: 'Move right', keys: ['D', '→'], pad: 'Left stick / D-pad' },
  { action: 'Jump (hold to jump higher)', keys: ['Space', 'W', '↑'], pad: 'A', title: 'Jump', titleKeys: ['Space', 'W'] },
  { action: 'Dash (once per jump)', keys: ['X', 'K'], pad: 'X / RT', title: 'Dash' },
  { action: 'Switch world', keys: ['Shift', 'J', 'C'], pad: 'B / Y / RB', title: 'Switch world', titleKeys: ['Shift', 'J'], hl: true },
  { action: 'Pause / resume', keys: ['Esc', 'P'], pad: 'Start', title: 'Pause, restart', titleKeys: ['Esc', 'R'] },
  { action: 'Restart level', keys: ['R'], pad: 'From the pause menu' },
  { action: 'Mute sound', keys: ['M'], pad: 'From settings' },
  { action: 'Menus', keys: ['Tab', 'Enter'], pad: 'Not supported' },
];

const settings = loadSettings();

// ---------- save ----------
const SAVE_KEY = 'zwielicht.save.v1'; // key kept from the first release so existing progress survives the rename
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && Number.isInteger(s.unlocked) && s.best && typeof s.best === 'object') {
      for (const k of Object.keys(s.best)) {
        const e = s.best[k];
        if (!e || !Number.isFinite(e.time) || !Number.isFinite(e.shards)) delete s.best[k];
      }
      s.unlocked = Math.min(Math.max(0, s.unlocked), LEVELS.length - 1);
      return s;
    }
  } catch { /* storage unavailable */ }
  return { unlocked: 0, best: {} };
}
let save = loadSave();
const writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ } };
const shardCount = LEVELS.map((l) => l.rows.join('').split('o').length - 1);

const secFmt = new Intl.NumberFormat('en-US', { minimumIntegerDigits: 2, minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt = (t) => {
  const m = Math.floor(t / 60);
  return `${m}:${secFmt.format(Math.floor((t - m * 60) * 10) / 10)}`;
};

// ---------- state ----------
let state = 'title';
let world = new World(LEVELS[0], 0);
R.setLevel(world);
const cam = { x: 0, y: 0 };
let phaseT = 0;
let acc = 0;
let last = performance.now();
let time = 0;
let attractSwap = 4.5;
let winTimer = -1;
let touchMode = matchMedia('(pointer: coarse)').matches;
let settingsFrom = 'title';

const screens = {
  title: $('#screenTitle'),
  select: $('#screenSelect'),
  pause: $('#screenPause'),
  complete: $('#screenComplete'),
  finale: $('#screenFinale'),
  settings: $('#screenSettings'),
  onboarding: $('#screenOnboard'),
};
const isAttract = () => state === 'title' || state === 'select' || state === 'onboarding' || (state === 'settings' && settingsFrom === 'title');

function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  const playing = state === 'play' || state === 'pause' || state === 'complete' || (state === 'settings' && settingsFrom === 'pause');
  $('#hud').hidden = !playing;
  $('#touch').hidden = !(touchMode && state === 'play');
  R.setBottomPad(touchMode && state === 'play' ? 120 : 0);
  I.enabled = state === 'play';
  if (name) {
    const f = screens[name].querySelector('[data-autofocus]') || screens[name].querySelector('button:not(:disabled)');
    if (f) requestAnimationFrame(() => f.focus({ preventScroll: true }));
  } else if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function setAccent(p) {
  document.documentElement.style.setProperty('--accent', p ? 'var(--frost)' : 'var(--glut)');
  $('#phasePill').dataset.phase = String(p);
  $('#phasePill').setAttribute('aria-label', `Active world: ${p ? 'Frost' : 'Ember'}`);
}

function snapCamera() {
  updateCamera(1, true);
}

function startLevel(i) {
  S.init();
  world = new World(LEVELS[i], i);
  R.setLevel(world);
  phaseT = world.phase;
  setAccent(world.phase);
  S.setPhase(world.phase);
  winTimer = -1;
  acc = 0;
  state = 'play';
  I.clearEdges();
  show(null);
  snapCamera();
  hudCache = {};
  $('#hudLevel').textContent = `${i + 1}  ${LEVELS[i].name}`;
}

function pause() {
  if (state !== 'play' || world.won) return;
  state = 'pause';
  show('pause');
}
function resume() {
  if (state !== 'pause') return;
  state = 'play';
  S.init();
  I.clearEdges();
  last = performance.now();
  show(null);
}

function toTitle() {
  state = 'title';
  world = new World(LEVELS[0], 0);
  R.setLevel(world);
  setAccent(world.phase);
  S.setPhase(world.phase);
  attractSwap = 4.5;
  updatePlayLabel();
  show('title');
}

function openSelect() {
  S.init();
  buildSelect();
  state = 'select';
  show('select');
}

function nextUnplayed() {
  const i = LEVELS.findIndex((_, k) => !save.best[k]);
  return i === -1 ? 0 : i;
}
function updatePlayLabel() {
  const i = nextUnplayed();
  $('#btnPlayLabel').textContent = i > 0 ? `Continue: level ${i + 1}` : 'Play';
}

function finishLevel() {
  const i = world.index;
  const t = world.time;
  const prev = save.best[i];
  const isBest = !prev || t < prev.time;
  save.best[i] = { time: isBest ? t : prev.time, shards: Math.max(prev ? prev.shards : 0, world.collected) };
  save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
  writeSave();

  $('#completeTitle').textContent = `${LEVELS[i].name} cleared`;
  $('#stTime').textContent = fmt(t);
  $('#stShards').textContent = `${world.collected}/${world.shards.length}`;
  $('#stDeaths').textContent = String(world.deaths);
  $('#bestBadge').hidden = !(isBest && prev);
  $('#btnNext').textContent = i === LEVELS.length - 1 ? 'See your results' : 'Next level';
  state = 'complete';
  show('complete');
}

function next() {
  const i = world.index;
  if (i === LEVELS.length - 1) {
    const total = LEVELS.reduce((s, _, k) => s + (save.best[k] ? save.best[k].time : 0), 0);
    const shards = LEVELS.reduce((s, _, k) => s + (save.best[k] ? save.best[k].shards : 0), 0);
    $('#fnTime').textContent = fmt(total);
    $('#fnShards').textContent = `${shards}/${shardCount.reduce((a, b) => a + b, 0)}`;
    state = 'finale';
    show('finale');
  } else {
    startLevel(i + 1);
  }
}

function toggleMute() {
  S.init();
  settings.muted = !settings.muted;
  applySettings();
}

// ---------- settings ----------
function applySettings() {
  S.apply(settings);
  R.shakeOn = settings.shake;
  R.reduced = settings.reducedFx;
  $('#hudTimeStat').hidden = !settings.showTimer;
  for (const id of ['#btnMute', '#btnMuteHud']) {
    const b = $(id);
    b.setAttribute('aria-label', settings.muted ? 'Unmute sound' : 'Mute sound');
    b.querySelector('i').className = `ph-bold ${settings.muted ? 'ph-speaker-slash' : 'ph-speaker-high'}`;
  }
  syncSettingsUI();
  saveSettings(settings);
}

const RANGES = [['master', '#setMaster', '#outMaster'], ['music', '#setMusic', '#outMusic'], ['sfx', '#setSfx', '#outSfx']];
const SWITCHES = [['muted', '#setMuted'], ['shake', '#setShake'], ['reducedFx', '#setReduced'], ['showTimer', '#setTimer']];

function syncSettingsUI() {
  for (const [k, input, out] of RANGES) {
    $(input).value = String(settings[k]);
    $(out).textContent = `${settings[k]}%`;
  }
  for (const [k, input] of SWITCHES) $(input).checked = settings[k];
}

function openSettings() {
  S.init();
  settingsFrom = state === 'pause' ? 'pause' : 'title';
  $('#resetConfirm').hidden = true;
  $('#resetDone').hidden = true;
  $('#btnReset').hidden = false;
  $('#btnReplayTutorial').hidden = state === 'pause'; // the tutorial replaces the title backdrop, so only offer it from there
  state = 'settings';
  show('settings');
}

function closeSettings() {
  if (state !== 'settings') return;
  state = settingsFrom;
  show(settingsFrom);
}

function kbdList(keys) {
  return keys.map((k) => {
    const el = document.createElement('kbd');
    el.textContent = k;
    return el;
  });
}

function buildControls() {
  const body = $('#keysBody');
  body.replaceChildren();
  for (const c of CONTROLS) {
    const tr = document.createElement('tr');
    if (c.hl) tr.className = 'hl';
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = c.action;
    const kb = document.createElement('td');
    const set = document.createElement('span');
    set.className = 'kbd-set';
    set.append(...kbdList(c.keys));
    kb.append(set);
    const pad = document.createElement('td');
    pad.textContent = c.pad;
    tr.append(th, kb, pad);
    body.append(tr);
  }
  const dl = $('#titleControls');
  dl.replaceChildren();
  for (const c of CONTROLS.filter((x) => x.title)) {
    const row = document.createElement('div');
    if (c.hl) row.className = 'hl';
    const dt = document.createElement('dt');
    dt.textContent = c.title;
    const dd = document.createElement('dd');
    dd.append(...kbdList(c.titleKeys || c.keys));
    row.append(dt, dd);
    dl.append(row);
  }
}

function buildSelect() {
  const grid = $('#levelGrid');
  grid.replaceChildren();
  LEVELS.forEach((lv, i) => {
    const locked = i > save.unlocked;
    const best = save.best[i];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level-card';
    b.disabled = locked;
    b.style.setProperty('--i', i);
    const cv = document.createElement('canvas');
    cv.className = 'minimap';
    cv.setAttribute('aria-hidden', 'true');
    drawMinimap(cv, lv);
    const meta = document.createElement('div');
    const num = document.createElement('span');
    num.className = 'lc-num';
    num.textContent = `Level ${i + 1}`;
    const name = document.createElement('span');
    name.className = 'lc-name';
    name.textContent = lv.name;
    const info = document.createElement('span');
    info.className = 'lc-best';
    if (locked) info.innerHTML = '<i class="ph-bold ph-lock-simple" aria-hidden="true"></i>Locked';
    else if (best) info.textContent = `Best ${fmt(best.time)}, ${best.shards}/${shardCount[i]} shards`;
    else info.textContent = `${shardCount[i]} shards to find`;
    meta.append(num, name, info);
    b.append(cv, meta);
    b.setAttribute('aria-label', `Level ${i + 1}: ${lv.name}${locked ? ', locked' : ''}`);
    b.addEventListener('click', () => { S.play('ui'); startLevel(i); });
    grid.append(b);
  });
}

// ---------- onboarding ----------
const OB_KEY = 'dusklight.onboarded';
const ob = { i: 0, world: null, renderer: null, t: 0, acc: 0, phaseT: 0, cam: { x: 0, y: 0 }, replay: false, accent: -1 };

function onboardingSeen() {
  try { return localStorage.getItem(OB_KEY) === '1'; } catch { return false; }
}
function markOnboarded() {
  try { localStorage.setItem(OB_KEY, '1'); } catch { /* ignore */ }
}

function openOnboarding(replay = false) {
  ob.replay = replay;
  ob.accent = -1;
  state = 'onboarding';
  show('onboarding');
  if (!ob.renderer) ob.renderer = new Renderer($('#obCanvas'), { fit: true, viewH: 9 * T, minW: 360 });
  ob.renderer.resize();
  ob.renderer.shakeOn = settings.shake;
  ob.renderer.reduced = settings.reducedFx;
  const dots = $('#obDots');
  dots.replaceChildren(...DEMOS.map((d, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ob-dot';
    b.setAttribute('aria-label', `Step ${i + 1}: ${d.title}`);
    b.addEventListener('click', () => setStep(i));
    return b;
  }));
  $('#obTouch').hidden = !touchMode;
  setStep(0);
}

function restartDemo() {
  ob.world = new World(DEMOS[ob.i].level, 0);
  ob.renderer.setLevel(ob.world);
  ob.t = 0;
  ob.acc = 0;
  ob.phaseT = ob.world.phase;
  demoCamera(1, true);
}

function setStep(i) {
  const dir = i >= ob.i ? 'next' : 'prev';
  ob.i = i;
  const d = DEMOS[i];
  $('#obStep').textContent = `Step ${i + 1} of ${DEMOS.length}`;
  $('#obTitle').textContent = d.title;
  $('#obBody').textContent = d.body;
  $('#obBar').style.width = `${((i + 1) / DEMOS.length) * 100}%`;
  $('#obPrev').disabled = i === 0;
  const last = i === DEMOS.length - 1;
  $('#obNext').textContent = last ? (ob.replay ? 'Done' : 'Start playing') : 'Next';
  [...$('#obDots').children].forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
  $('#obKeys').replaceChildren(...d.keys.map(([label, act]) => {
    const k = document.createElement('kbd');
    k.textContent = label;
    k.dataset.act = act;
    return k;
  }));
  // restart the CSS entrance animations
  const copy = $('#obCopy'), stage = $('#obStage');
  copy.classList.remove('ob-in-next', 'ob-in-prev');
  stage.classList.remove('is-switching');
  void copy.offsetWidth;
  copy.classList.add(`ob-in-${dir}`);
  stage.classList.add('is-switching');
  restartDemo();
}

function obNext() {
  if (ob.i < DEMOS.length - 1) { S.play('ui'); setStep(ob.i + 1); return; }
  finishOnboarding(!ob.replay);
}
function obPrev() {
  if (ob.i > 0) setStep(ob.i - 1);
}
function finishOnboarding(play) {
  markOnboarded();
  S.init();
  if (play) startLevel(0);
  else toTitle();
}

function demoCamera(dt, snap = false) {
  const r = ob.renderer, w = ob.world;
  const lw = w.w * T, lh = w.h * T;
  let tx = w.player.x + PHYS.W / 2 - r.vw / 2 + 40;
  tx = lw <= r.vw ? (lw - r.vw) / 2 : Math.min(Math.max(tx, 0), lw - r.vw);
  const ty = lh - r.vh;
  if (snap) { ob.cam.x = tx; ob.cam.y = ty; return; }
  ob.cam.x += (tx - ob.cam.x) * Math.min(1, dt * 5);
  ob.cam.y = ty;
}

function updateOnboarding(dt) {
  const d = DEMOS[ob.i];
  ob.acc += dt;
  while (ob.acc >= STEP) {
    const prev = ob.t;
    ob.t += STEP;
    ob.world.update(STEP, demoInput(d, prev, ob.t));
    ob.acc -= STEP;
  }
  for (const e of ob.world.events) ob.renderer.fx(e, ob.phaseT);
  ob.world.events.length = 0;
  if (ob.t >= d.duration) restartDemo();
  ob.phaseT += (ob.world.phase - ob.phaseT) * Math.min(1, dt * 7);
  if (ob.accent !== ob.world.phase) { ob.accent = ob.world.phase; setAccent(ob.accent); }
  demoCamera(dt);
  ob.renderer.update(dt, ob.world, time);
  ob.renderer.render(ob.world, ob.cam, ob.phaseT, time, { showSigns: false });
  const on = demoActive(d, ob.t);
  for (const k of $('#obKeys').children) k.classList.toggle('is-pressed', on.has(k.dataset.act));
}

// ---------- events from the simulation ----------
function handleEvent(e) {
  R.fx(e, phaseT);
  S.play(e.type, e);
  if (e.type === 'swap') { setAccent(e.phase); S.setPhase(e.phase); }
  if (e.type === 'respawn') { setAccent(world.phase); S.setPhase(world.phase); }
  if (e.type === 'win') winTimer = 1.1;
}

// ---------- camera ----------
function updateCamera(dt, snap = false) {
  const lw = world.w * T, lh = world.h * T;
  let tx, ty;
  if (isAttract()) {
    const k = (Math.sin(time * 0.045 - Math.PI / 2) + 1) / 2;
    tx = k * Math.max(0, lw - R.vw);
    ty = 0;
  } else {
    const p = world.player;
    tx = p.x + PHYS.W / 2 + p.facing * 60 - R.vw / 2;
    ty = p.y + PHYS.H / 2 - R.vh / 2 - 24;
  }
  tx = lw <= R.vw ? (lw - R.vw) / 2 : Math.min(Math.max(tx, 0), lw - R.vw);
  ty = lh + R.bottomPad <= R.vh ? lh + R.bottomPad - R.vh : Math.min(Math.max(ty, 0), lh + R.bottomPad - R.vh);
  if (snap) { cam.x = tx; cam.y = ty; return; }
  const k = Math.min(1, dt * 6);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

// ---------- HUD ----------
let hudCache = {};
function setText(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  document.getElementById(id).textContent = v;
}
function updateHud() {
  if (state !== 'play' && state !== 'pause') return;
  setText('hudShards', `${world.collected}/${world.shards.length}`);
  setText('hudTime', fmt(world.time));
  setText('hudDeaths', String(world.deaths));
}

// ---------- loop ----------
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  I.pollGamepad();

  if (state === 'play') {
    acc += dt;
    while (acc >= STEP) {
      world.update(STEP, I.snapshot());
      I.consume();
      acc -= STEP;
    }
    for (const e of world.events) handleEvent(e);
    world.events.length = 0;
    if (winTimer > 0) {
      winTimer -= dt;
      if (winTimer <= 0) finishLevel();
    }
  } else if (state === 'onboarding') {
    updateOnboarding(dt);
  } else if (isAttract()) {
    attractSwap -= dt;
    if (attractSwap <= 0) {
      attractSwap = 4.5;
      world.phase = 1 - world.phase;
      S.setPhase(world.phase);
      setAccent(world.phase);
    }
  }

  const target = world.phase;
  const rate = R.reduced ? 20 : 6;
  phaseT += (target - phaseT) * Math.min(1, dt * rate);
  if (Math.abs(target - phaseT) < 0.001) phaseT = target;

  updateCamera(dt);
  R.update(dt, world, time);
  const attract = isAttract();
  R.render(world, cam, phaseT, time, { showPlayer: !attract, showSigns: !attract });
  S.tick(dt);
  updateHud();
  requestAnimationFrame(frame);
}

// ---------- wiring ----------
$('#btnPlay').addEventListener('click', () => { S.play('ui'); startLevel(nextUnplayed()); });
$('#btnLevels').addEventListener('click', () => { S.play('ui'); openSelect(); });
$('#btnBack').addEventListener('click', toTitle);
$('#btnResume').addEventListener('click', resume);
$('#btnRestart').addEventListener('click', () => startLevel(world.index));
$('#btnQuit').addEventListener('click', toTitle);
$('#btnNext').addEventListener('click', next);
$('#btnAgain').addEventListener('click', () => startLevel(world.index));
$('#btnFinaleMenu').addEventListener('click', toTitle);
$('#btnPause').addEventListener('click', pause);
$('#btnMute').addEventListener('click', toggleMute);
$('#btnMuteHud').addEventListener('click', toggleMute);
$('#btnSettings').addEventListener('click', () => { S.play('ui'); openSettings(); });
$('#btnPauseSettings').addEventListener('click', openSettings);
$('#btnSettingsBack').addEventListener('click', closeSettings);
$('#obNext').addEventListener('click', obNext);
$('#obPrev').addEventListener('click', obPrev);
$('#obSkip').addEventListener('click', () => finishOnboarding(false));
$('#btnReplayTutorial').addEventListener('click', () => openOnboarding(true));
for (const [k, input, out] of RANGES) {
  $(input).addEventListener('input', (e) => {
    settings[k] = Number(e.target.value);
    $(out).textContent = `${settings[k]}%`;
    S.apply(settings);
  });
  $(input).addEventListener('change', () => {
    applySettings();
    if (k !== 'music') S.play('collect', { n: 3 }); // audible preview at the new level
  });
}
for (const [k, input] of SWITCHES) {
  $(input).addEventListener('change', (e) => {
    settings[k] = e.target.checked;
    applySettings();
    if (k === 'muted' && !settings.muted) S.play('ui');
  });
}
$('#resetText').textContent = `Delete all best times and lock levels 2 to ${LEVELS.length} again? This cannot be undone.`;
$('#btnReset').addEventListener('click', () => {
  $('#btnReset').hidden = true;
  $('#resetDone').hidden = true;
  $('#resetConfirm').hidden = false;
  $('#btnResetNo').focus();
});
$('#btnResetNo').addEventListener('click', () => {
  $('#resetConfirm').hidden = true;
  $('#btnReset').hidden = false;
  $('#btnReset').focus();
});
$('#btnResetYes').addEventListener('click', () => {
  save = { unlocked: 0, best: {} };
  writeSave();
  updatePlayLabel();
  $('#resetConfirm').hidden = true;
  $('#btnReset').hidden = false;
  $('#resetDone').hidden = false;
  $('#btnReset').focus();
});
I.onPadPause = () => (state === 'play' ? pause() : state === 'pause' ? resume() : null);

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'play') pause();
    else if (state === 'pause') resume();
    else if (state === 'select') toTitle();
    else if (state === 'settings') closeSettings();
    else if (state === 'onboarding') finishOnboarding(false);
  } else if (state === 'onboarding' && e.code === 'ArrowRight') {
    obNext();
  } else if (state === 'onboarding' && e.code === 'ArrowLeft') {
    obPrev();
  } else if (e.code === 'KeyR' && state === 'play' && !world.won) {
    startLevel(world.index);
  } else if (e.code === 'KeyM') {
    toggleMute();
  }
});

document.querySelectorAll('.t-btn').forEach((b) => {
  const act = b.dataset.act;
  const up = () => { I.setVirtual(act, false); b.classList.remove('is-down'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    S.init();
    b.setPointerCapture(e.pointerId);
    I.setVirtual(act, true);
    b.classList.add('is-down');
  });
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
addEventListener('touchstart', () => {
  if (!touchMode) { touchMode = true; if (state === 'play') show(null); }
}, { passive: true });

addEventListener('resize', () => {
  R.resize();
  updateCamera(1, true);
  if (ob.renderer) { ob.renderer.resize(); if (ob.world) demoCamera(1, true); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); if (S.ctx) S.ctx.suspend(); }
});
addEventListener('pointerdown', () => S.init());

// Debug/test hook (read-only snapshot + level jump), used by the Playwright smoke test.
window.__dusklight = {
  get state() { return state; },
  get world() { return world; },
  startLevel,
  settings,
};

buildControls();
applySettings();
updatePlayLabel();
setAccent(0);
if (onboardingSeen()) show('title');
else openOnboarding(false);
snapCamera();
requestAnimationFrame(frame);
