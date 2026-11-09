# Fix sicurezza + bug P0 — novembre 2026

Le correzioni sono nel codice, ma **nulla è ancora stato applicato su Supabase né sugli store**. Ecco cosa fare, in ordine.

## 1. Azioni urgenti da fare a mano (non automatizzabili)

1. **Ruotare la service-role key del progetto `elvlzpowkohjbhxjasvd`**: era scritta in chiaro in `scripts/run-migrations.js`, che è **pubblico su GitHub** (repo `100erbe/BandWith`). Dà accesso totale al DB e scade nel 2036. Toglierla dai file non basta, perché resta nella cronologia git: va ruotata subito. Dashboard → Project Settings → API → *Generate new JWT secret*. Questa operazione invalida anche la chiave anon, quindi aggiorna `.env` e le app.
2. **Cambiare la password o eliminare gli account di test** `admin@bandwith.com`, `bandwith@example.com` e quelli creati da `user_create*.js`: usavano tutti la stessa password scritta negli script.
3. **Eliminare la edge function `admin-sql`** dal progetto (SQL arbitrario senza autenticazione). Toglierla dal repo non basta:
   ```bash
   supabase functions delete admin-sql
   ```
4. Verificare quale sia il progetto di produzione: `supabase/config.toml` punta a `oakhbfdhesktokscqxqo`, mentre gli script puntavano a `elvlzpowkohjbhxjasvd`.

## 2. Applicare al database (prima su un branch o in staging)

```bash
supabase db push   # applica 042_security_hardening.sql e 043_quote_numbering.sql
```
Poi controllare **Database → Advisors → Security**. La migrazione 042 segnala con un `NOTICE` le tabelle rimaste senza RLS perché non hanno policy (es. `invitations`): vanno sistemate a mano.

## 3. Rideployare le edge function

