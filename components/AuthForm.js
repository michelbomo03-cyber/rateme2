'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // login | signup
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // créer le profil associé
      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id })
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    }

    setLoading(false)
    onLogin()
  }

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 20 }}>
      <div style={{ fontSize: 11, color: '#FF3B5C', letterSpacing: 2, fontWeight: 700 }}>MIROIR NUMERIQUE</div>
      <h1 style={{ fontSize: 24, margin: '4px 0 20px' }}>RateMe</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} required
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 12, border: '1px solid #E5E5EA', boxSizing: 'border-box' }}
        />
        <input
          type="password" placeholder="Mot de passe" value={password}
          onChange={e => setPassword(e.target.value)} required minLength={6}
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 12, border: '1px solid #E5E5EA', boxSizing: 'border-box' }}
        />
        {error && <div style={{ color: '#FF3B5C', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 13, borderRadius: 14, border: 'none', background: '#FF3B5C', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#8E8E93', cursor: 'pointer' }}
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
      </div>
    </div>
  )
}
