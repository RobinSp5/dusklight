import { LEVELS, ACTS, TILE as T } from './levels.js';
import { World, STEP, PHYS } from './world.js';
import { Renderer, drawMinimap } from './render.js';
import { Sound } from './audio.js';
import { Input, keyLabel, rebind, DEFAULT_BINDINGS } from './input.js';
import { loadSettings, saveSettings } from './settings.js';
import { DEMOS, demoBody } from './demos.js';
import { DemoPlayer } from './demo-player.js';
import {
  PAR, starsFor, inputToMask, maskToInput, encodeRun, decodeRun, levelHash,
  SKINS, DEFAULT_SKIN, shardPoints, resolveSkin, skinStyle, addDeath, sanitizeGhosts, sanitizeDeaths,
} from './progress.js';

const $ = (s) => document.querySelector(s);
const settings = loadSettings();
const R = new Renderer($('#game'));
R.labelFor = (action) => signLabel(action);
const S = new Sound();
const I = new Input(settings.keys);

// Every control is listed here once; the settings table, title card and tutorial read from it.
const CONTROLS = [
  { id: 'left', label: 'Move left', pad: 'Left stick / D-pad' },
  { id: 'right', label: 'Move right', pad: 'Left stick / D-pad' },
  { id: 'jump', label: 'Jump (hold to jump higher)', pad: 'A' },
  { id: 'dash', label: 'Dash (once per jump)', pad: 'X / RT' },
  { id: 'swap', label: 'Switch world', pad: 'B / Y / RB', hl: true },
  { id: 'pause', label: 'Pause / resume', pad: 'Start' },
  { id: 'restart', label: 'Restart level', pad: 'From the pause menu' },
  { id: 'mute', label: 'Mute sound', pad: 'From settings' },
];
const TOUCH_ICON = { left: 'ph-caret-left', right: 'ph-caret-right', jump: 'ph-arrow-fat-up', dash: 'ph-lightning', swap: 'ph-swap' };
const primaryLabel = (action) => keyLabel(I.bindings[action][0]);
const TOUCH_SIGN = { left: '◀', right: '▶', jump: '[↑]', dash: '[↯]', swap: '[⇄]' };
const signLabel = (action) => (touchMode ? TOUCH_SIGN[action] : primaryLabel(action));

// ---------- persistent data ----------
const SAVE_KEY = 'zwielicht.save.v1'; // key kept from the first release so existing progress survives the rename
const GHOST_KEY = 'dusklight.ghosts.v1';
const DEATH_KEY = 'dusklight.deaths.v1';
const readJSON = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const writeJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

function loadSave() {
  const s = readJSON(SAVE_KEY);
  if (s && Number.isInteger(s.unlocked) && s.best && typeof s.best === 'object') {
    for (const k of Object.keys(s.best)) {
      const e = s.best[k];
      if (!e || !Number.isFinite(e.time) || !Number.isFinite(e.shards)) delete s.best[k];
      else e.deathless = !!e.deathless;
    }
    // a level counts as unlocked when the one before it was cleared (old saves stopped at level 8)
    const cleared = Object.keys(s.best).map((k) => Math.min(Number(k) + 1, LEVELS.length - 1));
    s.unlocked = Math.min(Math.max(0, s.unlocked, ...cleared), LEVELS.length - 1);
    s.skin = s.skin && typeof s.skin === 'object' ? s.skin : { ...DEFAULT_SKIN };
    return s;
  }
  return { unlocked: 0, best: {}, skin: { ...DEFAULT_SKIN } };
}
let save = loadSave();
const writeSave = () => writeJSON(SAVE_KEY, save);
let ghosts = sanitizeGhosts(readJSON(GHOST_KEY));
let deaths = sanitizeDeaths(readJSON(DEATH_KEY));
const shardCount = LEVELS.map((l) => l.rows.join('').split('o').length - 1);
const totalShards = shardCount.reduce((a, b) => a + b, 0);
const points = () => shardPoints(save.best);
const starsOf = (i) => starsFor(save.best[i], i, shardCount[i]);

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
let runMasks = []; // inputs of the current attempt, one per simulation step (for the ghost)
let ghost = null; // { world, masks, k }
let portraitDismissed = false;

const screens = {
  title: $('#screenTitle'),
  select: $('#screenSelect'),
  pause: $('#screenPause'),
  complete: $('#screenComplete'),
  finale: $('#screenFinale'),
  settings: $('#screenSettings'),
  onboarding: $('#screenOnboard'),
  wardrobe: $('#screenWardrobe'),
};
const isAttract = () => ['title', 'select', 'onboarding', 'wardrobe'].includes(state) || (state === 'settings' && settingsFrom === 'title');

