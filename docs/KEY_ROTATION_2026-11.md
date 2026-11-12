# Rotazione chiavi Supabase e Apple (G16)

Il repo è pubblico e la cronologia git contiene la vecchia service-role key, la chiave privata Sign in with Apple e la password degli account di test. Toglierle dai file non basta: vanno ruotate. Questa è la sequenza.

## 1. Nuove chiavi (dashboard)

1. Supabase → Settings → API Keys → **Publishable and secret API keys** → *Create new API keys*. Si creano `sb_publishable_…` e `sb_secret_…` con nome `default`. Le chiavi legacy continuano a funzionare.
2. Apple Developer → Keys: creare una nuova chiave Sign in with Apple e **revocare la vecchia** (Key ID nella cronologia di `scripts/generate-apple-secret.js`).
3. Generare il nuovo client secret, fuori dal repo:
   ```bash
   APPLE_TEAM_ID=… APPLE_KEY_ID=… APPLE_SERVICE_ID=… APPLE_P8_PATH=~/secure/AuthKey_XXXX.p8 node scripts/generate-apple-secret.js
   ```
   e incollarlo in Supabase → Auth → Providers → Apple. Il secret scade dopo 180 giorni.

## 2. App ed edge function (PR G16-A)

1. `.env` locale e variabili di Cloudflare Pages / Vercel: `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…`. `VITE_SUPABASE_ANON_KEY` non è più letto. **Prima del merge**, altrimenti il sito pubblicato resta senza chiave.
2. Edge function: leggono `SUPABASE_SECRET_KEYS` (fornita dalla piattaforma, chiave `default`). Tutte vanno deployate con `--no-verify-jwt`, perché il controllo del gateway capisce solo le chiavi JWT legacy; ogni funzione autorizza il chiamante nel codice (`_shared/auth.ts`).
   ```bash
   supabase functions deploy send-push send-email invite-member setup-invite-rls delete-account --no-verify-jwt
   ```
3. Migrazione `070_new_api_keys.sql` (dopo il deploy di send-email): il trigger email manda la chiave solo su `apikey`, mai su `Authorization`.
4. Vault: sostituire la chiave anon con la publishable (SQL editor):
   ```sql
   SELECT vault.update_secret(
     (SELECT id FROM vault.secrets WHERE name = 'bw_anon_key'),
     'sb_publishable_…'
   );
   ```
5. Nuove build iOS e Android con la publishable key, distribuite ai tester.

## 3. Spegnere le chiavi legacy

Solo quando le nuove build sono installate (le app vecchie usano ancora la chiave anon e smetteranno di funzionare):

1. Settings → API Keys → controllare *last used* delle chiavi legacy, poi **disattivarle** (reversibile).
2. Settings → JWT Keys → **Migrate JWT secret** (passa alle chiavi di firma asimmetriche).
3. Almeno 1h15 dopo (scadenza dei token già emessi più margine): **revocare il JWT secret legacy**. Da qui la vecchia service-role key della cronologia non vale più nulla.

Le chiavi legacy smettono comunque di funzionare a fine 2026.

## 4. Pulizia in produzione

- Eliminare gli account di test (`admin@bandwith.com`, `bandwith@example.com`, quelli di `user_create*.js`): la password è nella cronologia pubblica.
- Edge function presenti in produzione ma non nel repo, che usano ancora `SUPABASE_SERVICE_ROLE_KEY`: `make-server-c689d939` (morta), `create-checkout` e `stripe-webhook` (nessuna chiamata dall'app). Eliminarle o portarle nel repo con `SUPABASE_SECRET_KEYS` prima di spegnere le chiavi legacy:
  ```bash
  supabase functions delete make-server-c689d939
  ```

## Cronologia git

Non riscriviamo la cronologia (git filter-repo): il repo è già stato pubblico e clonabile, quindi i valori vanno considerati esposti comunque. La rotazione li rende inutili.
