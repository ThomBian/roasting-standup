import { useEffect, useRef, useCallback, useState } from 'react'
import './StandupStage.css'

const RING_MAX_MS      = 180_000
const PULSE_START_MS   = 60_000
const PULSE_INTENSE_MS = 120_000

function fmtTime(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function perfEmoji(ms, status) {
  if (status === 'skipped') return '🏃'
  if (!ms)          return '—'
  if (ms < 60_000)  return '⚡'
  if (ms < 120_000) return '✅'
  if (ms < 180_000) return '⏰'
  return '🗣️'
}

// ── Timer ring ───────────────────────────────────────────
function TimerRing({ elapsed }) {
  const r    = 60
  const circ = 2 * Math.PI * r
  const off  = circ * (1 - Math.min(elapsed / RING_MAX_MS, 1))
  const cls  = elapsed >= PULSE_INTENSE_MS ? 'tring tring--intense'
             : elapsed >= PULSE_START_MS   ? 'tring tring--pulse'
             : 'tring'
  return (
    <svg className={cls} width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="2" />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke="var(--current)" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={off}
        transform="rotate(-90 70 70)"
      />
    </svg>
  )
}

// ── Ambient canvas ───────────────────────────────────────
function AmbientCanvas({ elapsed }) {
  const ref = useRef(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    const { width: W, height: H } = c
    ctx.clearRect(0, 0, W, H)

    let op = 0
    if (elapsed > PULSE_START_MS) op = Math.min((elapsed - PULSE_START_MS) / (PULSE_INTENSE_MS - PULSE_START_MS), 1) * 0.28
    if (elapsed > PULSE_INTENSE_MS) op += Math.min((elapsed - PULSE_INTENSE_MS) / 60_000, 1) * 0.42

    const [cx, cy] = [W / 2, H * 0.42]
    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55)
    g1.addColorStop(0, `rgba(196,82,43,${op})`); g1.addColorStop(1, 'rgba(196,82,43,0)')
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H)

    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.25)
    g2.addColorStop(0, `rgba(196,138,43,${op * 0.6})`); g2.addColorStop(1, 'rgba(196,138,43,0)')
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H)
  }, [elapsed])

  return <canvas ref={ref} className="ambient-canvas" aria-hidden="true" />
}

// ── Main stage ───────────────────────────────────────────
export default function StandupStage({
  rotation, elapsed, speakerTimes, shaking, epicRemark,
  doneCount, activeCount, onSelect, onSkipQueued, onNext, onPrev,
}) {
  const activeCardRef = useRef(null)
  const trayRef       = useRef(null)
  const upNextRef     = useRef(null)

  const currentItem  = rotation.find(r => r.status === 'current')
  const pendingItems = rotation.filter(r => r.status === 'pending')
  const doneItems    = rotation.filter(r => r.status === 'done' || r.status === 'skipped')

  // Announce first speaker on mount
  const [announcing, setAnnouncing] = useState(() => !!currentItem && doneCount === 0)
  useEffect(() => {
    if (!announcing) return
    const id = setTimeout(() => setAnnouncing(false), 2000)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll tray to show "up next" whenever done section grows
  useEffect(() => {
    upNextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }, [doneItems.length])

  const handleNext = useCallback(() => onNext(), [onNext])
  const handlePrev = useCallback(() => onPrev(), [onPrev])

  return (
    <div className={`stage-od${shaking ? ' stage-od--shake' : ''}`}>
      <AmbientCanvas elapsed={elapsed} />

      {announcing && currentItem && (
        <div className="announce-overlay" aria-live="assertive" aria-atomic="true">
          <div className="announce-spotlight" />
          <span className="announce-label">up first</span>
          <span className="announce-name">{currentItem.name}</span>
        </div>
      )}

      {/* Active speaker area */}
      <div className="active-slot">
        {currentItem ? (
          <div
            ref={activeCardRef}
            key={currentItem.id}
            className="pcard pcard--active"
          >
            <div className="pcard-timer-wrap">
              <TimerRing elapsed={elapsed} />
              <div className="pcard-time">{fmtTime(elapsed)}</div>
            </div>
            <div className="pcard-name-lg">{currentItem.name}</div>
          </div>
        ) : (
          <p className="stage-prompt">tap a name to start</p>
        )}
      </div>

      {/* Action row — skip / finish below active card */}
      {currentItem && (
        <div className="stage-action-row">
          {pendingItems.length === 0 ? (
            <button className="stage-finish-btn" onClick={handleNext}>
              Finish standup
            </button>
          ) : (
            <button className="stage-skip-btn" onClick={handleNext}>
              Skip
            </button>
          )}
        </div>
      )}

      {/* Bottom tray — scrollable strip */}
      <div ref={trayRef} className="bottom-tray" role="list" aria-label="Rotation queue">
        {doneItems.length > 0 && (
          <span className="tray-label" aria-hidden="true">done</span>
        )}

        {doneItems.map(item => (
          <button
            key={item.id}
            className="pcard pcard--done"
            onClick={() => onSelect(item.id)}
            title="Put on stage"
            aria-label={`${item.name} — click to put on stage`}
            role="listitem"
          >
            <div className="pcard-name-sm">{item.name}</div>
            <div className="pcard-perf-emoji">{perfEmoji(speakerTimes[item.name], item.status)}</div>
          </button>
        ))}

        {doneItems.length > 0 && pendingItems.length > 0 && (
          <div className="tray-sep" aria-hidden="true" />
        )}

        {pendingItems.length > 0 && (
          <span ref={upNextRef} className="tray-label" aria-hidden="true">up next</span>
        )}

        {pendingItems.map((item, i) => (
          <button
            key={item.id}
            className="pcard pcard--queue"
            onClick={() => onSelect(item.id)}
            aria-label={`${item.name} — click to start`}
            role="listitem"
          >
            <div className="pcard-pos">{rotation.findIndex(r => r.id === item.id) + 1}</div>
            <div className="pcard-name-sm">{item.name}</div>
            <button
              className="pcard-queue-skip"
              onClick={e => { e.stopPropagation(); onSkipQueued(item.id) }}
              aria-label={`Skip ${item.name}`}
              title="Skip"
            >×</button>
          </button>
        ))}
      </div>

      {doneItems.length > 0 && (
        <button
          className="stage-edge-trigger stage-edge-trigger--prev"
          onClick={handlePrev}
          aria-label="Previous speaker"
        >
          <span className="stage-edge-glyph">‹</span>
        </button>
      )}

      {currentItem && pendingItems.length > 0 && (
        <button
          className="stage-edge-trigger stage-edge-trigger--next"
          onClick={handleNext}
          aria-label="Next speaker"
        >
          <span className="stage-edge-glyph">›</span>
        </button>
      )}

      {epicRemark && (
        <div className="epic-remark" key={epicRemark}>{epicRemark}</div>
      )}

    </div>
  )
}
