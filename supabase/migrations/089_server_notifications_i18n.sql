-- ============================================================================
-- 089: the other server notifications in the reader's language
-- ----------------------------------------------------------------------------
-- 088 translated the deputy notifications. This does the same for the rest of
-- what the database writes (046, 068 and later triggers, invite-member):
--   event_cancelled, event_confirmed, event_update   (bw_trg_event_changed)
--   member_joined, member_left                       (bw_trg_band_member_changed)
--   fee_changed                                      (bw_trg_member_fee_changed)
--   payment_received                                 (bw_trg_transaction_income)
--   setlist_updated                                  (bw_notify_setlist)
--   invite_received                                  (invite-member edge function)
-- A BEFORE INSERT trigger rewrites title and body in the recipient's
-- profiles.preferred_language (it, es, fr, de, pt; the app keeps it in sync)
-- from the row's data and the event / transaction it points to. English and
-- other languages keep the text as written; the functions that write these
-- rows are unchanged.
-- Also: the deputy texts (088) in Brazilian Portuguese, like the app.
-- ============================================================================

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
    WHEN 'request.title' THEN '{"it":"{band}: puoi suonare?","es":"{band}: ¿puedes tocar?","fr":"{band} : tu peux jouer ?","de":"{band}: Kannst du spielen?","pt":"{band}: você pode tocar?"}'
    WHEN 'recap.title' THEN '{"it":"Sei confermato: {title}","es":"Estás confirmado: {title}","fr":"Tu es confirmé : {title}","de":"Du bist bestätigt: {title}","pt":"Você está confirmado: {title}"}'
    WHEN 'changed.title' THEN '{"it":"{title} è cambiato","es":"{title} ha cambiado","fr":"{title} a changé","de":"{title} hat sich geändert","pt":"{title} mudou"}'
    WHEN 'changed.body' THEN '{"it":"{title} · {when} — cambia: {changes}. Va ancora bene?","es":"{title} · {when} — cambia: {changes}. ¿Te sigue yendo bien?","fr":"{title} · {when} — changement : {changes}. Toujours OK ?","de":"{title} · {when} — neu: {changes}. Passt es noch?","pt":"{title} · {when} — mudou: {changes}. Ainda dá para você?"}'
    WHEN 'cancelled.title' THEN '{"it":"{title} è annullato","es":"{title} se ha cancelado","fr":"{title} est annulé","de":"{title} ist abgesagt","pt":"{title} foi cancelado"}'
    WHEN 'cancelled.body' THEN '{"it":"{title} · {when} è stato annullato da {band}.","es":"{band} ha cancelado {title} · {when}.","fr":"{title} · {when} a été annulé par {band}.","de":"{title} · {when} wurde von {band} abgesagt.","pt":"{title} · {when} foi cancelado por {band}."}'
    WHEN 'withdrawn.title' THEN '{"it":"{band} non ha più bisogno di te","es":"{band} ya no te necesita","fr":"{band} n''a plus besoin de toi","de":"{band} braucht dich nicht mehr","pt":"{band} não precisa mais de você"}'
    WHEN 'withdrawn.body' THEN '{"it":"{title} · {when}: la richiesta è stata ritirata.","es":"{title} · {when}: la solicitud se ha retirado.","fr":"{title} · {when} : la demande a été retirée.","de":"{title} · {when}: Die Anfrage wurde zurückgezogen.","pt":"{title} · {when}: o pedido foi retirado."}'
    WHEN 'change.date' THEN '{"it":"data","es":"fecha","fr":"date","de":"Datum","pt":"data"}'
    WHEN 'change.time' THEN '{"it":"orario","es":"hora","fr":"horaire","de":"Uhrzeit","pt":"horário"}'
    WHEN 'change.load-in / soundcheck' THEN '{"it":"carico / soundcheck","es":"carga / prueba de sonido","fr":"installation / balances","de":"Aufbau / Soundcheck","pt":"montagem / passagem de som"}'
    WHEN 'change.venue' THEN '{"it":"locale","es":"lugar","fr":"lieu","de":"Location","pt":"local"}'
    WHEN 'change.address' THEN '{"it":"indirizzo","es":"dirección","fr":"adresse","de":"Adresse","pt":"endereço"}'
    WHEN 'band' THEN '{"it":"La band","es":"La banda","fr":"Le groupe","de":"Die Band","pt":"A banda"}'
    -- To the admins
    WHEN 'joined.title' THEN '{"it":"{name} è su BandWith","es":"{name} está en BandWith","fr":"{name} est sur BandWith","de":"{name} ist auf BandWith","pt":"{name} está no BandWith"}'
    WHEN 'joined.body' THEN '{"it":"D''ora in poi puoi chiederglielo nell''app.","es":"A partir de ahora puedes pedírselo en la app.","fr":"Tu peux maintenant le lui demander dans l''app.","de":"Ab jetzt kannst du direkt in der App fragen.","pt":"A partir de agora você pode chamar pelo app."}'
    WHEN 'joined.account' THEN '{"it":" Account: {who}.","es":" Cuenta: {who}.","fr":" Compte : {who}.","de":" Konto: {who}.","pt":" Conta: {who}."}'
    WHEN 'reply.ack_yes' THEN '{"it":"Per {name} le modifiche vanno bene","es":"A {name} le van bien los cambios","fr":"{name} est d''accord avec les changements","de":"{name} ist mit den Änderungen einverstanden","pt":"{name} concorda com as mudanças"}'
    WHEN 'reply.ack_maybe' THEN '{"it":"{name} ha visto le modifiche, conferma più tardi","es":"{name} ha visto los cambios, confirmará más tarde","fr":"{name} a vu les changements, confirmera plus tard","de":"{name} hat die Änderungen gesehen, bestätigt später","pt":"{name} viu as mudanças, confirma depois"}'
    WHEN 'reply.available' THEN '{"it":"{name} è disponibile","es":"{name} está disponible","fr":"{name} est disponible","de":"{name} ist verfügbar","pt":"{name} está disponível"}'
    WHEN 'reply.maybe' THEN '{"it":"{name} conferma più tardi","es":"{name} confirmará más tarde","fr":"{name} confirmera plus tard","de":"{name} bestätigt später","pt":"{name} confirma depois"}'
    WHEN 'reply.unavailable' THEN '{"it":"{name} non può esserci","es":"{name} no puede ir","fr":"{name} ne peut pas venir","de":"{name} kann nicht","pt":"{name} não pode ir"}'
  END)::jsonb ->> p_lang;
  IF v IS NULL THEN RETURN NULL; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(p_vars, '{}'::jsonb)) LOOP
    v := replace(v, '{' || k || '}', coalesce(p_vars ->> k, ''));
  END LOOP;
  RETURN v;
