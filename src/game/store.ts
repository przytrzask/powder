import { createActor } from 'xstate'
import { create } from 'zustand'

import { COURSE } from './config'
import { type Phase, type PhaseEvent, phaseMachine } from './phases'

export type { Phase } from './phases'

export type Hud = { time: number; distance: number; speed: number; style: number }
export type ComboHud = { tricks: string[]; base: number; count: number } | null
export type Toast = { id: number; text: string; sub?: string; tone: 'trick' | 'bank' | 'crash' | 'gate' }
export type Results = { time: number; style: number; bonus: number; total: number; best: number; newBest: boolean }

export type Option<T extends string> = { id: T; label: string }
/** At least one option, so there is always a first one to fall back to. */
export type Options<T extends string> = readonly [Option<T>, ...Option<T>[]]

export type CameraMode = 'classic' | 'chase'
export const CAMERA_MODES: Options<CameraMode> = [
  { id: 'classic', label: 'Classic' },
  { id: 'chase', label: 'Chase' },
]
const CAMERA_KEY = 'powder.camera'

/** Skier models: `id` is the file in public/models (built by the art/skier*.py scripts). */
export type CharacterId = 'skier' | 'skier-blue'
export const CHARACTERS: Options<CharacterId> = [
  { id: 'skier', label: 'Orange' },
  { id: 'skier-blue', label: 'Blue' },
]
const CHARACTER_KEY = 'powder.character'

/** localStorage, or null when the browser blocks it (privacy mode, disabled cookies, sandboxed frames). */
function readStorage(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Saves if it can; when storage is blocked the value just lasts until the tab closes. */
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // blocked or full: nothing to do, the in-memory store still has the value
  }
}

/** A saved setting, falling back to the first option if the stored value is missing, stale or unreadable. */
function loadSetting<T extends string>(key: string, options: Options<T>): T {
  const saved = readStorage(key)
  return options.find((o) => o.id === saved)?.id ?? options[0].id
}

/** The saved best score, or 0 if there is none or it isn't a usable number (a hand-edited or corrupted save). */
function loadBest(key: string) {
  const best = Number(readStorage(key) ?? 0)
  return Number.isFinite(best) && best >= 0 ? best : 0
}

type State = {
  /** mirrored from `phaseActor`; change it with `sendPhase` */
  phase: Phase
  runId: number
  hud: Hud
  combo: ComboHud
  /** what the current jump would score as if landed now */
  air: string | null
  toasts: Toast[]
  results: Results | null
  camera: CameraMode
  setCamera: (camera: CameraMode) => void
  cycleCamera: () => void
  character: CharacterId
  setCharacter: (character: CharacterId) => void
  newGame: () => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  finish: (r: Omit<Results, 'best' | 'newBest'>) => void
}

let toastId = 0
// per course length, so a longer map doesn't compete with old scores
const BEST_KEY = `powder.best.${COURSE.length}`

/** The game's phase machine (menu → playing ↔ paused → finished). Only `sendPhase` changes the phase. */
export const phaseActor = createActor(phaseMachine).start()

/** Sends a phase event; one the current phase doesn't accept is ignored. */
export function sendPhase(event: PhaseEvent) {
  phaseActor.send(event)
}

/** Whether the current phase accepts `event`. */
export const canSendPhase = (event: PhaseEvent) => phaseActor.getSnapshot().can(event)

export const useGame = create<State>((set, get) => ({
  phase: phaseActor.getSnapshot().value,
  runId: 0,
  hud: { time: 0, distance: 0, speed: 0, style: 0 },
  combo: null,
  air: null,
  toasts: [],
  results: null,
  camera: loadSetting(CAMERA_KEY, CAMERA_MODES),
  setCamera: (camera) => {
    writeStorage(CAMERA_KEY, camera)
    set({ camera })
  },
  cycleCamera: () => {
    const i = CAMERA_MODES.findIndex((m) => m.id === get().camera)
    get().setCamera(CAMERA_MODES[(i + 1) % CAMERA_MODES.length]?.id ?? CAMERA_MODES[0].id)
  },
  character: loadSetting(CHARACTER_KEY, CHARACTERS),
  setCharacter: (character) => {
    writeStorage(CHARACTER_KEY, character)
    set({ character })
  },
  newGame: () => {
    set((s) => ({
      runId: s.runId + 1,
      results: null,
      combo: null,
      toasts: [],
      hud: { time: 0, distance: 0, speed: 0, style: 0 },
    }))
  },
  pushToast: (t) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, 1800)
  },
  finish: (r) => {
    const prev = loadBest(BEST_KEY)
    const newBest = r.total > prev
    if (newBest) writeStorage(BEST_KEY, String(r.total))
    set({ results: { ...r, best: Math.max(prev, r.total), newBest } })
    sendPhase({ type: 'FINISH' })
  },
}))

// zustand mirrors the actor's phase so components keep reading `useGame((s) => s.phase)`.
phaseActor.subscribe((snapshot) => {
  if (useGame.getState().phase !== snapshot.value) useGame.setState({ phase: snapshot.value })
})
