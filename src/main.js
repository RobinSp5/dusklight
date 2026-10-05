import { LEVELS, ACTS, TILE as T, build } from './levels.js';
import { World, STEP, PHYS } from './world.js';
import { Renderer, drawMinimap } from './render.js';
import { Sound } from './audio.js';
import { Input, keyLabel, rebind, DEFAULT_BINDINGS } from './input.js';
import { loadSettings, saveSettings } from './settings.js';
import { DEMOS, SHOWCASE, demoBody } from './demos.js';
import { DemoPlayer } from './demo-player.js';
import {
  PAR, starsFor, inputToMask, maskToInput, encodeRun, decodeRun, levelHash, addDeath, sanitizeGhosts, sanitizeDeaths,
} from './progress.js';
import {
  SLOTS, SLOT_NAMES, TIERS, CATALOG, itemById, newShop, sanitizeShop, migrateFromSkins,
  earnings, deposit, buy, equip, setGoal, goalItem, lookFor,
} from './shop.js';
import { THEMES } from './cosmetics.js';

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

// total shards ever found (best per level); used for the finale and the one-time shop migration
const foundShards = (best) => Object.values(best || {}).reduce((s, e) => s + (e && Number.isFinite(e.shards) ? e.shards : 0), 0);

// The shop is stored under its own key so a tab still running the pre-shop version (which rewrites the
// main save without a shop) can never wipe purchases or trigger the welcome migration a second time.
const SHOP_KEY = 'dusklight.shop.v1';
let migratedOnLoad = false;
function loadSave() {
  const s = readJSON(SAVE_KEY);
  const storedShop = readJSON(SHOP_KEY);
  if (s && Number.isInteger(s.unlocked) && s.best && typeof s.best === 'object') {
    for (const k of Object.keys(s.best)) {
      const e = s.best[k];
      if (!e || !Number.isFinite(e.time) || !Number.isFinite(e.shards)) delete s.best[k];
      else e.deathless = !!e.deathless;
    }
    // a level counts as unlocked when the one before it was cleared (old saves stopped at level 8)
    const cleared = Object.keys(s.best).map((k) => Math.min(Number(k) + 1, LEVELS.length - 1));
    s.unlocked = Math.min(Math.max(0, s.unlocked, ...cleared), LEVELS.length - 1);
    // saves from before the shop: keep the looks the old shard thresholds unlocked, found shards become the wallet
    const known = storedShop || s.shop;
    migratedOnLoad = !known;
    s.shop = known ? sanitizeShop(known) : migrateFromSkins(s.skin, foundShards(s.best));
    delete s.skin;
    return s;
  }
  return { unlocked: 0, best: {}, shop: storedShop ? sanitizeShop(storedShop) : newShop() };
}
let save = loadSave();
const writeSave = () => {
  const { shop, ...rest } = save;
  writeJSON(SAVE_KEY, rest);
  writeJSON(SHOP_KEY, shop);
};
if (migratedOnLoad) writeSave(); // persist a migration right away, so the welcome balance is granted exactly once
// another tab changed the save or the shop: adopt it instead of overwriting it later with stale data
addEventListener('storage', (e) => {
  if (e.key !== SAVE_KEY && e.key !== SHOP_KEY) return;
  save = loadSave();
  applyLook();
  updateWallet();
  if (state === 'shop') { buildShopItems(); syncShop(); }
});
let ghosts = sanitizeGhosts(readJSON(GHOST_KEY));
let deaths = sanitizeDeaths(readJSON(DEATH_KEY));
const shardCount = LEVELS.map((l) => l.rows.join('').split('o').length - 1);
const totalShards = shardCount.reduce((a, b) => a + b, 0);
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
  shop: $('#screenShop'),
};
const isAttract = () => ['title', 'select', 'onboarding', 'shop'].includes(state) || (state === 'settings' && settingsFrom === 'title');

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

