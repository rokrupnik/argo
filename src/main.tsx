import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles.css'
import App from './App'
import { seedIfEmpty } from './seed'
import { refreshPrices } from './prices'

async function start() {
  await seedIfEmpty()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
  // cene osvežimo v ozadju, aplikacija medtem že dela z lokalnimi podatki
  refreshPrices()
  lastRefresh = Date.now()

  // iOS PWA ob prebuditvi iz ozadja ne požene zagona znova — cene
  // osvežimo tudi, ko aplikacija spet postane vidna (največ vsakih 15 min)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 15 * 60 * 1000) {
      lastRefresh = Date.now()
      refreshPrices()
    }
  })
}

let lastRefresh = 0

start()
