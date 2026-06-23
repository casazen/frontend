import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

console.log('[DEBUG] main.tsx — before i18n/config import');
import './i18n/config'
console.log('[DEBUG] main.tsx — after i18n/config import');
import './styles/globals.css'
console.log('[DEBUG] main.tsx — after globals.css import');
import App from './App.tsx'
console.log('[DEBUG] main.tsx — after App import, about to render');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
