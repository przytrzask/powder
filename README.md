# POWDER

A top-down freestyle ski game in 3D — React Three Fiber, procedural low-poly art, synthesized sound.

```sh
pnpm install   # also installs the pre-commit hook
pnpm dev       # play at http://localhost:5173
pnpm test      # game rules (tricks, crashes, combos), phases, saved settings, replays
pnpm check     # types (strict), type-aware lint, format check
pnpm format    # fix formatting
```

## Controls

| Key   | On the snow                     | In the air |
| ----- | ------------------------------- | ---------- |
| ← / → | turn                            | spin       |
| ↑     | brake                           | backflip   |
| ↓     | tuck                            | frontflip  |
| Space | jump                            |            |
| Shift |                                 | grab       |
| C     | switch camera (Classic / Chase) |            |
| Esc   | pause                           |            |

Let go of the arrows mid-air and the rotation finishes itself. Flip + spin = Cork.
Press Space on a kicker to pop — the closer to the lip, the higher. Kickers come in three sizes.
A quick ←/→ twist (~90°) that you let swing back is a Shifty.
Clean tricks build a combo that banks after a couple of seconds of clean riding — crash and it's gone.

## Skier models

Skiers are built in Blender by scripts, one per character — one mesh per animated part (boots, shins, thighs, torso, arm, ski, pole), each with its origin at the joint the game moves it around, flat colours as vertex colours. The leg is jointed at the ankle, knee and hip, so a crouch pushes the knees forward and drops the hips over the feet instead of squashing the body. Shared building blocks, joints and export are in `art/lowpoly.py`, so every character fits the same rig:

| Character                                             | Script              | Model                          |
| ----------------------------------------------------- | ------------------- | ------------------------------ |
| Charcoal jacket, tan pants, orange backpack (in game) | `art/skier.py`      | `public/models/skier.glb`      |
| Steel-blue jacket, black helmet, camo gaiter          | `art/skier_blue.py` | `public/models/skier-blue.glb` |

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -P art/skier.py
```

Pick the skier on the title screen. To add a character, copy a script, change the look, and add its id to `CHARACTERS` in `src/game/store.ts`.

Each script writes its `.glb`, `art/<name>.blend` and preview renders `art/preview-<name>-*.png`. To tweak by hand, open the `.blend`, keep the object names and origins, then File → Export → glTF 2.0 (.glb) with Data → Mesh → Vertex Color set to _Active_. Re-running the script overwrites hand edits.

## Checks

Every commit runs `pnpm check` and `pnpm test` (lefthook, `lefthook.yml`), and so does CI, plus the build. Agents can't skip the hook: `scripts/vcs-command-policy.js` (from [rat-stack](https://github.com/joelhooks/rat-stack)) blocks `--no-verify` and the other bypasses for Claude Code (`.claude/settings.json`) and Pi (`.pi/extensions/git-interceptor`).

Lint is [Ultracite](https://www.ultracite.ai)'s oxlint core preset, type-aware, with warnings failing. Every rule switched off in `oxlint.config.ts` says why.

## Replays

The sim steps at a fixed 120 Hz whatever the display does, so the same inputs always give the same run. Every run is recorded (course seed + one input per step). In `pnpm dev`, after a run worth keeping (a bug, a great line), save it from the browser console:

```js
__powder.saveRun('crash-on-big-kicker') // downloads crash-on-big-kicker.json
```

Drop the file into `src/game/replays/` and `pnpm test` replays it headless and checks it plays out the same every time. `replay()` in `src/game/replay.ts` returns the final sim and every event, for asserting on a bug once it's fixed. A recording belongs to the rules and tuning it was made with; change those and it replays as a different (still deterministic) run.

## Deploy

The game deploys to Cloudflare as static assets with [Alchemy](https://alchemy.run) (`alchemy.run.ts`). Once:

```sh
pnpm exec alchemy profile edit --add Cloudflare   # sign in (OAuth or an API token), saved to ~/.alchemy
```

Then `pnpm run deploy` builds, shows the plan and asks before applying; `pnpm run destroy` removes it. (Plain `pnpm deploy` is a pnpm built-in.) Without `--stage`, Alchemy deploys a personal stage (`live_$USER`); CI deploys `--stage prod`, which you can also deploy by hand with `pnpm run deploy --stage prod`.

CI deploys `main` after the checks pass, once the repository has `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets; until then the deploy job is skipped. The state store lives on your Cloudflare account and CI won't create it, so deploy once locally (or run `pnpm exec alchemy state bootstrap`) first.

See [SPEC.md](SPEC.md) for the full design. Tuning lives in `src/game/config.ts`.
