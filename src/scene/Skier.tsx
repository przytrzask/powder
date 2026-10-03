import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PHYS } from '../game/config'
import { runtime } from '../game/runtime'
import type { Skier as SkierState } from '../game/sim'
import { CHARACTERS, type CharacterId, useGame } from '../game/store'
import { terrainHeight } from '../game/terrain'

// Built in Blender by art/skier*.py: one mesh per animated part, origins at the joints,
// flat colours baked into vertex colours so a single material covers the whole skier.
// Every character shares the same parts and joints, so they swap freely.
const modelUrl = (character: CharacterId) => `${import.meta.env.BASE_URL}models/${character}.glb`
const SCALE = 1.7
// pole grip sits in the glove, tip trailing behind
const POLE_IN_HAND = { position: [0, -0.945, -0.339] as const, rotation: [0.6, 0, 0] as const }
// waist joint: top of Legs, origin of Torso — matches HIP_Y in art/lowpoly.py
const ANKLE_Y = 0.2
const KNEE_Y = 0.47
const HIP_Y = 0.8
const SHOULDER_Y = 1.28 - HIP_Y // shoulder height in the Torso's own (hip-relative) frame

function useSkierModel() {
  const character = useGame((s) => s.character)
  const { nodes } = useGLTF(modelUrl(character))
  const geometry = (name: string) => (nodes[name] as THREE.Mesh).geometry
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }), [])
  return {
    boots: geometry('Boots'),
    shins: geometry('Shins'),
    thighs: geometry('Thighs'),
    torso: geometry('Torso'),
    arm: geometry('ArmL'),
    ski: geometry('SkiL'),
    pole: geometry('PoleL'),
    material,
  }
}

const damp = THREE.MathUtils.damp
const smooth = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1)
/** Wrap to [-π, π) so rotations always ease the short way round (no unwinding after a 360). */
const wrap = (a: number) => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI
/** Damp an angle toward a target along the shortest arc. */
const dampAngle = (current: number, target: number, lambda: number, dt: number) => target + damp(wrap(current - target), 0, lambda, dt)

/** 0 → 1 fall over, hold while sliding, 1 → 0 get back up. */
function lieAmount(p: number) {
  if (p < 0.12) return smooth(p / 0.12)
  if (p > 0.8) return 1 - smooth((p - 0.8) / 0.2)
  return 1
}

/** A stiff, slightly underdamped spring: gets to its target in ~0.08s with a small overshoot. */
type Spring = { x: number; v: number }
const spring = (): Spring => ({ x: 0, v: 0 })
function stepSpring(sp: Spring, target: number, stiffness: number, damping: number, dt: number) {
  const n = Math.ceil(dt * 240) // small substeps keep it stable at low frame rates
  const h = dt / n
  for (let i = 0; i < n; i++) {
    sp.v += ((target - sp.x) * stiffness - sp.v * damping) * h
    sp.x += sp.v * h
  }
  return sp.x
}

// How the joints share a crouch of 1: shins tip forward (knees out over the toes), thighs fold
// back twice as much (hips drop and sit back over the heels), torso leans in to stay balanced.
const SHIN_PER_CROUCH = 0.7
const THIGH_PER_CROUCH = -1.6
const HIP_PER_CROUCH = 1.25

const TAKEOFF_TIME = 0.14 // legs snap straight and arms swing up right after the pop
const LANDING_TIME = 0.2 // knees soak up the landing

/** crouch: 0 standing tall, 1 deep; lean: extra torso tilt forward; arms: swing (+ back, - forward). */
function poseTarget(s: SkierState, takeoff: number, landing: number) {
  if (takeoff > 0) return { crouch: -0.05, lean: -0.08, arms: -1.1 } // full extension, arms drive up
  if (landing > 0) return { crouch: 1, lean: 0.2, arms: -0.35 }
  if (s.grabbing) return { crouch: 1.15, lean: 0.05, arms: 0 } // knees pulled right up to the skis
  if (!s.airborne && s.pop > 0) {
    // Space held: sink lower as the pop loads, arms wind back ready to swing
    return { crouch: 0.25 + 0.7 * s.pop, lean: -0.1 * s.pop, arms: 0.3 + 0.3 * s.pop }
  }
  if (s.tuck) return { crouch: 0.85, lean: 0.45, arms: 0.9 } // aero tuck: chest low over the tips
  if (s.airborne) return { crouch: 0.5, lean: 0.05, arms: 0.1 } // compact, balanced stance for spins/flips
  return { crouch: 0.15, lean: 0.03, arms: 0.3 } // relaxed ready stance, knees soft
}

/** `restX` is the x rotation at which the piece lies flat (poles are upright cylinders). */
type Loose = { mesh: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; restX: number }

