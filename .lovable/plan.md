

## Refactor Campañas: trasparenza AI, materiali cliente e fix UI generazione

Quattro problemi da affrontare nella sezione **Campañas** del cliente.

---

### 1. Brief campagna — perché l'AI ha proposto questo + chiedere modifiche

Quando si genera con AI il Campaign Brief (Objective / Audience / Key message / Timeline), oggi arrivano i campi compilati ma senza spiegazione. Aggiungeremo:

- **`reasoning`**: l'AI restituisce anche un breve "perché" per ogni campo, basato su offerta selezionata, kickoff, vertical, voce di marca.
- Box espandibile **"¿Por qué estos sugerencias?"** sotto il brief che mostra il ragionamento.
- Campo **"Pídele un cambio a la IA"**: textarea + bottone *Regenerar con feedback* che ri-invoca `generate-campaign-brief` passando `feedback` + il brief attuale, così l'AI riformula tenendo conto della richiesta (es: "más enfocado en pacientes recurrentes, no nuevos").

**Tecnico:** estendere la response di `supabase/functions/generate-campaign-brief/index.ts` con `reasoning: { objective, target_audience, key_message, timeline }`. Accettare in input opzionale `feedback` e `current_brief`.

---

### 2. Chiarire "Prompts AI" e collegarlo al Brief

Confusione attuale: l'utente non capisce a cosa servano i Prompts e se il Brief li influenza.

- Header esplicativo nella sub-tab **Prompts AI**: *"Estos prompts son las instrucciones que la IA usa para generar los assets de esta campaña. Se construyen automáticamente a partir del Brief de arriba + el kickoff + la oferta seleccionada. Edítalos solo si quieres afinar manualmente."*
- Indicatore visivo nella card "Prerequisitos": il check **"Brief campagna compilato"** diventa link che riporta alla tab Contexto.
- Bottone **"Regenerar prompts desde el brief"** evidenziato quando il Brief è stato modificato dopo l'ultima generazione (timestamp confronto).
- Rinominare bottone finale "Generar Prompts" → **"Preparar prompts para generación de assets"** per chiarire lo scopo.

---

### 3. Nuova sezione "Materiales del cliente" dentro la campagna

Oggi i materiali caricati dal cliente (foto, loghi, testi via `kickoff_briefs.client_materials` + `client_asset_requests`) non sono visibili dentro la campagna.

Aggiungere **quarta sub-tab "Materiales"** dentro ogni campagna espansa, con:

- Galleria dei materiali caricati (foto, loghi, doc, link al sito).
- Per ogni materiale: checkbox **"Usar en esta campaña"** (salvato in nuova tabella `campaign_materials` → `campaign_id`, `material_ref`, `material_type`, `selected`, `usage_hint`).
- Campo libero per dire all'AI dove/come usarlo (es: "questa foto va nell'hero della landing").
- Bottone **"Selección automática IA"**: chiama nuova edge function `select-campaign-materials` che, dato il brief + i materiali disponibili, suggerisce quali usare e dove.
- I materiali selezionati passano automaticamente a `generate-asset-internal` come parte del context (campo `selected_materials` nel prompt).

**Tecnico:**
- Migrazione: `create table campaign_materials`.
- Estendere `loadContext` in `generate-asset-internal/index.ts` per leggere `campaign_materials` e iniettarli nel `contextBlock`.
- Nuova edge function `select-campaign-materials`.

---

### 4. Fix UX generazione asset (e rimozione branding "Forge")

Diagnosi: la generazione **funziona** (16 asset creati negli ultimi 5 min in DB per la campagna corrente), ma:
- La lista asset nella tab non si aggiorna senza ricarica manuale.
- Il bottone dice "Genera asset con Forge" ma ora è AI interna (Lovable AI Gateway).

Cambi:
- Rinominare bottone → **"Generar assets con IA"** (icona `Wand2`).
- Rimuovere ogni riferimento a "Forge" dalla UI (`CampaignManager.tsx`, toast messages, AssetsTab).
- Dopo `generate-asset-internal` con successo: forzare reload assets con feedback chiaro (`Generados X assets — recargando...`) e auto-espandere la tab Assets.
- Toast con conteggio reale: *"4 assets generados en esta campaña. Revísalos abajo."*
- Aggiungere **realtime subscription** sulla tabella `assets` filtrata per `campaign_id`, così quando l'edge function inserisce, la lista si aggiorna live senza refresh.
- Spinner inline sulla card della campagna mentre genera + skeleton card per ogni asset_type in arrivo.

---

### File toccati

**Frontend:**
- `src/components/admin/CampaignManager.tsx` — sub-tab Materiales, realtime, rename Forge, reasoning UI brief.
- `src/components/admin/tabs/PromptsTab.tsx` — header esplicativo, link al brief, rename bottone.
- `src/components/admin/tabs/AssetsTab.tsx` — rimuovere stringhe "Forge".

**Backend:**
- `supabase/functions/generate-campaign-brief/index.ts` — output `reasoning`, input `feedback`/`current_brief`.
- `supabase/functions/generate-asset-internal/index.ts` — leggere `campaign_materials`.
- Nuova edge function: `supabase/functions/select-campaign-materials/index.ts`.
- Migrazione: `campaign_materials` (campaign_id, material_ref, type, usage_hint, selected, created_at) con RLS admin-only + select per client owner.

