import { COURSE } from './config'

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Obstacle = { kind: 'tree' | 'rock' | 'pole'; x: number; z: number; r: number; h: number; scale: number; rot: number }
export type Ramp = { x: number; z: number; w: number; l: number; h: number }
export type Gate = { x: number; z: number; halfWidth: number; color: string }
export type Course = {
  obstacles: Obstacle[]
  ramps: Ramp[]
  gates: Gate[]
  liftX: number
  length: number
}

const LIFT_X = -22
// small / medium / big kickers: height drives launch speed and so air time
const RAMP_SIZES = [
  { w: 4, l: 4, h: 0.8 },
  { w: 4.5, l: 5, h: 1.3 },
  { w: 5.5, l: 7, h: 2.2 },
]
const LIFT_SPACING = 60

export function generateCourse(seed = COURSE.seed): Course {
  const rand = mulberry32(seed)
  const range = (a: number, b: number) => a + rand() * (b - a)
  const obstacles: Obstacle[] = []
  const ramps: Ramp[] = []
  const gates: Gate[] = []
  const { length, width, corridor } = COURSE

  const clearOf = (x: number, z: number, d: number) =>
    obstacles.every((o) => (o.x - x) ** 2 + (o.z - z) ** 2 > (o.r + d) ** 2) &&
    // keep the run-in and the landing zone of every ramp clear
    ramps.every((r) => Math.abs(r.x - x) > r.w / 2 + d + 3 || z < r.z - 15 || z > r.z + 20 + r.h * 12)

  // Features along the fall line: alternate ramps and gate pairs.
  for (let z = 60; z < length - 60; z += range(38, 55)) {
    const x = range(-corridor + 10, corridor - 10)
    if (rand() < 0.5) {
      const size = RAMP_SIZES[Math.floor(rand() * RAMP_SIZES.length)]
      ramps.push({ x, z, ...size })
      z += size.h * 8 // bigger kickers need a longer landing
    } else gates.push({ x, z, halfWidth: 3.2, color: rand() < 0.5 ? '#d7263d' : '#1b998b' })
  }

  // Chairlift poles (decorative line on the left, poles are solid).
  for (let z = 20; z < length; z += LIFT_SPACING) {
    obstacles.push({ kind: 'pole', x: LIFT_X, z, r: 0.5, h: 9, scale: 1, rot: 0 })
  }

  const keepLiftClear = (x: number) => Math.abs(x - LIFT_X) > 3.5

  // Scattered obstacles in the corridor, denser further down.
  for (let z = -30; z < length - 10; z += 2) {
    const density = 0.12 + (z / length) * 0.18
    if (rand() > density) continue
    const x = range(-corridor, corridor)
    if (z < 25 && Math.abs(x) < 12) continue // clear start area
    const kind = rand() < 0.62 ? 'tree' : 'rock'
    const scale = kind === 'tree' ? range(0.8, 1.35) : range(0.6, 1.5)
    const r = kind === 'tree' ? 0.7 * scale : 1.1 * scale
    if (!keepLiftClear(x) || !clearOf(x, z, r + 2.5)) continue
    obstacles.push({ kind, x, z, r, h: kind === 'tree' ? 5 * scale : 1.2 * scale, scale, rot: rand() * Math.PI * 2 })
  }

  // Tree clusters: small groves that give the slope some shape.
  for (let i = 0; i < 26; i++) {
    const cx = range(-corridor, corridor)
    const cz = range(40, length - 20)
    const n = 3 + Math.floor(rand() * 5)
    for (let j = 0; j < n; j++) {
      const x = cx + range(-5, 5)
      const z = cz + range(-5, 5)
      const kind = rand() < 0.75 ? 'tree' : 'rock'
      const scale = range(0.8, 1.4)
      const r = kind === 'tree' ? 0.7 * scale : 1.1 * scale
      if (!keepLiftClear(x) || !clearOf(x, z, r + 1)) continue
      obstacles.push({ kind, x, z, r, h: kind === 'tree' ? 5 * scale : 1.2 * scale, scale, rot: rand() * Math.PI * 2 })
    }
  }

  // Dense forest on both edges.
  for (let z = -40; z < length + 60; z += 1.6) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const x = side * range(corridor + 1, width / 2 + 25)
        const scale = range(0.9, 1.6)
        const kind = rand() < 0.85 ? 'tree' : 'rock'
        obstacles.push({ kind, x, z: z + range(-0.8, 0.8), r: 0.7 * scale, h: 5 * scale, scale, rot: rand() * Math.PI * 2 })
      }
    }
  }

  return { obstacles, ramps, gates, liftX: LIFT_X, length }
}

/** Spatial index: obstacles bucketed by 10m of z so collision checks stay cheap. */
export function bucketObstacles(obstacles: Obstacle[]) {
  const buckets = new Map<number, Obstacle[]>()
  for (const o of obstacles) {
    if (o.kind === 'tree' && Math.abs(o.x) > COURSE.corridor + 4) continue // edge forest handled by clamp
    const key = Math.floor(o.z / 10)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(o)
  }
  return (z: number) => [...(buckets.get(Math.floor(z / 10) - 1) ?? []), ...(buckets.get(Math.floor(z / 10)) ?? []), ...(buckets.get(Math.floor(z / 10) + 1) ?? [])]
}
