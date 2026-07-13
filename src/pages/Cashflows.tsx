import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, newId, type Cashflow, type CashflowType } from '../db'
import { useProfile } from './ProfileLayout'
import Modal from '../components/Modal'
import DeleteButton from '../components/DeleteButton'
import { fmtDate, fmtEur, todayISO } from '../format'

const TYPE_META: Record<CashflowType, { label: string; emoji: string; sign: number }> = {
  deposit: { label: 'Vplačilo', emoji: '💰', sign: 1 },
  withdrawal: { label: 'Dvig', emoji: '🏧', sign: -1 },
  fee: { label: 'Strošek', emoji: '🧾', sign: -1 },
}

export default function Cashflows() {
  const profile = useProfile()
  const [editing, setEditing] = useState<Cashflow | 'new' | null>(null)

  const rows = useLiveQuery(
    () => db.cashflows.where('profileId').equals(profile.id).toArray(),
    [profile.id],
  )
  if (!rows) return null
  rows.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0))

  const totalIn = rows.filter((r) => r.type === 'deposit').reduce((s, r) => s + r.amount, 0)
  const totalOut = rows.filter((r) => r.type !== 'deposit').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="list-page">
      <div className="list-summary card">
        <div>
          <span className="muted">Vplačila</span>
          <strong>{fmtEur(totalIn)}</strong>
        </div>
        <div>
          <span className="muted">Dvigi in stroški</span>
          <strong>{fmtEur(totalOut)}</strong>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="card empty-hint">
          <p>Še ni vplačil. Dodaj prvega s spodnjim gumbom ➕</p>
        </div>
      )}

      <div className="rows">
        {rows.map((r) => {
          const meta = TYPE_META[r.type]
          return (
            <button key={r.id} className="row card" onClick={() => setEditing(r)}>
              <span className="row-emoji">{meta.emoji}</span>
              <span className="row-main">
                <strong>{meta.label}</strong>
                <span className="muted">
                  {fmtDate(r.date)}
                  {r.note ? ` · ${r.note}` : ''}
                </span>
              </span>
              <strong className={meta.sign > 0 ? 'pos' : 'neg'}>
                {meta.sign > 0 ? '+' : '−'}
                {fmtEur(r.amount)}
              </strong>
            </button>
          )
        })}
      </div>

      <button className="fab" onClick={() => setEditing('new')} aria-label="Dodaj">
        ＋
      </button>

      {editing && (
        <CashflowForm
          profileId={profile.id}
          existing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CashflowForm({
  profileId,
  existing,
  onClose,
}: {
  profileId: string
  existing: Cashflow | null
  onClose: () => void
}) {
  const [type, setType] = useState<CashflowType>(existing?.type ?? 'deposit')
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [note, setNote] = useState(existing?.note ?? '')

  const parsed = parseFloat(amount.replace(',', '.'))
  const valid = !isNaN(parsed) && parsed > 0 && !!date

  async function save() {
    if (!valid) return
    const row: Cashflow = {
      id: existing?.id ?? newId(),
      profileId,
      type,
      date,
      amount: parsed,
      note: note.trim() || undefined,
    }
    await db.cashflows.put(row)
    onClose()
  }

  async function remove() {
    if (existing) {
      await db.cashflows.delete(existing.id)
      onClose()
    }
  }

  return (
    <Modal title={existing ? 'Uredi vnos' : 'Nov vnos'} onClose={onClose}>
      <div className="segmented">
        {(Object.keys(TYPE_META) as CashflowType[]).map((t) => (
          <button
            key={t}
            className={'segment' + (type === t ? ' active' : '')}
            onClick={() => setType(t)}
          >
            {TYPE_META[t].emoji} {TYPE_META[t].label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Datum</span>
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="field">
        <span>Znesek (€)</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="npr. 50"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Opomba (neobvezno)</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="form-actions">
        {existing && <DeleteButton onDelete={remove} />}
        <button className="btn primary" disabled={!valid} onClick={save}>
          Shrani
        </button>
      </div>
    </Modal>
  )
}
