# Pacchetto Switch Contestuali Agenti IA

Estendo il sistema di controllo agenti con override per-cliente, badge visivi nei punti d'uso, e pulsanti "esegui ora" manuali. Risultato: visibilità completa di quando un agente è attivo/inattivo + possibilità di forzarlo on-demand senza riattivare il toggle globale.

## Cosa cambia per te (UX)

**1. Override per-cliente (`/admin/client/:id` → tab nuova "IA")**
- Pannello con i 6 agenti, ognuno con 3 stati: `Ereditato dal globale` (default) / `Forzato ON` / `Forzato OFF`.
- Esempio: master switch globale = OFF, ma per cliente X forzo QA Agent ON → solo i suoi asset vengono valutati.

**2. Badge stato agente nei punti d'uso**
- **Asset card** (in `/admin/client/:id` tab Assets): badge piccolo accanto ad ogni asset → "QA: ON" verde / "QA: OFF" grigio / "QA Score: 87" se già esiste un report.
- **Pulsante "Genera proposta"** (in `AdminProspectDetail`): sotto il bottone, riga "Critique IA: OFF — sarà generata senza revisione automatica" con link al pannello agenti.
- **Pulsante "Genera prompt"** (in `PromptsTab`): stessa logica per Briefer Enrichment.

**3. Pulsante "Esegui ora" manuale**
- Su ogni asset card senza QA report: bottone `🔍 Esegui QA ora` che chiama `qa-asset-review` direttamente (bypassa il check globale, sempre disponibile per admin).
- Su proposta generata: bottone `🤖 Critica con IA` (attivo solo quando Fase 2 sarà fatta — per ora mostro placeholder disabled "Disponibile in Fase 2").

## Cambi tecnici

**Database (1 migration):**
- Nuova colonna `clients.ai_agent_overrides JSONB DEFAULT '{}'` — formato `{"qa_asset_review": "on" | "off", ...}`. Chiavi assenti = ereditato.
- Aggiorno funzione SQL: `is_ai_agent_enabled_for_client(_agent_key, _client_id)` che controlla prima override, poi globale. Il trigger `invoke_qa_on_new_asset` userà questa nuova versione.
- Mantengo `is_ai_agent_enabled` per i casi senza cliente.

**Edge function `qa-asset-review`:**
- Aggiungo parametro `force: boolean` nel body. Se `force=true` (chiamata manuale da admin), bypassa il check di abilitazione. Verifica comunque che chi chiama sia admin via JWT.

**Frontend (4 file nuovi/modificati):**
- `src/components/admin/ClientAIAgentsPanel.tsx` (nuovo) — pannello override per-cliente, montato come nuova tab "IA" in `AdminClientDetail`.
- `src/components/admin/AIAgentBadge.tsx` (nuovo) — badge riusabile che legge stato effettivo (override + globale) via hook `useAgentStatus(agentKey, clientId?)`.
- `src/hooks/useAIAgentStatus.ts` (nuovo) — hook con cache che chiama RPC `is_ai_agent_enabled_for_client`.
- `src/components/admin/tabs/AssetsTab.tsx` — integra `AIAgentBadge` + bottone "Esegui QA ora" per asset.
- `src/pages/admin/AdminProspectDetail.tsx` — riga stato agente sotto "Generate Proposal".
- `src/components/admin/tabs/PromptsTab.tsx` — riga stato agente sotto "Genera prompt".

## Fuori scope (per ora)
- Cablaggio reale di Proposal Critique / Briefer Enrichment / Feedback Loop / Asset Variations → resta Fase 2-3 del piano. Mostro solo i badge "OFF — non implementato" per chiarezza.
- Storia/audit di chi ha cambiato gli override (può venire dopo).

## Stima costi
Zero impatto sui costi runtime: il sistema aggiunge solo controlli aggiuntivi per disabilitare. L'unica nuova chiamata IA possibile è il bottone manuale "Esegui QA ora", esplicitamente attivato dall'admin (~€0.002 per asset).
