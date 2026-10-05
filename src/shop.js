// Shop economy that does not touch the DOM: catalog, earnings, wallet, buying, goals, look.
// Pure functions (inputs are never mutated) so tests/shop.mjs can verify them in Node.

export const SLOTS = ['body', 'scarf', 'hat', 'trail', 'death', 'theme'];
export const SLOT_NAMES = { body: 'Body', scarf: 'Scarf', hat: 'Accessory', trail: 'Trail', death: 'Death effect', theme: 'Theme' };
export const TIERS = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

const it = (id, name, price, tier, desc, style) => ({ id, slot: id.split('.')[0], name, price, tier, desc, style });
const VISOR = '#16131c';

// Tier by price: common <= 100, rare <= 400, epic <= 1200, legendary above.
export const CATALOG = [
  // body
  it('body.paper', 'Paper', 0, 'common', 'The classic off-white wanderer.', { kind: 'solid', color: '#f3efe7', visor: VISOR }),
  it('body.ash', 'Ash', 20, 'common', 'A soft grey, calm and quiet.', { kind: 'solid', color: '#a49db0', visor: VISOR }),
  it('body.rose', 'Rose', 40, 'common', 'A warm pink with a deep visor.', { kind: 'solid', color: '#ffa3bb', visor: '#2a1420' }),
  it('body.moss', 'Moss', 60, 'common', 'Fresh green, like moss on old stone.', { kind: 'solid', color: '#a6dc8f', visor: '#13210f' }),
  it('body.gold', 'Gold', 140, 'rare', 'Polished gold that catches every glow.', { kind: 'solid', color: '#ffd36b', visor: '#2a1d06' }),
  it('body.void', 'Void', 260, 'rare', 'A dark silhouette with a faint outline.', { kind: 'solid', color: '#211d2b', visor: '#3d3650', outline: true }),
  it('body.shifter', 'World-Shifter', 450, 'epic', 'Takes the color of the active world and eases on every switch.', { kind: 'shifter', visor: VISOR }),
  it('body.aurora', 'Aurora', 700, 'epic', 'Drifts slowly through the whole hue wheel.', { kind: 'aurora', visor: VISOR }),
  it('body.prism', 'Prism', 1300, 'legendary', 'A fast, smooth rainbow cycle.', { kind: 'prism', visor: VISOR }),
  it('body.supernova', 'Supernova', 3000, 'legendary', 'A fast rainbow with a pulsing halo and sparkles.', { kind: 'supernova', visor: VISOR }),
  // scarf
  it('scarf.world', 'World', 0, 'common', 'Follows the color of the active world.', { kind: 'world' }),
  it('scarf.crimson', 'Crimson', 25, 'common', 'A bold red scarf.', { kind: 'solid', color: '#e5484d' }),
  it('scarf.violet', 'Violet', 50, 'common', 'A soft violet scarf.', { kind: 'solid', color: '#a78bfa' }),
  it('scarf.lime', 'Lime', 80, 'common', 'A bright lime scarf.', { kind: 'solid', color: '#c6f432' }),
  it('scarf.aurora', 'Aurora', 160, 'rare', 'Northern lights woven into cloth.', { kind: 'aurora' }),
  it('scarf.starlight', 'Starlight', 320, 'rare', 'A night sky scattered with stars.', { kind: 'starlight' }),
  it('scarf.comet', 'Comet', 550, 'epic', 'Fades into a glowing comet tail.', { kind: 'comet' }),
  it('scarf.rainbow', 'Rainbow', 950, 'epic', 'Colours flow along the whole scarf.', { kind: 'rainbow' }),
  it('scarf.phoenix', 'Phoenix', 1900, 'legendary', 'A flame gradient that sheds embers.', { kind: 'phoenix' }),
  // hat
  it('hat.none', 'None', 0, 'common', 'Nothing on top.', { kind: 'none' }),
  it('hat.antenna', 'Antenna', 60, 'common', 'A little antenna with a glowing tip.', { kind: 'antenna' }),
  it('hat.horns', 'Horns', 130, 'rare', 'Two small curved horns.', { kind: 'horns' }),
  it('hat.halo', 'Halo', 260, 'rare', 'A floating ring of light.', { kind: 'halo' }),
  it('hat.lantern', 'Lantern', 380, 'rare', 'A tiny lantern to light the way.', { kind: 'lantern' }),
  it('hat.crown', 'Crown', 480, 'epic', 'A crown for a seasoned runner.', { kind: 'crown' }),
  it('hat.wings', 'Wings', 850, 'epic', 'Small wings that flap as you move.', { kind: 'wings' }),
  it('hat.orbit', 'Orbit', 1600, 'legendary', 'Two small moons, one Ember and one Frost, circle your head.', { kind: 'orbit' }),
  // trail
  it('trail.none', 'None', 0, 'common', 'No trail behind you.', { kind: 'none' }),
  it('trail.embers', 'Embers', 220, 'rare', 'Warm sparks drift from your feet.', { kind: 'embers' }),
  it('trail.snow', 'Snowfall', 220, 'rare', 'Soft snowflakes follow your steps.', { kind: 'snow' }),
  it('trail.stardust', 'Stardust', 480, 'epic', 'A glittering dust of tiny stars.', { kind: 'stardust' }),
  it('trail.echo', 'World Echo', 750, 'epic', 'Afterimages in the color of the active world.', { kind: 'echo' }),
  it('trail.prism', 'Prism Ribbon', 1400, 'legendary', 'A rainbow ribbon traces your path.', { kind: 'prism' }),
  // death
  it('death.classic', 'Classic', 0, 'common', 'The familiar burst.', { kind: 'classic' }),
  it('death.confetti', 'Confetti', 160, 'rare', 'Go out in a shower of confetti.', { kind: 'confetti' }),
  it('death.shatter', 'Shatter', 340, 'rare', 'Break apart like glass.', { kind: 'shatter' }),
  it('death.blackhole', 'Black Hole', 650, 'epic', 'Get pulled into a tiny black hole.', { kind: 'blackhole' }),
  it('death.fireworks', 'Fireworks', 1100, 'epic', 'Leave the stage in a fireworks show.', { kind: 'fireworks' }),
  // theme
  it('theme.dusk', 'Dusk', 0, 'common', 'The original warm and cold dusk.', { kind: 'dusk' }),
  it('theme.sakura', 'Sakura & Ice', 1000, 'epic', 'Cherry blossom pinks against icy blues.', { kind: 'sakura' }),
  it('theme.neon', 'Neon Night', 1600, 'legendary', 'Electric colors over a midnight city.', { kind: 'neon' }),
  it('theme.goldvoid', 'Gold & Void', 2400, 'legendary', 'Molten gold against the deep void.', { kind: 'goldvoid' }),
];

