# Ultrawide assessment — the-pokemon-journey

**Viewport tested:** 3440×1440 (21:9) and 5120×1440 (32:9) via Playwright.
**Stills:** `shots/uw/` (gitignored throwaway).

## TLDR

The site is **height-bounded** in every scene: art size = `Math.min(w, h) * k`. At ultrawide the art stays the same size it would be at a 16:9 screen of the same height, and the extra width becomes flat-color dead space. Nothing breaks, nothing overflows, but the experience feels *small* on a big screen — text columns drift to the far walls, the canvas renders millions of pixels of empty background, and the compositional relationship between text and art stretches to the point of disconnection.

**Recommendation:** cap the effective layout width at ~1920px for text positioning and art composition, while letting the canvas stay full-width so the background gradient/stars/grass fill the screen. This is a "cinematic letterbox" approach — the content stays composed for a sensible aspect ratio, the screen edges carry ambient atmosphere.

---

## Per-chapter findings (3440×1440)

| Chapter | Art position | Text position | Verdict |
|---------|-------------|---------------|---------|
| **Hero** | Centered, `min(w,h)*0.24` ball | Centered | **Good** — centered composition holds at any width. Stars fill the width. |
| **Origin** | `w*0.43` (roughly center), height-bounded Game Boys | Far left, `max-width:32.5rem` | **Dead space** — ~1000px of flat green on the right. Text is readable but visually disconnected from the art. |
| **Catch** | `w*0.62` (right of center), ball arc | Far left | **Dead space** — huge void between text and the rattata/ball action. |
| **Dex** | `w*0.27` (left of center), height-bounded ball | Far right | **Dead space** — counter at `w*0.68`, mascots at `w*0.50`, text at far right. All three clusters are isolated islands. |
| **Types** | `w*0.62`, clamped to not overlap text column | Far left | **OK** — the wheel is clamped away from the text, but there's ~800px of void on the right. |
| **Eevee** | `w*0.63`, height-bounded eevee + branches | Far left | **Dead space** — branches radiate from center-right, text is on the far left wall. |
| **Go** | `w*0.5` (center), phone map | Far left | **Dead space** — phone is centered, text is far left. |
| **Hof** | Full-width rainbow staircase | Far left | **Good** — the art already spans the width. Counters at `w*0.52` and `w*0.80` still read well. |
| **Lab** | Centered lamp, window at `w*0.12`, shelf at `w*0.68` | Centered | **Good** — centered composition. |
| **Finale** | Centered balls | Centered | **Good** — centered composition. |
| **Credits** | — | Centered, `max-width:36rem` | **Good** — centered text. |

### Overlays (route map, dex device, trainer card)

All three are modal overlays with `width: min(92vw, Npx)` and centered via flex. At ultrawide they stay at their max size (470px / 1080px / 430px) and center themselves. **No issues.**

### HUD

- Badge case, route map button, dex button, sound button: all at the far right, `padding: 0 clamp(12px, 3vw, 28px)` → clamped to 28px at ultrawide. Reachable but feels disconnected from the center action.
- Brand (pokéball + "POKéMON · THE JOURNEY"): far left, same padding. Fine.

---

## Root causes

1. **Height-bounded art composition.** Every scene sizes its key elements from `m = Math.min(w, h)`. This is the right call for portrait/landscape adaptivity, but at ultrawide it means the art occupies roughly the center `h×h` square and the rest is flat color.

2. **Text columns pinned to viewport edges.** `.step:nth-child(odd){justify-content:flex-start}` and `.step:nth-child(even){justify-content:flex-end}` push text to the far left or far right of the viewport. At 3440px, "far left" means 20px from the left edge — the text is no longer visually adjacent to the art.

3. **Canvas renders at full resolution.** `ch.canvas.width = r.width * dpr` where `r.width` is the full viewport width. At 3440×1440 with DPR 2, that's 6880×2880 actual pixels — most of which are flat color fills. GPU work for nothing.

4. **No max-width containment.** The body has `overflow-x: hidden` but no max-width. The content stretches to fill the viewport, which is the right call up to ~1920px but breaks the composition beyond that.

---

## Fix proposals

### Option A: Cinematic letterbox (recommended)

