-- 18_restore_slot_rules.sql
-- FIX: December (and any month using the Scheduling-sheet rules) showed NO times for ANY service,
-- because the sheet's service/tier/removal/time rules were missing from the database.
-- This puts them back. It does NOT touch bookings, days, times or settings.
-- Safe to run more than once. Run in the Supabase SQL Editor.

-- Scheduling doc checkbox matrix
-- ALL = 9:00, 11:00, 12:00, 2:30, 5:00     S = 9:00, 11:00, 5:00     L = 5:00 only
insert into public.slot_rules (service, tier, removal, slot_time)
select s, t, r, ti::time
from (values
  (array['biab','hardgel','softgel','hardgele'], array[1,2,3,4], array['f_hard'],        array['17:00']),
  (array['biab','hardgel','softgel'],            array[1,2,3,4], array['none'],          array['09:00','11:00','12:00','14:30','17:00']),
  (array['hardgele'],                            array[1,2],     array['none'],          array['09:00','11:00','12:00','14:30','17:00']),
  (array['hardgele'],                            array[3],       array['none'],          array['09:00','11:00','17:00']),
  (array['hardgele'],                            array[4],       array['none'],          array['17:00']),
  (array['biab','hardgel','softgel'],            array[1,2],     array['soft','f_soft'], array['09:00','11:00','12:00','14:30','17:00']),
  (array['biab','hardgel','softgel'],            array[3,4],     array['soft','f_soft'], array['09:00','11:00','17:00']),
  (array['hardgele'],                            array[1],       array['soft','f_soft'], array['09:00','11:00','12:00','14:30','17:00']),
  (array['hardgele'],                            array[2],       array['soft','f_soft'], array['09:00','11:00','17:00']),
  (array['hardgele'],                            array[3,4],     array['soft','f_soft'], array['17:00']),
  (array['biab','hardgel'],                      array[1,2],     array['fill'],          array['09:00','11:00','12:00','14:30','17:00']),
  (array['biab','hardgel'],                      array[3,4],     array['fill'],          array['09:00','11:00','17:00'])
) as d(services, tiers, removals, times),
  unnest(d.services) s, unnest(d.tiers) t, unnest(d.removals) r, unnest(d.times) ti
on conflict do nothing;

-- Extensions only: Hard Gel full removal = Foreign Hard Gel times, BIAB full removal = Soft Gel removal times
insert into public.slot_rules (service, tier, removal, slot_time)
select r.service, r.tier, case r.removal when 'f_hard' then 'hard_full' else 'biab_full' end, r.slot_time
from public.slot_rules r
where r.service in ('softgel','hardgele') and r.removal in ('f_hard','soft')
on conflict do nothing;

-- Check: should say 272
select count(*) as total_rules from public.slot_rules;
