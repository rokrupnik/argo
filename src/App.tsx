import { Navigate, Route, Routes } from 'react-router-dom'
import ProfilePicker from './pages/ProfilePicker'
import CompareAll from './pages/CompareAll'
import ProfileLayout from './pages/ProfileLayout'
import Dashboard from './pages/Dashboard'
import Cashflows from './pages/Cashflows'
import Trades from './pages/Trades'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProfilePicker />} />
      <Route path="/primerjava" element={<CompareAll />} />
      <Route path="/p/:profileId" element={<ProfileLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="vplacila" element={<Cashflows />} />
        <Route path="trgovanje" element={<Trades />} />
        <Route path="nastavitve" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
