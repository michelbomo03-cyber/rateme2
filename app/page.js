'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
  const [wallet, setWallet] = useState(0)
  const [sliderValue, setSliderValue] = useState(5)
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardScope, setLeaderboardScope] = useState('global')
  const [leaderboardCategory, setLeaderboardCategory] = useState('beaute')
  const [referralStats, setReferralStats] = useState(null)
  const [settingsPseudo, setSettingsPseudo] = useState('')
  const [settingsCity, setSettingsCity] = useState('')
  const [settingsCountry, setSettingsCountry] = useState('')
  const [settingsPseudoStatus, setSettingsPseudoStatus] = useState(null)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [walletHistory, setWalletHistory] = useState([])

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
    setSettingsPseudo(data?.pseudo || '')
    setSettingsCity(data?.city || '')
    setSettingsCountry(data?.country || '')

    const { data: balance } = await supabase
      .from('wallet_balance')
      .select('available_balance')
      .eq('user_id', session.user.id)
      .single()
    setWallet(balance ? Number(balance.available_balance) : 0)

    const { data: refStats } = await supabase
      .from('referral_stats')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    setReferralStats(refStats || null)

    // Historique wallet
    const { data: history } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setWalletHistory(history || [])
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
    setSliderValue(5)
  }

  async function castVote() {
    if (!photo) return
    const v = sliderValue
    const level = v < 2.5 ? 'nope' : v < 5 ? 'ordinary' : v < 7.5 ? 'charm' : 'hot'
    const { error } = await supabase.from('votes').insert({
      photo_id: photo.id,
      voter_id: session.user.id,
      level,
      score: v,
      category: voteCategory,
    })
    if (!error) {
      // Créditer 0.005€ par vote dans le wallet
      await supabase.from('wallet_transactions').insert({
        user_id: session.user.id,
        amount: 0.005,
        type: 'vote_reward',
        description: 'Récompense pour évaluation',
      })
      await loadProfile()
      await loadNextPhoto()
    }
  }

  function switchVoteCategory(cat) {
    setVoteCategory(cat)
    loadNextPhoto(cat)
  }

  async function checkSettingsPseudo(value) {
    if (value.length < 3) { setSettingsPseudoStatus(null); return }
    if (value === profile?.pseudo) { setSettingsPseudoStatus('available'); return }
    setSettingsPseudoStatus('checking')
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('pseudo', value.trim())
      .single()
    setSettingsPseudoStatus(data ? 'taken' : 'available')
  }

  async function saveSettings() {
    if (settingsPseudoStatus === 'taken') return
    if (settingsPseudo.length < 3) return
    const updates = {
      pseudo: settingsPseudo.trim(),
      city: settingsCity.trim(),
      country: settingsCountry.trim(),
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id)
    if (!error) {
      await loadProfile()
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    }
  }

  async function deletePhoto(photoId, imageUrl) {
    if (!confirm('Supprimer cette photo définitivement ?')) return
    const fileName = imageUrl.split('/').pop()
    await supabase.storage.from('photos').remove([fileName])
    await supabase.from('votes').delete().eq('photo_id', photoId)
    await supabase.from('photos').delete().eq('id', photoId)
    await loadMyPhotos()
  }

  async function loadLeaderboard(category, scope) {
    const cat = category || leaderboardCategory
    const sc = scope || leaderboardScope

    let query = supabase
      .from('leaderboard')
      .select('*')
      .eq('category', cat)

    if (sc === 'country' && profile?.country) {
      query = query.eq('country', profile.country).order('country_rank', { ascending: true })
    } else if (sc === 'city' && profile?.city) {
      query = query.eq('city', profile.city).order('city_rank', { ascending: true })
    } else {
      query = query.order('global_rank', { ascending: true })
    }

    const { data } = await query.limit(10)
    setLeaderboard(data || [])
  }

  function switchLeaderboard(category, scope) {
    const cat = category !== undefined ? category : leaderboardCategory
    const sc = scope !== undefined ? scope : leaderboardScope
    setLeaderboardCategory(cat)
    setLeaderboardScope(sc)
    loadLeaderboard(cat, sc)
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

    const { data: rankings } = await supabase
      .from('photo_rankings')
      .select('*')
      .in('photo_id', photoIds)

    const scoresMap = {}
    ;(scores || []).forEach(s => { scoresMap[s.photo_id] = s })

    const rankingsMap = {}
    ;(rankings || []).forEach(r => { rankingsMap[r.photo_id] = r })

    const merged = myPhotos.map(p => ({
      ...p,
      score: scoresMap[p.id] || null,
      ranking: rankingsMap[p.id] || null,
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
  if (!session) return <AuthForm onLogin={() => { window.location.reload() }} />

  const votesCount = profile?.votes_count || 0

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F0F2F5', fontFamily: 'Helvetica, Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 20px', borderBottom: '1px solid #DADDE1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1877F2', letterSpacing: -0.5 }}>RateMe</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => setTab('wallet')}
            style={{ fontSize: 13, fontWeight: 700, color: '#42B72A', background: '#42B72A18', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            {wallet.toFixed(3)} €
          </div>
          <div onClick={() => setTab('settings')}
            style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer', color: tab === 'settings' ? '#1877F2' : '#65676B', padding: '4px 8px', borderRadius: 6, border: '1px solid #DADDE1', background: tab === 'settings' ? '#1877F218' : '#fff' }}>
            Profil
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', display: 'flex', borderBottom: '1px solid #DADDE1' }}>
        {['vote', 'submit', 'leaderboard', 'invite', 'results'].map(t => (
          <div key={t} onClick={() => { setTab(t); if (t === 'results') loadMyPhotos(); if (t === 'leaderboard') loadLeaderboard() }}
            style={{
              flex: 1, textAlign: 'center', padding: '12px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              color: tab === t ? '#1877F2' : '#65676B',
              borderBottom: tab === t ? '3px solid #1877F2' : '3px solid transparent',
            }}>
            {t === 'vote' ? 'Évaluer' : t === 'submit' ? 'Publier' : t === 'leaderboard' ? 'Classement' : t === 'invite' ? 'Inviter' : 'Mes photos'}
          </div>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* TAB VOTE */}
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
              <span style={{ fontSize: 12, color: '#42B72A', marginLeft: 10 }}>+0,005 € par vote</span>
            </div>

            {photo ? (
              <>
                <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', marginBottom: 14, border: '1px solid #DADDE1' }}>
                  <img src={photo.image_url} style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }} />
                </div>

                {(() => {
                  const levels = CATEGORIES[voteCategory].levels
                  const zoneLevel = sliderValue < 2.5 ? levels[3] : sliderValue < 5 ? levels[2] : sliderValue < 7.5 ? levels[1] : levels[0]
                  const pct = sliderValue / 10
                  const hue = Math.round(pct * 130)
                  const sliderColor = `hsl(${hue}, 80%, 45%)`
                  const glow = `0 0 ${10 + pct * 30}px ${sliderColor}80`

                  return (
                    <div style={{ background: '#fff', borderRadius: 8, padding: 20, marginBottom: 14, border: '1px solid #DADDE1', textAlign: 'center' }}>
                      <div style={{ fontSize: 48, fontWeight: 800, color: sliderColor, lineHeight: 1, transition: 'color 0.15s', marginBottom: 4 }}>
                        {sliderValue.toFixed(1)}<span style={{ fontSize: 20, color: '#8A8D91' }}>/10</span>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1E21', marginBottom: 18, minHeight: 22, transition: 'opacity 0.15s' }}>
                        {zoneLevel.label}
                      </div>

                      <input
                        type="range" min="0" max="10" step="0.1" value={sliderValue}
                        onChange={e => setSliderValue(parseFloat(e.target.value))}
                        style={{
                          width: '100%', height: 10, borderRadius: 6, outline: 'none', cursor: 'pointer',
                          background: 'linear-gradient(to right, hsl(0,80%,45%), hsl(65,80%,45%), hsl(130,80%,45%))',
                          boxShadow: glow, transition: 'box-shadow 0.15s',
                          WebkitAppearance: 'none', appearance: 'none',
                        }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: '#8A8D91', fontWeight: 600 }}>
                        {levels.slice().reverse().map(l => (
                          <span key={l.id} style={{ flex: 1, textAlign: 'center' }}>{l.label}</span>
                        ))}
                      </div>

                      <button onClick={castVote}
                        style={{
                          marginTop: 20, width: '100%', padding: '14px 0', borderRadius: 8, border: 'none',
                          background: '#1877F2', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer'
                        }}>
                        Valider mon évaluation
                      </button>
                    </div>
                  )
                })()}
              </>
            ) : (
              <div style={{ background: '#fff', borderRadius: 8, padding: 30, textAlign: 'center', color: '#65676B', border: '1px solid #DADDE1' }}>
                Aucune nouvelle photo à évaluer pour cette catégorie. Revenez plus tard !
              </div>
            )}
          </div>
        )}

        {/* TAB SUBMIT */}
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
              <input type="file" accept="image/*" onChange={submitPhoto} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* TAB LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {CATEGORY_LIST.map(c => (
                <div key={c.id} onClick={() => switchLeaderboard(c.id, undefined)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: leaderboardCategory === c.id ? '#1877F2' : '#fff',
                    color: leaderboardCategory === c.id ? '#fff' : '#1C1E21',
                    border: '1px solid ' + (leaderboardCategory === c.id ? '#1877F2' : '#DADDE1'),
                  }}>
                  {c.label}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'city', label: profile?.city || 'Ma ville' },
                { id: 'country', label: profile?.country || 'Mon pays' },
                { id: 'global', label: 'Mondial' },
              ].map(s => (
                <div key={s.id} onClick={() => switchLeaderboard(undefined, s.id)}
                  style={{
                    flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: leaderboardScope === s.id ? '#1C1E21' : '#F0F2F5',
                    color: leaderboardScope === s.id ? '#fff' : '#65676B',
                  }}>
                  {s.label}
                </div>
              ))}
            </div>

            {leaderboard.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 8, padding: 30, textAlign: 'center', color: '#65676B', border: '1px solid #DADDE1' }}>
                Pas encore de classement disponible pour cette sélection.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
                  {[1, 0, 2].map(idx => {
                    const entry = leaderboard[idx]
                    if (!entry) return <div key={idx} style={{ flex: 1 }} />
                    const rank = idx === 0 ? 1 : idx === 1 ? 2 : 3
                    const heights = { 1: 130, 2: 105, 3: 85 }
                    const medalColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }
                    return (
                      <div key={entry.photo_id} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{
                          width: rank === 1 ? 64 : 52, height: rank === 1 ? 64 : 52, borderRadius: '50%',
                          overflow: 'hidden', margin: '0 auto 6px', border: `3px solid ${medalColors[rank]}`,
                          boxShadow: `0 0 16px ${medalColors[rank]}80`
                        }}>
                          <img src={entry.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1E21' }}>{entry.avg_score}/10</div>
                        <div style={{
                          background: medalColors[rank], color: '#fff', borderRadius: 6, height: heights[rank],
                          marginTop: 6, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                          paddingTop: 8, fontSize: 20, fontWeight: 800
                        }}>
                          {rank}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #DADDE1', overflow: 'hidden' }}>
                  {leaderboard.slice(3).map((entry, i) => (
                    <div key={entry.photo_id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderBottom: i < leaderboard.slice(3).length - 1 ? '1px solid #F0F2F5' : 'none'
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#8A8D91', width: 24 }}>{i + 4}</div>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={entry.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1, fontSize: 13, color: '#1C1E21' }}>
                        {entry.user_id === session.user.id ? (profile?.pseudo || 'Vous') : (entry.pseudo || 'Membre RateMe')}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1877F2' }}>{entry.avg_score}/10</div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: 16, background: 'linear-gradient(135deg, #1877F2, #42B72A)', borderRadius: 8,
                  padding: 16, textAlign: 'center', color: '#fff'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    Vous avez ce qu'il faut pour atteindre le podium !
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    Publiez une nouvelle photo et grimpez dans le classement {CATEGORIES[leaderboardCategory].label.toLowerCase()}.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB INVITE */}
        {tab === 'invite' && (
          <div>
            {(() => {
              const code = referralStats?.referral_code || '...'
              const link = `https://rateme2.vercel.app/?ref=${code}`
              const message = `Salut ! Je teste RateMe, une appli où tu te fais évaluer anonymement par la communauté et où tu gagnes des récompenses. Rejoins-moi avec mon lien : ${link}`
              const encodedMessage = encodeURIComponent(message)
              const encodedLink = encodeURIComponent(link)
              const premiumDate = referralStats?.premium_until ? new Date(referralStats.premium_until) : null
              const premiumActive = premiumDate && premiumDate > new Date()

              return (
                <>
                  <div style={{
                    background: 'linear-gradient(135deg, #1877F2, #42B72A)', borderRadius: 8,
                    padding: 24, textAlign: 'center', color: '#fff', marginBottom: 16
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Invitez vos amis, gagnez du Premium</div>
                    <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 16 }}>
                      Pour chaque ami qui effectue 10 évaluations, recevez <strong>1 mois d'abonnement Premium offert</strong>, sans limite.
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: '12px 16px',
                      fontSize: 22, fontWeight: 800, letterSpacing: 4, marginBottom: 8
                    }}>
                      {code}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.85 }}>Votre code de parrainage</div>
                  </div>

                  <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #DADDE1', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1E21', marginBottom: 12 }}>Partager mon lien</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <a href={`https://wa.me/?text=${encodedMessage}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#25D366', color: '#fff', borderRadius: 8, padding: '12px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        WhatsApp
                      </a>
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1877F2', color: '#fff', borderRadius: 8, padding: '12px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        Facebook
                      </a>
                      <a href={`sms:?body=${encodedMessage}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#34C759', color: '#fff', borderRadius: 8, padding: '12px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        SMS
                      </a>
                      <a href={`mailto:?subject=${encodeURIComponent('Rejoins-moi sur RateMe')}&body=${encodedMessage}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#65676B', color: '#fff', borderRadius: 8, padding: '12px 0', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                        E-mail
                      </a>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(link); alert('Lien copié !') }}
                      style={{ width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 8, border: '1px solid #DADDE1', background: '#F0F2F5', color: '#1C1E21', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Copier le lien
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: 16, textAlign: 'center', border: '1px solid #DADDE1' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#1877F2' }}>{referralStats?.total_referrals || 0}</div>
                      <div style={{ fontSize: 11, color: '#65676B', marginTop: 4 }}>Amis invités</div>
                    </div>
                    <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: 16, textAlign: 'center', border: '1px solid #DADDE1' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#42B72A' }}>{referralStats?.active_referrals || 0}</div>
                      <div style={{ fontSize: 11, color: '#65676B', marginTop: 4 }}>Mois Premium gagnés</div>
                    </div>
                  </div>

                  <div style={{
                    background: premiumActive ? '#42B72A18' : '#F0F2F5', borderRadius: 8, padding: 14,
                    textAlign: 'center', border: `1px solid ${premiumActive ? '#42B72A' : '#DADDE1'}`
                  }}>
                    {premiumActive ? (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#42B72A' }}>
                        Premium actif jusqu'au {premiumDate.toLocaleDateString('fr-FR')}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#65676B' }}>
                        Pas encore de Premium actif. Invitez des amis pour en débloquer !
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* TAB RESULTS */}
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
                          <span style={{ fontSize: 28, fontWeight: 800, color: '#1C1E21' }}>{p.score.avg_score}<span style={{ fontSize: 16, color: '#8A8D91' }}>/10</span></span>
                          <span style={{ fontSize: 12, color: '#65676B' }}>{p.score.total_votes} évaluations</span>
                        </div>
                        {p.ranking && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            {p.ranking.city && (
                              <div style={{ flex: 1, background: '#F0F2F5', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#65676B', fontWeight: 700, textTransform: 'uppercase' }}>{p.ranking.city}</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#1877F2' }}>#{p.ranking.city_rank}</div>
                                <div style={{ fontSize: 10, color: '#8A8D91' }}>sur {p.ranking.total_city}</div>
                              </div>
                            )}
                            {p.ranking.country && (
                              <div style={{ flex: 1, background: '#F0F2F5', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: '#65676B', fontWeight: 700, textTransform: 'uppercase' }}>{p.ranking.country}</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#1877F2' }}>#{p.ranking.country_rank}</div>
                                <div style={{ fontSize: 10, color: '#8A8D91' }}>sur {p.ranking.total_country}</div>
                              </div>
                            )}
                            <div style={{ flex: 1, background: '#F0F2F5', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: '#65676B', fontWeight: 700, textTransform: 'uppercase' }}>Mondial</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#1877F2' }}>#{p.ranking.global_rank}</div>
                              <div style={{ fontSize: 10, color: '#8A8D91' }}>sur {p.ranking.total_global}</div>
                            </div>
                          </div>
                        )}
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
                    <button onClick={() => deletePhoto(p.id, p.image_url)}
                      style={{
                        marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 6,
                        border: '1px solid #E41E1E', background: '#fff', color: '#E41E1E',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer'
                      }}>
                      Supprimer cette photo
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB WALLET */}
        {tab === 'wallet' && (
          <div>
            <div style={{
              background: 'linear-gradient(135deg, #42B72A, #1877F2)', borderRadius: 8,
              padding: 24, textAlign: 'center', color: '#fff', marginBottom: 16
            }}>
              <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 6 }}>Solde disponible</div>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>{wallet.toFixed(3)} €</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>+0,005 € par évaluation effectuée</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #DADDE1', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F2F5', fontSize: 13, fontWeight: 700, color: '#1C1E21' }}>
                Historique des gains
              </div>
              {walletHistory.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#65676B', fontSize: 13 }}>
                  Aucune transaction pour l'instant. Commencez à évaluer !
                </div>
              ) : (
                walletHistory.map((tx, i) => (
                  <div key={tx.id || i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', borderBottom: i < walletHistory.length - 1 ? '1px solid #F0F2F5' : 'none'
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#1C1E21' }}>{tx.description || 'Transaction'}</div>
                      <div style={{ fontSize: 11, color: '#8A8D91', marginTop: 2 }}>
                        {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#42B72A' }}>
                      +{Number(tx.amount).toFixed(3)} €
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB SETTINGS */}
        {tab === 'settings' && (
          <div style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #DADDE1' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1E21', marginBottom: 20 }}>Mon profil</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#65676B', marginBottom: 6, textTransform: 'uppercase' }}>Adresse e-mail</div>
              <div style={{ padding: 12, borderRadius: 6, border: '1px solid #DADDE1', background: '#F0F2F5', fontSize: 14, color: '#8A8D91' }}>
                {session.user.email}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#65676B', marginBottom: 6, textTransform: 'uppercase' }}>Pseudo</div>
              <div style={{ position: 'relative' }}>
                <input type="text" value={settingsPseudo}
                  onChange={e => { setSettingsPseudo(e.target.value); checkSettingsPseudo(e.target.value) }}
                  placeholder="Choisissez un pseudo"
                  style={{
                    width: '100%', padding: 12, paddingRight: 36, borderRadius: 6, boxSizing: 'border-box', fontSize: 14,
                    border: `1px solid ${settingsPseudoStatus === 'available' ? '#42B72A' : settingsPseudoStatus === 'taken' ? '#E41E1E' : '#DADDE1'}`
                  }} />
                {settingsPseudoStatus === 'available' && <span style={{ position: 'absolute', right: 12, top: 12, color: '#42B72A', fontSize: 16 }}>✓</span>}
                {settingsPseudoStatus === 'taken' && <span style={{ position: 'absolute', right: 12, top: 12, color: '#E41E1E', fontSize: 16 }}>✗</span>}
                {settingsPseudoStatus === 'checking' && <span style={{ position: 'absolute', right: 12, top: 14, color: '#8A8D91', fontSize: 12 }}>...</span>}
              </div>
              {settingsPseudoStatus === 'taken' && <div style={{ fontSize: 11, color: '#E41E1E', marginTop: 4 }}>Ce pseudo est déjà pris.</div>}
              {settingsPseudoStatus === 'available' && <div style={{ fontSize: 11, color: '#42B72A', marginTop: 4 }}>Pseudo disponible !</div>}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#65676B', marginBottom: 6, textTransform: 'uppercase' }}>Ville</div>
              <input type="text" value={settingsCity}
                onChange={e => setSettingsCity(e.target.value)}
                placeholder="Votre ville"
                style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#65676B', marginBottom: 6, textTransform: 'uppercase' }}>Pays</div>
              <input type="text" value={settingsCountry}
                onChange={e => setSettingsCountry(e.target.value)}
                placeholder="Votre pays (ex: France)"
                style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #DADDE1', boxSizing: 'border-box', fontSize: 14 }} />
            </div>

            <button onClick={saveSettings}
              disabled={settingsPseudoStatus === 'taken' || settingsPseudo.length < 3}
              style={{
                width: '100%', padding: 12, borderRadius: 6, border: 'none',
                background: settingsPseudoStatus === 'taken' || settingsPseudo.length < 3 ? '#DADDE1' : '#1877F2',
                color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 16
              }}>
              {settingsSaved ? '✓ Enregistré !' : 'Enregistrer'}
            </button>

            <button onClick={() => supabase.auth.signOut()}
              style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #E41E1E', background: '#fff', color: '#E41E1E', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Se déconnecter
            </button>
          </div>
        )}

      </div>
    </div>
  )
}