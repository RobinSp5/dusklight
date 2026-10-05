// Shop economy: catalog integrity, earnings, buy/equip/goal, sanitizer, migration, look, economy sanity.
import { LEVELS } from '../src/levels.js';
import {
  SLOTS, SLOT_NAMES, TIERS, CATALOG, DEFAULT_EQUIP, itemById, newShop, sanitizeShop, migrateFromSkins,
  earnings, deposit, buy, equip, setGoal, goalItem, lookFor,
} from '../src/shop.js';

let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tierFor = (p) => (p <= 100 ? 'common' : p <= 400 ? 'rare' : p <= 1200 ? 'epic' : 'legendary');

// catalog integrity
check('ids unique', new Set(CATALOG.map((x) => x.id)).size === CATALOG.length, `${CATALOG.length} items`);
check('slots + slot names', CATALOG.every((x) => SLOTS.includes(x.slot) && x.id.startsWith(`${x.slot}.`)) && SLOTS.every((s) => SLOT_NAMES[s]));
check('tiers valid', CATALOG.every((x) => x.tier in TIERS));
const badTier = CATALOG.filter((x) => x.tier !== tierFor(x.price)).map((x) => x.id);
check('tier matches price band', !badTier.length, badTier.join(' '));
check('prices are integers >= 0', CATALOG.every((x) => Number.isInteger(x.price) && x.price >= 0));
check('names + one-sentence desc', CATALOG.every((x) => x.name && /^[^.]+[.]$/.test(x.desc) && !/—/.test(x.desc + x.name)));
check('exactly one free item per slot = default', SLOTS.every((s) => {
  const free = CATALOG.filter((x) => x.slot === s && x.price === 0);
  return free.length === 1 && free[0].id === DEFAULT_EQUIP[s];
}));
check('every slot has a legendary or epic goal', SLOTS.every((s) => CATALOG.some((x) => x.slot === s && x.price > 400)));
check('itemById', itemById('body.prism').price === 1300 && itemById('nope') === undefined);
check('every item has a style kind', CATALOG.every((x) => x.style && typeof x.style.kind === 'string'));

// earnings table
const e1 = earnings({ levelIndex: 0, shards: 9, firstClear: true, newStars: 3, newBest: true, deathless: true, allShards: true });
check('earnings: every line, in order', same(e1.lines.map((l) => l.id), ['shards', 'clear', 'first', 'stars', 'deathless', 'allShards']), `total ${e1.total}`);
check('earnings: amounts', same(e1.lines.map((l) => l.amount), [18, 6, 20, 45, 5, 10]) && e1.total === 104);
check('earnings: labels', e1.lines[0].label === 'Shards collected' && e1.lines[1].label === 'Level cleared' && e1.lines[2].label === 'First clear');
const e2 = earnings({ levelIndex: 24, shards: 0, firstClear: false, newStars: 0, newBest: true, deathless: false, allShards: false });
check('earnings: level 25 clear + best only', same(e2.lines, [{ id: 'clear', label: 'Level cleared', amount: 30 }, { id: 'best', label: 'New best time', amount: 8 }]) && e2.total === 38);
check('earnings: corrupt run does not crash or go negative', earnings({ levelIndex: -3, shards: NaN, newStars: -2 }).total === 6 && earnings(null).total === 6);

// new shop, deposit, buy, equip, goal
const s0 = newShop();
check('new shop', s0.wallet === 0 && s0.lifetime === 0 && s0.goal === null && same(s0.equip, DEFAULT_EQUIP)
  && same(s0.owned, CATALOG.filter((x) => x.price === 0).map((x) => x.id)));
const s1 = deposit(s0, 500);
check('deposit', s1.wallet === 500 && s1.lifetime === 500 && s0.wallet === 0);
check('deposit ignores negative', deposit(s1, -50).wallet === 500);
check('buy: unknown', same(buy(s1, 'body.nope'), { ok: false, reason: 'unknown' }));
check('buy: owned', same(buy(s1, 'body.paper'), { ok: false, reason: 'owned' }));
check('buy: funds', same(buy(s1, 'body.prism'), { ok: false, reason: 'funds' }));
const g1 = setGoal(s1, 'body.gold');
const snap = JSON.stringify(g1);
const b1 = buy(g1, 'body.gold');
check('buy: ok, wallet down, auto-equip, goal cleared', b1.ok && b1.shop.wallet === 360 && b1.shop.lifetime === 500
  && b1.shop.owned.includes('body.gold') && b1.shop.equip.body === 'body.gold' && b1.shop.goal === null);
