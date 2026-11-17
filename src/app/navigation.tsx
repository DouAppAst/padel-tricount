import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import HomeIcon from '@mui/icons-material/Home'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import SportsTennisIcon from '@mui/icons-material/SportsTennis'
import type { ReactElement } from 'react'

export interface NavItem {
  label: string
  path: string
  icon: ReactElement
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', path: '/', icon: <HomeIcon /> },
  { label: 'Parties', path: '/parties', icon: <SportsTennisIcon /> },
  { label: 'Soldes', path: '/soldes', icon: <AccountBalanceWalletIcon /> },
  { label: 'Admin', path: '/admin', icon: <AdminPanelSettingsIcon /> },
]

export const NEW_GAME_PATH = '/parties/nouvelle'

export function activeNavPath(pathname: string): string {
  const match = NAV_ITEMS.filter((item) => item.path !== '/')
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  return match?.path ?? '/'
}
