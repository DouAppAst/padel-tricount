import { Button, Snackbar } from '@mui/material'
import { useCallback, useState, type ReactNode } from 'react'
import { NotifyContext, type Notify } from './notify'

interface Notification {
  message: string
  actionLabel?: string
  onAction?: () => void
  key: number
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Notification | null>(null)

  const notify = useCallback<Notify>((message, action) => {
    setCurrent({ message, actionLabel: action?.label, onAction: action?.onClick, key: Date.now() })
  }, [])

  const close = () => setCurrent(null)

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        key={current?.key}
        open={current !== null}
        autoHideDuration={6000}
        onClose={(_, reason) => reason !== 'clickaway' && close()}
        message={current?.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, md: 24 } }}
        action={
          current?.onAction && (
            <Button
              color="secondary"
              size="small"
              onClick={() => {
                current.onAction?.()
                close()
              }}
            >
              {current.actionLabel}
            </Button>
          )
        }
      />
    </NotifyContext.Provider>
  )
}
