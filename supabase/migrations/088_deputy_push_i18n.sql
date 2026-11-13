-- ============================================================================
-- 088: deputy pushes in the reader's language
-- ----------------------------------------------------------------------------
-- 084 and 086 write the deputy notifications in English:
--   deputy_request / deputy_gig_changed  → the deputy (request, recap,
--                                          changed, cancelled, withdrawn)
--   deputy_joined / deputy_reply         → the band's admins
-- The app now keeps profiles.preferred_language equal to its own language
-- (Settings › Language, or the device's). A BEFORE INSERT trigger on
-- notifications rewrites title and body of these four types in that
-- language (it, es, fr, de, pt) from the row's data, so the in-app list, the
-- push (bw_trg_dispatch_push, AFTER INSERT) and the email all read the same.
-- English, or any other language, keeps the text as written. Other
-- notification types are untouched.
-- ============================================================================

-- "sab 14 nov" in the given language; a missing date says so.
CREATE OR REPLACE FUNCTION public.bw_i18n_short_date(p_date date, p_lang text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_date IS NULL THEN CASE p_lang
      WHEN 'it' THEN 'data da definire' WHEN 'es' THEN 'fecha por confirmar' WHEN 'fr' THEN 'date à confirmer'
      WHEN 'de' THEN 'Datum offen' WHEN 'pt' THEN 'data a confirmar' ELSE 'date TBD' END
    ELSE
      (CASE p_lang
        WHEN 'it' THEN ARRAY['dom','lun','mar','mer','gio','ven','sab']
        WHEN 'es' THEN ARRAY['dom','lun','mar','mié','jue','vie','sáb']
        WHEN 'fr' THEN ARRAY['dim','lun','mar','mer','jeu','ven','sam']
        WHEN 'de' THEN ARRAY['So','Mo','Di','Mi','Do','Fr','Sa']
        WHEN 'pt' THEN ARRAY['dom','seg','ter','qua','qui','sex','sáb']
        ELSE ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] END)[extract(dow FROM p_date)::int + 1]
      || ' ' || extract(day FROM p_date)::int || CASE WHEN p_lang = 'de' THEN '.' ELSE '' END || ' '
      || (CASE p_lang
        WHEN 'it' THEN ARRAY['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']
        WHEN 'es' THEN ARRAY['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic']
        WHEN 'fr' THEN ARRAY['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc']
        WHEN 'de' THEN ARRAY['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
        WHEN 'pt' THEN ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
        ELSE ARRAY['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] END)[extract(month FROM p_date)::int]
  END;
$$;

-- A deputy text in a language, with {placeholders} filled from p_vars.
CREATE OR REPLACE FUNCTION public.bw_deputy_text(p_key text, p_lang text, p_vars jsonb DEFAULT '{}'::jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  k text;
BEGIN
  v := (CASE p_key
    -- To the deputy
    WHEN 'request.title' THEN '{"it":"{band}: puoi suonare?","es":"{band}: ¿puedes tocar?","fr":"{band} : tu peux jouer ?","de":"{band}: Kannst du spielen?","pt":"{band}: podes tocar?"}'
    WHEN 'recap.title' THEN '{"it":"Sei confermato: {title}","es":"Estás confirmado: {title}","fr":"Tu es confirmé : {title}","de":"Du bist bestätigt: {title}","pt":"Estás confirmado: {title}"}'
    WHEN 'changed.title' THEN '{"it":"{title} è cambiato","es":"{title} ha cambiado","fr":"{title} a changé","de":"{title} hat sich geändert","pt":"{title} mudou"}'
    WHEN 'changed.body' THEN '{"it":"{title} · {when} — cambia: {changes}. Va ancora bene?","es":"{title} · {when} — cambia: {changes}. ¿Te sigue yendo bien?","fr":"{title} · {when} — changement : {changes}. Toujours OK ?","de":"{title} · {when} — neu: {changes}. Passt es noch?","pt":"{title} · {when} — muda: {changes}. Continua a dar?"}'
    WHEN 'cancelled.title' THEN '{"it":"{title} è annullato","es":"{title} se ha cancelado","fr":"{title} est annulé","de":"{title} ist abgesagt","pt":"{title} foi cancelado"}'
    WHEN 'cancelled.body' THEN '{"it":"{title} · {when} è stato annullato da {band}.","es":"{band} ha cancelado {title} · {when}.","fr":"{title} · {when} a été annulé par {band}.","de":"{title} · {when} wurde von {band} abgesagt.","pt":"{title} · {when} foi cancelado por {band}."}'
    WHEN 'withdrawn.title' THEN '{"it":"{band} non ha più bisogno di te","es":"{band} ya no te necesita","fr":"{band} n''a plus besoin de toi","de":"{band} braucht dich nicht mehr","pt":"{band} já não precisa de ti"}'
    WHEN 'withdrawn.body' THEN '{"it":"{title} · {when}: la richiesta è stata ritirata.","es":"{title} · {when}: la solicitud se ha retirado.","fr":"{title} · {when} : la demande a été retirée.","de":"{title} · {when}: Die Anfrage wurde zurückgezogen.","pt":"{title} · {when}: o pedido foi retirado."}'
    WHEN 'change.date' THEN '{"it":"data","es":"fecha","fr":"date","de":"Datum","pt":"data"}'
    WHEN 'change.time' THEN '{"it":"orario","es":"hora","fr":"horaire","de":"Uhrzeit","pt":"horário"}'
    WHEN 'change.load-in / soundcheck' THEN '{"it":"carico / soundcheck","es":"carga / prueba de sonido","fr":"installation / balances","de":"Aufbau / Soundcheck","pt":"montagem / soundcheck"}'
    WHEN 'change.venue' THEN '{"it":"locale","es":"lugar","fr":"lieu","de":"Location","pt":"local"}'
    WHEN 'change.address' THEN '{"it":"indirizzo","es":"dirección","fr":"adresse","de":"Adresse","pt":"morada"}'
    WHEN 'band' THEN '{"it":"La band","es":"La banda","fr":"Le groupe","de":"Die Band","pt":"A banda"}'
    -- To the admins
    WHEN 'joined.title' THEN '{"it":"{name} è su BandWith","es":"{name} está en BandWith","fr":"{name} est sur BandWith","de":"{name} ist auf BandWith","pt":"{name} está no BandWith"}'
    WHEN 'joined.body' THEN '{"it":"D''ora in poi puoi chiederglielo nell''app.","es":"A partir de ahora puedes pedírselo en la app.","fr":"Tu peux maintenant le lui demander dans l''app.","de":"Ab jetzt kannst du direkt in der App fragen.","pt":"A partir de agora podes pedir-lhe na app."}'
    WHEN 'joined.account' THEN '{"it":" Account: {who}.","es":" Cuenta: {who}.","fr":" Compte : {who}.","de":" Konto: {who}.","pt":" Conta: {who}."}'
    WHEN 'reply.ack_yes' THEN '{"it":"Per {name} le modifiche vanno bene","es":"A {name} le van bien los cambios","fr":"{name} est d''accord avec les changements","de":"{name} ist mit den Änderungen einverstanden","pt":"{name} concorda com as alterações"}'
    WHEN 'reply.ack_maybe' THEN '{"it":"{name} ha visto le modifiche, conferma più tardi","es":"{name} ha visto los cambios, confirmará más tarde","fr":"{name} a vu les changements, confirmera plus tard","de":"{name} hat die Änderungen gesehen, bestätigt später","pt":"{name} viu as alterações, confirma mais tarde"}'
    WHEN 'reply.available' THEN '{"it":"{name} è disponibile","es":"{name} está disponible","fr":"{name} est disponible","de":"{name} ist verfügbar","pt":"{name} está disponível"}'
    WHEN 'reply.maybe' THEN '{"it":"{name} conferma più tardi","es":"{name} confirmará más tarde","fr":"{name} confirmera plus tard","de":"{name} bestätigt später","pt":"{name} confirma mais tarde"}'
    WHEN 'reply.unavailable' THEN '{"it":"{name} non può esserci","es":"{name} no puede ir","fr":"{name} ne peut pas venir","de":"{name} kann nicht","pt":"{name} não pode ir"}'
  END)::jsonb ->> p_lang;
  IF v IS NULL THEN RETURN NULL; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(p_vars, '{}'::jsonb)) LOOP
    v := replace(v, '{' || k || '}', coalesce(p_vars ->> k, ''));
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.bw_trg_deputy_notification_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb := coalesce(NEW.data, '{}'::jsonb);
  v_lang text;
  v_req uuid;
  v_date date;
  v_venue text;
  v_note text;
  v_when text;
  v_title text;
  v_band text;
  v_name text;
  v_kind text;
  v_changes text;
  v_vars jsonb;
  v_head text;
  v_body text;
BEGIN
  SELECT lower(left(btrim(p.preferred_language), 2)) INTO v_lang FROM public.profiles p WHERE p.id = NEW.user_id;
  IF v_lang IS NULL OR v_lang NOT IN ('it', 'es', 'fr', 'de', 'pt') THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_req := nullif(d ->> 'deputy_request_id', '')::uuid;
  EXCEPTION WHEN others THEN v_req := NULL;
  END;
  IF v_req IS NOT NULL THEN
    SELECT coalesce(e.event_date, e.date),
           nullif(concat_ws(', ', nullif(coalesce(e.venue_name, e.venue), ''), nullif(e.venue_city, '')), ''),
           r.reply_note
      INTO v_date, v_venue, v_note
      FROM public.deputy_requests r LEFT JOIN public.events e ON e.id = r.event_id
     WHERE r.id = v_req;
  END IF;
  v_when := public.bw_i18n_short_date(v_date, v_lang);

  IF NEW.type IN ('deputy_request', 'deputy_gig_changed') THEN
    v_kind := d ->> 'kind';
    v_title := coalesce(nullif(d ->> 'event_title', ''), 'Gig');
    v_band := coalesce(nullif(d ->> 'band_name', ''), public.bw_deputy_text('band', v_lang));
    SELECT string_agg(coalesce(public.bw_deputy_text('change.' || c, v_lang), c), ', ' ORDER BY o)
      INTO v_changes
      FROM jsonb_array_elements_text(coalesce(d -> 'changes', '[]'::jsonb)) WITH ORDINALITY AS x(c, o);
    v_vars := jsonb_build_object('band', v_band, 'title', v_title, 'when', v_when,
                                 'changes', coalesce(v_changes, ''));
    v_head := public.bw_deputy_text(CASE WHEN v_kind IN ('request', 'recap', 'changed', 'cancelled', 'withdrawn')
                                         THEN v_kind ELSE 'request' END || '.title', v_lang, v_vars);
    v_body := CASE v_kind
      WHEN 'changed' THEN CASE WHEN v_changes IS NULL THEN v_title || ' · ' || v_when ELSE public.bw_deputy_text('changed.body', v_lang, v_vars) END
      WHEN 'cancelled' THEN public.bw_deputy_text('cancelled.body', v_lang, v_vars)
      WHEN 'withdrawn' THEN public.bw_deputy_text('withdrawn.body', v_lang, v_vars)
      ELSE v_title || ' · ' || v_when || coalesce(' · ' || v_venue, '')
    END;

  ELSIF NEW.type = 'deputy_joined' THEN
    v_name := coalesce(nullif(d ->> 'deputy_name', ''), '?');
    v_head := public.bw_deputy_text('joined.title', v_lang, jsonb_build_object('name', v_name));
    v_body := public.bw_deputy_text('joined.body', v_lang)
              || CASE WHEN nullif(d ->> 'account_name', '') IS NULL THEN ''
                      ELSE public.bw_deputy_text('joined.account', v_lang, jsonb_build_object('who', d ->> 'account_name')) END;

  ELSIF NEW.type = 'deputy_reply' THEN
    v_name := coalesce(nullif(d ->> 'deputy_name', ''), '?');
    v_head := public.bw_deputy_text(
      CASE WHEN (d ->> 'acknowledged')::boolean IS TRUE AND d ->> 'answer' = 'available' THEN 'reply.ack_yes'
           WHEN (d ->> 'acknowledged')::boolean IS TRUE THEN 'reply.ack_maybe'
           WHEN d ->> 'answer' = 'available' THEN 'reply.available'
           WHEN d ->> 'answer' = 'maybe' THEN 'reply.maybe'
           ELSE 'reply.unavailable' END,
      v_lang, jsonb_build_object('name', v_name));
    v_body := coalesce(nullif(d ->> 'eventTitle', ''), 'Gig')
              || CASE WHEN v_date IS NOT NULL THEN ' · ' || v_when ELSE '' END
              || coalesce(' · "' || v_note || '"', '');
  ELSE
    RETURN NEW;
  END IF;

  NEW.title := left(coalesce(v_head, NEW.title), 255);
  NEW.body := coalesce(v_body, NEW.body);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_deputy_notification_text() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_notifications_deputy_text ON public.notifications;
CREATE TRIGGER bw_notifications_deputy_text
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type IN ('deputy_request', 'deputy_gig_changed', 'deputy_joined', 'deputy_reply'))
  EXECUTE FUNCTION public.bw_trg_deputy_notification_text();
