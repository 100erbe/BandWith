-- ============================================================================
-- 090: notifications the app writes, in the reader's language
-- ----------------------------------------------------------------------------
-- 088 and 089 translate what the database writes. The app also writes some
-- notifications for other members itself (src/lib/services/notifications.ts,
-- rehearsalPolls.ts, AuthenticatedApp.tsx), in English:
--   event_invite        new gig / availability check, with the member's fee
--   event_created       to the creator: waiting for N confirmations
--   event_confirmed     a member confirmed / is tentative (RSVP)
--   member_dropped_out  a member declined or dropped out
--   song_added          song added or suggested
--   rehearsal_proposal, rehearsal_poll, rehearsal_poll_finalized
--   event_update        kind 'schedule_conflict' only
-- A BEFORE INSERT trigger rewrites them in the recipient's
-- profiles.preferred_language (it, es, fr, de, pt) from the row's data and
-- what it points to (event, poll, song). English and other languages keep
-- the text. Chat messages are the sender's own words and stay as they are.
--
-- Fix to 089: event_confirmed and event_update are also written by the app
-- (an RSVP, a schedule conflict). 089's trigger now only touches the rows the
-- database wrote (data.server = true, set by bw_notify), plus invite_received.
-- ============================================================================

DROP TRIGGER IF EXISTS bw_notifications_server_text ON public.notifications;
CREATE TRIGGER bw_notifications_server_text
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  WHEN ((NEW.type IN ('event_cancelled', 'event_confirmed', 'event_update', 'member_joined', 'member_left',
                      'fee_changed', 'payment_received', 'setlist_updated')
         AND NEW.data ->> 'server' = 'true')
        OR NEW.type = 'invite_received')
  EXECUTE FUNCTION public.bw_trg_server_notification_text();

