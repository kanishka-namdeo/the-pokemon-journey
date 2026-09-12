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

/* Node test hook — must stay last. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPE_ORDER, TYPE_CHART, typeMatchup };
}
