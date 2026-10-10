// Level packs: the Hardcore Pack is standalone (own keys, stars, ghosts, rewards) and the campaign stays exactly as it was.
import { LEVELS, ACTS } from '../src/levels.js';
import { HARDCORE } from '../src/levels-hardcore.js';
import { World, STEP, registerTwist, TWISTS } from '../src/world.js';
import { PAR, PAR_HC, levelHash, starsFor } from '../src/progress.js';
import { SLOTS, lookFor } from '../src/shop.js';
import {
  PACKS, PACK_LIST, newHc, sanitizeHc, loadPack, recordClear, toggleEquip, rewardStyles, rewardsOf, rewardForLevel, packStars,
} from '../src/packs.js';

let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- the campaign is untouched ----------
check('campaign keys are unchanged', same(PACKS.main.keys, { save: 'zwielicht.save.v1', ghosts: 'dusklight.ghosts.v1', deaths: 'dusklight.deaths.v1' }));
check('hardcore keys are the agreed ones', same(PACKS.hc.keys, { save: 'dusklight.hc.save.v1', ghosts: 'dusklight.hc.ghosts.v1', deaths: 'dusklight.hc.deaths.v1' }));
const allKeys = PACK_LIST.flatMap((p) => Object.values(p.keys));
check('no storage key is shared between packs', new Set(allKeys).size === allKeys.length);
check('campaign pack is LEVELS itself, 25 levels, original acts and par', PACKS.main.levels === LEVELS && LEVELS.length === 25 && PACKS.main.acts === ACTS && PACKS.main.par === PAR);
check('campaign par times are unchanged', PAR.join() === '20,24,29,26,25,23,31,31,31,30,36,33,38,32,38,36,38,57,43,53,56,43,39,51,47');
check('hardcore levels are not in LEVELS', HARDCORE.length > 0 && HARDCORE.every((l) => !LEVELS.includes(l)) && PACKS.hc.levels === HARDCORE);
// level geometry (and with it every stored ghost) is unchanged: these hashes come from before the pack work
const HASHES = 'hfi3n4,1i8wnhc,1ucup3e,oxlmhi,qqlq63,1k5hmdf,kmpih6,ty1udj,1rmkq6,16wek7g,1pr7wov,gvxjwk,l3vhz,hmtl1i,154m1sq,10eb7ou,1vk8pt2,porarn,ovr5dd,13joeb,54wt1u,51ex6l,jubssm,1ubytfk,1xibvu3';
check('campaign level hashes are unchanged (ghosts stay valid)', LEVELS.map(levelHash).join() === HASHES);
// physics of every campaign level is unchanged: a scripted run through all 25 levels ends in the same states as before the twist hook
{
  let h = 2166136261;
  const mix = (str) => { for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } };
  for (const [li, L] of LEVELS.entries()) {
    const w = new World(L, li);
    for (let t = 0; t < 1500; t++) {
      const k = t % 240;
      w.update(STEP, { left: k > 200, right: k <= 200, jumpHeld: k % 60 < 30, jumpPressed: k % 60 === 0, dashPressed: k % 120 === 50, swapPressed: k % 90 === 70 });
      if (t % 50 === 0) mix(`${w.player.x.toFixed(2)},${w.player.y.toFixed(2)},${w.phase},${w.deaths},${w.collected},${w.stateKey()}`);
    }
  }
  check('campaign simulation digest is unchanged', (h >>> 0).toString(36) === '1qxligl', (h >>> 0).toString(36));
}

// ---------- hardcore data ----------
check('par for every hardcore level', PAR_HC.length === HARDCORE.length);
const rewards = rewardsOf(PACKS.hc);
check('every hardcore level has its own reward', rewards.length === HARDCORE.length && HARDCORE.every((l, i) => rewardForLevel(PACKS.hc, i).id === l.reward.id));
check('reward ids are unique and namespaced', new Set(rewards.map((r) => r.id)).size === rewards.length && rewards.every((r) => /^hc\.[a-z0-9._-]+$/.test(r.id)));
check('rewards are cosmetic: known slot, style, name', rewards.every((r) => SLOTS.includes(r.slot) && r.style && typeof r.style.kind === 'string' && r.name && r.desc));
check('a reward can only change the look', lookFor({}, rewardStyles({ equip: { hat: rewards[0].id } })).hat === rewards[0].style.kind && same(lookFor({}), lookFor({}, {})) );
check('hardcore levels have a start, an exit and checkpoints at least every ~25 tiles', HARDCORE.every((l) => {
  const xs = [0, l.w];
  l.rows.forEach((r) => [...r].forEach((c, x) => c === 'C' && xs.push(x)));
  xs.sort((a, b) => a - b);
  return l.rows.join('').includes('P') && l.rows.join('').includes('E') && xs.every((x, k) => !k || x - xs[k - 1] <= 25);
}));
check('every hardcore level has a sign (twist explanation / practice area)', HARDCORE.every((l) => l.signs.length > 0));

