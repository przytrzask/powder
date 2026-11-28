/** Pool of snow chunks thrown up by landings and crashes; SnowPuffs.tsx animates and draws them. */
export const POOL = 240

export type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number }

export const particles: Particle[] = Array.from({ length: POOL }, () => ({
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  age: 1,
  life: 1,
  size: 0,
}))
let cursor = 0

/** Burst of snow chunks. `power` scales speed and size; 1 = crash, ~0.3 = landing. */
export function spawnPuff(x: number, y: number, z: number, count: number, power: number, dirX = 0, dirZ = 0) {
  for (let i = 0; i < count; i++) {
    const p = particles[cursor]
    cursor = (cursor + 1) % POOL
    if (!p) continue
    const a = Math.random() * Math.PI * 2
    const sp = (1.5 + Math.random() * 4) * power
    p.x = x + (Math.random() - 0.5) * 0.6
    p.y = y + 0.2
    p.z = z + (Math.random() - 0.5) * 0.6
    p.vx = Math.cos(a) * sp + dirX * power
    p.vz = Math.sin(a) * sp + dirZ * power
    p.vy = (2 + Math.random() * 5) * power
    p.age = 0
    p.life = 0.6 + Math.random() * 0.7
    p.size = (0.15 + Math.random() * 0.3) * (0.5 + power * 0.7)
  }
}
