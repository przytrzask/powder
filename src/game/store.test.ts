import { afterEach, describe, expect, it, vi } from 'vitest'

// Each test loads a fresh store module, because it reads the saved settings when it's created.
async function freshStore(storage: Partial<Storage> | undefined) {
  vi.resetModules()
  if (storage) vi.stubGlobal('localStorage', storage)
  return await import('./store')
}

const result = { time: 90, style: 1200, bonus: 300, total: 1500 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saved settings and best score', () => {
  it('starts with defaults when the browser blocks storage entirely', async () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    const { useGame } = await freshStore({ getItem: blocked, setItem: blocked })
    const game = useGame.getState()
    expect(game.camera).toBe('classic')
    expect(game.character).toBe('skier')
    // choosing and finishing still work, they just aren't remembered
    game.setCamera('chase')
    expect(useGame.getState().camera).toBe('chase')
    game.finish(result)
    expect(useGame.getState().results).toMatchObject({ total: 1500, best: 1500, newBest: true })
  })

  it('falls back to the first option for a stale saved value', async () => {
    const { useGame } = await freshStore({ getItem: (key) => (key === 'powder.camera' ? 'drone' : 'skier-blue'), setItem: () => {} })
    expect(useGame.getState().camera).toBe('classic')
    expect(useGame.getState().character).toBe('skier-blue')
  })

  it('ignores a corrupted best score instead of showing NaN', async () => {
    const saves: [string, string][] = []
    const setItem = (key: string, value: string) => {
      saves.push([key, value])
    }
    const { useGame } = await freshStore({ getItem: (key) => (key.startsWith('powder.best') ? 'abc' : null), setItem })
    useGame.getState().finish(result)
    expect(useGame.getState().results).toMatchObject({ best: 1500, newBest: true })
    expect(saves).toEqual([[expect.stringMatching(/^powder\.best\./u), '1500']])
  })

  it('keeps a real best score', async () => {
    const { useGame } = await freshStore({ getItem: (key) => (key.startsWith('powder.best') ? '2000' : null), setItem: () => {} })
    useGame.getState().finish(result)
    expect(useGame.getState().results).toMatchObject({ best: 2000, newBest: false })
  })
})

describe('phase mirror', () => {
  it('zustand follows the phase actor, and refused events change nothing', async () => {
    const { useGame, sendPhase } = await freshStore({ getItem: () => null, setItem: () => {} })
    expect(useGame.getState().phase).toBe('menu')
    sendPhase({ type: 'PAUSE' })
    expect(useGame.getState().phase).toBe('menu')
    sendPhase({ type: 'START' })
    expect(useGame.getState().phase).toBe('playing')
    useGame.getState().finish(result)
    expect(useGame.getState().phase).toBe('finished')
  })
})
