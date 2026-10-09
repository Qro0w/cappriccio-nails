-- Run this ONCE in the Supabase SQL Editor if you already ran 02_seed.sql earlier.
-- It replaces the placeholder location with the address from the doc (shown to clients only after payment is confirmed).
update public.settings
set value = E'J. Llorente St., Osmeña Blvd, Cebu City\nTall brown wood-like gate\nIn between MedExpress Drugstore and Hi-Precision\n\nLandmarks:\nMedalle Court\nHi-Precision Diagnostics (Cebu Main)\nAnitas, Fuente Osmeña'
where key = 'location_text';
