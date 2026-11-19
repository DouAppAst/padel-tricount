import { Alert, Box, Button, CircularProgress } from '@mui/material'
import { errorMessage } from './errorMessage'

export function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress aria-label="Chargement" />
    </Box>
  )
}

export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Réessayer
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </Alert>
  )
}
