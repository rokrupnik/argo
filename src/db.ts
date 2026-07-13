import Dexie, { type EntityTable } from 'dexie'

export interface Profile {
  id: string
  name: string
  emoji: string
  color: string
  /** datum odprtja računa, ISO yyyy-mm-dd; graf in izračuni se začnejo tu (z 0 €) */
  openingDate: string
  createdAt: number
}

export type CashflowType = 'deposit' | 'withdrawal' | 'fee'

export interface Cashflow {
  id: string
  profileId: string
  type: CashflowType
  /** ISO yyyy-mm-dd */
  date: string
  /** vedno pozitiven znesek v EUR; predznak določa type */
  amount: number
  note?: string
}

export interface Trade {
  id: string
  profileId: string
  ticker: string
  side: 'buy' | 'sell'
  /** ISO yyyy-mm-dd */
  date: string
  quantity: number
  /** cena na enoto v EUR */
  price: number
  /** provizija v EUR */
  fee: number
}

export interface Instrument {
  ticker: string
  name: string
  mic?: string
  isin?: string
}

export interface PricePoint {
  ticker: string
  /** ISO yyyy-mm-dd */
  date: string
  close: number
  /** ročno vnesena cena — je ne povozi feed */
  manual?: boolean
}

export const db = new Dexie('argo') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  cashflows: EntityTable<Cashflow, 'id'>
  trades: EntityTable<Trade, 'id'>
  instruments: EntityTable<Instrument, 'ticker'>
  prices: Dexie.Table<PricePoint, [string, string]>
}

db.version(1).stores({
  profiles: 'id, createdAt',
  cashflows: 'id, profileId, date, [profileId+date]',
  trades: 'id, profileId, date, ticker, [profileId+date]',
  instruments: 'ticker',
  prices: '[ticker+date], ticker, date',
})

export function newId(): string {
  return crypto.randomUUID()
}
