// Keyboard, touch and gamepad merged into one action state.
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyX: 'dash', KeyK: 'dash',
  ShiftLeft: 'swap', ShiftRight: 'swap', KeyJ: 'swap', KeyC: 'swap',
};
const EDGE = ['jump', 'dash', 'swap'];

export class Input {
  constructor() {
    this.enabled = false;
    this.codes = new Set();
    this.virtual = { left: false, right: false, jump: false, dash: false, swap: false };
    this.pad = { left: false, right: false, jump: false, dash: false, swap: false, pause: false };
    this.pressed = { jump: false, dash: false, swap: false };
    this.onPadPause = null;

    addEventListener('keydown', (e) => {
      const a = KEYS[e.code];
      if (!a) return;
      if (this.enabled) e.preventDefault();
      if (!e.repeat && EDGE.includes(a) && !this.held(a)) this.pressed[a] = true;
      this.codes.add(e.code);
    });
    addEventListener('keyup', (e) => this.codes.delete(e.code));
    addEventListener('blur', () => this.reset());
  }

  // Drop pending presses (e.g. on restart) but keep keys that are still physically held.
  clearEdges() {
    for (const k of EDGE) this.pressed[k] = false;
  }

  reset() {
    this.codes.clear();
    for (const k in this.virtual) this.virtual[k] = false;
    for (const k of EDGE) this.pressed[k] = false;
  }

  held(a) {
    if (this.virtual[a] || this.pad[a]) return true;
    for (const c of this.codes) if (KEYS[c] === a) return true;
    return false;
  }

  setVirtual(a, on) {
    if (on && EDGE.includes(a) && !this.held(a)) this.pressed[a] = true;
    this.virtual[a] = on;
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(Boolean);
    if (!gp) { for (const k in this.pad) this.pad[k] = false; return; }
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax = gp.axes[0] || 0;
    const next = {
      left: ax < -0.4 || b(14),
      right: ax > 0.4 || b(15),
      jump: b(0),
      dash: b(2) || b(7),
      swap: b(1) || b(3) || b(5),
      pause: b(9),
    };
    for (const a of EDGE) if (next[a] && !this.pad[a] && !this.held(a)) this.pressed[a] = true;
    if (next.pause && !this.pad.pause && this.onPadPause) this.onPadPause();
    this.pad = next;
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
