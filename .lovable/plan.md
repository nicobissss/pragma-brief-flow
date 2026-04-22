

# Sprint 6 — Discovery & Insight Layer (final, revised)

## Focus chiave
- Domande **adattive per vertical/sub_niche** (briefing pre-call + kickoff)
- Connettori Lovable per servizi esterni
- Client Bible web-first, no PDF (rinviato)
- Prerequisiti schema risolti prima di costruire features

---

## Fase 0 — Prerequisiti schema (DA FARE PRIMA DI TUTTO)

Migrazione SQL:
- `clients`: aggiungo `city text`, `website_url text` (necessari per VoC + competitor)
- `kickoff_questions`: aggiungo `vertical text`, `sub_niche text` (oggi mancano)
- Nuova tabella `kickoff_question_templates` (master per vertical) — clonata in `kickoff_questions` al `accept-prospect`
- `client_context_snapshots.snapshot_type`: CHECK constraint con valori ammessi (`'voc'`, `'competitor'`, `'winning_pattern'`, `'kickoff_summary'`)
- Deprecazione formale `clients.activated_tools` → migrazione dati residui in `client_platforms` + commento "DEPRECATED, use client_platforms"
- Nuove tabelle: `client_competitor_analyses`, `client_winning_patterns`, `vertical_pattern_suggestions` (come da piano precedente)
- Seed `briefing_questions` e `kickoff_question_templates` per `salud_estetica/clinica_estetica`, `salud_estetica/dentista`, `e_learning`, `deporte_offline/gimnasio`

---

## Fase 1 — Connettori Lovable

Attivo via `standard_connectors--connect`:
- **Firecrawl** (direct API, Free 500 crediti/mese) → competitor scraping
- **Perplexity** (direct API, ~$0.02/cliente) → VoC mining + review locali

Le edge function useranno `Deno.env.get('FIRECRAWL_API_KEY')` e `Deno.env.get('PERPLEXITY_API_KEY')`. Niente API key manuali.

Fallback per VoC se Perplexity non connesso: textarea "incolla review" → Claude analizza (zero costi extra).

---

## Fase 2 — Client Bible View

**Route**: `/admin/clients/:id/bible` — pagina full-width.
Bottone "📖 Client Bible" in `AdminClientDetail` header.

Sezioni con **freshness indicator** (ultima update + ⚠️ se > 60gg):
1. Identità + Pipeline + Pre-cualificación
2. Briefing & Kickoff (transcript summary, voice, tono)
3. **Cliente reale (VoC)** — JTBD, obiezioni, frasi reali
4. **Competitor locales** — gap di posizionamento
5. **Winning patterns** (opzionale, se presenti)
6. Reglas attive + suggested patterns
7. Materiales + Platforms (solo `client_platforms`, non `activated_tools`)
8. Offerings & Action Plan
9. Context score matrix (informativo)

**Stampa**: CSS `@media print` + bottone "🖨️ Imprimir / Guardar PDF" che chiama `window.print()`. Niente edge function PDF.

---

## Fase 3 — Adattamento domande per vertical

### Briefing pre-call (`briefing_questions`)
Seed nuove domande per `salud_estetica/clinica_estetica`:
- "¿Cuál es tu tratamiento estrella?"
- "¿Tienes un tratamiento gateway (low-cost, alta satisfacción)?"
- "¿En qué ciudad/zona operas?" (alimenta city del cliente)
- "URL del sitio web actual" (alimenta website_url)
- "Instagram principal de la clínica"

Stessa logica per altri vertical (set ridotto iniziale, espandibile da admin via UI esistente).

### Kickoff call (`kickoff_question_templates` → cloning a `kickoff_questions`)
Per `salud_estetica/clinica_estetica`, domande **strategiche** che solo founder sa rispondere:
- "Tratamiento con miglior margine vs. quello che vorresti vendere di più"
- "Paciente perfetto da raddoppiare en 6 meses"
- "Pre-mortem: ¿cómo falla este proyecto?"
- "2-3 clínicas locales para analizar" → input diretto a `analyze-local-competitors`
- "Frase más bonita de un paciente satisfecho" → seed VoC
- "Objeción #1 en consulta" → cross-check VoC

**Rimuovo** dal set generico (perché VoC le estrae meglio):
- "Descrivi cliente tipo"
- "Quali obiezioni senti"

Per altri vertical: set base ereditato da `all` + 3-5 specifiche per sub_niche.

UI: `KickoffQuestionsManager` esistente legge le clonate; aggiungo bottone "Resetear desde template del vertical".

---

## Fase 4 — Competitor Teardown locale (manuale)

Panel "Competidores locales" in `KickoffTab`:
- Admin inserisce 2-3 URL website + IG handle
- Bottone "Analizar" → edge `analyze-local-competitors`

