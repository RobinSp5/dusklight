// Scripted mini scenes for the onboarding. Each one runs on the real simulation, so what the
// player sees is exactly how the game behaves. Scripts are verified headless in tests/demos.mjs.
import { build } from './levels.js';

const H = 9; // demo levels are 9 tiles tall, the ground sits at row 7

export const DEMOS = [
  {
    id: 'move',
    title: 'Run and jump',
    body: 'Move with {left} and {right}. Hold {jump} to jump higher, tap it for a short hop.',
    touchBody: 'Move with the arrow buttons. Hold the jump button to jump higher, tap it for a short hop.',
    keys: ['left', 'right', 'jump'],
    level: build({ name: 'demo-move', w: 24, h: H, seed: 5 }, ({ ground, put }) => {
      ground(0, 23, 7);
      put(1, 6, 'P');
      put(8, 6, '^'); put(9, 6, '^');
      put(9, 3, 'o');
      put(15, 6, '^');
    }),
    duration: 3.6,
    hold: [[0.15, 3.0, 'right'], [0.72, 1.02, 'jump'], [1.58, 1.8, 'jump']],
    tap: [],
    done: (w) => w.player.x > 600 && w.collected === 1,
  },
  {
    id: 'swap',
    title: 'Two worlds, one path',
    body: 'Ember platforms are only solid in Ember, Frost platforms only in Frost. Press {swap} to switch, even mid-air.',
    touchBody: 'Ember platforms are only solid in Ember, Frost platforms only in Frost. Tap the switch button, even mid-air.',
    keys: ['swap', 'jump'],
    level: build({ name: 'demo-swap', w: 24, h: H, seed: 9 }, ({ ground, row, put }) => {
      ground(0, 4, 7);
      put(1, 6, 'P');
      row(7, 9, 6, 'A');
      row(12, 14, 5, 'B');
      put(13, 3, 'o');
      ground(17, 23, 7);
    }),
    duration: 4.2,
    hold: [[0.15, 3.2, 'right'], [0.42, 0.62, 'jump'], [1.1, 1.38, 'jump'], [1.95, 2.2, 'jump']],
    tap: [[1.3, 'swap']],
    done: (w) => w.player.x > 17 * 32 && w.phase === 1,
  },
  {
    id: 'dash',
    title: 'Dash across gaps',
    body: 'Press {dash} to dash forward. You get one dash per jump, and it comes back when you land.',
    touchBody: 'Tap the lightning button to dash forward. You get one dash per jump, and it comes back when you land.',
    keys: ['dash', 'jump'],
    level: build({ name: 'demo-dash', w: 24, h: H, seed: 13 }, ({ ground, put }) => {
      ground(0, 6, 7);
      put(1, 6, 'P');
      put(10, 4, 'o');
      ground(13, 23, 7);
    }),
    duration: 3.4,
    hold: [[0.15, 2.4, 'right'], [0.85, 1.03, 'jump']],
    tap: [[1.29, 'dash']],
    done: (w) => w.player.x > 13 * 32 && w.player.onGround && w.collected === 1,
  },
  {
    id: 'goal',
    title: 'Find the portal',
    body: 'Collect shards, touch crystals to save, and reach the portal. Colored spikes only hurt in their own world.',
    touchBody: 'Collect shards, touch crystals to save, and reach the portal. Colored spikes only hurt in their own world.',
    keys: ['swap', 'jump'],
    level: build({ name: 'demo-goal', w: 24, h: H, seed: 17 }, ({ ground, row, put }) => {
      ground(0, 23, 7);
      put(1, 6, 'P');
      put(4, 6, 'C');
      row(7, 9, 6, 'a');
      put(13, 4, 'o');
      put(19, 6, 'E');
    }),
    duration: 4.2,
    hold: [[0.15, 3.0, 'right'], [1.2, 1.5, 'jump']],
    tap: [[0.28, 'swap']],
    done: (w) => w.won && w.collected === 1,
  },
];

// Body text with the player's current key labels filled in, e.g. {jump} -> "Space".
export function demoBody(demo, labelFor, touch) {
  return touch ? demo.touchBody : demo.body.replace(/\{(\w+)\}/g, (_, a) => labelFor(a));
}

// Input for the frame that advances the demo clock from prev to t.
export function demoInput(demo, prev, t) {
  const inp = { left: false, right: false, jumpHeld: false, jumpPressed: false, dashPressed: false, swapPressed: false };
  for (const [t0, t1, a] of demo.hold) {
    if (t >= t0 && t < t1) {
      if (a === 'jump') inp.jumpHeld = true;
      else inp[a] = true;
    }
    if (a === 'jump' && t0 > prev && t0 <= t) inp.jumpPressed = true;
  }
  for (const [at, a] of demo.tap) if (at > prev && at <= t) inp[`${a}Pressed`] = true;
  return inp;
}

// Which actions look "pressed" right now (for lighting up the key caps).
export function demoActive(demo, t) {
  const on = new Set();
  for (const [t0, t1, a] of demo.hold) if (t >= t0 && t < t1) on.add(a);
  for (const [at, a] of demo.tap) if (t >= at && t < at + 0.22) on.add(a);
  return on;
}
