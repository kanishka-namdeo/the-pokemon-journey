# Color palette analysis

Assessment note, 2026-09-15. Companion to `ultrawide-assessment.md` and `scrollytelling-topic-research.md`.
Method: two parallel subagents, one extracted every color value in the project (index.html monolith, lib/pokedex.js, data/, spec docs), the other researched franchise canon and dark-theme best practice. Contrast figures below are WCAG 2.1 relative-luminance arithmetic, computed by `_dev/tmp/palette-contrast.mjs` (gitignored scratch; re-runnable). Web source fetches were network-blocked during the research pass, so franchise brand hexes are treated as era-variable reference values, and the type-color set is judged against the standard in-game reference (Bulbapedia / Smogon / Showdown) cross-checked by three independent paths.

## Status (2026-09-15, same day)

Recommendations 1, 2, 3, 4, 6 and 7 are implemented and verified (all contrast pairs re-asserted by `_dev/tmp/verify-fixes.mjs`, 12/12 dex probe checks, targeted stills in `shots/palette-*.png`); uncommitted. Deviations from the original text, all found while implementing:

- **Rec 5 (sign subtitle) was a misattribution.** The h2 sits on the board fill `#1E6B3A` (5.43:1, passes); `#2E8B50` is only the 2px inset ring, never behind the text. No change made; table row 6 corrected below.
- **Static `.typechip` row** (index.html:903, types chapter dialogue) carried its own hand-written copies of the old GROUND/STEEL hexes and inherited one dark text color; fixed to the canonical values plus light text on the five dark types.
- **Hover state** deepened to `#E0181A` (4.78:1), not just the base face (`--red-deep: #D50F12`, 5.28:1).
- **Dimming mechanism** is `color-mix(in srgb, var(--tc) 85%, #060913)` on the fill only (with a solid-fill fallback via `@supports not`), replacing the whole-element `opacity:.55`. The chip label mapping is shared: `DARK_TEXT` set in index.html (13 types take dark ink), pokedex.js consumes the optional `text` field with a `#0F1220` fallback, so the probe's older `Dex.init` calls still work.
- **Wheel label ink** deepened `#1D232E` to `#0A0C16` (both are already in the palette family) so WATER/PSYCHIC labels clear 4.5:1 under the scene's 0.88 alpha.

## 1. The palette, as it actually is

- **Base frame.** Ink navy `#0F1220` (body) and `#17171F` (borders, rings, ink text on light fills) against cream paper `#FFFDF4` and warm dim `#EFE9D8`. No pure black anywhere.
- **Accents.** `--red #EE1515` (Poké Ball / buttons / KANTO), `--yellow #FFCB05` (the workhorse accent: selection, focus, HUD brand, progress bar, dex lights), `--blue #3B4CCA` (logo shadow, focus outline on the dex CTA, "GOTCHA!" drop shadow).
- **Dex device slate.** Shell `#E23636 → #B01010` over `#7C0A0A` border; screens `#101425` / `#060913` with border `#2A2F4A`; screen text `#D7E4FF`, muted `#6E7BAE`, highlight `#7FD1FF`, caught/immune tints `#FF9D9D` / `#9AE6B4`; D-pad `#2A2F4A` on `#14182B`.
- **Type map.** The single `TYPES` array at index.html:1563 drives the types-scene wheel, the finale starter chips, and (via `Dex.init`) every chip in lib/pokedex.js. 18 official chart colors plus 9 generation colors, 8 Eevee colors, the starter tint map, and 10 scene tints.
- **Dead tokens.** `--green` and `--dmg0…3` are defined at :root and never consumed; the dmg scene hardcodes the same four DMG hexes as literals. `--yellow` is additionally rewritten at runtime to the chosen starter's type color (Grass `#78C850` / Fire `#F08030` / Water `#6890F0`).

## 2. Franchise alignment

**Type colors: 16 of 18 exact, two typos.** Against the standard modern in-game chart (Normal `#A8A878`, Fire `#F08030`, Water `#6890F0`, Electric `#F8D030`, Grass `#78C850`, Ice `#98D8D8`, Fighting `#C03028`, Poison `#A040A0`, Ground `#C0A868`, Flying `#A890F0`, Psychic `#F85888`, Bug `#A8B820`, Rock `#B8A038`, Ghost `#705898`, Dragon `#7038F8`, Dark `#705848`, Steel `#B8A0C8`, Fairy `#EE99AC`):

