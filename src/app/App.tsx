import { Navigate, Route, Routes } from 'react-router'
import { AdminPage } from '../features/admin/AdminPage'
import { BalancesPage } from '../features/balances/BalancesPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { EditGamePage } from '../features/games/EditGamePage'
import { GameDetailPage } from '../features/games/GameDetailPage'
import { GamesPage } from '../features/games/GamesPage'
import { NewGamePage } from '../features/games/NewGamePage'
import { AppLayout } from './AppLayout'
import { AuthGate } from './AuthGate'

export function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="parties" element={<GamesPage />} />
          <Route path="parties/nouvelle" element={<NewGamePage />} />
          <Route path="parties/:gameId" element={<GameDetailPage />} />
          <Route path="parties/:gameId/modifier" element={<EditGamePage />} />
          <Route path="soldes" element={<BalancesPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthGate>
  )
}