// Equipped look + theme on every renderer (main, tutorial, shop preview) and the UI colours.
function applyLook() {
  const look = lookFor(save.shop.equip);
  for (const r of [R, ob.player && ob.player.renderer, shopUI.player && shopUI.player.renderer]) {
    if (!r) continue;
    r.setLook(look);
    r.setTheme(look.theme);
  }
  applyThemeCss(look.theme);
}
function applyThemeCss(id) {
  const th = THEMES[id] || THEMES.dusk;
  const root = document.documentElement.style;
  root.setProperty('--glut', th.css.glut);
  root.setProperty('--frost', th.css.frost);
}

const num = new Intl.NumberFormat('en-US');
const calm = () => settings.reducedFx || matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts a number up or down in place; a newer tween on the same element cancels the older one.
function tween(el, from, to, ms) {
  const token = {};
  el._tween = token;
  if (calm() || from === to) { el.textContent = num.format(to); return; }
  const t0 = performance.now();
  const tick = (now) => {
    if (el._tween !== token) return;
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = num.format(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function updateWallet(from) {
  const w = save.shop.wallet;
  tween($('#titleWalletVal'), from ?? w, w, 700);
  $('#btnShop').setAttribute('aria-label', `Shop, ${num.format(w)} shards`);
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
  save.best[i] = {
    time: isBest ? t : prev.time,
    shards: Math.max(prev ? prev.shards : 0, world.collected),
    deathless: (prev && prev.deathless) || world.deaths === 0,
  };
  save.unlocked = Math.max(save.unlocked, Math.min(i + 1, LEVELS.length - 1));
  const pay = earnings({
    levelIndex: i,
    shards: world.collected,
    firstClear: !prev,
    newStars: Math.max(0, starsOf(i).count - starsBefore.count),
    newBest: isBest && !!prev,
    deathless: world.deaths === 0,
    allShards: world.shards.length > 0 && world.collected === world.shards.length,
  });
  const walletBefore = save.shop.wallet;
  save.shop = deposit(save.shop, pay.total);
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
  updateWallet();
  $('#btnNext').textContent = i === LEVELS.length - 1 ? 'See your results' : 'Next level';
  state = 'complete';
  show('complete');
  showEarnings(pay, walletBefore);
}

// ---------- earnings on the level-complete screen ----------
let earnRun = 0;
function showEarnings(pay, before) {
  const run = ++earnRun;
  const after = save.shop.wallet;
  const lineEls = pay.lines.map((l) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = l.label;
    const amt = document.createElement('span');
    amt.className = 'el-amt';
    amt.append('+', Object.assign(document.createElement('b'), { textContent: '0' }));
    li.append(label, amt);
    return li;
  });
  $('#earnLines').replaceChildren(...lineEls);
  const totalEl = $('#earnTotal'), walletEl = $('#earnWallet');
  $('#earn').classList.remove('is-done');
  const goal = goalItem(save.shop);
  setGoalUI('earn', goal, before);

  // what this run brought within reach: the pinned goal first, else the priciest newly affordable item
  const pinned = save.shop.goal ? itemById(save.shop.goal) : null;
  const reach = CATALOG.filter((x) => !save.shop.owned.includes(x.id) && x.price > before && x.price <= after).sort((a, b) => b.price - a.price);
  let note = '';
  const label = (x) => `${x.name} (${SLOT_NAMES[x.slot].toLowerCase()})`;
  if (pinned && pinned.price > before && pinned.price <= after) note = `Goal reached: ${label(pinned)} is ready in the Shop.`;
  else if (reach.length) note = `Now in reach: ${label(reach[0])}${reach.length > 1 ? ` and ${reach.length - 1} more` : ''}. Visit the Shop.`;
  $('#unlockText').textContent = note;
  $('#unlockNote').hidden = !note;
  $('#unlockNote').classList.add('is-waiting'); // space is reserved now, the note fades in once the count-up ends
  $('#earnSummary').textContent = '';
  const summary = `Earned ${num.format(pay.total)} shards: ${pay.lines.map((l) => `${l.label} ${l.amount}`).join(', ')}. Wallet ${num.format(after)} shards.${goal ? ` Goal ${label(goal)}: ${num.format(Math.min(after, goal.price))} of ${num.format(goal.price)}.` : ''}`;
  setTimeout(() => { $('#earnSummary').textContent = summary; }, 120); // live regions only announce changes after they are shown

  const finish = () => {
    if (run !== earnRun) return;
    tween(walletEl, before, after, 700);
    setGoalUI('earn', goal, after);
    $('#earn').classList.add('is-done');
    $('#unlockNote').classList.remove('is-waiting');
  };
  if (calm()) {
    lineEls.forEach((li, k) => { li.classList.add('is-in'); li.querySelector('b').textContent = num.format(pay.lines[k].amount); });
    tween(totalEl, pay.total, pay.total, 0);
    tween(walletEl, before, before, 0);
    finish();
    return;
  }
  tween(totalEl, 0, 0, 0);
  tween(walletEl, before, before, 0);
  let k = 0, total = 0;
  const nextLine = () => {
    if (run !== earnRun || state !== 'complete') return;
    if (k >= lineEls.length) { finish(); S.play('checkpoint'); return; }
    const amount = pay.lines[k].amount;
    lineEls[k].classList.add('is-in');
    tween(lineEls[k].querySelector('b'), 0, amount, 420);
    tween(totalEl, total, total + amount, 420);
    S.play('collect', { n: k + 1 });
    total += amount;
    k++;
    setTimeout(nextLine, 360);
  };
  setTimeout(nextLine, 420);
}

// Goal progress (shop header and level-complete screen share the markup: #{prefix}Goal...).
function setGoalUI(prefix, item, wallet) {
  const box = $(`#${prefix}Goal`);
  const meter = $(`#${prefix}GoalMeter`);
  const pinned = item && save.shop.goal === item.id;
  box.classList.toggle('is-empty', !item);
  if (!item) {
    box.classList.remove('is-ready');
    delete box.dataset.tier;
    const all = CATALOG.every((x) => save.shop.owned.includes(x.id));
    $(`#${prefix}GoalKicker`).textContent = all ? 'Collection' : 'Goal';
    $(`#${prefix}GoalName`).textContent = all ? 'Every item is yours' : 'You can afford everything left';
    $(`#${prefix}GoalNum`).textContent = '';
    meter.hidden = true;
    return;
  }
  meter.hidden = false;
  const have = Math.min(wallet, item.price);
  const ready = wallet >= item.price;
  box.classList.toggle('is-ready', ready);
  box.dataset.tier = item.tier;
  $(`#${prefix}GoalKicker`).textContent = pinned ? 'Goal' : 'Next goal';
  const name = $(`#${prefix}GoalName`);
  name.textContent = item.name;
  name.append(Object.assign(document.createElement('span'), { className: 'goal-slot', textContent: SLOT_NAMES[item.slot] }));
  $(`#${prefix}GoalNum`).textContent = ready ? 'Ready to buy' : `${num.format(have)} / ${num.format(item.price)}`;
  meter.style.setProperty('--p', String(item.price ? have / item.price : 1));
  if (meter.getAttribute('role') === 'progressbar') {
    meter.setAttribute('aria-valuemax', String(item.price));
    meter.setAttribute('aria-valuenow', String(have));
    meter.setAttribute('aria-valuetext', `${num.format(have)} of ${num.format(item.price)} shards`);
  }
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

function next() {
  const i = world.index;
  if (i === LEVELS.length - 1) {
    const total = LEVELS.reduce((s, _, k) => s + (save.best[k] ? save.best[k].time : 0), 0);
    const stars = LEVELS.reduce((s, _, k) => s + starsOf(k).count, 0);
    $('#fnTime').textContent = fmt(total);
    $('#fnShards').textContent = `${foundShards(save.best)}/${totalShards}`;
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
  for (const r of [R, ob.player && ob.player.renderer, shopUI.player && shopUI.player.renderer]) {
    if (!r) continue;
    r.shakeOn = settings.shake;
    r.reduced = calm();
  }
  document.documentElement.classList.toggle('reduced-fx', settings.reducedFx);
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
  applyLook();
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

// ---------- shop ----------
const shopUI = { player: null, tab: 'body', pending: null, pendingAt: 0, preview: null, lastPad: {} };
const SLOT_ICON = { body: 'ph-person-simple', scarf: 'ph-wind', hat: 'ph-crown-simple', trail: 'ph-shooting-star', death: 'ph-skull', theme: 'ph-palette' };
const ART_ICON = {
  'hat.none': 'ph-x', 'trail.none': 'ph-x', 'hat.antenna': 'ph-broadcast', 'hat.horns': 'ph-flame', 'hat.halo': 'ph-circle-notch', 'hat.lantern': 'ph-lightbulb',
  'hat.crown': 'ph-crown', 'hat.wings': 'ph-feather', 'hat.orbit': 'ph-planet',
  'death.classic': 'ph-skull', 'death.confetti': 'ph-confetti', 'death.shatter': 'ph-diamond', 'death.blackhole': 'ph-spiral', 'death.fireworks': 'ph-sparkle',
};
// Preview scene for death effects: run straight into a spike pair, respawn, repeat.
// The player dies at 0.69 s and every 1.25 s after that; a 3.75 s loop keeps that rhythm seamless.
const DEATH_DEMO = {
  id: 'shop-death',
  level: build({ name: 'shop-death', w: 24, h: 9, seed: 21 }, ({ ground, put }) => {
    ground(0, 23, 7);
    put(3, 6, 'P');
    put(7, 6, '^'); put(8, 6, '^');
  }),
  duration: 5,
  hold: [[0.2, 3.75, 'right']],
  tap: [],
};
const owns = (id) => save.shop.owned.includes(id);
const shardGlyph = () => Object.assign(document.createElement('i'), { className: 'shard-glyph' });

function openShop() {
  S.init();
  state = 'shop';
  shopUI.pending = null;
  shopUI.lastPad = { lb: true, rb: true }; // a bumper still held from play must not switch tabs
  show('shop');
  if (!shopUI.player) {
    shopUI.player = new DemoPlayer($('#shopCanvas'), { viewH: 7 * T, minW: 240, center: true }); // closer than the tutorial: the look is the subject
    // keeps scroll-padding in sync with the sticky preview on small screens (see styles.css)
    new ResizeObserver(([e]) => $('#screenShop').style.setProperty('--preview-h', `${Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)}px`)).observe($('.shop-preview'));
  }
  applySettings();
  applyLook();
  shopUI.player.resize();
  buildShopTabs();
  buildShopItems();
  syncShop();
  previewItem(null);
}

function buildShopTabs() {
  $('#shopTabs').replaceChildren(...SLOTS.map((slot) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.id = `tab-${slot}`;
    b.dataset.slot = slot;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', 'shopPanel');
    b.innerHTML = `<i class="ph-bold ${SLOT_ICON[slot]}" aria-hidden="true"></i>`;
    const count = document.createElement('span');
    count.className = 'tab-count';
    b.append(SLOT_NAMES[slot], count);
    b.addEventListener('click', () => selectTab(slot));
    return b;
  }));
}

function selectTab(slot, focus = false) {
  if (shopUI.tab === slot) return;
  shopUI.tab = slot;
  shopUI.pending = null;
  S.play('ui');
  buildShopItems();
  syncShop();
  previewItem(null);
  const tab = $(`#tab-${slot}`);
  tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (focus) tab.focus();
}

function itemArt(item) {
  const art = document.createElement('span');
  const kind = item.style.kind;
  art.className = `art art-s-${item.slot} art-k-${kind}`;
  art.setAttribute('aria-hidden', 'true');
  if (ART_ICON[item.id]) {
    art.innerHTML = `<i class="ph-bold ${ART_ICON[item.id]}"></i>`;
  } else if (item.slot === 'body') {
    if (item.style.color) art.style.setProperty('--c', item.style.color);
    art.style.setProperty('--v', item.style.visor);
    if (item.style.outline) art.classList.add('art-outline');
    art.innerHTML = '<span class="art-bod"><span class="art-visor"></span></span>';
  } else if (item.slot === 'scarf') {
    if (item.style.color) art.style.setProperty('--c', item.style.color);
    art.innerHTML = '<span class="art-scarf"></span>';
  } else if (item.slot === 'trail') {
    art.innerHTML = '<span class="art-trail"><i></i><i></i><i></i><i></i><i></i></span>';
  } else if (item.slot === 'theme') {
    const th = THEMES[kind] || THEMES.dusk;
    art.style.setProperty('--g', th.css.glut);
    art.style.setProperty('--f', th.css.frost);
    art.style.setProperty('--sky-g', th.ember.skyBot);
    art.style.setProperty('--sky-f', th.frost.skyBot);
    art.innerHTML = '<span class="art-theme"></span>';
  }
  return art;
}

function buildShopItems() {
  const slot = shopUI.tab;
  const panel = $('#shopPanel');
  panel.setAttribute('aria-labelledby', `tab-${slot}`);
  panel.replaceChildren(...CATALOG.filter((x) => x.slot === slot).map((item, i) => {
    const card = document.createElement('div');
    card.className = `item tier-${item.tier}`;
    card.dataset.id = item.id;
    card.style.setProperty('--i', i);
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', `${item.name}, ${TIERS[item.tier]}`);
    const name = document.createElement('p');
    name.className = 'item-name';
    name.textContent = item.name;
    const meta = document.createElement('p');
    meta.className = 'item-meta';
    const tier = document.createElement('span');
    tier.className = 'tier-badge';
    tier.textContent = TIERS[item.tier];
    const note = document.createElement('span');
    note.className = 'item-note';
    meta.append(tier, note);
    const desc = document.createElement('span');
    desc.className = 'sr-only';
    desc.id = `desc-${item.id.replace('.', '-')}`;
    desc.textContent = item.desc;
    const act = document.createElement('button');
    act.type = 'button';
    act.className = 'buy-btn';
    act.setAttribute('aria-describedby', desc.id);
    act.addEventListener('click', () => itemAction(item));
    act.addEventListener('keydown', (e) => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); }); // a held key must not buy
    card.append(itemArt(item), name, meta, act, desc);
    if (item.price > 0) {
      const goal = document.createElement('button');
      goal.type = 'button';
      goal.className = 'goal-btn';
      goal.innerHTML = '<i class="ph-bold ph-target" aria-hidden="true"></i>';
      goal.addEventListener('click', () => toggleGoal(item));
      card.append(goal);
    }
    card.addEventListener('pointerenter', () => previewItem(item.id));
    card.addEventListener('pointerdown', () => previewItem(item.id)); // touch: a tap anywhere on the card tries it on
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') previewItem(focusedItemId()); });
    return card;
  }));
}

// Updates every card, the tabs and the header in place, so focus never jumps.
function syncShop(walletFrom) {
  const sh = save.shop;
  for (const b of $('#shopTabs').children) {
    const on = b.dataset.slot === shopUI.tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    const list = CATALOG.filter((x) => x.slot === b.dataset.slot);
    b.querySelector('.tab-count').textContent = `${list.filter((x) => owns(x.id)).length}/${list.length}`;
  }
  for (const card of $('#shopPanel').children) {
    const item = itemById(card.dataset.id);
    const owned = owns(item.id);
    const equipped = sh.equip[item.slot] === item.id;
    const afford = sh.wallet >= item.price;
    const pending = shopUI.pending === item.id;
    const isGoal = sh.goal === item.id;
    card.classList.toggle('is-owned', owned);
    card.classList.toggle('is-equipped', equipped);
    card.classList.toggle('is-short', !owned && !afford);
    card.classList.toggle('is-goal', isGoal);
    card.classList.toggle('is-pending', pending);
    const note = card.querySelector('.item-note');
    note.textContent = equipped ? 'Equipped' : owned ? 'Owned' : isGoal ? 'Goal' : afford ? '' : `${num.format(item.price - sh.wallet)} more`;
    const act = card.querySelector('.buy-btn');
    act.replaceChildren();
    act.removeAttribute('aria-disabled');
    if (equipped) {
      act.innerHTML = '<i class="ph-bold ph-check" aria-hidden="true"></i>';
      act.append('Equipped');
      act.setAttribute('aria-disabled', 'true');
      act.setAttribute('aria-label', `${item.name} is equipped`);
    } else if (owned) {
      act.textContent = 'Equip';
      act.setAttribute('aria-label', `Equip ${item.name}`);
    } else {
      act.append(pending ? 'Confirm' : 'Buy', shardGlyph(), Object.assign(document.createElement('span'), { className: 'price', textContent: num.format(item.price) }));
      if (!afford) act.setAttribute('aria-disabled', 'true');
      act.setAttribute('aria-label', pending ? `Confirm: buy ${item.name} for ${num.format(item.price)} shards`
        : afford ? `Buy ${item.name} for ${num.format(item.price)} shards`
          : `${item.name} costs ${num.format(item.price)} shards, you need ${num.format(item.price - sh.wallet)} more`);
    }
    const goal = card.querySelector('.goal-btn');
    if (goal) {
      goal.hidden = owned;
      goal.setAttribute('aria-pressed', String(isGoal));
      goal.setAttribute('aria-label', isGoal ? `Remove ${item.name} as goal` : `Set ${item.name} as goal`);
      goal.title = isGoal ? 'Remove goal' : 'Set goal';
    }
  }
  tween($('#shopWalletVal'), walletFrom ?? sh.wallet, sh.wallet, 800);
  setGoalUI('shop', goalItem(sh), sh.wallet);
  updateWallet(walletFrom);
}

const cardFor = (id) => $('#shopPanel').querySelector(`.item[data-id="${id}"]`);
function focusedItemId() {
  const el = document.activeElement;
  const card = el && el.closest && el.closest('#shopPanel .item');
  return card && el.matches(':focus-visible') ? card.dataset.id : null;
}

// Try an item on in the preview (also unowned ones); null shows the equipped look.
function previewItem(id) {
  const item = id ? itemById(id) : null;
  if (!shopUI.player) return;
  shopUI.preview = item ? item.id : null;
  const eq = save.shop.equip;
  const look = lookFor(item ? { ...eq, [item.slot]: item.id } : eq);
  const r = shopUI.player.renderer;
  r.setLook(look);
  r.setTheme(look.theme);
  const demo = (item ? item.slot : shopUI.tab) === 'death' ? DEATH_DEMO : SHOWCASE;
  if (shopUI.player.demo !== demo) shopUI.player.play(demo);
  const shown = item || itemById(eq[shopUI.tab]);
  const trying = !!item && eq[item.slot] !== item.id;
  $('#tryTag').hidden = !trying;
  $('#siTier').textContent = TIERS[shown.tier];
  $('#siTier').dataset.tier = shown.tier;
  $('#siSlot').textContent = trying ? SLOT_NAMES[shown.slot] : `Equipped ${SLOT_NAMES[shown.slot].toLowerCase()}`;
  $('#siName').textContent = shown.name;
  $('#siDesc').textContent = shown.desc;
  $('#shopInfo').dataset.tier = shown.tier;
}

function cancelPending() {
  if (!shopUI.pending) return;
  shopUI.pending = null;
  syncShop();
}

function shopSay(text) {
  const el = $('#shopStatus');
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = text; });
}

