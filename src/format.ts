const eur = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const eurWhole = new Intl.NumberFormat('sl-SI', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const num = new Intl.NumberFormat('sl-SI', { maximumFractionDigits: 4 })

export function fmtEur(v: number): string {
  return eur.format(v)
}

/** brez centov za velike prikaze */
export function fmtEurBig(v: number): string {
  return Math.abs(v) >= 1000 ? eurWhole.format(v) : eur.format(v)
}

export function fmtSigned(v: number): string {
  return (v > 0 ? '+' : '') + eur.format(v)
}

export function fmtPct(v: number): string {
  const s = new Intl.NumberFormat('sl-SI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v * 100)
  return (v > 0 ? '+' : '') + s + ' %'
}

export function fmtQty(v: number): string {
  return num.format(v)
}

/** ISO yyyy-mm-dd → 13. 7. 2026 */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}. ${m}.`
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
