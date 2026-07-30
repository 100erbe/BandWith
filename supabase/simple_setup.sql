-- SETUP SEMPLICE - Copia e incolla in SQL Editor

-- Step 1: Crea band
INSERT INTO bands (name, created_by, slug)
VALUES ('Test Band', '494df886-3530-400b-ac9e-8f2abad7c163', 'test-band');

-- Step 2: Aggiungi membro  
INSERT INTO band_members (band_id, user_id, role)
SELECT id, '494df886-3530-400b-ac9e-8f2abad7c163', 'admin'
FROM bands WHERE slug = 'test-band';

-- Verifica
SELECT 'OK' as status, name FROM bands;
