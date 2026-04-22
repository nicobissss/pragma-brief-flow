

# Piano revisionato — fix onboarding + notifiche email

## 1. Onboarding sicuro (semplice)

- `accept-prospect` e `create-user`: rimuoviamo password hardcoded `Pragma2026!`
- Generiamo password random (32 caratteri) server-side
- Mandiamo al cliente email di benvenuto con **link "Imposta la tua password"** (Supabase recovery link)
- Niente flag forzato di cambio password — il link nell'email è sufficiente per il primo accesso

## 2. Trigger email cablati (look & feel Pragma: cream #F5F2EC + blue #7BB8D4)

Creiamo i seguenti template React Email in `_shared/transactional-email-templates/` e li registriamo nel `registry.ts`. Tutti in spagnolo, branding Pragma.

| Evento | Destinatario | Template |
|---|---|---|
| Cliente accettato (in `accept-prospect`) | cliente | `client-welcome` (con link set-password) |
| Asset caricato pronto per review (in `AssetUploadZone` admin) | cliente | `asset-ready-for-review` |
| Feedback / change request (in `AssetFeedbackPanel` cliente) | tutti gli admin | `asset-feedback-received` |
| Asset approvato (in `ClientAssetReview`) | tutti gli admin | `asset-approved` |
| Nuovo prospect (in `briefing-submitted` flow / webhook-receiver) | tutti gli admin | `new-prospect-received` |
| Task completato dal cliente | tutti gli admin | `client-task-completed` |

Destinatari admin: lista hardcoded inizialmente (`dev@pragmarketers.com`) — semplice, modificabile in seguito quando vorrai aggiungere altri admin.

Ogni invio passa attraverso `send-transactional-email` con `idempotencyKey` derivata dall'ID dell'evento per evitare duplicati.

## 3. Telemetria discovery (utile, leggera)

- Aggiungere `activity_log` entries nelle 3 edge functions discovery: `analyze-local-competitors`, `analyze-winning-patterns`, `extract-voice-of-customer`
- Notifica admin via email quando una discovery completa (template `discovery-analysis-ready`)
- Nuova colonna `context_score_at_generation int` su `tool_generations`, popolata in `generate-campaign-brief` e `generate-kickoff-prompts`

## Note tecniche

- I template usano i colori già scaffoldati negli auth emails (`#F5F2EC` background container, `#7BB8D4` bottoni, body bianco come da regola). Riuso degli stili esistenti per consistenza.
- Email partiranno realmente solo quando DNS sarà verificato — finché no, restano in coda (TTL 60 min). Nessun lavoro sprecato.
- Migrazione SQL minima: solo `ALTER TABLE tool_generations ADD COLUMN context_score_at_generation int`.
- Nessuna modifica a `clients` (no `owner_admin_id`) né a `user_metadata` (no `must_change_password`).

## Ordine di esecuzione

1. Migrazione: `tool_generations.context_score_at_generation`
2. Refactor `accept-prospect` + `create-user` (random password + welcome email via send-transactional-email)
3. Creare 7 template transazionali + registrarli in `registry.ts`
4. Cablare i trigger nei punti del codice (5 punti UI/edge)
5. Aggiungere log activity + notifica nelle 3 discovery functions
6. Loggare context score nelle 2 generation functions
7. Deploy edge functions

