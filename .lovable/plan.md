

# Sprint 5 — Fix critici + UX gravi + debito tecnico (escluso #6)

Implemento tutti i punti dell'audit precedente **tranne #6 (default_owner Nicolò/Karla)**.

## P1 — Fix critici

**1. `generate-proposal`: constraint UNIQUE su `proposals.prospect_id`**
- Migrazione SQL: `ALTER TABLE proposals ADD CONSTRAINT proposals_prospect_id_key UNIQUE (prospect_id)`
- Verifica preliminare: dedup eventuali righe duplicate prima di applicare

**2. `recommended_flow` salva nome commerciale, non codice**
- `generate-proposal`: salva `recommended_offering_name` in `recommended_flow` (retro-compat con UI legacy)
- Aggiungo nuova colonna `proposals.recommended_offering_code` per la chiave tecnica
- `generate-campaign-brief`: passa il nome commerciale al prompt

**3. Shim `getFlowForSubNiche` rimosso**
- Audit imports in tutti gli edge: `accept-prospect`, `generate-project-plan`, `generate-campaign-brief`, `analyze-kickoff-transcript`
- Sostituisco con lettura diretta da `offering_templates`

**4. Residui `pragma_flows` nella UI**
- Rimuovo query a `pragma_flows` da `AdminDataDashboard`, `OfferingRecommendationTab` (linked_flow_ids)
- DROP delle tabelle `pragma_flows`, `pragma_flow_types` e funzione `get_flow_with_details` (non più referenziate)

**5. Auto-creazione `client_offering` su `accept-prospect`**
- Quando admin accetta prospect, leggo `proposals.recommended_offering_code` 
- Trovo l'`offering_template` corrispondente
- Inserisco `client_offerings` con `status='proposed'` e `was_recommended=true`
- Genero automaticamente i task via `generate_tasks_for_offering()`

## P2 — Gravi UX (escluso #6)

**7. SLA / aging badges su offerte proposte**
- `OverviewTab` admin: badge "⚠ Propuesta enviada hace N días" se `client_offerings.status='proposed'` da > 5 giorni
- `AdminDashboard`: KPI "Propuestas abiertas" con count delle offerte ferme

**8. Notifica admin quando cliente completa task**
- Trigger DB `on_task_status_change`: insert in `activity_log` + invoca `send-notification` con tipo `task_completed`
- Aggiungo template email `task_completed` in `email_templates`

**9. Dedup "tools attivati"**
- `client_platforms` diventa l'unica source of truth
- Deprecate `clients.activated_tools` e `proposals.recommended_tools` per la lettura runtime
- Migrazione: copio dati esistenti da `activated_tools` → `client_platforms` se mancanti
- Aggiorno `ClientPlatformsPanel` e `OfferingDetails` per leggere solo da `client_platforms`

**10. `briefing_questions` e `kickoff_questions` in spagnolo**
- Migrazione UPDATE su questi due table per tradurre tutti i record IT esistenti in ES
- Mantengo `vertical='all'` per le domande generiche

**11. Auto-aggiornamento `clients.pipeline_status`**
- Trigger DB su `client_offerings.status`: 
  - `proposed` → `pipeline_status='kickoff'`
  - `active` + nessun asset → `'materiales'`
  - primo asset creato → `'producción'`
  - asset in pending_review → `'revisión'`
  - tutti asset approvati → `'completado'`

## P3 — Debito tecnico

**12. Rimuovo `proposals.pitch_suggestions` (text duplicato)**
- Migrazione DROP COLUMN
- Tutti i lettori passano a `full_proposal_content` (jsonb)

**13. Refactor "next action" in hook condiviso**
- Nuovo `src/hooks/useNextAction.ts` che ritorna `{label, href, severity}` dato `{client, offering, assets}`
- Usato da `OverviewTab` e `ClientDashboard` (con `audience: 'admin'|'client'`)

**14. `activity_log` completo**
- Nuovi trigger: 
  - `kickoff_briefs.pragma_approved=true` → "kickoff completed"
  - `client_offerings.status='active'` → "offering activated"
  - `action_plan_tasks.status='done' AND assignee='client'` → "client completed task X"
  - `tool_generations.status='content_ready'` → "campaign brief ready"

**15. Cleanup `tool_results` orfani**
- Migrazione: aggiungo FK `tool_results.generation_id REFERENCES tool_generations(id) ON DELETE CASCADE`
- Pulizia preliminare degli orfani esistenti

**16. Skip rate limit (vincolo piattaforma)**
- Non implemento rate limit su `generate-proposal` — il backend non ha primitive per farlo. Annotato per il futuro.

## File toccati (preview)

**Migrazioni SQL** (1 file unico):
- UNIQUE su `proposals.prospect_id`
- Nuove colonne: `proposals.recommended_offering_code`
- DROP: `pragma_flows`, `pragma_flow_types`, `proposals.pitch_suggestions`, funzione `get_flow_with_details`
- Nuovi trigger: `on_task_status_change`, `on_offering_status_change`, `on_kickoff_approved`, `on_tool_generation_ready`
- FK + cascade su `tool_results.generation_id`
- UPDATE traduzioni `briefing_questions` + `kickoff_questions`
- Template email `task_completed`

**Edge functions**:
- `accept-prospect/index.ts` — auto-crea `client_offering` + tasks
- `generate-proposal/index.ts` — salva nome commerciale + nuovo codice
- `generate-campaign-brief/index.ts` — passa nome commerciale
- `generate-project-plan/index.ts` — rimuove shim
- `analyze-kickoff-transcript/index.ts` — rimuove shim
- `_shared/strict-rules.ts` — rimuove definitivamente `getFlowForSubNiche`
- `send-notification/index.ts` — aggiunge case `task_completed`

**Frontend**:
- `src/hooks/useNextAction.ts` — nuovo hook condiviso
- `src/components/admin/tabs/OverviewTab.tsx` — usa hook + aging badges
- `src/pages/client/ClientDashboard.tsx` — usa hook
- `src/pages/admin/AdminDashboard.tsx` — KPI "Propuestas abiertas"
- `src/pages/admin/AdminDataDashboard.tsx` — rimuove riferimenti `pragma_flows`
- `src/components/admin/OfferingRecommendationTab.tsx` — rimuove `linked_flow_ids`
- `src/components/admin/ClientPlatformsPanel.tsx` — sola source of truth
- `src/components/shared/OfferingDetails.tsx` — legge da `client_platforms`

## Ordine di esecuzione

1. Migrazione SQL completa (tutte le modifiche schema in un'unica transazione)
2. Edge functions (rimozione shim → nessun deploy break)
3. Frontend (hook condiviso → componenti)
4. Verifica con un walkthrough manuale (prospect → accept → offering auto-creato → task → completion → notifica)

Nota: rate limit (#16) saltato per limite piattaforma. Default owner Nicolò/Karla (#6) escluso come da tua richiesta — i task resteranno con `assignee='admin'` generico.

