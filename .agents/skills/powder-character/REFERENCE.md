# POWDER character reference

## Coordinates

Game units (metres before the in-game ×1.7), **y up, +z forward** (the direction the skier faces and travels), **feet at the origin**, x = the skier's left/right. `Part` converts to Blender axes itself, so write everything in game coordinates.

## Part API (`art/lowpoly.py`)

```python
p = Part()
p.box(center, size, color, top=(1, 1), rot=(0, 0, 0))   # top = x/z scale of the upper face (taper)
p.cyl(center, radius, height, color, segments=6, radius_top=None, scale=(1, 1, 1), rot=(0, 0, 0))  # upright along y
p.sphere(center, radius, color, segments=8, rings=6, scale=(1, 1, 1), cut=(point, normal))  # cut drops geometry behind the plane
return p.mesh('Boots')                                     # boots only, stay on the skis
return p.mesh('Shins', shift=(0, -ANKLE_Y, 0))              # pants cuff + lower leg, pivots at the ankle
return p.mesh('Thighs', shift=(0, -KNEE_Y, 0))              # upper leg + lowpoly.knee() caps + seat, pivots at the knee
return p.mesh('Torso', shift=(0, -HIP_Y, 0))                # jacket/head, pivots at the hip

lowpoly.arm(sleeve, cuff, glove, glove_accent=None)
lowpoly.pole(shaft, grip, basket, tip)
lowpoly.ski(base, side, top_edge, top_center, binding, heel_accent=None)
lowpoly.build_character('skier-<name>', boots=build_boots, shins=build_shins, thighs=build_thighs, torso=build_torso, arm=lambda: ..., pole=lambda: ..., ski=lambda: ...)
```

Write all four in absolute game coordinates (feet at the origin); `shift` re-origins each part at its joint, so the table below still applies. Joints: `ANKLE_Y = 0.2` (hidden in the boot by the pants cuff), `KNEE_Y = 0.47`, `HIP_Y = 0.8`. Split the pants leg at the knee (shin box 0.37–0.49, thigh box 0.47–0.82) and call `lowpoly.knee(p, x, PANTS)` in `build_thighs()` so the fold never opens a gap. Keep everything on the boot below the cuff in `build_boots()`.

Colours are `'#rrggbb'` strings; one colour per primitive.

## Body landmarks (keep new pieces within these)

| Region | y range | Notes |
|---|---|---|
| Ski top | 0.065 | boot sole starts here |
| Boots | 0.065 – 0.34 | per foot at x = ±0.16, z ≈ −0.12 … 0.18 |
| Pants cuff | 0.30 – 0.44 | covers the boot top, **hides anything on the boot above y ≈ 0.3** |
| Legs (shin + thigh) | 0.38 – 0.82, knee at 0.47 | ±0.16, 0.2 wide; outer surface x ≈ ±0.26 |
| Hips | 0.73 – 0.87 | |
| Jacket | 0.72 – 1.38 | front surface z = +0.15, back z = −0.15, half-width 0.25 (hem) → 0.27 (shoulders) |
| Collar / hood | 1.36 – 1.48 | hood sits behind the neck at z ≈ −0.12 |
| Head | centre (0, 1.58, 0) | radius 0.16, y scale 1.12; face front z ≈ +0.155 |
| Helmet | centre (0, 1.62, −0.01) | radius ≈ 0.2; cut plane tilted so the front edge sits at the goggles (y ≈ 1.63–1.65) |
| Goggles | centre y 1.625 | frame z 0.125 – 0.21, lens just in front, highlight strip on top |

Details on the jacket (zips, strips, pockets) are thin boxes 0.01 deep at z = ±0.152–0.165, so they sit just proud of the surface.

Arm (origin at the shoulder, hangs down −y): shoulder to −0.03, sleeve to −0.45, cuff −0.44, glove −0.46 … −0.58. The shoulder joint is at (±0.33, 1.28, 0) on the body.

## Common problems (check the previews)

| Symptom | Cause / fix |
|---|---|
| All grey in the preview | the colour attribute isn't active; `Part.mesh()` handles it, so use `Part` for every mesh |
| Boot accent missing, or striped (z-fighting) | it's inside the pants cuff; keep boot details below y ≈ 0.28 or on the sole |
| Goggle strap across the lens | the strap cylinder centre must sit behind the head (z ≈ −0.03) so its front stays inside the goggle frame |
| Detail flickers on the jacket | it's coplanar with the surface; push it 0.002–0.005 further out |
| Back looks flat in the chase camera | the chase camera mostly shows the back: give it a backpack, a contrasting hood or a seam |
| Skis vanish from the top-down camera | white top on white snow; use dark edges (`top_edge`) or a dark top |
| Too many tris | lower the `segments` / `rings` on spheres and cylinders; boxes are 12 tris each |

## Files a build writes

- `public/models/skier-<name>.glb`: loaded by the game (parts `Boots`, `Shins`, `Thighs`, `Torso`, `ArmL/R`, `SkiL/R`, `PoleL/R`, vertex colours)
- `art/skier-<name>.blend`: for hand edits (re-running the script overwrites them)
- `art/preview-skier-<name>-{front,back}.png`: ignored by git
