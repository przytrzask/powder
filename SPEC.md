# POWDER — MVP spec

A top-down freestyle ski game in 3D (inspired by https://x.com/almonk/status/2102444573016699297).

## Tech

- Vite + React + TypeScript
- three.js via React Three Fiber (+ drei), zustand for UI state
- All art is procedural low-poly geometry built in code, except the skiers: low-poly models built by Blender scripts (`art/skier*.py` → `public/models/*.glb`, shared rig in `art/lowpoly.py`), one mesh per animated part, flat vertex colours
- Audio: short samples synthesized at startup with Web Audio (swappable for real .wav files later)

## Look

- Camera modes (C / title & pause screens, remembered in localStorage):
  - Classic: near top-down with slight tilt, narrow FOV; skier in upper third of screen, downhill = screen bottom
  - Chase: third person behind the skier, follows the heading (not spins/flips), fog hides the map edge; ←/→ stay screen-relative
- White/blue-shadowed snow with mogul bumps, low sun → long soft shadows
- Low-poly pines, snowy boulders, slalom gate flags, rainbow-striped jump ramps, decorative chairlift
- Each kicker has a flagged run-in: pairs of pennants that narrow toward the lip and point downhill; colour = size (green small, blue medium, black big)
- Carved ski tracks left behind the skier
- HUD: dark glass card top-right — YOUR RUN timer, distance (m), speed (km/h), style (pts)

## Controls (desktop keyboard only)

| Key   | On ground         | In air           |
| ----- | ----------------- | ---------------- |
| ← / → | turn              | spin             |
| ↑     | brake (slow down) | flip (backflip)  |
| ↓     | tuck (speed up)   | flip (frontflip) |
| Space | jump              | —                |
| Shift | —                 | grab (hold)      |
| Enter | start / restart   |                  |
| C     | switch camera     |                  |
| Esc   | pause             |                  |

(Grab is Shift, not Cmd: macOS suppresses keyup events while Cmd is held, and Cmd combos hit browser shortcuts.)

## Rules

- One fixed-length course (map 1, seeded, 1400 m), start → finish line. The clock stops at the line; the skier brakes to a stop in the run-out, and any trick still in the air counts before results show
- Kickers in three sizes (0.8 / 1.3 / 2.2 m) — air time grows with height. Space on a kicker pops (stronger near the lip, small grace window just after); Space elsewhere is a small ollie
- Tricks: spins (per 180°), flips (per 360°), corks (flip + spin), shifty (~90° twist and back, no spin), grabs (per held time). Must land with skis roughly aligned with travel direction, upright, and not grabbing — otherwise it's a crash
- Clean landings add tricks to a **combo pot**; each extra trick in the chain raises the multiplier. The pot banks into Style after ~2.5 s of clean riding
- **Crash** (hit tree/rock/lift pole, or bad landing): lose the unbanked pot, tumble briefly, speed cut heavily → next trick is harder
- Passing between gate flags: small style bonus
- Finish: final score = style + time bonus (faster = more)

## Screens

- Title: POWDER, New game button, skier picker (one per model in `public/models`, remembered in localStorage), camera picker, controls legend
- In run: HUD, trick/combo popup, pause overlay
- Results: time, style, time bonus, total, best (localStorage), New game

## After MVP (not now)

Yeti, NPC skiers/snowboarders/dogs, moving chairlift, more maps, mobile/touch, endless mode.