function itemAction(item) {
  const sh = save.shop;
  if (owns(item.id)) {
    if (sh.equip[item.slot] === item.id) return;
    save.shop = equip(sh, item.id);
    writeSave();
    applyLook();
    S.play('ui');
    syncShop();
    previewItem(item.id);
    shopSay(`${item.name} equipped.`);
    return;
  }
  if (sh.wallet < item.price) {
    S.play('deny');
    const card = cardFor(item.id);
    card.classList.remove('is-denied');
    void card.offsetWidth;
    card.classList.add('is-denied');
    shopSay(`You need ${num.format(item.price - sh.wallet)} more shards for ${item.name}. Clear levels to earn more.`);
    return;
  }
  if (shopUI.pending !== item.id || performance.now() - shopUI.pendingAt < 350) { // a double-click must not skip the confirmation
    if (shopUI.pending === item.id) return;
    shopUI.pending = item.id;
    shopUI.pendingAt = performance.now();
    S.play('ui');
    syncShop();
    shopSay(`Select again to buy ${item.name} for ${num.format(item.price)} shards.`);
    return;
  }
  const res = buy(sh, item.id);
  shopUI.pending = null;
  if (!res.ok) { syncShop(); return; }
  save.shop = res.shop;
  writeSave();
  applyLook();
  syncShop(sh.wallet);
  previewItem(item.id);
  celebrate(item);
  shopSay(`${item.name} is yours and equipped. ${num.format(save.shop.wallet)} shards left.`);
}

