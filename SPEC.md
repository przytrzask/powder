# POWDER — MVP spec

A SkiFree-style downhill game rebuilt in 3D (inspired by https://x.com/almonk/status/2102444573016699297).

## Tech
- Vite + React + TypeScript
- three.js via React Three Fiber (+ drei), zustand for UI state
- All art is procedural low-poly geometry built in code (no model files)
- Audio: short samples synthesized at startup with Web Audio (swappable for real .wav files later)

## Look
- Near top-down camera with slight tilt, narrow FOV; skier in upper third of screen, downhill = screen bottom
- White/blue-shadowed snow with mogul bumps, low sun → long soft shadows
- Low-poly pines, snowy boulders, slalom gate flags, rainbow-striped jump ramps, decorative chairlift
- Carved ski tracks left behind the skier
- HUD: dark glass card top-right — YOUR RUN timer, distance (m), speed (km/h), style (pts)

## Controls (desktop keyboard only)
| Key | On ground | In air |
|---|---|---|
| ← / → | turn | spin |
| ↑ | brake (slow down) | flip (backflip) |
| ↓ | tuck (speed up) | flip (frontflip) |
| Space | jump | — |
| Shift | — | grab (hold) |
| Enter | start / restart | |
| Esc | pause | |

(Grab is Shift, not Cmd: macOS suppresses keyup events while Cmd is held, and Cmd combos hit browser shortcuts.)

## Rules
- One fixed-length course (map 1, seeded), start → finish line
- Ramps launch you high; Space gives a small ollie anywhere
- Tricks: spins (per 180°), flips (per 360°), corks (flip + spin), shifty (~90° twist and back, no spin), grabs (per held time). Must land with skis roughly aligned with travel direction, upright, and not grabbing — otherwise it's a crash
- Clean landings add tricks to a **combo pot**; each extra trick in the chain raises the multiplier. The pot banks into Style after ~2.5 s of clean riding
- **Crash** (hit tree/rock/lift pole, or bad landing): lose the unbanked pot, tumble briefly, speed cut heavily → next trick is harder
- Passing between gate flags: small style bonus
- Finish: final score = style + time bonus (faster = more)

## Screens
- Title: POWDER, New game button, controls legend
- In run: HUD, trick/combo popup, pause overlay
- Results: time, style, time bonus, total, best (localStorage), New game

## After MVP (not now)
Yeti, NPC skiers/snowboarders/dogs, moving chairlift, more maps, mobile/touch, endless mode.
