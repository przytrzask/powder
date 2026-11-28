import { useMemo } from 'react'
import * as THREE from 'three'

import { COURSE } from '../game/config'
import { RAMP_RUN_IN, type Gate, type Ramp } from '../game/course'
import { course } from '../game/runtime'
import { terrainHeight } from '../game/terrain'

const RAINBOW = ['#e63946', '#f4a261', '#f6d743', '#6ac46a', '#3a86ff', '#8e5bd6']

function RampMesh({ ramp }: { ramp: Ramp }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(ramp.l, 0), new THREE.Vector2(ramp.l, ramp.h)])
    const g = new THREE.ExtrudeGeometry(shape, { depth: ramp.w, bevelEnabled: false })
    g.rotateY(-Math.PI / 2)
    g.translate(ramp.w / 2, 0, -ramp.l / 2)
    return g
  }, [ramp])
  const stripe = ramp.h / RAINBOW.length

  return (
    <group position={[ramp.x, terrainHeight(ramp.x, ramp.z), ramp.z]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#fbfcff" flatShading roughness={0.8} />
      </mesh>
      {RAINBOW.map((c, i) => (
        <mesh key={c} position={[0, ramp.h - stripe * (i + 0.5), ramp.l / 2 + 0.01]}>
          <planeGeometry args={[ramp.w, stripe]} />
          <meshStandardMaterial color={c} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// Run-in markers: flag pairs that narrow toward the kicker, pennants streaming downhill.
// Colour tells the size, like piste difficulty: green small, blue medium, black big.
const RUN_IN_PAIRS = 4
function rampColor(h: number) {
  if (h < 1) return '#3fae4f'
  if (h < 2) return '#2f6fdb'
  return '#23262d'
}

const pennant = (() => {
  const g = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 0.8), new THREE.Vector2(1.5, 0.4)]))
  g.rotateY(-Math.PI / 2) // tip points downhill (+z)
  return g
})()

function RunInFlag({ x, z, side, color }: { x: number; z: number; side: number; color: string }) {
  return (
    <group position={[x, terrainHeight(x, z), z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 5]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* rolled outward so the arrow shape reads from the top-down camera */}
      <mesh geometry={pennant} position={[0, 1.4, 0]} rotation={[0, 0, -side * 1.1]} castShadow>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function RunInFlags({ ramp }: { ramp: Ramp }) {
  const color = rampColor(ramp.h)
  const start = ramp.z - ramp.l / 2
  const flags = []
  for (let i = 0; i < RUN_IN_PAIRS; i++) {
    const t = i / (RUN_IN_PAIRS - 1) // 0 = nearest the kicker
    const z = start - 2 - t * (RAMP_RUN_IN - 2)
    const half = ramp.w / 2 + 0.4 + t * 3
    for (const side of [-1, 1]) flags.push(<RunInFlag key={`${i}:${side}`} x={ramp.x + side * half} z={z} side={side} color={color} />)
  }
  return <>{flags}</>
}

function Flag({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, terrainHeight(x, z), z]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 5]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0.3, 1.5, 0]} castShadow>
        <boxGeometry args={[0.6, 0.45, 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

function GateMesh({ gate }: { gate: Gate }) {
  return (
    <>
      <Flag x={gate.x - gate.halfWidth} z={gate.z} color={gate.color} />
      <Flag x={gate.x + gate.halfWidth} z={gate.z} color={gate.color} />
    </>
  )
}

function Chairlift() {
  const poles = course.obstacles.filter((o) => o.kind === 'pole')
  const length = course.length + 200
  const cableY = 8.2
  const chairs = useMemo(() => {
    const list: { x: number; z: number }[] = []
    for (let z = -60; z < course.length + 100; z += 16) {
      list.push({ x: course.liftX - 1.8, z }, { x: course.liftX + 1.8, z: z + 8 })
    }
    return list
  }, [])

  return (
    <group>
      {poles.map((p) => (
        <group key={p.z} position={[p.x, terrainHeight(p.x, p.z), p.z]}>
          <mesh position={[0, 4.5, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.25, 9, 8]} />
            <meshStandardMaterial color="#8a939e" metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh position={[0, 8.6, 0]} castShadow>
            <boxGeometry args={[4.2, 0.25, 0.35]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
          <mesh position={[0, 7.4, 0]} castShadow>
            <boxGeometry args={[0.5, 0.9, 0.5]} />
            <meshStandardMaterial color="#f2c230" />
          </mesh>
        </group>
      ))}
      {[-1.8, 1.8].map((dx) => (
        <mesh key={dx} position={[course.liftX + dx, cableY, course.length / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, length, 4]} />
          <meshStandardMaterial color="#3b3f46" />
        </mesh>
      ))}
      {chairs.map((c) => (
        <group key={`${c.x}:${c.z}`} position={[c.x, cableY, c.z]}>
          <mesh position={[0, -0.9, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.8, 4]} />
            <meshStandardMaterial color="#3b3f46" />
          </mesh>
          <mesh position={[0, -1.9, 0]} castShadow>
            <boxGeometry args={[1.3, 0.5, 0.7]} />
            <meshStandardMaterial color="#d62839" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FinishLine() {
  const z = course.length
  const w = COURSE.corridor * 2 + 6
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 4
    const ctx = canvas.getContext('2d')!
    for (let x = 0; x < 128; x++)
      for (let y = 0; y < 4; y++) {
        ctx.fillStyle = (x + y) % 2 ? '#1d1f24' : '#ffffff'
        ctx.fillRect(x, y, 1, 1)
      }
    const t = new THREE.CanvasTexture(canvas)
    t.magFilter = THREE.NearestFilter
    return t
  }, [])

  return (
    <group position={[0, 0, z]}>
      {/* overhead banner, reads as a checkered strip from the top-down camera */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 5, 0]} castShadow>
        <planeGeometry args={[w, 3]} />
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (w / 2), 2.5, 0]} castShadow>
          <boxGeometry args={[0.6, 5, 0.6]} />
          <meshStandardMaterial color="#d62839" />
        </mesh>
      ))}
    </group>
  )
}

export function Features() {
  return (
    <>
      {course.ramps.map((r) => (
        <RampMesh key={`${r.x}:${r.z}`} ramp={r} />
      ))}
      {course.ramps.map((r) => (
        <RunInFlags key={`run-in:${r.x}:${r.z}`} ramp={r} />
      ))}
      {course.gates.map((g) => (
        <GateMesh key={`${g.x}:${g.z}`} gate={g} />
      ))}
      <Chairlift />
      <FinishLine />
    </>
  )
}
