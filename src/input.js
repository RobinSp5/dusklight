// Keyboard (rebindable), touch and gamepad merged into one action state.
export const ACTIONS = ['left', 'right', 'jump', 'dash', 'swap', 'pause', 'restart', 'mute'];
export const DEFAULT_BINDINGS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'KeyW', 'ArrowUp'],
  dash: ['KeyX', 'KeyK'],
  swap: ['ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyC'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
  mute: ['KeyM'],
};
const EDGE = ['jump', 'dash', 'swap'];
const GAMEPLAY = new Set(['left', 'right', 'jump', 'dash', 'swap']);

// Readable label for a KeyboardEvent.code
export function keyLabel(code) {
  if (!code) return 'None';
  const named = {
    Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'Alt', AltRight: 'R-Alt', MetaLeft: 'Cmd', MetaRight: 'R-Cmd', Escape: 'Esc',
    Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', CapsLock: 'Caps',
  };
  if (named[code]) return named[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`;
  return code.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Returns a sanitised copy: known actions only, string codes, Escape always pauses,
// and no key belongs to two actions. An action left without keys gets its unused defaults back.
export function normalizeBindings(raw) {
  const out = {};
  for (const a of ACTIONS) {
    const list = raw && Array.isArray(raw[a]) ? raw[a].filter((c) => typeof c === 'string' && c) : null;
    out[a] = list && list.length ? [...new Set(list)] : [...DEFAULT_BINDINGS[a]];
  }
  for (const a of ACTIONS) if (a !== 'pause') out[a] = out[a].filter((c) => c !== 'Escape');
  if (!out.pause.includes('Escape')) out.pause.push('Escape');
  const seen = new Set(out.pause);
  for (const a of ACTIONS) {
    if (a === 'pause') continue;
    out[a] = out[a].filter((c) => !seen.has(c));
    out[a].forEach((c) => seen.add(c));
  }
  for (const a of ACTIONS) {
    if (out[a].length) continue;
    out[a] = DEFAULT_BINDINGS[a].filter((c) => !seen.has(c));
    out[a].forEach((c) => seen.add(c));
  }
  return out;
}

// Make `code` the primary key of `action`. If another action loses its only key to it,
// the two actions swap: that action takes over the old primary key of `action`.
export function rebind(bindings, action, code) {
  const next = normalizeBindings(bindings);
  if (code === 'Escape') return next; // reserved as the always-available pause key
  const oldPrimary = next[action][0];
  let swappedTo = null;
  for (const a of ACTIONS) {
    if (a === action || !next[a].includes(code)) continue;
    next[a] = next[a].filter((c) => c !== code);
    if (!next[a].length && oldPrimary && oldPrimary !== code) { next[a] = [oldPrimary]; swappedTo = a; }
  }
  next[action] = [code, ...next[action].filter((c) => c !== code && !(swappedTo && c === oldPrimary))];
  return normalizeBindings(next);
}

export class Input {
  constructor(bindings) {
    this.enabled = false;
    this.codes = new Set();
    this.virtual = { left: false, right: false, jump: false, dash: false, swap: false };
    this.pad = { left: false, right: false, jump: false, dash: false, swap: false, pause: false };
    this.menuPad = { up: false, down: false, left: false, right: false, ok: false, back: false };
    this.padRaw = { left: false, right: false, jump: false, dash: false, swap: false, pause: false };
    this.pressed = { jump: false, dash: false, swap: false };
    this.onPadPause = null;
    this.onMenu = null; // gamepad navigation while menus are open
    this.capture = null; // set by the rebinding UI: receives the next key code
    this.setBindings(bindings || DEFAULT_BINDINGS);

    addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      const a = this.keymap.get(e.code);
      if (!a || !GAMEPLAY.has(a)) return;
      if (this.enabled) e.preventDefault();
      if (!e.repeat && EDGE.includes(a) && !this.held(a)) this.pressed[a] = true;
      this.codes.add(e.code);
    }, true);
    addEventListener('keyup', (e) => this.codes.delete(e.code));
    addEventListener('blur', () => this.reset());
  }

  setBindings(bindings) {
    this.bindings = normalizeBindings(bindings);
    this.keymap = new Map();
    for (const a of ACTIONS) for (const c of this.bindings[a]) this.keymap.set(c, a);
    this.codes.clear();
  }

  actionFor(code) { return this.keymap.get(code) || null; }

  reset() {
    this.codes.clear();
    for (const k in this.virtual) this.virtual[k] = false;
    this.clearEdges();
  }

  // Drop pending presses (e.g. on restart) but keep keys that are still physically held.
  clearEdges() {
    for (const k of EDGE) this.pressed[k] = false;
  }

  held(a) {
    if (this.virtual[a] || this.pad[a]) return true;
    for (const c of this.codes) if (this.keymap.get(c) === a) return true;
    return false;
  }

  setVirtual(a, on) {
    if (on && EDGE.includes(a) && !this.held(a)) this.pressed[a] = true;
    this.virtual[a] = on;
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(Boolean);
    if (!gp) {
      for (const k in this.pad) this.pad[k] = false;
      for (const k in this.menuPad) this.menuPad[k] = false;
      for (const k in this.padRaw) this.padRaw[k] = false;
      return;
    }
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const next = {
      left: ax < -0.4 || b(14),
      right: ax > 0.4 || b(15),
      jump: b(0),
      dash: b(2) || b(7),
      swap: b(1) || b(3) || b(5),
      pause: b(9),
    };
    // edges are measured against the raw previous poll, so the button that closed a menu
    // does not count as a fresh jump/switch on the first frame of play
    if (this.enabled) {
      for (const a of EDGE) if (next[a] && !this.padRaw[a] && !this.held(a)) this.pressed[a] = true;
    }
    if (next.pause && !this.padRaw.pause && this.onPadPause) this.onPadPause();
    this.padRaw = next;
    // while a menu is open the pad only drives menu navigation, not the player
    this.pad = this.enabled ? next : { left: false, right: false, jump: false, dash: false, swap: false, pause: false };

    const menu = { up: ay < -0.5 || b(12), down: ay > 0.5 || b(13), left: ax < -0.5 || b(14), right: ax > 0.5 || b(15), ok: b(0), back: b(1) };
    if (!this.enabled && this.onMenu) for (const k in menu) if (menu[k] && !this.menuPad[k]) this.onMenu(k);
    this.menuPad = menu;
  }

  snapshot() {
    return {
      left: this.held('left'),
      right: this.held('right'),
      jumpHeld: this.held('jump'),
      jumpPressed: this.pressed.jump,
      dashPressed: this.pressed.dash,
      swapPressed: this.pressed.swap,
    };
  }

  consume() {
    for (const k of EDGE) this.pressed[k] = false;
  }
}
