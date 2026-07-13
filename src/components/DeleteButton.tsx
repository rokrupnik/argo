import { useState } from 'react'

/** Brisanje z dvojno potrditvijo: prvi klik vpraša, drugi izbriše. */
export default function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      className={'btn danger' + (armed ? ' armed' : '')}
      onClick={() => (armed ? onDelete() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Res izbrišem?' : 'Izbriši'}
    </button>
  )
}
