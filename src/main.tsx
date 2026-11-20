import { Alert, Box, CssBaseline, ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { App } from './app/App'
import { theme } from './app/theme'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NotificationsProvider } from './components/Notifications'
import { isSupabaseConfigured } from './data/supabaseClient'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <NotificationsProvider>
            {isSupabaseConfigured ? (
              // HashRouter: GitHub Pages has no SPA fallback, so deep links must live after the #
              <HashRouter>
                <App />
              </HashRouter>
            ) : (
              <Box sx={{ p: 3 }}>
                <Alert severity="error">
                  Application mal configurée : VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY
                  sont manquants.
                </Alert>
              </Box>
            )}
          </NotificationsProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
