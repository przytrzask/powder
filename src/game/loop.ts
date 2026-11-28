import { LOOP } from './config'
import type { Skier } from './sim'

/** Leftover frame time not yet simulated, and how far the drawn frame sits between the last two steps. */
export type FixedClock = { acc: number; alpha: number }

export const createClock = (): FixedClock => ({ acc: 0, alpha: 1 })

/**
 * Feeds one display frame to the fixed-step sim: runs `step` once per whole `LOOP.dt` of accumulated time
 * (at most `LOOP.maxSteps`), keeps the remainder for the next frame, and sets `clock.alpha` for drawing.
 * `step` returns false to stop early (the run finished). Returns the number of steps taken.
 */
export function advance(clock: FixedClock, delta: number, step: () => boolean) {
  clock.acc += Math.min(delta, LOOP.maxFrame)
  let steps = 0
  while (clock.acc >= LOOP.dt && steps < LOOP.maxSteps) {
    clock.acc -= LOOP.dt
    steps++
    if (!step()) {
      // stopped (the run finished): draw the final step as is
      clock.acc = 0
      clock.alpha = 1
      return steps
    }
  }
  // still behind after maxSteps: drop the backlog rather than carry it into the next frame
  if (clock.acc >= LOOP.dt) clock.acc %= LOOP.dt
  clock.alpha = clock.acc / LOOP.dt
  return steps
}

/** What the scene needs to place the skier and camera; blended between two sim steps. */
export type Pose = {
  x: number
  y: number
  z: number
  heading: number
  /** body yaw: heading + spin, turned round when riding switch */
  yaw: number
  flip: number
}

export const createPose = (): Pose => ({ x: 0, y: 0, z: 0, heading: 0, yaw: 0, flip: 0 })

/** Copies the skier's drawable state into `out`. */
export function poseOf(s: Skier, out: Pose) {
  out.x = s.x
  out.y = s.y
  out.z = s.z
  out.heading = s.heading
  out.yaw = s.heading + s.spin + (s.switchStance ? Math.PI : 0)
  out.flip = s.flip
  return out
}

const TAU = Math.PI * 2
/** Shortest signed difference between two angles, so a landing that resets 2π to 0 doesn't unwind. */
const angleDelta = (from: number, to: number) => {
  const d = (to - from) % TAU
  if (d > Math.PI) return d - TAU
  if (d < -Math.PI) return d + TAU
  return d
}

/** `out` = `a` blended towards `b` by `t` (0..1); angles take the short way round. */
export function lerpPose(a: Pose, b: Pose, t: number, out: Pose) {
  out.x = a.x + (b.x - a.x) * t
  out.y = a.y + (b.y - a.y) * t
  out.z = a.z + (b.z - a.z) * t
  out.heading = a.heading + angleDelta(a.heading, b.heading) * t
  out.yaw = a.yaw + angleDelta(a.yaw, b.yaw) * t
  out.flip = a.flip + angleDelta(a.flip, b.flip) * t
  return out
}
