jsx'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AuthForm from '../components/AuthForm'

const LEVELS = [
  { id: 'hot', emoji: '🔥', label: 'Très beau', color: '#FF3B5C' },
  { id: 'charm', emoji: '✨', label: 'Charmant(e)', color: '#FF9500' },
  { id: 'ordinary', emoji: '😌', label: 'Ordinaire', color: '#34C759' },
  { id: 'nope', emoji: '👻', label: 'Pas beau', color: '#8E8E93' },
]

export default function Home() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('vote')
  const [myScore, setMyScore] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      loadProfile()
      loadNextPhoto()
    }
  }, [session])

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setProfile(data)
  }

  async function loadNextPhoto() {
    const { data: votedIds } = await supabase
      .from('votes')
      .select('photo_id')
      .eq('voter_id', session.user.id)

    const excluded = (votedIds || []).map(v => v.photo_id)

    let query = supabase
      .from('photos')
      .select('id, image_url, user_id')
      .eq('status', 'active')
      .neq('user_id', session.user.id)
      .limit(1)

    if (excluded.length > 0) {
      query = query.not('id', 'in', `(${excluded.join(',')})`)
    }

    const { data } = await query
    setPhoto(data && data.length > 0 ? data[0] : null)
  }

  async function castVote(level) {
    if (!photo) return
    const { error } = await supabase.from('votes').insert({
      photo_id: photo.id,
      voter_id: session.user.id,
      level,
    })
    if (!error) {
      await loadProfile()
      await loadNextPhoto()
    }
  }

  async function loadMyScore() {
    const { data: myPhotos } = await supabase
      .from('photos')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)

    if (!myPhotos || myPhotos.length === 0) {
      setMyScore('no_photo')
      return
    }

    const { data: score } = await supabase
      .from('photo_scores')
      .select('*')
      .eq('photo_id', myPhotos[0].id)
      .single()

    setMyScore(score || 'no_votes')
  }

  async function submitPhoto(e) {
    const file = e.target.files[0]
    if (!file) return

    const fileName = `${session.user.id}_${Date.now()}.${file.name.split('.').pop()}`
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file)

    if (uploadError) {
      alert("Erreur lors de l'upload : " + uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)

    await supabase.from('photos').insert({
      user_id: session.user.id,
      image_url: urlData.publicUrl,
    })

    alert('Photo soumise avec succès !')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!session) return <AuthForm onLogin={() => {}} />

  const votesCount = profile?.votes_count || 0

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F2F2F7' }}>

      <div style={{ background: '#fff', padding: '16px 20px', borderBottom: '0.5px solid #E5E5EA' }}>
        <div style={{ fontSize: 10, color: '#FF3B5C', letterSpacing: 2, fontWeight: 700 }}>MIROIR NUMERIQUE</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>RateMe</div>
      </div>

      <div style={{ background: '#fff', display: 'flex', borderBottom: '0.5px solid #E5E5EA' }}>
        {['vote', 'submit', 'results'].map(t => (
          <div key={t} onClick={() => { setTab(t); if (t === 'results') loadMyScore() }}
            style={{
              flex: 1, textAlign: 'center', padding: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: tab === t ? '#FF3B5C' : '#8E8E93',
              borderBottom: tab === t ? '2px solid #FF3B5C' : '2px solid transparent',
            }}>
            {t === 'vote' ? 'Évaluer' : t === 'submit' ? 'Soumettre' : 'Résultats'}
          </div>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {tab === 'vote' && (
          <div>
            <div style={{ background: '#fff', borderRadius: 14, padding: 12, marginBottom: 14, textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: '#8E8E93' }}>Votes effectués : </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FF3B5C' }}>{votesCount}</span>
            </div>

            {photo ? (
              <>
                <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', marginBottom: 14 }}>
                  <img src={photo.image_url} style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {LEVELS.map(l => (
                    <button key={l.id} onClick={() => castVote(l.id)}
                      style={{
                        background: l.color + '12', border: `1.5px solid ${l.color}40`, borderRadius: 16,
                        padding: '14px 10px', cursor: 'pointer', textAlign: 'center'
                      }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{l.emoji}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: l.color }}>{l.label}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ background: '#fff', borderRadius: 18, padding: 30, textAlign: 'center', color: '#8E8E93' }}>
                Aucune nouvelle photo à évaluer pour le moment. Revenez plus tard !
              </div>
            )}
          </div>
        )}

        {tab === 'submit' && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Soumettez votre photo</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 14 }}>
              Une fois soumise, d'autres utilisateurs pourront l'évaluer. Vous pourrez voir vos résultats dans l'onglet "Résultats".
            </div>
            <input type="file" accept="image/*" onChange={submitPhoto} />
          </div>
        )}

        {tab === 'results' && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 20, textAlign: 'center' }}>
            {myScore === 'no_photo' && <div style={{ color: '#8E8E93' }}>Vous n'avez pas encore soumis de photo.</div>}
            {myScore === 'no_votes' && <div style={{ color: '#8E8E93' }}>Votre photo n'a pas encore reçu de votes.</div>}
            {myScore && typeof myScore === 'object' && (
              <>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#FF3B5C' }}>{myScore.global_score}%</div>
                <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 16 }}>{myScore.total_votes} évaluations</div>
                {LEVELS.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, textAlign: 'left' }}>
                    <span style={{ width: 24 }}>{l.emoji}</span>
                    <div style={{ flex: 1, background: '#F2F2F7', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${myScore['pct_' + l.id]}%`, background: l.color, borderRadius: 6 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: l.color, minWidth: 36, textAlign: 'right' }}>
                      {myScore['pct_' + l.id]}%
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: 16 }}>
        <button onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 13, cursor: 'pointer' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}