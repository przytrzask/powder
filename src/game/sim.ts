import { COURSE, PHYS, SCORE } from './config'
import { bucketObstacles, type Course } from './course'
import { judgeLanding } from './tricks'

export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; grab: boolean }

export type SimEvent =
  | { type: 'jump'; big: boolean }
  | { type: 'land' }
  | { type: 'trick'; name: string; points: number; combo: number; pot: number }
  | { type: 'bank'; points: number }
  | { type: 'crash'; reason: string; lost: number }
  | { type: 'gate' }
  | { type: 'finish' }

export type Combo = { base: number; count: number; tricks: string[]; bankIn: number }

export type Skier = {
  x: number
  z: number
  y: number
  vy: number
  heading: number
  speed: number
  airborne: boolean
  airTime: number
  spin: number
  /** largest |spin| reached during this jump — a twist-and-return is a shifty */
  peakSpin: number
  flip: number
  grabTime: number
  grabbing: boolean
  switchStance: boolean
  tuck: boolean
  crashT: number
  /** invulnerability after getting up, so you never crash-loop into the same tree */
  recoverT: number
  /** which way the body spins while sliding in a wipeout */
  tumbleDir: number
  onRamp: boolean
}

export type Sim = {
  course: Course
  nearby: (z: number) => Course['obstacles']
  skier: Skier
  time: number
  style: number
  combo: Combo
  finished: boolean
}

const emptyCombo = (): Combo => ({ base: 0, count: 0, tricks: [], bankIn: 0 })

