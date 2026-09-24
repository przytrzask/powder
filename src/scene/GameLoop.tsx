import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { play, silence, updateAmbience } from '../game/audio'
import { attachInput, readInput } from '../game/input'
import { runtime } from '../game/runtime'
import { PHYS } from '../game/config'
import { assistTarget, stepSim, timeBonus, type SimEvent } from '../game/sim'
import { judgeLanding } from '../game/tricks'
import { terrainHeight } from '../game/terrain'
import { spawnPuff } from './SnowPuffs'
import { useGame } from '../game/store'

const SUBSTEPS = 2
const CAM_OFFSET = new THREE.Vector3(0, 58, 24)
const LOOK_AHEAD = 7
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
        game.pushToast({ text: e.reason, sub: e.lost > 0 ? `lost ${e.lost} pts` : undefined, tone: 'crash' })
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
  return next.clean && next.name ? `${next.name}…` : '…'
}

export function GameLoop({ sun }: { sun: React.RefObject<THREE.DirectionalLight | null> }) {
  const camera = useThree((s) => s.camera)
  const hudTimer = useRef(0)
  const camTarget = useRef(new THREE.Vector3())

  useEffect(() => attachInput(), [])

  // Keyboard shortcuts for menus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { phase, setPhase } = useGame.getState()
      if (e.code === 'Escape' && phase === 'playing') {
        setPhase('paused')
        silence()
      } else if (e.code === 'Escape' && phase === 'paused') setPhase('playing')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useFrame((_, delta) => {
    const phase = useGame.getState().phase
    const sim = runtime.sim
    const s = sim.skier

    if (phase === 'playing') {
      const dt = Math.min(delta, 1 / 20) / SUBSTEPS
      const input = readInput()
      for (let i = 0; i < SUBSTEPS; i++) {
        handle(stepSim(sim, i === 0 ? input : { ...input, jump: false }, dt))
        if (sim.finished) break
      }
      updateAmbience(s.speed, input.left || input.right ? 1 : 0.2, s.airborne)

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

    // Camera follows smoothly from above, looking a bit downhill of the skier.
    const k = 1 - Math.exp(-delta * 6)
    camTarget.current.lerp(new THREE.Vector3(s.x * 0.85, 0, s.z + LOOK_AHEAD), phase === 'menu' ? 1 : k)
    camera.position.copy(camTarget.current).add(CAM_OFFSET)
    camera.lookAt(camTarget.current)
    if (shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.z += (Math.random() - 0.5) * shake
      shake *= Math.exp(-delta * 7)
    }

    const light = sun.current
    if (light) {
      light.position.copy(camTarget.current).add(SUN_OFFSET)
      light.target.position.copy(camTarget.current)
      light.target.updateMatrixWorld()
    }
  }, -1)

  return null
}