function show(name) {
  if (name !== 'settings') cancelCapture();
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  const playing = state === 'play' || state === 'pause' || state === 'complete' || (state === 'settings' && settingsFrom === 'pause');
  $('#hud').hidden = !playing;
  $('#touch').hidden = !(touchMode && state === 'play');
  R.setBottomPad(touchMode && state === 'play' ? 120 : 0);
  I.enabled = state === 'play';
  updatePortraitHint();
  if (name) {
    const f = screens[name].querySelector('[data-autofocus]') || screens[name].querySelector('button:not(:disabled)');
    if (f) requestAnimationFrame(() => f.focus({ preventScroll: true }));
  } else if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function updatePortraitHint() {
  $('#portraitHint').hidden = !(state === 'play' && touchMode && !portraitDismissed && innerHeight > innerWidth);
}

function setAccent(p) {
  document.documentElement.style.setProperty('--accent', p ? 'var(--frost)' : 'var(--glut)');
  $('#phasePill').dataset.phase = String(p);
  $('#phasePill').setAttribute('aria-label', `Active world: ${p ? 'Frost' : 'Ember'}${world && world.pulse ? ', switches on the beat' : ''}`);
}

function applySkin() {
  save.skin = resolveSkin(save.skin, points());
  const look = skinStyle(save.skin);
  R.skin = look;
  if (wd.player) wd.player.renderer.skin = look;
}

// ---------- levels ----------
function startLevel(i) {
  S.init();
  world = new World(LEVELS[i], i);
  R.setLevel(world);
  phaseT = world.phase;
  setAccent(world.phase);
  S.setPhase(world.phase);
  winTimer = -1;
  acc = 0;
  runMasks = [];
  ghost = null;
  const g = ghosts[i];
  if (settings.ghost && g && g.hash === levelHash(LEVELS[i])) ghost = { world: new World(LEVELS[i], i), masks: decodeRun(g.rle), k: 0 };
  state = 'play';
  I.clearEdges();
  show(null);
  snapCamera();
  hudCache = {};
  $('#hudLevel').textContent = `${i + 1}  ${LEVELS[i].name}`;
  $('#phasePill').classList.toggle('is-pulse', !!world.pulse);
  document.querySelector('.t-swap').hidden = !!world.pulse; // the beat switches the world in pulse levels
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
  ghost = null;
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
  const starsBefore = starsOf(i);
  const pointsBefore = points();
  save.best[i] = {
    time: isBest ? t : prev.time,
    shards: Math.max(prev ? prev.shards : 0, world.collected),
    deathless: (prev && prev.deathless) || world.deaths === 0,
  };
  save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
  writeSave();
  const hash = levelHash(LEVELS[i]);
  if (isBest || !ghosts[i] || ghosts[i].hash !== hash) { // a changed level layout invalidates the old ghost
    ghosts[i] = { hash, rle: encodeRun(runMasks) };
    writeJSON(GHOST_KEY, ghosts);
  }

  $('#completeTitle').textContent = `${LEVELS[i].name} cleared`;
  $('#stTime').textContent = fmt(t);
  $('#stShards').textContent = `${world.collected}/${world.shards.length}`;
  $('#stDeaths').textContent = String(world.deaths);
  $('#bestBadge').hidden = !(isBest && prev);
  renderStars($('#stStars'), i, starsBefore);
  const unlocked = newlyUnlocked(pointsBefore, points());
  $('#unlockNote').hidden = !unlocked.length;
  $('#unlockText').textContent = unlocked.length ? `New look unlocked: ${unlocked.join(', ')}. Try it in the Wardrobe.` : '';
  applySkin();
  $('#btnNext').textContent = i === LEVELS.length - 1 ? 'See your results' : 'Next level';
  state = 'complete';
  show('complete');
}

function renderStars(el, i, before) {
  const now = starsOf(i);
  const items = [
    ['fast', `Under ${fmt(PAR[i])}`],
    ['shards', 'All shards'],
    ['deathless', 'No deaths'],
  ];
  el.replaceChildren(...items.map(([k, text], n) => {
    const d = document.createElement('div');
    d.className = `star-item${now[k] ? ' on' : ''}${now[k] && before && !before[k] ? ' new' : ''}`;
    d.style.setProperty('--i', n);
    d.innerHTML = '<i class="ph-bold ph-star" aria-hidden="true"></i>';
    d.append(text);
    return d;
  }));
  el.setAttribute('aria-label', `${now.count} of 3 stars: ${items.filter(([k]) => now[k]).map(([, t]) => t).join(', ') || 'none yet'}`);
}

function newlyUnlocked(before, after) {
  const names = [];
  for (const [part, list] of Object.entries(SKINS)) {
    for (const item of list) if (item.need > before && item.need <= after) names.push(`${item.name} ${part === 'hat' ? '' : part}`.trim());
  }
  return names;
}

function next() {
  const i = world.index;
  if (i === LEVELS.length - 1) {
    const total = LEVELS.reduce((s, _, k) => s + (save.best[k] ? save.best[k].time : 0), 0);
    const stars = LEVELS.reduce((s, _, k) => s + starsOf(k).count, 0);
    $('#fnTime').textContent = fmt(total);
    $('#fnShards').textContent = `${points()}/${totalShards}`;
    $('#fnStars').textContent = `${stars}/${LEVELS.length * 3}`;
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
  for (const r of [R, ob.player && ob.player.renderer, wd.player && wd.player.renderer]) {
    if (!r) continue;
    r.shakeOn = settings.shake;
    r.reduced = settings.reducedFx;
  }
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
const SWITCHES = [['muted', '#setMuted'], ['shake', '#setShake'], ['reducedFx', '#setReduced'], ['showTimer', '#setTimer'], ['ghost', '#setGhost']];

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
  cancelCapture();
  state = settingsFrom;
  show(settingsFrom);
}

function kbdList(labels) {
  return labels.map((k) => {
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
    th.textContent = c.label;
    const kb = document.createElement('td');
    const set = document.createElement('span');
    set.className = 'kbd-set';
    set.append(...kbdList(I.bindings[c.id].map(keyLabel)));
    const change = document.createElement('button');
    change.type = 'button';
    change.className = 'key-change';
    change.textContent = 'Change';
    change.dataset.action = c.id;
    change.setAttribute('aria-label', `Change key for ${c.label}`);
    change.addEventListener('click', () => startCapture(c, change));
    set.append(change);
    kb.append(set);
    const pad = document.createElement('td');
    pad.textContent = c.pad;
    tr.append(th, kb, pad);
    body.append(tr);
  }
  const menus = document.createElement('tr');
  menus.innerHTML = '<th scope="row">Menus</th><td><span class="kbd-set"><kbd>Tab</kbd><kbd>Enter</kbd></span></td><td>D-pad, A to select, B to go back</td>';
  body.append(menus);

  // compact title card
  const card = [
    ['Move', ['left', 'right'].flatMap((a) => I.bindings[a].slice(0, 2))],
    ['Jump', I.bindings.jump.slice(0, 2)],
    ['Dash', I.bindings.dash.slice(0, 2)],
    ['Switch world', I.bindings.swap.slice(0, 2), true],
    ['Pause, restart', [I.bindings.pause[0], I.bindings.restart[0]]],
  ];
  const dl = $('#titleControls');
  dl.replaceChildren(...card.map(([title, codes, hl]) => {
    const row = document.createElement('div');
    if (hl) row.className = 'hl';
    const dt = document.createElement('dt');
    dt.textContent = title;
    const dd = document.createElement('dd');
    dd.append(...kbdList([...new Set(codes.map(keyLabel))]));
    row.append(dt, dd);
    return row;
  }));
}

let capturing = null;
function startCapture(control, button) {
  cancelCapture();
  capturing = button;
  button.setAttribute('aria-pressed', 'true');
  button.textContent = 'Press a key…';
  $('#keyCaptureNote').textContent = `Press the new key for “${control.label}”. Esc cancels.`;
  I.capture = (code) => {
    capturing = null;
    if (code !== 'Escape') {
      const before = I.bindings;
      settings.keys = rebind(before, control.id, code);
      I.setBindings(settings.keys);
      saveSettings(settings);
      const moved = CONTROLS.filter((c) => c.id !== control.id && before[c.id][0] !== I.bindings[c.id][0])
        .map((c) => `${c.label} moved to ${keyLabel(I.bindings[c.id][0])}.`);
      $('#keyCaptureNote').textContent = [`${control.label} is now ${keyLabel(code)}.`, ...moved].join(' ');
    } else {
      $('#keyCaptureNote').textContent = 'Key change cancelled.';
    }
    buildControls();
    const again = document.querySelector(`.key-change[data-action="${control.id}"]`);
    if (again) again.focus();
  };
}
function cancelCapture() {
  I.capture = null;
  if (capturing) { capturing = null; buildControls(); }
}

// ---------- level select ----------
function buildSelect() {
  const grid = $('#levelGrid');
  grid.replaceChildren();
  LEVELS.forEach((lv, i) => {
    const act = ACTS.find((a) => a.from === i);
    if (act) {
      const head = document.createElement('h3');
      head.className = 'act-head';
      head.textContent = act.name;
      grid.append(head);
    }
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
    drawMinimap(cv, lv, deaths[i] || []);
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
    const st = starsOf(i);
    if (!locked) {
      const row = document.createElement('span');
      row.className = 'lc-stars';
      row.setAttribute('aria-hidden', 'true');
      for (const k of ['fast', 'shards', 'deathless']) {
        const s = document.createElement('i');
        s.className = `ph-bold ph-star${st[k] ? ' on' : ''}`;
        row.append(s);
      }
      meta.append(row);
    }
    b.append(cv, meta);
    const deathCount = (deaths[i] || []).length;
    b.setAttribute('aria-label', `Level ${i + 1}: ${lv.name}${locked ? ', locked' : `, ${st.count} of 3 stars${deathCount ? `, ${deathCount} deaths recorded` : ''}`}`);
    b.addEventListener('click', () => { S.play('ui'); startLevel(i); });
    grid.append(b);
  });
}

// ---------- onboarding ----------
const OB_KEY = 'dusklight.onboarded';
const ob = { i: 0, player: null, replay: false, accent: -1 };

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
  if (!ob.player) ob.player = new DemoPlayer($('#obCanvas'));
  ob.player.renderer.skin = R.skin;
  applySettings();
  ob.player.resize();
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

function setStep(i) {
  const dir = i >= ob.i ? 'next' : 'prev';
  ob.i = i;
  const d = DEMOS[i];
  $('#obStep').textContent = `Step ${i + 1} of ${DEMOS.length}`;
  $('#obTitle').textContent = d.title;
  $('#obBody').textContent = demoBody(d, primaryLabel, touchMode);
  $('#obBar').style.width = `${((i + 1) / DEMOS.length) * 100}%`;
  $('#obPrev').disabled = i === 0;
  const lastStep = i === DEMOS.length - 1;
  $('#obNext').textContent = lastStep ? (ob.replay ? 'Done' : 'Start playing') : 'Next';
  [...$('#obDots').children].forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
  $('#obKeys').replaceChildren(...d.keys.map((act) => {
    const k = document.createElement('kbd');
    k.dataset.act = act;
    if (touchMode) {
      k.className = 'is-touch';
      k.innerHTML = `<i class="ph-bold ${TOUCH_ICON[act]}" aria-hidden="true"></i>`;
    } else {
      k.textContent = primaryLabel(act);
    }
    return k;
  }));
  // restart the CSS entrance animations
  const copy = $('#obCopy'), stage = $('#obStage');
  copy.classList.remove('ob-in-next', 'ob-in-prev');
  stage.classList.remove('is-switching');
  void copy.offsetWidth;
  copy.classList.add(`ob-in-${dir}`);
  stage.classList.add('is-switching');
  ob.player.play(d);
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

function updateOnboarding(dt) {
  const on = ob.player.update(dt, time);
  const phase = ob.player.world.phase;
  if (ob.accent !== phase) { ob.accent = phase; setAccent(phase); }
  for (const k of $('#obKeys').children) k.classList.toggle('is-pressed', on.has(k.dataset.act));
}

// ---------- wardrobe ----------
const wd = { player: null };
const PART_TARGET = { body: '#wdBody', scarf: '#wdScarf', hat: '#wdHat' };
const HAT_ICON = { none: 'ph-x', antenna: 'ph-broadcast', horns: 'ph-flame', halo: 'ph-circle-notch', crown: 'ph-crown', lantern: 'ph-lightbulb', wings: 'ph-feather' };

function openWardrobe() {
  S.init();
  state = 'wardrobe';
  show('wardrobe');
  if (!wd.player) wd.player = new DemoPlayer($('#wdCanvas'));
  applySettings();
  applySkin();
  wd.player.resize();
  wd.player.play(DEMOS[1]); // the mid-air switch scene shows the scarf and accessory in motion
  buildWardrobe();
}

function buildWardrobe() {
  const pts = points();
  $('#wdPoints').innerHTML = '<i class="shard-glyph" aria-hidden="true"></i>';
  $('#wdPoints').append(`${pts} / ${totalShards} shards`);
  for (const [part, list] of Object.entries(SKINS)) {
    const box = $(PART_TARGET[part]);
    box.replaceChildren(...list.map((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      const unlocked = pts >= item.need;
      b.disabled = !unlocked;
      b.setAttribute('aria-pressed', String(save.skin[part] === item.id));
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.setAttribute('aria-hidden', 'true');
      if (part === 'body') chip.style.background = item.color === 'prism' ? 'conic-gradient(#ff9fb8, #ffd36b, #a6dc8f, #7ef0ff, #a78bfa, #ff9fb8)' : item.color;
      else if (part === 'scarf') {
        chip.style.background = item.color === null ? 'linear-gradient(90deg, var(--glut) 50%, var(--frost) 50%)'
          : item.color === 'aurora' ? 'repeating-linear-gradient(90deg, var(--glut) 0 5px, var(--frost) 5px 10px)'
            : item.color === 'starlight' ? 'radial-gradient(circle, #fff6d6 30%, rgba(255,246,214,0.2) 70%)'
              : item.color === 'comet' ? 'linear-gradient(90deg, #cdefff, rgba(205,239,255,0.15))' : item.color;
      } else chip.innerHTML = `<i class="ph-bold ${HAT_ICON[item.id]}"></i>`;
      b.append(chip, item.name);
      if (!unlocked) {
        const need = document.createElement('span');
        need.className = 'need';
        need.innerHTML = '<i class="ph-bold ph-lock-simple" aria-hidden="true"></i>';
        need.append(`${item.need}`);
        b.append(need);
        b.setAttribute('aria-label', `${item.name}, locked, needs ${item.need} shards`);
      }
      b.addEventListener('click', () => {
        save.skin = { ...save.skin, [part]: item.id };
        applySkin();
        writeSave();
        S.play('ui');
        buildWardrobe();
        const again = [...$(PART_TARGET[part]).children][list.indexOf(item)];
        if (again) again.focus();
      });
      return b;
    }));
  }
}

// ---------- events from the simulation ----------
function handleEvent(e) {
  R.fx(e, phaseT);
  S.play(e.type, e);
  if (e.type === 'swap') { setAccent(e.phase); S.setPhase(e.phase); }
  if (e.type === 'respawn') { setAccent(world.phase); S.setPhase(world.phase); }
  if (e.type === 'die') { addDeath(deaths, world.index, e.x, e.y); writeJSON(DEATH_KEY, deaths); }
  if (e.type === 'win') winTimer = 1.1;
}

// ---------- camera ----------
function snapCamera() {
  updateCamera(1, true);
}

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
  if (world.pulse) $('#phasePill').style.setProperty('--pulse', String(Math.max(0, 1 - world.pulseLeft / world.pulse)));
  setText('hudShards', `${world.collected}/${world.shards.length}`);
  setText('hudTime', fmt(world.time));
  setText('hudDeaths', String(world.deaths));
}

// ---------- gamepad menu navigation ----------
function back() {
  if (state === 'play') pause();
  else if (state === 'pause') resume();
  else if (state === 'select' || state === 'wardrobe') toTitle();
  else if (state === 'settings') closeSettings();
  else if (state === 'onboarding') finishOnboarding(false);
}

function onMenu(dir) {
  const screen = Object.entries(screens).find(([k]) => k === state);
  if (!screen) return;
  document.body.classList.add('gp-nav');
  const items = [...screen[1].querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter((el) => el.getClientRects().length > 0);
  if (!items.length) return;
  const cur = document.activeElement;
  const i = items.indexOf(cur);
  if (dir === 'back') { back(); return; }
  if (dir === 'ok') {
    if (i >= 0) cur.click();
    else items[0].focus();
    return;
  }
  if (cur && cur.type === 'range' && (dir === 'left' || dir === 'right')) {
    cur.value = String(Number(cur.value) + (dir === 'right' ? 1 : -1) * Number(cur.step || 1));
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    cur.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const delta = dir === 'up' || dir === 'left' ? -1 : 1;
  const nextIndex = i < 0 ? 0 : (i + delta + items.length) % items.length;
  items[nextIndex].focus();
  items[nextIndex].scrollIntoView({ block: 'nearest' });
}

// ---------- loop ----------
function frame(now) {
  try {
    step(now);
  } finally {
    requestAnimationFrame(frame);
  }
}

function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  I.pollGamepad();

  if (state === 'play') {
    acc += dt;
    while (acc >= STEP) {
      const inp = I.snapshot();
      if (!world.won) runMasks.push(inputToMask(inp));
      world.update(STEP, inp);
      I.consume();
      if (ghost && ghost.k < ghost.masks.length) {
        ghost.world.update(STEP, maskToInput(ghost.masks[ghost.k++]));
        ghost.world.events.length = 0;
      }
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
  } else if (state === 'wardrobe') {
    wd.player.update(dt, time);
  }
  if (isAttract() && state !== 'onboarding') {
    attractSwap -= dt;
    if (attractSwap <= 0) {
      attractSwap = 4.5;
      world.phase = 1 - world.phase;
      S.setPhase(world.phase);
      if (state !== 'wardrobe') setAccent(world.phase);
    }
  }

  const target = world.phase;
  const rate = R.reduced ? 20 : 6;
  phaseT += (target - phaseT) * Math.min(1, dt * rate);
  if (Math.abs(target - phaseT) < 0.001) phaseT = target;

  updateCamera(dt);
  R.update(dt, world, time);
  const attract = isAttract();
  const gp = ghost && !attract && ghost.world.player.alive && !ghost.world.won ? ghost.world.player : null;
  R.render(world, cam, phaseT, time, { showPlayer: !attract, showSigns: !attract, ghost: gp });
  S.tick(dt);
  updateHud();
}

// ---------- wiring ----------
$('#btnPlay').addEventListener('click', () => { S.play('ui'); startLevel(nextUnplayed()); });
$('#btnLevels').addEventListener('click', () => { S.play('ui'); openSelect(); });
$('#btnWardrobe').addEventListener('click', () => { S.play('ui'); openWardrobe(); });
$('#btnWardrobeBack').addEventListener('click', toTitle);
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
$('#btnPortraitClose').addEventListener('click', () => { portraitDismissed = true; updatePortraitHint(); });
$('#btnResetKeys').addEventListener('click', () => {
  cancelCapture();
  settings.keys = null;
  I.setBindings(DEFAULT_BINDINGS);
  saveSettings(settings);
  buildControls();
  $('#keyCaptureNote').textContent = 'All keys are back to their defaults.';
});
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
$('#resetText').textContent = `Delete all best times, stars, ghosts and the death map, and lock levels 2 to ${LEVELS.length} again? Unlocked looks lock again too. This cannot be undone.`;
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
  save = { unlocked: 0, best: {}, skin: { ...DEFAULT_SKIN } };
  ghosts = {};
  deaths = {};
  writeSave();
  writeJSON(GHOST_KEY, ghosts);
  writeJSON(DEATH_KEY, deaths);
  applySkin();
  updatePlayLabel();
  $('#resetConfirm').hidden = true;
  $('#btnReset').hidden = false;
  $('#resetDone').hidden = false;
  $('#btnReset').focus();
});
I.onPadPause = () => (state === 'play' ? pause() : state === 'pause' || state === 'settings' ? back() : null);
I.onMenu = onMenu;

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const action = I.actionFor(e.code);
  if (action === 'pause') {
    back();
  } else if (state === 'onboarding' && e.code === 'ArrowRight') {
    obNext();
  } else if (state === 'onboarding' && e.code === 'ArrowLeft') {
    obPrev();
  } else if (action === 'restart' && state === 'play' && !world.won) {
    startLevel(world.index);
  } else if (action === 'mute') {
    toggleMute();
  }
});
addEventListener('pointerdown', () => document.body.classList.remove('gp-nav'));
addEventListener('keydown', () => document.body.classList.remove('gp-nav'));

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
  if (ob.player) ob.player.resize();
  if (wd.player) wd.player.resize();
  updatePortraitHint();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); if (S.ctx) S.ctx.suspend(); }
});
addEventListener('pointerdown', () => S.init());

// Debug/test hook (read-only snapshot + level jump), used by the Playwright smoke tests.
window.__dusklight = {
  get state() { return state; },
  get world() { return world; },
  get ghost() { return ghost; },
  get save() { return save; },
  startLevel,
  settings,
};

buildControls();
applySettings();
applySkin();
updatePlayLabel();
setAccent(0);
if (onboardingSeen()) show('title');
else openOnboarding(false);
snapCamera();
requestAnimationFrame(frame);
