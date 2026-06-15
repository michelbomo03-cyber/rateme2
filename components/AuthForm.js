'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [city, setCity] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [mode, setMode] = useState('login') // login | signup
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Pré-remplit le code de parrainage si présent dans l'URL (?ref=CODE)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (ref) {
        setReferralCode(ref.toUpperCase())
        setMode('signup')
      }
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // met à jour la ville et le parrain du profil (créé automatiquement par trigger)
      if (data.user) {
        const updates = {}
        if (city) updates.city = city
        if (referralCode) {
          const { data: referrer } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', referralCode.toUpperCase().trim())
            .single()
          if (referrer) updates.referred_by = referrer.id
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', data.user.id)
        }
      }
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
        {mode === 'signup' && (
          <input
            type="text" placeholder="Votre ville" value={city}
            onChange={e => setCity(e.target.value)}
            style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }}
          />
        )}
        {mode === 'signup' && (
          <input
            type="text" placeholder="Code de parrainage (optionnel)" value={referralCode}
            onChange={e => setReferralCode(e.target.value.toUpperCase())}
            style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14, textTransform: 'uppercase' }}
          />
        )}
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