function celebrate(item) {
  S.play('win');
  const card = cardFor(item.id);
  const p = shopUI.player;
  p.renderer.fx({ type: 'win', x: p.world.player.x + PHYS.W / 2, y: p.world.player.y + PHYS.H / 2 }, p.phaseT);
  if (!card || calm()) return;
  card.classList.remove('is-bought');
  card.querySelector('.burst')?.remove();
  void card.offsetWidth;
  const burst = document.createElement('span');
  burst.className = 'burst';
  burst.setAttribute('aria-hidden', 'true');
  for (let k = 0; k < 14; k++) {
    const s = document.createElement('i');
    s.style.setProperty('--a', `${(k / 14) * 360 + (k % 2) * 12}deg`);
    s.style.setProperty('--d', `${64 + (k % 3) * 26}px`);
    burst.append(s);
  }
  card.append(burst);
  card.classList.add('is-bought');
  setTimeout(() => { burst.remove(); card.classList.remove('is-bought'); }, 1400);
  $('#shopWallet').classList.remove('is-spent');
  void $('#shopWallet').offsetWidth;
  $('#shopWallet').classList.add('is-spent');
}

function toggleGoal(item) {
  const on = save.shop.goal === item.id;
  save.shop = setGoal(save.shop, on ? null : item.id);
  writeSave();
  S.play('ui');
  syncShop();
  shopSay(on ? `${item.name} is no longer your goal.` : `${item.name} is your new goal.`);
}

