import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { HashRouter } from 'react-router-dom'
import '@mantine/core/styles.css'
import { theme } from '@/theme'
import App from '@/App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <App />
      </MantineProvider>
    </HashRouter>
  </StrictMode>,
)
