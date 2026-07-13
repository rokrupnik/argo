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
}

start()
