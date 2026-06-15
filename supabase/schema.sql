-- ============================================
-- RATEME - Schéma de base de données Supabase
-- ============================================

-- Table des profils utilisateurs (liée à auth.users de Supabase)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  pseudo text,
  age int,
  city text,
  country text default 'France',
  votes_count int default 0,        -- nombre de votes effectués
  can_submit boolean default false, -- débloqué après 10 votes
  created_at timestamp with time zone default now()
);

-- Table des photos soumises pour évaluation
create table photos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  image_url text not null,
  status text default 'active', -- active, hidden, removed
  created_at timestamp with time zone default now()
);

-- Table des votes
create table votes (
  id uuid default gen_random_uuid() primary key,
  photo_id uuid references photos(id) on delete cascade,
  voter_id uuid references profiles(id) on delete cascade,
  level text check (level in ('hot','charm','ordinary','nope')) not null,
  created_at timestamp with time zone default now(),
  unique(photo_id, voter_id) -- empêche de voter 2x la même photo
);

-- ============================================
-- VUE : calcul automatique du score d'une photo
-- ============================================
create view photo_scores as
select
  photo_id,
  count(*) as total_votes,
  round(100.0 * sum(case when level='hot' then 1 else 0 end) / count(*), 1) as pct_hot,
  round(100.0 * sum(case when level='charm' then 1 else 0 end) / count(*), 1) as pct_charm,
  round(100.0 * sum(case when level='ordinary' then 1 else 0 end) / count(*), 1) as pct_ordinary,
  round(100.0 * sum(case when level='nope' then 1 else 0 end) / count(*), 1) as pct_nope,
  -- score global pondéré : hot=100, charm=75, ordinary=50, nope=25
  round(
    (sum(case when level='hot' then 100
              when level='charm' then 75
              when level='ordinary' then 50
              else 25 end)::numeric) / count(*)
  , 1) as global_score
from votes
group by photo_id;

-- ============================================
-- FONCTION : incrémenter le compteur de votes + débloquer soumission
-- ============================================
create or replace function increment_vote_count()
returns trigger as $$
begin
  update profiles
  set votes_count = votes_count + 1,
      can_submit = case when votes_count + 1 >= 10 then true else can_submit end
  where id = new.voter_id;
  return new;
end;
$$ language plpgsql;

create trigger on_vote_inserted
after insert on votes
for each row execute function increment_vote_count();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table profiles enable row level security;
alter table photos enable row level security;
alter table votes enable row level security;

-- Profiles : chacun voit/édite le sien, tout le monde peut lire les pseudos
create policy "Profiles visibles par tous" on profiles for select using (true);
create policy "Profil modifiable par son propriétaire" on profiles for update using (auth.uid() = id);
create policy "Création de son propre profil" on profiles for insert with check (auth.uid() = id);

-- Photos : tout le monde peut voir les photos actives, seul le propriétaire peut insérer/modifier les siennes
create policy "Photos actives visibles par tous" on photos for select using (status = 'active');
create policy "Insertion de sa propre photo" on photos for insert with check (auth.uid() = user_id);
create policy "Modification de sa propre photo" on photos for update using (auth.uid() = user_id);

-- Votes : un utilisateur peut voter (insert) et voir ses propres votes
create policy "Lecture de ses propres votes" on votes for select using (auth.uid() = voter_id);
create policy "Création d'un vote" on votes for insert with check (auth.uid() = voter_id);

-- ============================================
-- BUCKET STORAGE pour les photos (à créer aussi via l'interface Supabase)
-- Nom du bucket : "photos", public read
-- ============================================
