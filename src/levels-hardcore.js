// Hardcore Pack: a standalone set of levels, never mixed into LEVELS (levels.js). Progress, stars, ghosts and the death map
// live under their own storage keys (see packs.js); nothing here changes the campaign.
//
// Level meta on top of the usual { name, w, h, seed, startPhase?, pulse? }:
//   twist:  { id, ...params }  the level's rule twist, see registerTwist() in world.js
//   reward: { id, slot, name, desc, style }  one unique reward, granted on the first clear and stored in the Hardcore save only.
//           id starts with 'hc.' and is unique across the pack; slot is a cosmetic slot of shop.js (body, scarf, hat, trail,
//           death, theme); style is the same shape as a shop item's style. Rewards are looks only: no physics, no shop items.
// Rules for every level (checked by tests/solve.mjs, tests/profile.mjs, tests/fairness.mjs): the twist is explained on a sign in
// the first section, the start is a harmless practice area, no randomness, a checkpoint at least every ~25 tiles.
// Add the level's par time to PAR_HC in progress.js (route * 1.8 + 5).
import { build } from './level-kit.js';

export const HARDCORE = [
  // 1. Mirror: left and right are swapped. Short sections, a checkpoint at the start of each, known mechanics only.
  build({
    name: 'Mirror', w: 112, h: 17, seed: 311, twist: { id: 'mirror' },
    reward: { id: 'hc.body.mirror', slot: 'body', name: 'Mirror Glass', desc: 'Cleared Mirror. A glassy silver body with a thin outline.', style: { kind: 'solid', color: '#d6e4f2', visor: '#16131c', outline: true } },
  }, ({ ground, row, put, fill, sign }) => {
    // --- practice: flat and harmless, the sign explains the twist ---
    ground(0, 23, 14);
    put(6, 13, 'P');
    sign(1, 8, 'MIRROR: {left} runs right, {right} runs left');
    sign(1, 10, 'jump, dash and the world switch stay the same');
    put(2, 13, 'o');
    fill(14, 13, 15, 13, '#');
    put(15, 11, 'o');
    put(20, 12, 'o');
    put(21, 13, 'C');
    // --- 1: a pit, a hop over thorns, then a zigzag up (right, left, right) ---
    ground(27, 47, 14);
    put(30, 13, '^'); put(31, 13, '^');
    row(35, 39, 11, '#');
    put(35, 10, '^'); put(36, 10, '^');
    put(38, 10, 'C');
    row(27, 32, 8, '#');
    put(27, 7, '^'); put(28, 7, '^');
    put(30, 7, 'o');
    row(35, 40, 5, '#');
    put(39, 4, '^'); put(40, 4, '^');
    put(36, 4, 'C');
    put(44, 13, 'C');
    // --- 2: Frost bridge over a pit, Frost-only thorns and an Ember wall, then an Ember bridge ---
    row(50, 51, 13, 'B'); row(55, 56, 12, 'B'); row(60, 61, 13, 'B');
    put(53, 10, 'o'); put(58, 9, 'o');
    ground(64, 71, 14);
    put(64, 13, 'C');
    put(66, 13, 'b'); put(67, 13, 'b');
    fill(69, 9, 70, 13, 'A');
    row(74, 75, 13, 'A'); row(79, 80, 12, 'A'); row(84, 85, 13, 'A');
    put(80, 10, 'o');
    // --- 3: a spring up to a narrow ledge with thorns on both ends, then a jump across ---
    ground(88, 111, 14);
    put(88, 13, 'C');
    put(92, 13, 'S');
    row(95, 98, 6, '#');
    put(95, 5, '^'); put(98, 5, '^');
    put(96, 5, 'C');
    row(102, 104, 6, '#');
    put(103, 4, 'o');
    put(108, 13, 'E');
  }),
];
