// Verifies every onboarding demo: the scripted player never dies and reaches its goal.
import { DEMOS, demoInput } from '../src/demos.js';
import { World, STEP } from '../src/world.js';

let failed = 0;
for (const d of DEMOS) {
  const w = new World(d.level, 0);
  let t = 0, died = false, doneAt = null;
  while (t < d.duration) {
    const prev = t;
    t += STEP;
    w.update(STEP, demoInput(d, prev, t));
    if (w.events.some((e) => e.type === 'die')) { died = true; break; }
    w.events.length = 0;
    if (doneAt === null && d.done(w)) doneAt = t;
  }
  const ok = !died && doneAt !== null;
  if (!ok) failed++;
  const p = w.player;
  console.log(`${ok ? 'PASS' : 'FAIL'} demo ${d.id.padEnd(5)} ${died ? 'DIED' : ''} done=${doneAt ? doneAt.toFixed(2) + 's' : 'no'} end x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} phase=${w.phase} shards=${w.collected} won=${w.won}`);
}
process.exit(failed ? 1 : 0);