CREATE OR REPLACE FUNCTION public.bw_app_text(p_key text, p_lang text, p_vars jsonb DEFAULT '{}'::jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  k text;
BEGIN
  v := (CASE p_key
    -- New event / availability check (event_invite)
    WHEN 'new.gig' THEN '{"it":"Nuovo gig","es":"Nuevo concierto","fr":"Nouveau concert","de":"Neuer Gig","pt":"Novo show"}'
    WHEN 'new.rehearsal' THEN '{"it":"Nuova prova","es":"Nuevo ensayo","fr":"Nouvelle répétition","de":"Neue Probe","pt":"Novo ensaio"}'
    WHEN 'new.wedding' THEN '{"it":"Nuovo matrimonio","es":"Nueva boda","fr":"Nouveau mariage","de":"Neue Hochzeit","pt":"Novo casamento"}'
    WHEN 'new.corporate' THEN '{"it":"Nuovo evento aziendale","es":"Nuevo evento corporativo","fr":"Nouvel événement d''entreprise","de":"Neues Firmenevent","pt":"Novo evento corporativo"}'
    WHEN 'new.private' THEN '{"it":"Nuovo evento privato","es":"Nuevo evento privado","fr":"Nouvel événement privé","de":"Neues privates Event","pt":"Novo evento privado"}'
    WHEN 'new.festival' THEN '{"it":"Nuovo festival","es":"Nuevo festival","fr":"Nouveau festival","de":"Neues Festival","pt":"Novo festival"}'
    WHEN 'new.other' THEN '{"it":"Nuovo evento","es":"Nuevo evento","fr":"Nouvel événement","de":"Neues Event","pt":"Novo evento"}'
    WHEN 'invite.check' THEN '{"it":"Disponibilità: {title}","es":"Disponibilidad: {title}","fr":"Disponibilité : {title}","de":"Verfügbarkeit: {title}","pt":"Disponibilidade: {title}"}'
    WHEN 'invite.scheduled' THEN '{"it":"{creator} ha messo in calendario \"{title}\" per {when} alle {time}.","es":"{creator} ha programado \"{title}\" para el {when} a las {time}.","fr":"{creator} a programmé \"{title}\" le {when} à {time}.","de":"{creator} hat \"{title}\" für {when} um {time} geplant.","pt":"{creator} agendou \"{title}\" para {when} às {time}."}'
    WHEN 'invite.quoting' THEN '{"it":"{creator} sta preparando un preventivo per \"{title}\" il {when} alle {time}. Non ancora confermato: il cliente non ha accettato.","es":"{creator} está presupuestando \"{title}\" para el {when} a las {time}. Aún no está confirmado: el cliente no ha aceptado.","fr":"{creator} prépare un devis pour \"{title}\" le {when} à {time}. Pas encore confirmé : le client n''a pas accepté.","de":"{creator} erstellt ein Angebot für \"{title}\" am {when} um {time}. Noch nicht bestätigt: Der Kunde hat nicht zugesagt.","pt":"{creator} está orçando \"{title}\" para {when} às {time}. Ainda não confirmado: o cliente não aceitou."}'
    WHEN 'invite.fee_tbd' THEN '{"it":" | Compenso: da definire","es":" | Caché: por definir","fr":" | Cachet : à définir","de":" | Gage: noch offen","pt":" | Cachê: a combinar"}'
    WHEN 'invite.fee' THEN '{"it":" | Il tuo compenso: {fee}","es":" | Tu caché: {fee}","fr":" | Ton cachet : {fee}","de":" | Deine Gage: {fee}","pt":" | Seu cachê: {fee}"}'
    WHEN 'invite.available' THEN '{"it":" Ci sei?","es":" ¿Estás disponible?","fr":" Tu es disponible ?","de":" Bist du dabei?","pt":" Você está disponível?"}'
    WHEN 'invite.confirm' THEN '{"it":" Conferma la tua disponibilità.","es":" Confirma tu disponibilidad.","fr":" Confirme ta disponibilité.","de":" Bestätige deine Verfügbarkeit.","pt":" Confirme sua disponibilidade."}'
    -- Creator: waiting for confirmations (event_created)
    WHEN 'created.title' THEN '{"it":"In attesa di conferme","es":"Esperando confirmaciones","fr":"En attente de confirmations","de":"Warten auf Zusagen","pt":"Aguardando confirmações"}'
    WHEN 'created.one' THEN '{"it":"\"{title}\" è in attesa: manca la conferma di 1 membro.","es":"\"{title}\" está pendiente: falta que confirme 1 miembro.","fr":"\"{title}\" est en attente : 1 membre doit confirmer.","de":"\"{title}\" ist offen: 1 Mitglied muss noch zusagen.","pt":"\"{title}\" está pendente: falta 1 membro confirmar."}'
    WHEN 'created.many' THEN '{"it":"\"{title}\" è in attesa: manca la conferma di {n} membri.","es":"\"{title}\" está pendiente: faltan {n} miembros por confirmar.","fr":"\"{title}\" est en attente : {n} membres doivent confirmer.","de":"\"{title}\" ist offen: {n} Mitglieder müssen noch zusagen.","pt":"\"{title}\" está pendente: faltam {n} membros confirmarem."}'
    -- RSVP (event_confirmed from the app)
    WHEN 'rsvp.confirmed.title' THEN '{"it":"Conferma ricevuta","es":"Confirmación recibida","fr":"Confirmation reçue","de":"Zusage erhalten","pt":"Confirmação recebida"}'
    WHEN 'rsvp.confirmed.body' THEN '{"it":"{name} ha confermato per \"{title}\".","es":"{name} ha confirmado para \"{title}\".","fr":"{name} a confirmé pour \"{title}\".","de":"{name} hat für \"{title}\" zugesagt.","pt":"{name} confirmou presença em \"{title}\"."}'
    WHEN 'rsvp.tentative.title' THEN '{"it":"Risposta: forse","es":"Respuesta: quizá","fr":"Réponse : peut-être","de":"Antwort: vielleicht","pt":"Resposta: talvez"}'
    WHEN 'rsvp.tentative.body' THEN '{"it":"{name} forse ci sarà a \"{title}\".","es":"{name} quizá pueda ir a \"{title}\".","fr":"{name} viendra peut-être à \"{title}\".","de":"{name} ist bei \"{title}\" vielleicht dabei.","pt":"{name} talvez vá a \"{title}\"."}'
    -- Dropped out
    WHEN 'dropout.title' THEN '{"it":"{name} non ci sarà","es":"{name} no podrá ir","fr":"{name} se désiste","de":"{name} hat abgesagt","pt":"{name} desistiu"}'
    WHEN 'dropout.body' THEN '{"it":"{name} non ci sarà a {event}. Serve un sostituto.","es":"{name} no podrá ir a {event}. Hace falta un reemplazo.","fr":"{name} ne pourra pas venir à {event}. Il faut un remplaçant.","de":"{name} kann bei {event} nicht dabei sein. Ein Ersatz wird gebraucht.","pt":"{name} não vai poder ir a {event}. É preciso um substituto."}'
    WHEN 'dropout.declined' THEN '{"it":"{name} non ci sarà a {event}.","es":"{name} no podrá ir a {event}.","fr":"{name} ne pourra pas venir à {event}.","de":"{name} kann bei {event} nicht dabei sein.","pt":"{name} não vai poder ir a {event}."}'
    WHEN 'dropout.alt' THEN '{"it":" Propone: {alt}.","es":" Propone: {alt}.","fr":" Propose : {alt}.","de":" Schlägt vor: {alt}.","pt":" Sugere: {alt}."}'
    -- Songs
    WHEN 'song.suggested.title' THEN '{"it":"Brano proposto","es":"Canción sugerida","fr":"Morceau suggéré","de":"Song vorgeschlagen","pt":"Música sugerida"}'
    WHEN 'song.added.title' THEN '{"it":"Nuovo brano in repertorio","es":"Nueva canción en el repertorio","fr":"Nouveau morceau au répertoire","de":"Neuer Song im Repertoire","pt":"Nova música no repertório"}'
    WHEN 'song.by' THEN '{"it":" di {artist}","es":" de {artist}","fr":" de {artist}","de":" von {artist}","pt":" de {artist}"}'
    WHEN 'song.suggested.body' THEN '{"it":"{who} ha proposto {song}. Gli admin possono spostarlo in In studio o Pronto.","es":"{who} ha sugerido {song}. Los admins pueden pasarla a Aprendiendo o Lista.","fr":"{who} a suggéré {song}. Les admins peuvent le passer en À l’étude ou Prêt.","de":"{who} hat {song} vorgeschlagen. Admins können ihn nach Wird geübt oder Bereit verschieben.","pt":"{who} sugeriu {song}. Admins podem mover para Aprendendo ou Pronta."}'
    WHEN 'song.added.body' THEN '{"it":"{who} ha aggiunto {song}.","es":"{who} ha añadido {song}.","fr":"{who} a ajouté {song}.","de":"{who} hat {song} hinzugefügt.","pt":"{who} adicionou {song}."}'
    WHEN 'bandmate' THEN '{"it":"Un membro della band","es":"Un compañero de banda","fr":"Un membre du groupe","de":"Ein Bandmitglied","pt":"Um colega de banda"}'
    -- Rehearsal polls
    WHEN 'proposal.title' THEN '{"it":"Nuova proposta di prova","es":"Nueva propuesta de ensayo","fr":"Nouvelle proposition de répétition","de":"Neuer Probenvorschlag","pt":"Nova proposta de ensaio"}'
    WHEN 'proposal.body' THEN '{"it":"{who} ha proposto: \"{title}\". Crea un sondaggio di disponibilità per fissarla.","es":"{who} ha propuesto: \"{title}\". Crea una encuesta de disponibilidad para programarlo.","fr":"{who} a proposé : \"{title}\". Lance un sondage de disponibilité pour la planifier.","de":"{who} hat vorgeschlagen: \"{title}\". Starte eine Verfügbarkeitsumfrage, um sie zu planen.","pt":"{who} propôs: \"{title}\". Crie uma enquete de disponibilidade para agendar."}'
    WHEN 'poll.title' THEN '{"it":"Vota gli orari della prova","es":"Vota los horarios del ensayo","fr":"Vote pour les horaires de répétition","de":"Stimm über die Probenzeiten ab","pt":"Vote nos horários do ensaio"}'
    WHEN 'poll.body' THEN '{"it":"Nuovo sondaggio di disponibilità: \"{title}\". Tocca per scegliere le date in cui ci sei.","es":"Nueva encuesta de disponibilidad: \"{title}\". Toca para elegir las fechas en que puedes.","fr":"Nouveau sondage de disponibilité : \"{title}\". Touche pour choisir tes dates.","de":"Neue Verfügbarkeitsumfrage: \"{title}\". Tippe, um deine Termine auszuwählen.","pt":"Nova enquete de disponibilidade: \"{title}\". Toque para escolher as datas em que você pode."}'
    WHEN 'finalized.title' THEN '{"it":"Prova confermata!","es":"¡Ensayo confirmado!","fr":"Répétition confirmée !","de":"Probe bestätigt!","pt":"Ensaio confirmado!"}'
    WHEN 'finalized.body' THEN '{"it":"Prova fissata per {when} alle {time}{venue}.","es":"Ensayo fijado para el {when} a las {time}{venue}.","fr":"Répétition fixée au {when} à {time}{venue}.","de":"Probe steht: {when} um {time}{venue}.","pt":"Ensaio marcado para {when} às {time}{venue}."}'
    -- Schedule conflict (event_update, kind schedule_conflict)
    WHEN 'conflict.title' THEN '{"it":"Conflitto di calendario","es":"Conflicto de agenda","fr":"Conflit d''agenda","de":"Terminkonflikt","pt":"Conflito de agenda"}'
    WHEN 'conflict.body' THEN '{"it":"{who} ha già un altro impegno: {title} · {when}.","es":"{who} ya tiene otro compromiso: {title} · {when}.","fr":"{who} est déjà pris ailleurs : {title} · {when}.","de":"{who} hat schon einen anderen Termin: {title} · {when}.","pt":"{who} já tem outro compromisso: {title} · {when}."}'
  END)::jsonb ->> p_lang;
  IF v IS NULL THEN RETURN NULL; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(p_vars, '{}'::jsonb)) LOOP
    v := replace(v, '{' || k || '}', coalesce(p_vars ->> k, ''));
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.bw_trg_app_notification_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb := coalesce(NEW.data, '{}'::jsonb);
  v_lang text;
  v_id uuid;
  -- Scalars only: a record's shape would be cached between rows (089).
  v_ev_title text;
  v_ev_type text;
  v_ev_date date;
  v_ev_start time;
  v_ev_currency text;
  v_ev_venue text;
  v_type text;
  v_title text;
  v_when text;
  v_time text;
  v_name text;
  v_who text;
  v_fee numeric;
  v_song text;
  v_artist text;
  v_head text;
  v_body text;
