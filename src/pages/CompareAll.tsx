import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { buildDailySeries, PERIODS, periodStartIndex, type PeriodKey } from '../calc'
import { loadPriceSeries } from '../prices'
import MultiChart from '../components/MultiChart'
import { fmtDate, fmtEur } from '../format'

export default function CompareAll() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<PeriodKey>('ALL')
  const [scrubIdx, setScrubIdx] = useState<number | null>(null)

  const data = useLiveQuery(async () => {
    const [profiles, cashflows, trades] = await Promise.all([
      db.profiles.orderBy('createdAt').toArray(),
      db.cashflows.toArray(),
      db.trades.toArray(),
    ])
    const tickers = [...new Set(trades.map((t) => t.ticker))]
    const prices = await loadPriceSeries(tickers)
    return { profiles, cashflows, trades, prices }
  }, [])

  const aligned = useMemo(() => {
    if (!data || data.profiles.length === 0) return null
    const perProfile = data.profiles.map((p) => ({
      profile: p,
      series: buildDailySeries(
        p.openingDate,
        data.cashflows.filter((c) => c.profileId === p.id),
        data.trades.filter((t) => t.profileId === p.id),
        data.prices,
      ),
    }))
    // vse serije se končajo danes — poravnamo jih na najdaljšo,
    // pred odprtjem računa je vrednost 0
    const longest = perProfile.reduce((a, b) =>
      b.series.dates.length > a.series.dates.length ? b : a,
    )
    const dates = longest.series.dates
    const rows = perProfile.map(({ profile, series }) => ({
      profile,
      values: [...new Array(dates.length - series.nav.length).fill(0), ...series.nav],
    }))
    return { dates, rows }
  }, [data])

  if (!aligned) return null

  const startIdx = periodStartIndex(aligned.dates, period)
  const dates = aligned.dates.slice(startIdx)
  const rows = aligned.rows.map((r) => ({ ...r, values: r.values.slice(startIdx) }))

  const idx = scrubIdx ?? dates.length - 1
  const total = rows.reduce((s, r) => s + (r.values[idx] ?? 0), 0)

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="topbar-profile" onClick={() => navigate('/')} title="Nazaj">
          <span className="topbar-emoji">📊</span>
          <span className="topbar-name">Primerjava</span>
          <span className="topbar-switch">⇄</span>
        </button>
      </header>
      <main className="content">
        <div className="headline">
          <div className="headline-value">{fmtEur(total)}</div>
          <div className="headline-sub">
            {scrubIdx !== null ? fmtDate(dates[idx]) : 'skupaj vsi računi'}
          </div>
        </div>

        <MultiChart
          dates={dates}
          series={rows.map((r) => ({
            key: r.profile.id,
            color: r.profile.color,
            values: r.values,
          }))}
          onScrub={setScrubIdx}
        />

        <div className="periods">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={'period' + (period === p.key ? ' active' : '')}
              onClick={() => {
                setPeriod(p.key)
                setScrubIdx(null)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <section className="card">
          {rows.map((r) => (
            <div key={r.profile.id} className="holding-row">
              <div className="compare-name">
                <i className="legend-dot" style={{ background: r.profile.color }} />
                <span className="compare-emoji">{r.profile.emoji}</span>
                <strong style={{ color: r.profile.color }}>{r.profile.name}</strong>
              </div>
              <strong>{fmtEur(r.values[idx] ?? 0)}</strong>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
