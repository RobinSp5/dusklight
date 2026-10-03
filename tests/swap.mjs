// Regression: swapping must be refused when the player overlaps a block of the target world by any amount.
import { World, STEP, PHYS } from '../src/world.js';
const rows = Array.from({ length: 10 }, (_, y) => (y === 9 ? '#'.repeat(12) : y >= 3 ? '.....AAA....' : '............'));
const w = new World({ w: 12, h: 10, rows, signs: [], startPhase: 1 }, 0);
const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false, dashPressed: false };
let fails = 0;
for (const dx of [0.5, 0.05]) {
  w.phase = 1;
  Object.assign(w.player, { x: 5 * 32 - PHYS.W + dx, y: 100, vx: 0, vy: 200, alive: true });
  w.update(STEP, { ...idle, swapPressed: true });
  const ok = w.phase === 1;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} overlap ${dx}px -> swap refused=${ok}`);
}
w.phase = 1;
Object.assign(w.player, { x: 5 * 32 - PHYS.W - 0.001, y: 100, vx: 0, vy: 0 });
w.update(STEP, { ...idle, swapPressed: true });
console.log(`${w.phase === 0 ? 'PASS' : 'FAIL'} flush against wall -> swap allowed`);
if (w.phase !== 0) fails++;
process.exit(fails ? 1 : 0);
