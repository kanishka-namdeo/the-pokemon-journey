# Pokédex Feature — Design Spec

Date: 2026-09-12
Status: Approved in brainstorming, pending implementation plan
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
  Self-contained; dependencies injected at init: `Dex.init({ Sound, TYPES })`.
- `index.html` touch points (nothing else grows):
  1. `<script src="lib/pokedex.js">` tag placed after the existing inline app script
     (so the inline script's final lines can call `Dex.init({...})` and bind the HUD
     button / Chapter 3 beat to `Dex.open()`); the module waits for DOM readiness
     before binding anything.
  2. HUD dex button in `.hud-right` (index.html:314 area), aria-label "Open Pokédex".
  3. Modal shell markup: `#dex-backdrop` > `#dex-device` (`role="dialog"`,
     `aria-modal="true"`, `aria-label="Pokédex"`), `hidden` by default.
  4. `Dex.init({...})` call.
- All dex CSS in one labeled block appended to the existing stylesheet (~200 lines):
  red shell, bezels, VT323 readouts, pixel borders; `prefers-reduced-motion` disables
  CRT/scanline flourishes.
- New file `data/dex-list.json` (see §4).

## 4. Data strategy — three tiers

### Tier 1: bundled list (`data/dex-list.json`, ~50 KB)
`[{ "id": 1, "name": "bulbasaur", "types": ["grass","poison"] }, …]` for all 1025,
generated once from PokéAPI's `data/v2/csv` sources. Generation derived from id ranges
at runtime. Loaded lazily on first dex open (never by visitors who don't open it).
Powers search, type filter, gen filter, sort, and the grid with zero network calls.

### Tier 2: lazy detail records
Opening a species fetches, in parallel: `/pokemon/{id}`, `/pokemon-species/{id}`,
and the linked `/evolution-chain`. Trimmed to a UI record (~4–10 KB):
id, name, genus (latest English), flavor text (latest English version), 6 base stats,
types, abilities (name, hidden, short effect), height, weight, cry URL
(`cries.latest`), evolution chain (ids, names, trigger conditions), first ~20
latest-gen level-up moves (level, name, type, power, accuracy, damage class), and
total move count. Type effectiveness (weak to / resists) computed client-side from an
embedded compact 18×18 chart (~1 KB).
Caching: `localStorage["pj-dex-cache"]`, one JSON map keyed by id with per-record
timestamp. Cap ~400 records; on quota error evict oldest entries and retry once,
then degrade to network-only for the session.

### Tier 3: assets hotlinked, never committed
- Grid cards: 96px pixel sprite `raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`, `loading="lazy"`.
- Detail: official artwork `…/sprites/pokemon/other/official-artwork/{id}.png`.
- Cries: `cries.latest` .ogg from PokéAPI.
Rationale: no TPCI-copyrighted assets enter the repo; site already hotlinks
PokeAPI sprite fallbacks today. Cry button hidden when `canPlayType('audio/ogg')`
reports no support (Safari).

## 5. State

| Key | Content | Cleared by NEW JOURNEY |
|---|---|---|
| `pj-dex-seen` | JSON array of ids auto-marked on detail view | yes |
| `pj-dex-caught` | JSON array of ids toggled via caught button | yes |
| `pj-dex-cache` | trimmed detail records map | yes |

Device header shows live `SEEN n · CAUGHT n`. Trainer Card gains one line under the
existing POKéDEX stat: `SEEN x · CAUGHT y` (live-updated while open).

## 6. UI spec

Full-screen overlay, backdrop pattern copied from `.tc-backdrop` (index.html:261-284):
fade in, panel scale-in, body scroll locked, Esc closes, focus trapped inside, focus
restored to opener on close. Visual: red shell device, darker screen bezels, VT323
for readouts, Press Start 2P for headers, pixel borders consistent with existing chips.

**Left screen (browse):** search input (name or dex number), type filter using
existing type-chip visual language and `TYPES` colors, generation select (I–IX),
sort toggle (number ↑↓, A–Z), seen/caught counters, chunked grid — 60 cards rendered
per chunk with an IntersectionObserver sentinel; card = pixel sprite, `#id`, name,
seen/caught tick marks.

**Right screen (detail):** official artwork, `#id NAME`, genus, cry ▶ button, type
chips, "WEAK TO" / "RESISTS" readouts, flavor text in `.dex-flavor` style, six stat
bars, height/weight, evolution chain with trigger conditions, move table + total
count, caught-toggle pokéball button. Seen auto-marks on first view.

**Keyboard:** ← → ↑ ↓ walk grid, Enter opens detail, Esc steps back/closes.
**A11y:** all controls labeled; grid is a listbox-pattern widget; `aria-live="polite"`
on counters; sprite alt text `"#025 Pikachu official artwork"`.
**Loading:** grid instant (Tier 1); detail pane shows an in-voice "LOADING DATA…"
state; list card sprites load lazily.

## 7. Narrative integration

- **Chapter 3 beat:** after the existing 151→1025 fill animation completes, a
  dialogue box in the established format (OAK speaker label): "Here, take this too!
  It's a POKéDEX. Using it, you can record data on Pokémon you've seen or caught."
  + **OPEN THE POKéDEX** button → `Sound.select()` → opens device. Quote to be
  verified verbatim against Bulbapedia during implementation (site voice rule:
  game quotes verbatim, minimal em-dashes, no "not X but Y").
- **HUD:** compact dex-device SVG icon button next to the badge case, works from
  page load.
- **No gating:** the beat is the story entry; the HUD is the utility entry.

## 8. Error handling

- Offline / API down with no cache: right screen shows MissingNo-style glitch panel:
  "SIGNAL LOST… RECONNECT TO OAK'S NETWORK." Grid remains fully browsable (Tier 1).
- Stale cache: cached record renders immediately; no background refresh (records are
  static game data).
- Sprite 404: deterministic glitch-block fallback (same pattern as existing
  `drawSprite` fallback, index.html:1166-1179).
- `localStorage` quota: evict oldest, retry, then network-only session.
- OGG unsupported: cry button hidden.

## 9. Testing & verification

- `_dev/capture.py` extended: dex grid open, detail view, mobile variants. Page
  globals `Dex` plus state getters join `awarded`/`awardBadge`/`nowSec` as preserved
  globals. Existing 24 shots unchanged.
- Browser-use pass per established workflow (serve over HTTP, measured clicks):
  open from HUD; open from Chapter 3 beat; search "pika"; filter Poison; sort;
  open detail; caught toggle; reload → cache hit (no network for visited species);
  NEW JOURNEY → counts cleared; Esc/focus-trap behavior; reduced-motion spot check.
- Verify Oak quote verbatim against Bulbapedia.
- No new shipped weight beyond `lib/pokedex.js` + `data/dex-list.json`; shots/ not shipped.

## 10. Risks / notes

- IP posture: fan-site norm; assets hotlinked from PokéAPI CDN, nothing redistributed
  from the repo. Non-commercial personal project.
- `pj-dex-cache` growth bounded (~400 × ~10 KB ≈ 4 MB) under the ~5 MB localStorage
  budget; site currently stores almost nothing else.
- Grid perf: 1025 lazy cards, chunked render, small sprites — no virtualization
  library needed.
