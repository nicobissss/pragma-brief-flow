

## Semplificazione completa del briefer admin

Refactor mirato per ridurre il rumore visivo, eliminare sezioni morte, e collegare meglio i flussi automatici. Nessuna modifica alle proposte commerciali — la tab Proposal del prospect resta com'è.

---

### 1. Dashboard `/admin` — solo l'essenziale

**Rimuovere:**
- Sezione "Lo que toca hoy" attuale ridondante con stats
- Pipeline Kanban a 5 colonne (rimane in DB, sparisce dalla home)

**Mantenere/potenziare:**
- Summary stats in alto (total prospects, conversion rate, etc.)
- **Nuovo blocco principale "Active Clients — Next Actions"**: lista compatta dei clienti attivi, ognuno con la sua next action derivata da `deriveNextAction()` + un CTA diretto alla tab giusta. Ordinata per urgenza (proposte aging > 5gg in cima).

File: `src/pages/admin/AdminDashboard.tsx`

---

### 2. Cliente → Tab "Prospect Info" — consolidare in una sola card "Notas internas"

**Rimuovere:**
- `SalesCallCard` (sales call form/notes) — non usato dall'AI, non visibile al cliente
- "Plan del proyecto" — duplica il plan d'azione dell'oferta

**Mantenere:**
- Read-only del briefing originale del prospect (con accordion già esistente)
- **Una sola card "Notas internas"** = textarea libero salvato in `client_notes` (tabella già esistente). Manteniamo lo storico delle note.

File: `src/components/admin/tabs/ProspectInfoTab.tsx`

---

### 3. Cliente → Tab "Kickoff" — sync materials cliente con controllo selettivo

**Nuova logica:**
Quando il cliente carica un file in `/client/collect` (tabella `client_asset_requests`), il file deve apparire automaticamente nella sezione "Client Materials" del kickoff dell'admin, **MA con un flag `use_for_ai`** che l'admin può toggleare on/off.

**Implementazione:**
- Estendere `kickoff_briefs.client_materials` (jsonb) con un nuovo schema:
  ```json
  { "items": [{ "url": "...", "label": "logo", "source": "client_upload" | "admin", "use_for_ai": true }] }
  ```
- Nuova edge function `sync-client-uploads-to-materials`: quando `client_asset_requests.status` diventa `submitted`, copia i file caricati nei materials del kickoff con `use_for_ai: true` di default e `source: "client_upload"`.
- UI in `ClientMaterials.tsx`: ogni item mostra origine (📤 cliente / 🛠️ admin) + checkbox "Usar para IA".
- In fase di generazione asset (`generate-asset-internal`, `select-campaign-materials`), filtrare solo gli items con `use_for_ai: true`.

**Migration richiesta:** trigger su `client_asset_requests` o chiamata edge dopo upload.

**Confermare al volo le altre cose della tab Kickoff (nessun cambio necessario):**
- Domande suggerite ✅ già automatiche
- Voice reference + client_rules + preferred_tone ✅ già estratti dal transcript via `analyze-kickoff-transcript`
- Discovery / Intelligencia de mercado ✅ resta dov'è

Files:
- `src/components/kickoff/ClientMaterials.tsx`
- `src/pages/client/ClientCollect.tsx` (trigger sync dopo upload)
- `supabase/functions/sync-client-uploads-to-materials/index.ts` (nuovo)
- `supabase/functions/generate-asset-internal/index.ts` (filtro `use_for_ai`)
- `supabase/functions/select-campaign-materials/index.ts` (filtro `use_for_ai`)

---

### 4. Stato del cliente — solo `activo` / `archivado`

- Il valore `paused` esistente in `clients.status` viene migrato a `active`.
- Dropdown UI semplificato a 2 voci.
- Filtri admin aggiornati di conseguenza.

**Migration:** `UPDATE clients SET status = 'active' WHERE status = 'paused'`. L'enum `client_status` può rimanere com'è (non rompiamo nulla rimuovendo solo dall'UI).

File: `src/pages/admin/AdminClientDetail.tsx`, `src/pages/admin/AdminClients.tsx`.

---

### Cosa NON cambia (confermato in chat)

- Tab Proposal del prospect resta com'è (la usi per proposte a freddo)
- Discovery / Intelligencia de mercado resta dentro Kickoff
- Pipeline Kanban resta in DB (può tornare utile in futuro), solo nascosta dalla home
- Stato kickoff `archivado` mantenuto per archiviare clienti dormienti

---

### Dettagli tecnici riassunti

| Area | File principali | DB |
|---|---|---|
| Dashboard | `AdminDashboard.tsx` | nessuna |
| Notas consolidata | `ProspectInfoTab.tsx`, rimuovere `SalesCallCard.tsx` da quella tab | usa `client_notes` esistente |
| Sync materials | `ClientCollect.tsx`, `ClientMaterials.tsx`, nuova edge `sync-client-uploads-to-materials` | nuovo schema in `kickoff_briefs.client_materials.items[]` |
| Filtro AI materials | `generate-asset-internal`, `select-campaign-materials` | nessuna |
| Status cliente | `AdminClientDetail.tsx`, `AdminClients.tsx` | UPDATE dati `paused` → `active` |

Nessuna nuova tabella. Nessun breaking change a livello dati.