Edge function:
- Firecrawl scrape sito (servizi, prezzi, hero copy)
- Firecrawl scrape IG bio + ultimi 6 post
- Perplexity per Google Maps reviews della clinica concorrente
- Claude summary: treatments, prices, hooks, **gap opportunities per il cliente**
- Salva in `client_competitor_analyses`

---

## Fase 5 — VoC Mining

Edge `extract-voice-of-customer`:
- Input: `clients.website_url` + `clients.name` + `clients.city`
- Perplexity con `search_domain_filter: ['google.com/maps','trustpilot.com','yelp.com']`
- Estrae JTBD, obiezioni, frasi reali, trigger events
- Salva in `client_context_snapshots` con `snapshot_type='voc'`
- Trigger: bottone manuale in KickoffTab + auto al `accept-prospect` (background job)
- Iniettato in tutti i prompt AI quando disponibile

**Fallback manuale** se Perplexity non connesso: textarea "incolla 5-10 review" → Claude estrae.

---

## Fase 6 — Asset Audit (opzionale, non bloccante)

Panel "Lo que ya funciona" in `KickoffTab`:
- Admin **può** caricare 1-3 esempi performanti
- Edge `analyze-winning-patterns` estrae pattern → `client_winning_patterns`
- Iniettato come reference nei prompt SE presenti, mai bloccante

---

## Fase 7 — Context Score informativo (mai bloccante)

Refactor `src/lib/context-score.ts`:
- Score per-asset-type (matrice)
- **Generazione sempre permessa**
- Avviso giallo se < 70%: *"Contexto al 45%. L'AI userà valori di default. Puoi mejorar después."*
- Bottone "Mejorar con más contexto" sui draft → porta al campo mancante
- Prompt AI ricevono confidence per campo → Claude marca `[bassa confidenza]` e suggerisce miglioramenti
- Componente `ContextScoreMatrix.tsx` sostituisce `ContextScorePanel`

Rimozione blocchi in: `generate-campaign-brief`, `generate-proposal`, generation hooks frontend.

---

## Fase 8 — Pattern Library cross-cliente

Route `/admin/insights`:
- Aggregazione `client_rules` per `vertical + sub_niche`
- Soglia 3+ clienti stesso vertical → "Suggested Default Rule"
- Modale al nuovo cliente: "13 cliniche estetiche usano queste 5 regole — applicare?"
- Edge `compute-vertical-patterns` (manuale + cron settimanale)
- Tabella `vertical_pattern_suggestions` con admin approval

---

## Fase 9 — Iniezione AI

Aggiorno prompt di:
- `generate-campaign-brief`: + VoC + winning patterns + competitor gaps + confidence per campo
- `generate-proposal`: + competitor gaps + city + website analysis
- `analyze-kickoff-transcript`: + VoC per cross-check obiezioni dichiarate vs reali
- `accept-prospect`: trigger auto VoC + cloning kickoff template

---

## Costi mensili stimati
- **Free tier (primi mesi)**: $0 fino a ~20 nuovi clienti/mese
- **A regime**: $0-5 Perplexity + $0-19 Firecrawl = **$5-25/mese**

## Default scelti
- VoC: incluso, con fallback manuale
- Competitor: input manuale admin
- Pattern library: soglia 3+, admin approva
- Asset audit: opzionale, non bloccante
- Context score: **mai bloccante**
- Kickoff & briefing questions: **adattive per vertical/sub_niche** via template clonabili
- Connettori: **Lovable connectors** per Firecrawl + Perplexity
- PDF export: **rinviato** — per ora `window.print()` con CSS print
- City + website_url: nuovi campi cliente, raccolti in briefing
- Bible freshness: badge ⚠️ se sezione > 60gg

## Ordine di esecuzione
1. **Fase 0**: schema (incluso seed templates per vertical principali)
2. **Fase 1**: richiesta connessione Firecrawl + Perplexity
3. **Fase 9** (parziale): aggiorno `accept-prospect` per cloning + trigger VoC
4. **Fasi 4-5-6**: edge functions discovery
5. **Fase 7**: refactor context score
6. **Fase 2**: Client Bible View (consuma tutto il resto)
7. **Fase 8**: Pattern library + insights
8. **Fase 9** (completamento): aggiornamento prompt AI

## Migliorie aggiunte rispetto al piano precedente
- ✅ Schema fix prerequisito (city, website_url, vertical su kickoff)
- ✅ Template di domande clonabili per vertical
- ✅ Connettori Lovable invece di API key manuali
- ✅ Standardizzazione `snapshot_type` con CHECK
- ✅ Deprecazione `activated_tools`
- ✅ Bible freshness indicator
- ✅ PDF rinviato → `window.print()` (semplificazione)
- ✅ Seed briefing_questions per vertical (oggi tutto su `all`)

