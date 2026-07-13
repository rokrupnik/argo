import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'

export default function ProfilePicker() {
  const profiles = useLiveQuery(() => db.profiles.orderBy('createdAt').toArray(), [])
  const navigate = useNavigate()

  return (
    <div className="picker-page">
      <header className="picker-header">
        <div className="picker-logo">⛵</div>
        <h1>Argo</h1>
        <p>Kdo si?</p>
      </header>
      <div className="picker-grid">
        {profiles?.map((p) => (
          <button
            key={p.id}
            className="picker-card"
            style={{ ['--profile-color' as string]: p.color }}
            onClick={() => navigate(`/p/${p.id}`)}
          >
            <span className="picker-emoji">{p.emoji}</span>
            <span className="picker-name">{p.name}</span>
          </button>
        ))}
      </div>
      <button className="picker-compare" onClick={() => navigate('/primerjava')}>
        📊 Primerjava vseh
      </button>
    </div>
  )
}
