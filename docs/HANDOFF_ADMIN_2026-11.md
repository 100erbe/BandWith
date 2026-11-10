# Passaggio di consegne — deploy dei fix di novembre 2026

Il codice è nel branch `fix/security-p0-ux-flows`, con la sua pull request. **Su Supabase non è ancora applicato nulla.** Chi ha accesso al progetto Supabase e alle chiavi deve fare i passaggi qui sotto, in quest'ordine.

Dettagli tecnici:
- [`SECURITY_FIXES_2026-11.md`](SECURITY_FIXES_2026-11.md): cosa è cambiato e perché;
- [`AUDIT_2026-11.md`](AUDIT_2026-11.md): l'audit completo.

## 0. Subito, a mano (prima del merge)

Queste azioni richiedono la dashboard e non dipendono dal merge.

1. **Ruotare la service-role key** del progetto `elvlzpowkohjbhxjasvd`. Era in chiaro in `scripts/run-migrations.js`, che è pubblico su GitHub, e resta nella cronologia git.
   - Percorso: Dashboard → Project Settings → API (o JWT Keys).
   - Se si ruota il JWT secret legacy cambia anche la anon key: aggiornare `.env`, le variabili di build e le app.
   - Le anon key presenti negli script vecchi sono pubbliche per natura, quindi non è grave, ma vanno comunque ruotate insieme.
2. **Eliminare la edge function `admin-sql`**: esegue SQL arbitrario senza autenticazione.
   ```bash
   supabase functions delete admin-sql --project-ref <ref>
   ```
3. **Cambiare la password o eliminare gli account di test** creati dagli script (`admin@bandwith.com`, `bandwith@example.com`, quelli di `user_create*.js`). Usavano tutti la stessa password, ora pubblica.
4. Controllare nei log di Supabase (API, Auth, edge function `admin-sql`) se ci sono accessi sospetti dalla data del primo push.

## 1. Prompt per Claude Code

Da incollare in Claude Code dentro il clone del repo, sulla macchina con la Supabase CLI già collegata:

```text
Sei nel repo BandWith (React + Vite + Capacitor, backend Supabase). Nel branch
fix/security-p0-ux-flows ci sono fix di sicurezza, bug P0 e flussi UX che vanno
portati su Supabase. Leggi prima docs/HANDOFF_ADMIN_2026-11.md e
docs/SECURITY_FIXES_2026-11.md.

Regole:
- Non applicare nulla al progetto di produzione senza chiedermi conferma
  esplicita, passo per passo. Prima usa un branch Supabase o un progetto di
  staging.
- Non stampare chiavi, password o stringhe di connessione nell'output.
- Se lo schema reale è diverso da quello che le migrazioni si aspettano,
  fermati e dimmelo invece di "aggiustare" le migrazioni da solo.

Passi:
1. git fetch && git checkout fix/security-p0-ux-flows. Esegui npm ci,
   npm run typecheck, npx vitest run e npm run build. Riportami l'esito.
2. Capisci quale progetto Supabase è la produzione: supabase/config.toml dice
   oakhbfdhesktokscqxqo, i vecchi script usavano elvlzpowkohjbhxjasvd.
   Confrontali con `supabase projects list` e con le variabili di build
   dell'app, poi dimmelo.
3. Su staging o su un branch Supabase, confronta lo schema reale con quello
   che le migrazioni 042–045 si aspettano. In particolare:
   - tabelle band_members (unique band_id,user_id, colonne is_active,
     left_at, role), band_invitations (token, created_at, expires_at),
     bands.description, profiles.user_mode, profiles.sub_tier;
   - esistenza della vecchia tabella `invitations`;
   - funzione exec_sql;
   - policy esistenti su band_members, events, chats, notifications, quotes
     e storage.objects.
   - Verifica anche come fa oggi un utente che crea una band a inserirsi come
     admin in band_members (trigger? policy?), perché la 042 restringe le
     policy.
4. Sempre su staging, applica in ordine 042_security_hardening,
   043_quote_numbering, 044_band_invite_acceptance e 045_account_deletion.
   Riporta tutte le NOTICE: la 042 elenca le tabelle rimaste senza RLS.
   Poi lancia gli Advisors di sicurezza e performance.
5. Deploya su staging le edge function setup-invite-rls, invite-member,
   send-push, send-email e delete-account. Imposta i secret APP_URL (URL
   pubblico della web app) e, se serve, EMAIL_ALLOWED_LINK_HOSTS. Verifica
   che i secret già usati da send-email/send-push (provider email, FCM)
   esistano. Elimina admin-sql se c'è ancora.
6. In Auth → URL Configuration aggiungi i redirect
   com.bandwith.app://auth/callback, app.bandwith.mobile://auth/callback e
   https://<dominio-web>/auth/callback.
7. Smoke test su staging con 2-3 account di test creati apposta, con password
   nuove che NON vanno nel repo:
   a. registrazione, login, reset password (link email → schermata
      "Set a new password");
   b. creazione band dall'onboarding e da utente "solo" (1 band gratis);
   c. admin invita un'email nuova: arriva l'email con /?invite=<token>,
      l'invitato si registra e fa "Join";
   d. admin invita un utente esistente: lui vede la card "Join / Decline";
   e. un codice scaduto o un'email diversa danno un errore chiaro;
   f. creazione evento, modifica fee da un non-admin (deve fallire), chat,
      notifiche push;
   g. preventivo: creazione, numero BW-YYYY-NNNN, PDF;
   h. Settings → Privacy & account → Delete account, anche nel caso di
      unico admin con altri membri (deve rifiutare).
   Per ogni punto dimmi ok / ko con l'errore.
8. Se va tutto bene, preparami l'elenco esatto dei comandi per la produzione
   (db push, deploy funzioni, secret, delete admin-sql) e aspetta il mio ok
   prima di eseguirli.
9. Dopo il deploy in produzione: ricontrolla gli Advisors, fai uno smoke test
   rapido dei punti a, c, f e dimmi se posso fare il merge della PR.
```

## 2. Dopo il deploy

- Fare il merge della PR solo dopo che le migrazioni e le funzioni sono in produzione. L'app nuova chiama RPC (`bw_preview_invitation`, `bw_accept_invitation`, …) che senza la 044 non esistono.
- Build native di rilascio senza `CAP_DEBUG`. Per le build di sviluppo:
  ```bash
  CAP_DEBUG=true npx cap sync
  ```
- Link d'invito su mobile: configurare gli Universal Link (iOS) e gli App Link (Android) per `https://<dominio-web>/?invite=…`, oppure lo schema `com.bandwith.app://invite?invite=<token>`.

## 3. Rimasto aperto (non urgente)

- Dati bancari della band (`bank_iban`, `tax_vat_id`) leggibili da tutti i membri.
- Bucket `band-branding` non definito nelle migrazioni.
- IVA di default al 21% in `pricing.ts` (in Italia è il 22%).
- Pagamenti reali per i piani multi-band: oggi i piani a pagamento mostrano "Coming soon".
