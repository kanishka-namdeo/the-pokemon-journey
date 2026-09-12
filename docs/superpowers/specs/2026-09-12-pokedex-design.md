# Pokédex Feature — Design Spec

Date: 2026-09-12 (feasibility pass same day: live API probes, CDN checks, measured list size)
Status: Approved in brainstorming; feasibility-verified; pending implementation plan
Scope: Architectural (new subsystem added to an existing single-file narrative site)

## 1. Goal

Add a fully featured, national-dex (all 1025 species) Pokédex to the-pokemon-journey
that feels native to the site's scroll-driven, pixel-art narrative: a full-screen
in-story "device" opened from a new Chapter 3 dialogue beat and from the HUD.

## 2. Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Coverage | All 1025 national dex. Slim bundled list + lazy per-species detail from PokéAPI. |
| Differentiator features | Cries playback; caught/seen tracking; moves + type-effectiveness chart. |
| Excluded | Shiny toggle (existing 1/16 scroll easter egg stays unrelated); favorites; team builder; sprite-variant browser; PWA/service worker. |
| Placement | Full-screen device modal (Trainer Card dialog pattern). Opened from: (a) Chapter 3 Oak beat, (b) HUD button, always available from page load — no gating. |
| UI build strategy | Built from scratch in vanilla JS/CSS. Research found no drop-in vanilla/Web-Component full dex worth embedding (framework-bound, unmaintained, or unlicensed). Feature checklist and device aesthetic borrowed from pokemondb/pokedex.org and Pokedex-RL/poke95 references. |
| Data layer | PokéAPI REST (CORS, no auth). GraphQL rejected (200 calls/hr). Live detail fetch + localStorage cache — PokéAPI's fair-use policy requires client-side caching. |

## 3. Code organization

- New module `lib/pokedex.js` — global `Dex` namespace, same pattern as `Sound`/`Music`.
  Self-contained; dependencies injected at init: `Dex.init({ Sound, TYPES, scrollLock })`
  where `scrollLock = { lock(), unlock() }` closures from the inline script (they call
  `lenis.stop()`/`lenis.start()` when Lenis is active — `lenis` is a script-scoped
  `let` at index.html:705, not on `window`, so the module cannot reach it directly).
- Public interface: `Dex.init(deps)`, `Dex.open()`, `Dex.close()`, `Dex.isOpen()`,
  `Dex.counts()` → `{seen, caught}`. On any seen/caught change it dispatches
  `CustomEvent('pj-dex-counts', { detail: { seen, caught } })` on `document` for
  the Trainer Card listener.
- `index.html` touch points (nothing else grows):
  1. `<script src="lib/pokedex.js">` tag after the inline app script; the inline
     script then calls `Dex.init({...})`, binds the HUD button and the Chapter 3
     beat to `Dex.open()`, and listens for `pj-dex-counts`.
  2. HUD dex button in `.hud-right` (index.html:354, next to `#soundBtn`:355 and
     `#badgecase`:363), aria-label "Open Pokédex".
  3. Modal shell markup after the Trainer Card backdrop (markup at index.html:656-667,
     backdrop CSS at :280-283): `#dex-backdrop` > `#dex-device` (`role="dialog"`,
     `aria-modal="true"`, `aria-label="Pokédex"`), `hidden` by default.
  4. Trainer Card gains one readout line under the existing POKéDEX stat, updated by
     the `pj-dex-counts` listener.
  5. NEW JOURNEY handler (`#tcNew`, index.html:2528) additionally removes
     `pj-dex-seen`, `pj-dex-caught`, `pj-dex-cache`.
- All dex CSS in one labeled block appended to the existing stylesheet (~200 lines):
  red shell, bezels, VT323 readouts, pixel borders; `prefers-reduced-motion` disables
  CRT/scanline flourishes.
- New file `data/dex-list.json` (see §4). Note: `fetch()` of local JSON requires the
  established serve-over-HTTP workflow (file:// will not work — matches existing
  testing practice).

## 4. Data strategy — three tiers

### Tier 1: bundled list (`data/dex-list.json`, measured 31.3 KB raw / ~10 KB gzipped) + `data/moves.json` (~80 KB)
Array-of-arrays, one entry per species, national-dex order:
`[[1,"bulbasaur",["grass","poison"]], … [1025,"pecharunt",["poison","ghost"]]]`.
Measured from PokéAPI's CSVs on 2026-09-12 (probe artifact: `_dev/tmp/dex-list-measured.json`,
throwaway). Generation pipeline (run once, checked in as a committed `data/generate-dex-list.mjs`
script — committed rather than `_dev/` because `_dev/` is gitignored and the data must
stay reproducible): `pokemon_species.csv` (names) + `pokemon.csv` filtered to
`is_default=1` (**8th column** — schema now includes a `weight` column) keyed by
`species_id` for the default form + `pokemon_types.csv`/`types.csv` for types ordered
by slot. The same script emits `data/moves.json`: `{ "thunderbolt": { "t": "electric",
"p": 90, "a": 100, "c": "special" }, … }` for all moves — needed because `/pokemon`
move entries carry no type/power/accuracy and per-move API calls would add ~20
requests per species. Loaded lazily via `fetch()` on first dex open — never for
visitors who don't open it. Powers search, type filter, gen filter (id ranges
computed at runtime), sort, and the grid with zero network calls. If this fetch
fails, the device opens to an in-voice "SIGNAL LOST… RECONNECT TO OAK'S NETWORK."
state with a retry button.

