import { useFrame } from '@react-three/fiber'
import { Component, type ReactNode, useRef } from 'react'
import type * as THREE from 'three'

import { runtime } from '../game/runtime'
import { terrainHeight } from '../game/terrain'

type BoundaryProps = { fallback: ReactNode; children: ReactNode }

/**
 * Catches a skier model that fails to load (network error, missing file, a part missing from the rig)
 * and draws `fallback` instead, so the game keeps running rather than React unmounting the whole page.
 */
export class SkierModelBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  // React itself reports the caught error (console.error), so there is no componentDidCatch here.
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const SCALE = 1.7
const JACKET = '#e06a2c'
const PANTS = '#2d3a4f'
const SKI = '#1d2533'

/** A stand-in skier from a few low-poly primitives: follows the run like the real model, without the animation. */
export function FallbackSkier() {
  const root = useRef<THREE.Group>(null!)
  const pivot = useRef<THREE.Group>(null!)

  useFrame(() => {
    const at = runtime.pose
    const s = runtime.sim.skier
    root.current.position.set(at.x, terrainHeight(at.x, at.z) + at.y, at.z)
    root.current.rotation.y = at.yaw
    // flips rotate around the hips; a crash just lays it down
    pivot.current.rotation.x = s.crashT > 0 ? Math.PI * 0.45 : -at.flip
  })

  return (
    <group ref={root} scale={SCALE}>
      <group ref={pivot} position={[0, 0.8, 0]}>
        <group position={[0, -0.8, 0]}>
          {[-0.16, 0.16].map((x) => (
            <mesh key={x} position={[x, 0.03, 0.1]} castShadow>
              <boxGeometry args={[0.1, 0.04, 1.4]} />
              <meshStandardMaterial color={SKI} flatShading />
            </mesh>
          ))}
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.13, 0.78, 6]} />
            <meshStandardMaterial color={PANTS} flatShading />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.19, 0.52, 6]} />
            <meshStandardMaterial color={JACKET} flatShading />
          </mesh>
          <mesh position={[0, 1.45, 0]} castShadow>
            <icosahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color={SKI} flatShading />
          </mesh>
        </group>
      </group>
    </group>
  )
}
