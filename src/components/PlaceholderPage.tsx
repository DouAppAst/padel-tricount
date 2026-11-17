import { Card, CardContent, Stack, Typography } from '@mui/material'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      <Card>
        <CardContent>
          <Typography color="text.secondary">{description}</Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}
