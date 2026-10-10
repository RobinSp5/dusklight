// Hardcore Pack: a standalone set of levels, never mixed into LEVELS (levels.js). Progress, stars, ghosts and the death map
// live under their own storage keys (see packs.js); nothing here changes the campaign.
//
// Level meta on top of the usual { name, w, h, seed, startPhase?, pulse? }:
//   twist:  { id, ...params }  the level's rule twist, see registerTwist() in world.js (none yet)
//   reward: { id, slot, name, desc, style }  one unique reward, granted on the first clear and stored in the Hardcore save only.
//           id starts with 'hc.' and is unique across the pack; slot is a cosmetic slot of shop.js (body, scarf, hat, trail,
//           death, theme); style is the same shape as a shop item's style. Rewards are looks only: no physics, no shop items.
// Rules for every level (checked by tests/solve.mjs, tests/profile.mjs, tests/fairness.mjs): the twist is explained on a sign in
// the first section, the start is a harmless practice area, no randomness, a checkpoint at least every ~25 tiles.
// Add the level's par time to PAR_HC in progress.js (route * 1.8 + 5).
import { build } from './level-kit.js';

export const HARDCORE = [
  // Placeholder course for the foundation PR: exercises the pack plumbing (menu, storage, reward) with plain campaign mechanics.
  // The level PRs replace it with the real five.
  build({
    name: 'Proving Ground', w: 84, h: 17, seed: 301,
    reward: { id: 'hc.hat.proving', slot: 'hat', name: 'Proving Halo', desc: 'Reward of the foundation placeholder. The level PRs replace it.', style: { kind: 'halo' } },
  }, ({ ground, row, put, fill, sign }) => {
    ground(0, 20, 14);
    put(3, 13, 'P');
    put(18, 13, 'C');
    sign(2, 9, 'hardcore pack: every level adds a twist');
    put(8, 12, 'o');
    // gap and spikes
    ground(25, 46, 14);
    put(33, 13, '^'); put(34, 13, '^');
    put(33, 10, 'o');
    put(41, 12, 'o');
    put(40, 13, 'C');
    // a Frost bridge over a pit, then an Ember wall
    row(47, 52, 14, 'B');
    ground(53, 70, 14);
    put(55, 13, 'C');
    fill(61, 8, 62, 13, 'A');
    ground(71, 83, 12);
    put(72, 11, 'C');
    put(80, 11, 'E');
  }),
];
