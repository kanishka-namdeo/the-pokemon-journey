/* POKéDEX — national dex device. Spec: docs/superpowers/specs/2026-09-12-pokedex-design.md
   Top level is DOM-free so Node tests can require this file. Browser facade at bottom.
   Runtime data is fully bundled (data/details/*.json, sprites/dex/, audio/cries/);
   buildRecord runs at sync time in data/generate-dex-details.mjs, never in the browser. */
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
  if (d.min_beauty) bits.push('high beauty');
  if (d.min_affection) bits.push('high affection');
  if (d.relative_physical_stats === 1) bits.push('atk above def');
  else if (d.relative_physical_stats === -1) bits.push('atk below def');
  else if (d.relative_physical_stats === 0) bits.push('atk equals def');
  if (d.known_move) bits.push('knows ' + String(d.known_move.name).replace(/-/g, ' '));
  if (d.known_move_type) bits.push('knows a ' + String(d.known_move_type.name).replace(/-/g, ' ') + ' move');
  if (d.gender === 1) bits.push('female');
  else if (d.gender === 2) bits.push('male');
  if (d.party_species) bits.push('with ' + String(d.party_species.name).replace(/-/g, ' ') + ' in party');
  if (d.party_type) bits.push('with ' + String(d.party_type.name) + ' in party');
  if (d.trade_species) bits.push('trade for ' + String(d.trade_species.name).replace(/-/g, ' '));
  if (d.needs_overworld_rain) bits.push('in the rain');
  if (d.turn_upside_down) bits.push('held upside down');
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
  /* Prefer level-up moves; fall back to all methods if none exist (e.g. Gen 9 uses "train"). */
  let rows = [];
  for (const m of pokemon.moves) {
    for (const d of m.version_group_details) {
      if (dexIdFromUrl(d.version_group.url) === maxVg && d.move_learn_method.name === 'level-up') {
        rows.push({ level: d.level_learned_at, name: m.move.name });
      }
    }
  }
  if (rows.length === 0) {
    for (const m of pokemon.moves) {
      for (const d of m.version_group_details) {
        if (dexIdFromUrl(d.version_group.url) === maxVg) {
          rows.push({ level: d.level_learned_at, name: m.move.name });
        }
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

const GEN_RANGES = [[1,151],[152,251],[252,386],[387,493],[494,649],
  [650,721],[722,809],[810,905],[906,1025]];

function genOf(id) {
  for (let i = 0; i < GEN_RANGES.length; i++) {
    if (id >= GEN_RANGES[i][0] && id <= GEN_RANGES[i][1]) return i + 1;
  }
  return 0;
}

function matchesQuery(entry, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  if (/^\d+$/.test(s)) return entry[0] === +s || String(entry[0]).padStart(3, '0') === s;
  return entry[1].includes(s);
}

function sortList(list, mode) {
  const out = list.slice();
  if (mode === 'az') out.sort((a, b) => a[1].localeCompare(b[1]));
  else if (mode === 'za') out.sort((a, b) => b[1].localeCompare(a[1]));
  else if (mode === 'num-desc') out.sort((a, b) => b[0] - a[0]);
  else out.sort((a, b) => a[0] - b[0]);
  return out;
}

function filterList(list, o) {
  return sortList(list.filter(e =>
    (!o.type || e[2].includes(o.type)) &&
    (!o.gen || genOf(e[0]) === o.gen) &&
    matchesQuery(e, o.q)), o.sort || 'num');
}

const CACHE_KEY = 'pj-dex-cache-v3'; // v3: cry paths are codec-accurate (.ogg or .mp3 by real container)

function createCache(storage, budget) {
  budget = budget || 3 * 1024 * 1024; // ~3 MB of the ~5 MB quota
  let map = {};
  try { map = JSON.parse(storage.getItem(CACHE_KEY) || '{}') || {}; }
  catch (e) { map = {}; }
  const evictOldest = () => {
    const keys = Object.keys(map).sort((a, b) => (map[a].t || 0) - (map[b].t || 0));
    const drop = Math.max(1, Math.ceil(keys.length * 0.25));
    for (let i = 0; i < drop; i++) delete map[keys[i]];
  };
  const persist = () => {
    try { storage.setItem(CACHE_KEY, JSON.stringify(map)); return true; }
    catch (e) {
      evictOldest();
      try { storage.setItem(CACHE_KEY, JSON.stringify(map)); return true; }
      catch (e2) { return false; }
    }
  };
  return {
    get(id) { const e = map[id]; return e ? e.r : null; },
    put(id, record) {
      map[id] = { t: Date.now(), r: record };
      while (Object.keys(map).length > 1 && JSON.stringify(map).length > budget) evictOldest();
      return persist() && !!map[id]; // false = network-only: this record was evicted, refetch next visit
    },
    size() { return Object.keys(map).length; },
  };
}

/* ===== Browser facade ===== */
const Dex = (function () {
  const SPRITE = (id) => 'sprites/dex/front/' + id + '.png';
  const ART = (id) => 'sprites/dex/art/' + id + '.webp';

  let deps = {}, els = {}, opener = null, bound = false, closeTimeout = null;
  let list = null, movesIndex = null, listFailed = false, listReady = null;
  let state = { selId: 0 }, wired = false;
  let seen = new Set(), caught = new Set();
  const cache = createCache(typeof localStorage !== 'undefined' ? localStorage : { getItem(){ return '{}'; }, setItem(){} }, 3 * 1024 * 1024);

  const counts = () => ({ seen: seen.size, caught: caught.size });
  const emitCounts = () => document.dispatchEvent(new CustomEvent('pj-dex-counts', { detail: counts() }));
  const loadSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch (e) { return new Set(); } };
  const saveSet = (k, s) => { try { localStorage.setItem(k, JSON.stringify([...s])); } catch (e) {} };

  function bind() {
    if (bound) return;
    bound = true;
    els = {
      backdrop: document.getElementById('dexBackdrop'),
      device: document.getElementById('dexDevice'),
      counts: document.getElementById('dexCounts'),
      close: document.getElementById('dexClose'),
      left: document.querySelector('.dex-left'),
      right: document.getElementById('dexDetail'),
      grid: document.getElementById('dexGrid'),
      sentinel: document.getElementById('dexSentinel'),
    };
    els.close.addEventListener('click', () => close());
    /* Click on the dimmed backdrop outside the device closes, matching the trainer card. */
    els.backdrop.addEventListener('click', (e) => { if (e.target === els.backdrop) close(); });
    els.backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (state.selId) clearSelection(); else close(); } });
    /* ArrowLeft/Right inside the detail pane walk the current filtered view. */
    els.right.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (!state.selId || !visible.length) return;
      const i = visible.findIndex(en => en[0] === state.selId);
      const j = e.key === 'ArrowLeft' ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= visible.length) return;
      e.preventDefault();
      openDetail(visible[j][0], { fromNav: true });
    });
    els.device.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...els.device.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const ae = document.activeElement;
      const i = f.indexOf(ae);
      if (i !== -1) {
        if (e.shiftKey && i === 0) { f[f.length - 1].focus(); e.preventDefault(); }
        else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
        return;
      }
      /* Focus sits on a roving card (tabindex -1) or a stray node: step to the
         nearest tabbable in the Tab direction instead of escaping the dialog. */
      let next = null;
      if (e.shiftKey) {
        for (let k = f.length - 1; k >= 0; k--) {
          if (ae.compareDocumentPosition(f[k]) & Node.DOCUMENT_POSITION_PRECEDING) { next = f[k]; break; }
        }
        next = next || f[f.length - 1];
      } else {
        for (let k = 0; k < f.length; k++) {
          if (f[k].compareDocumentPosition(ae) & Node.DOCUMENT_POSITION_PRECEDING) { next = f[k]; break; }
        }
        next = next || f[0];
      }
      next.focus(); e.preventDefault();
    });
  }

  /* Data layer: bundled list + per-species records, both fetched from the repo; SIGNAL LOST + retry on failure. */
  function ensureList() {
    if (list || listFailed) return;
    Promise.all([
      fetch('data/dex-list.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch('data/moves.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]).then(([dexList, movesJson]) => {
      list = dexList; movesIndex = movesJson;
      if (listReady) listReady();
    }).catch(() => {
      listFailed = true;
      els.left.classList.remove('dex-loading');
      els.left.classList.add('dex-nolist');
      els.left.insertAdjacentHTML('beforeend',
        '<div class="dex-signal" role="alert">SIGNAL LOST…<br>RECONNECT TO OAK\'S NETWORK.' +
        '<button id="dexRetry">RECONNECT</button></div>');
      document.getElementById('dexRetry').addEventListener('click', () => {
        listFailed = false;
        els.left.classList.remove('dex-nolist');
        els.left.classList.add('dex-loading');
        els.left.querySelector('.dex-signal').remove();
        ensureList();
      });
    });
  }

  function updateCounts() {
    const c = counts();
    els.counts.textContent = 'SEEN ' + c.seen + ' · CAUGHT ' + c.caught;
    emitCounts();
  }

  function markSeen(id) {
    if (!seen.has(id)) { seen.add(id); saveSet('pj-dex-seen', seen); updateCounts(); }
  }
  function toggleCaught(id) {
    caught.has(id) ? caught.delete(id) : caught.add(id);
    saveSet('pj-dex-caught', caught);
    const card = els.grid && els.grid.querySelector(`.dex-card[data-id="${id}"]`);
    if (card) card.classList.toggle('caught', caught.has(id));
    updateCounts();
  }

  /* ---- left screen: controls, chunked grid, filtered view ---- */
  let view = { q: '', type: '', gen: 0, sort: 'num' };
  let visible = [], shown = 0, io = null, colCache = 1;
  const CHUNK = 60;
  const no = (id) => '#' + String(id).padStart(4, '0');

  listReady = () => { els.left.classList.remove('dex-loading'); renderTypes(); applyView(); };

  function renderTypes() {
    document.getElementById('dexTypes').innerHTML = deps.TYPES.map(t =>
      `<button class="dex-typechip" data-type="${t.name}" style="background:${t.color}" aria-pressed="false">${t.name}</button>`).join('');
  }

  function wireControls() {
    if (wired) return;
    wired = true;
    const search = document.getElementById('dexSearch');
    search.addEventListener('input', (e) => { view.q = e.target.value; applyView(); });
    /* Esc clears an active query first; the next Esc bubbles and steps back. */
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && search.value) {
        search.value = ''; view.q = ''; applyView(); e.stopPropagation();
      }
    });
    document.getElementById('dexGen').addEventListener('change', (e) => { view.gen = +e.target.value || 0; applyView(); });
    const sortBtn = document.getElementById('dexSort');
    const NEXT = { 'num': 'num-desc', 'num-desc': 'az', 'az': 'za', 'za': 'num' };
    const LABEL = { 'num': '#', 'num-desc': '#↓', 'az': 'A↓', 'za': 'A↑' };
    const SORT_NAME = { 'num': 'number low to high', 'num-desc': 'number high to low',
      'az': 'A to Z', 'za': 'Z to A' };
    const syncSortLabel = () =>
      sortBtn.setAttribute('aria-label', 'Change sort order; current: ' + SORT_NAME[view.sort]);
    syncSortLabel();
    sortBtn.addEventListener('click', () => {
      view.sort = NEXT[view.sort]; sortBtn.textContent = LABEL[view.sort]; syncSortLabel(); applyView();
    });
    document.getElementById('dexClear').addEventListener('click', () => {
      view = { q: '', type: '', gen: 0, sort: 'num' };
      search.value = '';
      document.getElementById('dexGen').value = '';
      document.querySelectorAll('#dexTypes .dex-typechip').forEach(c => {
        c.classList.remove('on'); c.setAttribute('aria-pressed', 'false');
      });
      sortBtn.textContent = LABEL.num; syncSortLabel();
      applyView();
    });
    document.getElementById('dexTypes').addEventListener('click', (e) => {
      const b = e.target.closest('.dex-typechip'); if (!b) return;
      view.type = view.type === b.dataset.type ? '' : b.dataset.type;
      b.parentElement.querySelectorAll('.dex-typechip').forEach(c => {
        const on = c.dataset.type === view.type;
        c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on));
      });
      applyView();
    });
    els.grid.addEventListener('click', (e) => {
      const card = e.target.closest('.dex-card'); if (card) openDetail(+card.dataset.id);
    });
    /* On-device controls: D-pad walks the grid like the arrow keys; A confirms, B steps back. */
    document.querySelector('.dex-dpad').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dpad]'); if (!b) return;
      if (deps.Sound) deps.Sound.select();
      const cards = els.grid.querySelectorAll('.dex-card');
      if (!cards.length) return;
      const cur = document.activeElement && document.activeElement.closest('.dex-card');
      const i = cur ? [...cards].indexOf(cur) : -1;
      if (i === -1) { focusCardAt(0); return; }
      const d = b.dataset.dpad === 'left' ? -1 : b.dataset.dpad === 'right' ? 1
        : b.dataset.dpad === 'up' ? -colCache : colCache;
      focusCardAt(i + d);
    });
    document.getElementById('dexBtnA').addEventListener('click', () => {
      if (deps.Sound) deps.Sound.select();
      const card = els.grid.querySelector('.dex-card[tabindex="0"]') || els.grid.querySelector('.dex-card');
      if (card) { setTabbable(card); openDetail(+card.dataset.id); }
    });
    document.getElementById('dexBtnB').addEventListener('click', () => {
      if (deps.Sound) deps.Sound.select();
      if (state.selId) clearSelection(); else close();
    });
    /* Roving tabindex: exactly one card is tabbable; arrows walk the list. */
    els.grid.addEventListener('focusin', (e) => {
      const card = e.target.closest('.dex-card');
      if (card && card.tabIndex !== 0) setTabbable(card);
    });
    els.grid.addEventListener('keydown', (e) => {
      const card = e.target.closest('.dex-card'); if (!card) return;
      const i = [...els.grid.querySelectorAll('.dex-card')].indexOf(card);
      let j = null;
      if (e.key === 'ArrowRight') j = i + 1;
      else if (e.key === 'ArrowLeft') j = i - 1;
      else if (e.key === 'ArrowDown') j = i + colCache;
      else if (e.key === 'ArrowUp') j = i - colCache;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = shown - 1; /* virtualized: last rendered card */
      else if (e.key === 'Escape') { if (state.selId) { clearSelection(); e.stopPropagation(); } return; }
      else if (e.key === 'Enter' || e.key === ' ') { openDetail(+card.dataset.id); e.preventDefault(); return; }
      if (j === null) return;
      e.preventDefault();
      focusCardAt(j);
    });
    io = new IntersectionObserver((entries) => {
      if (entries.some(en => en.isIntersecting)) renderChunk();
    }, { root: els.grid, rootMargin: '200px' });
    io.observe(els.sentinel);
    /* Column count only changes when the grid resizes; cache it for ArrowUp/Down. */
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => { colCache = gridColumns(); }).observe(els.grid);
    }
  }

  function gridColumns() {
    const cards = els.grid.querySelectorAll('.dex-card');
    if (cards.length < 2) return 1;
    const top = cards[0].offsetTop;
    let n = 1;
    while (n < cards.length && cards[n].offsetTop === top) n++;
    return n;
  }

  function setTabbable(card) {
    els.grid.querySelectorAll('.dex-card[tabindex="0"]').forEach(c => { c.tabIndex = -1; });
    if (card) card.tabIndex = 0;
  }

  function focusCardAt(j) {
    if (j >= shown) renderChunk(); /* lazy edge: render the next chunk before focusing */
    const target = els.grid.querySelectorAll('.dex-card')[j];
    if (target) { setTabbable(target); target.focus(); }
  }

  function renderChunk() {
    if (!list || shown >= visible.length) return;
    const slice = visible.slice(shown, shown + CHUNK);
    const frag = document.createElement('template');
    frag.innerHTML = slice.map(cardHtml).join('');
    els.grid.insertBefore(frag.content, els.sentinel);
    shown += slice.length;
    if (!els.grid.querySelector('.dex-card[tabindex="0"]')) {
      const first = els.grid.querySelector('.dex-card');
      if (first) first.tabIndex = 0;
    }
    colCache = gridColumns();
  }

  function cardHtml(e) {
    const cls = (seen.has(e[0]) ? ' seen' : '') + (caught.has(e[0]) ? ' caught' : '');
    return `<li class="dex-card${cls}" role="option" aria-selected="false" tabindex="-1" data-id="${e[0]}">` +
      `<img loading="lazy" width="64" height="64" alt="${no(e[0])} ${e[1]} sprite" src="${SPRITE(e[0])}" onerror="this.classList.add('is-glitch')">` +
      `<span class="dex-marks" aria-hidden="true"></span>` +
      `<span class="dex-no">${no(e[0])}</span>` +
      `<span class="dex-name">${e[1]}</span></li>`;
  }

  function applyView() {
    if (!list) return;
    visible = filterList(list, view);
    shown = 0;
    els.grid.querySelectorAll('.dex-card').forEach(c => c.remove());
    renderChunk();
    els.left.classList.toggle('dex-noresults', visible.length === 0);
    updateCounts();
  }

  function clearSelection() {
    state.selId = 0;
    els.grid.querySelectorAll('.dex-card[aria-selected="true"]').forEach(c => c.setAttribute('aria-selected', 'false'));
    els.right.innerHTML = '<p class="dex-hint">SELECT A POKéMON TO VIEW ITS DATA.</p>';
  }

  /* ---- detail screen ---- */
  async function openDetail(id, optsIn) {
    /* Capture focus intent before the LOADING swap drops it to <body>. */
    const fromEvo = !!(document.activeElement && document.activeElement.closest &&
      document.activeElement.closest('.dex-evo'));
    const fromPanel = els.right.contains(document.activeElement);
    state.selId = id;
    els.right.innerHTML = '<p class="dex-hint">LOADING DATA…</p>';
    els.right.scrollTop = 0;
    try {
      let record = cache.get(id);
      if (!record) {
        record = await (await fetch('data/details/' + id + '.json')).json();
        cache.put(id, record);
      }
      markSeen(id);
      renderDetail(record, { fromEvo, fromPanel, ...(optsIn || {}) });
    } catch (e) {
      if (state.selId !== id) return;
      els.right.innerHTML = '<div class="dex-signal" role="alert">SIGNAL LOST…<br>RECONNECT TO OAK\'S NETWORK.' +
        '<button id="dexRetryDetail">RECONNECT</button></div>';
      els.right.scrollTop = 0;
      els.right.querySelector('#dexRetryDetail').addEventListener('click', () => openDetail(id));
    }
  }

  function chip(name) {
    const t = (deps.TYPES || []).find(x => x.name === name);
    const color = t ? t.color : '#888';
    return `<span class="dex-typechip" style="background:${color};opacity:1">${name}</span>`;
  }

  function renderDetail(r, opts) {
    /* Cries are .ogg or .mp3 by source codec; gate the button on the codec the
       path actually names (Safari plays MP3 but rejects Ogg). */
    const audioProbe = document.createElement('audio');
    const canCry = (p) => audioProbe.canPlayType(p.endsWith('.mp3') ? 'audio/mpeg' : 'audio/ogg');
    const eff = { weak: 'b', resist: 'i', immune: 'em' };
    const effHtml = Object.entries(eff).map(([k, tag]) =>
      r[k].length ? `<div><${tag}>${k.toUpperCase()}:</${tag}> ${r[k].map(chip).join(' ')}</div>` : ''
    ).join('');
    const stats = r.stats.map(s =>
      `<div class="dex-stat"><span>${s.stat.replace('special-', 'sp. ')}</span>` +
      `<span class="bar"><i style="width:${Math.round(s.value / 255 * 100)}%"></i></span>` +
      `<span>${s.value}</span></div>`).join('');
    const evoHtml = r.evo.map(e =>
      `<button class="ev" data-id="${e.id}">${e.name}${e.condition ? `<span class="cond">${e.condition}</span>` : ''}</button>`).join('');
    const moveRow = (m) => {
      const info = (movesIndex && movesIndex[m.name]) || {};
      return `<tr><td>${m.level || '—'}</td><td style="text-transform:uppercase">${m.name.replace(/-/g, ' ')}</td>` +
        `<td>${info.t ? chip(info.t) : '—'}</td><td>${info.p ?? '—'}</td><td>${info.a ?? '—'}</td><td>${info.c || '—'}</td></tr>`;
    };
    const cryBtn = (r.cry && canCry(r.cry))
      ? `<button class="dex-crybtn" id="dexCry">▶ CRY</button>` : '';
    const isCaught = caught.has(r.id);
    /* Prev/next walk the current filtered view; hidden when the id sits off-view (evo jump). */
    const vi = visible.findIndex(e => e[0] === r.id);
    const prevId = vi > 0 ? visible[vi - 1][0] : 0;
    const nextId = vi > -1 && vi < visible.length - 1 ? visible[vi + 1][0] : 0;
    const navHtml = vi > -1 && visible.length > 1
      ? `<div class="dex-nav">
          <button class="dex-navbtn" id="dexPrev"${prevId ? '' : ' disabled'}>◀ PREV</button>
          <span class="dex-navpos">${vi + 1} OF ${visible.length}</span>
          <button class="dex-navbtn" id="dexNext"${nextId ? '' : ' disabled'}>NEXT ▶</button>
        </div>`
      : '';
    const abilities = r.abilities.map(a =>
      `<div class="dex-ability"><span class="dex-abname">${a.name.replace(/-/g, ' ')}</span>` +
      `${a.hidden ? '<span class="dex-abhidden">HIDDEN</span>' : ''}` +
      `<span class="dex-abeff">${a.effect}</span></div>`).join('');
    els.right.innerHTML =
      `${navHtml}<div class="dex-detail-top">
        <img class="dex-art" alt="${no(r.id)} ${r.name} official artwork" src="${ART(r.id)}">
        <div class="dex-idname">
          <h3>${no(r.id)} ${r.name}</h3>
          <div class="dex-genus">${r.genus}</div>
          <div class="dex-chiprow">${r.types.map(chip).join(' ')} ${cryBtn}</div>
          ${effHtml}
          <div class="dex-effect dex-flavor">"${r.flavor}"</div>
          <div style="margin-top:6px">HT ${r.height.toFixed(1)} m · WT ${r.weight.toFixed(1)} kg</div>
          <button class="dex-caughtbtn${isCaught ? ' on' : ''}" id="dexCaught" aria-pressed="${isCaught}">
            ${isCaught ? '● CAUGHT' : '○ MARK CAUGHT'}
          </button>
        </div>
      </div>
      <div class="dex-sub">ABILITIES</div><div class="dex-abilities">${abilities}</div>
      <div class="dex-sub">BASE STATS</div><div class="dex-stats">${stats}</div>
      <div class="dex-sub">EVOLUTION</div><div class="dex-evo">${evoHtml}</div>
      <div class="dex-sub">LEVEL-UP MOVES · LATEST GAMES${r.moves.total > r.moves.rows.length ? ` (FIRST ${r.moves.rows.length} OF ${r.moves.total})` : ` (${r.moves.total} TOTAL)`}</div>
      <table class="dex-moves"><tr><th>LV</th><th>MOVE</th><th>TYPE</th><th>PWR</th><th>ACC</th><th>CLASS</th></tr>
        ${r.moves.rows.map(moveRow).join('')}</table>`;
    const art = els.right.querySelector('.dex-art');
    art.addEventListener('error', () => art.classList.add('is-glitch'), { once: true });
    if (prevId) els.right.querySelector('#dexPrev').addEventListener('click', () => openDetail(prevId, { fromNav: true }));
    if (nextId) els.right.querySelector('#dexNext').addEventListener('click', () => openDetail(nextId, { fromNav: true }));
    const cry = els.right.querySelector('#dexCry');
    if (cry) cry.addEventListener('click', () => { const a = new Audio(r.cry); a.volume = 0.5; a.play().catch(() => {}); });
    els.right.querySelector('#dexCaught').addEventListener('click', (e) => {
      toggleCaught(r.id);
      const on = caught.has(r.id);
      e.currentTarget.classList.toggle('on', on);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      e.currentTarget.textContent = on ? '● CAUGHT' : '○ MARK CAUGHT';
      if (deps.Sound) deps.Sound.select();
    });
    els.right.querySelectorAll('.dex-evo .ev').forEach(b =>
      b.addEventListener('click', () => openDetail(+b.dataset.id)));
    /* Keep focus inside the dialog when the open came from it (evo chain walking). */
    if (opts && opts.fromEvo) {
      const ev = els.right.querySelector('.dex-evo .ev'); if (ev) ev.focus();
    } else if (opts && opts.fromNav) {
      const nb = els.right.querySelector('.dex-navbtn:not([disabled])');
      if (nb) nb.focus();
      else { const cb = els.right.querySelector('#dexCaught'); if (cb) cb.focus(); }
    } else if (opts && opts.fromPanel) {
      const cb = els.right.querySelector('#dexCaught'); if (cb) cb.focus();
    }
    els.grid.querySelectorAll('.dex-card[aria-selected="true"]').forEach(c => c.setAttribute('aria-selected', 'false'));
    const sel = els.grid.querySelector(`.dex-card[data-id="${r.id}"]`);
    if (sel) sel.setAttribute('aria-selected', 'true');
  }

  function init(depsIn) {
    deps = depsIn || {};
    seen = loadSet('pj-dex-seen');
    caught = loadSet('pj-dex-caught');
    bind();
    wireControls();
    if (!list && !listFailed) els.left.classList.add('dex-loading');
    emitCounts();
  }

  function open() {
    if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
    bind();
    opener = document.activeElement;
    els.backdrop.hidden = false;
    requestAnimationFrame(() => els.backdrop.classList.add('open'));
    if (deps.scrollLock) deps.scrollLock.lock();
    els.close.focus();
    ensureList();
  }

  function close() {
    els.backdrop.classList.remove('open');
    const done = () => { els.backdrop.hidden = true; closeTimeout = null; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done();
    } else {
      closeTimeout = setTimeout(done, 300);
    }
    if (deps.scrollLock) deps.scrollLock.unlock();
    if (opener && opener.focus) opener.focus();
    opener = null;
  }

  const isOpen = () => !!els.backdrop && !els.backdrop.hidden;

  return { init, open, close, isOpen, counts };
})();
if (typeof window !== 'undefined') window.Dex = Dex;

/* Node test hook — must stay last. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TYPE_ORDER, TYPE_CHART, typeMatchup, FLAVOR_PREF, cleanFlavor, pickFlavor, dexIdFromUrl, evoCondition, flattenEvo, latestMoves, buildRecord, GEN_RANGES, genOf, matchesQuery, sortList, filterList, CACHE_KEY, createCache };
}
