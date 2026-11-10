-- 053: invite preview also returns the band's confirmed gigs this year
-- (Figma "Joiner / Invite landing" shows Members + Gigs this year).
-- The return type changes, so the function is dropped and recreated.

DROP FUNCTION IF EXISTS public.bw_preview_invitation(uuid);

CREATE FUNCTION public.bw_preview_invitation(p_token uuid)
RETURNS TABLE (
  id uuid,
  band_id uuid,
  email text,
  role text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  band_name text,
  band_logo_url text,
  band_description text,
  member_count bigint,
  inviter_name text,
  gigs_this_year bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bi.id,
         bi.band_id,
         bi.email::text,
         bi.role::text,
         bi.status::text,
         bi.created_at,
         bi.expires_at,
         b.name::text,
         b.logo_url::text,
         b.description::text,
         (SELECT count(*) FROM band_members bm WHERE bm.band_id = bi.band_id AND COALESCE(bm.is_active, true)),
         p.full_name::text,
         (SELECT count(*) FROM events e
           WHERE e.band_id = bi.band_id
             AND e.event_type IS DISTINCT FROM 'rehearsal'
             AND e.status IN ('confirmed', 'completed')
             AND e.event_date >= date_trunc('year', now())::date)
  FROM band_invitations bi
  JOIN bands b ON b.id = bi.band_id
  LEFT JOIN profiles p ON p.id = bi.invited_by
  WHERE bi.token = p_token
    AND bi.status = 'pending'
    AND (bi.expires_at IS NULL OR bi.expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION public.bw_preview_invitation(uuid) TO anon, authenticated;
