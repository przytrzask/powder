import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../game/runtime'
import { terrainHeight } from '../game/terrain'

const POOL = 240

type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number }

const particles: Particle[] = Array.from({ length: POOL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 1, size: 0 }))
let cursor = 0

/** Burst of snow chunks. `power` scales speed and size; 1 = crash, ~0.3 = landing. */
export function spawnPuff(x: number, y: number, z: number, count: number, power: number, dirX = 0, dirZ = 0) {
  for (let i = 0; i < count; i++) {
    const p = particles[cursor]
    cursor = (cursor + 1) % POOL
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

export function SnowPuffs() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const scale = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    m.makeScale(0, 0, 0)
    for (let i = 0; i < POOL; i++) ref.current.setMatrixAt(i, m)
  }, [m])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const s = runtime.sim.skier
    // spray while sliding through a wipeout
    if (s.crashT > 0 && s.speed > 1.5 && Math.random() < 0.6) {
      spawnPuff(s.x, terrainHeight(s.x, s.z), s.z, 1, 0.35)
    }

    for (let i = 0; i < POOL; i++) {
      const p = particles[i]
      if (p.age >= p.life) {
        m.makeScale(0, 0, 0)
      } else {
        p.age += dt
        p.vy -= 12 * dt
        const drag = 1 - Math.min(1, dt * 2.5)
        p.vx *= drag
        p.vz *= drag
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        const ground = terrainHeight(p.x, p.z)
        if (p.y < ground) {
          p.y = ground
          p.vy = 0
        }
        const k = p.size * Math.sqrt(Math.max(0, 1 - p.age / p.life))
        m.compose(pos.set(p.x, p.y, p.z), q, scale.set(k, k * 0.8, k))
      }
      ref.current.setMatrixAt(i, m)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, POOL]} frustumCulled={false}>
      <meshStandardMaterial color="#ffffff" flatShading roughness={1} />
    </instancedMesh>
  )
}
