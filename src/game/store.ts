import { create } from 'zustand'
import { COURSE } from './config'

export type Phase = 'menu' | 'playing' | 'paused' | 'finished'

export type Hud = { time: number; distance: number; speed: number; style: number }
export type ComboHud = { tricks: string[]; base: number; count: number } | null
export type Toast = { id: number; text: string; sub?: string; tone: 'trick' | 'bank' | 'crash' | 'gate' }
export type Results = { time: number; style: number; bonus: number; total: number; best: number; newBest: boolean }

type State = {
  phase: Phase
  runId: number
  hud: Hud
  combo: ComboHud
  /** what the current jump would score as if landed now */
  air: string | null
  toasts: Toast[]
  results: Results | null
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
