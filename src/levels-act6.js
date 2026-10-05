// Act VI levels.
import { build } from './level-kit.js';

export const ACT6 = [
  // 22: the floor gives way under every step, the orbs keep you in the air
  build({ name: 'Brittle Sky', w: 228, h: 17, seed: 254 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 7, 13);
    put(2, 12, 'P');
    sign(1, 8, 'the stone will not wait');
    ground(8, 227, 16); row(8, 227, 15, '^');
    // intro: crumble and phase stepping stones
    row(8, 11, 13, 'x');
    row(15, 17, 12, 'A');
    row(21, 22, 11, 'x');
    row(26, 28, 11, 'B');
    row(31, 33, 11, '#'); put(32, 10, 'a');
    // crumble corridor under spikes: run, then dash off the end
    fill(34, 4, 43, 6, '#'); row(34, 43, 7, 'v');
    row(34, 40, 11, 'x');
    put(37, 9, 'o');
    ground(44, 50, 13);
    put(46, 12, 'C');
    // orb leap, then a wall of Frost to pass in Ember
    row(51, 95, 0, 'v');
    put(55, 8, 'd');
    row(60, 63, 12, 'B');
    put(62, 7, 'o');
    fill(66, 4, 66, 11, 'B'); put(66, 3, '^');
    row(68, 70, 11, 'A');
    put(73, 9, 'x');
    put(76, 7, 'x');
    put(81, 2, 'd');
    put(87, 4, 'd');
    row(91, 94, 8, '#');
    ground(97, 103, 11);
    put(99, 10, 'C');
    // the spring throws you into the sky, the orb carries you over
    row(106, 108, 12, '#'); put(107, 11, 'S'); put(108, 11, '^');
    put(111, 2, 'd');
    put(108, 1, 'o');
    row(117, 121, 6, '#');
    row(125, 127, 11, '#');
    // twist: switch worlds while the crumble runs out under a spiked ceiling
    fill(128, 3, 141, 6, '#'); row(128, 141, 7, 'v');
    row(128, 140, 11, 'x');
    row(131, 132, 11, '#'); row(131, 132, 10, 'a');
    row(136, 137, 11, '#'); row(136, 137, 10, 'b');
    ground(144, 151, 12);
    put(146, 11, 'C');
    // stepping stones under the spiked sky
    fill(153, 3, 170, 5, '#'); row(153, 170, 6, 'v');
    put(155, 10, 'A');
    put(159, 10, 'x');
    put(161, 7, 'o');
    put(163, 10, 'B');
    put(167, 10, 'x');
    row(171, 173, 10, '#');
    put(178, 6, 'd');
    row(182, 184, 10, 'x');
    ground(187, 192, 11);
    put(189, 10, 'C');
    // payoff: a breaking bridge, then the long flight home
    row(192, 221, 2, 'v');
    row(194, 197, 11, 'x');
    row(200, 203, 11, 'x');
    row(206, 208, 10, 'B');
    put(213, 7, 'd');
    put(218, 8, 'd');
    put(211, 5, 'o');
    ground(222, 227, 11);
    put(225, 10, 'E');
  }),
  // 23: thorns above, thorns below, thorns in both colours: a long precision run with no room to breathe
  build({ name: "Needle's Eye", w: 236, h: 17, seed: 261 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 6, 12);
    put(2, 11, 'P');
    sign(1, 6, 'keep your head down');
    ground(7, 103, 16); row(7, 103, 15, '^');
    ground(149, 206, 16); row(149, 206, 15, '^');
    // tunnel of colours: islands under a spiked ceiling
    fill(10, 4, 44, 6, '#'); row(10, 44, 7, 'v');
    row(9, 14, 11, '#'); row(11, 12, 10, 'a');
    row(18, 24, 11, '#'); put(19, 10, 'b'); put(23, 10, 'a');
    row(28, 30, 11, 'B');
    put(32, 8, 'o');
    row(34, 36, 11, 'A');
    row(39, 44, 11, '#'); row(41, 42, 10, 'b');
    ground(46, 50, 12);
    put(48, 11, 'C');
    // thorn stair: every platform a different world
    fill(54, 1, 96, 3, '#'); row(54, 96, 4, 'v');
    row(54, 56, 10, '=');
    row(59, 61, 8, 'A');
    put(64, 5, 'o');
    row(66, 68, 8, 'B');
    row(72, 77, 8, '#'); put(73, 7, 'b'); put(76, 7, 'a');
    row(81, 82, 8, 'A');
    row(86, 87, 8, 'B');
    row(91, 93, 10, '=');
    ground(98, 103, 12);
    put(100, 11, 'C');
    // the needle's eye: no room to jump, dash every gap, switch on the run
    fill(104, 7, 148, 9, '#'); row(104, 148, 10, 'v');
    fill(106, 8, 107, 10, '.'); put(106, 9, 'o');
    row(104, 108, 12, '#');
    row(111, 115, 12, '#'); put(113, 11, 'a');
    row(118, 120, 12, 'B');
    row(123, 128, 12, '#'); put(124, 11, 'b'); put(127, 11, 'a');
    row(131, 133, 12, 'A');
    row(136, 141, 12, '#'); put(137, 11, 'a'); put(140, 11, 'b');
    row(144, 148, 12, '#');
    ground(150, 155, 12);
    put(152, 11, 'C');
    // single stones under the spiked sky
    fill(158, 1, 186, 3, '#'); row(158, 186, 4, 'v');
    row(158, 160, 10, '=');
    put(164, 8, '#'); put(164, 7, 'a');
    put(166, 5, 'o');
    put(168, 8, 'B');
    put(172, 8, 'A');
    put(176, 8, '#'); put(176, 7, 'b');
    put(180, 8, 'B');
    row(184, 186, 10, '=');
    ground(190, 197, 12);
    put(192, 11, 'C');
    // the last needle: alternating worlds, one dash per gap
    fill(198, 7, 225, 9, '#'); row(198, 225, 10, 'v');
    fill(199, 8, 200, 10, '.'); put(199, 9, 'o');
    row(198, 200, 12, '#');
    row(203, 205, 12, 'A');
    row(208, 209, 12, 'B');
    row(212, 215, 12, '#'); put(213, 11, 'b');
    row(218, 219, 12, 'A');
    row(222, 223, 12, 'B');
    ground(226, 235, 12);
    put(232, 11, 'E');
  }),
  // 24: the world beats on its own and the stone will not hold you between beats
  build({ name: 'Heartbeat', w: 240, h: 17, seed: 268, pulse: 1.4 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 7, 12);
    put(2, 11, 'P');
    sign(1, 6, 'wait on stone, move on the beat');
    ground(8, 239, 16); row(8, 239, 15, '^');
    // first beats: phase steps, a resting stone, a crumble bridge, a thorn floor that sleeps in Frost
    row(10, 13, 12, 'A');
    row(17, 20, 12, 'B'); fill(17, 5, 20, 7, '#'); row(17, 20, 8, 'v');
    row(24, 26, 12, '#'); put(25, 11, 'b');
    fill(28, 5, 47, 7, '#'); row(28, 47, 8, 'v');
    row(29, 36, 12, 'x');
    row(39, 46, 12, '#'); row(41, 44, 11, 'a');
    put(43, 9, 'o');
    ground(48, 53, 12);
    put(51, 11, 'C');
    // an orb over the gap, then two walls that take turns
    row(56, 57, 11, '#');
    put(61, 7, 'd');
    row(66, 68, 11, 'x');
    fill(71, 3, 84, 4, '#');
    row(71, 74, 12, '#');
    fill(75, 5, 75, 11, 'A');
    row(76, 78, 12, 'x');
    put(77, 9, 'o');
    fill(79, 5, 79, 11, 'B');
    row(80, 84, 12, '#');
    row(88, 90, 12, 'B');
    ground(93, 98, 12);
    put(96, 11, 'C');
    // twist: a Frost window to fly through two Ember walls
    row(99, 121, 2, 'v');
    put(103, 8, 'd');
    fill(105, 4, 105, 13, 'A');
    put(109, 10, 'd');
    put(101, 7, 'o');
    fill(111, 4, 111, 13, 'A');
    row(114, 116, 12, 'x');
    row(119, 121, 10, '#');
    // the beat bridge under a spiked sky
    fill(123, 3, 138, 5, '#'); row(123, 138, 6, 'v');
    row(124, 125, 10, 'A');
    row(128, 129, 10, 'B');
    put(130, 7, 'o');
    row(132, 133, 10, 'A');
    row(136, 137, 10, 'B');
    ground(141, 146, 12);
    put(144, 11, 'C');
    // payoff: everything at once
    fill(148, 2, 186, 3, '#'); row(148, 186, 4, 'v');
    row(150, 152, 11, 'B');
    row(155, 157, 11, 'x');
    row(160, 166, 11, '#'); row(161, 164, 10, 'a');
    put(170, 8, 'd');
    row(174, 176, 10, 'A');
    row(179, 181, 10, 'x');
    row(184, 185, 11, 'B');
    ground(187, 192, 12);
    put(190, 11, 'C');
    put(197, 8, 'd');
    fill(199, 4, 199, 13, 'B');
    put(203, 9, 'd');
    row(207, 209, 11, '#');
    fill(211, 6, 230, 7, '#'); row(211, 230, 8, 'v');
    row(211, 218, 12, 'x');
    row(221, 223, 12, '#'); row(221, 223, 11, 'b');
    row(224, 229, 12, 'x');
    put(226, 10, 'o');
    ground(232, 239, 12);
    put(236, 11, 'E');
  }),
  // 25: the finale, one journey through every trick the two worlds have taught you
  build({ name: 'Dusklight', w: 272, h: 17, seed: 275 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 9, 12);
    put(2, 11, 'P');
    sign(1, 6, 'one last light');
    ground(10, 271, 16); row(10, 271, 15, '^');
    // I. two worlds: swap your way up and down
    row(11, 13, 11, 'A');
    row(16, 18, 10, 'B');
    row(21, 23, 9, 'A');
    put(22, 5, 'o');
    fill(26, 3, 38, 4, '#'); row(26, 38, 5, 'v');
    row(26, 29, 11, '=');
    row(32, 34, 9, 'B');
    row(37, 39, 11, 'A');
    ground(41, 49, 12);
    put(45, 11, 'C');
    // II. thorns: a low corridor with spikes in both colours
    fill(51, 6, 90, 7, '#'); row(51, 90, 8, 'v');
    row(51, 55, 12, '#'); row(52, 53, 11, 'a');
    row(59, 61, 12, 'B');
    row(64, 70, 12, '#'); put(65, 11, 'b'); put(68, 11, 'a');
    row(74, 75, 12, 'A');
    put(77, 9, 'o');
    row(79, 84, 12, '#'); row(80, 81, 11, 'b');
    row(88, 90, 12, 'B');
    ground(92, 100, 12);
    put(96, 11, 'C');
    // III. crumble: climb the breaking stairs, cross the breaking bridge without a jump
    row(103, 104, 11, 'x');
    row(107, 108, 9, 'x');
    row(111, 112, 7, 'x');
    fill(115, 0, 129, 2, '#'); row(115, 129, 3, 'v');
    row(115, 120, 7, 'x');
    put(118, 5, 'o');
    row(123, 128, 7, 'x');
    row(131, 133, 11, 'B');
    row(137, 139, 11, 'A');
    ground(141, 149, 12);
    put(145, 11, 'C');
    // IV. sparks: orbs and walls of the other world
    put(154, 8, 'd');
    ground(159, 161, 11);
    fill(164, 3, 164, 11, 'A');
    row(167, 169, 11, 'A');
    row(167, 181, 1, 'v');
    put(174, 7, 'd');
    put(171, 6, 'o');
    put(179, 8, 'd');
    row(183, 185, 11, 'x');
    ground(187, 195, 12);
    put(191, 11, 'C');
    // V. the needle and the stones: no room to jump, then nothing but single stones
    fill(196, 7, 214, 9, '#'); row(196, 214, 10, 'v');
    row(196, 198, 12, '#');
    row(201, 202, 12, 'B');
    row(205, 209, 12, '#'); put(207, 11, 'a');
    row(212, 213, 12, 'A');
    ground(216, 218, 12);
    fill(221, 1, 233, 3, '#'); row(221, 233, 4, 'v');
    row(219, 221, 10, '=');
    put(225, 8, 'B');
    put(229, 8, '#'); put(229, 7, 'a');
    put(233, 8, 'A');
    ground(235, 242, 12);
    put(237, 11, 'C');
    // VI. into the light: a spring to the sky, a bridge that falls behind you, one last orb
    row(245, 247, 11, 'B');
    row(250, 252, 12, '#'); put(251, 11, 'S');
    put(252, 1, 'o');
    row(255, 266, 0, 'v');
    row(255, 262, 4, 'x');
    put(265, 3, 'd');
    ground(267, 271, 4);
    put(269, 3, 'E');
  }),
];
