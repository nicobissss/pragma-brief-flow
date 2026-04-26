## Piano operativo — Migliorie E2E (escluso accensione agenti)

In base ai risultati dell'audit, eseguo questi 4 step. **Niente** verrà attivato sui dati live (master_switch resta OFF).

---

### Step 1 — Migration sicurezza DB
**File**: `supabase/migrations/20260426_security_telemetry.sql`

- Aggiunge `SET search_path = public, pg_temp` alle 4 funzioni pgmq (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`) → risolve i 4 warning "Function Search Path Mutable".
- Esegue `REVOKE SELECT ... FROM anon` su 33 tabelle interne (clienti, prospect, kickoff, asset, ecc.) → risolve i 49 warning "pg_graphql Anon Role Exposes Objects". Tabelle pubbliche (`campaign_flows`, `campaigns`, `briefing_questions`, `email_unsubscribe_tokens`, `offering_templates`) restano accessibili dove serve via RLS.
- Crea funzione `record_agent_run(agent_key, status, cost_eur)` per la telemetria.

### Step 2 — Drenaggio eventi pending (data update)
- Una `UPDATE events SET processed = true WHERE processed = false` per chiudere i 15 eventi `prospect.*` legacy. Nessun consumer attivo li sta drenando, restano come rumore.
- (Non droppo la tabella per non rompere insert futuri da trigger; se vuoi la togliamo dopo.)

### Step 3 — Telemetria AI agents
**Nuovo file**: `supabase/functions/_shared/telemetry.ts` con `recordAgentRun(supabase, agentKey, status, costEur)` + `estimateCostEur(model, tokensIn, tokensOut)`.

Wiring in 6 edge function principali (success + error path):
- `qa-asset-review`
- `proposal-critique`
- `generate-master-asset`
- `generate-campaign-flow`
- `enrich-master-asset-brief`
- `feedback-loop-extract`

Risultato: dopo qualche run i campi `total_runs`, `last_run_status`, `last_run_at`, `total_cost_estimate_eur` di `ai_agent_settings` mostrano dati reali.

### Step 4 — Health dashboard `/admin/data`
Aggiungo in cima alla pagina `AdminDataDashboard.tsx` una sezione **"Salud del sistema"** con 4 card:
- **Eventos pendientes**: count da `events.processed = false`.
- **Cola de emails**: count `email_send_log` con `status='pending'` oltre 30 min.
- **Agentes IA**: tabella compatta con `agent_key`, ultimo run, status, costo totale (da `ai_agent_settings`).
- **Assets bloqueados**: count assets con `status='pending_review'` da > 7 giorni.

Inoltre fix bug minore: la query attuale a `tool_generations` fallisce silenziosamente perché la tabella non esiste — la rimuovo o sostituisco con `assets` recenti.

---

### Cosa NON tocco
- `master_switch` e tutti i 12 agent restano `enabled=false`.
- Nessun trigger AI viene attivato.
- Nessun cliente reale riceve email/notifiche.

Ti chiedo solo di approvare per procedere — la migration verrà mostrata in un blocco separato che potrai rivedere prima dell'apply.