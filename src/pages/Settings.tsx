import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db } from '../db'
import { useProfile } from './ProfileLayout'
import { fmtDate, fmtEur, todayISO } from '../format'
import { refreshPrices } from '../prices'
import { COLORS, EMOJIS } from '../profileOptions'
import DeleteButton from '../components/DeleteButton'

export default function Settings() {
  const profile = useProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function update(patch: Partial<typeof profile>) {
    await db.profiles.update(profile.id, patch)
  }

  async function exportData() {
    const data = {
      app: 'argo',
      version: 1,
      exported: new Date().toISOString(),
      profiles: await db.profiles.toArray(),
      cashflows: await db.cashflows.toArray(),
      trades: await db.trades.toArray(),
      instruments: await db.instruments.toArray(),
      manualPrices: (await db.prices.toArray()).filter((p) => p.manual),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `argo-varnostna-kopija-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      const data = JSON.parse(await file.text())
      if (data.app !== 'argo' || !Array.isArray(data.profiles)) {
        setMsg('Datoteka ni veljavna Argo varnostna kopija.')
        return
      }
      if (!confirm('Uvoz ZAMENJA vse obstoječe podatke v aplikaciji. Nadaljujem?')) return
      await db.transaction('rw', [db.profiles, db.cashflows, db.trades, db.instruments, db.prices], async () => {
        await Promise.all([
          db.profiles.clear(),
          db.cashflows.clear(),
          db.trades.clear(),
          db.instruments.clear(),
        ])
        await db.profiles.bulkAdd(data.profiles)
        if (data.cashflows?.length) await db.cashflows.bulkAdd(data.cashflows)
        if (data.trades?.length) await db.trades.bulkAdd(data.trades)
        if (data.instruments?.length) await db.instruments.bulkAdd(data.instruments)
        if (data.manualPrices?.length) await db.prices.bulkPut(data.manualPrices)
      })
      await refreshPrices()
      setMsg('Podatki uspešno uvoženi. ✅')
    } catch {
      setMsg('Uvoz ni uspel — datoteka je poškodovana.')
    }
  }

  return (
    <div className="list-page settings">
      <section className="card">
        <h2>Profil</h2>
        <label className="field">
          <span>Ime</span>
          <input type="text" value={profile.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Datum odprtja računa</span>
          <input
            type="date"
            value={profile.openingDate}
            max={todayISO()}
            onChange={(e) => e.target.value && update({ openingDate: e.target.value })}
          />
        </label>
        <p className="muted small">Graf in izračuni se začnejo na ta dan, s stanjem 0 €.</p>
        <div className="field">
          <span>Ikona</span>
          <div className="chips">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className={'chip' + (profile.emoji === e ? ' active' : '')}
                onClick={() => update({ emoji: e })}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Barva</span>
          <div className="chips">
            {COLORS.map((c) => (
              <button
                key={c}
                className={'chip color-chip' + (profile.color === c ? ' active' : '')}
                style={{ background: c }}
                onClick={() => update({ color: c })}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </section>

      <ManualPrices />

      <section className="card">
        <h2>Varnostna kopija</h2>
        <p className="muted small">
          Podatki so shranjeni samo na tej napravi. Redno naredi izvoz in ga shrani na varno.
        </p>
        <div className="form-actions">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            📥 Uvozi
          </button>
          <button className="btn primary" onClick={exportData}>
            📤 Izvozi
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importData(f)
            e.target.value = ''
          }}
        />
        {msg && <p className="small">{msg}</p>}
      </section>

      <section className="card">
        <h2>Izbriši profil</h2>
        <p className="muted small">
          Izbriše profil <strong>{profile.name}</strong> in vsa njegova vplačila ter trade-e. Tega
          ni mogoče razveljaviti.
        </p>
        <div className="form-actions">
          <DeleteButton
            onDelete={async () => {
              await db.transaction('rw', [db.profiles, db.cashflows, db.trades], async () => {
                await db.cashflows.where('profileId').equals(profile.id).delete()
                await db.trades.where('profileId').equals(profile.id).delete()
                await db.profiles.delete(profile.id)
              })
              // ProfileLayout ob izginulem profilu sam preusmeri na izbiro profilov
            }}
          />
        </div>
      </section>
    </div>
  )
}

function ManualPrices() {
  const instruments = useLiveQuery(() => db.instruments.toArray(), [])
  const lastPrices = useLiveQuery(async () => {
    const all = await db.prices.toArray()
    const last = new Map<string, { date: string; close: number }>()
    for (const p of all) {
      const cur = last.get(p.ticker)
      if (!cur || p.date > cur.date) last.set(p.ticker, { date: p.date, close: p.close })
    }
    return last
  }, [])
  const [ticker, setTicker] = useState('')
  const [date, setDate] = useState(todayISO())
  const [close, setClose] = useState('')

  if (!instruments || !lastPrices) return null
  const effTicker = ticker || instruments[0]?.ticker || ''
  const parsed = parseFloat(close.replace(',', '.'))
  const valid = !!effTicker && !!date && !isNaN(parsed) && parsed > 0

  return (
    <section className="card">
      <h2>Cene</h2>
      {instruments.map((i) => {
        const lp = lastPrices.get(i.ticker)
        return (
          <div key={i.ticker} className="holding-row">
            <div>
              <strong>{i.ticker}</strong>
              <span className="muted">{i.name}</span>
            </div>
            <span className="muted">{lp ? `${fmtEur(lp.close)} (${fmtDate(lp.date)})` : 'ni cene'}</span>
          </div>
        )
      })}
      <details className="manual-price">
        <summary>Ročni vnos cene</summary>
        <p className="muted small">
          Za instrumente, ki jih dnevni feed ne pokriva, lahko ceno vneseš ročno.
        </p>
        <div className="field-row">
          <label className="field">
            <span>Instrument</span>
            <select value={effTicker} onChange={(e) => setTicker(e.target.value)}>
              {instruments.map((i) => (
                <option key={i.ticker} value={i.ticker}>
                  {i.ticker}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Datum</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Cena (€)</span>
          <input type="text" inputMode="decimal" value={close} onChange={(e) => setClose(e.target.value)} />
        </label>
        <div className="form-actions">
          <button
            className="btn primary"
            disabled={!valid}
            onClick={async () => {
              await db.prices.put({ ticker: effTicker, date, close: parsed, manual: true })
              setClose('')
            }}
          >
            Shrani ceno
          </button>
        </div>
      </details>
    </section>
  )
}
