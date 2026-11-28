import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

import { play, silence, updateAmbience } from '../game/audio'
import { LOOP, PHYS } from '../game/config'
import { attachInput, readInput } from '../game/input'
import { advance, poseOf } from '../game/loop'
import { record } from '../game/replay'
import { drawPose, runtime } from '../game/runtime'
import { assistTarget, type Input, stepSim, timeBonus, type SimEvent } from '../game/sim'
import { canSendPhase, sendPhase, useGame } from '../game/store'
import { terrainHeight } from '../game/terrain'
import { judgeLanding } from '../game/tricks'
import { createRig, fogFor, updateRig } from './cameraRig'
import { spawnPuff } from './puffs'

const SUN_OFFSET = new THREE.Vector3(40, 30, -26)

let shake = 0

function puffAtSkier(count: number, power: number) {
  const s = runtime.sim.skier
  spawnPuff(s.x, terrainHeight(s.x, s.z), s.z, count, power, Math.sin(s.heading) * s.speed * 0.3, Math.cos(s.heading) * s.speed * 0.3)
}

function handle(events: SimEvent[]) {
  const game = useGame.getState()
  for (const e of events) {
    switch (e.type) {
      case 'jump':
        play(e.big ? 'bigJump' : 'jump')
        runtime.takeoff = 1 // loaded knees spring straight on takeoff
        break
      case 'pop':
        play('jump', 0.8)
        game.pushToast({ text: 'Pop!', tone: 'gate' })
        break
      case 'cross':
        play('finish')
        game.pushToast({ text: 'Finish!', sub: 'land it and stop', tone: 'bank' })
        break
      case 'land':
        play('land', 0.8)
        runtime.landing = 1
        puffAtSkier(10, 0.4)
        break
      case 'trick':
        play('trick')
        game.pushToast({ text: e.name, sub: `+${e.points}${e.combo > 1 ? `  ×${e.combo}` : ''}`, tone: 'trick' })
        break
      case 'bank':
        play('bank')
        game.pushToast({ text: `+${e.points}`, sub: 'combo banked', tone: 'bank' })
        break
      case 'crash':
        play('crash')
        puffAtSkier(45, 1)
        shake = 0.6
        game.pushToast(e.lost > 0 ? { text: e.reason, sub: `lost ${e.lost} pts`, tone: 'crash' } : { text: e.reason, tone: 'crash' })
        break
      case 'gate':
        play('gate', 0.6)
        break
      case 'finish': {
        silence()
        const { time, style } = runtime.sim
        const bonus = timeBonus(time)
        game.finish({ time, style, bonus, total: style + bonus })
        break
      }
    }
  }
}

/** What you'd land if you let go of the arrows right now (the assist finishes the rotation). */
function airReadout(spin: number, flip: number, grabTime: number, airTime: number, peakSpin: number) {
  const spinTo = assistTarget(spin, Math.PI, PHYS.firstSpinCommit, PHYS.spinCommit)
  const flipTo = assistTarget(flip, Math.PI * 2, PHYS.flipCommit, PHYS.flipCommit)
  const shiftyPeak = Math.max(peakSpin, spinTo === 0 ? Math.abs(spin) : 0)
  const next = judgeLanding(spinTo, flipTo, grabTime, airTime, shiftyPeak)
  return next.clean && next.name !== null ? `${next.name}…` : '…'
}

export function GameLoop({ sun }: { sun: React.RefObject<THREE.DirectionalLight | null> }) {
  const hudTimer = useRef(0)
  const rig = useRef(createRig(useGame.getState().camera))
  // the last step's input, for the ambience on frames that run no step (displays faster than 120 Hz)
  const lastInput = useRef<Input | null>(null)

  useEffect(() => attachInput(), [])

  // Keyboard shortcuts for menus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (canSendPhase({ type: 'PAUSE' })) {
          sendPhase({ type: 'PAUSE' })
          silence()
        } else sendPhase({ type: 'RESUME' })
      } else if (e.code === 'KeyC' && !e.repeat) useGame.getState().cycleCamera()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useFrame(({ camera, scene }, delta) => {
    const { phase, camera: mode } = useGame.getState()
    const { sim } = runtime
    const s = sim.skier

    if (phase === 'playing') {
      // Fixed 120 Hz steps whatever the display rate; each step reads (and records) its own input,
      // so a jump tap reaches only the first step after the keydown.
      advance(runtime.clock, delta, () => {
        poseOf(s, runtime.prev)
        const input = readInput()
        if (mode === 'chase') {
          // looking downhill mirrors the screen: keep ← meaning "towards screen left"
          const { left, right } = input
          input.left = right
          input.right = left
        }
        record(runtime.recording, input)
        lastInput.current = input
        handle(stepSim(sim, input, LOOP.dt))
        return !sim.finished
      })
      const turning = lastInput.current !== null && (lastInput.current.left || lastInput.current.right)
      updateAmbience(s.speed, turning ? 1 : 0.2, s.airborne)

      hudTimer.current += delta
      if (hudTimer.current > 0.05) {
        hudTimer.current = 0
        const c = sim.combo
        useGame.setState({
          hud: { time: sim.time, distance: Math.min(s.z, sim.course.length), speed: s.speed * 3.6, style: sim.style },
          combo: c.count > 0 ? { tricks: [...c.tricks], base: c.base, count: c.count } : null,
          air: s.airborne ? airReadout(s.spin, s.flip, s.grabTime, s.airTime, s.peakSpin) : null,
        })
      }
    }
    // the skier and camera are drawn between the last two steps, so motion stays smooth at any frame rate
    const pose = drawPose()

    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const focus = updateRig(rig.current, camera, pose, mode, delta, phase === 'menu')
    if (scene.fog instanceof THREE.Fog) [scene.fog.near, scene.fog.far] = fogFor(rig.current.blend)
    if (shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.z += (Math.random() - 0.5) * shake
      shake *= Math.exp(-delta * 7)
    }

    const light = sun.current
    if (light) {
      light.position.copy(focus).add(SUN_OFFSET)
      light.target.position.copy(focus)
      light.target.updateMatrixWorld()
    }
  }, -1)

  return null
}
