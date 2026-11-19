import { Typography, type TypographyProps } from '@mui/material'
import type { Cents } from '../domain/models'
import { formatCents } from '../domain/money'

/** Signed balance: green when positive (to receive), orange when negative (to pay). */
export function BalanceText({
  cents,
  sx,
  ...props
}: { cents: Cents } & Omit<TypographyProps, 'children' | 'color'>) {
  const color = cents > 0 ? 'success.main' : cents < 0 ? 'warning.dark' : 'text.secondary'
  const sign = cents > 0 ? '+' : ''
  return (
    <Typography
      component="span"
      {...props}
      sx={[{ color, fontWeight: 600 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {sign}
      {formatCents(cents)}
    </Typography>
  )
}
