import { describe, expect, it } from 'vitest'
import { PHYS, SCORE } from './config'
import type { Course } from './course'
import { createSim, stepSim, type Input, type SimEvent } from './sim'
import { judgeLanding } from './tricks'

const idle: Input = { left: false, right: false, up: false, down: false, jump: false, jumpHeld: false, grab: false }
const DT = 1 / 120

const emptyCourse = (over: Partial<Course> = {}): Course => ({ obstacles: [], ramps: [], gates: [], liftX: -100, length: 5000, ...over })

function run(sim: ReturnType<typeof createSim>, seconds: number, input: (t: number) => Partial<Input> = () => ({})) {
  const events: SimEvent[] = []
  for (let t = 0; t < seconds; t += DT) events.push(...stepSim(sim, { ...idle, ...input(t) }, DT))
  return events
}

describe('judgeLanding', () => {
  it('names and scores a clean backflip 360 with a grab', () => {
    const r = judgeLanding(Math.PI * 2, Math.PI * 2, 0.5, 1.2)
    expect(r).toMatchObject({ clean: true, name: 'Cork 360 Grab', switchStance: false })
  })

  it('adds Shifty to a flip, but not to a spin', () => {
    expect(judgeLanding(0, Math.PI * 2, 0, 1.2, Math.PI / 2)).toMatchObject({ name: 'Backflip Shifty' })
    expect(judgeLanding(Math.PI * 2, 0, 0, 1.2, Math.PI * 2)).toMatchObject({ name: '360' })
  })

  it('names multi-flip corks', () => {
    expect(judgeLanding(Math.PI * 6, -Math.PI * 4, 0, 2)).toMatchObject({ clean: true, name: 'Double Cork 1080' })
  })

  it('lands a 180 switch', () => {
    expect(judgeLanding(Math.PI + 0.2, 0, 0, 0.6)).toMatchObject({ clean: true, name: '180', switchStance: true })
  })

  it('rejects sideways and over-rotated landings', () => {
    expect(judgeLanding(Math.PI / 2, 0, 0, 1).clean).toBe(false)
    expect(judgeLanding(0, Math.PI, 0, 1).clean).toBe(false)
  })
})

