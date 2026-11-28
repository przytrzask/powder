import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { runtime } from '../game/runtime'
import { terrainHeight } from '../game/terrain'
import { particles, POOL, spawnPuff } from './puffs'

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
      if (!p || p.age >= p.life) {
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