### Tier 2: lazy detail records
Opening a species fetches, in parallel: `/pokemon/{id}`, `/pokemon-species/{id}`,
the linked `/evolution-chain`, and `/ability/{id}` for each unique ability (1–3 small
extra calls). Trimmed to a UI record (~4–10 KB) with exactly these fields:
- `id, name, height (dm → m, e.g. 4 → 0.4), weight (hg → kg, e.g. 60 → 6.0)`
- `types` (slot order), `stats` (6 × `{stat, value}` in API order; bars scale to 255)
- `abilities` (name, hidden flag, English `short_effect` — verified present)
- `genus`: last English `genera` entry
- `flavor`: English text, first match from preference list scarlet-violet →
  legends-arceus → sword-shield → letsgo-pikachu-eevee → ultra-sun-ultra-moon →
  sun-moon → last English entry; `\n`/`\f` collapsed to spaces
- `cry`: `cries.latest` URL. Always `latest` — verified `legacy` can be `null`
  (#1025 Pecharunt). Button hidden when the URL is absent or the browser fails
  `canPlayType('audio/ogg')` (Safari).
- `evo`: chain flattened to `{id, name, condition}` nodes; condition from
  `evolution_details` (trigger name, min_level, item, held_item, time_of_day as applicable)
- `moves`: from `/pokemon/{id}.moves`, filter `version_group_details` to the latest
  version group present (e.g. scarlet-violet) with `move_learn_method.name === "level-up"`,
  sort by `level_learned_at` ascending, keep first 20 `{level, name}` + `total` count
  of that filtered set; per-move `type, power, accuracy, damage_class` resolved at
  render time from bundled `data/moves.json` (zero extra API calls)
- `weak`/`resist`/`immune`: computed from an embedded standard post-Gen-6 18×18
  chart, stored per defending type as `{x2:[], x05:[], x0:[]}` (~1 KB). Dual-type
  aggregation: multiply multipliers per attacking type; display buckets
  WEAK TO (net ×2), RESISTS (net ×0.5), IMMUNE (net ×0).
Caching: `localStorage["pj-dex-cache"]` = `{ "<id>": { t: timestamp, r: record } }`.
Budget ≤ ~3 MB serialized (not an entry count); on `QuotaExceededError` evict the
oldest 25% by `t` and retry once, else run network-only for the session.

### Tier 3: assets hotlinked, never committed
- Grid cards: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`
  (verified live), `loading="lazy"`.
- Detail: `…/sprites/pokemon/other/official-artwork/{id}.png` (verified live for
  #25 and #1025).
- Cries: `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/{id}.ogg`
  (verified live for #25 and #1025).
Rationale: no TPCI-copyrighted assets enter the repo; site already hotlinks
PokeAPI sprite fallbacks today (sprite loader with MissingNo fallback,
index.html:1114, :1206).

## 5. State

| Key | Content | Cleared by NEW JOURNEY |
|---|---|---|
| `pj-dex-seen` | JSON array of ids auto-marked on detail view | yes |
| `pj-dex-caught` | JSON array of ids toggled via caught button | yes |
| `pj-dex-cache` | trimmed detail records map | yes |

Device header shows live `SEEN n · CAUGHT n`; `pj-dex-counts` event keeps the
Trainer Card line (`SEEN x · CAUGHT y`) in sync.

## 6. UI spec

Full-screen overlay, backdrop pattern copied from `.tc-backdrop` (CSS at
index.html:280-283, markup at :656-667): fade in, panel scale-in, body scroll locked
via injected `scrollLock` hooks (Lenis-aware), Esc closes, focus trapped inside,
focus restored to opener on close. Visual: red shell device, darker screen bezels,
VT323 for readouts, Press Start 2P for headers, pixel borders consistent with
existing chips (`dex-flavor` styling precedent at index.html:171).

**Left screen (browse):** search input, type filter (single-select, using existing
type-chip visual language and `TYPES` colors at index.html:1083), generation select
(I–IX), sort toggle, seen/caught counters, chunked grid — 60 cards per chunk with an
IntersectionObserver sentinel; card = pixel sprite, `#id`, name, seen/caught ticks.
Pinned semantics: search matches case-insensitive substring on name OR id (exact or
zero-padded, e.g. `25` or `025`); filters combine with AND; default sort number
ascending; sort options number ↑↓ and A–Z.

**Right screen (detail):** official artwork, `#id NAME`, genus, cry ▶ button, type
chips, WEAK TO / RESISTS / IMMUNE readouts, flavor text in `.dex-flavor` style, six
stat bars (scale 255), height/weight (m/kg), evolution chain with trigger conditions,
level-up move table (20 shown + total), caught-toggle pokéball button. Seen
auto-marks on first view.

**Keyboard:** ← → ↑ ↓ walk grid, Enter opens detail, Esc steps back (detail → grid →
device closed). **A11y:** all controls labeled; grid follows a listbox pattern;
`aria-live="polite"` counters; sprite alt `"#025 Pikachu sprite"` /
`"#025 Pikachu official artwork"`. **Loading:** grid instant (Tier 1); detail pane
shows in-voice "LOADING DATA…" state; sprites load lazily.

## 7. Narrative integration

- **Chapter 3 beat:** after the existing 151→1025 fill animation completes, a
  dialogue box in the established format (OAK speaker label) with the verbatim
  Red/Blue quote (Bulbapedia, verified 2026-09-12; rendered with the site's
  POKéDEX styling):
  "On the desk there is my invention, POKéDEX! It automatically records data on
  Pokémon you've seen or caught!"
  followed by an **OPEN THE POKéDEX** button → `Sound.select()` → `Dex.open()`.
- **HUD:** compact dex-device SVG icon button next to the badge case, works from
  page load.
- **No gating:** the beat is the story entry; the HUD is the utility entry.
- **Voice rules:** game quotes verbatim; no em-dash constructions; no "not X but Y".

## 8. Error handling

- Offline / API down, list not yet fetched: device opens to "SIGNAL LOST…
  RECONNECT TO OAK'S NETWORK." with retry (Tier 1 fetch failure path, §4).
- Offline / API down with list present: grid fully browsable; right screen shows
  glitch panel with same SIGNAL LOST copy when no cached record exists.
- Sprite 404: deterministic glitch-block fallback (same pattern as the existing
  sprite loader fallback, index.html:1206).
- `localStorage` quota: evict oldest 25% of cache, retry once, then network-only.
- OGG unsupported or cry URL absent: cry button hidden.
- Malformed/PokéAPI-shape drift: record builder validates required fields; on
  failure render cached record if any, else SIGNAL LOST state.

## 9. Testing & verification

- `_dev/capture.py` (local tooling, gitignored along with `shots/`) extended:
  dex grid open, detail view, mobile variants. Page globals `Dex`, `Dex.isOpen()`,
  `Dex.counts()` join `awarded`/`awardBadge`/`nowSec` as preserved globals.
  Existing 24 shots unchanged.
- Browser-use pass per established workflow (serve over HTTP, measured clicks):
  open from HUD; open from Chapter 3 beat; search "pika"; filter Poison; sort;
  open detail; caught toggle; reload → cache hit (no network for visited species);
  NEW JOURNEY → counts cleared; Esc/focus-trap behavior; reduced-motion spot check.
- Oak quote verified verbatim (done, §7).
- Shipped weight grows only by `lib/pokedex.js` + `data/dex-list.json` (~31 KB).

## 10. Risks / notes

- IP posture: fan-site norm; assets hotlinked from PokéAPI CDN, nothing redistributed
  from the repo. Non-commercial personal project.
- `pj-dex-cache` ≤ ~3 MB by design; combined with the ~31 KB list and existing tiny
  `pj-*` keys this stays well under the ~5 MB localStorage quota.
- Grid perf: 1025 lazy cards, chunked render, small sprites — no virtualization
  library needed.
- PokéAPI is a community service: caching (policy-required) also keeps our request
  volume low (detail fetch happens once per species, ever, per browser).

## Appendix — Verification log (2026-09-12)

- `/pokemon/25`: `cries.{latest,legacy}`, `sprites.other.official-artwork`,
  `stats`, `moves[].version_group_details[].{level_learned_at, version_group.name,
  move_learn_method.name}`, `height=4` (dm), `weight=60` (hg) — all present.
- `/pokemon-species/25`: 147 `flavor_text_entries` (with embedded `\n`), English
  `genera`, `evolution_chain.url`, `is_legendary`/`is_mythical` — present.
- `/evolution-chain/10`: `evolves_to[].evolution_details` carries trigger, item,
  time_of_day, version_group — confirmed.
- `/pokemon/1025` (pecharunt): exists; `cries.latest` present, `legacy: null` →
  always use `latest`; artwork URL live.
- `/ability/{id}`: English `short_effect` present ("Has a 30% chance of paralyzing…").
- CDN HEAD checks (raw.githubusercontent.com/PokeAPI/sprites + /cries): HTTP 206 for
  `sprites/pokemon/25.png`, `sprites/pokemon/1025.png`,
  `other/official-artwork/1025.png`, `cries/pokemon/latest/1025.ogg`.
- CSV list build: 1025 entries; 31.3 KB minified, 9.6 KB gzipped
  (`_dev/tmp/dex-list-measured.json`, throwaway probe artifact).
- Bulbapedia Professor Oak/Quotes: RBY dex-handover line captured (§7).
