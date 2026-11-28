import { initAudio } from './audio'
import { COURSE } from './config'
import { generateCourse } from './course'
import { resetInput } from './input'
import { createClock, createPose, type FixedClock, lerpPose, type Pose, poseOf } from './loop'
import { createRecording, type Recording } from './replay'
import { createSim, type Sim } from './sim'
import { canSendPhase, sendPhase, useGame } from './store'

export const course = generateCourse(COURSE.seed)

type Runtime = {
  sim: Sim
  /** fixed-step bookkeeping; `clock.alpha` is how far this frame sits between `prev` and the sim */
  clock: FixedClock
  /** the skier at the step before the latest one */
  prev: Pose
  /** the skier as drawn this frame: `prev` blended towards the sim by `clock.alpha` (see `drawPose`) */
  pose: Pose
  /** every step's input since the run started, for replays */
  recording: Recording
  takeoff: number
  landing: number
}

/** Mutable per-frame state lives outside React; components read it in useFrame. */
export const runtime: Runtime = {
  sim: createSim(course),
  clock: createClock(),
  prev: createPose(),
  pose: createPose(),
  recording: createRecording(COURSE.seed),
  // one-shot animation cues set by GameLoop on sim events, consumed by Skier.tsx
  takeoff: 0, // left the snow: legs snap straight, arms swing up
  landing: 0, // touched down: knees soak it up
}

const current = createPose()
/** Updates `runtime.pose` for this frame (GameLoop calls it once per frame, after stepping). */
export function drawPose() {
  return lerpPose(runtime.prev, poseOf(runtime.sim.skier, current), runtime.clock.alpha, runtime.pose)
}

/** New run from the menu, the pause screen or the results; does nothing mid-run. */
export function startRun() {
  if (!canSendPhase({ type: 'START' })) return
  initAudio()
  resetInput()
  runtime.sim = createSim(course)
  runtime.clock = createClock()
  poseOf(runtime.sim.skier, runtime.prev)
  poseOf(runtime.sim.skier, runtime.pose)
  runtime.recording = createRecording(COURSE.seed)
  runtime.takeoff = runtime.landing = 0
  useGame.getState().newGame()
  sendPhase({ type: 'START' })
}

/** Dev: download the current (or last) run so it can be checked in under src/game/replays/ and replayed as a test. */
function saveRun(name = `run-${new Date().toISOString().replaceAll(/[:.]/gu, '-')}`) {
  const blob = new Blob([JSON.stringify(runtime.recording)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${name}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  return `${runtime.recording.inputs.length} steps saved as ${link.download}`
}

// Dev-only handle for poking at the sim from the console / test scripts:
// `__powder.sim`, `__powder.recording`, `__powder.saveRun('crash-on-kicker')`.
if (import.meta.env.DEV) {
  const handle = Object.defineProperties(
    { runtime, saveRun },
    {
      sim: { get: () => runtime.sim, enumerable: true },
      recording: { get: () => runtime.recording, enumerable: true },
    },
  )
  Object.assign(window, { __powder: handle })
}