/** Skis and poles that fly off in a wipeout ("yard sale") and lie in the snow until you get up. */
function launchGear(gear: THREE.Group, loose: Loose[], from: THREE.Vector3, heading: number, speed: number) {
  gear.visible = true
  const fx = Math.sin(heading)
  const fz = Math.cos(heading)
  loose.forEach((l, i) => {
    const side = i % 2 ? 1 : -1
    l.mesh.position.copy(from)
    l.mesh.position.y += 1
    l.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    l.vel.set(fx * speed * 0.7 + side * (2 + Math.random() * 3) * fz, 4 + Math.random() * 4, fz * speed * 0.7 - side * (2 + Math.random() * 3) * fx)
    l.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16)
  })
}

function updateGear(loose: Loose[], dt: number) {
  for (const l of loose) {
    const p = l.mesh.position
    l.vel.y -= 18 * dt
    p.addScaledVector(l.vel, dt)
    const ground = terrainHeight(p.x, p.z) + 0.05
    if (p.y <= ground) {
      // hit the snow: stop bouncing, slide to a halt and settle flat
      p.y = ground
      l.vel.y = Math.abs(l.vel.y) > 3 ? Math.abs(l.vel.y) * 0.25 : 0
      l.vel.x *= 1 - Math.min(1, dt * 4)
      l.vel.z *= 1 - Math.min(1, dt * 4)
      l.spin.multiplyScalar(1 - Math.min(1, dt * 6))
      l.mesh.rotation.x = damp(l.mesh.rotation.x, l.restX, 8, dt)
      l.mesh.rotation.z = damp(l.mesh.rotation.z, 0, 8, dt)
    }
    l.mesh.rotation.x += l.spin.x * dt
    l.mesh.rotation.y += l.spin.y * dt
    l.mesh.rotation.z += l.spin.z * dt
  }
}

