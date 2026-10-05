// Act V levels: Pulse. The world flips on its own; the player only reads the beat.
import { build } from './level-kit.js';

export const ACT5 = [
  // Metronome: learn to wait for the flip, then move with it.
  build({ name: 'Metronome', w: 236, h: 17, seed: 226, pulse: 2.0 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    // 1. a door that opens on the beat, then a Frost step over safe ground
    ground(0, 16, 13);
    put(2, 12, 'P');
    sign(1, 7, 'the world switches on its own. wait for the beat.');
    fill(7, 0, 7, 8, '#'); fill(7, 9, 7, 12, 'A');
    row(13, 15, 11, 'B'); put(14, 7, 'o');
    ground(17, 20, 9);
    pit(21, 23); row(24, 27, 9, '#');
    // 2. first crossing over a pit
    pit(28, 47);
    row(30, 47, 2, '#'); row(30, 47, 3, 'v');
    row(30, 32, 10, 'A');
    row(36, 38, 10, '#');
    row(42, 44, 10, 'B'); put(43, 6, 'o');
    ground(48, 55, 10); put(50, 9, 'C');
    // 3. Ember and Frost take turns, then thorns that sleep in Frost under a low thorn sky
    pit(56, 104);
    row(58, 72, 3, '#'); row(58, 72, 4, 'v');
    row(58, 60, 10, 'A'); row(63, 65, 10, 'B'); row(68, 70, 10, 'A'); row(73, 75, 10, 'B');
    put(77, 5, 'o');
    row(79, 97, 10, '#'); row(87, 93, 9, 'a');
    row(85, 97, 5, '#'); row(85, 97, 6, 'v');
    row(100, 102, 10, 'A');
    ground(105, 112, 12); put(107, 11, 'C');
    // 4. doors: one chamber per beat
    pit(113, 136); row(113, 136, 12, '#');
    row(112, 135, 7, '#'); row(112, 135, 8, '#');
    fill(116, 9, 116, 11, 'A'); fill(121, 9, 121, 11, 'B'); fill(126, 9, 126, 11, 'A'); fill(131, 9, 131, 11, 'B');
    put(119, 11, 'b'); put(124, 11, 'a'); put(129, 11, 'b');
    // 5. the beat zigzags
    pit(137, 159);
    row(138, 158, 2, '#'); row(138, 158, 3, 'v');
    row(139, 141, 11, 'A'); row(144, 146, 9, 'B'); row(149, 151, 11, 'A'); row(154, 156, 9, 'B');
    put(155, 5, 'o');
    ground(160, 167, 10); put(162, 9, 'C');
    // 6. finale: step, wait, step under the thorn sky
    pit(168, 214);
    row(170, 192, 10, '#');
    row(172, 192, 5, '#'); row(172, 192, 6, 'v');
    row(174, 177, 9, 'a'); row(180, 183, 9, 'b'); row(186, 189, 9, 'a');
    row(195, 197, 10, 'B'); row(200, 202, 9, 'A'); row(206, 208, 10, 'B');
    put(212, 6, 'o');
    ground(211, 235, 10);
    put(231, 9, 'E');
  }),

  // Tide Clock: Ember lies low, Frost stands tall. Ride the tide and never stand where the next world grows.
  build({ name: 'Tide Clock', w: 246, h: 17, seed: 233, pulse: 1.7 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    // 1. the tide: low Ember steps, high Frost steps
    ground(0, 12, 12);
    put(2, 11, 'P');
    pit(13, 60);
    row(15, 32, 3, '#'); row(15, 32, 4, 'v');
    row(15, 17, 12, 'A'); row(20, 22, 10, 'B'); row(25, 27, 12, 'A'); row(30, 32, 10, 'B');
    put(29, 6, 'o');
    row(35, 38, 11, '#');
    // 2. thorns that wake in turns under a low thorn sky
    ground(41, 58, 11);
    row(41, 58, 6, '#'); row(41, 58, 7, 'v');
    row(43, 46, 10, 'a'); row(49, 52, 10, 'b'); row(55, 57, 10, 'a');
    ground(61, 67, 11); put(63, 10, 'C');
    sign(62, 6, 'stand where the next world will not grow');
    // 3. pistons: stone with Frost on top. Stand on the stone in Frost and it crushes you.
    pit(68, 99);
    row(70, 84, 3, '#'); row(70, 84, 4, 'v');
    for (const x of [71, 75, 79, 83, 87]) { put(x, 11, '#'); put(x, 10, 'B'); }
    put(81, 5, 'o');
    ground(89, 93, 11);
    // a crumbling run into a door that only opens in Frost
    row(94, 99, 11, 'x');
    fill(100, 0, 100, 6, '#'); fill(100, 7, 100, 10, 'A');
    ground(100, 108, 11); put(104, 10, 'C');
    // 4. the tide rises, then falls
    pit(109, 170);
    row(111, 113, 11, '#');
    row(116, 118, 9, 'A'); row(121, 123, 7, 'B'); put(122, 3, 'o');
    row(127, 139, 0, '#'); row(127, 139, 1, 'v');
    row(127, 129, 7, 'A'); row(132, 134, 9, 'B'); row(137, 139, 11, 'A');
    ground(142, 152, 11);
    row(142, 152, 6, '#'); row(142, 152, 7, 'v');
    row(144, 146, 10, 'b'); row(149, 150, 10, 'a');
    row(154, 164, 3, '#'); row(154, 164, 4, 'v');
    for (const x of [155, 159, 163]) { put(x, 11, '#'); put(x, 10, 'A'); }
    put(159, 5, 'o');
    ground(167, 174, 11); put(169, 10, 'C');
    // 5. finale: the whole clock at once
    pit(175, 232);
    row(175, 186, 2, '#'); row(175, 186, 3, 'v');
    row(177, 179, 11, 'A'); row(182, 184, 9, 'B');
    ground(187, 198, 9);
    row(187, 198, 4, '#'); row(187, 198, 5, 'v');
    row(189, 191, 8, 'b'); row(194, 196, 8, 'a');
    for (const x of [201, 205, 209]) { put(x, 10, '#'); put(x, 9, 'B'); }
    row(212, 214, 11, 'x');
    row(217, 219, 10, 'B'); row(222, 224, 10, 'A');
    put(220, 5, 'o');
    row(227, 230, 10, '#'); ground(227, 228, 10);
    ground(233, 245, 10);
    put(241, 9, 'E');
  }),

  // Breathing Walls: the walls breathe. Valves open and close, pistons rise, and you slip through between beats.
  build({ name: 'Breathing Walls', w: 258, h: 17, seed: 240, pulse: 1.5 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    const door = (x, c) => fill(x, 8, x, 10, c);
    // 1. the valves: a sealed corridor, one chamber per beat, sometimes two
    ground(0, 10, 11);
    put(2, 10, 'P');
    pit(11, 51);
    row(11, 46, 11, '#'); ground(41, 46, 11);
    row(13, 40, 6, '#'); row(13, 40, 7, '#');
    door(16, 'A'); door(21, 'B'); door(25, 'B'); door(30, 'A'); door(34, 'A'); door(39, 'B');
    put(19, 10, 'b'); put(23, 10, 'b'); put(28, 10, 'a'); put(32, 10, 'a'); put(37, 10, 'b');
    sign(3, 6, 'two doors, one beat: keep running');
    row(48, 50, 9, 'B'); put(49, 5, 'o');
    ground(52, 58, 11); put(54, 10, 'C');
    // 2. pistons: stone crowned with one world. Leave before the crown grows into you.
    pit(59, 107);
    row(61, 80, 3, '#'); row(61, 80, 4, 'v');
    for (const x of [62, 66, 78]) { put(x, 11, '#'); put(x, 10, 'B'); }
    for (const x of [70, 74]) { put(x, 11, '#'); put(x, 10, 'A'); }
    put(72, 6, 'o');
    ground(81, 100, 11);
    row(86, 100, 6, '#'); row(86, 100, 7, 'v');
    row(88, 90, 10, 'a'); row(92, 94, 10, 'b'); row(96, 97, 10, 'a');
    row(103, 105, 9, 'B');
    ground(108, 114, 11); put(110, 10, 'C');
    // 3. breathless: dash through the open wall, refill on the orb, land on Frost
    pit(115, 165);
    row(115, 121, 0, '#'); row(115, 121, 1, 'v'); row(123, 134, 0, '#'); row(123, 134, 1, 'v');
    ground(115, 134, 13); row(115, 134, 12, '^'); // a thorn bed right under the leap
    put(119, 8, 'd');
    fill(122, 0, 122, 3, '#'); fill(122, 4, 122, 9, 'A');
    put(126, 7, 'o');
    row(125, 127, 11, 'B');
    ground(135, 138, 11);
    row(139, 145, 11, 'x');
    row(139, 145, 6, '#'); row(139, 145, 7, 'v');
    fill(146, 0, 146, 6, '#'); fill(146, 7, 146, 10, 'A');
    ground(146, 150, 11);
    row(152, 162, 3, '#'); row(152, 162, 4, 'v');
    for (const x of [153, 157]) { put(x, 11, '#'); put(x, 10, 'B'); }
    put(161, 11, '#'); put(161, 10, 'A');
    ground(165, 172, 11); put(168, 10, 'C');
    // 4. systole: everything at once, then the last valves
    pit(173, 248);
    row(175, 177, 11, 'A'); row(180, 182, 11, 'B'); row(185, 187, 11, 'A');
    row(174, 188, 3, '#'); row(174, 188, 4, 'v');
    ground(190, 203, 11);
    row(190, 203, 6, '#'); row(190, 203, 7, 'v');
    row(192, 194, 10, 'b'); row(196, 198, 10, 'a'); row(200, 201, 10, 'b');
    ground(204, 209, 11); put(206, 10, 'C');
    row(212, 219, 3, '#'); row(212, 219, 4, 'v');
    put(212, 11, '#'); put(212, 10, 'B'); put(216, 11, '#'); put(216, 10, 'A');
    put(219, 11, 'x'); put(222, 11, 'x');
    row(225, 227, 9, 'B'); row(230, 232, 11, 'A');
    put(226, 4, 'o');
    row(235, 248, 11, '#');
    row(236, 247, 6, '#'); row(236, 247, 7, '#');
    door(239, 'B'); door(243, 'A');
    put(241, 10, 'a');
    put(233, 7, 'o');
    ground(249, 257, 11);
    put(254, 10, 'E');
  }),

  // Crescendo: the beat speeds up and every trick of the act plays at once.
  build({ name: 'Crescendo', w: 270, h: 17, seed: 247, pulse: 1.3 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    const door = (x, c) => fill(x, 8, x, 10, c);
    const piston = (x, crown) => { put(x, 11, '#'); put(x, 10, crown); };
    // 1. overture: one hop per beat, then thorns in turns
    ground(0, 9, 11);
    put(2, 10, 'P');
    sign(1, 6, 'faster now. move on the warning.');
    pit(10, 52);
    row(10, 26, 2, '#'); row(10, 26, 3, 'v');
    row(12, 14, 11, 'B'); row(17, 19, 11, 'A'); row(22, 24, 11, 'B'); row(27, 29, 9, 'A');
    put(25, 6, 'o');
    ground(32, 46, 11);
    row(32, 46, 6, '#'); row(32, 46, 7, 'v');
    row(34, 36, 10, 'a'); row(39, 40, 10, 'b'); row(43, 44, 10, 'a');
    row(49, 51, 10, 'B');
    ground(53, 59, 11); put(55, 10, 'C');
    // 2. pistons into the valves
    pit(60, 113);
    row(61, 76, 2, '#'); row(61, 76, 3, 'v');
    piston(62, 'A'); piston(66, 'B'); piston(70, 'A'); piston(74, 'B');
    put(72, 6, 'o');
    row(77, 79, 9, 'A');
    ground(82, 104, 11);
    row(84, 102, 6, '#'); row(84, 102, 7, '#');
    door(86, 'B'); door(90, 'A'); door(93, 'A'); door(97, 'B'); door(101, 'A');
    put(88, 10, 'a'); put(95, 10, 'b'); put(99, 10, 'a');
    row(107, 109, 10, 'B');
    ground(111, 117, 11); put(113, 10, 'C');
    // 3. a crumbling run into a closing wall, then breathless over the orb
    pit(118, 172);
    row(118, 125, 11, 'x');
    row(118, 125, 6, '#'); row(118, 125, 7, 'v');
    fill(126, 0, 126, 6, '#'); fill(126, 7, 126, 10, 'B');
    ground(126, 129, 11);
    row(130, 145, 0, '#'); row(130, 145, 1, 'v');
    ground(130, 144, 13); row(130, 144, 12, '^'); // a thorn bed right under the leap
    put(134, 8, 'd');
    fill(137, 0, 137, 3, '#'); fill(137, 4, 137, 9, 'B');
    put(141, 7, 'o');
    row(140, 142, 11, 'A');
    row(145, 147, 11, '#'); ground(146, 147, 11);
    piston(150, 'B'); piston(154, 'A'); piston(158, 'B');
    row(149, 159, 2, '#'); row(149, 159, 3, 'v');
    row(162, 167, 2, '#'); row(162, 167, 3, 'v');
    row(161, 163, 9, 'A'); row(166, 168, 11, 'B');
    ground(171, 177, 11); put(173, 10, 'C');
    // 4. crescendo: up, down, through the thorns, through the last valves
    pit(178, 261);
    row(180, 182, 11, 'A'); row(185, 187, 9, 'B'); row(190, 192, 7, 'A'); row(195, 197, 9, 'B'); row(200, 202, 11, 'A');
    put(191, 3, 'o');
    ground(205, 222, 11);
    row(205, 222, 6, '#'); row(205, 222, 7, 'v');
    row(207, 209, 10, 'b'); row(212, 213, 10, 'a'); row(216, 217, 10, 'b'); row(220, 221, 10, 'a');
    ground(223, 228, 11); put(225, 10, 'C');
    piston(231, 'A'); put(234, 11, 'x'); piston(237, 'B'); put(240, 11, 'x');
    row(230, 241, 3, '#'); row(230, 241, 4, 'v');
    row(243, 258, 11, '#');
    row(244, 257, 6, '#'); row(244, 257, 7, '#');
    door(246, 'A'); door(250, 'B'); door(253, 'B'); door(256, 'A');
    put(248, 10, 'b'); put(252, 10, 'a');
    put(242, 7, 'o');
    ground(262, 269, 11);
    put(266, 10, 'E');
  }),
];