Cap the effective layout width at ~1920px. The canvas stays full-width so the background fills the screen, but the art composition and text columns are constrained to a centered band.

**CSS changes:**

```css
/* Ultrawide containment — keep the composition sane beyond 1920px */
@media (min-width: 1920px) {
  .steps {
    max-width: 1920px;
    margin-left: auto;
    margin-right: auto;
    padding-left: 64px;
    padding-right: 64px;
  }
  /* Text columns stay near the art, not at the far walls */
  .step:nth-child(odd) { justify-content: flex-start; }
  .step:nth-child(even) { justify-content: flex-end; }
  /* The step content max-width stays 32.5rem — that's fine */
}
```

**JS changes (scene composition):**

Cap the effective width used for art positioning. The canvas still renders at full width, but the art is composed as if the viewport were 1920px wide, centered in the actual viewport.

```js
// In each scene's draw() function, replace:
//   const w = ch.w, h = ch.h;
// with:
const MAX_LAYOUT_W = 1920;
const layoutW = Math.min(ch.w, MAX_LAYOUT_W);
const layoutOffsetX = (ch.w - layoutW) / 2;
// Then use layoutW for art positioning and add layoutOffsetX to x coordinates.
```

This is a mechanical change across all 9 scenes. The background fills (stars, grass, gradient) still use the full `ch.w` so they extend to the edges.

**Pros:**
- Minimal visual disruption — the composition stays as designed.
- Text stays near the art.
- GPU work is reduced (art is drawn in a smaller region, though the canvas is still full-size).
- Matches how cinematic sites (Apple product pages, film promo sites) handle ultrawide.

**Cons:**
- The screen edges are "wasted" — but they carry ambient atmosphere (stars, gradient, grass).
- Requires changes to every scene's draw() function.

### Option B: Expand art to fill width

Let the art grow with the viewport width. Remove the `Math.min(w, h)` cap and use `w` directly for sizing.

**Pros:**
- Uses the full screen real estate.
- No dead space.

**Cons:**
- Breaks every scene's composition. The Game Boys, the dex ball, the eevee branches, the type wheel — all designed for a roughly square aspect ratio.
- Text would need to be repositioned for every chapter.
- Massive rework with uncertain visual payoff.

**Verdict:** Not worth it. The art is deliberately composed for a square-ish viewport.

### Option C: Ambient width-filling

Keep the height-bounded art but add more ambient elements at the edges — wider grass rows, more stars, extended ground planes, parallax layers.

**Pros:**
- The dead space becomes atmospheric rather than empty.
- Some scenes already do this (stars fill width, grass fills width).

**Cons:**
- Doesn't solve the text-column drift problem.
- Adds GPU work for decorative elements.
- Partial fix — the core composition issue remains.

**Verdict:** Good as a complement to Option A, not as a standalone fix.

---

## Recommended implementation plan

1. **Add ultrawide containment CSS** — cap `.steps` at 1920px, centered. This fixes the text-column drift immediately with one CSS rule.

2. **Cap scene composition width** — add `MAX_LAYOUT_W = 1920` to each scene's draw() function. The canvas stays full-width for background fills, but the art is composed within the centered band.

3. **Add ambient edge elements** — extend the grass rows, star fields, and ground planes to fill the full width. This is optional polish.

4. **HUD at ultrawide** — consider moving the badge case and action buttons closer to center at ultrawide widths, or keep them at the edges (they're reachable either way).

5. **Test at 3440×1440 and 5120×1440** — verify the composition holds and there's no horizontal overflow.

---

## Files to touch

- `index.html` — CSS media query for ultrawide containment, JS changes to scene draw() functions.
- `_dev/capture_ultrawide.py` — already written, captures stills for verification.

---

## Notes

- The site already handles mobile well (max-width: 760px and 370px breakpoints). Ultrawide is the missing end of the spectrum.
- The dex device, route map, and trainer card overlays are already well-behaved at ultrawide (modal, centered, max-width constrained).
- The Hall of Fame chapter already looks great at ultrawide — the rainbow staircase spans the full width and the counters are well-positioned. This chapter could be a reference for how other chapters might expand if we ever pursue Option B.