check('buy: input not mutated', JSON.stringify(g1) === snap);
check('buy: other goal kept', buy(setGoal(s1, 'hat.halo'), 'body.gold').shop.goal === 'hat.halo');
check('buy: exact funds', buy(deposit(s0, 140), 'body.gold').ok && buy(deposit(s0, 139), 'body.gold').reason === 'funds');
const q1 = equip(b1.shop, 'body.paper');
check('equip owned', q1.equip.body === 'body.paper' && b1.shop.equip.body === 'body.gold');
check('equip unowned is a no-op', equip(b1.shop, 'body.void').equip.body === 'body.gold' && equip(b1.shop, 'zzz').equip.body === 'body.gold');
check('setGoal unowned', setGoal(s1, 'body.supernova').goal === 'body.supernova' && s1.goal === null);
check('setGoal owned/unknown ignored', setGoal(b1.shop, 'body.gold').goal === null && setGoal(s1, 'nope').goal === null);
check('setGoal null clears', setGoal(setGoal(s1, 'hat.orbit'), null).goal === null);
check('goalItem: pinned', goalItem(setGoal(s1, 'body.supernova')).id === 'body.supernova');
check('goalItem: cheapest unaffordable', goalItem(s0).id === 'body.ash' && goalItem(deposit(s0, 130)).id === 'body.gold');
let rich = deposit(s0, 1e6);
for (const x of CATALOG) if (x.price) rich = buy(rich, x.id).shop;
check('goalItem: everything owned -> null', goalItem(rich) === null && rich.owned.length === CATALOG.length);
const freeze = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && freeze(v)); return Object.freeze(o); };
const frozen = freeze(setGoal(deposit(s0, 1000), 'hat.halo'));
let pure = true;
try { deposit(frozen, 5); buy(frozen, 'hat.halo'); equip(frozen, 'body.paper'); setGoal(frozen, null); goalItem(frozen); sanitizeShop(frozen); } catch { pure = false; }
check('no function mutates a (deep-frozen) shop', pure);
check('goalItem: all affordable -> null', goalItem(deposit(s0, 1e6)) === null);

// sanitize corrupt storage
for (const raw of [undefined, null, 'oops', 42, [1, 2]]) check(`sanitize: ${JSON.stringify(raw)}`, same(sanitizeShop(raw), newShop()));
const dirty = sanitizeShop({
  wallet: -5, lifetime: 'lots', owned: ['body.gold', 'body.gold', 'nope', 7, 'hat.crown'],
  equip: { body: 'body.gold', scarf: 'hat.crown', hat: 'hat.wings', trail: 3, theme: 'theme.neon' }, goal: 'body.gold',
});
check('sanitize: numbers', dirty.wallet === 0 && dirty.lifetime === 0);
check('sanitize: owned known, deduped, free included', same(dirty.owned, ['body.paper', 'body.gold', 'scarf.world', 'hat.none', 'hat.crown', 'trail.none', 'death.classic', 'theme.dusk']));
check('sanitize: equip only owned + right slot', same(dirty.equip, { ...DEFAULT_EQUIP, body: 'body.gold' }));
check('sanitize: owned goal dropped', dirty.goal === null);
check('sanitize: floats floored, lifetime >= wallet', same([sanitizeShop({ wallet: 12.7, lifetime: 3 }).wallet, sanitizeShop({ wallet: 12.7, lifetime: 3 }).lifetime], [12, 12]));
check('sanitize: Infinity rejected', sanitizeShop({ wallet: Infinity }).wallet === 0);
check('sanitize: valid goal kept', sanitizeShop({ goal: 'body.prism' }).goal === 'body.prism' && sanitizeShop({ goal: 'x' }).goal === null);
const good = buy(deposit(s0, 900), 'trail.stardust').shop;
check('sanitize: valid shop unchanged', same(sanitizeShop(JSON.parse(JSON.stringify(good))), good));

// migration from the old threshold skins
const m0 = migrateFromSkins(undefined, 0);
check('migrate: nothing found', same(m0, newShop()));
const m1 = migrateFromSkins({ body: 'gold', scarf: 'lime', hat: 'crown' }, 30);
check('migrate: thresholds <= found', same(m1.owned.filter((id) => itemById(id).price > 0),
  ['body.ash', 'body.rose', 'body.moss', 'body.gold', 'scarf.crimson', 'scarf.violet', 'scarf.lime', 'scarf.aurora', 'hat.antenna', 'hat.horns', 'hat.halo']));
check('migrate: welcome balance', m1.wallet === 30 && m1.lifetime === 30 && m1.goal === null);
check('migrate: owned choice kept, locked choice -> default', m1.equip.body === 'body.gold' && m1.equip.scarf === 'scarf.lime' && m1.equip.hat === 'hat.none');
const m2 = migrateFromSkins({ body: 'prism', scarf: 'comet', hat: 'wings' }, 132);
check('migrate: everything at 132', m2.equip.body === 'body.prism' && m2.equip.scarf === 'scarf.comet' && m2.equip.hat === 'hat.wings' && m2.owned.length === 6 + 18);
check('migrate: corrupt input', same(migrateFromSkins('x', 'y'), newShop()) && migrateFromSkins({ body: 'nope' }, 5).equip.body === 'body.paper');
check('migrate: result is sanitize-stable', same(sanitizeShop(m2), m2));

