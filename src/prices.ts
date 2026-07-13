import { db, type Instrument, type PricePoint } from './db'

interface PriceFeed {
  ticker: string
  updated: string
  prices: { date: string; close: number }[]
}

/**
 * Naloži dnevne cene iz statičnega feeda (public/prices/{ticker}.json,
 * ki ga dnevno osvežuje GitHub Action) in jih zlije v IndexedDB.
 * Ročno vnesene cene (manual) imajo prednost pred feedom.
 */
export async function refreshPrices(): Promise<void> {
  // osveži tudi seznam instrumentov iz feeda (novi tickerji, dodani v repo)
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}instruments.json`, { cache: 'no-cache' })
    if (res.ok) {
      const instruments: Instrument[] = await res.json()
      for (const inst of instruments) {
        const existing = await db.instruments.get(inst.ticker)
        if (!existing) await db.instruments.add(inst)
      }
    }
  } catch {
    // offline — delamo z obstoječimi podatki
  }

  const instruments = await db.instruments.toArray()
  await Promise.all(instruments.map((inst) => refreshTicker(inst.ticker)))
}

async function refreshTicker(ticker: string): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}prices/${ticker}.json`, { cache: 'no-cache' })
    if (!res.ok) return
    const feed: PriceFeed = await res.json()
    const manualDates = new Set(
      (await db.prices.where('ticker').equals(ticker).toArray())
        .filter((p) => p.manual)
        .map((p) => p.date),
    )
    const points: PricePoint[] = feed.prices
      .filter((p) => !manualDates.has(p.date))
      .map((p) => ({ ticker, date: p.date, close: p.close }))
    await db.prices.bulkPut(points)
  } catch {
    // offline — delamo z obstoječimi podatki
  }
}

/** Zgodovina cen za en ticker, urejena po datumu naraščajoče. */
export type PriceSeries = { dates: string[]; closes: number[] }

export async function loadPriceSeries(tickers: string[]): Promise<Map<string, PriceSeries>> {
  const map = new Map<string, PriceSeries>()
  for (const ticker of tickers) {
    const rows = await db.prices.where('ticker').equals(ticker).toArray()
    rows.sort((a, b) => (a.date < b.date ? -1 : 1))
    map.set(ticker, { dates: rows.map((r) => r.date), closes: rows.map((r) => r.close) })
  }
  return map
}
