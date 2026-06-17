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
  const [confirmationSent, setConfirmationSent] = useState(false)

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

  // Après confirmation d'email, Supabase crée une session temporaire :
  // on récupère l'email pour pré-remplir le champ, puis on déconnecte
  // pour forcer la saisie du mot de passe.
  useEffect(() => {
    async function checkConfirmedEmail() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user?.email) {
        setEmail(data.session.user.email)
        setMode('login')
        await supabase.auth.signOut()
      }
    }
    checkConfirmedEmail()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message || 'Erreur lors de l\'inscription'); setLoading(false); return }
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
      setLoading(false)
      // Si session active = confirmation désactivée, on connecte directement
      // Sinon on affiche l'écran "vérifiez votre email"
      if (data.session) {
        onLogin()
      } else {
        setConfirmationSent(true)
      }
      return
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message || 'Erreur lors de la connexion'); setLoading(false); return }
    }

    setLoading(false)
    onLogin()
  }

  if (confirmationSent) {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto', padding: 24, background: '#fff', borderRadius: 8, border: '1px solid #DADDE1', fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1877F2', margin: '0 0 20px', letterSpacing: -0.5 }}>RateMe</h1>

        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: '#1877F218',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28, color: '#1877F2', fontWeight: 800
        }}>
          ✓
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1E21', marginBottom: 8 }}>
          Vérifiez votre boîte mail
        </div>
        <div style={{ fontSize: 13, color: '#65676B', lineHeight: 1.6, marginBottom: 20 }}>
          Un e-mail de confirmation a été envoyé à <strong style={{ color: '#1C1E21' }}>{email}</strong>.
          Cliquez sur le lien qu'il contient pour valider votre compte et accéder à RateMe.
        </div>
        <div style={{ fontSize: 11, color: '#8A8D91', marginBottom: 20 }}>
          Pensez à vérifier vos courriers indésirables si vous ne le trouvez pas.
        </div>

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
        {error && typeof error === 'string' && <div style={{ color: '#E41E1E', fontSize: 13, marginBottom: 10 }}>{error}</div>}
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
