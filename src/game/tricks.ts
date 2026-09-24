import { PHYS, SCORE } from './config'

export type Landing =
  | { clean: true; name: string | null; points: number; switchStance: boolean }
  | { clean: false; reason: string }

const residual = (angle: number, period: number) => {
  const r = ((Math.abs(angle) % period) + period) % period
  return Math.min(r, period - r)
}

const FLIP_WORDS = ['', '', 'Double ', 'Triple ', 'Quad ']

/** Judge a landing from the rotation accumulated in the air. */
export function judgeLanding(spin: number, flip: number, grabTime: number, airTime: number, peakSpin = 0): Landing {
  if (residual(spin, Math.PI) > PHYS.landSpinTolerance) return { clean: false, reason: 'Sideways landing' }
  if (residual(flip, Math.PI * 2) > PHYS.landFlipTolerance) return { clean: false, reason: 'Over-rotated' }

  const halfSpins = Math.round(Math.abs(spin) / Math.PI)
  const flips = Math.round(Math.abs(flip) / (Math.PI * 2))
  const parts: string[] = []
  let points = 0

  const flipWord = FLIP_WORDS[Math.min(flips, 4)]
  const spinPoints = halfSpins * SCORE.per180 * (1 + (halfSpins - 1) * 0.25)
  if (flips > 0 && halfSpins > 0) {
    // flip + spin = off-axis cork, worth more than the parts
    parts.push(`${flipWord}Cork ${halfSpins * 180}`)
    points += (flips * SCORE.perFlip + spinPoints) * SCORE.corkBonus
  } else if (flips > 0) {
    parts.push(`${flipWord}${flip < 0 ? 'Frontflip' : 'Backflip'}`)
    points += flips * SCORE.perFlip
  } else if (halfSpins > 0) {
    parts.push(`${halfSpins * 180}`)
    points += spinPoints
  }
  if (halfSpins === 0 && peakSpin >= PHYS.shiftyMin) {
    // twisted ~90° and came back to straight
    parts.push('Shifty')
    points += SCORE.shifty
  }
  if (grabTime >= SCORE.minGrab) {
    parts.push('Grab')
    points += Math.round(grabTime * SCORE.grabPerSecond)
  }
  if (parts.length === 0 && airTime > 0.9) {
    parts.push('Big Air')
    points += 50
  }

  return {
    clean: true,
    name: parts.length ? parts.join(' ') : null,
    points: Math.round(points),
    switchStance: halfSpins % 2 === 1,
  }
}
