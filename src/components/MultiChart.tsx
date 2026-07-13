import { useCallback, useMemo, useRef, useState } from 'react'
import { fmtDate } from '../format'

export interface MultiSeries {
  key: string
  color: string
  values: number[]
}

interface MultiChartProps {
  dates: string[]
  series: MultiSeries[]
  onScrub?: (index: number | null) => void
}

const W = 800
const H = 380
const PAD_Y = 24

/** Večlinijski graf za primerjavo profilov; drsenje javlja indeks navzgor. */
export default function MultiChart({ dates, series, onScrub }: MultiChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scrub, setScrub] = useState<number | null>(null)

  const n = dates.length

  const { min, max } = useMemo(() => {
    let lo = 0 // vedno vključimo 0, ker računi začnejo pri 0 €
    let hi = -Infinity
    for (const s of series) {
      for (const v of s.values) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    if (!isFinite(hi)) hi = 1
    if (hi - lo < 1e-9) hi = lo + 1
    return { min: lo, max: hi }
  }, [series])

  const x = useCallback((i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W), [n])
  const y = useCallback(
    (v: number) => H - PAD_Y - ((v - min) / (max - min)) * (H - 2 * PAD_Y),
    [min, max],
  )

  const paths = useMemo(
    () =>
      series.map((s) => {
        if (s.values.length === 0) return ''
        let d = `M ${x(0)} ${y(s.values[0])}`
        for (let i = 1; i < s.values.length; i++) d += ` L ${x(i)} ${y(s.values[i])}`
        return d
      }),
    [series, x, y],
  )

  const updateScrub = useCallback(
    (clientX: number | null) => {
      if (clientX === null || n === 0) {
        setScrub(null)
        onScrub?.(null)
        return
      }
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const i = Math.round(frac * (n - 1))
      setScrub(i)
      onScrub?.(i)
    },
    [n, onScrub],
  )

  if (n === 0) {
    return <div className="chart-empty">Ni še podatkov za prikaz.</div>
  }

  return (
    <div className="chart-outer">
      <div
        ref={wrapRef}
        className="chart-wrap"
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // synthetic/nepodprt pointer — drsenje deluje tudi brez captura
          }
          updateScrub(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'mouse') updateScrub(e.clientX)
        }}
        onPointerUp={() => updateScrub(null)}
        onPointerLeave={() => updateScrub(null)}
        onPointerCancel={() => updateScrub(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart-svg">
          <line
            x1="0"
            x2={W}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--chart-baseline)"
            strokeWidth="2"
            strokeDasharray="6 7"
            vectorEffect="non-scaling-stroke"
          />
          {series.map((s, si) => (
            <path
              key={s.key}
              d={paths[si]}
              fill="none"
              stroke={s.color}
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {scrub !== null && (
            <>
              <line
                x1={x(scrub)}
                x2={x(scrub)}
                y1="0"
                y2={H}
                stroke="var(--chart-crosshair)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              {series.map((s) => (
                <circle key={s.key} cx={x(scrub)} cy={y(s.values[scrub] ?? 0)} r="6" fill={s.color} />
              ))}
            </>
          )}
        </svg>
      </div>
      <div className="chart-axis">
        <span>{fmtDate(dates[0])}</span>
        {n > 2 && <span>{fmtDate(dates[Math.floor((n - 1) / 2)])}</span>}
        <span>{fmtDate(dates[n - 1])}</span>
      </div>
    </div>
  )
}
