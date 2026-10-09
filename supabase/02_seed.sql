-- =====================================================================
-- Cappriccio Nails - 02_seed.sql   (run SECOND)
-- =====================================================================
insert into public.settings (key, value) values
  ('gcash_number',  '09XX XXX XXXX'),
  ('gcash_name',    'Cappriccio Nails'),
  ('min_dp',        '400'),
  ('hold_hours',    '12'),
  ('window_days',   '14'),
  ('location_text', 'Main landmark: McDonald''s, Fuente Osmeña. Exact address: (edit this in Admin > Settings)')
on conflict (key) do nothing;

-- ---------- Checkbox matrix (Scheduling doc) ----------
-- ALL = 9:00, 11:00, 12:00, 2:30, 5:00     S = 9:00, 11:00, 5:00     L = 5:00 only
-- removal codes: none | soft (soft gel removal, my work) | fill | f_soft | f_hard (foreign)
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

-- ---------- Schedule (Booking doc calendars) ----------
-- Numbers below = the slot count for each day (0 = off / TBA). Day 1 first.
-- NOVEMBER (simple rules): 3 = 9:00, 1:00, 4:00   2 = 12:00, 4:00
-- DECEMBER (matrix rules): 4 = 9:00, 12:00, 2:30, 5:00   3 = 11:00, 2:30, 5:00
--                          2 = 2:30, 5:00  (the doc doesn't say - edit in the app if wrong)
insert into public.schedule_slots (slot_date, slot_time, rules_mode)
select p.d, t::time, p.mode
from (
  select date '2026-11-01' + (o - 1)::int as d, n, 'simple'::text as mode
  from unnest(array[3,2,0,2,3,2,0, 3,2,3,0,2,3,2, 0,3,2,3,0,2,3, 2,0,3,2,3,0,3, 0,3]) with ordinality as x(n, o)
  union all
  select date '2026-12-01' + (o - 1)::int, n, 'matrix'::text
  from unnest(array[3,0,4,3,4, 3,0,4,3,4,3,0, 4,3,4,0,4,3,4, 2,4,0,3,0,0,0, 0,0,0,0,0]) with ordinality as x(n, o)
) p
cross join lateral unnest(
  case
    when p.mode = 'simple' and p.n = 3 then array['09:00','13:00','16:00']
    when p.mode = 'simple' and p.n = 2 then array['12:00','16:00']
    when p.mode = 'matrix' and p.n = 4 then array['09:00','12:00','14:30','17:00']
    when p.mode = 'matrix' and p.n = 3 then array['11:00','14:30','17:00']
    when p.mode = 'matrix' and p.n = 2 then array['14:30','17:00']
    else array[]::text[]
  end) as t
on conflict do nothing;
