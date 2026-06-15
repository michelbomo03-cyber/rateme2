# RateMe — Guide de mise en route

## 1. Créer le projet Supabase

1. Va sur https://supabase.com → "New project"
2. Nom : `rateme`, région : Europe (Paris/Frankfurt), choisis un mot de passe DB
3. Une fois le projet créé, va dans **SQL Editor** → colle tout le contenu de `supabase/schema.sql` → Run
4. Va dans **Storage** → "New bucket" → nom : `photos` → coche **Public bucket**
5. Va dans **Project Settings > API** → note :
   - `Project URL`
   - `anon public key`

## 2. Configurer le projet en local

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.local.example .env.local
```

Édite `.env.local` et remplace par tes vraies valeurs Supabase :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx...
```

## 3. Lancer en local

```bash
npm run dev
```

Ouvre http://localhost:3000 → crée un compte → teste le vote.

⚠️ Pour tester complètement (recevoir des votes sur ta propre photo), il te faut au moins 2 comptes différents qui votent l'un sur l'autre. Crée un 2e compte avec un autre email.

## 4. Déployer sur Vercel (gratuit)

1. Crée un repo GitHub avec ce projet (`git init`, `git add .`, `git commit`, push sur un nouveau repo GitHub)
2. Va sur https://vercel.com → "Add New Project" → importe ton repo GitHub
3. Dans les paramètres du projet Vercel, ajoute les variables d'environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → tu obtiens une URL publique type `rateme.vercel.app`

## 5. Ce qui fonctionne dans cette v1

- Inscription / connexion par email
- Évaluation de photos d'autres utilisateurs (4 niveaux)
- Compteur de votes (10 minimum pour débloquer la soumission)
- Upload de sa propre photo une fois débloqué
- Calcul automatique du score (% par niveau + score global pondéré)

## 6. Ce qui n'est PAS encore dans cette v1 (à ajouter plus tard)

- Mode Direct 18+
- Micro-rémunération / portefeuille
- Abonnement Stripe
- Classements géolocalisés
- Analyse IA
- Modération automatique des photos (important avant ouverture au public !)
- Filtre géographique des photos à juger

## 7. Points d'attention avant ouverture publique

- **Modération** : sans contrôle, n'importe qui peut uploader n'importe quelle image. Ajoute une modération automatique (Google Vision, AWS Rekognition) avant tout lancement réel.
- **CGU + âge minimum** : à rédiger et faire accepter à l'inscription.
- **RGPD** : informer les utilisateurs sur l'usage de leurs photos et données.
