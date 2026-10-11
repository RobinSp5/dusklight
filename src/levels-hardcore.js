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

  // 2. Phase Flip: Ember (the start world) swaps left and right, Frost is normal, and every world switch flips between the two.
  build({
    name: 'Phase Flip', w: 112, h: 17, seed: 312, twist: { id: 'invertedWithPhaseToggle' },
    reward: { id: 'hc.hat.amulet', slot: 'hat', name: 'Phase Amulet', desc: 'Cleared Phase Flip. A spinning two-tone charm that shifts with you.', style: { kind: 'amulet' } },
  }, ({ ground, row, put, fill, sign }) => {
    // --- practice: flat and harmless; one Frost ledge to try the switch on ---
    ground(0, 23, 14);
    put(5, 13, 'P');
    sign(1, 8, 'PHASE FLIP: in Ember, {left} runs right and {right} runs left');
    sign(1, 10, 'Every {swap} flips the controls: Frost is normal, Ember is swapped');
    put(2, 13, 'o');
    row(12, 14, 11, 'B');
    put(13, 10, 'o');
    put(21, 13, 'C');
    // --- 1: stones of alternating worlds over a pit, so you switch (and flip) in mid-air ---
    row(27, 28, 13, 'A'); row(32, 33, 12, 'B'); row(37, 38, 13, 'A'); row(42, 43, 12, 'B');
    put(33, 9, 'o'); put(38, 10, 'o');
    // --- 2: long strips of Ember and Frost thorns: cross each one in the other world, switch on the bare ground between ---
    ground(46, 86, 14);
    put(46, 13, 'C');
    row(51, 59, 13, 'a');
    put(61, 13, 'C');
    row(63, 71, 13, 'b');
    put(55, 10, 'o'); put(67, 10, 'o');
    put(73, 13, 'C');
    row(77, 85, 13, 'a');
    put(81, 10, 'o');
    // --- 3: a climb over a pit through Ember and Frost ledges, with thorns to land beside ---
    fill(88, 14, 90, 16, '#');
    put(88, 13, 'C');
    row(93, 94, 12, 'B'); row(98, 99, 10, 'A'); row(103, 104, 8, 'B');
    put(99, 9, '^');
    put(94, 9, 'o'); put(104, 5, 'o');
    row(108, 111, 9, '#');
    put(108, 8, 'C');
    put(110, 8, 'E');
  }),

  // 3. Dash Only: no walking, no jumping. Only dashes and dash orbs move you; the world switch still works. A dash flies level,
  // so every landing is at least one tile below where the dash started: the level steps down from left to right.
  // A dash is 3 tiles long, so stepping stones sit exactly 3 tiles apart (two wide, one gap): that spacing keeps every landing
  // at the same spot on the next stone. Some pits have a thorn floor, the others are bottomless.
  build({
    name: 'Dash Only', w: 167, h: 18, seed: 313, twist: { id: 'dashOnlyMovement' },
    reward: { id: 'hc.trail.streak', slot: 'trail', name: 'Dash Streak', desc: 'Cleared Dash Only. Pale speed lines that trail every dash.', style: { kind: 'streak' } },
  }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); }; // thorn floor; the other pits are bottomless
    // --- practice: flat and harmless; chain dashes on the ground to get a feel for the reach ---
    ground(0, 25, 4);
    put(5, 3, 'P');
    sign(1, 0, 'DASH ONLY: no walking, no jumping. Only {dash} and dash orbs move you here');
    sign(1, 2, '{left} / {right} aim a dash, it comes back when you land');
    put(2, 3, 'o'); put(17, 3, 'o');
    put(24, 3, 'C');
    // --- 1: a gap of six tiles with two orbs: dash, orb, dash, orb, dash ---
    sign(18, 1, 'orbs refill the dash in mid-air');
    pit(26, 31);
    put(27, 3, 'd'); put(30, 3, 'd');
    ground(32, 47, 5);
    put(42, 4, 'o');
    put(47, 4, 'C');
    // --- 2: a long chain over a pit: five orbs in a row, then two lower ones (wait for the fall, then dash) ---
    for (const x of [50, 53, 56, 59, 62]) put(x, 4, 'd');
    put(52, 4, 'o'); put(58, 4, 'o');
    put(65, 6, 'd'); put(68, 6, 'd');
    ground(70, 84, 8);
    put(71, 7, 'C');
    // --- 3: Ember wall, then a Frost wall: switch worlds between the dashes ---
    sign(72, 2, 'walls: {swap} to the other world, then dash through');
    fill(77, 1, 77, 7, 'A');
    fill(79, 1, 79, 7, 'B');
    put(82, 7, 'o');
    put(81, 7, 'C');
    // --- 4: stepping stones that alternate Ember and Frost: switch worlds in mid-air ---
    pit(85, 100);
    row(86, 87, 8, 'A'); row(89, 90, 8, 'B'); row(92, 93, 8, 'A'); row(95, 96, 8, 'B'); row(98, 99, 8, 'A');
    put(90, 7, 'o');
    ground(101, 108, 8);
    put(105, 7, 'C');
    put(107, 7, 'o');
    // --- 5: more stones, longer ---
    row(111, 112, 8, 'A'); row(114, 115, 8, 'B'); row(117, 118, 8, 'A'); row(120, 121, 8, 'B'); row(123, 124, 8, 'A'); row(126, 127, 8, 'B');
    put(118, 7, 'o');
    ground(129, 139, 8);
    put(130, 7, 'C');
    put(135, 7, 'o');
    // --- 6: a falling chain of orbs down to the exit ---
    pit(140, 150);
    put(142, 7, 'd'); put(145, 9, 'd'); put(148, 11, 'd');
    ground(151, 166, 13);
    put(152, 12, 'C');
    put(161, 12, 'E');
  }),

  // 4. Beat: the world flips by itself every second; the player's own switch restarts the beat. Platforms, thorns and walls
  // of one world open and close in rhythm, so every section is "wait for the beat, then go".
  build({
    name: 'Beat', w: 138, h: 17, seed: 315, twist: { id: 'beat', every: 1 },
    reward: { id: 'hc.trail.pulse', slot: 'trail', name: 'Pulse Trail', desc: 'Cleared Beat. Glowing beads that swell with every step.', style: { kind: 'pulse' } },
  }, ({ ground, row, put, fill, sign }) => {
    // --- practice: flat and harmless; the overhead tiles only show the beat, nothing to walk into ---
    ground(0, 23, 14);
    put(4, 13, 'P');
    sign(1, 8, 'BEAT: the world flips by itself every second');
    sign(1, 10, '{swap} flips it by hand and restarts the beat');
    row(6, 9, 5, 'A'); row(10, 13, 5, 'B');
    put(3, 13, 'o');
    put(22, 13, 'C');
    // --- 1: stepping stones, Ember then Frost then Ember: hop across on the beat ---
    row(27, 29, 14, 'A'); row(33, 35, 14, 'B'); row(39, 41, 14, 'A'); row(43, 45, 14, 'B');
    put(34, 11, 'o');
    row(24, 46, 16, '^'); // the pit is thorny, so a miss is a quick restart
    ground(47, 88, 14);
    put(47, 13, 'C');
    row(51, 54, 13, '^');
    // --- 2: a low tunnel of Frost thorns (cross in Ember), then an Ember wall (cross in Frost) ---
    fill(58, 8, 67, 11, '#');
    row(60, 65, 13, 'b');
    fill(72, 8, 73, 13, 'A');
    fill(75, 8, 84, 11, '#');
    row(76, 83, 13, 'a'); // Ember thorns right behind the wall: the Frost second carries on through both
    put(63, 12, 'o');
    put(69, 13, 'C');
    put(88, 13, 'C');
    // --- 3: stairs of stones, up two tiles each, with a permanent landing in the middle ---
    row(90, 92, 12, 'A'); row(95, 97, 10, 'B');
    fill(100, 8, 105, 16, '#');
    put(101, 7, 'C');
    put(104, 7, '^'); put(105, 7, '^');
    row(106, 108, 6, 'A');
    put(96, 8, 'o'); put(107, 4, 'o');
    fill(112, 6, 117, 16, '#');
    put(115, 5, 'C');
    // --- 4: two Ember stones too far apart for one beat: dash, spark, dash, and hold the world with a double {swap} ---
    sign(112, 2, 'a long jump takes longer than a beat: tap {swap} twice to hold the world');
    row(120, 121, 6, 'A');
    put(127, 4, 'd');
    row(132, 133, 6, 'A');
    fill(135, 6, 137, 16, '#');
    put(136, 5, 'E');
  }),

  // 5. Inverted Gravity: gravity pulls up. Walk on platform bottoms, jump pushes you downward. Simple straight-line sections with abundant thorns.
  build({
    name: 'Inverted Gravity', w: 114, h: 17, seed: 314, twist: { id: 'invertedGravity' },
    reward: { id: 'hc.hat.flipcrown', slot: 'hat', name: 'Upside-Down Crown', desc: 'Cleared Inverted Gravity. A golden crown that hangs the wrong way up.', style: { kind: 'flipcrown' } },
  }, (api) => {
    const fy = (y) => 16 - y;
    const fc = (c) => (c === '^' ? 'v' : c === 'v' ? '^' : c);
    const put = (x, y, c) => api.put(x, fy(y), fc(c));
    const fill = (x0, y0, x1, y1, c) => api.fill(x0, fy(y1), x1, fy(y0), fc(c));
    const row = (x0, x1, y, c) => fill(x0, y, x1, y, c);
    const ground = (x0, x1, top, c = '#') => fill(x0, top, x1, 16, c);
    const sign = (x, y, text) => api.sign(x, fy(y), text);
    // --- practice: flat, the sign explains the twist ---
    ground(0, 23, 14);
    put(6, 13, 'P');
    sign(1, 10, 'INVERTED: gravity flows upward. {jump} or the down key jumps, and pushes you down');
    sign(1, 8, 'run, dash and the world switch stay the same');
    put(2, 13, 'o');
    put(20, 13, 'C');
    // --- 1: simple run with overhead thorns (ceiling) ---
    ground(24, 40, 14);
    row(26, 39, 2, '^'); row(26, 39, 3, '^');
    put(30, 10, 'o');
    put(35, 10, 'o');
    put(40, 14, 'C');
    // --- 2: more overhead thorns and a pit crossing ---
    ground(42, 62, 14);
    row(44, 61, 2, '^'); row(44, 61, 3, '^');
    put(48, 10, 'o');
    put(54, 10, 'o');
    put(60, 10, 'o');
    put(62, 14, 'C');
    // --- 3: world switch section with thorns above ---
    row(65, 75, 13, 'A');
    row(65, 75, 2, '^'); row(65, 75, 3, '^');
    put(70, 10, 'o');
    ground(77, 90, 14);
    put(77, 14, 'C');
    row(79, 88, 2, '^'); row(79, 88, 3, '^');
    put(82, 10, 'o');
    put(86, 10, 'o');
    // --- 4: final crossing to exit ---
    ground(92, 113, 14);
    put(92, 14, 'C');
    row(94, 112, 2, '^'); row(94, 112, 3, '^');
    put(98, 10, 'o');
    put(105, 10, 'o');
    put(113, 14, 'E');
  }),
];
