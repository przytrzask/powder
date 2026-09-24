import type { Input } from './sim'

const held = new Set<string>()
let jumpQueued = false

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight'])

export function attachInput() {
  const down = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault()
    if (e.code === 'Space' && !e.repeat) jumpQueued = true
    held.add(e.code)
  }
  const up = (e: KeyboardEvent) => held.delete(e.code)
  const clear = () => held.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', clear)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', clear)
  }
}

/** Snapshot of the controls; the jump press is consumed once read. */
export function readInput(): Input {
  const input = {
    left: held.has('ArrowLeft'),
    right: held.has('ArrowRight'),
    up: held.has('ArrowUp'),
    down: held.has('ArrowDown'),
    jump: jumpQueued,
    grab: held.has('ShiftLeft') || held.has('ShiftRight'),
  }
  jumpQueued = false
  return input
}

export function resetInput() {
  held.clear()
  jumpQueued = false
}