```bash
supabase functions deploy setup-invite-rls invite-member send-push send-email
```
Variabili consigliate (`supabase secrets set …`): `APP_URL` (dominio dell'app, usato per i link nelle email e per il redirect degli inviti) ed eventualmente `EMAIL_ALLOWED_LINK_HOSTS`.

## 4. Configurare l'autenticazione (PKCE)

Auth → URL Configuration → **Redirect URLs**: aggiungere
- `com.bandwith.app://auth/callback` (Android)
- `app.bandwith.mobile://auth/callback` (iOS)
- `https://<dominio-web>/auth/callback`

## 5. Build native

Le build di rilascio ora hanno il debug della WebView e il mixed content **disattivati**. Per una build di sviluppo:
```bash
CAP_DEBUG=true npx cap sync
```

## Cosa è cambiato

| Area | Correzione |
|---|---|
| `setup-invite-rls` | Resta solo `lookup_invites`: minimale, senza token e con rate limit. Rimosse le 11 azioni admin e di debug. |
| `invite-member` | Il chiamante deve essere admin attivo della band. Ricerca utente per email (niente limite dei 50 utenti). Agli utenti esistenti arriva un invito, non vengono più aggiunti alla band senza consenso. |
| `send-push` | `verify_jwt = true` + utente reale. Si notifica solo chi condivide una band o una chat con il mittente. Limiti di lunghezza. |
| `send-email` | Utente reale, admin della band per gli inviti, escape HTML, link solo verso domini consentiti, nome della band letto dal DB. |
| `admin-sql` | Rimossa (e `exec_sql` eliminata dalla migrazione 042). |
| Migrazione 042 | RLS riattivata su tutte le tabelle con policy. Inviti non più leggibili da tutti. Creazione chat e partecipanti solo per utenti idonei. Notifiche solo verso band o chat condivise. `get_user_chats` limitata al chiamante. Update eventi solo per admin o creatore. Fee e ruolo in `event_members` modificabili solo dagli admin. Preventivi visibili solo agli admin. Storage: PDF scrivibili solo dagli admin della band, avatar solo nella propria cartella, niente listing. |
| Migrazione 043 | Numerazione preventivi atomica per band (`BW-YYYY-NNNN`) e vincolo univoco `(band_id, quote_number)`. |
| Auth | PKCE al posto di *implicit*. I token nel fragment dell'URL non vengono più accettati. Listener del deep link rimosso correttamente. Il reset password funziona anche su nativo, con una nuova schermata "Set a new password". |
| Capacitor | `webContentsDebuggingEnabled` / `allowMixedContent` solo con `CAP_DEBUG=true`. |
| Script | Chiavi e password sostituite con variabili d'ambiente. `utils/supabase/info.tsx` rimosso. `src/db/master_schema.sql` in quarantena: si blocca se viene eseguito. |
| Bug app | `saveEventOffline` (ReferenceError). Pulsante "Create event" dello stato vuoto. `notif.data` undefined. Date in UTC → data locale (`src/lib/dates.ts`). Realtime notifiche filtrato per utente + `removeChannel`. |
| Coda offline | Nessuna perdita di modifiche. Coda separata per utente e svuotata al logout. Massimo 5 tentativi. Creazioni idempotenti (UUID generato dal client). |
| Preventivi | La card Preventivi usa il DB reale. Calcoli IVA e sconto corretti e condivisi tra schermo e PDF (`quoteMath.ts`). Il numero del preventivo viene solo dal DB, quindi PDF e DB coincidono. Gli errori di salvataggio vengono mostrati. Se fallisce l'inserimento dei musicisti, il preventivo viene annullato. PDF salvati con percorso non indovinabile. |
| Build | `npm run build` esegue prima `tsc --noEmit`. |

## Rimasto aperto (non incluso in questo giro)

- **Dati bancari della band** (`bank_iban`, `tax_vat_id`) ancora leggibili da tutti i membri. Serve una tabella separata solo-admin, e cambiano le query su `bands`.
- **Bucket `band-branding`**: nessuna migrazione lo definisce. Va verificato in dashboard.
- **Tabella `invitations`**: nessuna policy. Va unificata con `band_invitations` (vedi audit, punto D1).
- **IVA di default al 21%** in `pricing.ts` (`DEFAULT_BAND_PRICING`): in Italia è il 22%.
- I **preventivi vecchi** salvati senza aliquota ora vengono ricalcolati al 22% (default del DB) in dettaglio e PDF, quindi possono differire dal totale salvato.
- ~~Flussi UX bloccanti (U1, U2, U4)~~ → risolti nel secondo giro, vedi sotto.

---

# Flussi UX bloccanti (U1, U2, U4) — secondo giro

## Da applicare

```bash
supabase db push        # 044_band_invite_acceptance.sql, 045_account_deletion.sql
supabase functions deploy invite-member delete-account
supabase secrets set APP_URL=https://<dominio-web>   # serve per i link d'invito
```
Per i link d'invito su nativo, il deep link deve aprire l'app con `?invite=<token>` (es. `com.bandwith.app://invite?invite=<token>`): va aggiunto l'intent filter / Universal Link per `https://<dominio-web>/?invite=…`.

## U1 — Entrare in una band con un invito

| Prima | Ora |
|---|---|
| Un codice valido apriva il flusso "crea band". Nessun errore per codici sbagliati. | Codice o link incollato → anteprima della band → account → profilo → **Join**. Errori chiari (codice non valido, scaduto, email diversa). |
| L'app si inseriva da sola in `band_members` (bloccato dalle policy, e insicuro). | `bw_accept_invitation` (SECURITY DEFINER) controlla che l'email dell'invito sia quella dell'account e aggiunge il membro. |
| Due tabelle (`invitations`, `band_invitations`). | Solo `band_invitations`; le righe pendenti della vecchia tabella vengono copiate. |
| `?invite=` mai letto; `inviteUserByEmail` metteva la sessione nel fragment (rifiutato col PKCE). | Il link `/?invite=<token>` apre l'anteprima; l'email la manda l'app con `send-email`. |
| Dalla schermata Membri gli utenti esistenti venivano aggiunti senza consenso. | Ricevono un invito: card "Join / Decline" all'apertura dell'app (anche durante l'onboarding). |
| "Andrea, Drums" finto nella schermata di benvenuto. | Solo dati reali (chi ti ha invitato, numero di membri). |

## U2 — Impostazioni e cancellazione account

- Nuova voce **Settings & Account** nel pannello profilo; le Impostazioni hanno un menu di sezioni.
- **Delete account** prima faceva solo il logout. Ora chiede di digitare `DELETE` e chiama la edge function `delete-account`, che:
  1. rifiuta se sei l'unico admin di una band con altri membri (dice quali);
  2. elimina le band in cui sei l'unico membro;
  3. ripulisce i riferimenti (`045`);
  4. cancella l'utente.

## U4 — Upgrade

Non esiste un sistema di pagamento, quindi:
- tutti possono gestire **1 band gratis**, come promette il piano Indie Act; prima solo/member avevano limite 0 e finivano su un paywall morto;
- i piani a pagamento mostrano **"Coming soon"** al posto di un pulsante che non faceva nulla;
- "Upgrade to Band Admin" nel form del gig personale diventa **"Create a free band"** e apre la creazione band sopra il form, senza perdere i dati.

Quando arriveranno i pagamenti (StoreKit / Play Billing, o Stripe sul web) basta sostituire il blocco "Coming soon" in `UpgradePricingSheet.tsx`.
