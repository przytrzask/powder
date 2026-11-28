import { COURSE, LOOP } from './config'
import { generateCourse } from './course'
import { createSim, type Input, type Sim, type SimEvent, stepSim } from './sim'

/**
 * A run as data: the course seed and the input of every fixed sim step, in order. Because the sim is
 * deterministic and steps at a fixed `dt`, replaying it gives the same run on any machine or display.
 * A recording is only meaningful for the sim rules and tuning it was made with: change those and it
 * replays as a different (but still deterministic) run.
 */
export type Recording = {
  version: 1
  seed: number
  dt: number
  /** one packed `Input` per step, see `packInput` */
  inputs: number[]
}

// bit values for packing an Input into one number per step (7 flags, so recordings stay small as JSON)
const FLAGS = [
  ['left', 1],
  ['right', 2],
  ['up', 4],
  ['down', 8],
  ['jump', 16],
  ['jumpHeld', 32],
  ['grab', 64],
] as const satisfies readonly (readonly [keyof Input, number])[]

export function packInput(input: Input) {
  let packed = 0
  for (const [key, bit] of FLAGS) if (input[key]) packed += bit
  return packed
}

export function unpackInput(packed: number): Input {
  const has = (bit: number) => Math.floor(packed / bit) % 2 === 1
  return {
    left: has(1),
    right: has(2),
    up: has(4),
    down: has(8),
    jump: has(16),
    jumpHeld: has(32),
    grab: has(64),
  }
}

export const createRecording = (seed = COURSE.seed): Recording => ({ version: 1, seed, dt: LOOP.dt, inputs: [] })

/** Appends one step's input (exactly what `stepSim` received) to the recording. */
export function record(recording: Recording, input: Input) {
  recording.inputs.push(packInput(input))
}

/** Replays a recording headless, step by step, from a fresh sim on the course its seed generates. */
export function replay(recording: Recording): { sim: Sim; events: SimEvent[] } {
  const sim = createSim(generateCourse(recording.seed))
  const events: SimEvent[] = []
  for (const packed of recording.inputs) {
    events.push(...stepSim(sim, unpackInput(packed), recording.dt))
    if (sim.finished) break
  }
  return { sim, events }
}

/** Narrows parsed JSON (a saved run) to a Recording. */
export function isRecording(value: unknown): value is Recording {
  if (typeof value !== 'object' || value === null) return false
  const r: Partial<Record<keyof Recording, unknown>> = value
  return (
    r.version === 1 &&
    typeof r.seed === 'number' &&
    typeof r.dt === 'number' &&
    Array.isArray(r.inputs) &&
    r.inputs.every((n) => Number.isInteger(n) && typeof n === 'number' && n >= 0 && n < 128)
  )
}
