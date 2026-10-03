// Every ES module in src/ must be versioned in the import map, otherwise browsers can mix
// cached files from two releases after a deploy.
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const files = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'main.js');
const missing = files.filter((f) => !map[`./src/${f}`]);
if (missing.length) { console.log(`FAIL import map misses: ${missing.join(', ')}`); process.exit(1); }
if (!html.includes('src="src/main.js?v=__V__"')) { console.log('FAIL entry script is not versioned'); process.exit(1); }
console.log(`PASS import map versions all ${files.length} modules + entry`);
