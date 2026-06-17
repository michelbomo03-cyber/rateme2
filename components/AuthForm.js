'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [city, setCity] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [pseudoStatus, setPseudoStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const ref = params.get('ref')
      if (ref) setMode('signup')
    }
  }, [])

  // Vérification du pseudo avec délai (debounce)
  useEffect(() => {
    if (mode !== 'signup' || pseudo.length < 3) {
      setPseudoStatus(null)
      return
    }
    setPseudoStatus('checking')
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('pseudo', pseudo.trim())
        .single()
      setPseudoStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [pseudo, mode])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      if (pseudo.length < 3) { setError('Le pseudo doit faire au moins 3 caractères.'); return }
      if (pseudoStatus === 'taken') { setError('Ce pseudo est déjà pris.'); return }
      if (pseudoStatus === 'checking') { setError('Vérification du pseudo en cours...'); return }
    }

    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message || 'Erreur lors de l\'inscription')
        setLoading(false)
        return
      }
      if (data.user) {
        const updates = { pseudo: pseudo.trim() }
        if (city) updates.city = city
        await supabase.from('profiles').update(updates).eq('id', data.user.id)
      }
      setLoading(false)
      if (data.session) {
        onLogin()
      } else {
        setConfirmationSent(true)
      }
      return
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message || 'Email ou mot de passe incorrect')
        setLoading(false)
        return
      }
    }

    setLoading(false)
    onLogin()
  }

  if (confirmationSent) {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 8, border: '1px solid #DADDE1', fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1877F2', margin: '0 0 20px', letterSpacing: -0.5 }}>RateMe</h1>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1877F218', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28, color: '#1877F2', fontWeight: 800 }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1E21', marginBottom: 8 }}>Vérifiez votre boîte mail</div>
        <div style={{ fontSize: 13, color: '#65676B', lineHeight: 1.6, marginBottom: 20 }}>
          Un e-mail de confirmation a été envoyé à <strong style={{ color: '#1C1E21' }}>{email}</strong>.
          Cliquez sur le lien pour valider votre compte.
        </div>
        <div style={{ fontSize: 11, color: '#8A8D91', marginBottom: 20 }}>Vérifiez vos courriers indésirables si vous ne le trouvez pas.</div>
        <button onClick={() => { setConfirmationSent(false); setMode('login') }}
          style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#1877F2', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
          Retour à la connexion
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 8, border: '1px solid #DADDE1', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1877F2', margin: '0 0 20px', letterSpacing: -0.5 }}>RateMe</h1>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Adresse e-mail" value={email}
          onChange={e => setEmail(e.target.value)} required
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }} />
        <input type="password" placeholder="Mot de passe (6 caractères min.)" value={password}
          onChange={e => setPassword(e.target.value)} required minLength={6}
          style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }} />
        {mode === 'signup' && (
          <>
            <div style={{ position: 'relative', marginBottom: 4 }}>
              <input type="text" placeholder="Choisissez un pseudo" value={pseudo}
                onChange={e => setPseudo(e.target.value)} required
                style={{
                  width: '100%', padding: 12, paddingRight: 36, borderRadius: 6, boxSizing: 'border-box', fontSize: 14,
                  border: `1px solid ${pseudoStatus === 'available' ? '#42B72A' : pseudoStatus === 'taken' ? '#E41E1E' : '#DADDE1'}`
                }} />
              {pseudoStatus === 'checking' && (
                <span style={{ position: 'absolute', right: 12, top: 14, fontSize: 12, color: '#8A8D91' }}>...</span>
              )}
              {pseudoStatus === 'available' && (
                <span style={{ position: 'absolute', right: 12, top: 12, fontSize: 16, color: '#42B72A' }}>✓</span>
              )}
              {pseudoStatus === 'taken' && (
                <span style={{ position: 'absolute', right: 12, top: 12, fontSize: 16, color: '#E41E1E' }}>✗</span>
              )}
            </div>
            {pseudoStatus === 'available' && <div style={{ fontSize: 11, color: '#42B72A', marginBottom: 8 }}>Pseudo disponible !</div>}
            {pseudoStatus === 'taken' && <div style={{ fontSize: 11, color: '#E41E1E', marginBottom: 8 }}>Ce pseudo est déjà pris.</div>}
            {!pseudoStatus && pseudo.length > 0 && pseudo.length < 3 && <div style={{ fontSize: 11, color: '#8A8D91', marginBottom: 8 }}>3 caractères minimum.</div>}
            <input type="text" placeholder="Votre ville" value={city}
              onChange={e => setCity(e.target.value)}
              style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }} />
          </>
        )}
        {error && <div style={{ color: '#E41E1E', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={loading || (mode === 'signup' && pseudoStatus === 'taken')}
          style={{
            width: '100%', padding: 12, borderRadius: 6, border: 'none',
            background: (mode === 'signup' && pseudoStatus === 'taken') ? '#DADDE1' : '#1877F2',
            color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer'
          }}>
          {loading ? '...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#1877F2', fontWeight: 600, cursor: 'pointer' }}
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
        {mode === 'login' ? "Créer un nouveau compte" : 'Vous avez déjà un compte ?'}
      </div>
    </div>
  )
}
