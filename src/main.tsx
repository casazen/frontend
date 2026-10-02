import './lib/zod-config'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/config'
import './styles/globals.css'
import App from './App.tsx'
import { HostAwareRoot } from '@/features/public-site/host/host-aware-root'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HostAwareRoot>
      <App />
    </HostAwareRoot>
  </StrictMode>,
)
