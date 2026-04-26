## Goal

Aggiungere la generazione di un **mockup PNG reale** del Master Asset (oltre al JSON Strategic DNA) e dare all'admin la possibilità di **modificarlo via prompt** (es. "rendilo più scuro", "sposta il CTA in basso").

## Backend

### 1. Nuova edge function `render-master-asset-image`
Input: `{ master_asset_id, edit_instructions?: string }`

Logica:
1. Carica il master da `campaign_master_assets` (brand_kit, visual_layout, source_image_url, visual_preview_url corrente).
2. Costruisce un prompt visivo dal Strategic DNA:
   - Paleta (hex), tipografia, hero_message, supporting_message, cta_label, composition, imagery_direction.
3. Chiama Lovable AI Gateway con `google/gemini-3.1-flash-image-preview` (Nano Banana 2):
   - **Senza preview esistente + senza source image** → text-to-image (generazione da zero).
   - **Con `visual_preview_url` esistente** + `edit_instructions` → image-edit (passa l'immagine corrente + le istruzioni di modifica).
   - **Con `source_image_url`** (riferimento cliente) e nessun preview → image-edit usando il source come base.
4. Decodifica il base64, fa upload in storage bucket `client-assets` su path `master-assets/{client_id}/{master_asset_id}/v{version}-{timestamp}.png`.
5. Crea signed URL (bucket non pubblico) di 7 giorni e salva in `campaign_master_assets.visual_preview_url`.
6. Restituisce `{ ok, visual_preview_url }`.

Gating: rispetta `is_ai_agent_enabled_for_client('master_asset_generator', client_id)`.

### 2. Modifica `generate-master-asset` (opzionale auto-render)
Dopo aver salvato il record, **non** invocare automaticamente l'immagine (per non raddoppiare costi). L'admin la genera/rigenera dal pannello quando il JSON è ok. Questo dà controllo e velocità.

## Frontend (`MasterAssetsTab.tsx`)

Per ogni Master Asset card, aggiungere un blocco **"Mockup visual"**:

1. **Se `visual_preview_url` esiste**: mostra l'immagine (max-h ~400px), con:
   - Bottone **"Regenerar imagen"** (rilancia da zero il render).
   - Textarea **"Indica al AI cómo modificarla"** + bottone **"Aplicar cambios"** (passa `edit_instructions`).
2. **Se non esiste**: bottone **"Generar mockup visual"** + textarea opzionale di istruzioni iniziali.
3. Stato loading per master id durante render.

Nessuna modifica al modello JSON; il preview è puramente visivo e iterabile.

## Note tecniche

- Nano Banana 2 ritorna base64 → upload diretto in storage senza esporlo all'agente.
- Bucket `client-assets` già esiste (privato), serviamo via signed URL.
- Nessuna migration DB necessaria: colonne `visual_preview_url` e `source_image_url` esistono già su `campaign_master_assets`.
- Il render è indipendente dal JSON: l'admin può iterare l'immagine senza rigenerare la strategy.

## Files

- **NEW** `supabase/functions/render-master-asset-image/index.ts`
- **EDIT** `src/components/admin/MasterAssetsTab.tsx` (sezione mockup + handlers + state)