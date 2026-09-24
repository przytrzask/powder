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
| Esc | pause | |

Let go of the arrows mid-air and the rotation finishes itself. Flip + spin = Cork.
A quick ←/→ twist (~90°) that you let swing back is a Shifty.
Clean tricks build a combo that banks after a couple of seconds of clean riding — crash and it's gone.

See [SPEC.md](SPEC.md) for the full design. Tuning lives in `src/game/config.ts`.
