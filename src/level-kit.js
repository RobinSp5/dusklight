// Level builder shared by every level file. Kept separate from levels.js so the act files can
// import it without a circular dependency.
//  #  solid stone            A  solid only in Ember (0)      B  solid only in Frost (1)
//  ^  floor spikes           v  hanging spikes               a / b  spikes deadly only in Ember / Frost
//  =  one-way platform       S  spring                       x  crumbling stone (breaks after a short stand)
//  d  dash orb (refills the dash in mid-air)
//  o  shard                  C  checkpoint                   E  exit portal     P  player start
// Level meta: { name, w, h, seed, startPhase?, pulse? } where pulse = seconds per world in rhythm levels.
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
    // {action} tokens are replaced with the player's current key or touch button when drawn
    sign(x, y, text) { signs.push({ x: x * TILE, y: y * TILE, text }); },
  };
  draw(api);
  return { ...meta, startPhase: meta.startPhase ?? 0, rows: g.map((r) => r.join('')), signs };
}

