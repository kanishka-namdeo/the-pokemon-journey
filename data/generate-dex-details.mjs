// data/generate-dex-details.mjs — bundles ALL dex runtime data into the repo.
// The website never calls PokéAPI; this script is the only thing that does.
// Per species it stores:
//   data/details/{id}.json      detail record (same shape buildRecord produces)
//   sprites/dex/front/{id}.png  grid sprite
//   sprites/dex/art/{id}.webp   official artwork, downscaled to 384px
//   audio/cries/{id}.ogg        cry (null in the record if the species has none)
//
// Run:  npm run sync:dex                            # fetch whatever is missing
//       node data/generate-dex-details.mjs --force  # refetch everything
//       node data/generate-dex-details.mjs --ids=25,152,800-810
// After a new generation lands, regenerate dex-list.json first
// (data/generate-dex-list.mjs), then run this script.
import { createRequire } from 'node:module';
import { writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildRecord } = require('../lib/pokedex.js');

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const API = 'https://pokeapi.co/api/v2';
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
const DIR = {
  details: join(ROOT, 'data', 'details'),
  front: join(ROOT, 'sprites', 'dex', 'front'),
  art: join(ROOT, 'sprites', 'dex', 'art'),
  cries: join(ROOT, 'audio', 'cries'),
};
for (const d of Object.values(DIR)) mkdirSync(d, { recursive: true });

const ART_SIZE = 384;
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const idsArg = args.find(a => a.startsWith('--ids='));
const UA = 'the-pokemon-journey-sync (github.com/kanishka-namdeo/the-pokemon-journey)';

let sharp = null;
try { sharp = require('sharp'); } catch (e) {
  console.error('sharp is required to downscale artwork. Run: npm install');
  process.exit(1);
}

async function fetchRetry(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        ...opts,
        headers: { 'User-Agent': UA, ...(opts.headers || {}) },
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 500 * 2 ** i + Math.random() * 250));
    }
  }
  throw lastErr;
}
const fetchJson = (url) => fetchRetry(url, { headers: { Accept: 'application/json' } }).then(r => r.json());
const saveBuf = async (url, path) => {
  const r = await fetchRetry(url);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  return statSync(path).size;
};

/* Run `fn` over `items` with `n` workers. */
async function pool(n, items, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

const dexList = JSON.parse(readFileSync(join(ROOT, 'data', 'dex-list.json'), 'utf8'));
let ids = dexList.map(e => e[0]);
if (idsArg) {
  const wanted = new Set();
  for (const part of idsArg.slice(6).split(',')) {
    const [a, b] = part.split('-').map(Number);
    for (let id = a; id <= (b || a); id++) wanted.add(id);
  }
  ids = ids.filter(id => wanted.has(id));
  if (!ids.length) { console.error('No ids in dex-list.json match --ids=' + idsArg.slice(6)); process.exit(1); }
}

let done = 0, fetched = 0, skipped = 0, failed = [];const failedDetails = [], failedAssets = [];
const t0 = Date.now();

console.log(`Syncing ${ids.length} species (${FORCE ? 'force refetch' : 'missing files only'})…`);

await pool(8, ids, async (id) => {
  const pDetails = join(DIR.details, id + '.json');
  const pFront = join(DIR.front, id + '.png');
  const pArt = join(DIR.art, id + '.webp');
  const pCry = join(DIR.cries, id + '.ogg');
  try {
    const haveDetails = existsSync(pDetails);
    const haveAssets = existsSync(pFront) && existsSync(pArt);
    const cryWaived = !existsSync(pCry) && haveDetails && JSON.parse(readFileSync(pDetails, 'utf8')).cry === null;
    if (!FORCE && haveDetails && haveAssets && (existsSync(pCry) || cryWaived)) { skipped++; return; }

    const [pokemon, species] = await Promise.all([
      fetchJson(`${API}/pokemon/${id}`),
      fetchJson(`${API}/pokemon-species/${id}`),
    ]);
    const [chain, abilityJsons] = await Promise.all([
      fetchJson(species.evolution_chain.url),
      Promise.all([...new Map(pokemon.abilities.map(a => [a.ability.name, a.ability.url])).values()]
        .map(u => fetchJson(u))),
    ]);
    const record = buildRecord(pokemon, species, chain, abilityJsons);

    let assetsFailed = false;
    try {
      if (FORCE || !existsSync(pFront)) await saveBuf(`${SPRITES}${id}.png`, pFront);
      if (FORCE || !existsSync(pArt)) {
        const r = await fetchRetry(`${SPRITES}other/official-artwork/${id}.png`);
        await sharp(Buffer.from(await r.arrayBuffer()))
          .resize(ART_SIZE, ART_SIZE, { fit: 'inside' })
          .webp({ quality: 78 })
          .toFile(pArt);
      }
      if (pokemon.cries && pokemon.cries.latest) {
        if (FORCE || !existsSync(pCry)) await saveBuf(pokemon.cries.latest, pCry);
        record.cry = 'audio/cries/' + id + '.ogg';
      } else {
        record.cry = null;
      }
    } catch (e) {
      assetsFailed = true;
      failedAssets.push(id + ' (' + e.message + ')');
    }

    writeFileSync(pDetails, JSON.stringify(record));
    fetched++;
    if (assetsFailed) throw new Error('assets');
  } catch (e) {
    if (e.message !== 'assets') failedDetails.push(id + ' (' + e.message + ')');
    failed.push(id);
  }
  done++;
  if (done % 50 === 0) console.log(`  ${done}/${ids.length} done`);
});

console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)}s — fetched ${fetched}, skipped ${skipped}, failed ${failed.length}`);
if (failedDetails.length) console.log('Detail failures:\n  ' + failedDetails.join('\n  '));
if (failedAssets.length) console.log('Asset failures (rerun to retry):\n  ' + failedAssets.join('\n  '));
if (failed.length) process.exit(1);