export const DEFAULT_EQUIP = { body: 'body.paper', scarf: 'scarf.world', hat: 'hat.none', trail: 'trail.none', death: 'death.classic', theme: 'theme.dusk' };

const BY_ID = new Map(CATALOG.map((x) => [x.id, x]));
const FREE = CATALOG.filter((x) => x.price === 0).map((x) => x.id);

export const itemById = (id) => BY_ID.get(id);

// Non-negative integer or 0.
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (shop) => ({ ...shop, owned: [...shop.owned], equip: { ...shop.equip } });
// Owned ids in catalog order, free items always included.
const ownedList = (ids) => CATALOG.filter((x) => x.price === 0 || ids.has(x.id)).map((x) => x.id);

export function newShop() {
  return { wallet: 0, lifetime: 0, owned: [...FREE], equip: { ...DEFAULT_EQUIP }, goal: null };
}

// Stored data comes from localStorage and may be corrupt: fix what can be fixed, default the rest.
export function sanitizeShop(raw) {
  if (!isPlainObject(raw)) return newShop();
  const wallet = count(raw.wallet);
  const lifetime = Math.max(count(raw.lifetime), wallet);
  const owned = ownedList(new Set(Array.isArray(raw.owned) ? raw.owned.filter((id) => BY_ID.has(id)) : []));
  const equip = {};
  const src = isPlainObject(raw.equip) ? raw.equip : {};
  for (const slot of SLOTS) {
    const item = BY_ID.get(src[slot]);
    equip[slot] = item && item.slot === slot && owned.includes(item.id) ? item.id : DEFAULT_EQUIP[slot];
  }
  const goal = BY_ID.has(raw.goal) && !owned.includes(raw.goal) ? raw.goal : null;
  return { wallet, lifetime, owned, equip, goal };
}

