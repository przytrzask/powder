import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { PHYS } from '../game/config'
import { runtime } from '../game/runtime'
import { terrainHeight } from '../game/terrain'

const JACKET = '#e0307a'
const PANTS = '#2a6fdb'
const HELMET = '#d62839'
const SKI = '#c6e03a'
const SCALE = 1.7

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
  const root = useRef<THREE.Group>(null!)
  const pivot = useRef<THREE.Group>(null!) // flips/falls rotate around the hips
  const body = useRef<THREE.Group>(null!) // crouch
  const armL = useRef<THREE.Group>(null!)
  const armR = useRef<THREE.Group>(null!)
  const skis = useRef<THREE.Group>(null!)
  const poles = useRef<THREE.Mesh[]>([])
  const gear = useRef<THREE.Group>(null!)
  const loose = useRef<Loose[]>([])
  const yaw = useRef(0)
  const crashYaw = useRef(0)
  const wasCrashed = useRef(false)

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
      body.current.scale.y = 1
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

    // Grab: knees up, skis tweaked, right hand reaches back to the ski tail, left arm out for style.
    const g = s.grabbing
    const crouch = g ? 0.55 : s.tuck || s.airborne ? 0.8 : 1
    body.current.scale.y = damp(body.current.scale.y, crouch, 14, dt)
    skis.current.position.y = damp(skis.current.position.y, g ? 0.45 : 0, 16, dt)
    skis.current.rotation.z = damp(skis.current.rotation.z, g ? -0.5 : 0, 16, dt)
    skis.current.rotation.x = damp(skis.current.rotation.x, g ? -0.35 : 0, 16, dt)
    armL.current.rotation.x = damp(armL.current.rotation.x, g ? -0.3 : s.tuck ? 0.9 : 0.3, 14, dt)
    armL.current.rotation.z = damp(armL.current.rotation.z, g ? -1.3 : 0, 14, dt)
    armR.current.rotation.x = damp(armR.current.rotation.x, g ? 1.1 : s.tuck ? 0.9 : 0.3, 14, dt)
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
                <mesh key={x} position={[x, 0.04, 0.1]} castShadow>
                  <boxGeometry args={[0.12, 0.05, 1.8]} />
                  <meshStandardMaterial color={SKI} roughness={0.4} />
                </mesh>
              ))}
            </group>
            <group ref={body}>
              {/* legs */}
              {[-0.16, 0.16].map((x) => (
                <mesh key={x} position={[x, 0.42, 0]} castShadow>
                  <boxGeometry args={[0.17, 0.75, 0.2]} />
                  <meshStandardMaterial color={PANTS} />
                </mesh>
              ))}
              {/* torso */}
              <mesh position={[0, 1.05, 0]} castShadow>
                <boxGeometry args={[0.52, 0.6, 0.32]} />
                <meshStandardMaterial color={JACKET} />
              </mesh>
              {/* backpack stripe to read facing from above */}
              <mesh position={[0, 1.1, -0.17]} castShadow>
                <boxGeometry args={[0.36, 0.4, 0.08]} />
                <meshStandardMaterial color="#2bb3a3" />
              </mesh>
              {/* head */}
              <mesh position={[0, 1.55, 0]} castShadow>
                <sphereGeometry args={[0.2, 12, 10]} />
                <meshStandardMaterial color={HELMET} roughness={0.35} />
              </mesh>
              <mesh position={[0, 1.55, 0.14]}>
                <boxGeometry args={[0.3, 0.1, 0.1]} />
                <meshStandardMaterial color="#f6c445" metalness={0.4} roughness={0.2} />
              </mesh>
              {/* arms with poles */}
              {[
                { ref: armL, x: -0.33 },
                { ref: armR, x: 0.33 },
              ].map(({ ref, x }, i) => (
                <group key={x} ref={ref} position={[x, 1.28, 0]}>
                  <mesh position={[0, -0.28, 0]} castShadow>
                    <boxGeometry args={[0.13, 0.56, 0.13]} />
                    <meshStandardMaterial color={JACKET} />
                  </mesh>
                  <mesh ref={(m) => void (m && (poles.current[i] = m))} position={[0, -0.6, -0.35]} rotation={[0.6, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.015, 0.015, 1.2, 4]} />
                    <meshStandardMaterial color="#222" />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>

      {/* loose gear for wipeouts, in world space */}
      <group ref={gear} visible={false}>
        {[0, 1].map((i) => (
          <mesh key={`ski${i}`} ref={addLoose} castShadow scale={SCALE}>
            <boxGeometry args={[0.12, 0.05, 1.8]} />
            <meshStandardMaterial color={SKI} roughness={0.4} />
          </mesh>
        ))}
        {[0, 1].map((i) => (
          <mesh key={`pole${i}`} ref={addLoose} userData={{ restX: Math.PI / 2 }} castShadow scale={SCALE}>
            <cylinderGeometry args={[0.02, 0.02, 1.2, 4]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        ))}
      </group>
    </>
  )
}