// Gamepad bumpers switch tabs while the shop is open (LB = 4, RB = 5).
function pollShopBumpers() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  const now = { lb: !!(gp && gp.buttons[4] && gp.buttons[4].pressed), rb: !!(gp && gp.buttons[5] && gp.buttons[5].pressed) };
  const i = SLOTS.indexOf(shopUI.tab);
  if (now.lb && !shopUI.lastPad.lb) { document.body.classList.add('gp-nav'); selectTab(SLOTS[(i + SLOTS.length - 1) % SLOTS.length], true); }
  if (now.rb && !shopUI.lastPad.rb) { document.body.classList.add('gp-nav'); selectTab(SLOTS[(i + 1) % SLOTS.length], true); }
  shopUI.lastPad = now;
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
  else if (state === 'shop' && shopUI.pending) cancelPending();
  else if (state === 'select' || state === 'shop') toTitle();
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
  if (state === 'shop' && i >= 0) {
    // the shop is a grid: move to the nearest control in the pressed direction, tabs switch with left/right
    if (cur.getAttribute('role') === 'tab' && (dir === 'left' || dir === 'right')) {
      const k = SLOTS.indexOf(cur.dataset.slot);
      selectTab(SLOTS[(k + (dir === 'right' ? 1 : SLOTS.length - 1)) % SLOTS.length], true);
      return;
    }
    const target = nearestInDirection(items, cur, dir);
    if (target) { target.focus(); target.scrollIntoView({ block: 'nearest' }); }
    return;
  }
  const delta = dir === 'up' || dir === 'left' ? -1 : 1;
  const nextIndex = i < 0 ? 0 : (i + delta + items.length) % items.length;
  items[nextIndex].focus();
  items[nextIndex].scrollIntoView({ block: 'nearest' });
}

