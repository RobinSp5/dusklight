// Every Phosphor icon class used in the markup or scripts must exist in the trimmed, self-hosted icon CSS.
import { readFileSync, readdirSync } from 'node:fs';

const css = readFileSync(new URL('../assets/icons/icons.css', import.meta.url), 'utf8');
const files = ['../index.html', ...readdirSync(new URL('../src/', import.meta.url)).map((f) => `../src/${f}`)];
const used = new Set();
for (const f of files) for (const m of readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/\bph-([a-z][a-z-]*)/g)) if (m[1] !== 'bold') used.add(m[1]);
const missing = [...used].filter((n) => !css.includes(`.ph-bold.ph-${n}:before`));
const thirdParty = ['index.html', 'styles.css'].filter((f) => /googleapis|gstatic|unpkg|jsdelivr/.test(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')));
console.log(missing.length ? `FAIL missing icons: ${missing.join(', ')}` : `PASS all ${used.size} icons self-hosted`);
console.log(thirdParty.length ? `FAIL third-party requests in ${thirdParty.join(', ')}` : 'PASS no third-party font/icon requests');
process.exit(missing.length || thirdParty.length ? 1 : 0);
