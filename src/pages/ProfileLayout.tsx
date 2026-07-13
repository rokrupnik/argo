import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { createContext, useContext } from 'react'
import { db, type Profile } from '../db'

const ProfileContext = createContext<Profile | null>(null)

export function useProfile(): Profile {
  const p = useContext(ProfileContext)
  if (!p) throw new Error('Profil ni naložen')
  return p
}

const NAV = [
  { to: '', label: 'Pregled', emoji: '📈', end: true },
  { to: 'vplacila', label: 'Vplačila', emoji: '💶', end: false },
  { to: 'trgovanje', label: 'Trgovanje', emoji: '🔁', end: false },
  { to: 'nastavitve', label: 'Nastavitve', emoji: '⚙️', end: false },
]

export default function ProfileLayout() {
  const { profileId } = useParams()
  const navigate = useNavigate()
  const profile = useLiveQuery(
    async () => (await db.profiles.get(profileId ?? '')) ?? null,
    [profileId],
  )

  if (profile === undefined) return null // nalaganje
  if (profile === null) return <Navigate to="/" replace />


  return (
    <ProfileContext.Provider value={profile}>
      <div className="app-shell" style={{ ['--profile-color' as string]: profile.color }}>
        <header className="topbar">
          <button className="topbar-profile" onClick={() => navigate('/')} title="Zamenjaj profil">
            <span className="topbar-emoji">{profile.emoji}</span>
            <span className="topbar-name">{profile.name}</span>
            <span className="topbar-switch">⇄</span>
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <nav className="bottomnav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="bottomnav-item">
              <span className="bottomnav-emoji">{item.emoji}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </ProfileContext.Provider>
  )
}
