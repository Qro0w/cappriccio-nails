-- =====================================================================
--  v5: the nailtech's own slot presets (e.g. "Dec 4 slots" = 9, 12, 2:30, 5)
--  Run AFTER 06_upgrade_v4.sql. Safe to run more than once.
-- =====================================================================
create table if not exists public.slot_presets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 40),
  times      text[] not null default '{}',   -- 'HH:MM', 24-hour
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
alter table public.slot_presets enable row level security;
drop policy if exists admin_all on public.slot_presets;
create policy admin_all on public.slot_presets for all to authenticated using (true) with check (true);

-- starter presets from the sheets (only added the first time)
insert into public.slot_presets (name, times, position)
select * from (values
  ('December · 4 slots', array['09:00','12:00','14:30','17:00'], 1),
  ('December · 3 slots', array['11:00','14:30','17:00'], 2),
  ('November · 3 slots', array['09:00','13:00','16:00'], 3),
  ('November · 2 slots', array['12:00','16:00'], 4)
) v(name, times, position)
where not exists (select 1 from public.slot_presets);
