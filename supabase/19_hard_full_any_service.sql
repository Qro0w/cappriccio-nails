-- 19_hard_full_any_service.sql
-- Hard Gel full removal (+200) is now available for EVERY service (was extensions only).
-- Same times as Foreign Hard Gel removal (5 PM in sheet months; last slot of the day in November).
-- BIAB full removal stays extensions only. Run ONCE in the Supabase SQL Editor (safe to re-run).

create or replace function public.removal_ok(p_service text, p_removal text) returns boolean
language sql immutable as $$
  select case p_removal
    when 'none' then true when 'soft' then true when 'f_soft' then true when 'f_hard' then true
    when 'hard_full' then true
    when 'fill'      then p_service in ('biab','hardgel')
    when 'biab_full' then p_service in ('softgel','hardgele')
    else false end
$$;

-- sheet months: Hard Gel full removal gets the Foreign Hard Gel times for every service and tier
insert into public.slot_rules (service, tier, removal, slot_time)
select r.service, r.tier, 'hard_full', r.slot_time
from public.slot_rules r
where r.removal = 'f_hard'
on conflict do nothing;

select count(*) filter (where removal = 'hard_full') as hard_full_rules from public.slot_rules;  -- should say 16
