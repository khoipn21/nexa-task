import { ClerkProvider } from '@clerk/clerk-react'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthSync } from './lib/auth-sync'
import { queryClient } from './lib/query-client'
import { router } from './routes'
import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.css'
import './index.css'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_KEY) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required')
}

const theme = createTheme({
  fontFamily: 'Inter, system-ui, sans-serif',
  primaryColor: 'blue',
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <AuthSync>
        <QueryClientProvider client={queryClient}>
          <MantineProvider theme={theme}>
            <Notifications />
            <RouterProvider router={router} />
          </MantineProvider>
        </QueryClientProvider>
      </AuthSync>
    </ClerkProvider>
  </StrictMode>,
)
