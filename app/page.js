'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AuthForm from '../components/AuthForm'

const CATEGORIES = {
  beaute: {
    label: 'Beauté',
    levels: [
      { id: 'hot', label: 'Magnifique', color: '#1877F2' },
      { id: 'charm', label: 'Charmant(e)', color: '#42B72A' },
      { id: 'ordinary', label: 'Ordinaire', color: '#8A8D91' },
      { id: 'nope', label: 'Pas séduisant(e)', color: '#E41E1E' },
    ],
  },
  style: {
    label: 'Style',
    levels: [
      { id: 'hot', label: 'Très stylé', color: '#1877F2' },
      { id: 'charm', label: 'Élégant', color: '#42B72A' },
      { id: 'ordinary', label: 'Basique', color: '#8A8D91' },
      { id: 'nope', label: 'À revoir', color: '#E41E1E' },
    ],
  },
  morphologie: {
    label: 'Morphologie',
    levels: [
      { id: 'hot', label: 'Excellente forme', color: '#1877F2' },
      { id: 'charm', label: 'Bonne forme', color: '#42B72A' },
      { id: 'ordinary', label: 'Moyenne', color: '#8A8D91' },
      { id: 'nope', label: 'À travailler', color: '#E41E1E' },
    ],
  },
}

const CATEGORY_LIST = [
  { id: 'beaute', label: 'Beauté' },
  { id: 'style', label: 'Style' },
  { id: 'morphologie', label: 'Morphologie' },
]

