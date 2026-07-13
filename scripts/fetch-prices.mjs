// Povleče zgodovino dnevnih cen z Ljubljanske borze (rest.ljse.si) za vse
// instrumente iz public/instruments.json in jih zapiše v public/prices/{ticker}.json.
// Poganja ga GitHub Action vsak trgovalni dan; lahko ga poženeš tudi ročno: node scripts/fetch-prices.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const UA = { 'User-Agent': 'Mozilla/5.0 (argo family portfolio tracker)' }
const HISTORY_FROM = '2015-01-01'

// znan žeton kot rezerva; stran vrednostnega papirja vsebuje svežega
const FALLBACK_REST = 'https://rest.ljse.si/web/Bvt9fe2peQ7pwpyYqODM/'

async function getRestBase(firstIsin) {
  try {
    const res = await fetch(`https://ljse.si/en/papir-311/310?isin=${firstIsin}`, { headers: UA })
    const html = await res.text()
    const m = html.match(/https:\/\/rest\.ljse\.si\/web\/[A-Za-z0-9]+\//)
    if (m) return m[0]
  } catch {
    // nadaljujemo z rezervo
  }
  console.warn('REST žetona ni v HTML-ju, uporabim znanega')
  return FALLBACK_REST
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchHistory(restBase, inst) {
  const url = `${restBase}security-history/${inst.mic}/${inst.isin}/${HISTORY_FROM}/${today()}/json`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`${inst.ticker}: HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data.history)) throw new Error(`${inst.ticker}: nepričakovan odgovor`)
  const prices = data.history
    .map((r) => ({ date: r.date, close: parseFloat(r.last_price) }))
    .filter((p) => p.date && isFinite(p.close) && p.close > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  return prices
}

const instruments = JSON.parse(readFileSync('public/instruments.json', 'utf8'))
mkdirSync('public/prices', { recursive: true })
const restBase = await getRestBase(instruments.find((i) => i.isin)?.isin ?? '')
console.log('REST base:', restBase)

let failures = 0
for (const inst of instruments) {
  if (!inst.mic || !inst.isin) {
    console.log(`${inst.ticker}: preskočen (ni mic/isin — cene se vnašajo ročno)`)
    continue
  }
  try {
    const prices = await fetchHistory(restBase, inst)
    const out = { ticker: inst.ticker, updated: new Date().toISOString(), prices }
    writeFileSync(`public/prices/${inst.ticker}.json`, JSON.stringify(out))
    console.log(`${inst.ticker}: ${prices.length} cen, zadnja ${prices.at(-1)?.date} = ${prices.at(-1)?.close}`)
  } catch (err) {
    failures++
    console.error(`${inst.ticker}: NAPAKA — ${err.message}`)
  }
}
if (failures > 0) process.exit(1)
