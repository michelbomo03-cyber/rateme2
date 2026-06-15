alter table votes add column if not exists score numeric(3,1);

drop view if exists photo_scores cascade;
create view photo_scores as
select
  photo_id,
  count(*) as total_votes,
  round(100.0 * sum(case when level='hot' then 1 else 0 end) / count(*), 1) as pct_hot,
  round(100.0 * sum(case when level='charm' then 1 else 0 end) / count(*), 1) as pct_charm,
  round(100.0 * sum(case when level='ordinary' then 1 else 0 end) / count(*), 1) as pct_ordinary,
  round(100.0 * sum(case when level='nope' then 1 else 0 end) / count(*), 1) as pct_nope,
  round(avg(coalesce(score, case level
    when 'hot' then 9
    when 'charm' then 6.5
    when 'ordinary' then 3.5
    else 1 end)), 1) as avg_score,
  round(
    (sum(case when level='hot' then 100
              when level='charm' then 75
              when level='ordinary' then 50
              else 25 end)::numeric) / count(*)
  , 1) as global_score
from votes
group by photo_id;

create or replace view photo_rankings as
select
  ps.photo_id,
  ps.global_score,
  ps.avg_score,
  ps.total_votes,
  p.user_id,
  pr.city,
  pr.country,
  p.category,
  rank() over (partition by p.category order by ps.avg_score desc) as global_rank,
  rank() over (partition by p.category, pr.country order by ps.avg_score desc) as country_rank,
  rank() over (partition by p.category, pr.country, pr.city order by ps.avg_score desc) as city_rank,
  count(*) over (partition by p.category) as total_global,
  count(*) over (partition by p.category, pr.country) as total_country,
  count(*) over (partition by p.category, pr.country, pr.city) as total_city
from photo_scores ps
join photos p on p.id = ps.photo_id
join profiles pr on pr.id = p.user_id;