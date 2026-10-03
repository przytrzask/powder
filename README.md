# POWDER

A SkiFree-style downhill game in 3D — React Three Fiber, procedural low-poly art, synthesized sound.

```sh
pnpm install
pnpm dev     # play at http://localhost:5173
pnpm test    # game rules (tricks, crashes, combos)
```

## Controls

| Key | On the snow | In the air |
|---|---|---|
| ← / → | turn | spin |
| ↑ | brake | backflip |
| ↓ | tuck | frontflip |
| Space | jump | |
| Shift | | grab |
| C | switch camera (Classic / Chase) | |
| Esc | pause | |

Let go of the arrows mid-air and the rotation finishes itself. Flip + spin = Cork.
Press Space on a kicker to pop — the closer to the lip, the higher. Kickers come in three sizes.
A quick ←/→ twist (~90°) that you let swing back is a Shifty.
Clean tricks build a combo that banks after a couple of seconds of clean riding — crash and it's gone.

## Skier models

Skiers are built in Blender by scripts, one per character — one mesh per animated part (boots, shins, thighs, torso, arm, ski, pole), each with its origin at the joint the game moves it around, flat colours as vertex colours. The leg is jointed at the ankle, knee and hip, so a crouch pushes the knees forward and drops the hips over the feet instead of squashing the body. Shared building blocks, joints and export are in `art/lowpoly.py`, so every character fits the same rig:

| Character | Script | Model |
|---|---|---|
| Charcoal jacket, tan pants, orange backpack (in game) | `art/skier.py` | `public/models/skier.glb` |
| Steel-blue jacket, black helmet, camo gaiter | `art/skier_blue.py` | `public/models/skier-blue.glb` |

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/skier.py
```

Pick the skier on the title screen. To add a character, copy a script, change the look, and add its id to `CHARACTERS` in `src/game/store.ts`.

Each script writes its `.glb`, `art/<name>.blend` and preview renders `art/preview-<name>-*.png`. To tweak by hand, open the `.blend`, keep the object names and origins, then File → Export → glTF 2.0 (.glb) with Data → Mesh → Vertex Color set to *Active*. Re-running the script overwrites hand edits.

See [SPEC.md](SPEC.md) for the full design. Tuning lives in `src/game/config.ts`.
