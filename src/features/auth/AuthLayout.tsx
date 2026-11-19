import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

/** Centered card used by the screens shown before the user becomes a member. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" component="h1" color="primary">
              Padel Tricount
            </Typography>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            {children}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
