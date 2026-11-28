import { setup } from 'xstate'

export type Phase = 'menu' | 'playing' | 'paused' | 'finished'

/** START begins a run, and restarts one from the pause and results screens. */
export type PhaseEvent = { type: 'START' } | { type: 'PAUSE' } | { type: 'RESUME' } | { type: 'FINISH' }

/**
 * The game's screens. An event a phase doesn't list is refused (the phase stays put), so e.g. a late
 * FINISH after a restart, or Esc on the results screen, can't put the game into the wrong screen.
 * Phases change a few times per run, never per frame; the sim's own modes stay plain TypeScript.
 */
export const phaseMachine = setup({
  types: {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- XState's documented way to declare event types; the value is never read
    events: {} as PhaseEvent,
  },
}).createMachine({
  id: 'phase',
  initial: 'menu',
  states: {
    menu: { on: { START: 'playing' } },
    playing: { on: { PAUSE: 'paused', FINISH: 'finished' } },
    paused: { on: { RESUME: 'playing', START: 'playing' } },
    finished: { on: { START: 'playing' } },
  } satisfies Record<Phase, unknown>,
})
