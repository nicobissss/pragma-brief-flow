

# Sprint 4 — Allineamento operativo Tier 1/2/3

## Problemi rilevati (analisi operativa)

1. **`pragma_flows` contiene 15 flow legacy attivi** (es. "E-Learning Webinar 30-day", "Salud 10-step") che contraddicono il catalogo Tier 1/2/3. L'AI può ancora pescarli.
2. **Knowledge base in italiano, app/output in spagnolo** → output incoerenti per i clienti.
3. **`generate-proposal` system prompt** parla ancora di Tipo A/B, commission %, retainer ranges → modello vecchio. Non cita i Tier.
4. **Nessun ponte fra `offering_templates` e generate-proposal**: la proposta non legge il catalogo nuovo.
5. **Operativo mancante**: nessun owner di default sui task, nessun flag su offerte ferme in `proposed`, nessuna stima durata fra `proposed → active`.

## Domande prima di procedere

Prima di scrivere codice ho bisogno di 3 decisioni:

---

**Q1 — Lingua knowledge base e output AI**
Knowledge base oggi è in italiano, ma proposte/email/asset vanno al cliente in spagnolo (mercati ES/AR) o italiano (IT).

- A) Tengo KB in italiano (uso interno) e l'AI traduce in spagnolo/italiano in base al `market` del cliente
- B) Riscrivo KB in spagnolo (lingua dominante dei clienti, IT minoritari)
- C) KB bilingue: blocchi paralleli IT/ES

**Q2 — Flow legacy in `pragma_flows`**
15 flow vecchi sono ancora attivi e leggibili dall'AI.

- A) Disattivare tutti (`is_active=false`) e lasciarli archiviati
- B) Eliminarli del tutto
- C) Mapparli ai nuovi Tier (es. "Reactivación Pacientes" → TIER1_RECUPERACION) e disattivare il resto

**Q3 — Proposta AI: cosa deve generare oggi**
La proposta legacy include hook di chiamata, journey narrative, obiezioni, copy spunti. Oggi col modello Tier 1/2/3 questa struttura serve ancora?

- A) Sì identica, ma agganciata al Tier raccomandato (mantieni call prep completo)
- B) Versione snella: solo Tier raccomandato + 3 ragioni + script prezzo + 3 domande qualifica
- C) Doppio output: snello in UI + completo scaricabile

---

## Piano di lavoro (dopo le risposte)

### Fase 1 — Pulizia knowledge & flow legacy
- Migrazione SQL: disattiva/elimina/mappa `pragma_flows` legacy (per Q2)
- Aggiorna `knowledge_base` secondo Q1
- Rimuovi sezione "Flows" dal tab `FlowsRulesTab` se decidiamo che `offering_templates` è l'unica fonte di verità → il tab diventa solo "Reglas globales" + "Tools"

### Fase 2 — Riscrivi `generate-proposal`
- System prompt allineato a Tier 1/2/3, no più Tipo A/B
- Legge offerte da `offering_templates` (non più hardcoded)
- Output per Q3: snello / completo / entrambi
- Salva `proposal.recommended_offering_code` (nuova chiave) per linkare alla raccomandazione

### Fase 3 — Migliorie operative
- **Default owner sui task**: aggiungere campo `default_owner` (Nicolò / Karla / cliente) nei `task_templates` di ogni offering, così quando si genera il plan i task hanno già un assignee reale
- **SLA / aging**: badge "⚠ Propuesta enviada hace 5 días" su `client_offerings.status='proposed'` da > N giorni nell'OverviewTab dell'admin
- **Quick stats Overview**: aggiungere "Offerte proposte aperte" nel `AdminDashboard.tsx` come KPI top
- **Filter offering recommendations**: la `OfferingRecommendationTab` oggi mostra top 3 — aggiungere filtro per Tier (Quick Win / Retainer / One-shot) per scelta consapevole admin
- **Plan de Acción**: bulk action "Asigna a Nicolò" / "Asigna a Karla" sui task selezionati
- **Visibilità cliente**: ricontrollo `ClientDashboard` + `OfferingDetails` per garantire che mai compaia `monthly_fee_eur`, `setup_hours_estimate`, `monthly_hours_estimate`

### Fase 4 — Allineamento `generate-campaign-brief` e altri edge
- Tutti gli edge che importano `getFlowForSubNiche` → leggono direttamente `offering_templates` invece dello shim
- Rimozione shim deprecato

## File toccati (preview)

- `supabase/migrations/<new>.sql` — pulizia flows + KB
- `supabase/functions/generate-proposal/index.ts` — riscrittura prompt + lettura offerte
- `supabase/functions/generate-campaign-brief/index.ts` — riscrittura prompt
- `supabase/functions/_shared/strict-rules.ts` — rimuovi shim
- `src/components/admin/FlowsRulesTab.tsx` — eventuale rimozione sezione Flows
- `src/components/admin/OfferingRecommendationTab.tsx` — filtro per Tier + aging badge
- `src/components/admin/ActionPlanTab.tsx` — bulk assign + default_owner
- `src/components/admin/OfferingsCatalogTab.tsx` — campo `default_owner` nel form task
- `src/pages/admin/AdminDashboard.tsx` — KPI "Propuestas abiertas"

Rispondi a Q1/Q2/Q3 e parto.

