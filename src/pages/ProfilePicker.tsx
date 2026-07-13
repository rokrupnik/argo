import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, newId } from '../db'
import { COLORS, EMOJIS } from '../profileOptions'
import { todayISO } from '../format'

export default function ProfilePicker() {
  const profiles = useLiveQuery(() => db.profiles.orderBy('createdAt').toArray(), [])
  const navigate = useNavigate()

  if (!profiles) return null

  const names = new Set(profiles.map((p) => p.name.trim()))
  const familyComplete = FAMILY.every((n) => names.has(n))

  async function addProfile() {
    const taken = new Set(profiles!.map((p) => p.emoji))
    const takenColors = new Set(profiles!.map((p) => p.color))
    const id = newId()
    await db.profiles.add({
      id,
      name: 'Nov profil',
      emoji: EMOJIS.find((e) => !taken.has(e)) ?? EMOJIS[0],
      color: COLORS.find((c) => !takenColors.has(c)) ?? COLORS[0],
      openingDate: todayISO(),
      createdAt: Date.now(),
    })
    // naravnost v nastavitve, da si nov profil takoj nastavi ime in datum odprtja
    navigate(`/p/${id}/nastavitve`)
  }

  return (
    <div className="picker-page">
      <header className="picker-header">
        <div className="picker-logo">⛵</div>
        <h1>Argo</h1>
        <p>{profiles.length > 0 ? 'Kdo si?' : 'Dodaj svoj prvi profil.'}</p>
      </header>
      <div className="picker-grid">
        {profiles.map((p) => (
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
      <div className="picker-actions">
        {profiles.length > 1 && (
          <button className="picker-compare" onClick={() => navigate('/primerjava')}>
            📊 Primerjava vseh
          </button>
        )}
        {!familyComplete && (
          <button className="picker-compare picker-add" onClick={addProfile}>
            ＋ Nov profil
          </button>
        )}
      </div>
    </div>
  )
}

/** ko so vsi štirje družinski profili ustvarjeni, gumba za nove ne kažemo več */
const FAMILY = ['Rok', 'Simon', 'Jakob', 'Andrej']
