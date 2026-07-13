import { db } from './db'

const DEFAULT_INSTRUMENTS = [
  {
    ticker: 'ICSLO',
    name: 'InterCapital SBITOP TR UCITS ETF',
    mic: 'XLJU',
    isin: 'HRICAMFSBIB2',
  },
]

/** Ob prvem zagonu ustvari privzeti instrument; profile si uporabnik doda sam. */
export async function seedIfEmpty(): Promise<void> {
  const instrumentCount = await db.instruments.count()
  if (instrumentCount === 0) {
    await db.instruments.bulkAdd(DEFAULT_INSTRUMENTS)
  }
}
