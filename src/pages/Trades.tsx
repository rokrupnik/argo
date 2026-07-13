import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, newId, type Trade } from '../db'
import { useProfile } from './ProfileLayout'
import Modal from '../components/Modal'
import DeleteButton from '../components/DeleteButton'
import { fmtDate, fmtEur, fmtQty, todayISO } from '../format'

export default function Trades() {
  const profile = useProfile()
  const [editing, setEditing] = useState<Trade | 'new' | null>(null)

  const rows = useLiveQuery(
    () => db.trades.where('profileId').equals(profile.id).toArray(),
    [profile.id],
  )
  if (!rows) return null
  rows.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))

  return (
    <div className="list-page">
      {rows.length === 0 && (
        <div className="card empty-hint">
          <p>Še ni trgovanja. Dodaj prvi nakup s spodnjim gumbom ➕</p>
        </div>
      )}

      <div className="rows">
        {rows.map((t) => {
          const total = t.quantity * t.price + (t.side === 'buy' ? t.fee : -t.fee)
          return (
            <button key={t.id} className="row card" onClick={() => setEditing(t)}>
              <span className="row-emoji">{t.side === 'buy' ? '🟢' : '🔴'}</span>
              <span className="row-main">
                <strong>
                  {t.side === 'buy' ? 'Nakup' : 'Prodaja'} {t.ticker}
                </strong>
                <span className="muted">
                  {fmtDate(t.date)} · {fmtQty(t.quantity)} × {fmtEur(t.price)}
                  {t.fee > 0 ? ` · provizija ${fmtEur(t.fee)}` : ''}
                </span>
              </span>
              <strong className={t.side === 'buy' ? 'neg' : 'pos'}>
                {t.side === 'buy' ? '−' : '+'}
                {fmtEur(total)}
              </strong>
            </button>
          )
        })}
      </div>

      <button className="fab" onClick={() => setEditing('new')} aria-label="Dodaj">
        ＋
      </button>

      {editing && (
        <TradeForm
          profileId={profile.id}
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function TradeForm({
  profileId,
  existing,
  onClose,
}: {
  profileId: string
  existing: Trade | null
  onClose: () => void
}) {
  const instruments = useLiveQuery(() => db.instruments.toArray(), [])
  const [side, setSide] = useState<'buy' | 'sell'>(existing?.side ?? 'buy')
  const [ticker, setTicker] = useState(existing?.ticker ?? '')
  const [newTicker, setNewTicker] = useState('')
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : '')
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [fee, setFee] = useState(existing ? String(existing.fee) : '0')

  if (!instruments) return null
  const effectiveTicker = ticker === '__new__' ? newTicker.trim().toUpperCase() : ticker || instruments[0]?.ticker || ''

  const qty = parseFloat(quantity.replace(',', '.'))
  const prc = parseFloat(price.replace(',', '.'))
  const f = parseFloat(fee.replace(',', '.') || '0')
  const valid =
    !!effectiveTicker && !!date && !isNaN(qty) && qty > 0 && !isNaN(prc) && prc > 0 && !isNaN(f) && f >= 0

  const total = valid ? qty * prc + (side === 'buy' ? f : -f) : null

  async function save() {
    if (!valid) return
    if (ticker === '__new__' && !(await db.instruments.get(effectiveTicker))) {
      await db.instruments.add({ ticker: effectiveTicker, name: effectiveTicker })
    }
    const row: Trade = {
      id: existing?.id ?? newId(),
      profileId,
      ticker: effectiveTicker,
      side,
      date,
      quantity: qty,
      price: prc,
      fee: f,
    }
    await db.trades.put(row)
    onClose()
  }

  async function remove() {
    if (existing) {
      await db.trades.delete(existing.id)
      onClose()
    }
  }

  return (
    <Modal title={existing ? 'Uredi trade' : 'Nov trade'} onClose={onClose}>
      <div className="segmented">
        <button className={'segment' + (side === 'buy' ? ' active' : '')} onClick={() => setSide('buy')}>
          🟢 Nakup
        </button>
        <button className={'segment' + (side === 'sell' ? ' active' : '')} onClick={() => setSide('sell')}>
          🔴 Prodaja
        </button>
      </div>
      <label className="field">
        <span>Instrument</span>
        <select value={ticker || instruments[0]?.ticker || ''} onChange={(e) => setTicker(e.target.value)}>
          {instruments.map((i) => (
            <option key={i.ticker} value={i.ticker}>
              {i.ticker} — {i.name}
            </option>
          ))}
          <option value="__new__">＋ Drug instrument …</option>
        </select>
      </label>
      {ticker === '__new__' && (
        <label className="field">
          <span>Ticker novega instrumenta</span>
          <input
            type="text"
            placeholder="npr. ICKRK"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
          />
        </label>
      )}
      <label className="field">
        <span>Datum</span>
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Količina</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="npr. 2"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Cena (€)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="npr. 64,90"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>Provizija (€)</span>
        <input type="text" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
      </label>
      {total !== null && (
        <p className="form-total">
          Skupaj: <strong>{fmtEur(total)}</strong> {side === 'buy' ? 'odšteto z računa' : 'prejeto na račun'}
        </p>
      )}
      <div className="form-actions">
        {existing && <DeleteButton onDelete={remove} />}
        <button className="btn primary" disabled={!valid} onClick={save}>
          Shrani
        </button>
      </div>
    </Modal>
  )
}
