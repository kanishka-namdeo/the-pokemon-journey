# data/ — Bundled Dex Data

## Purpose

- Runtime Pokemon data: per-species detail JSON (`details/`), national dex list (`dex-list.json`), move metadata (`moves.json`), plus the generator scripts that produce them.
- The site is fully offline — everything here is committed; there are no runtime API calls.

## Ownership

- Everything is generated output except the two generator scripts, which own the data shape.

## Local Contracts

- `details/*.json`, `dex-list.json`, `moves.json` are generated — never hand-edit; regenerate instead.
- `generate-dex-list.mjs` regenerates `dex-list.json` + `moves.json` (run first when a new Pokemon generation lands). `generate-dex-details.mjs` (`npm run sync:dex`) fetches per-species details and also writes `../sprites/dex/` and `../audio/cries/` (cries saved codec-accurately, `.ogg` or `.mp3` by sniffed container; a no-network sync also self-heals record cry paths after renames).
- Detail record shape (consumed via `buildRecord` in ../lib/pokedex.js): id, name, genus, flavor, types, stats, abilities, height, weight, cry, evo, moves, weak, resist, immune.
- Changing `buildRecord` in lib/pokedex.js requires regenerating the data to take effect.

## Work Guidance

- Sync missing species: `npm run sync:dex`. Force refetch all: `node data/generate-dex-details.mjs --force`. Subset: `--ids=25,152`.
- Sync needs network and is slow across all 1025 species — prefer incremental runs.

## Verification

- `dex-list.json` has 1025 entries; the generator's sanity gates (bulbasaur, pikachu, pecharunt) pass.
- `details/` holds one `{id}.json` per species; `moves.json` includes thunderbolt (power 90).
- Dex works with PokeAPI unreachable — `python _dev/dex_probe.py` includes offline-handling checks.

## Child DOX Index

- None — leaf.