BEGIN
  SELECT lower(left(btrim(p.preferred_language), 2)) INTO v_lang FROM public.profiles p WHERE p.id = NEW.user_id;
  IF v_lang IS NULL OR v_lang NOT IN ('it', 'es', 'fr', 'de', 'pt') THEN
    RETURN NEW;
  END IF;
  IF NEW.type = 'event_update' AND coalesce(d ->> 'kind', '') <> 'schedule_conflict' THEN
    RETURN NEW;
  END IF;

  IF d ? 'event_id' THEN
    v_id := nullif(d ->> 'event_id', '')::uuid;
    SELECT e.title::text, e.event_type::text, coalesce(e.event_date, e.date)::date, e.start_time::time, e.currency::text,
           nullif(coalesce(e.venue_name, e.venue), '')::text
      INTO v_ev_title, v_ev_type, v_ev_date, v_ev_start, v_ev_currency, v_ev_venue
      FROM public.events e WHERE e.id = v_id;
  END IF;
  v_type := lower(coalesce(nullif(d ->> 'event_type', ''), v_ev_type, 'gig'));
  IF v_type NOT IN ('gig', 'rehearsal', 'wedding', 'corporate', 'private', 'festival') THEN v_type := 'other'; END IF;
  v_title := coalesce(nullif(d ->> 'event_title', ''), nullif(v_ev_title, ''), public.bw_server_text(CASE WHEN v_type = 'rehearsal' THEN 'rehearsal' ELSE 'gig' END, v_lang));
  v_when := public.bw_i18n_short_date(coalesce(nullif(d ->> 'event_date', '')::date, v_ev_date), v_lang);
  v_name := coalesce(nullif(d ->> 'member_name', ''), public.bw_server_text('a_member', v_lang));

  CASE NEW.type
  WHEN 'event_invite' THEN
    v_time := left(coalesce(nullif(d ->> 'event_time', ''), to_char(v_ev_start, 'HH24:MI'), '20:00'), 5);
    v_head := CASE WHEN (d ->> 'tentative')::boolean IS TRUE
                   THEN public.bw_app_text('invite.check', v_lang, jsonb_build_object('title', v_title))
                   ELSE public.bw_app_text('new.' || v_type, v_lang) END;
    v_body := public.bw_app_text(CASE WHEN (d ->> 'tentative')::boolean IS TRUE THEN 'invite.quoting' ELSE 'invite.scheduled' END, v_lang,
                jsonb_build_object('creator', coalesce(nullif(d ->> 'creator_name', ''), public.bw_app_text('bandmate', v_lang)),
                                   'title', v_title, 'when', v_when, 'time', v_time))
              || coalesce(' @ ' || nullif(d ->> 'venue', ''), '');
    v_fee := nullif(d ->> 'member_fee', '')::numeric;
    IF v_type <> 'rehearsal' AND (d ->> 'fee_tbd')::boolean IS TRUE THEN
      v_body := v_body || public.bw_app_text('invite.fee_tbd', v_lang);
    ELSIF v_type <> 'rehearsal' AND v_fee > 0 THEN
      v_body := v_body || public.bw_app_text('invite.fee', v_lang,
                  jsonb_build_object('fee', public.bw_i18n_amount(v_fee, v_ev_currency, v_lang)));
    END IF;
    v_body := v_body || public.bw_app_text(CASE WHEN (d ->> 'tentative')::boolean IS TRUE THEN 'invite.available' ELSE 'invite.confirm' END, v_lang);

  WHEN 'event_created' THEN
    v_head := public.bw_app_text('created.title', v_lang);
    v_body := public.bw_app_text(CASE WHEN coalesce((d ->> 'pending_confirmations')::int, 0) = 1 THEN 'created.one' ELSE 'created.many' END, v_lang,
                jsonb_build_object('title', v_title, 'n', coalesce(d ->> 'pending_confirmations', '0')));

  WHEN 'event_confirmed' THEN
    IF d ->> 'response' = 'tentative' THEN
      v_head := public.bw_app_text('rsvp.tentative.title', v_lang);
      v_body := public.bw_app_text('rsvp.tentative.body', v_lang, jsonb_build_object('name', v_name, 'title', v_title));
    ELSE
      v_head := public.bw_app_text('rsvp.confirmed.title', v_lang);
      v_body := public.bw_app_text('rsvp.confirmed.body', v_lang, jsonb_build_object('name', v_name, 'title', v_title));
    END IF;

  WHEN 'member_dropped_out' THEN
    v_head := public.bw_app_text('dropout.title', v_lang, jsonb_build_object('name', v_name));
    IF d ->> 'response' = 'declined' THEN
      v_body := public.bw_app_text('dropout.declined', v_lang, jsonb_build_object('name', v_name, 'event', '"' || v_title || '"'))
                || CASE WHEN nullif(d ->> 'alternative_date', '') IS NULL THEN ''
                        ELSE public.bw_app_text('dropout.alt', v_lang, jsonb_build_object('alt', d ->> 'alternative_date')) END;
    ELSE
      v_body := public.bw_app_text('dropout.body', v_lang, jsonb_build_object('name', v_name,
                  'event', '"' || v_title || '"' || CASE WHEN nullif(d ->> 'event_date', '') IS NOT NULL THEN ' (' || v_when || ')' ELSE '' END));
    END IF;

  WHEN 'song_added' THEN
    IF d ? 'song_id' THEN
      SELECT s.title::text, nullif(s.artist, '')::text, public.bw_display_name(s.added_by)
        INTO v_song, v_artist, v_who
        FROM public.songs s WHERE s.id = nullif(d ->> 'song_id', '')::uuid;
    END IF;
    IF v_song IS NULL THEN RETURN NEW; END IF;
    -- The app names who did it in the English text ("Ana suggested …").
    v_who := coalesce(nullif(substring(NEW.body FROM '^(.+?) (?:suggested|added) "'), 'A bandmate'), v_who,
                      public.bw_app_text('bandmate', v_lang));
    v_song := '"' || v_song || '"'
              || CASE WHEN v_artist IS NULL THEN '' ELSE public.bw_app_text('song.by', v_lang, jsonb_build_object('artist', v_artist)) END;
    IF (d ->> 'suggested')::boolean IS TRUE THEN
      v_head := public.bw_app_text('song.suggested.title', v_lang);
      v_body := public.bw_app_text('song.suggested.body', v_lang, jsonb_build_object('who', v_who, 'song', v_song));
    ELSE
      v_head := public.bw_app_text('song.added.title', v_lang);
      v_body := public.bw_app_text('song.added.body', v_lang, jsonb_build_object('who', v_who, 'song', v_song));
    END IF;

  WHEN 'rehearsal_proposal', 'rehearsal_poll' THEN
    SELECT p.title::text, public.bw_display_name(p.created_by)
      INTO v_title, v_who
      FROM public.rehearsal_polls p WHERE p.id = nullif(d ->> 'poll_id', '')::uuid;
    IF v_title IS NULL THEN RETURN NEW; END IF;
    IF NEW.type = 'rehearsal_proposal' THEN
      v_who := coalesce(substring(NEW.body FROM '^(.+?) proposed: '), v_who, public.bw_app_text('bandmate', v_lang));
      v_head := public.bw_app_text('proposal.title', v_lang);
      v_body := public.bw_app_text('proposal.body', v_lang, jsonb_build_object('who', v_who, 'title', v_title));
    ELSE
      v_head := public.bw_app_text('poll.title', v_lang);
      v_body := public.bw_app_text('poll.body', v_lang, jsonb_build_object('title', v_title));
    END IF;

  WHEN 'rehearsal_poll_finalized' THEN
    v_head := public.bw_app_text('finalized.title', v_lang);
    v_body := public.bw_app_text('finalized.body', v_lang, jsonb_build_object(
      'when', public.bw_i18n_short_date(coalesce(nullif(d ->> 'date', '')::date, v_ev_date), v_lang),
      'time', left(coalesce(nullif(d ->> 'time', ''), to_char(v_ev_start, 'HH24:MI'), ''), 5),
      'venue', coalesce(' (' || v_ev_venue || ')', '')));

  WHEN 'event_update' THEN
    v_who := split_part(coalesce(public.bw_display_name(nullif(d ->> 'conflict_user_id', '')::uuid), ''), ' ', 1);
    v_head := public.bw_app_text('conflict.title', v_lang);
    v_body := public.bw_app_text('conflict.body', v_lang, jsonb_build_object(
      'who', coalesce(nullif(v_who, ''), public.bw_server_text('a_member', v_lang)),
      'title', v_title,
      'when', v_when || CASE WHEN v_ev_start IS NOT NULL THEN ', ' || to_char(v_ev_start, 'HH24:MI') ELSE '' END));

  ELSE
    RETURN NEW;
  END CASE;

  NEW.title := left(coalesce(v_head, NEW.title), 255);
  NEW.body := coalesce(v_body, NEW.body);
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Never lose a notification over its translation: keep the English.
  RAISE WARNING 'bw_trg_app_notification_text: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_app_notification_text() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_notifications_app_text ON public.notifications;
CREATE TRIGGER bw_notifications_app_text
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type IN ('event_invite', 'event_created', 'event_confirmed', 'member_dropped_out', 'song_added',
                     'rehearsal_proposal', 'rehearsal_poll', 'rehearsal_poll_finalized', 'event_update')
        AND coalesce(NEW.data ->> 'server', '') <> 'true')
  EXECUTE FUNCTION public.bw_trg_app_notification_text();
