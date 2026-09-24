import { useEffect } from 'react'
import { startRun } from '../game/runtime'
import { useGame } from '../game/store'
import './overlay.css'

const fmtTime = (t: number) => {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t * 100) % 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function Hud() {
  const hud = useGame((s) => s.hud)
  return (
    <div className="hud card">
      <div className="label">Your run</div>
      <div className="time">{fmtTime(hud.time)}</div>
      <Row label="Distance" value={Math.floor(hud.distance)} unit="m" />
      <Row label="Speed" value={Math.round(hud.speed)} unit="km/h" />
      <Row label="Style" value={hud.style} unit="pts" />
    </div>
  )
}

function Row({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="row">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <span className="unit">{unit}</span>
    </div>
  )
}

function Combo() {
  const combo = useGame((s) => s.combo)
  if (!combo) return null
  return (
    <div className="combo">
      <div className="combo-tricks">{combo.tricks.join(' + ')}</div>
      <div className="combo-pot">
        {combo.base} <span>× {combo.count}</span>
      </div>
    </div>
  )
}

function AirReadout() {
  const air = useGame((s) => s.air)
  if (!air) return null
  return <div className="air">{air}</div>
}

function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <div>{t.text}</div>
          {t.sub && <small>{t.sub}</small>}
        </div>
      ))}
    </div>
  )
}

const CONTROLS: [string, string][] = [
  ['← →', 'turn · spin in air'],
  ['↑', 'brake · backflip in air'],
  ['↓', 'tuck · frontflip in air'],
  ['Space', 'jump'],
  ['Shift', 'grab (hold in air)'],
  ['', 'quick ←/→ tap in air and let go: shifty'],
  ['', 'let go of ←→ / ↑↓ and the rotation finishes itself'],
  ['Esc', 'pause'],
]

function Menu() {
  return (
    <div className="screen">
      <div className="card panel">
        <h1>POWDER</h1>
        <p className="tag">One mountain. One run. Land it clean.</p>
        <button onClick={startRun}>New game</button>
        <div className="hint">or press Enter</div>
        <div className="controls">
          {CONTROLS.map(([k, v]) => (
            <div key={k}>
              {k ? <kbd>{k}</kbd> : <span />}
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Paused() {
  return (
    <div className="screen">
      <div className="card panel">
        <h2>Paused</h2>
        <button onClick={() => useGame.getState().setPhase('playing')}>Resume</button>
        <button className="secondary" onClick={startRun}>
          Restart
        </button>
      </div>
    </div>
  )
}

function ResultsScreen() {
  const r = useGame((s) => s.results)
  if (!r) return null
  return (
    <div className="screen">
      <div className="card panel">
        <h2>Finish!</h2>
        <div className="results">
          <span>Time</span>
          <b>{fmtTime(r.time)}</b>
          <span>Style</span>
          <b>{r.style}</b>
          <span>Time bonus</span>
          <b>{r.bonus}</b>
          <span className="total">Total</span>
          <b className="total">{r.total}</b>
        </div>
        <p className="tag">{r.newBest ? 'New personal best!' : `Best: ${r.best}`}</p>
        <button onClick={startRun}>New game</button>
        <div className="hint">or press Enter</div>
      </div>
    </div>
  )
}

export function Overlay() {
  const phase = useGame((s) => s.phase)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = useGame.getState().phase
      if (e.code === 'Enter' && (p === 'menu' || p === 'finished')) startRun()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="overlay">
      {phase !== 'menu' && <Hud />}
      {phase === 'playing' && (
        <>
          <Combo />
          <AirReadout />
          <Toasts />
        </>
      )}
      {phase === 'menu' && <Menu />}
      {phase === 'paused' && <Paused />}
      {phase === 'finished' && <ResultsScreen />}
    </div>
  )
}