- `GROUND` is `#E0C068` in the site, canonical is `#C0A868`. Off by two digits, visibly more yellow/sandy-bright than the chart.
- `STEEL` is `#B8B8D0`, canonical is `#B8A0C8`. Off, visibly bluer than the chart's silvery purple.
- Every other type matches exactly, including Flying `#A890F0` (one subagent flagged that as a deviation against a stray `#A98FF3` value; that value is not the canonical one and the site is correct). The 16-for-16 exact match is itself strong confirmation the reference set is right.

Both deviations propagate: types-scene wheel chips, the finale starter cards, and every pokedex.js filter/detail/move chip. A two-line fix.

**The DMG scene is canonically exact.** `#9BBC0F / #8BAC0F / #306230 / #0F380F` is the standard Game Boy monochrome-green four-shade palette, used here in the classic light-to-dark order. This is the most precisely "franchise-correct" palette on the site.

**Red.** No official The Pokémon Company style sheet with hex values is published; cited values range across eras (PMS 179 C ≈ `#D80027`, GBC-era ≈ `#E4002F`, modern web ≈ `#FF0021`). The site's `#EE1515` sits squarely in that band and reads unmistakably as "Pokémon red" next to the white `#F4F4F4` and ink `#17171F` ball construction. It is also self-consistent: KANTO's generation color is the same `#EE1515`.

**Yellow.** `#FFCB05` is a slightly muted take on the GBC title yellow (`#FFE400`). The deliberate warm-cream direction (paper `#FFFDF4`, gold gradient end `#EDA400`, honey highlight `#FFE9A8`) is a coherent retro-card system rather than a miss, and it keeps the accent from vibrating against the dark base.

**Blue.** `#3B4CCA` is used only decoratively (shadows, outlines). The actual Water blue appears as `#6890F0` in the type map, so no blue ambiguity. Good discipline.

**Pokédex device.** The red shell with bezel screws, grill, and blue lens matches the iconic Gen 1-3 red Pokédex family rather than the silver/black Gen 4-9 hardware. On a dark page the red device reads better than beige, and the blue lens is a nice Poké Ball nod. The slate screen set is a modern-twist choice, not a game-UI derivative.

## 3. Best-practice audit

### What holds up

- Base and body text: `#FFFDF4` on `#0F1220` = 18.3:1, AAA with margin. Near-black navy instead of pure black avoids halation.
- Accent ratio: yellow covers roughly 10% of surface (selection, focus ring, progress bar, HUD brand mark, device lights) against a 60% dark base and 30% cream/scene surfaces. Standard 60/30/10 behavior.
- Every `--yellow` accent site sits on dark (11.2 to 12.2:1). Even the runtime starter overrides pass on the base: Grass 9.02, Fire 6.95, Water 6.06.
- The dex device screen set is well tuned: primary text 14.3:1, yellow on the dark screen 13.1:1, effect tints 10 to 13.6:1.
- Type semantics are never color-alone: chips carry labels, wheel chips carry names, generation bands carry text. Color-blind users lose hue, not meaning.

### Failing pairs (WCAG 2.1, ranked by severity)

