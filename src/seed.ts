import { db, newId } from './db'

const DEFAULT_PROFILES = [
  { name: 'Rok', emoji: '⛵', color: '#2563eb' },
  { name: 'Simon', emoji: '🦁', color: '#16a34a' },
  { name: 'Jakob', emoji: '🚀', color: '#ea580c' },
  { name: 'Andrej', emoji: '🐬', color: '#9333ea' },
]

const DEFAULT_INSTRUMENTS = [
  {
    ticker: 'ICSLO',
    name: 'InterCapital SBITOP TR UCITS ETF',
    mic: 'XLJU',
    isin: 'HRICAMFSBIB2',
  },
]

/** Ob prvem zagonu ustvari štiri profile in privzeti instrument. */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.profiles.count()
  if (count === 0) {
    // vse štiri račune smo odprli isti dan
    const OPENING_DATE = '2026-05-08'
    await db.profiles.bulkAdd(
      DEFAULT_PROFILES.map((p, i) => ({
        id: newId(),
        ...p,
        openingDate: OPENING_DATE,
        createdAt: Date.now() + i,
      })),
    )
  }
  const instrumentCount = await db.instruments.count()
  if (instrumentCount === 0) {
    await db.instruments.bulkAdd(DEFAULT_INSTRUMENTS)
  }
}
