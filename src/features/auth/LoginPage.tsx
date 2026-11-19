import { Alert, Button, Tab, Tabs, TextField } from '@mui/material'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../components/errorMessage'
import { signIn, signUp } from '../../data/repositories/account'
import { AuthLayout } from './AuthLayout'

const MIN_PASSWORD_LENGTH = 8

export function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const passwordTooShort = mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (passwordTooShort) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signIn') await signIn(email, password)
      else await signUp(email, password)
    } catch (e) {
      setError(
        mode === 'signUp' && e instanceof Error && /registered|already/i.test(e.message)
          ? 'Un compte existe déjà avec cet email : connecte-toi.'
          : errorMessage(e),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={mode === 'signIn' ? 'Connexion' : 'Créer un compte'}>
      <Tabs value={mode} onChange={(_, value) => setMode(value)} variant="fullWidth">
        <Tab value="signIn" label="Se connecter" />
        <Tab value="signUp" label="Créer un compte" />
      </Tabs>
      <form onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          margin="normal"
          required
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          margin="normal"
          required
          error={passwordTooShort && password.length > 0}
          helperText={mode === 'signUp' ? `${MIN_PASSWORD_LENGTH} caractères minimum` : undefined}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          disabled={busy || !email || !password || passwordTooShort}
        >
          {mode === 'signIn' ? 'Se connecter' : 'Créer mon compte'}
        </Button>
      </form>
      {mode === 'signIn' ? (
        <Alert severity="info" variant="outlined">
          Mot de passe oublié ? Demande à un admin de supprimer ton compte, puis recrée-le : ton
          historique est conservé.
        </Alert>
      ) : (
        <Alert severity="info" variant="outlined">
          Utilise ton email perso. Aucun email ne te sera envoyé. Un admin validera ensuite ton
          accès.
        </Alert>
      )}
    </AuthLayout>
  )
}
