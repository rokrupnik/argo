import type { Cashflow, Trade } from './db'
import type { PriceSeries } from './prices'
import { todayISO } from './format'

export interface DailySeries {
  /** ISO datumi, po en vnos za vsak koledarski dan od odprtja do danes */
  dates: string[]
  /** vrednost računa (gotovina + tržna vrednost pozicij) */
  nav: number[]
  /** kumulativni TWR indeks (začne pri 1); donos med i in j = twr[j]/twr[i] - 1 */
  twr: number[]
  /** kumulativna neto vplačila (vplačila - dvigi - stroški) — scenarij "brez trade-ov" */
  contributions: number[]
}

export interface Holding {
  ticker: string
  quantity: number
  lastPrice: number | null
  value: number
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** zadnja znana cena <= date; carry-forward, ker se ETF ne trguje vsak dan */
function priceAt(series: PriceSeries | undefined, date: string): number | null {
  if (!series || series.dates.length === 0) return null
  let lo = 0
  let hi = series.dates.length - 1
  if (series.dates[0] > date) return null
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (series.dates[mid] <= date) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return series.closes[ans]
}

export function buildDailySeries(
  openingDate: string,
  cashflows: Cashflow[],
  trades: Trade[],
  prices: Map<string, PriceSeries>,
): DailySeries {
  const today = todayISO()
  const start = openingDate <= today ? openingDate : today

  const flowsByDate = new Map<string, Cashflow[]>()
  for (const cf of cashflows) {
    const arr = flowsByDate.get(cf.date) ?? []
    arr.push(cf)
    flowsByDate.set(cf.date, arr)
  }
  const tradesByDate = new Map<string, Trade[]>()
  for (const t of trades) {
    const arr = tradesByDate.get(t.date) ?? []
    arr.push(t)
    tradesByDate.set(t.date, arr)
  }

  const dates: string[] = []
  const nav: number[] = []
  const twr: number[] = []
  const contributions: number[] = []

  let cash = 0
  let contrib = 0
  const positions = new Map<string, number>()
  // zadnja cena iz trade-a — rezerva, dokler feed še nima cene za ta dan
  const lastTradePrice = new Map<string, number>()
  let twrIndex = 1
  let prevNav = 0

  for (let date = start; date <= today; date = addDays(date, 1)) {
    let externalFlow = 0
    for (const cf of flowsByDate.get(date) ?? []) {
      if (cf.type === 'deposit') {
        cash += cf.amount
        contrib += cf.amount
        externalFlow += cf.amount
      } else if (cf.type === 'withdrawal') {
        cash -= cf.amount
        contrib -= cf.amount
        externalFlow -= cf.amount
      } else {
        // strošek: zmanjša vrednost in s tem donos, ni zunanji tok
        cash -= cf.amount
        contrib -= cf.amount
      }
    }
    for (const t of tradesByDate.get(date) ?? []) {
      const gross = t.quantity * t.price
      if (t.side === 'buy') {
        cash -= gross + t.fee
        positions.set(t.ticker, (positions.get(t.ticker) ?? 0) + t.quantity)
      } else {
        cash += gross - t.fee
        positions.set(t.ticker, (positions.get(t.ticker) ?? 0) - t.quantity)
      }
      lastTradePrice.set(t.ticker, t.price)
    }

    let value = cash
    for (const [ticker, qty] of positions) {
      if (qty === 0) continue
      const p = priceAt(prices.get(ticker), date) ?? lastTradePrice.get(ticker) ?? 0
      value += qty * p
    }

    // dnevni TWR: tokovi na začetku dneva
    const base = prevNav + externalFlow
    const r = base > 0 ? (value - prevNav - externalFlow) / base : 0
    twrIndex *= 1 + r

    dates.push(date)
    nav.push(value)
    twr.push(twrIndex)
    contributions.push(contrib)
    prevNav = value
  }

  return { dates, nav, twr, contributions }
}

export function computeHoldings(trades: Trade[], prices: Map<string, PriceSeries>): Holding[] {
  const today = todayISO()
  const qty = new Map<string, number>()
  const lastTradePrice = new Map<string, number>()
  const sorted = [...trades].sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const t of sorted) {
    qty.set(t.ticker, (qty.get(t.ticker) ?? 0) + (t.side === 'buy' ? t.quantity : -t.quantity))
    lastTradePrice.set(t.ticker, t.price)
  }
  const holdings: Holding[] = []
  for (const [ticker, q] of qty) {
    if (Math.abs(q) < 1e-9) continue
    const p = priceAt(prices.get(ticker), today) ?? lastTradePrice.get(ticker) ?? null
    holdings.push({ ticker, quantity: q, lastPrice: p, value: (p ?? 0) * q })
  }
  holdings.sort((a, b) => b.value - a.value)
  return holdings
}

export type PeriodKey = '1W' | 'MTD' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL'

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '1W', label: '1T' },
  { key: 'MTD', label: 'MTD' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1L' },
  { key: 'ALL', label: 'Vse' },
]

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1 + months, d, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** začetni indeks za obdobje: zadnja točka pred začetkom obdobja je izhodišče */
export function periodStartIndex(dates: string[], period: PeriodKey): number {
  if (dates.length === 0) return 0
  const today = dates[dates.length - 1]
  let from: string
  switch (period) {
    case '1W':
      from = addDays(today, -7)
      break
    case 'MTD':
      from = today.slice(0, 8) + '01'
      from = addDays(from, -1) // izhodišče: konec prejšnjega meseca
      break
    case '1M':
      from = addMonths(today, -1)
      break
    case '3M':
      from = addMonths(today, -3)
      break
    case 'YTD':
      from = today.slice(0, 4) + '-01-01'
      from = addDays(from, -1)
      break
    case '1Y':
      from = addMonths(today, -12)
      break
    case 'ALL':
      return 0
  }
  let idx = dates.findIndex((d) => d >= from)
  if (idx === -1) idx = 0
  return idx
}
