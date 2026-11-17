import AddIcon from '@mui/icons-material/Add'
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Drawer,
  Fab,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { activeNavPath, NAV_ITEMS, NEW_GAME_PATH } from './navigation'

const DRAWER_WIDTH = 220

export function AppLayout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const location = useLocation()
  const navigate = useNavigate()
  const current = activeNavPath(location.pathname)
  const onNewGamePage = location.pathname === NEW_GAME_PATH

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Padel Tricount
          </Typography>
          {isDesktop && !onNewGamePage && (
            <Button
              color="inherit"
              variant="outlined"
              startIcon={<AddIcon />}
              component={Link}
              to={NEW_GAME_PATH}
            >
              Nouvelle partie
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          <Toolbar />
          <List component="nav" aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                selected={current === item.path}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

      <Box
        component="main"
        sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, pb: { xs: 12, md: 3 }, minWidth: 0 }}
      >
        <Toolbar />
        <Outlet />
      </Box>

      {!isDesktop && (
        <>
          {!onNewGamePage && (
            <Fab
              color="primary"
              aria-label="Nouvelle partie"
              component={Link}
              to={NEW_GAME_PATH}
              sx={{ position: 'fixed', right: 16, bottom: 72 }}
            >
              <AddIcon />
            </Fab>
          )}
          <Paper
            elevation={3}
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              pb: 'env(safe-area-inset-bottom)',
            }}
          >
            <BottomNavigation
              showLabels
              value={current}
              onChange={(_, path: string) => navigate(path)}
            >
              {NAV_ITEMS.map((item) => (
                <BottomNavigationAction
                  key={item.path}
                  label={item.label}
                  value={item.path}
                  icon={item.icon}
                />
              ))}
            </BottomNavigation>
          </Paper>
        </>
      )}
    </Box>
  )
}
