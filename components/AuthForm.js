'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    }

    setLoading(false)
    onLogin()
  }

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 8, border: '1px solid #DADDE1', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1877F2', margin: '0 0 20px', letterSpacing: -0.5 }}>RateMe</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="email" placeholder="Adresse e-mail" value={email}
          onChange={e => setEmail(e.target.value)} required
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }}
        />
        <input
          type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)} required minLength={6}
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }}
        />
        {error && <div style={{ color: '#E41E1E', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#1877F2', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
          {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#1877F2', fontWeight: 600, cursor: 'pointer' }}
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? "Créer un nouveau compte" : 'Vous avez déjà un compte ?'}
      </div>
    </div>
  )
}