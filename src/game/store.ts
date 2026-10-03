import { create } from 'zustand'
import { COURSE } from './config'

export type Phase = 'menu' | 'playing' | 'paused' | 'finished'

export type Hud = { time: number; distance: number; speed: number; style: number }
export type ComboHud = { tricks: string[]; base: number; count: number } | null
export type Toast = { id: number; text: string; sub?: string; tone: 'trick' | 'bank' | 'crash' | 'gate' }
export type Results = { time: number; style: number; bonus: number; total: number; best: number; newBest: boolean }

export type Option<T extends string> = { id: T; label: string }

export type CameraMode = 'classic' | 'chase'
export const CAMERA_MODES: Option<CameraMode>[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'chase', label: 'Chase' },
]
const CAMERA_KEY = 'powder.camera'

/** Skier models: `id` is the file in public/models (built by the art/skier*.py scripts). */
export type CharacterId = 'skier' | 'skier-blue'
export const CHARACTERS: Option<CharacterId>[] = [
  { id: 'skier', label: 'Orange' },
  { id: 'skier-blue', label: 'Blue' },
]
const CHARACTER_KEY = 'powder.character'

/** A saved setting, falling back to the first option if the stored value is missing or stale. */
function loadSetting<T extends string>(key: string, options: Option<T>[]): T {
  const saved = localStorage.getItem(key)
  return options.find((o) => o.id === saved)?.id ?? options[0].id
}

type State = {
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
  setPhase: (phase: Phase) => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  finish: (r: Omit<Results, 'best' | 'newBest'>) => void
}

let toastId = 0
// per course length, so a longer map doesn't compete with old scores
const BEST_KEY = `powder.best.${COURSE.length}`

export const useGame = create<State>((set) => ({
  phase: 'menu',
  runId: 0,
  hud: { time: 0, distance: 0, speed: 0, style: 0 },
  combo: null,
  air: null,
  toasts: [],
  results: null,
  camera: loadSetting(CAMERA_KEY, CAMERA_MODES),
  setCamera: (camera) => {
    localStorage.setItem(CAMERA_KEY, camera)
    set({ camera })
  },
  cycleCamera: () => {
    const i = CAMERA_MODES.findIndex((m) => m.id === useGame.getState().camera)
    useGame.getState().setCamera(CAMERA_MODES[(i + 1) % CAMERA_MODES.length].id)
  },
  character: loadSetting(CHARACTER_KEY, CHARACTERS),
  setCharacter: (character) => {
    localStorage.setItem(CHARACTER_KEY, character)
    set({ character })
  },
  newGame: () =>
    set((s) => ({ phase: 'playing', runId: s.runId + 1, results: null, combo: null, toasts: [], hud: { time: 0, distance: 0, speed: 0, style: 0 } })),
  setPhase: (phase) => set({ phase }),
  pushToast: (t) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 1800)
  },
  finish: (r) => {
    const prev = Number(localStorage.getItem(BEST_KEY) ?? 0)
    const newBest = r.total > prev
    if (newBest) localStorage.setItem(BEST_KEY, String(r.total))
    set({ phase: 'finished', results: { ...r, best: Math.max(prev, r.total), newBest } })
  },
}))
