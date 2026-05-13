import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { QUOTES, EGGS, ROASTS, LONG_SPEAKER_REMARKS, STANDUP_VERDICT } from './copy.js'

const STORAGE_KEYS = {
  participants: 'standup-participants',
  rotation: 'standup-rotation',
  rotationDate: 'standup-rotation-date',
}

const TODAY = new Date().toISOString().slice(0, 10)

const DAILY_QUOTE = QUOTES[Math.floor(Math.random() * QUOTES.length)]

const RING_MAX_MS      = 180_000
const PULSE_START_MS   = 60_000
const PULSE_INTENSE_MS = 120_000
const CHAOS_MS         = 180_000

function standupVerdict(totalMs) {
  const min = totalMs / 60_000
  if (min < 14) return pick(STANDUP_VERDICT.fast)
  if (min <= 16) return pick(STANDUP_VERDICT.perfect)
  return pick(STANDUP_VERDICT.long)
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeRotation(participants) {
  return shuffle(participants).map((name) => ({
    id: `${name}-${Date.now()}-${Math.random()}`,
    name,
    status: 'pending',
  }))
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function loadTodayRotation(participants) {
  const storedDate = localStorage.getItem(STORAGE_KEYS.rotationDate)
  if (storedDate === TODAY) {
    const stored = load(STORAGE_KEYS.rotation, null)
    if (stored && stored.length > 0) return stored
  }
  if (participants.length === 0) return []
  const rotation = makeRotation(participants)
  localStorage.setItem(STORAGE_KEYS.rotation, JSON.stringify(rotation))
  localStorage.setItem(STORAGE_KEYS.rotationDate, TODAY)
  return rotation
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// How long past 2:00 until emojis start
const EGG_DELAY_MS = 30_000 // 2:30

function roastTier(past2min) {
  if (past2min < 30_000)  return 'soft'
  if (past2min < 70_000)  return 'medium'
  if (past2min < 110_000) return 'hard'
  return 'brutal'
}

// Emoji spawn interval: 0 before 2:30, 14s at 2:30, ~600ms at 5:00
function emojiRate(past2min) {
  const pastDelay = past2min - EGG_DELAY_MS
  if (pastDelay <= 0) return Infinity
  const t = Math.min(pastDelay / 150_000, 1) // saturates at ~4:50 past 2min
  return Math.round(8_000 * Math.pow(1 - t, 2.2) + 600)
}

function pickEmoji(past2min) {
  const pastDelay = past2min - EGG_DELAY_MS
  const t = Math.min(pastDelay / 150_000, 1)
  const set = t < 0.25 ? EGGS.mild : t < 0.5 ? EGGS.medium : t < 0.75 ? EGGS.spicy : EGGS.chaos
  return set[Math.floor(Math.random() * set.length)]
}

function EasterEggs({ elapsed }) {
  const [particles, setParticles] = useState([])
  const [roast, setRoast]         = useState(null)
  const elapsedRef    = useRef(elapsed)
  const lastEmojiRef  = useRef(0)
  const lastRoastRef  = useRef(0)
  const roastShownRef = useRef(false)

  useEffect(() => { elapsedRef.current = elapsed }, [elapsed])

  useEffect(() => {
    const tick = setInterval(() => {
      const el  = elapsedRef.current
      if (el < PULSE_INTENSE_MS) return

      const past2 = el - PULSE_INTENSE_MS
      const now   = Date.now()

      // First roast fires immediately at 2:00
      const roastInterval = 22_000
      if (!roastShownRef.current || now - lastRoastRef.current > roastInterval) {
        const tier = roastTier(past2)
        const msgs = ROASTS[tier]
        const msg  = msgs[Math.floor(Math.random() * msgs.length)]
        setRoast(msg)
        setTimeout(() => setRoast(null), 3600)
        lastRoastRef.current  = now
        roastShownRef.current = true
      }

      // Emojis start at 2:30
      const rate = emojiRate(past2)
      if (rate < Infinity && now - lastEmojiRef.current > rate) {
        const emoji = pickEmoji(past2)
        const id    = `${Date.now()}-${Math.random()}`
        const x     = 4 + Math.random() * 92
        const dur   = 4.5 + Math.random() * 3
        const sway  = (Math.random() - 0.5) * 140
        const size  = 1.2 + Math.random() * 1.4

        setParticles(prev => [...prev, { id, emoji, x, dur, sway, size }])
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), (dur + 0.5) * 1000)
        lastEmojiRef.current = now
      }
    }, 400)

    return () => clearInterval(tick)
  }, [])

  return (
    <>
      {particles.map(p => (
        <span
          key={p.id}
          className="egg-particle"
          style={{
            left: `${p.x}%`,
            '--dur': `${p.dur}s`,
            '--sway': `${p.sway}px`,
            fontSize: `${p.size}rem`,
          }}
        >
          {p.emoji}
        </span>
      ))}
      {roast && (
        <div className="roast-toast" key={roast + lastRoastRef.current}>
          {roast}
        </div>
      )}
    </>
  )
}

// SVG ring around the timer
function TimerRing({ elapsed }) {
  const r = 86
  const circumference = 2 * Math.PI * r
  const progress = Math.min(elapsed / RING_MAX_MS, 1)
  const offset = circumference * (1 - progress)
  const isIntense = elapsed >= PULSE_INTENSE_MS
  const isPulsing = elapsed >= PULSE_START_MS

  const cls = `timer-ring${isIntense ? ' timer-ring--intense' : isPulsing ? ' timer-ring--pulse' : ''}`

  return (
    <svg
      className={cls}
      width="200" height="200"
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx="100" cy="100" r={r}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth="2"
      />
      {/* Progress arc */}
      <circle
        cx="100" cy="100" r={r}
        fill="none"
        stroke="var(--current)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 100 100)"
      />
    </svg>
  )
}

// Canvas ambient background — warm glow that grows with elapsed time
function AmbientCanvas({ elapsed }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas

    ctx.clearRect(0, 0, width, height)

    // Opacity: flat until 1 min, grows 1→2 min, surges 2+ min
    let opacity = 0
    if (elapsed > PULSE_START_MS) {
      const phase1 = Math.min((elapsed - PULSE_START_MS) / (PULSE_INTENSE_MS - PULSE_START_MS), 1)
      opacity = phase1 * 0.28
    }
    if (elapsed > PULSE_INTENSE_MS) {
      const phase2 = Math.min((elapsed - PULSE_INTENSE_MS) / 60_000, 1)
      opacity += phase2 * 0.42
    }

    // Two overlapping radial gradients for depth
    const cx = width / 2
    const cy = height * 0.42

    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.55)
    // Current color: warm coral oklch(0.70 0.17 38) ≈ #c4522b at full opacity
    g1.addColorStop(0, `rgba(196, 82, 43, ${opacity})`)
    g1.addColorStop(1, 'rgba(196, 82, 43, 0)')
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, width, height)

    // Second layer: amber tint at the very center
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.25)
    g2.addColorStop(0, `rgba(196, 138, 43, ${opacity * 0.6})`)
    g2.addColorStop(1, 'rgba(196, 138, 43, 0)')
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, width, height)
  }, [elapsed])

  return <canvas ref={canvasRef} className="ambient-canvas" aria-hidden="true" />
}

