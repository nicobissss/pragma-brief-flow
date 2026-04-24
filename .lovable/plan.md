# Review AI: Cosa abbiamo, cosa manca

## 1. Mappa di cosa già fa l'AI oggi

**Pre-vendita / Briefer**
- `generate-proposal` — propuesta strategica + pricing (Gemini 2.5 Pro)
- `analyze-local-competitors` — competitive scan locale
- `analyze-winning-patterns` — pattern di proposte che hanno chiuso
- `extract-voice-of-customer` — estrazione voice dal briefing
- `fetch-website-context` + `extract-pdf-text` — context ingestion

**Onboarding / Kickoff**
- `analyze-kickoff-transcript` — estrae voice_reference, preferred_tone, client_rules
- `generate-kickoff-prompts` — prompt per Slotty/Forge per vertical
- `generate-campaign-brief` — auto-bozza del brief
- `generate-project-plan` — timeline progetto
- `suggest-client-rule` — suggerisce regole dal feedback

**Produzione / Revisione**
- `generate-asset-internal` — generazione asset interna
- `generate-correction-prompt` — riscrittura prompt dal feedback cliente
- `select-campaign-materials` — match materiali → campagna
- `trigger-forge-generation` — orchestra Forge

**Strategico**
- `generate-monthly-review` — review mensile performance

**Verdetto:** la copertura è buona sui flussi *generativi*. I gap grossi sono su **QA pre-consegna**, **loop di apprendimento**, e **proattività del briefer**.

---

## 2. Dove l'AI NON è (e dovrebbe essere)

### A. QA Agent sugli asset prima della consegna al cliente — **PRIORITÀ ALTA**
Oggi quando Forge/Slotty/Nicolò/Karla generano un asset, va direttamente a `pending_review` umano. Manca un check automatico che intercetti errori prima che arrivino al cliente.

**Proposta:** edge function `qa-asset-review` che gira ad ogni nuovo asset e produce uno **score 0-100 + flag** su:
- **Brand consistency:** colori, tone, voice_reference dal kickoff
- **Client rules compliance:** verifica esplicita contro `client_rules` (no claim medici, no prezzi inventati, etc.)
- **Brief alignment:** l'asset risponde all'obiettivo del campaign brief?
- **Errori oggettivi:** typo, claim non supportati, CTA mancante, dimensioni sbagliate per la piattaforma
- **Approvazione predetta:** in base a `analyze-winning-patterns` storico, probabilità che il cliente approvi

Output mostrato in `AssetReviewPanel` come **"AI QA: 87/100 — 2 warning"** con dettaglio espandibile. L'admin decide se inviare al cliente o richiedere revisione interna. Asset con score <60 vengono bloccati automaticamente in `internal_review`.

**Beneficio business:** meno cicli di `change_requested` dal cliente → +velocità + percezione di qualità.

### B. Pre-mortem AI sulla proposta prima dell'invio — **PRIORITÀ ALTA**
Oggi `generate-proposal` produce, l'admin manda. Manca un agente "avvocato del diavolo".

**Proposta:** funzione `critique-proposal` che gira sulla proposta generata e risponde:
- Quali obiezioni farà il prospect in call?
- Il pricing è coerente con vertical/market storico?
- Mancano elementi che hanno funzionato in proposte vinte simili (`analyze-winning-patterns`)?
- Il customer journey narrative ha buchi logici?

Output nella sezione **Call Preparation** della proposta come "Anticipated objections + suggested rebuttals". Già hai l'hook + journey lì, manca il debate.

### C. Briefer più proattivo: agente conversazionale post-form — **PRIORITÀ MEDIA**
Oggi il briefer è form statico. Dopo il submit, manca un follow-up intelligente.

**Proposta:**
1. **Auto-enrichment agent**: dopo submit del briefing, parte un job che (a) fa scrape del sito, (b) cerca competitor locali, (c) estrae voice dal sito del prospect, (d) scrive 3-5 *"smart questions"* personalizzate che il prospect riceve via email per completare i gap → arrivano alla call con più contesto.
2. **Qualification score AI**: oltre alla pre-cualificación basata su regole, un AI score 0-100 di "fit" con Pragma (vertical compatibility, budget realismo, timeline, red flags). Aiuta a prioritizzare la call queue.

### D. Feedback Loop Agent — **PRIORITÀ MEDIA**
`suggest-client-rule` esiste ma è reattivo singolo-feedback. Manca il loop sistemico.

**Proposta:** agente settimanale `learn-from-rejections` che:
- Analizza tutti i `change_requested` della settimana per cliente
- Trova pattern ricorrenti (es. "il cliente cambia sempre la CTA da imperativo a domanda")
- Aggiorna automaticamente `client_rules` con suggerimenti pendenti per approvazione admin
- Aggiorna il `voice_reference` se il pattern è stilistico
- Genera un report "Cosa abbiamo imparato sul cliente X questa settimana"

### E. Conversational AI assistant per admin — **PRIORITÀ MEDIA**
Hai una marea di dati (clienti, asset, prospects, regole). Manca un'interfaccia conversazionale.

**Proposta:** chat assistant in `/admin` con accesso via tool-calling a:
- Query sui clienti ("quali clienti hanno asset bloccati da >7 giorni?")
- Drafting ("scrivi un follow-up per il prospect X considerando la sua call")
- Summary ("riassumimi cosa è successo questa settimana con cliente Y")
- Action ("genera il brief per la campagna di Natale di Z")

Usa Lovable AI con tool-calling sui dati del DB.

### F. Asset variation generator — **PRIORITÀ BASSA**
Quando un asset viene approvato, agente che propone automaticamente 2-3 varianti (formato diverso, hook diverso, A/B test) prima ancora che il cliente le chieda. Aumenta il valore percepito.

---

## 3. Come priorizzerei (mia raccomandazione)

**Fase 1 (impatto immediato sul business):**
1. **QA Agent sugli asset** — riduce cicli di revisione, alza qualità percepita
2. **Pre-mortem proposta** — alza tasso di conversione in call

**Fase 2 (efficienza interna):**
3. **Feedback Loop Agent settimanale** — il sistema impara solo
4. **Briefer auto-enrichment + smart questions** — call meglio preparate

**Fase 3 (nice-to-have):**
5. **Admin conversational assistant**
6. **Asset variation generator**

---

## 4. Considerazioni tecniche

- Tutto passa già per `_shared/ai.ts` su Lovable AI Gateway → zero nuove dipendenze
- Modello consigliato per QA e critique: `google/gemini-2.5-pro` (serve reasoning, ha già accesso visivo per gli asset immagine)
- Per il QA visivo degli asset immagine usiamo Gemini 2.5 Pro multimodale (analizza l'immagine generata vs brief)
- Feedback loop settimanale: cron edge function via `pg_cron` + funzione esistente `analyze-winning-patterns` come template
- L'admin assistant usa **tool-calling** del gateway (pattern già descritto in best practices)
- Tutti i nuovi agenti scrivono i loro output in tabelle dedicate (`asset_qa_reports`, `proposal_critiques`, `learning_reports`) per audit + UI

---

## 5. Domanda per te

Dimmi quali di questi vuoi che attacchiamo (anche solo Fase 1) e parto. Se vuoi, posso anche solo fare **uno** dei due della Fase 1 prima per validarlo prima di scalare.