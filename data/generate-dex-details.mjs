// data/generate-dex-details.mjs — bundles ALL dex runtime data into the repo.
// The website never calls PokéAPI; this script is the only thing that does.
// Per species it stores:
//   data/details/{id}.json      detail record (same shape buildRecord produces)
//   sprites/dex/front/{id}.png  grid sprite
//   sprites/dex/art/{id}.webp   official artwork, downscaled to 384px
//   audio/cries/{id}.ogg|mp3    cry, extension follows the real container
//                               (null in the record if the species has none)
//
// Run:  npm run sync:dex                            # fetch whatever is missing
//       node data/generate-dex-details.mjs --force  # refetch everything
//       node data/generate-dex-details.mjs --ids=25,152,800-810
// After a new generation lands, regenerate dex-list.json first
// (data/generate-dex-list.mjs), then run this script.
import { createRequire } from 'node:module';
import { writeFileSync, existsSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
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

/* Most cries are Ogg Vorbis, but PokéAPI ships a few as raw MP3 bytes (25, 808,
   809). Files are named by their real container so every browser decodes them:
   Safari rejects Ogg entirely, and an .ogg name on MP3 data breaks those users. */
const CRY_EXTS = ['.ogg', '.mp3'];
function findCry(id) {
  for (const ext of CRY_EXTS) {
    const p = join(DIR.cries, id + ext);
    if (existsSync(p)) return p;
  }
  return null;
}
function cryExt(buf) {
  if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return '.ogg'; // OggS
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return '.mp3'; // ID3
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return '.mp3'; // MPEG frame sync
  return '.ogg';
}

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
  let cryFile = findCry(id);
  try {
    const haveDetails = existsSync(pDetails);
    const haveAssets = existsSync(pFront) && existsSync(pArt);
    const cryWaived = !cryFile && haveDetails && JSON.parse(readFileSync(pDetails, 'utf8')).cry === null;
    if (!FORCE && haveDetails && haveAssets && (cryFile || cryWaived)) {
      /* Records embed the cry path; heal it when the file's codec-accurate
         name differs (e.g. after a rename or an upstream codec change). */
      if (cryFile) {
        const rec = JSON.parse(readFileSync(pDetails, 'utf8'));
        const want = 'audio/cries/' + basename(cryFile);
        if (rec.cry !== want) { rec.cry = want; writeFileSync(pDetails, JSON.stringify(rec)); }
      }
      skipped++; return;
    }

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
        if (FORCE || !cryFile) {
          const r = await fetchRetry(pokemon.cries.latest);
          const buf = Buffer.from(await r.arrayBuffer());
          const ext = cryExt(buf);
          writeFileSync(join(DIR.cries, id + ext), buf);
          for (const e of CRY_EXTS) {
            const old = join(DIR.cries, id + e);
            if (e !== ext && existsSync(old)) rmSync(old);
          }
          cryFile = join(DIR.cries, id + ext);
        }
        record.cry = 'audio/cries/' + basename(cryFile);
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
