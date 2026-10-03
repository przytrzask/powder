---
name: powder-character
description: Builds a new low-poly POWDER skier character from a reference photo with a Blender script (art/skier_<name>.py → public/models/skier-<name>.glb), then adds it to the title-screen skier picker. Use when the user wants a new skier, character, outfit or model for the POWDER game, or shares a photo of a skier to turn into one.
---

# POWDER character from a photo

Every skier is a Python script driving headless Blender. Shared shapes, joints and export live in `art/lowpoly.py`; a character script only has a palette and a `build_body()`. All characters share one rig (same part names, same joint origins), so any model swaps in without code changes.

## Quick start

```sh
cp art/skier_blue.py art/skier_red.py            # closest existing look as a template
# edit: docstring, palette, build_boots()/build_shins()/build_thighs()/build_torso(), the colours passed to arm/pole/ski, id 'skier-red'
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/skier_red.py 2>&1 | grep -E '^\[|Error|Traceback'
node .agents/skills/powder-character/scripts/inspect-glb.mjs public/models/skier-red.glb
```

Then look at `art/preview-skier-red-front.png` and `-back.png` with the read tool.

## Workflow

- [ ] **Read the photo** and list what reads at game scale: helmet colour/shape, goggle frame + lens, face (skin/beard/gaiter), jacket colour + 2–3 details (zip, chest strip, pockets, hood), backpack or not, pants, boots + accents, gloves, poles, ski top/sides. Skip logos and brand names.
- [ ] **Name it**: script `art/skier_<name>.py`, id `skier-<name>` (the id is the `.glb` filename). Ask if the user has a name for the picker label; otherwise use the main colour.
- [ ] **Write the script** from the closest template (`art/skier.py` has a backpack, beard and cargo pockets; `art/skier_blue.py` has a gaiter, full helmet and hood). Put new hex colours in the palette block, keep the coordinates inside the landmarks in [REFERENCE.md](REFERENCE.md), split the body at the ankle, knee and waist like the templates do, and don't move the joints.
- [ ] **Build**, then check: Blender printed `[skier-<name>] <Part>: N tris` for all 7 parts (budget ~750 for Boots+Shins+Thighs+Torso, ~1,200 total), and `inspect-glb.mjs` reports OK.
- [ ] **Look at both previews** and fix the common problems (listed in REFERENCE.md), then rebuild. Usually it takes 1–2 passes.
- [ ] **Register it**: add `{ id: 'skier-<name>', label: '<Label>' }` to `CHARACTERS` in `src/game/store.ts`. `Skier.tsx` preloads every entry, and nothing else needs changing.
- [ ] **Check it in the game** (dev server running: `pnpm dev`):
  ```sh
  mkdir -p /tmp/pwshot && cd /tmp/pwshot && [ -d node_modules/playwright ] || npm i playwright
  node <repo>/.agents/skills/powder-character/scripts/check-in-game.mjs skier-<name>
  ```
  Read the 4 screenshots it prints (chase ride, grab, top-down, crash). It exits non-zero on console errors or if the model never loaded.
- [ ] **Docs**: add a row to the "Skier models" table in `README.md`.
- [ ] `npx tsc -b && pnpm test`, then report with the preview images. Don't commit unless asked.

## Rules

- Low poly, flat colours: build only from `Part.box / cyl / sphere`. No textures, no subdivision, no smooth shading.
- Don't copy the reference photo into the repo; it's usually a real person.
- Don't edit `art/lowpoly.py` joints (`SHOULDER`, `SKI_AT`, `POLE_IN_HAND`) for one character; they must match `src/scene/Skier.tsx` for every model.
- If a character needs a new shared shape (for example a snowboard), add it to `lowpoly.py` and rebuild **all** characters to confirm they still build.
