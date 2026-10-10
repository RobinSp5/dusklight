// Structural difficulty profile per level (objective geometry, no guessing):
// deadly columns (falling there kills), hazard tiles, narrowest landing surface,
// longest stretch without a save point, and how many mechanics are combined.
// Every pack is profiled on its own: difficulty rises strictly within a pack, packs are not compared with each other.
import { PACK_LIST } from '../src/packs.js';

const LAND = new Set(['#', 'A', 'B', '=']);
const HAZ = new Set(['^', 'v', 'a', 'b']);
const MECH = { A: 'Phase', B: 'Phase', '^': 'Dornen', v: 'Hängedornen', a: 'Phasendornen', b: 'Phasendornen', S: 'Feder', '=': 'Einweg', x: 'Bröckel', d: 'Orbs' };

function profile(LEVELS) {
  const series = [];
  for (const [i, L] of LEVELS.entries()) {
    const g = L.rows;
    const at = (x, y) => (y < 0 ? '.' : g[y][x]);
    let deadly = 0;
    for (let x = 0; x < L.w; x++) {
      let y = L.h - 1;
      if (!LAND.has(at(x, y))) { deadly++; continue; }
      while (y > 0 && at(x, y - 1) === '#') y--;
      if (HAZ.has(at(x, y - 1))) deadly++;
    }
    const hazards = g.join('').split('').filter((c) => HAZ.has(c)).length;
    let minW = Infinity;
    for (let y = 0; y < L.h; y++) {
      let run = 0;
      for (let x = 0; x <= L.w; x++) {
        const c = x < L.w ? at(x, y) : '.';
        const surf = LAND.has(c) && !LAND.has(at(x, y - 1)) && !HAZ.has(at(x, y - 1));
        if (surf) run++;
        else { if (run) minW = Math.min(minW, run); run = 0; }
      }
    }
    const saves = [0];
    g.forEach((r) => [...r].forEach((c, x) => c === 'C' && saves.push(x)));
    saves.push(L.w);
    saves.sort((a, b) => a - b);
    let gap = 0;
    for (let k = 1; k < saves.length; k++) gap = Math.max(gap, saves[k] - saves[k - 1]);
    const mech = new Set(g.join('').split('').map((c) => MECH[c]).filter(Boolean));
    if (L.pulse) mech.add(`Puls ${L.pulse}s`);
    series.push({ deadly, hazards });
    console.log(`${String(i + 1).padStart(2)} ${L.name.padEnd(16)} tödl.Spalten=${String(deadly).padStart(3)}  Gefahren=${String(hazards).padStart(3)}  schmalste Landung=${minW}  ohne Checkpoint max=${String(gap).padStart(3)}  Mechaniken=${mech.size} (${[...mech].join(', ')})`);
  }
  return series;
}

// Difficulty must rise with every level: deadly columns and hazard tiles strictly increase.
let failed = false;
for (const pack of PACK_LIST) {
  console.log(`--- ${pack.name} ---`);
  const series = profile(pack.levels);
  const bad = series.slice(1).map((v, k) => [k + 2, v, series[k]]).filter(([, v, p]) => v.deadly <= p.deadly || v.hazards <= p.hazards);
  for (const [n, v, p] of bad) console.log(`FAIL ${pack.name} level ${n} is not harder than level ${n - 1}: deadly ${p.deadly} -> ${v.deadly}, hazards ${p.hazards} -> ${v.hazards}`);
  if (!bad.length) console.log(`PASS ${pack.name}: difficulty rises strictly across all ${series.length} levels`);
  if (bad.length) failed = true;
}
process.exit(failed ? 1 : 0);