function nearestInDirection(items, cur, dir) {
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestD = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along < 4) continue;
    const d = along + across * 2.5;
    if (d < bestD) { bestD = d; best = el; }
  }
  return best;
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
  } else if (state === 'shop') {
    shopUI.player.update(dt, time);
    pollShopBumpers();
  }
  if (isAttract() && state !== 'onboarding') {
    attractSwap -= dt;
    if (attractSwap <= 0) {
      attractSwap = 4.5;
      world.phase = 1 - world.phase;
      S.setPhase(world.phase);
      if (state !== 'shop') setAccent(world.phase);
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
$('#btnShop').addEventListener('click', () => { S.play('ui'); openShop(); });
$('#btnShopBack').addEventListener('click', toTitle);
$('#shopTabs').addEventListener('keydown', (e) => {
  const k = SLOTS.indexOf(shopUI.tab);
  const to = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: SLOTS.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  selectTab(SLOTS[(to + SLOTS.length) % SLOTS.length], true);
});
// focusing a card tries it on; leaving the grid restores the equipped look; any other action cancels a pending purchase
$('#screenShop').addEventListener('focusin', (e) => {
  if (e.target.id === 'shopPanel') return; // a click on a card's body focuses the panel; pointerdown already previews it
  const card = e.target.closest('.item');
  if (shopUI.pending && !(card && card.dataset.id === shopUI.pending && e.target.classList.contains('buy-btn'))) cancelPending();
  previewItem(card ? card.dataset.id : null);
});
$('#screenShop').addEventListener('focusout', (e) => {
  if (!e.relatedTarget || !$('#screenShop').contains(e.relatedTarget)) previewItem(null);
});
$('#screenShop').addEventListener('pointerdown', (e) => {
  const card = e.target.closest('.item');
  if (shopUI.pending && !(card && card.dataset.id === shopUI.pending && e.target.closest('.buy-btn'))) cancelPending();
});
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
$('#resetText').textContent = `Delete all best times, stars, ghosts and the death map, and lock levels 2 to ${LEVELS.length} again? Your shards and every item you bought are removed too. This cannot be undone.`;
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
  save = { unlocked: 0, best: {}, shop: newShop() };
  ghosts = {};
  deaths = {};
  writeSave();
  writeJSON(GHOST_KEY, ghosts);
  writeJSON(DEATH_KEY, deaths);
  applyLook();
  updateWallet();
  updatePlayLabel();
  $('#resetConfirm').hidden = true;
  $('#btnReset').hidden = false;
  $('#resetDone').hidden = false;
  $('#btnReset').focus();
});
I.onPadPause = () => (state === 'play' ? pause() : state === 'pause' || state === 'settings' ? back() : null);
I.onMenu = onMenu;
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applySettings);

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
  if (shopUI.player) shopUI.player.resize();
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
applyLook();
updateWallet();
updatePlayLabel();
setAccent(0);
if (onboardingSeen()) show('title');
else openOnboarding(false);
snapCamera();
requestAnimationFrame(frame);
