// Act IV levels: Sparks. Dash orbs (d) refill the dash in mid-air.
import { build } from './level-kit.js';

export const ACT4 = [
  // 13: an orb is a second breath in the air. Learn it over a safe trough, then over spikes.
  build({ name: 'First Sparks', w: 206, h: 17, seed: 191 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    // introduce: a safe trough. Missing the spark drops you in, the steps lead back up
    ground(0, 12, 12);
    put(2, 11, 'P');
    sign(1, 7, '{dash} into a spark, then {dash} again');
    ground(13, 21, 15);
    put(17, 8, 'd');
    ground(22, 30, 11);
    put(17, 13, 'o');
    // the same move over spikes
    pit(31, 40);
    put(35, 7, 'd');
    ground(41, 50, 11);
    put(44, 10, 'C');
    // develop: spark lines over a spike floor
    pit(51, 104);
    put(55, 7, 'd');
    row(60, 62, 11, '#');
    put(66, 7, 'd'); put(70, 7, 'd');
    row(76, 78, 11, '#');
    put(80, 6, 'o');
    put(82, 8, 'd');
    row(87, 88, 12, '#');
    put(92, 9, 'd');
    row(97, 99, 12, '#'); row(97, 99, 13, '#');
    ground(105, 113, 12);
    put(107, 11, 'C');
    // twist: the landing only exists in Frost
    pit(114, 160);
    put(118, 8, 'd');
    row(123, 125, 11, 'B');
    put(129, 7, 'd');
    fill(132, 4, 132, 10, 'B'); row(134, 136, 10, 'A');
    put(135, 5, 'o');
    put(140, 7, 'd'); put(144, 7, 'd');
    row(149, 151, 11, 'B');
    put(155, 8, 'd');
    ground(161, 171, 11);
    put(163, 10, 'C');
    // payoff: long, falling spark run to the exit
    pit(172, 195);
    put(175, 6, 'd'); put(179, 7, 'd');
    row(183, 184, 12, '#');
    put(188, 8, 'd'); put(186, 7, 'o');
    put(192, 9, 'd');
    ground(196, 205, 12);
    put(201, 11, 'E');
    put(199, 8, 'o');
    // a thorned sky over the long spike floors
    row(51, 104, 0, '#'); row(51, 104, 1, 'v');
    row(121, 155, 0, '#'); row(121, 155, 1, 'v');
  }),

  // 14: bridges of light. Spark chains cross long pits, and the landings live in one world only.
  build({ name: 'Lantern Bridge', w: 184, h: 17, seed: 198 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    ground(0, 9, 12);
    put(2, 11, 'P');
    // introduce: a double spark bridge, then a single one with a shard above the line
    pit(10, 22);
    put(14, 8, 'd'); put(17, 8, 'd');
    ground(23, 26, 12);
    pit(27, 35);
    put(31, 8, 'd'); put(34, 7, 'o');
    ground(36, 43, 12);
    put(39, 11, 'C');
    // develop: take off in Ember, land in Frost, then back again
    pit(44, 85);
    row(44, 46, 12, 'A');
    sign(40, 7, 'switch worlds mid-dash');
    put(51, 8, 'd');
    row(55, 57, 11, 'B');
    put(62, 7, 'd'); put(64, 6, 'o');
    row(66, 68, 11, 'A');
    put(73, 7, 'd'); put(76, 7, 'd');
    fill(75, 4, 75, 9, 'A');
    row(79, 81, 11, 'B');
    ground(86, 92, 12);
    put(87, 11, 'C');
    // twist: a three-spark bridge, then a spark caged in Ember stone
    pit(93, 124);
    put(97, 8, 'd'); put(100, 8, 'd'); put(103, 8, 'd');
    row(107, 109, 12, '#');
    fill(112, 3, 112, 10, 'A'); put(114, 8, 'd'); put(115, 6, 'o');
    row(118, 120, 11, 'A');
    ground(125, 131, 12);
    put(126, 11, 'C');
    // payoff: every trick in one long crossing
    pit(132, 174);
    put(136, 8, 'd'); put(139, 8, 'd');
    row(144, 146, 11, 'B');
    put(151, 7, 'd'); put(154, 7, 'd'); put(157, 7, 'd');
    fill(155, 3, 155, 9, 'B'); put(149, 6, 'o');
    row(162, 163, 12, '#');
    put(168, 8, 'd'); put(170, 7, 'o');
    ground(175, 183, 12);
    put(179, 11, 'E');
    // thorned sky, pierced by the window walls
    row(44, 140, 0, '#'); row(44, 140, 1, 'v');
    fill(50, 0, 51, 6, '#'); ground(50, 51, 11); row(50, 51, 10, '^');
    fill(60, 0, 61, 14, 'B');
  }),

  // 15: springs throw you to the sky, sparks carry you across it. Up, across, down, repeat.
  build({ name: 'Updraft', w: 192, h: 17, seed: 205 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    const spring = (x) => { ground(x, x + 1, 13); put(x, 12, 'S'); };
    ground(0, 9, 13);
    put(2, 12, 'P');
    sign(1, 8, 'hold {jump} on springs, spark at the top');
    // introduce: a plain spring hop, then a spring that needs the sparks
    pit(10, 191);
    put(8, 12, 'S');
    row(14, 17, 7, '#');
    put(16, 3, 'o');
    spring(23);
    put(28, 3, 'd'); put(30, 3, 'd');
    ground(36, 40, 7);
    put(38, 6, 'C');
    // develop: a spark line at ledge height, then the next launch
    put(45, 3, 'd'); put(48, 3, 'd');
    row(52, 54, 7, '#');
    spring(60);
    put(65, 3, 'd'); put(67, 3, 'd'); put(70, 2, 'o');
    ground(73, 77, 7);
    put(75, 6, 'C');
    // twist: walls of one world stand in the spark line
    spring(83);
    fill(88, 0, 88, 9, 'A'); put(89, 3, 'd'); put(91, 3, 'd');
    row(97, 100, 7, 'B');
    fill(104, 0, 104, 6, 'B'); put(106, 3, 'd');
    row(110, 112, 7, 'A');
    put(108, 9, 'o');
    ground(116, 120, 7);
    put(118, 6, 'C');
    spring(126);
    fill(131, 0, 131, 9, 'B'); put(132, 3, 'd'); put(134, 3, 'd');
    row(140, 143, 7, 'A');
    put(148, 3, 'd'); fill(150, 0, 150, 6, 'A'); put(151, 3, 'd');
    row(155, 157, 7, 'B');
    ground(161, 165, 7);
    put(163, 6, 'C');
    // payoff: one last launch to the exit cliff
    spring(171);
    put(176, 3, 'd'); put(178, 3, 'd'); put(181, 2, 'o');
    ground(186, 191, 7);
    put(189, 6, 'E');
    // a thorned sky, high enough to stay clear of every spring flight
    row(20, 116, 0, '#'); row(20, 116, 1, 'v');
    fill(88, 0, 88, 9, 'A'); fill(104, 0, 104, 6, 'B'); fill(131, 0, 131, 9, 'B'); fill(150, 0, 150, 6, 'A');
  }),

  // 16: thorns hang low. Hop under them and dash from spark to spark; crumbling stone keeps you moving.
  build({ name: 'Needle Run', w: 213, h: 17, seed: 212 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    const thorns = (x0, x1, y) => { row(x0, x1, y - 1, '#'); row(x0, x1, y, 'v'); };
    // introduce: a low thorn ceiling, sparks at hop height
    ground(0, 15, 12);
    put(2, 11, 'P');
    sign(1, 6, 'thorns above: hop low, then {dash}');
    thorns(12, 40, 8);
    pit(16, 23);
    put(19, 10, 'd'); put(22, 10, 'd'); put(20, 9, 'o');
    ground(24, 29, 12);
    pit(30, 35);
    put(33, 10, 'd');
    ground(36, 44, 12);
    put(42, 11, 'C');
    // develop: crumbling launch pads climb toward the sky, then drop under thorns again
    pit(45, 100);
    put(49, 8, 'd'); put(52, 8, 'd');
    row(56, 57, 11, 'x');
    put(62, 7, 'd');
    row(66, 67, 10, 'x');
    put(71, 6, 'd'); put(74, 6, 'd'); put(77, 5, 'o');
    ground(79, 82, 10);
    thorns(88, 100, 7);
    row(88, 89, 11, 'x');
    put(93, 10, 'd');
    row(97, 98, 11, 'x');
    ground(101, 108, 11);
    put(104, 10, 'C');
    // twist: the thorn corridor changes worlds under your feet
    pit(109, 149);
    thorns(111, 148, 7);
    row(112, 114, 11, 'A');
    put(118, 10, 'd');
    row(122, 124, 11, 'B');
    row(128, 131, 11, '#'); row(129, 130, 10, 'a');
    put(135, 10, 'd'); put(138, 10, 'd'); put(137, 9, 'o');
    row(142, 144, 11, 'B');
    put(147, 10, 'd');
    ground(150, 158, 11);
    put(153, 10, 'C');
    // payoff: thorns first, then crumbling steps up to the exit
    pit(159, 202);
    thorns(161, 178, 7);
    row(163, 164, 11, 'x');
    put(168, 10, 'd'); put(171, 10, 'd');
    row(174, 175, 11, 'x');
    put(179, 10, 'd');
    row(183, 184, 12, 'x');
    put(189, 8, 'd');
    row(193, 194, 10, 'x');
    put(198, 6, 'd'); put(196, 5, 'o');
    ground(203, 212, 8);
    put(209, 7, 'E');
  }),

  // 17: the act's finale. One long breath: every landing crumbles, every spark leads to the next.
  build({ name: 'Chainlight', w: 229, h: 17, seed: 219 }, ({ ground, row, put, fill, sign }) => {
    const pit = (x0, x1) => { ground(x0, x1, 16); row(x0, x1, 15, '^'); };
    const thorns = (x0, x1, y) => { row(x0, x1, y - 1, '#'); row(x0, x1, y, 'v'); };
    ground(0, 10, 12);
    put(2, 11, 'P');
    sign(1, 7, 'one breath: keep moving');
    pit(11, 228);
    // introduce: a spark bridge onto crumbling stone, and straight on
    put(14, 8, 'd'); put(17, 8, 'd');
    row(22, 23, 11, 'x');
    put(28, 7, 'd'); put(31, 7, 'd'); put(34, 7, 'o');
    ground(33, 44, 12);
    put(38, 11, 'C');
    // develop: a thorn tunnel that changes worlds under your feet
    thorns(46, 76, 7);
    row(47, 49, 11, 'A');
    put(52, 10, 'd'); put(55, 10, 'd'); put(57, 9, 'o');
    row(58, 60, 11, 'B');
    put(63, 10, 'd');
    row(66, 69, 11, '#'); row(66, 69, 10, 'b');
    put(72, 10, 'd'); put(75, 10, 'd');
    row(78, 79, 11, 'x');
    put(83, 7, 'd');
    ground(85, 94, 12);
    put(89, 11, 'C');
    // twist: spring into the thorned sky, through walls of either world (a miss drops you back to the spring)
    ground(95, 104, 13); put(99, 12, 'S');
    put(104, 3, 'd'); put(106, 3, 'd');
    row(113, 116, 7, 'B');
    put(121, 3, 'd'); put(124, 3, 'd'); put(119, 3, 'o');
    row(128, 129, 7, 'x');
    put(134, 3, 'd');
    ground(137, 143, 7);
    put(140, 6, 'C');
    row(95, 150, 0, '#'); row(95, 150, 1, 'v');
    fill(105, 0, 105, 9, 'A'); fill(123, 0, 123, 6, 'B');
    // the long fall: crumbling steps down into one last thorn tunnel
    put(148, 3, 'd'); put(151, 3, 'd');
    row(155, 156, 9, 'x');
    put(160, 5, 'd');
    row(164, 165, 11, 'x');
    thorns(168, 181, 7);
    put(169, 10, 'd'); put(172, 10, 'd');
    row(175, 176, 11, 'x');
    put(179, 10, 'd');
    ground(183, 191, 12);
    put(185, 11, 'C');
    // payoff: three sparks, a crumble, two more sparks, home
    put(195, 8, 'd'); put(198, 8, 'd'); put(201, 8, 'd');
    row(205, 206, 11, 'x');
    put(211, 7, 'd'); put(214, 7, 'd'); put(217, 7, 'o');
    ground(218, 228, 12);
    put(225, 11, 'E');
  }),
];
