import { initAudio } from './audio'
import { generateCourse } from './course'
import { resetInput } from './input'
import { createSim, type Sim } from './sim'
import { useGame } from './store'

export const course = generateCourse()

/** Mutable per-frame state lives outside React; components read it in useFrame. */
export const runtime: { sim: Sim } = { sim: createSim(course) }

export function startRun() {
  initAudio()
  resetInput()
  runtime.sim = createSim(course)
  useGame.getState().newGame()
}

// Dev-only handle for poking at the sim from the console / test scripts.
if (import.meta.env.DEV) Object.assign(window, { __powder: runtime })
