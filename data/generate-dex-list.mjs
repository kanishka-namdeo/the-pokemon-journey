// data/generate-dex-list.mjs — regenerates dex-list.json + moves.json from PokeAPI CSVs.
// Run: node data/generate-dex-list.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const rows = (name) => fetch(CSV + name).then(r => r.text())
  .then(t => t.trim().split(/\r?\n/).slice(1).map(l => l.split(',')));

const [species, pokemon, ptypes, types, moves] = await Promise.all([
  rows('pokemon_species.csv'), rows('pokemon.csv'), rows('pokemon_types.csv'),
  rows('types.csv'), rows('moves.csv'),
]);

const speciesName = new Map(species.map(r => [+r[0], r[1]]));
const typeName = new Map(types.map(r => [+r[0], r[1]]));
const defaultBySpecies = new Map(pokemon.filter(r => r[7] === '1').map(r => [+r[2], +r[0]]));
const typesByPoke = new Map();
for (const r of ptypes) {
  const id = +r[0];
  if (!typesByPoke.has(id)) typesByPoke.set(id, []);
  typesByPoke.get(id).push([+r[1], +r[2]]);
}

const dexList = [...defaultBySpecies].sort((a, b) => a[0] - b[0]).map(([sid, pid]) => [
  sid, speciesName.get(sid),
  (typesByPoke.get(pid) || []).sort((a, b) => a[1] - b[1]).map(x => typeName.get(x[0])),
]);

const CLASSES = { 1: 'physical', 2: 'special', 3: 'status' };
const movesJson = {};
for (const r of moves) {
  movesJson[r[1]] = {
    t: typeName.get(+r[3]) || 'normal',
    p: r[4] ? +r[4] : null,
    a: r[6] ? +r[6] : null,
    c: CLASSES[r[9]] || 'physical',
  };
}

// Sanity gates — the generator fails loudly rather than shipping bad data.
if (dexList.length !== 1025) throw new Error(`expected 1025 species, got ${dexList.length}`);
const pick = (i) => JSON.stringify(dexList[i - 1]);
if (pick(1) !== '[1,"bulbasaur",["grass","poison"]]') throw new Error('#1 mismatch: ' + pick(1));
if (pick(25) !== '[25,"pikachu",["electric"]]') throw new Error('#25 mismatch: ' + pick(25));
if (pick(1025) !== '[1025,"pecharunt",["poison","ghost"]]') throw new Error('#1025 mismatch: ' + pick(1025));
if (!movesJson.thunderbolt || movesJson.thunderbolt.p !== 90) throw new Error('moves sanity failed');

writeFileSync(join(ROOT, 'data/dex-list.json'), JSON.stringify(dexList));
writeFileSync(join(ROOT, 'data/moves.json'), JSON.stringify(movesJson));
console.log(`dex-list.json: ${dexList.length} entries, ${Buffer.byteLength(JSON.stringify(dexList))} B`);
console.log(`moves.json: ${Object.keys(movesJson).length} moves, ${Buffer.byteLength(JSON.stringify(movesJson))} B`);
