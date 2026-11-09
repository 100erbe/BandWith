-- ============================================
-- Migration: 043_quote_numbering.sql
-- Description: Per-band, race-free quote numbering.
--
-- Problems fixed:
--   * generate_quote_number(band_prefix) computed MAX(quote_number)+1 over ALL bands
--     (SECURITY INVOKER, so under RLS it only saw the caller's bands) while
--     quotes.quote_number was globally UNIQUE -> two bands / two concurrent requests
--     received the same number and the insert failed.
--   * The client then fell back to a random number, so the PDF number and the DB
--     number could differ.
--
-- New model:
--   * public.quote_number_counters(band_id, year, last_value): one counter row per
--     band and year, only writable through the SECURITY DEFINER function below
--     (RLS enabled, no client policies).
--   * public.generate_quote_number(p_band_id uuid): checks the caller is an active
--     admin of the band, then atomically increments the counter
--     (INSERT ... ON CONFLICT DO UPDATE ... RETURNING) and returns 'BW-YYYY-NNNN'.
--   * quotes.quote_number is unique per band: UNIQUE (band_id, quote_number).
--
-- Note: a number is consumed even if the subsequent quote insert fails, so gaps
-- in the sequence are possible (by design; no duplicates are possible).
-- ============================================

-- 1. Counter table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_number_counters (
    band_id    UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
    year       INT  NOT NULL,
    last_value INT  NOT NULL DEFAULT 0,
    PRIMARY KEY (band_id, year)
);

ALTER TABLE public.quote_number_counters ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: clients can neither read nor write counters directly.
REVOKE ALL ON public.quote_number_counters FROM PUBLIC;
REVOKE ALL ON public.quote_number_counters FROM anon, authenticated;

-- 2. Seed counters from existing quotes so new numbers never collide with old ones
--    (only numbers in the canonical 'BW-YYYY-N' format are considered).
INSERT INTO public.quote_number_counters (band_id, year, last_value)
SELECT
    q.band_id,
    (substring(q.quote_number FROM '^BW-([0-9]{4})-[0-9]+$'))::INT AS year,
    MAX((substring(q.quote_number FROM '^BW-[0-9]{4}-([0-9]+)$'))::INT) AS last_value
FROM public.quotes q
WHERE q.band_id IS NOT NULL
  AND q.quote_number ~ '^BW-[0-9]{4}-[0-9]{1,9}$'
GROUP BY q.band_id, 2
ON CONFLICT (band_id, year) DO UPDATE
    SET last_value = GREATEST(public.quote_number_counters.last_value, EXCLUDED.last_value);

-- 3. Number generator ----------------------------------------------------------
-- The legacy client-callable generator is replaced (the client now calls the
-- band-scoped signature only).
DROP FUNCTION IF EXISTS public.generate_quote_number(TEXT);

CREATE OR REPLACE FUNCTION public.generate_quote_number(p_band_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_year INT := EXTRACT(YEAR FROM NOW())::INT;
    v_next INT;
    v_seq  TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    IF p_band_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.band_members bm
        WHERE bm.band_id = p_band_id
          AND bm.user_id = auth.uid()
          AND bm.role = 'admin'
          AND bm.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Only active band admins can create quotes for this band'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.quote_number_counters AS c (band_id, year, last_value)
    VALUES (p_band_id, v_year, 1)
    ON CONFLICT (band_id, year) DO UPDATE
        SET last_value = c.last_value + 1
    RETURNING c.last_value INTO v_next;

    -- lpad() would truncate beyond 4 digits, so only pad shorter values
    v_seq := CASE WHEN length(v_next::TEXT) >= 4 THEN v_next::TEXT ELSE lpad(v_next::TEXT, 4, '0') END;

    RETURN 'BW-' || v_year::TEXT || '-' || v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_quote_number(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_quote_number(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_quote_number(UUID) TO authenticated;

-- 4. Quote numbers are unique per band, not globally -----------------------------
-- Default name of the column-level UNIQUE in 002_complete_schema.sql:
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_quote_number_key;

-- Drop any other single-column unique constraint on quote_number (name may differ
-- depending on which schema file created the table).
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'public.quotes'::regclass
          AND con.contype = 'u'
          AND array_length(con.conkey, 1) = 1
          AND att.attname = 'quote_number'
    LOOP
        EXECUTE format('ALTER TABLE public.quotes DROP CONSTRAINT %I', r.conname);
    END LOOP;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.quotes'::regclass
          AND conname = 'quotes_band_id_quote_number_key'
    ) THEN
        ALTER TABLE public.quotes
            ADD CONSTRAINT quotes_band_id_quote_number_key UNIQUE (band_id, quote_number);
    END IF;
END;
$$;