export function createSim(course: Course): Sim {
  return {
    course,
    nearby: bucketObstacles(course.obstacles),
    skier: {
      x: 0, z: 0, y: 0, vy: 0, heading: 0, speed: 4, airborne: false, airTime: 0,
      spin: 0, peakSpin: 0, flip: 0, grabTime: 0, grabbing: false, switchStance: false, tuck: false, crashT: 0, recoverT: 0, tumbleDir: 1, onRamp: false,
    },
    time: 0,
    style: 0,
    combo: emptyCombo(),
    finished: false,
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function crash(sim: Sim, reason: string, events: SimEvent[], tumbleDir = Math.sign(sim.skier.heading) || 1) {
  const s = sim.skier
  if (s.crashT > 0 || s.recoverT > 0) return
  events.push({ type: 'crash', reason, lost: sim.combo.base * sim.combo.count })
  sim.combo = emptyCombo()
  s.crashT = PHYS.crashDuration
  s.recoverT = 0
  s.tumbleDir = tumbleDir
  s.speed *= PHYS.crashSpeedFactor
  s.airborne = false
  s.onRamp = false
  s.y = 0
  s.vy = 0
  s.spin = s.flip = s.grabTime = 0
  s.grabbing = false
  s.switchStance = false
}

/**
 * Where the rotation assist is taking an angle once the key is released: far enough into the next
 * `period` and it completes it in the same direction, otherwise it eases back to the last completed one.
 */
export function assistTarget(angle: number, period: number, firstCommit: number, commit: number) {
  const turns = Math.abs(angle) / period
  const done = Math.floor(turns)
  const needed = done === 0 ? firstCommit : commit
  return Math.sign(angle) * (turns - done > needed ? done + 1 : done) * period
}

function settle(angle: number, target: number, dt: number) {
  const step = PHYS.assistRate * dt
  return Math.abs(target - angle) <= step ? target : angle + Math.sign(target - angle) * step
}

function launch(s: Skier, vy: number) {
  s.airborne = true
  s.onRamp = false
  s.vy = vy
  s.airTime = 0
  s.spin = s.flip = s.grabTime = s.peakSpin = 0
}

export function stepSim(sim: Sim, input: Input, dt: number): SimEvent[] {
  const events: SimEvent[] = []
  if (sim.finished) return events
  const s = sim.skier
  const prevZ = s.z
  sim.time += dt

  if (s.recoverT > 0) s.recoverT = Math.max(0, s.recoverT - dt)
  if (s.crashT > 0) {
    // sliding on the snow, slowing down and swinging back toward the fall line
    s.crashT -= dt
    s.speed = Math.max(0, s.speed - 5 * dt)
    s.heading *= 1 - Math.min(1, dt * 3)
    if (s.crashT <= 0) {
      s.crashT = 0
      s.heading = 0
      s.speed = Math.max(s.speed, 3)
      s.recoverT = PHYS.recoverDuration
    }
  } else if (!s.airborne) {
    if (input.left) s.heading -= PHYS.turnRate * dt
    if (input.right) s.heading += PHYS.turnRate * dt
    s.heading = clamp(s.heading, -PHYS.maxHeading, PHYS.maxHeading)
    s.tuck = input.down

    const turning = input.left || input.right
    const fall = Math.cos(s.heading)
    let a = PHYS.gravityAlongSlope * fall - PHYS.friction
    a -= (input.down ? PHYS.tuckDrag : PHYS.drag) * s.speed * s.speed
    a -= PHYS.sideScrub * Math.abs(Math.sin(s.heading)) * (turning ? 1 : 0.35)
    if (input.down) a += PHYS.tuckBoost * fall
    if (input.up) a -= PHYS.brake
    s.speed = clamp(s.speed + a * dt, 0, PHYS.maxSpeed)

    if (input.jump) {
      launch(s, PHYS.ollieVy + s.speed * 0.05)
      events.push({ type: 'jump', big: false })
    }
  } else {
    // In the air: arrows rotate the body, travel direction is locked.
    if (input.left) s.spin -= PHYS.spinRate * dt
    if (input.right) s.spin += PHYS.spinRate * dt
    if (!input.left && !input.right) s.spin = settle(s.spin, assistTarget(s.spin, Math.PI, PHYS.firstSpinCommit, PHYS.spinCommit), dt)
    s.peakSpin = Math.max(s.peakSpin, Math.abs(s.spin))
    if (input.up) s.flip += PHYS.flipRate * dt
    if (input.down) s.flip -= PHYS.flipRate * dt
    if (!input.up && !input.down) s.flip = settle(s.flip, assistTarget(s.flip, Math.PI * 2, PHYS.flipCommit, PHYS.flipCommit), dt)
    s.grabbing = input.grab
    if (input.grab) s.grabTime += dt
    s.speed = Math.max(0, s.speed - PHYS.drag * s.speed * s.speed * dt)
  }

  s.x += Math.sin(s.heading) * s.speed * dt
  s.z += Math.cos(s.heading) * s.speed * dt

  // Ramps: ride up the wedge, launch off the lip.
  const ramp = sim.course.ramps.find(
    (r) => Math.abs(s.x - r.x) < r.w / 2 && s.z > r.z - r.l / 2 - 0.5 && s.z < r.z + r.l / 2 + 0.5,
  )
  if (!s.airborne && s.crashT <= 0) {
    if (ramp && s.z <= ramp.z + ramp.l / 2) {
      s.onRamp = true
      s.y = clamp(((s.z - (ramp.z - ramp.l / 2)) / ramp.l) * ramp.h, 0, ramp.h)
    } else if (s.onRamp) {
      s.onRamp = false
      launch(s, PHYS.rampVy + s.speed * PHYS.rampSpeedFactor)
      events.push({ type: 'jump', big: true })
    } else {
      s.y = 0
    }
  }

  if (s.airborne) {
    s.airTime += dt
    s.vy -= PHYS.gravity * dt
    s.y += s.vy * dt
    if (s.y <= 0) {
      s.y = 0
      s.airborne = false
      const result = judgeLanding(s.spin, s.flip, s.grabTime, s.airTime, s.peakSpin)
      if (!result.clean) {
        crash(sim, result.reason, events)
      } else {
        events.push({ type: 'land' })
        if (result.switchStance) s.switchStance = !s.switchStance
        if (result.name) {
          const c = sim.combo
          c.base += result.points
          c.count += 1
          c.tricks.push(result.name)
          c.bankIn = SCORE.bankDelay
          events.push({ type: 'trick', name: result.name, points: result.points, combo: c.count, pot: c.base * c.count })
        }
      }
      s.spin = s.flip = s.grabTime = 0
      s.grabbing = false
    }
  }

  // Obstacles. Ignored while tumbling or recovering.
  if (s.crashT <= 0 && s.recoverT <= 0) {
    for (const o of sim.nearby(s.z)) {
      const dx = s.x - o.x
      const dz = s.z - o.z
      const min = o.r + PHYS.skierRadius
      if (dx * dx + dz * dz < min * min && s.y < o.h) {
        // bounce off to the side so the slide (and the fall line) is clear of the obstacle
        const side = Math.sign(dx) || 1
        crash(sim, o.kind === 'tree' ? 'Hugged a tree' : o.kind === 'rock' ? 'Hit a rock' : 'Hit the lift', events, side)
        s.x = o.x + side * (min + 0.6)
        s.heading = side * 0.5
        break
      }
    }
  }

  // Corridor edge: the forest is impassable.
  const edge = COURSE.corridor + 3
  if (Math.abs(s.x) > edge) {
    const side = Math.sign(s.x)
    s.x = side * edge
    if (s.crashT <= 0 && s.recoverT <= 0) {
      crash(sim, 'Lost in the woods', events, -side)
      s.heading = -side * 0.5
    }
  }

  // Gates.
  for (const g of sim.course.gates) {
    if (prevZ < g.z && s.z >= g.z && Math.abs(s.x - g.x) < g.halfWidth) {
      sim.style += SCORE.gate
      events.push({ type: 'gate' })
    }
  }

  // Bank the combo after a stretch of clean riding.
  if (sim.combo.count > 0 && !s.airborne) {
    sim.combo.bankIn -= dt
    if (sim.combo.bankIn <= 0) {
      const points = sim.combo.base * sim.combo.count
      sim.style += points
      events.push({ type: 'bank', points })
      sim.combo = emptyCombo()
    }
  }

  if (s.z >= sim.course.length) {
    if (sim.combo.count > 0) {
      const points = sim.combo.base * sim.combo.count
      sim.style += points
      events.push({ type: 'bank', points })
      sim.combo = emptyCombo()
    }
    sim.finished = true
    events.push({ type: 'finish' })
  }

  return events
}

export function timeBonus(time: number) {
  return Math.max(0, Math.round((SCORE.timePar - time) * SCORE.timeBonusPerSecond))
}
