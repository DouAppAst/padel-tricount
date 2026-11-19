import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import AddIcon from '@mui/icons-material/Add'
import {
  AppBar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Drawer,
  Fab,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { usePendingLinkRequests } from '../data/queries'
import { signOut } from '../data/repositories/account'
import { useMe } from './me'
import { activeNavPath, NAV_ITEMS, NEW_GAME_PATH, type NavItem } from './navigation'

const DRAWER_WIDTH = 220

export function AppLayout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const location = useLocation()
  const navigate = useNavigate()
  const me = useMe()
  const pendingRequests = usePendingLinkRequests(me.isAdmin)
  const current = activeNavPath(location.pathname)
  const onNewGamePage = location.pathname === NEW_GAME_PATH

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || me.isAdmin)
  const pendingCount = pendingRequests.data?.length ?? 0
  const icon = (item: NavItem): ReactNode =>
    item.path === '/admin' && pendingCount > 0 ? (
      <Badge badgeContent={pendingCount} color="error">
        {item.icon}
      </Badge>
    ) : (
      item.icon
    )

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
              sx={{ mr: 1 }}
            >
              Nouvelle partie
            </Button>
          )}
          <UserMenu />
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
            {items.map((item) => (
              <ListItemButton
                key={item.path}
                component={Link}
                to={item.path}
                selected={current === item.path}
              >
                <ListItemIcon>{icon(item)}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          pb: { xs: 12, md: 3 },
          minWidth: 0,
          maxWidth: { md: 1000 },
        }}
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
              zIndex: (t) => t.zIndex.appBar,
            }}
          >
            <BottomNavigation
              showLabels
              value={current}
              onChange={(_, path: string) => navigate(path)}
            >
              {items.map((item) => (
                <BottomNavigationAction
                  key={item.path}
                  label={item.label}
                  value={item.path}
                  icon={icon(item)}
                />
              ))}
            </BottomNavigation>
          </Paper>
        </>
      )}
    </Box>
  )
}

function UserMenu() {
  const me = useMe()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton
        color="inherit"
        aria-label="Mon compte"
        onClick={(e) => setAnchor(e.currentTarget)}
        edge="end"
      >
        <AccountCircleIcon />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem disabled sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <Typography sx={{ fontWeight: 600 }}>{me.displayName}</Typography>
          <Typography variant="body2">{me.email}</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            void signOut()
          }}
        >
          Se déconnecter
        </MenuItem>
      </Menu>
    </>
  )
}
