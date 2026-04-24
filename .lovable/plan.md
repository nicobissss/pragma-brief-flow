# Review AI: Cosa abbiamo, cosa manca

## 1. Mappa di cosa già fa l'AI oggi

**Pre-vendita / Briefer**
- `generate-proposal` — propuesta + pricing
- `analyze-local-competitors`, `analyze-winning-patterns`, `extract-voice-of-customer`
- `fetch-website-context`, `extract-pdf-text`

**Onboarding / Kickoff**
- `analyze-kickoff-transcript`, `generate-kickoff-prompts`, `generate-campaign-brief`, `generate-project-plan`, `suggest-client-rule`

**Produzione / Revisione**
- `generate-asset-internal`, `generate-correction-prompt`, `select-campaign-materials`, `trigger-forge-generation`

**Strategico**
- `generate-monthly-review`

**Verdetto:** copertura buona sui flussi generativi. Gap su **QA pre-consegna**, **loop di apprendimento**, **proattività briefer**.

---

## 2. Nuovi agenti proposti

### A. QA Agent sugli asset — PRIORITÀ ALTA
Edge function `qa-asset-review` che gira a ogni nuovo asset con score 0-100 + flag su:
- Brand consistency (colori, tone, voice_reference)
- Client rules compliance
- Brief alignment
- Errori oggettivi (typo, CTA, dimensioni)
- Approvazione predetta da `analyze-winning-patterns`

UI in `AssetReviewPanel`: "AI QA: 87/100 — 2 warning". Score <60 → blocco automatico in `internal_review`.
**Trigger:** automatico su INSERT in `assets`. **Toggle:** on/off globale.

### B. Pre-mortem proposta — PRIORITÀ ALTA
`critique-proposal` che produce:
- Obiezioni anticipate + rebuttal
- Coerenza pricing vs storico
- Elementi mancanti vs winning patterns
- Buchi nel customer journey

Output nella sezione **Call Preparation**. **Trigger:** manuale (bottone) o automatico post `generate-proposal`. **Toggle:** on/off + auto/manuale.

### C. Briefer auto-enrichment + qualification score — PRIORITÀ MEDIA
Post-submit briefing: scrape sito + competitor + voice + 3-5 smart questions via email. AI qualification score 0-100 per prioritizzare call queue.
**Trigger:** automatico su nuovo prospect. **Toggle:** on/off.

### D. Feedback Loop settimanale — PRIORITÀ MEDIA
`learn-from-rejections`: analizza `change_requested` settimanali per cliente, trova pattern, aggiorna `client_rules` come pendenti.
**Trigger:** cron settimanale. **Toggle:** on/off + skip se 0 nuovi feedback nella settimana.

### E. Admin conversational assistant — PRIORITÀ MEDIA
Chat in `/admin` con tool-calling sul DB (query, drafting, summary, action).
**Trigger:** on-demand. **Toggle:** on/off (feature flag UI).

### F. Asset variation generator — PRIORITÀ BASSA
Su asset approvato propone 2-3 varianti (formato/hook/A-B).
**Trigger:** automatico su approvazione. **Toggle:** on/off.

---

## 3. Sistema di controllo agenti AI (NUOVO)

Per evitare consumi indesiderati (es. periodi senza clienti attivi), aggiungere un **AI Agents Control Panel** in `/admin/settings`:

- Tabella `ai_agent_settings` (key, enabled, config JSONB, last_run_at, last_cost_estimate)
- Riga per ogni agente automatico/ricorrente: `qa_asset_review`, `critique_proposal`, `briefer_enrichment`, `feedback_loop_weekly`, `admin_assistant`, `asset_variations`
- UI: tab **"Agentes IA"** con toggle on/off per ognuno + descrizione + costo stimato + ultima esecuzione
- **Master switch globale** "Pausa todos los agentes IA" in cima (utile per periodi morti / debug)
- Cron job e edge function controllano `enabled` prima di girare (return early se off)
- Default per i nuovi agenti: **OFF** (l'admin attiva quando ha clienti / vuole usare la feature)

**Beneficio:** zero spese AI involontarie + visibilità costi + facile A/B (attivo solo per X settimane per misurare impatto).

---

## 4. Priorizzazione consigliata

**Fase 1 — Infrastruttura + impatto immediato:**
1. **AI Agents Control Panel** (toggle + tabella settings) → prerequisito per tutto il resto
2. **QA Agent sugli asset** (con toggle attivabile)

**Fase 2:**
3. Pre-mortem proposta
4. Feedback Loop settimanale

**Fase 3:**
5. Briefer auto-enrichment
6. Admin conversational assistant
7. Asset variation generator

---

## 5. Note tecniche

- Tutti gli agenti via `_shared/ai.ts` su Lovable AI Gateway
- Modelli economici di default (`gemini-2.5-flash`), Pro solo dove serve reasoning multimodale (QA visivo asset)
- Cron via `pg_cron` + `pg_net` per `feedback_loop_weekly`
- Tabelle dedicate per output: `asset_qa_reports`, `proposal_critiques`, `learning_reports`
- Ogni edge function logga token_usage in `tool_generations` per monitoring costi reali

---

## 6. Domanda

Confermi che parto con **Fase 1** (Control Panel + QA Agent)? Oppure vuoi attaccare prima solo il Control Panel da solo (più piccolo, sblocca il resto)?