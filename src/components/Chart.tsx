import { useCallback, useMemo, useRef, useState } from 'react'
import { fmtDate } from '../format'

export const GREEN = '#0da858'
export const RED = '#e0284a'

interface ChartProps {
  dates: string[]
  values: number[]
  /** siva primerjalna črta (npr. samo vplačila) */
  compare?: number[]
  /** vodoravna črtkana izhodiščna črta; privzeto prva vrednost */
  baseline?: number
  format: (v: number) => string
  onScrub?: (index: number | null) => void
}

const W = 800
const H = 380
const PAD_Y = 24

export default function Chart({ dates, values, compare, baseline, format, onScrub }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scrub, setScrub] = useState<number | null>(null)

  const n = values.length
  const base = baseline ?? values[0] ?? 0

  const { min, max } = useMemo(() => {
    let lo = Infinity
    let hi = -Infinity
    for (const v of values) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    if (compare) {
      for (const v of compare) {
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
    }
    lo = Math.min(lo, base)
    hi = Math.max(hi, base)
    if (!isFinite(lo)) {
      lo = 0
      hi = 1
    }
    if (hi - lo < 1e-9) {
      hi += 1
      lo -= 1
    }
    return { min: lo, max: hi }
  }, [values, compare, base])

  const x = useCallback((i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W), [n])
  const y = useCallback(
    (v: number) => H - PAD_Y - ((v - min) / (max - min)) * (H - 2 * PAD_Y),
    [min, max],
  )

  const color = n > 0 && values[n - 1] >= base ? GREEN : RED

  const linePath = useMemo(() => {
    if (n === 0) return ''
    let d = `M ${x(0)} ${y(values[0])}`
    for (let i = 1; i < n; i++) d += ` L ${x(i)} ${y(values[i])}`
    return d
  }, [n, values, x, y])

  const areaPath = useMemo(() => {
    if (n === 0) return ''
    return `${linePath} L ${x(n - 1)} ${H} L ${x(0)} ${H} Z`
  }, [linePath, n, x])

  const comparePath = useMemo(() => {
    if (!compare || compare.length === 0) return ''
    let d = `M ${x(0)} ${y(compare[0])}`
    for (let i = 1; i < compare.length; i++) d += ` L ${x(i)} ${y(compare[i])}`
    return d
  }, [compare, x, y])

  const gradId = useMemo(() => 'grad' + Math.round(Math.random() * 1e9), [])

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

  const scrubLeftPct = scrub !== null && n > 1 ? (scrub / (n - 1)) * 100 : 0

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
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line
            x1="0"
            x2={W}
            y1={y(base)}
            y2={y(base)}
            stroke="var(--chart-baseline)"
            strokeWidth="2"
            strokeDasharray="6 7"
            vectorEffect="non-scaling-stroke"
          />
          <path d={areaPath} fill={`url(#${gradId})`} />
          {comparePath && (
            <path
              d={comparePath}
              fill="none"
              stroke="var(--chart-compare)"
              strokeWidth="2.5"
              strokeDasharray="1 0"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          )}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
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
              <circle cx={x(scrub)} cy={y(values[scrub])} r="7" fill={color} vectorEffect="non-scaling-stroke" />
              {compare && compare[scrub] !== undefined && (
                <circle cx={x(scrub)} cy={y(compare[scrub])} r="6" fill="var(--chart-compare)" />
              )}
            </>
          )}
        </svg>
        {scrub !== null && (
          <div
            className="chart-scrub-label"
            style={{ left: `${scrubLeftPct}%`, transform: `translateX(-${scrubLeftPct}%)` }}
          >
            <strong>{format(values[scrub])}</strong>
            <span>{fmtDate(dates[scrub])}</span>
          </div>
        )}
      </div>
      <div className="chart-axis">
        <span>{fmtDate(dates[0])}</span>
        {n > 2 && <span>{fmtDate(dates[Math.floor((n - 1) / 2)])}</span>}
        <span>{fmtDate(dates[n - 1])}</span>
      </div>
    </div>
  )
}
