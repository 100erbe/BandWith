-- Crea dati di test
-- Esegui in Supabase SQL Editor

-- Crea una band di test
INSERT INTO bands (id, name, description, created_by, slug)
VALUES (
  gen_random_uuid(),
  'Test Band',
  'A test band for development',
  '494df886-3530-400b-ac9e-8f2abad7c163',
  'test-band'
) ON CONFLICT DO NOTHING
RETURNING id;

-- Aggiungi l'utente come admin della band
INSERT INTO band_members (band_id, user_id, role, instrument)
SELECT 
  b.id,
  '494df886-3530-400b-ac9e-8f2abad7c163',
  'admin',
  'Guitar'
FROM bands b 
WHERE b.slug = 'test-band'
ON CONFLICT DO NOTHING;

-- Verifica
SELECT 
  b.name as band_name,
  p.full_name as member_name,
  bm.role
FROM bands b
JOIN band_members bm ON bm.band_id = b.id
JOIN profiles p ON p.id = bm.user_id
WHERE b.slug = 'test-band';