function withViewTransition(fn) {
  if (document.startViewTransition) {
    document.startViewTransition(fn)
  } else {
    fn()
  }
}

export default function App() {
  const [participants, setParticipants] = useState(() =>
    load(STORAGE_KEYS.participants, [])
  )
  const [rotation, setRotation] = useState(() =>
    loadTodayRotation(load(STORAGE_KEYS.participants, []))
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState(null)
  const [editValue, setEditValue] = useState('')

  const [phase, setPhase] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [speakerTimes, setSpeakerTimes] = useState({})
  const [shaking, setShaking] = useState(false)
  const [epicRemark, setEpicRemark] = useState(null)
  const speakerStartRef = useRef(null)
  const intervalRef = useRef(null)
  const currentItemRef = useRef(null)
  const lastShakeRef = useRef(0)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.participants, JSON.stringify(participants))
  }, [participants])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.rotation, JSON.stringify(rotation))
    localStorage.setItem(STORAGE_KEYS.rotationDate, TODAY)
  }, [rotation])

  useEffect(() => {
    if (phase === 'running') {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - speakerStartRef.current)
      }, 250)
    }
    return () => clearInterval(intervalRef.current)
  }, [phase])

  // MSN-style shake every ~20s once past 2 min
  useEffect(() => {
    if (elapsed < PULSE_INTENSE_MS) return
    const now = Date.now()
    if (now - lastShakeRef.current > 20_000) {
      lastShakeRef.current = now
      setShaking(true)
      setTimeout(() => setShaking(false), 700)
    }
  }, [Math.floor(elapsed / 1000)]) // check once per second

  const currentItem = rotation.find(r => r.status === 'current') ?? null
  currentItemRef.current = currentItem
  const nextItem = rotation.find(r => r.status === 'pending') ?? null
  const doneCount = rotation.filter(r => r.status === 'done').length
  const activeCount = rotation.filter(r => r.status !== 'skipped').length
  const allDone = rotation.length > 0 && rotation.every(r => r.status === 'done' || r.status === 'skipped')

  useEffect(() => {
    if (phase === 'running' && allDone) {
      clearInterval(intervalRef.current)
      setPhase('done')
    }
  }, [phase, allDone])

  const startStandup = useCallback(() => {
    withViewTransition(() => {
      setRotation(prev => {
        const firstIdx = prev.findIndex(r => r.status === 'pending')
        if (firstIdx === -1) return prev
        return prev.map((r, i) => i === firstIdx ? { ...r, status: 'current' } : r)
      })
      setSpeakerTimes({})
      speakerStartRef.current = Date.now()
      setElapsed(0)
      setPhase('running')
    })
  }, [])

  const advanceSpeaker = useCallback((skip = false) => {
    const duration = Date.now() - speakerStartRef.current
    const current = currentItemRef.current

    withViewTransition(() => {
      setRotation(prev => {
        const currentIdx = prev.findIndex(r => r.status === 'current')
        if (currentIdx === -1) return prev
        const updated = prev.map((r, i) =>
          i === currentIdx ? { ...r, status: skip ? 'skipped' : 'done' } : r
        )
        const nextIdx = updated.findIndex((r, i) => i > currentIdx && r.status === 'pending')
        if (nextIdx !== -1) {
          updated[nextIdx] = { ...updated[nextIdx], status: 'current' }
        }
        return updated
      })
      if (!skip && current) {
        setSpeakerTimes(prev => ({
          ...prev,
          [current.name]: (prev[current.name] ?? 0) + duration,
        }))
        // Show a remark if they went over 3 minutes
        if (duration >= CHAOS_MS) {
          const remark = LONG_SPEAKER_REMARKS[Math.floor(Math.random() * LONG_SPEAKER_REMARKS.length)]
          setEpicRemark(remark)
          setTimeout(() => setEpicRemark(null), 4000)
        }
      }
      speakerStartRef.current = Date.now()
      setElapsed(0)
    })
  }, [])

  const resetStandup = useCallback(() => {
    clearInterval(intervalRef.current)
    withViewTransition(() => {
      const fresh = makeRotation(participants)
      setRotation(fresh)
      setSpeakerTimes({})
      setElapsed(0)
      setPhase('idle')
    })
  }, [participants])

  const addParticipant = useCallback(() => {
    const name = newName.trim()
    if (!name || participants.includes(name)) return
    setParticipants(prev => [...prev, name])
    setRotation(prev => [...prev, { id: `${name}-${Date.now()}`, name, status: 'pending' }])
    setNewName('')
  }, [newName, participants])

  const removeParticipant = useCallback((name) => {
    setParticipants(prev => prev.filter(p => p !== name))
  }, [])

  const startEdit = (name) => { setEditingName(name); setEditValue(name) }
  const commitEdit = () => {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === editingName || participants.includes(trimmed)) {
      setEditingName(null); return
    }
    setParticipants(prev => prev.map(p => p === editingName ? trimmed : p))
    setRotation(prev => prev.map(r => r.name === editingName ? { ...r, name: trimmed } : r))
    setEditingName(null)
  }

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  const speakerSummary = rotation
    .filter(r => r.status !== 'skipped')
    .map(r => ({ name: r.name, ms: speakerTimes[r.name] ?? 0 }))
    .sort((a, b) => b.ms - a.ms)

  const maxMs = speakerSummary[0]?.ms ?? 0
  const totalMs = Object.values(speakerTimes).reduce((a, b) => a + b, 0)
  const avgMs = speakerSummary.filter(s => s.ms > 0).length > 0
    ? totalMs / speakerSummary.filter(s => s.ms > 0).length
    : 0
  const skippedNames = rotation.filter(r => r.status === 'skipped').map(r => r.name)

  return (
    <div className="app">
      {phase === 'running' && <EasterEggs elapsed={elapsed} />}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◈</span>
            <span className="logo-text">standup</span>
          </div>
          <div className="header-center">
            <span className="today-label">{todayLabel}</span>
          </div>
          <div className="header-actions">
            {phase === 'idle' && (
              <button
                className="btn btn-ghost btn-settings"
                onClick={() => setSettingsOpen(o => !o)}
                aria-expanded={settingsOpen}
              >
                <span className="settings-icon">⚙</span>
                Team
              </button>
            )}
            {phase !== 'idle' && (
              <button className="btn btn-ghost btn-sm" onClick={resetStandup}>Reset</button>
            )}
          </div>
        </div>
      </header>

      {settingsOpen && phase === 'idle' && (
        <div className="settings-drawer">
          <div className="settings-inner">
            <div className="settings-header">
              <h2 className="panel-title">Team members</h2>
            </div>
            <ul className="participant-list">
              {participants.length === 0 && (
                <li className="participant-empty">Nobody here yet — add someone below.</li>
              )}
              {participants.map(name => (
                <li key={name} className="participant-item">
                  {editingName === name ? (
                    <input
                      className="edit-input"
                      value={editValue}
                      autoFocus
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') setEditingName(null)
                      }}
                    />
                  ) : (
                    <>
                      <button className="participant-name" onClick={() => startEdit(name)}>{name}</button>
                      <button className="btn-icon btn-danger" onClick={() => removeParticipant(name)} aria-label={`Remove ${name}`}>×</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <form className="add-form" onSubmit={e => { e.preventDefault(); addParticipant() }}>
              <input
                className="add-input"
                placeholder="Add team member…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <button className="btn btn-ghost" type="submit" disabled={!newName.trim()}>Add</button>
            </form>
          </div>
        </div>
      )}

      <main className="main">
        {phase === 'idle' && (
          <div className="landing">
            <div className="landing-copy">
              <p className="landing-greeting">"{DAILY_QUOTE}"</p>
              <p className="landing-sub">
                {participants.length === 0
                  ? 'Add your team to get started.'
                  : `${participants.length} people on deck.`}
              </p>
            </div>
            {participants.length > 0 && (
              <div className="team-pills">
                {rotation.map(r => (
                  <span key={r.id} className="team-pill">{r.name}</span>
                ))}
              </div>
            )}
            <button
              className="btn btn-start-landing"
              onClick={startStandup}
              disabled={participants.length === 0}
            >
              Start standup
            </button>
          </div>
        )}

        {phase === 'running' && (
          <div className="stage">
            <AmbientCanvas elapsed={elapsed} />

            <div className="stage-progress" style={{ viewTransitionName: 'stage-progress' }}>
              {doneCount + 1} / {activeCount}
            </div>

            <div className={`speaker-block${shaking ? ' speaker-block--shake' : ''}`}>
              <div className="timer-wrap">
                <TimerRing elapsed={elapsed} />
                <div className="timer-number" aria-live="off">
                  {formatTime(elapsed)}
                </div>
              </div>

              <div
                className="speaker-name"
                style={{ viewTransitionName: 'speaker-name' }}
              >
                {currentItem?.name}
              </div>
              <div className="speaker-label">speaking</div>
            </div>

            {nextItem && (
              <p className="up-next" style={{ viewTransitionName: 'up-next' }}>
                up next — {nextItem.name}
              </p>
            )}

            {epicRemark && (
              <div className="epic-remark" key={epicRemark}>
                {epicRemark}
              </div>
            )}

            <div className="stage-controls">
              <button className="btn btn-ghost" onClick={() => advanceSpeaker(true)}>
                Skip
              </button>
              <button
                className="btn btn-primary btn-next-large"
                onClick={() => advanceSpeaker(false)}
              >
                {nextItem ? 'Next →' : 'Finish'}
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="summary">
            <div className="summary-header">
              <p className="summary-title">That's everyone.</p>
              <p className="summary-sub">
                Standup took {formatTime(totalMs)} total
                {avgMs > 0 && ` · avg ${formatTime(avgMs)} per person`}
              </p>
              {totalMs > 0 && (
                <p className="summary-verdict">{standupVerdict(totalMs)}</p>
              )}
            </div>

            <ul className="summary-list">
              {speakerSummary.map((s, i) => (
                <li key={s.name} className={`summary-item${i === 0 && s.ms > 0 ? ' summary-item--top' : ''}`}>
                  <span className="summary-name">{s.name}</span>
                  <div className="summary-bar-wrap">
                    <div
                      className="summary-bar"
                      style={{ width: maxMs > 0 ? `${(s.ms / maxMs) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="summary-time">{s.ms > 0 ? formatTime(s.ms) : '—'}</span>
                  {i === 0 && s.ms > 0 && <span className="summary-top-badge">most talkative</span>}
                </li>
              ))}
              {skippedNames.map(name => (
                <li key={name} className="summary-item summary-item--skipped">
                  <span className="summary-name">{name}</span>
                  <div className="summary-bar-wrap" />
                  <span className="summary-time">away</span>
                </li>
              ))}
            </ul>

            <button className="btn btn-ghost" onClick={resetStandup}>New standup</button>
          </div>
        )}
      </main>
    </div>
  )
}
