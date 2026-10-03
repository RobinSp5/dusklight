// Level data. Tiles:
//  #  solid stone            A  solid only in phase Ember (0)   B  solid only in phase Frost (1)
//  ^  spikes                 =  one-way platform               S  spring
//  o  shard                  C  checkpoint                     E  exit portal     P  player start
export const TILE = 32;

export function build(meta, draw) {
  const { w, h } = meta;
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const signs = [];
  const api = {
    put(x, y, c) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; },
    fill(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) api.put(x, y, c); },
    ground(x0, x1, top, c = '#') { api.fill(x0, top, x1, h - 1, c); },
    row(x0, x1, y, c) { api.fill(x0, y, x1, y, c); },
    sign(x, y, text) { signs.push({ x: x * TILE, y: y * TILE, text }); },
  };
  draw(api);
  return { ...meta, startPhase: meta.startPhase ?? 0, rows: g.map((r) => r.join('')), signs };
}

export const LEVELS = [
  build({ name: 'Awakening', w: 96, h: 17, seed: 11 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 18, 14);
    put(3, 13, 'P');
    sign(2, 9, '← →  move');
    put(8, 12, 'o'); put(10, 11, 'o'); put(12, 12, 'o');
    sign(14, 8, 'Space  jump');
    ground(23, 34, 14);
    put(21, 10, 'o');
    put(29, 13, '^'); put(30, 13, '^');
    ground(35, 40, 12);
    put(38, 9, 'o');
    ground(41, 46, 14);
    sign(41, 8, 'Shift  switch world');
    row(47, 52, 14, 'B');
    put(50, 11, 'o');
    ground(53, 70, 14);
    put(54, 13, 'C');
    fill(57, 7, 58, 13, 'A');
    put(62, 12, 'o');
    row(66, 68, 12, 'A');
    put(67, 9, 'o');
    ground(71, 95, 10);
    put(80, 8, 'o');
    put(92, 9, 'E');
  }),

  build({ name: 'Tides', w: 110, h: 17, seed: 23 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 10, 14);
    put(2, 13, 'P');
    sign(1, 8, 'jump, then switch mid-air');
    row(12, 14, 12, 'A'); put(13, 10, 'o');
    row(18, 20, 11, 'B'); put(19, 9, 'o');
    row(24, 26, 10, 'A'); put(25, 8, 'o');
    row(30, 32, 11, 'B'); put(31, 9, 'o');
    row(36, 38, 12, 'A');
    ground(41, 50, 14);
    put(43, 13, 'C');
    sign(44, 8, 'X  dash');
    put(54, 11, 'o');
    ground(57, 80, 14);
    row(66, 68, 12, 'A');
    row(71, 73, 10, 'B'); put(72, 8, 'o');
    ground(76, 109, 8);
    put(78, 7, 'C');
    row(86, 89, 7, '^');
    put(87, 4, 'o');
    fill(95, 2, 95, 7, 'B');
    put(93, 5, 'o');
    row(99, 101, 7, '^');
    put(106, 7, 'E');
  }),

  build({ name: 'Hall of Mirrors', w: 120, h: 17, seed: 37 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 8, 14);
    put(2, 13, 'P');
    put(7, 13, 'S');
    sign(2, 9, 'springs carry you far');
    ground(9, 35, 15); row(9, 35, 14, '^');
    row(11, 22, 6, '#');
    put(14, 4, 'o'); put(19, 4, 'o');
    row(25, 27, 7, 'B'); put(26, 5, 'o');
    row(31, 33, 8, 'A');
    ground(36, 50, 14);
    put(38, 13, 'C');
    // phase corridor
    row(51, 75, 9, '#');
    ground(51, 56, 14);
    fill(55, 10, 55, 13, 'A');
    row(57, 61, 14, 'A'); put(59, 12, 'o');
    ground(62, 68, 14);
    fill(63, 10, 63, 13, 'B');
    fill(67, 10, 67, 13, 'A');
    row(69, 73, 14, 'B'); put(71, 12, 'o');
    ground(74, 90, 14);
    put(76, 13, 'C');
    put(81, 13, '^'); put(82, 13, '^');
    row(80, 83, 11, '='); put(81, 9, 'o');
    row(85, 88, 8, '=');
    ground(91, 96, 6);
    put(93, 3, 'o');
    row(99, 101, 7, 'B');
    row(104, 106, 6, 'A'); put(105, 4, 'o');
    ground(110, 119, 7);
    put(116, 6, 'E');
  }),

  build({ name: 'Threshold', w: 132, h: 17, seed: 51 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 8, 14);
    put(2, 13, 'P');
    sign(1, 8, 'no floor, only rhythm');
    ground(9, 40, 16); row(9, 40, 15, '^');
    row(11, 12, 12, 'A');
    row(16, 17, 11, 'B'); put(16, 9, 'o');
    row(21, 22, 10, 'A'); put(21, 8, 'o');
    row(26, 27, 11, 'B');
    row(31, 32, 12, 'A'); put(31, 10, 'o');
    row(36, 37, 12, 'B');
    ground(41, 52, 14);
    put(43, 13, 'C');
    put(51, 13, 'S');
    ground(53, 83, 14); row(53, 83, 13, '^');
    row(54, 62, 6, '#'); put(58, 4, 'o');
    row(66, 68, 7, 'A');
    row(72, 74, 6, 'B'); put(73, 4, 'o');
    row(78, 80, 5, 'A');
    ground(84, 100, 8);
    put(86, 7, 'C');
    fill(92, 2, 92, 7, 'A');
    fill(96, 2, 96, 7, 'B');
    put(94, 6, 'o');
    ground(101, 131, 12);
    row(106, 108, 11, '^');
    row(113, 115, 9, 'A'); put(114, 7, 'o');
    row(118, 120, 11, '^');
    put(127, 11, 'E');
  }),

  // ---- Act 2: new hazards, every level demands more precision ----
  build({ name: 'Thorn Hall', w: 120, h: 17, seed: 67 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 10, 14);
    put(2, 13, 'P');
    sign(1, 8, 'spikes above: short hops or dash');
    // low tunnel under hanging spikes
    row(12, 34, 9, '#'); row(12, 34, 10, 'v');
    ground(11, 34, 14);
    put(13, 13, '^'); put(17, 13, '^'); fill(22, 14, 23, 16, '.'); put(25, 13, '^'); put(28, 13, '^'); put(29, 13, '^'); put(32, 13, '^');
    put(20, 12, 'o'); put(26, 12, 'o');
    ground(35, 44, 14);
    put(37, 13, 'C');
    put(40, 13, '^'); put(41, 13, '^');
    // phase steps under a spike ceiling: full jumps are deadly
    row(45, 70, 5, '#'); row(45, 70, 6, 'v');
    row(47, 49, 12, 'A');
    row(53, 55, 11, 'B'); put(54, 9, 'o');
    row(59, 61, 12, 'A');
    row(65, 67, 11, 'B');
    ground(70, 84, 14);
    row(72, 76, 13, '^'); put(78, 13, '^'); row(82, 84, 13, '^');
    // spring shaft through a gap in a spiked ceiling
    row(76, 78, 6, '#'); row(76, 78, 7, 'v');
    row(82, 100, 6, '#'); row(82, 84, 7, 'v');
    put(80, 13, 'S');
    put(80, 3, 'o');
    put(86, 5, 'C');
    put(90, 5, '^'); put(91, 5, '^'); put(95, 5, '^'); put(96, 5, '^');
    put(93, 3, 'o');
    ground(104, 109, 12);
    put(106, 11, '^'); put(107, 11, '^');
    row(111, 113, 12, 'B'); put(112, 10, 'o');
    ground(116, 119, 12);
    put(117, 11, 'E');
  }),

  build({ name: 'Flux', w: 124, h: 17, seed: 79 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 8, 14);
    put(2, 13, 'P');
    sign(1, 8, 'colored spikes only hurt in their own world');
    ground(9, 30, 14);
    row(9, 30, 8, '#'); row(9, 30, 9, 'v'); // a full jump here touches the ceiling spikes
    fill(15, 14, 16, 16, '.'); fill(28, 14, 29, 16, '.');
    row(12, 14, 13, 'a');
    row(18, 20, 13, 'b'); put(16, 11, 'o');
    put(22, 13, '^');
    row(24, 25, 13, 'a'); row(26, 27, 13, 'b'); put(26, 10, 'o');
    ground(31, 36, 14);
    put(33, 13, 'C');
    // pillars crowned with phase spikes between phase platforms
    row(40, 40, 12, '#'); put(40, 11, 'a');
    row(45, 47, 11, 'A'); put(46, 9, 'o');
    row(51, 51, 10, '#'); put(51, 9, 'a');
    row(56, 58, 11, 'B');
    row(61, 62, 12, 'A'); put(61, 10, 'o');
    ground(65, 95, 14);
    put(66, 13, 'C');
    // corridor: swap on every step
    row(70, 95, 9, '#'); row(70, 83, 10, 'v');
    put(72, 13, 'a'); put(74, 13, 'b'); put(76, 13, 'a'); put(78, 13, 'b'); put(80, 13, 'a'); put(81, 13, 'b');
    row(82, 83, 14, 'B'); fill(82, 15, 83, 16, '.');
    fill(84, 10, 84, 13, 'A'); row(85, 86, 13, 'b');
    put(87, 12, 'o');
    fill(89, 10, 89, 13, 'B'); row(90, 91, 13, 'a');
    row(92, 93, 14, 'A'); fill(92, 15, 93, 16, '.');
    row(98, 100, 12, 'B');
    ground(102, 110, 10);
    row(102, 123, 5, '#'); row(102, 123, 6, 'v'); // low spiked sky over the finale
    row(106, 108, 9, 'a');
    row(111, 113, 10, 'A'); put(112, 8, 'o');
    ground(114, 123, 10);
    row(116, 118, 9, 'b');
    put(121, 9, 'E');
  }),

  build({ name: 'Star Leap', w: 130, h: 17, seed: 83 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 6, 14);
    put(2, 13, 'P');
    sign(1, 8, 'spring, switch, dash. No floor.');
    ground(7, 129, 16); row(7, 129, 15, '^');
    row(8, 10, 13, 'A'); put(9, 12, 'S');
    row(14, 16, 5, 'B'); put(15, 3, 'o');
    row(21, 22, 7, 'A');
    row(26, 28, 9, '#'); put(27, 8, 'S');
    row(34, 36, 6, 'B');
    put(39, 5, 'o');
    row(43, 44, 6, 'A');
    ground(48, 56, 8);
    put(50, 7, 'C');
    row(60, 60, 9, '#');
    row(64, 64, 8, '#'); put(64, 7, 'a');
    put(66, 5, 'o');
    row(68, 68, 9, '#');
    fill(72, 3, 72, 9, 'B'); row(71, 76, 10, 'A');
    row(80, 82, 9, 'B');
    row(86, 88, 10, '#'); put(87, 9, 'S');
    fill(92, 3, 92, 16, '#');
    ground(95, 129, 12);
    put(97, 11, 'C');
    put(100, 9, 'o');
    fill(105, 7, 105, 11, 'A');
    row(108, 110, 11, 'b');
    row(112, 122, 7, '#'); row(112, 122, 8, 'v');
    put(116, 10, 'o');
    row(118, 119, 11, '^');
    put(126, 11, 'E');
  }),

  build({ name: 'Zenith', w: 150, h: 17, seed: 97, startPhase: 1 }, ({ ground, row, put, fill, sign }) => {
    ground(0, 6, 14);
    put(2, 13, 'P');
    sign(1, 8, 'the last ascent');
    ground(7, 149, 16); row(7, 149, 15, '^');
    // tiny phase platforms under a spiked ceiling
    row(8, 40, 7, '#'); row(8, 40, 8, 'v');
    row(9, 10, 13, 'B');
    row(14, 15, 12, 'A');
    row(19, 20, 13, 'B'); put(22, 10, 'o');
    row(24, 25, 12, 'A');
    row(29, 30, 12, 'B');
    row(34, 35, 13, 'A');
    ground(39, 46, 13);
    put(41, 12, 'C');
    // dash + swap between one-tile pillars
    row(51, 51, 12, '#'); put(51, 11, 'b');
    row(57, 58, 12, 'A');
    row(64, 64, 11, '#'); put(64, 10, 'a');
    put(67, 8, 'o');
    row(70, 71, 11, 'B');
    ground(76, 86, 12);
    // spring over a phase wall
    put(85, 11, 'S');
    row(89, 91, 3, 'B'); put(90, 1, 'o');
    fill(95, 0, 95, 10, 'A');
    row(98, 101, 8, 'A'); put(100, 7, 'b');
    ground(105, 115, 10); row(105, 115, 5, '#'); row(105, 115, 6, 'v');
    put(106, 9, 'C');
    put(108, 9, 'a'); put(111, 9, 'b');
    // final run: single tiles, alternating worlds, spiked sky
    row(117, 137, 4, '#'); row(117, 137, 5, 'v');
    row(119, 119, 10, 'A');
    row(124, 124, 9, 'B'); put(126, 6, 'o');
    row(129, 129, 10, 'A');
    row(134, 134, 9, 'B');
    ground(139, 149, 10);
    put(146, 9, 'E');
  }),
];
