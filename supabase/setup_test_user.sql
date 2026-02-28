-- SETUP TEST USER - Esegui in Supabase SQL Editor
-- Questo script bypassa RLS completamente

-- Temporaneamente disabilita RLS
ALTER TABLE bands DISABLE ROW LEVEL SECURITY;
ALTER TABLE band_members DISABLE ROW LEVEL SECURITY;

-- Crea la band
INSERT INTO bands (id, name, description, created_by, slug, plan)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Test Band',
  'Band di test per sviluppo',
  '494df886-3530-400b-ac9e-8f2abad7c163',
  'test-band',
  'free'
);

-- Aggiungi l'utente come admin
INSERT INTO band_members (band_id, user_id, role, instrument)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '494df886-3530-400b-ac9e-8f2abad7c163',
  'admin',
  'Guitar'
);

-- Riabilita RLS
ALTER TABLE bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_members ENABLE ROW LEVEL SECURITY;

-- Verifica
SELECT 'Band creata: ' || b.name as result
FROM bands b
WHERE b.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
