

# Connessione Forge ↔ questo progetto (Briefer)

Forge resta **separato** (come deciso). Lo agganciamo a questo progetto via webhook + chiamate dirette al DB con service role, così tu mantieni il briefer leggero e Forge fa solo generazione.

## Architettura

```text
   ┌─────────────┐    1. legge brief         ┌──────────────┐
   │             │ ────────────────────────▶ │              │
   │   FORGE     │                           │   BRIEFER    │
   │ (generator) │ ◀──────────────────────── │  (questo)    │
   │             │  2. POST asset_generated  │              │
   └─────────────┘                           └──────────────┘
        │                                          │
        │ usa SERVICE_ROLE_KEY                     │ webhook-receiver
        │ (passato come secret in Forge)           │ valida x-pragma-secret
        ▼                                          ▼
   legge: clients,                            scrive: assets
   kickoff_briefs,                            (status=pending_review)
   campaigns,
   client_offerings
```

## Cosa cambia in **questo progetto** (Briefer)

1. **Estendere `webhook-receiver`** con una nuova action `asset_generated` che accetta:
   - `client_id`, `campaign_id` (opz.), `asset_name`, `asset_type`, `content` (jsonb), `preview_url`, `file_url`
   - Inserisce riga in `assets` con `status = 'pending_review'`, `version = 1`
   - Logga in `webhook_log` (già fa)
2. **Nessuna migrazione DB** necessaria — la tabella `assets` ha già tutti i campi.
3. **Documentare il contratto**: aggiungere `mem://architecture/integration-system` la nuova action.

## Cosa va fatto in **Forge** (separatamente, quando lo apri)

Te lo elenco così sai cosa toccare lì — non lo faccio io ora perché è un altro progetto:

1. Aggiungere come secret in Forge: `BRIEFER_SUPABASE_URL`, `BRIEFER_SERVICE_ROLE_KEY`, `BRIEFER_WEBHOOK_SECRET` (quest'ultimo già esiste qui)
2. Sostituire le query alle tabelle inesistenti (`client_briefs`, `pragma_flows`, `generated_assets`) con quelle reali (`clients`, `kickoff_briefs`, `campaigns`, `client_offerings`)
3. Sostituire il placeholder `callGeneration()` con vera chiamata Claude/Lovable AI
4. A fine generazione → `POST {BRIEFER_URL}/functions/v1/webhook-receiver` con header `x-pragma-secret` e `{ action: "asset_generated", ... }`

## Sicurezza

- Forge **non** usa anon key — usa service role (server-side, mai esposta al browser di Forge)
- Webhook protetto da `x-pragma-secret` (già implementato)
- RLS resta intatta su `assets`: client vede solo i suoi via `user_id`

## Test end-to-end (dopo deploy)

Test manuale con `curl` al `webhook-receiver` simulando Forge per verificare che l'asset compaia in `/admin/clients/[id]` come "pending_review".

## Out of scope (per ora)

- Retry automatico se webhook fallisce (Forge dovrà gestirlo lato suo)
- UI in Briefer per "trigger generation in Forge" (oggi Forge parte autonomamente)
- Migrazione contenuti già esistenti

---

**Effort qui:** ~15 min (solo estensione `webhook-receiver`). Su Forge è lavoro tuo separato — ti lascio il contratto pronto.

