// Act III levels: crumbling stone. Each level adds a new twist to "keep moving".
import { build } from './level-kit.js';

export const ACT3 = [
  // 9: learn crumbling stone, first over solid floor, then over short pits, then on a bridge you must run across
  build({ name: 'Brittle Crossing', w: 184, h: 17, seed: 163 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 13, 14);
    put(2, 13, 'P');
    sign(1, 8, 'cracked stone breaks. keep moving');
    ground(23, 183, 16); row(23, 183, 15, '^'); // spike floor under the whole crossing
    // first crumble: a step over the safe floor up to the ledge
    row(10, 12, 12, 'x');
    put(12, 8, 'o');
    ground(14, 22, 10);
    // short pit, then a longer bridge
    row(23, 25, 10, 'x');
    ground(26, 31, 10);
    row(32, 39, 10, 'x');
    ground(40, 47, 10);
    put(42, 9, 'C');
    // single crumbling stepping stones under a high spiked vault
    fill(52, 2, 66, 3, '#'); row(52, 66, 4, 'v');
    put(51, 11, 'x');
    put(55, 12, 'x');
    put(59, 11, 'x'); put(59, 7, 'o');
    put(63, 10, 'x');
    put(67, 10, 'x');
    ground(71, 76, 10);
    // the collapsing bridge: low spiked ceiling, so only short hops over its gaps
    fill(78, 5, 100, 6, '#'); row(78, 100, 7, 'v');
    row(77, 100, 11, 'x');
    row(85, 86, 11, '.'); row(93, 94, 11, '.');
    put(90, 9, 'o');
    ground(101, 110, 11);
    put(103, 10, 'C');
    // crumble staircase up to a lonely tower
    row(113, 114, 9, 'x');
    row(117, 118, 7, 'x');
    row(121, 122, 5, 'x');
    ground(125, 131, 5);
    put(129, 2, 'o');
    // down a bridge, switch onto Frost stone, on across another bridge
    fill(134, 0, 154, 1, '#'); row(134, 154, 2, 'v');
    row(132, 140, 8, 'x');
    row(143, 145, 9, 'B');
    row(147, 154, 10, 'x');
    ground(155, 160, 10);
    put(157, 9, 'C');
    // the last span
    fill(162, 2, 173, 3, '#'); row(162, 173, 4, 'v');
    row(161, 176, 10, 'x');
    row(169, 171, 10, '.');
    put(170, 7, 'o');
    ground(177, 183, 10);
    put(181, 9, 'E');
  }),
  // 10: the spans fall away, and the way off each one belongs to the other world
  build({ name: 'Sinking Viaduct', w: 176, h: 17, seed: 170 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 11, 12);
    put(2, 11, 'P');
    sign(1, 6, 'switch worlds without stopping');
    ground(12, 175, 16); row(12, 175, 15, '^');
    // a span that ends at Frost stone, then a Frost wall you must switch away from mid-run
    fill(12, 0, 37, 1, '#'); row(12, 37, 2, 'v');
    row(12, 21, 12, 'x');
    row(24, 26, 12, 'B');
    row(27, 37, 12, 'x');
    fill(33, 8, 33, 11, 'B');
    put(30, 9, 'o');
    ground(38, 48, 12);
    put(40, 11, 'C');
    // a spring beside the pier flings you onto a high span; its only exit is a Frost ledge
    put(48, 11, 'S');
    ground(49, 50, 6);
    row(51, 63, 6, 'x');
    put(59, 3, 'o');
    row(66, 68, 6, 'B');
    ground(70, 79, 7);
    put(75, 6, 'C');
    // the coloured span: crumble, Ember, crumble, Frost... under a low spiked ceiling
    fill(80, 2, 107, 3, '#'); row(80, 107, 4, 'v');
    row(80, 84, 8, 'x');
    row(85, 87, 8, 'A');
    row(88, 91, 8, 'x');
    row(92, 94, 8, 'B'); put(93, 6, 'o');
    row(95, 98, 8, 'x');
    row(99, 101, 8, 'A');
    row(102, 107, 8, 'x');
    row(104, 105, 8, '.');
    ground(108, 117, 8);
    put(111, 7, 'C');
    // down the steps, across the last low span, and a spring up to the far pier
    row(120, 121, 10, 'x');
    row(124, 125, 12, 'x');
    fill(128, 4, 150, 5, '#'); row(128, 150, 6, 'v');
    row(128, 133, 12, 'x');
    row(134, 136, 12, 'B');
    row(137, 141, 12, 'x');
    row(144, 150, 12, 'x');
    put(147, 10, 'o');
    ground(151, 151, 12); put(151, 11, 'S');
    ground(152, 154, 5);
    row(155, 165, 5, 'x');
    ground(166, 175, 5);
    put(173, 4, 'E');
  }),

  // 11: a cathedral whose stairs give way: arches, a gallery, a bell shaft, and the nave collapsing at the end
  build({ name: 'Crumbling Cathedral', w: 189, h: 17, seed: 177 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 11, 13);
    put(2, 12, 'P');
    ground(12, 188, 16); row(12, 188, 15, '^');
    // an arch of crumbling steps under a thorned vault
    fill(12, 0, 56, 0, '#'); row(12, 56, 1, 'v');
    row(12, 13, 11, 'x');
    row(16, 17, 9, 'x');
    row(20, 21, 8, 'x'); put(20, 5, 'o');
    row(24, 25, 9, 'x');
    row(28, 29, 11, 'x');
    ground(31, 41, 13);
    put(37, 12, 'C');
    // the aisle, one Frost flagstone, then a spring up the wall into the gallery
    row(42, 55, 13, 'x');
    row(47, 48, 13, '.');
    row(50, 52, 13, 'B');
    ground(57, 57, 13); put(57, 12, 'S');
    ground(58, 60, 6);
    row(61, 72, 6, 'x');
    put(68, 3, 'o');
    ground(76, 82, 6);
    put(79, 5, 'C');
    // down into the bell shaft, then up single stones before they fall
    fill(84, 0, 91, 1, '#'); row(84, 91, 2, 'v');
    row(85, 86, 8, 'x');
    row(89, 90, 10, 'x');
    ground(93, 95, 12);
    put(98, 10, 'x');
    put(99, 6, 'o');
    put(101, 8, 'x');
    put(104, 6, 'x');
    ground(106, 111, 5);
    // across the belfry: switch back to Ember before the Frost pillar
    row(112, 118, 5, 'x');
    fill(115, 1, 115, 4, 'B');
    ground(122, 128, 5);
    put(124, 4, 'C');
    // the nave collapses: short hops under the thorns, then a spring to the last span
    fill(131, 0, 138, 0, '#'); row(131, 138, 1, 'v');
    row(131, 132, 7, 'x');
    row(135, 136, 9, 'x');
    fill(139, 4, 158, 6, '#'); row(139, 158, 7, 'v');
    row(139, 158, 11, 'x');
    row(145, 146, 11, '.'); row(152, 153, 11, '.');
    put(149, 9, 'o');
    ground(159, 160, 11); put(160, 10, 'S');
    ground(161, 163, 4);
    row(164, 174, 4, 'x');
    row(170, 171, 4, '.');
    ground(178, 188, 5);
    put(185, 4, 'E');
  }),
  // 12: the whole ridge collapses behind you: one long escape to the only stone that holds
  build({ name: 'Collapse', w: 200, h: 17, seed: 184 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 9, 12);
    put(2, 11, 'P');
    sign(1, 6, 'the ridge is falling. run');
    ground(10, 199, 16); row(10, 199, 15, '^');
    // the first spans give way, one of them in Frost
    fill(12, 2, 35, 3, '#'); row(12, 35, 4, 'v');
    row(10, 17, 12, 'x');
    ground(18, 19, 12);
    row(20, 27, 12, 'x');
    row(23, 24, 12, 'B');
    put(24, 9, 'o');
    row(30, 35, 10, 'x');
    ground(36, 46, 12);
    put(41, 11, 'C');
    // spring up the cliff, then across stones that change world on every step
    put(46, 11, 'S');
    ground(47, 48, 6);
    row(49, 58, 6, 'x');
    put(54, 3, 'o');
    row(61, 62, 7, 'A');
    row(65, 66, 6, 'x');
    row(69, 70, 7, 'B');
    ground(73, 81, 7);
    put(77, 6, 'C');
    // the thorn tunnel: the floor crumbles and the walls belong to the other world
    fill(86, 5, 125, 6, '#'); row(86, 125, 7, 'v');
    row(82, 125, 11, 'x');
    fill(95, 8, 95, 10, 'A');
    row(99, 100, 11, '.');
    fill(103, 8, 103, 10, 'B');
    ground(105, 107, 11); put(106, 9, 'o');
    fill(111, 8, 111, 10, 'A');
    row(115, 116, 11, '.');
    fill(120, 8, 120, 10, 'B');
    ground(126, 136, 11);
    put(129, 10, 'C');
    // the escape: a last low run, a spring up the cliff, and the high span to the summit
    fill(137, 5, 156, 6, '#'); row(137, 156, 7, 'v');
    row(137, 159, 11, 'x');
    row(140, 142, 11, 'A');
    ground(145, 147, 11);
    row(151, 153, 11, 'B');
    row(156, 157, 11, '.');
    ground(160, 161, 11); put(161, 10, 'S');
    ground(162, 165, 4);
    row(166, 183, 4, 'x');
    row(170, 172, 4, 'B');
    row(176, 177, 4, '.');
    put(181, 1, 'o');
    ground(186, 199, 4);
    put(196, 3, 'E');
  }),
];