| # | Pair | Where | Ratio | Threshold | Verdict |
|---|---|---|---|---|---|
| 1 | Paper text `#FFFDF4` on red button `#EE1515` | `.themebtn`, `.dexcta` (9 to 10px pixel font) | 4.34 | 4.5 AA | Fail. Hover `#FF4040` drops to 3.40 |
| 2 | Unselected dex type chips | `.dex-typechip` at `opacity:.55` on screen `#060913` | 1.6 to 4.3 across all 18 | 4.5 AA | Fail, all 18. Opacity dims text and fill together |
| 3 | Selected chips, 5 dark types | pokedex.js uses one dark text `#0F1220` for all types; Fighting 3.28, Poison 3.31, Ghost 3.14, Dragon 3.20, Dark 2.82 | 4.5 AA | Fail on 5 of 18 |
| 4 | Wheel labels, 6 mid types | LIGHT_TYPES splits text light/dark on brightness; light text on Fire 2.48, Water 2.84, Grass 1.91, Flying 2.45, Psychic 2.88, Rock 2.39 | 4.5 AA | Fail on 6 of 18 (canvas diagram, lower severity) |
| 5 | Muted screen text `#6E7BAE` on `#101425` | `.dex-empty`, nav position, move table headers, ability notes | 4.45 | 4.5 AA | Hairline fail |
| 6 | Focus outline `#3B4CCA` on `#0F1220` | `.dexcta:focus-visible` dashed outline | 2.72 | 3:1 non-text | Fail (meets 2:1 focus-appearance but not 3:1) |
| 7 | Generation labels KANTO 4.03 / UNOVA 4.22 / PALDEA 4.28 | dex scene bands on `#17171F` | ≥3:1 | 4.5 AA | Pass as large text on desktop (26px VT323). Falls to normal-text size below ~18.66px on narrow screens, where KANTO/UNOVA/PALDEA drop under 4.5 |
| 8 | "z" sleep glyph `#5E718A` on base | go scene | 3.73 | 4.5 | Fail, but decorative glyph; acceptable |
| 9 | DMG mid shade `#306230` on `#0F380F` | Game Boy screen emulation | 1.83 | any | Correct in-character: the real DMG hardware had the same low in-screen contrast |

### Housekeeping findings

- `--green`, `--dmg0…3` are dead (defined, never consumed; the dmg scene hardcodes identical hexes).
- `--yellow` is semantically renamed at runtime by the starter pick. A token called yellow that becomes green/orange/blue is a maintenance trap for future contributors.

## 4. Recommendations, ranked

All candidate values below were computed, not guessed.

1. **Fix GROUND and STEEL in `TYPES`** (index.html:1566-1568): `#C0A868` and `#B8A0C8`. Two-line franchise-fidelity fix; everything downstream (wheel, dex chips) corrects itself.
2. **Darken the CTA red** so `.themebtn`/`.dexcta` text passes: `#E01010` gives 4.85:1, `#D50F12` gives 5.28:1 (the latter is also the PMS 179 franchise-red region). Introduce a `--red-deep` for buttons if the Poké Ball and KANTO color should keep `#EE1515`. Darken the hover state the same way (`#FF4040` currently 3.40:1).
3. **Fix the dex type-chip text strategy**: compute a per-type label color by luminance (dark text on the 13 light types, light text on Fighting, Poison, Ghost, Dragon, Dark; the corrected GROUND and STEEL both take dark text at 8.02:1 and 7.89:1 respectively) and share that mapping between the wheel and pokedex.js. Then stop applying `.55` opacity to the whole unselected chip: dim the fill only (or use a transparent fill with a type-colored border) so the label keeps full contrast.
4. **Muted slate**: `#6E7BAE` to `#8494C0` (6.07:1 on the L screen) or `#7A87B5` (5.19:1) for the hairline failure in #5.
5. **Sign subtitle: no change needed.** The h2 sits on the board fill `#1E6B3A` (5.43:1, passes); `#2E8B50` is only the 2px inset ring. Verified during implementation.
6. **Focus outline**: `#3B4CCA` to `#5566E8` (3.95:1) or reuse the verified `#8FB6FF` (9.14:1).
7. **Optional housekeeping**: delete or wire up `--green` and `--dmg0…3`; rename `--yellow` to `--accent` with a comment that the starter pick rewrites it; consider one large-text rule (≥24px) for the generation labels on narrow viewports or accept the mobile 4.5 shortfall for KANTO/UNOVA/PALDEA.

## 5. Caveats

- No live source fetches succeeded (network-blocked session). Franchise brand red/yellow/blue are era-variable reference values, not official published hexes; do not cite them as "official" in attribution surfaces.
- The canonical type set is cross-verified by three independent paths and by the site's own 16 exact matches; the two deviations are clear digit drift, not alternative generations of the chart.
- Contrast math models the documented CSS states (including the `.55` chip opacity and the `.88` wheel alpha composites). Hover/focus/pressed states beyond those tested should be spot-checked if a recommendation is implemented.