// Old threshold unlocks (total shards found, nothing spent) for saves made before the shop.
const OLD_NEED = {
  'body.ash': 5, 'body.rose': 10, 'body.moss': 18, 'body.gold': 28, 'body.void': 40, 'body.prism': 100,
  'scarf.crimson': 3, 'scarf.violet': 8, 'scarf.lime': 14, 'scarf.aurora': 24, 'scarf.starlight': 34, 'scarf.comet': 80,
  'hat.antenna': 12, 'hat.horns': 20, 'hat.halo': 30, 'hat.crown': 45, 'hat.lantern': 60, 'hat.wings': 115,
};

export function migrateFromSkins(oldSkin, foundShards) {
  const found = count(foundShards);
  const owned = ownedList(new Set(Object.keys(OLD_NEED).filter((id) => OLD_NEED[id] <= found)));
  const equip = { ...DEFAULT_EQUIP };
  if (isPlainObject(oldSkin)) {
    for (const slot of ['body', 'scarf', 'hat']) {
      const id = typeof oldSkin[slot] === 'string' ? `${slot}.${oldSkin[slot]}` : '';
      if (owned.includes(id)) equip[slot] = id;
    }
  }
  return { wallet: found, lifetime: found, owned, equip, goal: null };
}

// run = { levelIndex, shards, firstClear, newStars, newBest, deathless, allShards }
export function earnings(run) {
  const r = isPlainObject(run) ? run : {};
  const lines = [
    { id: 'shards', label: 'Shards collected', amount: 2 * count(r.shards) },
    { id: 'clear', label: 'Level cleared', amount: 5 + count(r.levelIndex) + 1 },
    { id: 'first', label: 'First clear', amount: r.firstClear ? 20 : 0 },
    { id: 'stars', label: 'New stars', amount: 15 * count(r.newStars) },
    { id: 'best', label: 'New best time', amount: r.newBest && !r.firstClear ? 8 : 0 },
    { id: 'deathless', label: 'No deaths', amount: r.deathless ? 5 : 0 },
    { id: 'allShards', label: 'Every shard', amount: r.allShards ? 10 : 0 },
  ].filter((l) => l.amount > 0);
  return { total: lines.reduce((s, l) => s + l.amount, 0), lines };
}

export function deposit(shop, amount) {
  const out = clone(shop);
  out.wallet += count(amount);
  out.lifetime += count(amount);
  return out;
}

export function buy(shop, id) {
  const item = BY_ID.get(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (shop.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (shop.wallet < item.price) return { ok: false, reason: 'funds' };
  const out = clone(shop);
  out.wallet -= item.price;
  out.owned = ownedList(new Set([...shop.owned, id]));
  out.equip[item.slot] = id;
  if (out.goal === id) out.goal = null;
  return { ok: true, shop: out };
}

export function equip(shop, id) {
  const out = clone(shop);
  const item = BY_ID.get(id);
  if (item && shop.owned.includes(id)) out.equip[item.slot] = id;
  return out;
}

export function setGoal(shop, id) {
  const out = clone(shop);
  if (id === null) out.goal = null;
  else if (BY_ID.has(id) && !shop.owned.includes(id)) out.goal = id;
  return out;
}

// Pinned goal, else the cheapest unowned item the player cannot afford yet, else null.
export function goalItem(shop) {
  const pinned = BY_ID.get(shop.goal);
  if (pinned && !shop.owned.includes(pinned.id)) return pinned;
  let best = null;
  for (const x of CATALOG) {
    if (shop.owned.includes(x.id) || x.price <= shop.wallet) continue;
    if (!best || x.price < best.price) best = x;
  }
  return best;
}

// Look object for the renderer, built from the equipped items' styles (unknown ids fall back to defaults).
export function lookFor(equipped) {
  const pick = (slot) => {
    const item = BY_ID.get(equipped && equipped[slot]);
    return (item && item.slot === slot ? item : BY_ID.get(DEFAULT_EQUIP[slot])).style;
  };
  const b = pick('body'), s = pick('scarf');
  const body = { kind: b.kind, visor: b.visor, outline: !!b.outline };
  if (b.kind === 'solid') body.color = b.color;
  const scarf = { kind: s.kind };
  if (s.kind === 'solid') scarf.color = s.color;
  return { body, scarf, hat: pick('hat').kind, trail: pick('trail').kind, death: pick('death').kind, theme: pick('theme').kind };
}
