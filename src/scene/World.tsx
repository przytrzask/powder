import { Canvas } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { Features } from './Features'
import { GameLoop } from './GameLoop'
import { Obstacles } from './Obstacles'
import { Skier } from './Skier'
import { SnowPuffs } from './SnowPuffs'
import { Terrain } from './Terrain'
import { Tracks } from './Tracks'

function Scene() {
  const sun = useRef<THREE.DirectionalLight>(null)
  return (
    <>
      <color attach="background" args={['#e9eff7']} />
      {/* distances are driven per camera mode in GameLoop */}
      <fog attach="fog" args={['#e9eff7', 150, 400]} />
      <hemisphereLight args={['#f2f6ff', '#6f8cc4', 1.5]} />
      <directionalLight
        ref={sun}
        intensity={3.2}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={4}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-camera-bottom={-65}
        shadow-camera-near={1}
        shadow-camera-far={180}
      />
      <Terrain />
      <Obstacles />
      <Features />
      <Tracks />
      <Suspense fallback={null}>
        <Skier />
      </Suspense>
      <SnowPuffs />
      <GameLoop sun={sun} />
    </>
  )
}

export function World() {
  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} camera={{ fov: 38, near: 1, far: 260 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
      <Scene />
    </Canvas>
  )
}