describe('stepSim', () => {
  // Hold a key for `hold` seconds after takeoff, then let go and let the assist finish.
  function tapInAir(key: keyof Input, hold: number) {
    const sim = createSim(emptyCourse({ ramps: [{ x: 0, z: 30, w: 4.5, l: 5, h: 1.3 }] }))
    sim.skier.speed = 12
    const events = run(sim, 4, () => (sim.skier.airborne && sim.skier.airTime < hold ? { [key]: true } : {}))
    return events.find((e) => e.type === 'trick' || e.type === 'crash')
  }

  it('a quick twist that swings back is a shifty', () => {
    expect(tapInAir('left', 0.12)).toMatchObject({ type: 'trick', name: 'Shifty' })
  })

  it('a tiny twist is not a shifty', () => {
    expect(tapInAir('right', 0.03)).toMatchObject({ type: 'trick', name: 'Big Air' })
  })

  it('a slightly longer hold commits to a 180', () => {
    expect(tapInAir('right', 0.22)).toMatchObject({ type: 'trick', name: '180' })
  })

  it('a short tap is enough for a 360 — the assist finishes the rotation', () => {
    expect(tapInAir('right', 0.5)).toMatchObject({ type: 'trick', name: '360' })
  })

  it('a short hold of up is enough for a backflip', () => {
    expect(tapInAir('up', 0.55)).toMatchObject({ type: 'trick', name: 'Backflip' })
  })

  it('grabbing through the landing is fine', () => {
    expect(tapInAir('grab', 5)).toMatchObject({ type: 'trick', name: 'Grab' })
  })

  it('accelerates downhill and tuck is faster than brake', () => {
    const tuck = createSim(emptyCourse())
    const brake = createSim(emptyCourse())
    run(tuck, 4, () => ({ down: true }))
    run(brake, 4, () => ({ up: true }))
    expect(tuck.skier.speed).toBeGreaterThan(10)
    expect(brake.skier.speed).toBeLessThan(tuck.skier.speed / 2)
  })

  it('launches off a ramp, spins, and banks the combo after clean riding', () => {
    const sim = createSim(emptyCourse({ ramps: [{ x: 0, z: 30, w: 4.5, l: 5, h: 1.3 }] }))
    sim.skier.speed = 15
    let spun = false
    const events = run(sim, 8, () => {
      if (!sim.skier.airborne) return {}
      // spin until a full 360 is reached, then stop rotating
      if (sim.skier.spin < Math.PI * 2) return { right: true }
      spun = true
      return {}
    })
    expect(spun).toBe(true)
    expect(events.find((e) => e.type === 'jump')).toEqual({ type: 'jump', big: true })
    const trick = events.find((e) => e.type === 'trick')
    expect(trick).toMatchObject({ name: expect.stringMatching(/^(360|540)$/) })
    expect(events.some((e) => e.type === 'bank')).toBe(true)
    expect(sim.style).toBeGreaterThan(0)
  })

  it('crash wipes the unbanked combo and cuts speed', () => {
    const sim = createSim(emptyCourse({ obstacles: [{ kind: 'tree', x: 0, z: 20, r: 0.7, h: 5, scale: 1, rot: 0 }] }))
    sim.skier.speed = 15
    sim.combo = { base: 500, count: 2, tricks: ['360', 'Backflip'], bankIn: 99 }
    const events = run(sim, 1.5)
    expect(events.find((e) => e.type === 'crash')).toMatchObject({ lost: 1000 })
    expect(sim.combo.count).toBe(0)
    expect(sim.style).toBe(0)
    expect(sim.skier.speed).toBeLessThan(15 * PHYS.crashSpeedFactor + 1)
  })

  it('never crash-loops into the same tree', () => {
    const sim = createSim(emptyCourse({ obstacles: [{ kind: 'tree', x: 0, z: 20, r: 0.7, h: 5, scale: 1, rot: 0 }] }))
    sim.skier.speed = 15
    const events = run(sim, 8)
    expect(events.filter((e) => e.type === 'crash')).toHaveLength(1)
    expect(sim.skier.z).toBeGreaterThan(30)
  })

  it('holding Space on a ramp loads a pop that fires on release, longer holds popping higher', () => {
    // press as the skis reach the kicker, let go at `releaseAt` of the way up
    const airFor = (releaseAt: number | null) => {
      const sim = createSim(emptyCourse({ ramps: [{ x: 0, z: 30, w: 4.5, l: 5, h: 1.3 }] }))
      sim.skier.speed = 12
      let air = 0
      run(sim, 5, () => {
        if (sim.skier.airborne) air = Math.max(air, sim.skier.airTime)
        const p = (sim.skier.z - 27.5) / 5
        return { jumpHeld: releaseAt !== null && !sim.skier.airborne && sim.skier.onRamp && p < releaseAt }
      })
      return air
    }
    const none = airFor(null)
    const early = airFor(0.15)
    const late = airFor(0.85)
    expect(early).toBeGreaterThan(none)
    expect(late).toBeGreaterThan(early)
  })

  it('releasing the pop mid-ramp launches immediately instead of waiting for the natural lip', () => {
    const sim = createSim(emptyCourse({ ramps: [{ x: 0, z: 30, w: 4.5, l: 5, h: 1.3 }] }))
    sim.skier.speed = 12
    let launchedAt = -1
    const events = run(sim, 5, () => {
      const p = (sim.skier.z - 27.5) / 5
      if (sim.skier.airborne && launchedAt < 0) launchedAt = p
      return { jumpHeld: !sim.skier.airborne && sim.skier.onRamp && p < 0.4 }
    })
    expect(events.find((e) => e.type === 'jump')).toEqual({ type: 'jump', big: true })
    expect(events.some((e) => e.type === 'pop')).toBe(true)
    expect(launchedAt).toBeLessThan(0.6)
  })

  it('on flat snow, Space loads while held and a longer hold ollies higher on release', () => {
    const airFor = (hold: number) => {
      const sim = createSim(emptyCourse())
      sim.skier.speed = 10
      let air = 0
      const events = run(sim, 3, (t) => {
        if (sim.skier.airborne) air = Math.max(air, sim.skier.airTime)
        return { jumpHeld: t < hold }
      })
      return { air, jumped: events.filter((e) => e.type === 'jump').length }
    }
    const tap = airFor(0.02)
    const loaded = airFor(0.5)
    expect(tap.jumped).toBe(1)
    expect(loaded.jumped).toBe(1)
    expect(loaded.air).toBeGreaterThan(tap.air)
  })

  it('holding Space does not jump until it is released', () => {
    const sim = createSim(emptyCourse())
    sim.skier.speed = 10
    const events = run(sim, 1, () => ({ jumpHeld: true }))
    expect(events.some((e) => e.type === 'jump')).toBe(false)
    expect(sim.skier.pop).toBe(1)
  })

  it('bigger ramps give more air', () => {
    const airFor = (h: number) => {
      const sim = createSim(emptyCourse({ ramps: [{ x: 0, z: 30, w: 4.5, l: 5, h }] }))
      sim.skier.speed = 12
      let air = 0
      run(sim, 5, () => ((air = Math.max(air, sim.skier.airborne ? sim.skier.airTime : 0)), {}))
      return air
    }
    expect(airFor(2.2)).toBeGreaterThan(airFor(0.8) + 0.4)
  })

  it('clock stops at the line; a trick landed past it still counts; results after stopping', () => {
    const sim = createSim(emptyCourse({ length: 40, ramps: [{ x: 0, z: 38, w: 4.5, l: 5, h: 1.3 }] }))
    sim.skier.speed = 14
    const events = run(sim, 10, () => (sim.skier.airborne && sim.skier.airTime < 0.5 ? { right: true } : {}))
    const cross = events.findIndex((e) => e.type === 'cross')
    const trick = events.findIndex((e) => e.type === 'trick')
    const finish = events.findIndex((e) => e.type === 'finish')
    expect(cross).toBeGreaterThan(-1)
    expect(trick).toBeGreaterThan(cross)
    expect(finish).toBeGreaterThan(trick)
    expect(sim.style).toBeGreaterThan(0)
    expect(sim.time).toBeLessThan(4)
    expect(sim.skier.speed).toBeLessThan(1)
  })

  it('awards gate bonus and finishes the course', () => {
    const sim = createSim(emptyCourse({ length: 40, gates: [{ x: 0, z: 20, halfWidth: 3, color: 'red' }] }))
    sim.skier.speed = 12
    const events = run(sim, 6)
    expect(events.filter((e) => e.type === 'gate')).toHaveLength(1)
    expect(events.at(-1)).toEqual({ type: 'finish' })
    expect(sim.style).toBe(SCORE.gate)
  })
})
