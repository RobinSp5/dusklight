// Key rebinding rules: no key ever belongs to two actions, conflicts swap keys,
// Escape always pauses, broken saves are sanitised.
import { DEFAULT_BINDINGS, normalizeBindings, rebind, keyLabel, ACTIONS } from '../src/input.js';

let failed = 0;
const check = (name, ok) => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };
const unique = (b) => { const all = ACTIONS.flatMap((a) => b[a]); return new Set(all).size === all.length; };
const owner = (b, code) => ACTIONS.filter((a) => b[a].includes(code));

const b1 = rebind(DEFAULT_BINDINGS, 'jump', 'KeyL');
check('new primary key, secondaries kept', b1.jump[0] === 'KeyL' && b1.jump.includes('KeyW') && unique(b1));
const b2 = rebind(DEFAULT_BINDINGS, 'jump', 'KeyD');
check('stolen key leaves its old action', b2.jump[0] === 'KeyD' && owner(b2, 'KeyD').join() === 'jump' && b2.right.includes('ArrowRight'));
const b3 = rebind(DEFAULT_BINDINGS, 'jump', 'KeyR');
check('jump -> R swaps with restart (review bug 1)', owner(b3, 'KeyR').join() === 'jump' && b3.restart.join() === 'Space' && unique(b3));
const b4 = rebind(rebind(DEFAULT_BINDINGS, 'left', 'KeyX'), 'right', 'KeyK');
check('left -> X, right -> K keeps every key unique', owner(b4, 'KeyX').join() === 'left' && owner(b4, 'KeyK').join() === 'right' && b4.dash.length > 0 && unique(b4));
const b5 = rebind(DEFAULT_BINDINGS, 'jump', 'KeyM');
check('jump -> M: M jumps, mute moves', owner(b5, 'KeyM').join() === 'jump' && b5.mute.length > 0 && unique(b5));
const b6 = rebind(DEFAULT_BINDINGS, 'pause', 'KeyQ');
check('escape survives pause rebind', b6.pause.includes('Escape') && b6.pause[0] === 'KeyQ');
check('escape cannot be taken', JSON.stringify(rebind(DEFAULT_BINDINGS, 'jump', 'Escape')) === JSON.stringify(normalizeBindings(DEFAULT_BINDINGS)));
// random rebinding storm: invariants must always hold
let b = normalizeBindings(DEFAULT_BINDINGS);
const codes = ['KeyA', 'KeyD', 'KeyR', 'KeyM', 'KeyX', 'KeyK', 'Space', 'KeyQ', 'ArrowUp', 'ShiftLeft', 'KeyP', 'Escape'];
let ok = true;
for (let i = 0; i < 500; i++) {
  b = rebind(b, ACTIONS[(i * 7) % ACTIONS.length], codes[(i * 5 + (i >> 3)) % codes.length]);
  if (!unique(b) || !b.pause.includes('Escape') || ACTIONS.some((a) => !b[a].length)) { ok = false; break; }
}
check('500 rebinds: unique keys, every action bound, Esc pauses', ok);
const broken = normalizeBindings({ left: 'nope', jump: [42, 'KeyZ'], restart: [], dash: ['KeyZ', 'KeyA'] });
check('broken save sanitised and de-duplicated', unique(broken) && broken.jump.join() === 'KeyZ' && broken.restart.join() === 'KeyR' && ACTIONS.every((a) => broken[a].length));
check('labels', keyLabel('KeyA') === 'A' && keyLabel('ArrowLeft') === '←' && keyLabel('ShiftLeft') === 'Shift' && keyLabel('Digit3') === '3' && keyLabel(undefined) === 'None');
process.exit(failed ? 1 : 0);
