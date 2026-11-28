import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { type Phase, type PhaseEvent, phaseMachine } from './phases'

/** Fresh actor, sent `events` in order; returns the phase after each one. */
function phasesAfter(...events: PhaseEvent['type'][]) {
  const actor = createActor(phaseMachine).start()
  const seen: Phase[] = []
  for (const type of events) {
    actor.send({ type })
    seen.push(actor.getSnapshot().value)
  }
  actor.stop()
  return seen
}

describe('game phases', () => {
  it('starts on the menu', () => {
    expect(createActor(phaseMachine).start().getSnapshot().value).toBe('menu')
  })

  it('plays a run: start, pause, resume, finish, start again', () => {
    expect(phasesAfter('START', 'PAUSE', 'RESUME', 'FINISH', 'START')).toEqual(['playing', 'paused', 'playing', 'finished', 'playing'])
  })

  it('restarts from the pause screen', () => {
    expect(phasesAfter('START', 'PAUSE', 'START')).toEqual(['playing', 'paused', 'playing'])
  })

  // every event each phase must ignore, so a stray key or a late sim event can't jump screens
  const refused: Record<Phase, { reach: PhaseEvent['type'][]; ignores: PhaseEvent['type'][] }> = {
    menu: { reach: [], ignores: ['PAUSE', 'RESUME', 'FINISH'] },
    playing: { reach: ['START'], ignores: ['START', 'RESUME'] },
    paused: { reach: ['START', 'PAUSE'], ignores: ['PAUSE', 'FINISH'] },
    finished: { reach: ['START', 'FINISH'], ignores: ['PAUSE', 'RESUME', 'FINISH'] },
  }

  for (const [phase, { reach, ignores }] of Object.entries(refused)) {
    for (const event of ignores) {
      it(`${phase} ignores ${event}`, () => {
        const actor = createActor(phaseMachine).start()
        for (const type of reach) actor.send({ type })
        expect(actor.getSnapshot().value).toBe(phase)
        expect(actor.getSnapshot().can({ type: event })).toBe(false)
        actor.send({ type: event })
        expect(actor.getSnapshot().value).toBe(phase)
      })
    }
  }
})
