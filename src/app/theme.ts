import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#c6d93a' },
    success: { main: '#2e7d32' },
    warning: { main: '#ed6c02' },
    background: { default: '#f5f7fa' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', minHeight: 44 } } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
  },
})