// ---------- storage: only the pack's own keys are touched ----------
{
  const asked = [];
  const read = (k) => { asked.push(k); return null; };
  const fresh = loadPack(read, PACKS.hc);
  check('hardcore load reads only hardcore keys', same(asked.sort(), Object.values(PACKS.hc.keys).sort()));
  check('fresh hardcore save: first level open, nothing else', same(fresh.prog, newHc()) && fresh.prog.unlocked === 0 && same(fresh.ghosts, {}) && same(fresh.deaths, {}));
}
{
  const bad = sanitizeHc({ unlocked: 'x', best: { 0: { time: 'a', shards: 1 }, 99: { time: 5, shards: 1 }, abc: { time: 5, shards: 1 } }, rewards: [5, 'nope', rewards[0].id, rewards[0].id], equip: { hat: 'nope', zzz: rewards[0].id } });
  check('corrupt hardcore save is cleaned', same(bad, { unlocked: 0, best: {}, rewards: [rewards[0].id], equip: {} }));
  check('non-object hardcore save', same(sanitizeHc('oops'), newHc()) && same(sanitizeHc([1]), newHc()) && same(sanitizeHc(null), newHc()));
  const n = HARDCORE.length;
  const open = sanitizeHc({ unlocked: 0, best: { [n - 1]: { time: 9, shards: 0, deathless: 1 } }, rewards: [], equip: {} });
  check('unlocked never exceeds the pack and follows cleared levels', open.unlocked === n - 1 && open.best[n - 1].deathless === true && sanitizeHc({ unlocked: 99 }).unlocked === n - 1);
  const worn = sanitizeHc({ rewards: [rewards[0].id], equip: { [rewards[0].slot]: rewards[0].id } });
  check('worn reward survives a reload', worn.equip[rewards[0].slot] === rewards[0].id);
}

// ---------- playing the pack: separate progress, nothing leaks into the campaign ----------
{
  const hc0 = newHc();
  const frozen = JSON.stringify(hc0);
  const a = recordClear(hc0, PACKS.hc, 0, { time: 20, shards: 2, deaths: 0 });
  check('recordClear does not mutate its input', JSON.stringify(hc0) === frozen);
  check('first clear: best time, deathless, reward earned', a.earned && a.reward.id === rewards[0].id && a.prog.best[0].time === 20 && a.prog.best[0].deathless && a.prog.rewards.includes(rewards[0].id));
  const b = recordClear(a.prog, PACKS.hc, 0, { time: 25, shards: 1, deaths: 3 });
  check('slower, deadlier replay keeps the best values and earns no second reward', b.prog.best[0].time === 20 && b.prog.best[0].shards === 2 && b.prog.best[0].deathless && !b.earned && b.prog.rewards.length === 1);
  const c = recordClear(b.prog, PACKS.hc, 0, { time: 18, shards: 3, deaths: 1 });
  check('faster replay is a new best', c.isBest && c.prog.best[0].time === 18 && c.prog.best[0].shards === 3);
  check('clearing a level opens the next one only inside the pack', HARDCORE.length < 2 || a.prog.unlocked === 1);
  const stars = starsFor(c.prog.best[0], 0, 3, PAR_HC);
  check('hardcore stars use PAR_HC', stars.fast === (18 <= PAR_HC[0]) && packStars(PACKS.hc, c.prog) >= stars.count);
  check('hardcore clear changes only the hardcore save (no shop currency field exists)', same(Object.keys(a.prog).sort(), ['best', 'equip', 'rewards', 'unlocked']));
}

// ---------- wearing rewards ----------
{
  const r = rewards[0];
  const earned = recordClear(newHc(), PACKS.hc, 0, { time: 1, shards: 0, deaths: 0 }).prog;
  check('an unearned reward cannot be worn', same(toggleEquip(newHc(), PACKS.hc, r.id), newHc()));
  const on = toggleEquip(earned, PACKS.hc, r.id);
  check('earned reward is worn', on.equip[r.slot] === r.id && same(rewardStyles(on), { [r.slot]: r.style }));
  check('toggling again takes it off', same(toggleEquip(on, PACKS.hc, r.id).equip, {}) && same(rewardStyles(toggleEquip(on, PACKS.hc, r.id)), {}));
  check('unknown reward id is ignored', same(toggleEquip(earned, PACKS.hc, 'hc.nope'), earned));
}

// ---------- twist hook (world.js) ----------
{
  check('levels without a twist carry none', new World(LEVELS[0], 0).twist === null && HARDCORE.every((l) => !l.twist));
  const lvl = { ...LEVELS[0], twist: { id: 'test-twist', step: 3 } };
  check('a twist changes the ghost hash, the plain level does not', levelHash(lvl) !== levelHash(LEVELS[0]) && levelHash(LEVELS[0]) === HASHES.split(',')[0]);
  check('unregistered twist is inert', new World(lvl, 0).twistImpl === null && new World(lvl, 0).stateKey() === new World(LEVELS[0], 0).stateKey());
  registerTwist('test-twist', {
    init(w) { w.tw = { n: 0 }; },
    tick(w) { w.tw.n++; },
    key(w) { return String(w.tw.n); },
    clone(src, c) { c.tw = { ...src.tw }; },
  });
  const w = new World(lvl, 0);
  const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false, dashPressed: false, swapPressed: false };
  for (let i = 0; i < 10; i++) w.update(STEP, idle);
  const k1 = w.stateKey();
  const copy = w.clone();
  for (let i = 0; i < 5; i++) copy.update(STEP, idle);
  check('twist state ticks, is cloned deeply and is part of stateKey()', w.tw.n === 10 && copy.tw.n === 15 && w.stateKey() === k1 && copy.stateKey() !== k1 && k1.endsWith('|t10'));
  delete TWISTS['test-twist'];
}

process.exit(failed ? 1 : 0);
