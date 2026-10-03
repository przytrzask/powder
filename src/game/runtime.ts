import { initAudio } from './audio'
import { generateCourse } from './course'
import { resetInput } from './input'
import { createSim, type Sim } from './sim'
import { useGame } from './store'

export const course = generateCourse()

/** Mutable per-frame state lives outside React; components read it in useFrame. */
export const runtime: { sim: Sim; takeoff: number; landing: number } = {
  sim: createSim(course),
  // one-shot animation cues set by GameLoop on sim events, consumed by Skier.tsx
  takeoff: 0, // left the snow: legs snap straight, arms swing up
  landing: 0, // touched down: knees soak it up
}

export function startRun() {
  initAudio()
  resetInput()
  runtime.sim = createSim(course)
  runtime.takeoff = runtime.landing = 0
  useGame.getState().newGame()
}

// Dev-only handle for poking at the sim from the console / test scripts.
if (import.meta.env.DEV) Object.assign(window, { __powder: runtime })
