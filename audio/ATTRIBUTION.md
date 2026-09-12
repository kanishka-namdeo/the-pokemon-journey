# Audio Attribution

All audio in this folder is licensed under **Creative Commons CC0 1.0 (Public Domain Dedication)** —
free to use for any purpose, no attribution required. We credit the authors anyway, because it's kind.

## Sound effects — `audio/sfx/`

From **"The Essential Retro Video Game Sound Effects Collection [512 sounds]"** by
**Juhani Junkala** (aka SubspaceAudio).

- Source: https://opengameart.org/content/512-sound-effects-8-bit-style
- License: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
- Files used (renamed from the pack):
  - `select.wav` ← `General Sounds/Menu Sounds/sfx_menu_select2.wav`
  - `hover.wav` ← `General Sounds/Menu Sounds/sfx_menu_move3.wav`
  - `coin.wav` ← `General Sounds/Coins/sfx_coin_double2.wav`
  - `badge.wav` ← `General Sounds/Fanfares/sfx_sounds_fanfare1.wav`
  - `gotcha.wav` ← `General Sounds/Positive Sounds/sfx_sounds_powerup1.wav`
  - `pick.wav` ← `General Sounds/Positive Sounds/sfx_sounds_powerup16.wav`
  - `wipe.wav` ← `Movement/Portals and Transitions/sfx_movement_portal4.wav`
  - `zap.wav` ← `Weapons/Lasers/sfx_wpn_laser5.wav`
  - `pet.wav` ← `General Sounds/Weird Sounds/sfx_sound_bling.wav`
  - `error.wav` ← `General Sounds/Negative Sounds/sfx_sounds_error2.wav`
  - `poke.wav` ← `General Sounds/Interactions/sfx_sounds_interaction13.wav`

## Music — `audio/music/`

From the **"Retro Game Music Pack" (5 Action Chiptunes)** by **Juhani Junkala**.

- Source: https://opengameart.org/content/5-chiptunes-action
- License: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
- The originals are 44.1 kHz stereo WAVs; these copies were downsampled to
  22.05 kHz mono (FIR low-pass + decimate) to keep the repository lean —
  see `_dev/resample.js`.
- Files used (renamed from the pack):
  - `title.wav` ← `Juhani Junkala [Retro Game Music Pack] Title Screen.wav`
  - `route.wav` ← `Juhani Junkala [Retro Game Music Pack] Level 1.wav`
  - `dex.wav` ← `Juhani Junkala [Retro Game Music Pack] Level 2.wav`
  - `finale.wav` ← `Juhani Junkala [Retro Game Music Pack] Level 3.wav`

## Theme song — `audio/music/theme-open.wav`, `audio/music/theme-full.wav`

From **"Theme Song [8-bit]"** on OpenGameArt.

- Source: https://opengameart.org/content/theme-song-8-bit
- License: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/
- The originals are 44.1 kHz stereo WAVs, downsampled to 22.05 kHz mono
  like the tracks above.
- Files used (renamed from the pack):
  - `theme-open.wav` ← `Theme Song 8-bit V1 _opening.wav` (the 15 s TV-intro
    sting — plays when the Trainer Card appears)
  - `theme-full.wav` ← `Theme Song 8-bit V1 _looping.wav` (the full 74 s
    theme — plays from the credits button)

## Pokémon cries (`cries/`)

The 1025 species cries in `cries/` are fetched from PokéAPI by
`data/generate-dex-details.mjs` (`npm run sync:dex`) and played by the Pokédex
device's CRY button. They are Nintendo IP, bundled here as dataset copies for
the offline dex rather than redistributable originals.

## Deliberately *not* used

The Poké Flute theme and other series music are Nintendo IP and are not
redistributable — those moments use this site's own Web Audio synthesized
chiptunes instead (`Sound` object in `index.html`).