// look object
const L0 = lookFor(DEFAULT_EQUIP);
check('look: defaults', same(L0, { body: { kind: 'solid', visor: '#16131c', outline: false, color: '#f3efe7' }, scarf: { kind: 'world' }, hat: 'none', trail: 'none', death: 'classic', theme: 'dusk' }));
check('look: void outline', same(lookFor({ ...DEFAULT_EQUIP, body: 'body.void' }).body, { kind: 'solid', visor: '#3d3650', outline: true, color: '#211d2b' }));
const L1 = lookFor({ body: 'body.supernova', scarf: 'scarf.crimson', hat: 'hat.orbit', trail: 'trail.prism', death: 'death.fireworks', theme: 'theme.goldvoid' });
check('look: animated body has no color', same(L1.body, { kind: 'supernova', visor: '#16131c', outline: false }));
check('look: every slot', same(L1.scarf, { kind: 'solid', color: '#e5484d' }) && L1.hat === 'orbit' && L1.trail === 'prism' && L1.death === 'fireworks' && L1.theme === 'goldvoid');
check('look: unknown / wrong-slot ids -> defaults', same(lookFor({ body: 'hat.halo', scarf: 'nope' }), L0) && same(lookFor(null), L0));
const kinds = {
  body: ['solid', 'shifter', 'aurora', 'prism', 'supernova'], scarf: ['world', 'solid', 'aurora', 'starlight', 'comet', 'rainbow', 'phoenix'],
  hat: ['none', 'antenna', 'horns', 'halo', 'lantern', 'crown', 'wings', 'orbit'], trail: ['none', 'embers', 'snow', 'stardust', 'echo', 'prism'],
  death: ['classic', 'confetti', 'shatter', 'blackhole', 'fireworks'], theme: ['dusk', 'sakura', 'neon', 'goldvoid'],
};
const badLook = CATALOG.filter((x) => {
  const L = lookFor({ ...DEFAULT_EQUIP, [x.slot]: x.id });
  const v = L[x.slot];
  const kind = typeof v === 'string' ? v : v.kind;
  if (!kinds[x.slot].includes(kind) || kind !== x.style.kind) return true;
  if (x.slot === 'body') return !/^#[0-9a-f]{6}$/.test(v.visor) || typeof v.outline !== 'boolean' || (kind === 'solid') !== /^#[0-9a-f]{6}$/.test(v.color || '');
  if (x.slot === 'scarf') return (kind === 'solid') !== /^#[0-9a-f]{6}$/.test(v.color || '');
  return false;
}).map((x) => x.id);
check('look: schema for every item', !badLook.length, badLook.join(' '));

// economy sanity: shards per level from the real levels
const totals = LEVELS.map((l) => l.rows.join('').split('o').length - 1);
const playthrough = (first) => totals.reduce((sum, n, i) => {
  // typical run: about three quarters of the shards, every third level perfect, one new star on a first clear
  const perfect = i % 3 === 0;
  const shards = perfect ? n : Math.floor(n * 0.75);
  return sum + earnings({
    levelIndex: i, shards, firstClear: first, newStars: first ? (perfect ? 2 : 1) : 0,
    newBest: !first && i % 2 === 0, deathless: perfect, allShards: shards === n,
  }).total;
}, 0);
const firstRun = playthrough(true), replay = playthrough(false);
const perfectFirst = totals.reduce((s, n, i) => s + earnings({ levelIndex: i, shards: n, firstClear: true, newStars: 3, deathless: true, allShards: true }).total, 0);
const rares = CATALOG.filter((x) => x.tier === 'rare').map((x) => x.price).sort((a, b) => a - b);
const supernova = itemById('body.supernova').price;
check('economy: first playthrough buys several rare items', rares.slice(0, 4).reduce((a, b) => a + b, 0) <= firstRun, `first ${firstRun}, replay ${replay}`);
check('economy: first playthrough cannot buy Supernova', firstRun < supernova && perfectFirst < supernova, `perfect first ${perfectFirst}`);
check('economy: Supernova reachable with replays', firstRun + 3 * replay >= supernova, `replays needed ${Math.ceil((supernova - firstRun) / replay)}`);
check('economy: whole catalog takes many playthroughs', CATALOG.reduce((s, x) => s + x.price, 0) > firstRun + 10 * replay);

process.exit(failed ? 1 : 0);