END;
$$;

-- "150,00 €" in the given language (English: "€150.00", as before).
CREATE OR REPLACE FUNCTION public.bw_i18n_amount(p_amount numeric, p_currency text, p_lang text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH f AS (
    SELECT to_char(coalesce(p_amount, 0), 'FM999,999,990.00') AS s,
           CASE upper(coalesce(nullif(p_currency, ''), 'EUR'))
             WHEN 'EUR' THEN '€' WHEN 'USD' THEN '$' WHEN 'GBP' THEN '£'
             ELSE upper(p_currency) END AS sym
  )
  SELECT CASE
    WHEN p_lang = 'fr' THEN replace(replace(s, ',', ' '), '.', ',') || ' ' || sym
    WHEN p_lang IN ('it', 'es', 'de', 'pt') THEN translate(s, ',.', '.,') || ' ' || sym
    ELSE sym || s
  END
  FROM f;
$$;

-- A server notification text in a language, with {placeholders} filled in.
CREATE OR REPLACE FUNCTION public.bw_server_text(p_key text, p_lang text, p_vars jsonb DEFAULT '{}'::jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
  k text;
BEGIN
  v := (CASE p_key
    -- Events
    WHEN 'cancelled.gig' THEN '{"it":"Gig annullato","es":"Concierto cancelado","fr":"Concert annulé","de":"Gig abgesagt","pt":"Show cancelado"}'
    WHEN 'cancelled.rehearsal' THEN '{"it":"Prova annullata","es":"Ensayo cancelado","fr":"Répétition annulée","de":"Probe abgesagt","pt":"Ensaio cancelado"}'
    WHEN 'confirmed.gig' THEN '{"it":"Gig confermato","es":"Concierto confirmado","fr":"Concert confirmé","de":"Gig bestätigt","pt":"Show confirmado"}'
    WHEN 'confirmed.rehearsal' THEN '{"it":"Prova confermata","es":"Ensayo confirmado","fr":"Répétition confirmée","de":"Probe bestätigt","pt":"Ensaio confirmado"}'
    WHEN 'updated.gig' THEN '{"it":"Gig aggiornato","es":"Concierto actualizado","fr":"Concert modifié","de":"Gig aktualisiert","pt":"Show atualizado"}'
    WHEN 'updated.rehearsal' THEN '{"it":"Prova aggiornata","es":"Ensayo actualizado","fr":"Répétition modifiée","de":"Probe aktualisiert","pt":"Ensaio atualizado"}'
    WHEN 'gig' THEN '{"it":"Gig","es":"Concierto","fr":"Concert","de":"Gig","pt":"Show"}'
    WHEN 'rehearsal' THEN '{"it":"Prova","es":"Ensayo","fr":"Répétition","de":"Probe","pt":"Ensaio"}'
    WHEN 'removed.body' THEN '{"it":"{title} · {when} non è più in calendario.","es":"{title} · {when} ya no está en el calendario.","fr":"{title} · {when} n''est plus dans le calendrier.","de":"{title} · {when} ist nicht mehr im Kalender.","pt":"{title} · {when} não está mais na agenda."}'
    WHEN 'cancelled.body' THEN '{"it":"{title} · {when} non si fa più.","es":"{title} · {when} se ha cancelado.","fr":"{title} · {when} n''aura pas lieu.","de":"{title} · {when} wurde abgesagt.","pt":"{title} · {when} foi cancelado."}'
    WHEN 'confirmed.body' THEN '{"it":"{title} · {when} si fa. Controlla formazione e orari.","es":"{title} · {when} sigue adelante. Revisa la formación y los horarios.","fr":"{title} · {when} : c''est confirmé. Vérifie le line-up et les horaires.","de":"{title} · {when} findet statt. Check Besetzung und Zeiten.","pt":"{title} · {when} está confirmado. Confira a formação e os horários."}'
    WHEN 'updated.body' THEN '{"it":"{title} · {when} — cambia: {changes}.","es":"{title} · {when} — cambia: {changes}.","fr":"{title} · {when} — changement : {changes}.","de":"{title} · {when} — neu: {changes}.","pt":"{title} · {when} — mudou: {changes}."}'
    -- Members
    WHEN 'joined.title' THEN '{"it":"{name} ora è in {band}","es":"{name} se ha unido a {band}","fr":"{name} a rejoint {band}","de":"{name} ist jetzt bei {band}","pt":"{name} agora faz parte de {band}"}'
    WHEN 'joined.body' THEN '{"it":"Saluta e aggiungi {name} alla prossima formazione.","es":"Saluda y añade a {name} a tu próxima formación.","fr":"Dis bonjour et ajoute {name} à ton prochain line-up.","de":"Sag hallo und plane {name} in der nächsten Besetzung ein.","pt":"Dê as boas-vindas e adicione {name} à próxima formação."}'
    WHEN 'removed_you.title' THEN '{"it":"Non sei più in {band}","es":"Ya no estás en {band}","fr":"Tu ne fais plus partie de {band}","de":"Nicht mehr bei {band}","pt":"Você não faz mais parte de {band}"}'
    WHEN 'removed_you.body' THEN '{"it":"Un admin ti ha tolto da {band}.","es":"Un admin te ha quitado de {band}.","fr":"Un admin t''a retiré de {band}.","de":"Ein Admin hat dich aus {band} entfernt.","pt":"Um admin removeu você de {band}."}'
    WHEN 'left.title' THEN '{"it":"{name} ha lasciato {band}","es":"{name} ha dejado {band}","fr":"{name} a quitté {band}","de":"{name} hat {band} verlassen","pt":"{name} saiu de {band}"}'
    WHEN 'left.removed' THEN '{"it":"{name} non è più nella band.","es":"{name} ya no está en la banda.","fr":"{name} ne fait plus partie du groupe.","de":"{name} ist nicht mehr in der Band.","pt":"{name} não está mais na banda."}'
    WHEN 'left.body' THEN '{"it":"{name} ha lasciato la band.","es":"{name} ha dejado la banda.","fr":"{name} a quitté le groupe.","de":"{name} hat die Band verlassen.","pt":"{name} saiu da banda."}'
    WHEN 'a_member' THEN '{"it":"Un membro","es":"Un miembro","fr":"Un membre","de":"Ein Mitglied","pt":"Um membro"}'
    -- Money
    WHEN 'fee.title' THEN '{"it":"Il tuo compenso è cambiato","es":"Tu caché ha cambiado","fr":"Ton cachet a changé","de":"Deine Gage hat sich geändert","pt":"Seu cachê mudou"}'
    WHEN 'fee.body' THEN '{"it":"{title} · {when}: ora il tuo compenso è {new} (prima {old}).","es":"{title} · {when}: ahora tu caché es {new} (antes {old}).","fr":"{title} · {when} : ton cachet est maintenant de {new} (avant {old}).","de":"{title} · {when}: Deine Gage beträgt jetzt {new} (vorher {old}).","pt":"{title} · {when}: seu cachê agora é {new} (antes {old})."}'
    WHEN 'payment.title' THEN '{"it":"Pagamento ricevuto","es":"Pago recibido","fr":"Paiement reçu","de":"Zahlung erhalten","pt":"Pagamento recebido"}'
    WHEN 'payment.lineup' THEN '{"it":"La band ha registrato un pagamento per {title}.","es":"La banda ha registrado un pago de {title}.","fr":"Le groupe a enregistré un paiement pour {title}.","de":"Die Band hat eine Zahlung für {title} erfasst.","pt":"A banda registrou um pagamento de {title}."}'
    WHEN 'a_gig' THEN '{"it":"un gig","es":"un concierto","fr":"un concert","de":"einen Gig","pt":"um show"}'
    -- Setlists, invitations
    WHEN 'setlist.title' THEN '{"it":"Scaletta aggiornata","es":"Setlist actualizada","fr":"Setlist mise à jour","de":"Setlist aktualisiert","pt":"Setlist atualizada"}'
    WHEN 'setlist.body' THEN '{"it":"{name} è cambiata. Controlla l''ordine dei brani prima del prossimo gig.","es":"{name} ha cambiado. Revisa el orden antes del próximo concierto.","fr":"{name} a changé. Vérifie l''ordre avant le prochain concert.","de":"{name} wurde geändert. Check die Reihenfolge vor dem nächsten Gig.","pt":"{name} mudou. Confira a ordem antes do próximo show."}'
    WHEN 'invite.title' THEN '{"it":"Invito a entrare in {band}","es":"Invitación para unirte a {band}","fr":"Invitation à rejoindre {band}","de":"Einladung zu {band}","pt":"Convite para entrar em {band}"}'
    WHEN 'invite.body' THEN '{"it":"Apri BandWith per accettare o rifiutare.","es":"Abre BandWith para aceptar o rechazar.","fr":"Ouvre BandWith pour accepter ou refuser.","de":"Öffne BandWith, um anzunehmen oder abzulehnen.","pt":"Abra o BandWith para aceitar ou recusar."}'
  END)::jsonb ->> p_lang;
  IF v IS NULL THEN RETURN NULL; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(p_vars, '{}'::jsonb)) LOOP
    v := replace(v, '{' || k || '}', coalesce(p_vars ->> k, ''));
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.bw_trg_server_notification_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb := coalesce(NEW.data, '{}'::jsonb);
  v_lang text;
  v_event uuid;
  v_ev_title text;
  v_ev_type text;
  v_ev_date date;
  v_ev_start time;
  v_ev_currency text;
  v_kind text;
  v_title text;
  v_when text;
  v_changes text;
  v_name text;
  v_band text;
  v_vars jsonb;
  v_head text;
  v_body text;
  v_tx_title text;
BEGIN
  SELECT lower(left(btrim(p.preferred_language), 2)) INTO v_lang FROM public.profiles p WHERE p.id = NEW.user_id;
  IF v_lang IS NULL OR v_lang NOT IN ('it', 'es', 'fr', 'de', 'pt') THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_event := nullif(d ->> 'event_id', '')::uuid;
  EXCEPTION WHEN others THEN v_event := NULL;
  END;
  IF v_event IS NOT NULL THEN
    -- Scalars, not a record: a record's shape would be cached between rows.
    SELECT e.title::text, e.event_type::text, coalesce(e.event_date, e.date)::date, e.start_time::time, e.currency::text
      INTO v_ev_title, v_ev_type, v_ev_date, v_ev_start, v_ev_currency
      FROM public.events e WHERE e.id = v_event;
  END IF;
  v_kind := CASE WHEN lower(coalesce(v_ev_type, d ->> 'event_type', 'gig')) = 'rehearsal' THEN 'rehearsal' ELSE 'gig' END;
  v_title := coalesce(nullif(v_ev_title, ''), nullif(d ->> 'event_title', ''), public.bw_server_text(v_kind, v_lang));
  v_when := public.bw_i18n_short_date(coalesce(v_ev_date, nullif(d ->> 'event_date', '')::date), v_lang);

  CASE NEW.type
  WHEN 'event_cancelled', 'event_confirmed', 'event_update' THEN
    v_when := v_when || CASE WHEN v_ev_start IS NOT NULL THEN ' · ' || to_char(v_ev_start, 'HH24:MI') ELSE '' END;
    SELECT string_agg(coalesce(public.bw_deputy_text('change.' || c, v_lang), c), ', ' ORDER BY o)
      INTO v_changes
      FROM jsonb_array_elements_text(coalesce(d -> 'changes', '[]'::jsonb)) WITH ORDINALITY AS x(c, o);
    v_vars := jsonb_build_object('title', v_title, 'when', v_when, 'changes', coalesce(v_changes, ''));
    IF NEW.type = 'event_cancelled' THEN
      v_head := public.bw_server_text('cancelled.' || v_kind, v_lang);
      v_body := public.bw_server_text(CASE WHEN (d ->> 'deleted')::boolean IS TRUE THEN 'removed.body' ELSE 'cancelled.body' END, v_lang, v_vars);
    ELSIF NEW.type = 'event_confirmed' THEN
      v_head := public.bw_server_text('confirmed.' || v_kind, v_lang);
      v_body := public.bw_server_text('confirmed.body', v_lang, v_vars);
    ELSE
      v_head := public.bw_server_text('updated.' || v_kind, v_lang);
      v_body := CASE WHEN v_changes IS NULL THEN NULL ELSE public.bw_server_text('updated.body', v_lang, v_vars) END;
    END IF;

  WHEN 'member_joined', 'member_left' THEN
    v_name := nullif(d ->> 'member_name', '');
    IF v_name IS NULL OR v_name = 'A member' THEN v_name := public.bw_server_text('a_member', v_lang); END IF;
    v_band := coalesce(nullif(d ->> 'band_name', ''), 'BandWith');
    v_vars := jsonb_build_object('name', v_name, 'band', v_band);
    IF NEW.type = 'member_joined' THEN
      v_head := public.bw_server_text('joined.title', v_lang, v_vars);
      v_body := public.bw_server_text('joined.body', v_lang, v_vars);
    ELSIF d ? 'member_user_id' THEN
      v_head := public.bw_server_text('left.title', v_lang, v_vars);
      v_body := public.bw_server_text(CASE WHEN (d ->> 'removed')::boolean IS TRUE THEN 'left.removed' ELSE 'left.body' END, v_lang, v_vars);
    ELSE
      -- To the person an admin removed.
      v_head := public.bw_server_text('removed_you.title', v_lang, v_vars);
      v_body := public.bw_server_text('removed_you.body', v_lang, v_vars);
    END IF;

  WHEN 'fee_changed' THEN
    v_head := public.bw_server_text('fee.title', v_lang);
    v_body := public.bw_server_text('fee.body', v_lang, jsonb_build_object(
      'title', v_title, 'when', v_when,
      'new', public.bw_i18n_amount((d ->> 'new_fee')::numeric, v_ev_currency, v_lang),
      'old', public.bw_i18n_amount((d ->> 'old_fee')::numeric, v_ev_currency, v_lang)));

  WHEN 'payment_received' THEN
    v_head := public.bw_server_text('payment.title', v_lang);
    IF d ? 'transaction_id' THEN
      -- To the admins: the amount and what it was for.
      SELECT t.title::text INTO v_tx_title FROM public.transactions t WHERE t.id = (d ->> 'transaction_id')::uuid;
      v_body := public.bw_i18n_amount((d ->> 'amount')::numeric, d ->> 'currency', v_lang)
                || ' · ' || coalesce(nullif(v_ev_title, ''), v_tx_title, '');
    ELSE
      v_body := public.bw_server_text('payment.lineup', v_lang, jsonb_build_object(
        'title', coalesce(nullif(v_ev_title, ''), public.bw_server_text('a_gig', v_lang))));
    END IF;

  WHEN 'setlist_updated' THEN
    v_head := public.bw_server_text('setlist.title', v_lang);
    v_body := public.bw_server_text('setlist.body', v_lang, jsonb_build_object('name', coalesce(nullif(d ->> 'setlist_name', ''), 'Setlist')));

  WHEN 'invite_received' THEN
    v_vars := jsonb_build_object('band', coalesce(nullif(d ->> 'band_name', ''), 'BandWith'));
    v_head := public.bw_server_text('invite.title', v_lang, v_vars);
    v_body := public.bw_server_text('invite.body', v_lang);

  ELSE
    RETURN NEW;
  END CASE;

  NEW.title := left(coalesce(v_head, NEW.title), 255);
  NEW.body := coalesce(v_body, NEW.body);
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Never lose a notification over its translation: keep the English.
  RAISE WARNING 'bw_trg_server_notification_text: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bw_trg_server_notification_text() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bw_notifications_server_text ON public.notifications;
CREATE TRIGGER bw_notifications_server_text
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type IN ('event_cancelled', 'event_confirmed', 'event_update', 'member_joined', 'member_left',
                     'fee_changed', 'payment_received', 'setlist_updated', 'invite_received'))
  EXECUTE FUNCTION public.bw_trg_server_notification_text();
