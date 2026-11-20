import { Alert, Box, Button } from '@mui/material'
import { Component, type ReactNode } from 'react'

interface State {
  failed: boolean
}

/** Last-resort screen instead of a blank page (e.g. a new version deployed while the app was open). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Recharger
            </Button>
          }
        >
          Une erreur inattendue est survenue. Recharge la page.
        </Alert>
      </Box>
    )
  }
}
