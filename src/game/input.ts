import type { Input } from './sim'

const held = new Set<string>()
let jumpQueued = false

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight'])

function onKeyDown(e: KeyboardEvent) {
  if (GAME_KEYS.has(e.code)) e.preventDefault()
  if (e.code === 'Space' && !e.repeat) jumpQueued = true
  held.add(e.code)
}

function onKeyUp(e: KeyboardEvent) {
  held.delete(e.code)
}

function onBlur() {
  held.clear()
}

export function attachInput() {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  }
}

/** Snapshot of the controls; the jump tap is consumed once read (`jumpHeld` stays live so a ramp
 * pop can be loaded while Space is held and fired the instant it's released). GameLoop reads it once
 * per fixed sim step, so a tap reaches the first step after the keydown. */
export function readInput(): Input {
  const input = {
    left: held.has('ArrowLeft'),
    right: held.has('ArrowRight'),
    up: held.has('ArrowUp'),
    down: held.has('ArrowDown'),
    jump: jumpQueued,
    jumpHeld: held.has('Space'),
    grab: held.has('ShiftLeft') || held.has('ShiftRight'),
  }
  jumpQueued = false
  return input
}

export function resetInput() {
  held.clear()
  jumpQueued = false
}