export default function Home() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('vote')
  const [myScore, setMyScore] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [voteCategory, setVoteCategory] = useState('beaute')
  const [submitCategory, setSubmitCategory] = useState('beaute')

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

  async function loadNextPhoto(category) {
    const cat = category || voteCategory
    const { data: votedIds } = await supabase
      .from('votes')
      .select('photo_id')
      .eq('voter_id', session.user.id)
      .eq('category', cat)

    const excluded = (votedIds || []).map(v => v.photo_id)

    let query = supabase
      .from('photos')
      .select('id, image_url, user_id, category')
      .eq('status', 'active')
      .eq('category', cat)
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
      category: voteCategory,
    })
    if (!error) {
      await loadProfile()
      await loadNextPhoto()
    }
  }

  function switchVoteCategory(cat) {
    setVoteCategory(cat)
    loadNextPhoto(cat)
  }

  async function loadMyPhotos() {
    const { data: myPhotos } = await supabase
      .from('photos')
      .select('id, image_url, created_at, category')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!myPhotos || myPhotos.length === 0) {
      setMyScore('no_photo')
      return
    }

    const photoIds = myPhotos.map(p => p.id)
    const { data: scores } = await supabase
      .from('photo_scores')
      .select('*')
      .in('photo_id', photoIds)

    const scoresMap = {}
    ;(scores || []).forEach(s => { scoresMap[s.photo_id] = s })

    const merged = myPhotos.map(p => ({
      ...p,
      score: scoresMap[p.id] || null,
    }))

    setMyScore(merged)
  }

  async function submitPhoto(e) {
    const file = e.target.files[0]
    if (!file) return

    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)

    const fileName = `${session.user.id}_${Date.now()}.${file.name.split('.').pop()}`
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file)

    if (uploadError) {
      alert("Erreur lors de l'upload : " + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)

    const { error: insertError } = await supabase.from('photos').insert({
      user_id: session.user.id,
      image_url: urlData.publicUrl,
      category: submitCategory,
    })

    setUploading(false)

    if (insertError) {
      alert("Erreur lors de l'enregistrement : " + insertError.message)
      return
    }

    alert('Photo soumise avec succès !')
    setPreviewUrl(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!session) return <AuthForm onLogin={() => {}} />

  const votesCount = profile?.votes_count || 0

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F0F2F5', fontFamily: 'Helvetica, Arial, sans-serif' }}>

      <div style={{ background: '#fff', padding: '14px 20px', borderBottom: '1px solid #DADDE1' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1877F2', letterSpacing: -0.5 }}>RateMe</div>
      </div>

      <div style={{ background: '#fff', display: 'flex', borderBottom: '1px solid #DADDE1' }}>
        {['vote', 'submit', 'results'].map(t => (
          <div key={t} onClick={() => { setTab(t); if (t === 'results') loadMyPhotos() }}
            style={{
              flex: 1, textAlign: 'center', padding: '12px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: tab === t ? '#1877F2' : '#65676B',
              borderBottom: tab === t ? '3px solid #1877F2' : '3px solid transparent',
            }}>
            {t === 'vote' ? 'Évaluer' : t === 'submit' ? 'Publier' : 'Mes photos'}
          </div>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {tab === 'vote' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {CATEGORY_LIST.map(c => (
                <div key={c.id} onClick={() => switchVoteCategory(c.id)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: voteCategory === c.id ? '#1877F2' : '#fff',
                    color: voteCategory === c.id ? '#fff' : '#1C1E21',
                    border: '1px solid ' + (voteCategory === c.id ? '#1877F2' : '#DADDE1'),
                  }}>
                  {c.label}
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 8, padding: 12, marginBottom: 14, textAlign: 'center', border: '1px solid #DADDE1' }}>
              <span style={{ fontSize: 13, color: '#65676B' }}>Évaluations effectuées : </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1877F2' }}>{votesCount}</span>
            </div>

            {photo ? (
              <>
                <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', marginBottom: 14, border: '1px solid #DADDE1' }}>
                  <img src={photo.image_url} style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {CATEGORIES[voteCategory].levels.map(l => (
                    <button key={l.id} onClick={() => castVote(l.id)}
                      style={{
                        background: '#fff', border: `1px solid ${l.color}`, borderRadius: 8,
                        padding: '14px 10px', cursor: 'pointer', textAlign: 'center'
                      }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: l.color }}>{l.label}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ background: '#fff', borderRadius: 8, padding: 30, textAlign: 'center', color: '#65676B', border: '1px solid #DADDE1' }}>
                Aucune nouvelle photo à évaluer pour cette catégorie. Revenez plus tard !
              </div>
            )}
          </div>
        )}

        {tab === 'submit' && (
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #DADDE1' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#1C1E21' }}>Publier une photo</div>
            <div style={{ fontSize: 13, color: '#65676B', marginBottom: 18 }}>
              Choisissez la catégorie sur laquelle vous souhaitez être évalué(e).
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {CATEGORY_LIST.map(c => (
                <div key={c.id} onClick={() => setSubmitCategory(c.id)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: submitCategory === c.id ? '#1877F2' : '#F0F2F5',
                    color: submitCategory === c.id ? '#fff' : '#1C1E21',
                    border: '1px solid ' + (submitCategory === c.id ? '#1877F2' : '#DADDE1'),
                  }}>
                  {c.label}
                </div>
              ))}
            </div>

            {previewUrl && (
              <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 16, position: 'relative', border: '1px solid #DADDE1' }}>
                <img src={previewUrl} style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }} />
                {uploading && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 600
                  }}>
                    Envoi en cours...
                  </div>
                )}
              </div>
            )}

            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: uploading ? '#1877F280' : '#1877F2', color: '#fff',
              borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 700,
              cursor: uploading ? 'default' : 'pointer', textAlign: 'center'
            }}>
              {uploading ? 'Envoi en cours...' : (previewUrl ? 'Changer de photo' : 'Choisir une photo')}
              <input type="file" accept="image/*" onChange={submitPhoto} disabled={uploading}
                style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {tab === 'results' && (
          <div>
            {myScore === 'no_photo' && (
              <div style={{ background: '#fff', borderRadius: 8, padding: 20, textAlign: 'center', color: '#65676B', border: '1px solid #DADDE1' }}>
                Vous n'avez pas encore publié de photo.
              </div>
            )}
            {Array.isArray(myScore) && myScore.map(p => {
              const cat = CATEGORIES[p.category] || CATEGORIES.beaute
              return (
                <div key={p.id} style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', marginBottom: 14, border: '1px solid #DADDE1' }}>
                  <img src={p.image_url} style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1877F2', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {cat.label}
                    </div>
                    {p.score ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: '#1C1E21' }}>{p.score.global_score}%</span>
                          <span style={{ fontSize: 12, color: '#65676B' }}>{p.score.total_votes} évaluations</span>
                        </div>
                        {cat.levels.map(l => (
                          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 110, fontSize: 12, color: '#1C1E21' }}>{l.label}</span>
                            <div style={{ flex: 1, background: '#F0F2F5', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${p.score['pct_' + l.id]}%`, background: l.color, borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: l.color, minWidth: 32, textAlign: 'right' }}>
                              {p.score['pct_' + l.id]}%
                            </span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ color: '#65676B', fontSize: 13, textAlign: 'center' }}>Pas encore d'évaluations</div>
                    )}
                    <div style={{ fontSize: 11, color: '#8A8D91', marginTop: 8 }}>
                      Publiée le {new Date(p.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: 16 }}>
        <button onClick={() => supabase.auth.signOut()}
          style={{ background: 'none', border: 'none', color: '#1877F2', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}