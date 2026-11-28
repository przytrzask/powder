import * as THREE from 'three'

import { CAMERA } from '../game/config'
import type { Pose } from '../game/loop'
import type { CameraMode } from '../game/store'
import { terrainHeight } from '../game/terrain'

export type CameraRig = {
  classicTarget: THREE.Vector3
  yaw: number
  ground: number
  /** 0 = classic, 1 = chase; eased so switching modes glides instead of cutting */
  blend: number
}

export const createRig = (mode: CameraMode): CameraRig => ({
  classicTarget: new THREE.Vector3(),
  yaw: 0,
  ground: 0,
  blend: mode === 'chase' ? 1 : 0,
})

const CLASSIC_OFFSET = new THREE.Vector3(...CAMERA.classic.offset)
const pos = new THREE.Vector3()
const look = new THREE.Vector3()
const chasePos = new THREE.Vector3()
const chaseLook = new THREE.Vector3()
const focus = new THREE.Vector3()
const forward = new THREE.Vector3()

const smoothstep = (t: number) => t * t * (3 - 2 * t)
const approach = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt))

/** Places the camera for this frame on the drawn (interpolated) skier pose (`snap` skips the follow smoothing); returns the point the sun's shadow box should centre on. */
export function updateRig(rig: CameraRig, camera: THREE.PerspectiveCamera, s: Pose, mode: CameraMode, dt: number, snap: boolean) {
  const target = mode === 'chase' ? 1 : 0
  rig.blend = THREE.MathUtils.clamp(rig.blend + Math.sign(target - rig.blend) * CAMERA.blendRate * dt, 0, 1)
  const b = smoothstep(rig.blend)

  // Classic: follows smoothly from above, looking a bit downhill of the skier.
  rig.classicTarget.lerp(look.set(s.x * 0.85, 0, s.z + CAMERA.classic.lookAhead), snap ? 1 : 1 - Math.exp(-dt * 6))
  pos.copy(rig.classicTarget).add(CLASSIC_OFFSET)
  look.copy(rig.classicTarget)
  focus.copy(rig.classicTarget)

  // Chase: behind the skier along the travel direction, lifted a little on jumps.
  const c = CAMERA.chase
  rig.yaw = snap ? s.heading : approach(rig.yaw, s.heading, c.yawRate, dt)
  rig.ground = snap ? terrainHeight(s.x, s.z) : approach(rig.ground, terrainHeight(s.x, s.z), 6, dt)
  forward.set(Math.sin(rig.yaw), 0, Math.cos(rig.yaw))
  const pivotY = rig.ground + s.y * c.airLift
  chasePos.set(s.x, pivotY + c.up, s.z).addScaledVector(forward, -c.back)
  chasePos.y = Math.max(chasePos.y, terrainHeight(chasePos.x, chasePos.z) + 1.5) // don't dip into a mogul
  chaseLook.set(s.x, pivotY + 0.8, s.z).addScaledVector(forward, c.lookAhead)

  if (b > 0) {
    pos.lerp(chasePos, b)
    look.lerp(chaseLook, b)
    // shadows matter ahead of the skier, not around it
    focus.lerp(chaseLook.addScaledVector(forward, 25).setY(0), b)
  }

  camera.position.copy(pos)
  camera.lookAt(look)
  const fov = THREE.MathUtils.lerp(CAMERA.classic.fov, c.fov, b)
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
  return focus
}

export function fogFor(blend: number): [near: number, far: number] {
  const b = smoothstep(blend)
  return [
    THREE.MathUtils.lerp(CAMERA.classic.fog[0], CAMERA.chase.fog[0], b),
    THREE.MathUtils.lerp(CAMERA.classic.fog[1], CAMERA.chase.fog[1], b),
  ]
}