export function Skier() {
  const model = useSkierModel()
  const root = useRef<THREE.Group>(null!)
  const pivot = useRef<THREE.Group>(null!) // flips/falls rotate around the hips
  const shins = useRef<THREE.Group>(null!) // pivot at the ankle
  const thighs = useRef<THREE.Group>(null!) // pivot at the knee
  const hip = useRef<THREE.Group>(null!) // pivot at the waist, carries torso and arms
  const armL = useRef<THREE.Group>(null!)
  const armR = useRef<THREE.Group>(null!)
  const skis = useRef<THREE.Group>(null!)
  const poles = useRef<THREE.Mesh[]>([])
  const gear = useRef<THREE.Group>(null!)
  const loose = useRef<Loose[]>([])
  const yaw = useRef(0)
  const crashYaw = useRef(0)
  const wasCrashed = useRef(false)
  const pose = useRef({ crouch: spring(), lean: spring(), armL: spring(), armR: spring(), takeoff: 0, landing: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const s = runtime.sim.skier
    const ground = terrainHeight(s.x, s.z)
    const crashed = s.crashT > 0

    if (crashed && !wasCrashed.current) {
      crashYaw.current = 0
      launchGear(gear.current, loose.current, root.current.position, s.heading, Math.max(s.speed, 4))
    }
    if (!crashed && wasCrashed.current) {
      gear.current.visible = false
    }
    wasCrashed.current = crashed
    skis.current.visible = !crashed
    for (const p of poles.current) p.visible = !crashed
    if (gear.current.visible) updateGear(loose.current, dt)

    // blink while invulnerable after getting up
    root.current.visible = s.recoverT <= 0 || Math.floor(s.recoverT * 10) % 2 === 0

    if (crashed) {
      const p = 1 - s.crashT / PHYS.crashDuration
      const lie = lieAmount(p)
      // impact hop, then face-plant and slide spinning like a starfish
      const hop = p < 0.2 ? Math.sin((p / 0.2) * Math.PI) * 0.7 : 0
      root.current.position.set(s.x, ground + hop, s.z)
      crashYaw.current += s.tumbleDir * 10 * (1 - p) ** 2 * dt
      yaw.current = s.heading + crashYaw.current
      root.current.rotation.y = yaw.current
      pivot.current.rotation.set(lie * Math.PI * 0.47, 0, 0)
      pivot.current.position.y = 0.8 - 0.55 * lie
      shins.current.rotation.x = thighs.current.rotation.x = hip.current.rotation.x = 0
      const ps = pose.current
      for (const sp of [ps.crouch, ps.lean, ps.armL, ps.armR]) sp.x = sp.v = 0
      ps.takeoff = ps.landing = runtime.takeoff = runtime.landing = 0
      armL.current.rotation.set(-0.4 * lie, 0, -1.4 * lie)
      armR.current.rotation.set(-0.4 * lie, 0, 1.4 * lie)
      return
    }

    root.current.position.set(s.x, ground + s.y, s.z)
    pivot.current.position.y = damp(pivot.current.position.y, 0.8, 12, dt)
    const lean = s.airborne ? 0 : THREE.MathUtils.clamp(s.heading * 0.4, -0.35, 0.35)
    const targetYaw = s.heading + s.spin + (s.switchStance ? Math.PI : 0)
    yaw.current = s.airborne ? targetYaw : dampAngle(yaw.current, targetYaw, 18, dt)
    root.current.rotation.y = yaw.current
    pivot.current.rotation.x = s.airborne ? -s.flip : dampAngle(pivot.current.rotation.x, 0, 20, dt)
    // grabs tweak the whole body sideways so they read from above
    pivot.current.rotation.z = damp(pivot.current.rotation.z, s.grabbing ? 0.45 : -lean, 10, dt)

    // Legs: ankle, knee and hip share one crouch so the hips drop over the feet (a real knee
    // bend, not a squash). Springs make the release snap: hold Space and the skier sinks, let go
    // and the legs fire straight with the arms swinging up, then fold into the air stance.
    const ps = pose.current
    if (runtime.takeoff) ps.takeoff = TAKEOFF_TIME
    if (runtime.landing) ps.landing = LANDING_TIME
    runtime.takeoff = runtime.landing = 0
    ps.takeoff = Math.max(0, ps.takeoff - dt)
    ps.landing = Math.max(0, ps.landing - dt)
    const target = poseTarget(s, ps.takeoff, ps.landing)
    const snap = ps.takeoff > 0 ? 1400 : 700 // stiffer on the pop so the release is instant
    const crouch = stepSpring(ps.crouch, target.crouch, snap, 2 * 0.62 * Math.sqrt(snap), dt)
    const torsoLean = stepSpring(ps.lean, target.lean, 500, 32, dt)
    shins.current.rotation.x = SHIN_PER_CROUCH * Math.max(crouch, -0.05)
    thighs.current.rotation.x = THIGH_PER_CROUCH * crouch
    hip.current.rotation.x = HIP_PER_CROUCH * crouch + torsoLean

    // Grab: skis tweaked up toward the bent knees, right hand reaches back to the ski tail, left arm out for style.
    const g = s.grabbing
    skis.current.position.y = damp(skis.current.position.y, g ? 0.34 : 0, 16, dt)
    skis.current.rotation.z = damp(skis.current.rotation.z, g ? -0.5 : 0, 16, dt)
    skis.current.rotation.x = damp(skis.current.rotation.x, g ? -0.35 : 0, 16, dt)
    const armSnap = ps.takeoff > 0 ? 900 : 450
    armL.current.rotation.x = stepSpring(ps.armL, g ? -0.3 : target.arms, armSnap, 2 * 0.65 * Math.sqrt(armSnap), dt)
    armR.current.rotation.x = stepSpring(ps.armR, g ? 1.1 : target.arms, armSnap, 2 * 0.65 * Math.sqrt(armSnap), dt)
    armL.current.rotation.z = damp(armL.current.rotation.z, g ? -1.3 : 0, 14, dt)
    armR.current.rotation.z = damp(armR.current.rotation.z, g ? 0.5 : 0, 14, dt)
  })

  const addLoose = (mesh: THREE.Object3D | null) => {
    if (mesh && !loose.current.some((l) => l.mesh === mesh)) {
      loose.current.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), restX: mesh.userData.restX ?? 0 })
    }
  }

  return (
    <>
      <group ref={root} scale={SCALE}>
        <group ref={pivot} position={[0, 0.8, 0]}>
          <group position={[0, -0.8, 0]}>
            <group ref={skis}>
              {[-0.16, 0.16].map((x) => (
                <mesh key={x} geometry={model.ski} material={model.material} position={[x, 0.04, 0.1]} castShadow />
              ))}
            </group>
            <mesh geometry={model.boots} material={model.material} castShadow />
            <group ref={shins} position={[0, ANKLE_Y, 0]}>
              <mesh geometry={model.shins} material={model.material} castShadow />
              <group ref={thighs} position={[0, KNEE_Y - ANKLE_Y, 0]}>
                <mesh geometry={model.thighs} material={model.material} castShadow />
                <group ref={hip} position={[0, HIP_Y - KNEE_Y, 0]}>
                  <mesh geometry={model.torso} material={model.material} castShadow />
                  {[
                    { ref: armL, x: -0.33 },
                    { ref: armR, x: 0.33 },
                  ].map(({ ref, x }, i) => (
                    <group key={x} ref={ref} position={[x, SHOULDER_Y, 0]}>
                      <mesh geometry={model.arm} material={model.material} castShadow />
                      <mesh ref={(m) => void (m && (poles.current[i] = m))} geometry={model.pole} material={model.material} {...POLE_IN_HAND} castShadow />
                    </group>
                  ))}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* loose gear for wipeouts, in world space */}
      <group ref={gear} visible={false}>
        {[0, 1].map((i) => (
          <mesh key={`ski${i}`} ref={addLoose} geometry={model.ski} material={model.material} castShadow scale={SCALE} />
        ))}
        {[0, 1].map((i) => (
          <mesh key={`pole${i}`} ref={addLoose} geometry={model.pole} material={model.material} userData={{ restX: Math.PI / 2 }} castShadow scale={SCALE} />
        ))}
      </group>
    </>
  )
}

// load every character up front so switching on the title screen is instant
for (const c of CHARACTERS) useGLTF.preload(modelUrl(c.id))
