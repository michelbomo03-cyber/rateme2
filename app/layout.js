export const metadata = {
  title: 'RateMe — Miroir Numérique',
  description: 'Évaluation physique communautaire et anonyme',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: '#F2F2F7', fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
