import { describe, expect, it } from 'vitest'

import { COURSE, LOOP } from './config'
import { generateCourse } from './course'
import { advance, createClock, createPose, lerpPose, type Pose } from './loop'
import { createRecording, isRecording, packInput, record, replay, unpackInput } from './replay'
import { createSim, type Input, stepSim, type SimEvent } from './sim'

// Runs saved in dev with `__powder.saveRun()` and checked in here are replayed by the tests below.
const saved = import.meta.glob<unknown>('./replays/*.json', { eager: true, import: 'default' })

const idle: Input = { left: false, right: false, up: false, down: false, jump: false, jumpHeld: false, grab: false }

/** The sim state a replay must reproduce exactly (the course and the obstacle lookup are rebuilt from the seed). */
const outcome = ({ sim, events }: ReturnType<typeof replay>) => ({
  skier: sim.skier,
  time: sim.time,
  style: sim.style,
  combo: sim.combo,
  crossed: sim.crossed,
  finished: sim.finished,
  events,
})

/**
 * Plays a run the way GameLoop does: display frames of `frameTimes` seconds feed the fixed-step clock,
 * and each step takes the next scripted input, records it and steps the sim.
 */
function playLive(frameTimes: (frame: number) => number, inputFor: (step: number) => Input, steps: number) {
  const sim = createSim(generateCourse(COURSE.seed))
  const recording = createRecording(COURSE.seed)
  const clock = createClock()
  const events: SimEvent[] = []
  const played = { steps: 0, frames: 0 }
  const step = () => {
    const input = inputFor(played.steps++)
    record(recording, input)
    events.push(...stepSim(sim, input, LOOP.dt))
    return !sim.finished && played.steps < steps
  }
  while (played.steps < steps && !sim.finished) advance(clock, frameTimes(played.frames++), step)
  return { sim, events, recording }
}

// a scripted ~20 s ride: tuck, weave, ollie now and then, spin in the air
const scripted = (step: number): Input => ({
  ...idle,
  down: step % 400 < 300,
  left: step % 360 < 90,
  right: step % 360 >= 180 && step % 360 < 270,
  jump: step % 600 === 50,
  up: step % 600 > 70 && step % 600 < 110,
})

describe('recorded runs', () => {
  it('packs every input combination losslessly', () => {
    for (let packed = 0; packed < 128; packed++) expect(packInput(unpackInput(packed))).toBe(packed)
    expect(unpackInput(packInput({ ...idle, left: true, jumpHeld: true }))).toEqual({ ...idle, left: true, jumpHeld: true })
  })

  it('has at least one saved run to replay', () => {
    expect(Object.keys(saved).length).toBeGreaterThan(0)
  })

  for (const [file, data] of Object.entries(saved)) {
    it(`${file} replays to the same run every time`, () => {
      expect(isRecording(data)).toBe(true)
      if (!isRecording(data)) return
      const first = replay(data)
      const second = replay(data)
      expect(first.sim.skier.z).toBeGreaterThan(0)
      expect(outcome(second)).toEqual(outcome(first))
    })
  }

  it('a recording made while playing replays to exactly the run that was played', () => {
    const live = playLive(() => 1 / 144, scripted, 120 * 20)
    expect(live.recording.inputs).toHaveLength(120 * 20)
    expect(outcome(replay(live.recording))).toEqual(outcome(live))
  })

  it('the same inputs give the same run at any display rate', () => {
    const rates = [30, 60, 120, 144, 240]
    const runs = rates.map((hz) => playLive(() => 1 / hz, scripted, 120 * 20))
    // uneven frames too: a GC pause, a dropped frame, a fast one
    const jitter = [1 / 60, 1 / 144, 1 / 25, 0.002, 1 / 90]
    runs.push(playLive((frame) => jitter[frame % jitter.length] ?? 1 / 60, scripted, 120 * 20))
    const [first, ...rest] = runs.map(outcome)
    for (const run of rest) expect(run).toEqual(first)
  })

  it('rejects data that is not a recording', () => {
    expect(isRecording(null)).toBe(false)
    expect(isRecording({ version: 1, seed: 1, dt: LOOP.dt, inputs: [1, 'x'] })).toBe(false)
    expect(isRecording({ version: 2, seed: 1, dt: LOOP.dt, inputs: [] })).toBe(false)
    const file: unknown = JSON.parse('{"version":1,"seed":1,"dt":0.008333333333333333,"inputs":[0,127]}')
    expect(isRecording(file)).toBe(true)
  })
})

describe('fixed-step clock', () => {
  const count = (clock = createClock(), delta = 1 / 60) => {
    let steps = 0
    advance(clock, delta, () => {
      steps++
      return true
    })
    return steps
  }

  it('runs 120 steps per simulated second whatever the frame rate', () => {
    for (const hz of [30, 60, 75, 120, 144, 165, 240]) {
      const clock = createClock()
      let steps = 0
      for (let f = 0; f < hz; f++) steps += count(clock, 1 / hz)
      // within a step of exact: the remainder waits in the accumulator
      expect(Math.abs(steps - 120)).toBeLessThanOrEqual(1)
    }
  })

  it('carries the remainder and reports it as alpha', () => {
    const clock = createClock()
    expect(count(clock, LOOP.dt * 0.5)).toBe(0)
    expect(clock.alpha).toBeCloseTo(0.5)
    expect(count(clock, LOOP.dt * 0.75)).toBe(1)
    expect(clock.alpha).toBeCloseTo(0.25)
  })

  it('caps a long frame instead of spiralling into catch-up steps', () => {
    const clock = createClock()
    expect(count(clock, 2)).toBeLessThanOrEqual(LOOP.maxSteps)
    expect(clock.acc).toBeLessThan(LOOP.dt)
  })

  it('stops when the step says so', () => {
    const clock = createClock()
    let steps = 0
    advance(clock, 1 / 20, () => ++steps < 2)
    expect(steps).toBe(2)
    expect(clock.alpha).toBe(1)
  })
})

describe('drawn pose', () => {
  const pose = (over: Partial<Pose>): Pose => ({ ...createPose(), ...over })

  it('blends position linearly between two steps', () => {
    const out = lerpPose(pose({ x: 0, z: 10 }), pose({ x: 1, z: 12 }), 0.25, createPose())
    expect(out.x).toBeCloseTo(0.25)
    expect(out.z).toBeCloseTo(10.5)
  })

  it('takes angles the short way round, so a landing that resets a 360 to 0 does not unwind', () => {
    const out = lerpPose(pose({ yaw: Math.PI * 2 - 0.02, flip: Math.PI * 2 }), pose({ yaw: 0.02, flip: 0 }), 0.5, createPose())
    expect(Math.cos(out.yaw)).toBeCloseTo(1)
    expect(Math.sin(out.flip)).toBeCloseTo(0)
    expect(Math.cos(out.flip)).toBeCloseTo(1)
  })
})
