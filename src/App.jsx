import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { QUOTES, EGGS, ROASTS, LONG_SPEAKER_REMARKS, STANDUP_VERDICT } from './copy.js'
import StandupStage from './StandupStage.jsx'

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

// ── Count-up hook ─────────────────────────────────
function useCountUp(targetMs, duration = 750, delayMs = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (targetMs === 0) return
    let rafId
    const timeoutId = setTimeout(() => {
      let startTime = null
      const animate = (ts) => {
        if (!startTime) startTime = ts
        const progress = Math.min((ts - startTime) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
        setValue(Math.round(targetMs * eased))
        if (progress < 1) rafId = requestAnimationFrame(animate)
      }
      rafId = requestAnimationFrame(animate)
    }, delayMs)
    return () => { clearTimeout(timeoutId); cancelAnimationFrame(rafId) }
  }, [targetMs, duration, delayMs])
  return value
}

function AnimatedTime({ ms, delay = 0, className = 'summary-time' }) {
  const current = useCountUp(ms, 750, delay)
  return <span className={className}>{ms > 0 ? formatTime(current) : '—'}</span>
}

// ── Celebration burst on done screen ──────────────
const BURST_COLORS = [
  'oklch(0.76 0.15 72)',  // amber (--accent)
  'oklch(0.70 0.17 38)',  // coral (--current)
  'oklch(0.82 0.14 72)',  // light amber
  'oklch(0.62 0.12 55)',  // warm gold mid
]

