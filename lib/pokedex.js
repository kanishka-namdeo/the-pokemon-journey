/* POKéDEX — national dex device. Spec: docs/superpowers/specs/2026-09-12-pokedex-design.md
   Top level is DOM-free so Node tests can require this file. Browser facade at bottom. */
'use strict';

const TYPE_ORDER = ['normal','fire','water','electric','grass','ice','fighting','poison',
  'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

/* Defender-keyed: what each DEFENDING type takes from attackers (post-Gen-6 chart). */
const TYPE_CHART = {
  normal:   { x2: ['fighting'], x05: [], x0: ['ghost'] },
  fire:     { x2: ['water','ground','rock'], x05: ['fire','grass','ice','bug','steel','fairy'], x0: [] },
  water:    { x2: ['electric','grass'], x05: ['fire','water','ice','steel'], x0: [] },
  electric: { x2: ['ground'], x05: ['electric','flying','steel'], x0: [] },
  grass:    { x2: ['fire','ice','poison','flying','bug'], x05: ['water','electric','grass','ground'], x0: [] },
  ice:      { x2: ['fire','fighting','rock','steel'], x05: ['ice'], x0: [] },
  fighting: { x2: ['flying','psychic','fairy'], x05: ['bug','rock','dark'], x0: ['ghost'] },
  poison:   { x2: ['ground','psychic'], x05: ['grass','fighting','poison','bug','fairy'], x0: [] },
  ground:   { x2: ['water','grass','ice'], x05: ['poison','rock'], x0: ['electric'] },
  flying:   { x2: ['electric','ice','rock'], x05: ['grass','fighting','bug'], x0: ['ground'] },
  psychic:  { x2: ['bug','ghost','dark'], x05: ['fighting','psychic'], x0: [] },
  bug:      { x2: ['fire','flying','rock'], x05: ['grass','fighting','ground'], x0: [] },
  rock:     { x2: ['water','grass','fighting','ground','steel'], x05: ['normal','fire','poison','flying'], x0: [] },
  ghost:    { x2: ['ghost','dark'], x05: ['poison','bug'], x0: ['normal','fighting'] },
  dragon:   { x2: ['ice','dragon','fairy'], x05: ['fire','water','electric','grass'], x0: [] },
  dark:     { x2: ['fighting','bug','fairy'], x05: ['ghost','dark'], x0: ['psychic'] },
  steel:    { x2: ['fire','fighting','ground'], x05: ['normal','grass','flying','psychic','bug','rock','dragon','steel','fairy'], x0: ['poison'] },
  fairy:    { x2: ['poison','steel'], x05: ['fighting','bug','dark'], x0: ['dragon'] },
};

/* Net multiplier per ATTACKING type against a defending type pair. */
function typeMatchup(defTypes) {
  const out = { weak: [], resist: [], immune: [] };
  for (const atk of TYPE_ORDER) {
    let m = 1;
    for (const def of defTypes) {
      const c = TYPE_CHART[def];
      if (!c) continue;
      if (c.x0.includes(atk)) m = 0;
      else if (c.x2.includes(atk)) m *= 2;
      else if (c.x05.includes(atk)) m *= 0.5;
    }
    if (m === 0) out.immune.push(atk);
    else if (m > 1) out.weak.push(atk);
    else if (m < 1) out.resist.push(atk);
  }
  return out;
}

const FLAVOR_PREF = ['scarlet-violet','legends-arceus','sword-shield',
  'lets-go-pikachu-lets-go-eevee','ultra-sun-ultra-moon','sun-moon'];

function cleanFlavor(t) { return String(t).replace(/[\n\f\r]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function pickFlavor(entries) {
  const en = (entries || []).filter(e => e.language && e.language.name === 'en');
  if (!en.length) return '';
  for (const v of FLAVOR_PREF) {
    const hit = en.find(e => e.version && e.version.name === v);
    if (hit) return cleanFlavor(hit.flavor_text);
  }
  return cleanFlavor(en[en.length - 1].flavor_text);
}

function dexIdFromUrl(u) { const m = /\/(\d+)\/?$/.exec(String(u)); return m ? +m[1] : 0; }

function evoCondition(d) {
  if (!d) return '';
  const bits = [];
  if (d.min_level) bits.push('Lv ' + d.min_level);
  if (d.item) bits.push('use ' + String(d.item.name).replace(/-/g, ' '));
  if (d.held_item) bits.push('hold ' + String(d.held_item.name).replace(/-/g, ' '));
  if (d.trigger && d.trigger.name !== 'level-up') bits.push(String(d.trigger.name).replace(/-/g, ' '));
  if (d.time_of_day) bits.push(String(d.time_of_day));
  if (d.min_happiness) bits.push('high friendship');
  if (d.known_move) bits.push('knows ' + String(d.known_move.name).replace(/-/g, ' '));
  return bits.join(' · ');
}

function flattenEvo(chain) {
  const out = [];
  const walk = (node, cond) => {
    out.push({ id: dexIdFromUrl(node.species.url), name: node.species.name, condition: cond });
    for (const child of (node.evolves_to || [])) {
      walk(child, evoCondition(child.evolution_details && child.evolution_details[0]));
    }
  };
  walk(chain.chain, '');
  return out;
}

/* Newest version group present in this pokemon's learnset; level-up rows only. */
function latestMoves(pokemon) {
  let maxVg = 0;
  for (const m of pokemon.moves) {
    for (const d of m.version_group_details) {
      const vg = dexIdFromUrl(d.version_group.url);
      if (vg > maxVg) maxVg = vg;
    }
  }
  const rows = [];
  for (const m of pokemon.moves) {
    for (const d of m.version_group_details) {
      if (dexIdFromUrl(d.version_group.url) === maxVg && d.move_learn_method.name === 'level-up') {
        rows.push({ level: d.level_learned_at, name: m.move.name });
      }
    }
  }
  rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return { rows: rows.slice(0, 20), total: rows.length };
}

function buildRecord(pokemon, species, evo, abilityJsons) {
  if (!pokemon || !pokemon.id || !species || !evo) throw new Error('missing source data');
  const genusEntry = (species.genera || []).filter(g => g.language.name === 'en').pop();
  const record = {
    id: pokemon.id,
    name: pokemon.name,
    genus: (genusEntry || {}).genus || '',
    flavor: pickFlavor(species.flavor_text_entries),
    types: pokemon.types.slice().sort((a, b) => a.slot - b.slot).map(t => t.type.name),
    stats: pokemon.stats.map(s => ({ stat: s.stat.name, value: s.base_stat })),
    abilities: pokemon.abilities.map((a, i) => {
      const aj = (abilityJsons || [])[i] || {};
      const eff = (aj.effect_entries || []).find(e => e.language.name === 'en') || {};
      return { name: a.ability.name, hidden: !!a.is_hidden, effect: eff.short_effect || '' };
    }),
    height: pokemon.height / 10,
    weight: pokemon.weight / 10,
    cry: (pokemon.cries && pokemon.cries.latest) || null,
    evo: flattenEvo(evo),
    moves: latestMoves(pokemon),
  };
  const m = typeMatchup(record.types);
  record.weak = m.weak; record.resist = m.resist; record.immune = m.immune;
  if (!record.types.length || !record.stats.length) throw new Error('malformed record');
  return record;
}

/* Node test hook — must stay last. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPE_ORDER, TYPE_CHART, typeMatchup, FLAVOR_PREF, cleanFlavor, pickFlavor, dexIdFromUrl, evoCondition, flattenEvo, latestMoves, buildRecord };
}
