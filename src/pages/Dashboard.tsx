import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { db } from '../db'
import { useProfile } from './ProfileLayout'
import { buildDailySeries, computeHoldings, PERIODS, periodStartIndex, type PeriodKey } from '../calc'
import { loadPriceSeries } from '../prices'
import Chart, { GREEN, RED } from '../components/Chart'
import { fmtDate, fmtEur, fmtPct, fmtQty, fmtSigned } from '../format'

type Tab = 'value' | 'performance' | 'compare'

const TABS: { key: Tab; label: string }[] = [
  { key: 'value', label: 'Vrednost' },
  { key: 'performance', label: 'Donos' },
  { key: 'compare', label: 'Primerjava' },
]

export default function Dashboard() {
  const profile = useProfile()
  const [tab, setTab] = useState<Tab>('value')
  const [period, setPeriod] = useState<PeriodKey>('ALL')
  const [scrubIdx, setScrubIdx] = useState<number | null>(null)

  const data = useLiveQuery(async () => {
    const [cashflows, trades] = await Promise.all([
      db.cashflows.where('profileId').equals(profile.id).toArray(),
      db.trades.where('profileId').equals(profile.id).toArray(),
    ])
    const tickers = [...new Set(trades.map((t) => t.ticker))]
    const prices = await loadPriceSeries(tickers)
    return { cashflows, trades, prices }
  }, [profile.id, profile.openingDate])

  const series = useMemo(() => {
    if (!data) return null
    return buildDailySeries(profile.openingDate, data.cashflows, data.trades, data.prices)
  }, [data, profile.openingDate])

  const holdings = useMemo(() => {
    if (!data) return []
    return computeHoldings(data.trades, data.prices)
  }, [data])

  if (!series || !data) return null

  const startIdx = periodStartIndex(series.dates, period)
  const dates = series.dates.slice(startIdx)

  // vrednosti za izbrani zavihek
  let values: number[]
  let compare: number[] | undefined
  let format: (v: number) => string
  let baseline: number | undefined
  if (tab === 'performance') {
    const baseTwr = series.twr[startIdx]
    values = series.twr.slice(startIdx).map((t) => (t / baseTwr - 1) * 100)
    baseline = 0
    format = (v) => fmtPct(v / 100)
  } else {
    values = series.nav.slice(startIdx)
    format = fmtEur
    baseline = values[0]
    if (tab === 'compare') {
      compare = series.contributions.slice(startIdx)
      baseline = undefined // pri primerjavi je izhodišče kar siva črta vplačil
    }
  }

  const endIdx = scrubIdx ?? values.length - 1
  const current = values[endIdx] ?? 0
  const currentNav = series.nav[series.nav.length - 1] ?? 0

  // velika številka + sprememba za obdobje
  let headline: string
  let sub: ReactNode
  if (tab === 'value') {
    headline = fmtEur(scrubIdx !== null ? current : currentNav)
    const base = values[0] ?? 0
    const change = current - base
    const pct = base > 0 ? change / base : null
    sub = (
      <span style={{ color: change >= 0 ? GREEN : RED }}>
        {change >= 0 ? '▲' : '▼'} {fmtSigned(change)}
        {pct !== null && <> ({fmtPct(pct)})</>}
      </span>
    )
  } else if (tab === 'performance') {
    headline = fmtPct(current / 100)
    sub = (
      <span style={{ color: current >= 0 ? GREEN : RED }}>
        donos za obdobje {PERIODS.find((p) => p.key === period)?.label}
      </span>
    )
  } else {
    const contrib = compare?.[endIdx] ?? 0
    const diff = current - contrib
    headline = fmtEur(current)
    sub = (
      <span>
        vplačila {fmtEur(contrib)} →{' '}
        <strong style={{ color: diff >= 0 ? GREEN : RED }}>{fmtSigned(diff)} od trgovanja</strong>
      </span>
    )
  }

  const scrubDate = scrubIdx !== null ? dates[scrubIdx] : null

  return (
    <div className="dashboard">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'tab' + (tab === t.key ? ' active' : '')}
            onClick={() => {
              setTab(t.key)
              setScrubIdx(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="headline">
        <div className="headline-value">{headline}</div>
        <div className="headline-sub">{scrubDate ? fmtDate(scrubDate) : sub}</div>
      </div>

      <Chart
        dates={dates}
        values={values}
        compare={compare}
        baseline={baseline}
        format={format}
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

      {tab === 'compare' && (
        <div className="legend">
          <span>
            <i className="legend-dot" style={{ background: values[values.length - 1] >= (compare?.[compare.length - 1] ?? 0) ? GREEN : RED }} />{' '}
            Portfelj
          </span>
          <span>
            <i className="legend-dot legend-dot-compare" /> Samo vplačila
          </span>
        </div>
      )}

      {holdings.length > 0 && (
        <section className="card">
          <h2>Naložbe</h2>
          {holdings.map((h) => (
            <div key={h.ticker} className="holding-row">
              <div>
                <strong>{h.ticker}</strong>
                <span className="muted">
                  {fmtQty(h.quantity)} × {h.lastPrice !== null ? fmtEur(h.lastPrice) : '?'}
                </span>
              </div>
              <strong>{fmtEur(h.value)}</strong>
            </div>
          ))}
        </section>
      )}

      {data.cashflows.length === 0 && data.trades.length === 0 && (
        <section className="card empty-hint">
          <p>👋 Začni tako, da v zavihku <strong>Vplačila</strong> dodaš prvo vplačilo, v zavihku <strong>Trgovanje</strong> pa svoj prvi nakup.</p>
        </section>
      )}
    </div>
  )
}