function CelebrationBurst() {
  const dots = useRef(
    Array.from({ length: 22 }, (_, i) => {
      const angle = (360 / 22) * i + (Math.random() - 0.5) * 15
      const dist  = 70 + Math.random() * 110
      const rad   = (angle * Math.PI) / 180
      return {
        id:    i,
        tx:    Math.cos(rad) * dist,
        ty:    Math.sin(rad) * dist,
        size:  3 + Math.random() * 5,
        color: BURST_COLORS[i % BURST_COLORS.length],
        delay: Math.random() * 0.06,
      }
    })
  ).current

  return (
    <div className="celebration-burst" aria-hidden="true">
      {dots.map(d => (
        <span
          key={d.id}
          className="celebration-dot"
          style={{
            '--tx':    `${d.tx}px`,
            '--ty':    `${d.ty}px`,
            width:     `${d.size}px`,
            height:    `${d.size}px`,
            background: d.color,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </div>
  )
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
  const rotationRef = useRef(rotation)
  const speakerTimesRef = useRef({})
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
        if (speakerStartRef.current) setElapsed(Date.now() - speakerStartRef.current)
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

  currentItemRef.current = rotation.find(r => r.status === 'current') ?? null
  rotationRef.current = rotation
  speakerTimesRef.current = speakerTimes
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
      setRotation(prev => prev.map(r =>
        r.status === 'current' ? { ...r, status: 'pending' } : r
      ))
      speakerStartRef.current = null
      setSpeakerTimes({})
      setElapsed(0)
      setPhase('running')
    })
  }, [])

  const skipQueued = useCallback((itemId) => {
    setRotation(prev => prev.map(r =>
      r.id === itemId ? { ...r, status: 'skipped' } : r
    ))
  }, [])

  const selectSpeaker = useCallback((itemId) => {
    const current = currentItemRef.current
    const duration = current && speakerStartRef.current
      ? Date.now() - speakerStartRef.current
      : 0
    if (current && duration > 0) {
      setSpeakerTimes(prev => ({
        ...prev,
        [current.name]: (prev[current.name] ?? 0) + duration,
      }))
    }
    const selectedName = rotationRef.current.find(r => r.id === itemId)?.name
    const prevTime = speakerTimesRef.current[selectedName] ?? 0
    setRotation(prev => prev.map(r => {
      if (r.id === itemId) return { ...r, status: 'current' }
      if (r.status === 'current') return { ...r, status: 'pending' }
      return r
    }))
    speakerStartRef.current = Date.now() - prevTime
    setElapsed(prevTime)
  }, [])

  const prevSpeaker = useCallback(() => {
    const lastDone = [...rotationRef.current].reverse().find(r => r.status === 'done' || r.status === 'skipped')
    if (lastDone) selectSpeaker(lastDone.id)
  }, [selectSpeaker])

  const advanceSpeaker = useCallback((skip = false) => {
    const duration = speakerStartRef.current ? Date.now() - speakerStartRef.current : 0
    const current = currentItemRef.current

    const currentIdx = rotationRef.current.findIndex(r => r.status === 'current')
    const nextItem = rotationRef.current.find((r, i) => i > currentIdx && r.status === 'pending')
    const nextPrevTime = nextItem ? (speakerTimesRef.current[nextItem.name] ?? 0) : 0

    setRotation(prev => {
      const cIdx = prev.findIndex(r => r.status === 'current')
      if (cIdx === -1) return prev
      const updated = prev.map((r, i) =>
        i === cIdx ? { ...r, status: skip ? 'skipped' : 'done' } : r
      )
      const nIdx = updated.findIndex((r, i) => i > cIdx && r.status === 'pending')
      if (nIdx !== -1) updated[nIdx] = { ...updated[nIdx], status: 'current' }
      return updated
    })
    if (!skip && current) {
      setSpeakerTimes(prev => ({
        ...prev,
        [current.name]: (prev[current.name] ?? 0) + duration,
      }))
      if (duration >= CHAOS_MS) {
        const remark = LONG_SPEAKER_REMARKS[Math.floor(Math.random() * LONG_SPEAKER_REMARKS.length)]
        setEpicRemark(remark)
        setTimeout(() => setEpicRemark(null), 4000)
      }
    }
    speakerStartRef.current = nextItem ? Date.now() - nextPrevTime : null
    setElapsed(nextPrevTime)
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
  const spoke = speakerSummary.filter(s => s.ms > 0)
  const avgMs = spoke.length > 0 ? totalMs / spoke.length : 0
  const mvpItem = spoke[spoke.length - 1] ?? null
  const overtimeItem = speakerSummary[0]?.ms > 0 ? speakerSummary[0] : null
  const showMvp = spoke.length >= 2 && mvpItem && avgMs > 0 && mvpItem.ms < avgMs * 0.55
  const showOvertime = spoke.length >= 2 && overtimeItem && avgMs > 0
    && overtimeItem.ms > avgMs * 1.8 && overtimeItem.ms > 60_000
  const skippedNames = rotation.filter(r => r.status === 'skipped').map(r => r.name)

  return (
    <div className="app">
      {phase === 'running' && <EasterEggs elapsed={elapsed} />}
      {phase === 'done'    && <CelebrationBurst />}
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

      <main className={`main${phase === 'running' ? ' main--stage' : ''}`}>
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
          <StandupStage
            rotation={rotation}
            elapsed={elapsed}
            speakerTimes={speakerTimes}
            shaking={shaking}
            epicRemark={epicRemark}
            doneCount={doneCount}
            activeCount={activeCount}
            onSelect={selectSpeaker}
            onSkipQueued={skipQueued}
            onNext={() => advanceSpeaker(false)}
            onPrev={prevSpeaker}
          />
        )}

        {phase === 'done' && (
          <div className="summary">
            <div className="summary-header">
              <p className="summary-title">That's everyone.</p>
              <p className="summary-sub">
                Standup took <AnimatedTime ms={totalMs} delay={120} className="summary-time-inline" /> total
                {avgMs > 0 && <> · avg <AnimatedTime ms={avgMs} delay={220} className="summary-time-inline" /> per person</>}
              </p>
              {totalMs > 0 && (
                <p className="summary-verdict">{standupVerdict(totalMs)}</p>
              )}
            </div>

            <div className="summary-body">
            {(showMvp || showOvertime) && (
              <div className="summary-stats">
                {showMvp && (
                  <div className="summary-stat-card summary-stat-card--mvp" style={{ '--stat-i': 0 }}>
                    <span className="stat-emoji">🎖️</span>
                    <span className="stat-label">MVP</span>
                    <span className="stat-name">{mvpItem.name}</span>
                    <AnimatedTime ms={mvpItem.ms} delay={300} className="stat-time" />
                    <span className="stat-caption">most concise</span>
                  </div>
                )}
                {showOvertime && (
                  <div className="summary-stat-card summary-stat-card--overtime" style={{ '--stat-i': showMvp ? 1 : 0 }}>
                    <span className="stat-emoji">🗣️</span>
                    <span className="stat-label">Overtime</span>
                    <span className="stat-name">{overtimeItem.name}</span>
                    <AnimatedTime ms={overtimeItem.ms} delay={showMvp ? 380 : 300} className="stat-time" />
                    <span className="stat-caption">most talkative</span>
                  </div>
                )}
              </div>
            )}

            <ul className="summary-list">
              {speakerSummary.map((s, i) => (
                <li key={s.name} className="summary-item" style={{ '--i': i }}>
                  <span className="summary-name">{s.name}</span>
                  <div className="summary-bar-wrap">
                    <div
                      className="summary-bar"
                      style={{ width: maxMs > 0 ? `${(s.ms / maxMs) * 100}%` : '0%' }}
                    />
                  </div>
                  <AnimatedTime ms={s.ms} delay={Math.round((0.38 + i * 0.08) * 1000)} />
                </li>
              ))}
              {skippedNames.map((name, i) => (
                <li key={name} className="summary-item summary-item--skipped" style={{ '--i': speakerSummary.length + i }}>
                  <span className="summary-name">{name}</span>
                  <div className="summary-bar-wrap" />
                  <span className="summary-time">away</span>
                </li>
              ))}
            </ul>
            </div>

            <button
              className="btn btn-ghost"
              style={{ '--list-len': speakerSummary.length + skippedNames.length }}
              onClick={resetStandup}
            >
              New standup
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
