# lib/ — Site JavaScript

## Purpose

- Custom and vendored browser JS for the single-page site: one custom module (`pokedex.js`) plus vendored third-party animation/scroll libraries.
- Loaded by plain `<script>` tags in index.html. No bundler, no build step.

## Ownership

- `pokedex.js` is project code — editable.
- All `*.min.js` files are vendored third-party (GSAP 3.15.0 + plugins, Lenis) — frozen.

## Local Contracts

- Script load order in index.html is fixed: `gsap.min.js` → GSAP plugins (ScrollTrigger, SplitText, ScrambleTextPlugin, Physics2DPlugin, MotionPathPlugin) → `lenis.min.js` → `pokedex.js`. All carry the `defer` attribute and must keep it; the inline `boot()`/`Dex.init` calls wait for DOMContentLoaded, so order and global availability are preserved. Do not reorder.
- Browser globals other code depends on: `window.gsap`, `window.ScrollTrigger`, `window.Lenis`, `window.Dex`. index.html feature-detects (`HAS_GSAP`/`HAS_LENIS`) and degrades to native scroll + IntersectionObserver — keep that degradation working.
- `pokedex.js` must stay DOM-free at module top level and keep the Node export block at the bottom (`TYPE_ORDER`, `TYPE_CHART`, `typeMatchup`, `buildRecord`, `filterList`, `createCache`, ...). Node tests require the file directly.
- `Dex.init({ Sound, TYPES, scrollLock })` must run before `Dex.open()`. `TYPES` is an array of type objects (name + color, optional `text` chip-label ink), not a bare array of arrays; pokedex.js falls back to `#0F1220` when `text` is absent, so callers that omit it keep working — see ../data/AGENTS.md.
- pokedex.js binds the device markup by hook: ids `#dexBackdrop #dexDevice #dexCounts #dexClose #dexDetail #dexGrid #dexSentinel #dexSearch #dexGen #dexSort #dexTypes #dexClear #dexBtnA #dexBtnB`, the `.dex-dpad [data-dpad]` buttons, and the `.dex-loading` / `.dex-noresults` classes toggled on `.dex-left` — keep index.html and the module in sync on any restructure. It also toggles `.dex-detail-open` on `#dexDevice` while a Pokémon is selected (mobile one-screen mode switch; CSS-only on desktop).
- New GSAP plugin: add its script tag in index.html and register it via `gsap.registerPlugin()` before use.

## Work Guidance

- Keep `pokedex.js` dual-target on every change: browser global `window.Dex` plus Node exports.
- Changing the detail-record shape means bumping `CACHE_KEY` in pokedex.js AND adding the old key to the NEW JOURNEY reset list in index.html — two separate hardcoded lists; update both.
- Never modify vendored `*.min.js`; update by replacing the whole file from upstream.
- New dex/device logic that needs Node tests goes here (not inline in index.html).

## Verification

- `node --test _dev/tests/*.test.js` — dex logic tests import lib/pokedex.js directly.
- `python _dev/dex_probe.py` — browser integration checks against the live device.
- Manual browser smoke: dex opens from the header button, animations run, smooth scroll works.

## Child DOX Index

- None — leaf.
