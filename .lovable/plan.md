

## Mostra preview visivo reale di LP ed Email (non solo testo)

Oggi quando apri un asset (LP, email, social, blog) vedi solo il testo strutturato a sezioni (hero, banner, body…). Vuoi vedere il **rendering visivo** — la landing come apparirebbe nel browser, l'email come arriverebbe in inbox.

Il componente `src/components/client/AssetPreview.tsx` esiste già e fa esattamente questo (iframe per LP con URL, mockup email con header/CTA, immagini zoomabili, embed PDF), ma **non è collegato alla vista admin** dove stai guardando ora. L'admin vede solo `CommentableSection` con paragrafi di testo.

### Cosa cambia

**1. Aggiungere toggle "Vista previa / Texto" nella vista asset admin**
- In `src/pages/admin/AdminClientDetail.tsx` (o nel componente che renderizza l'asset espanso, da identificare in fase di implementazione cercando dove viene mostrato il contenuto dell'asset cliccato), aggiungere due tab in cima all'asset aperto:
  - **Vista previa** (default) → renderizza `<AssetPreview />`
  - **Texto / Secciones** → l'attuale vista a paragrafi commentabili
- Stessa logica anche dove l'admin apre asset dalla campagna in `CampaignManager.tsx`.

**2. Migliorare `AssetPreview` per quando manca un'immagine reale**

Ora `LandingPagePreview` mostra "No preview available" se non ci sono `url`, `fileUrl` o `html`. Per gli asset generati dall'AI di solito abbiamo solo JSON strutturato (hero, banner, body, cta…). Aggiungeremo un **renderer HTML automatico** che costruisce una landing visiva a partire dal JSON:

- **Landing page**: hero con titolo grande + sottotitolo + CTA pill, banner colorati per le sezioni, blocchi testo formattati, footer. Stile Pragma (cream + soft blue).
- **Email**: già c'è il mockup realistico con header colorato, subject, preview text, body, CTA — verificheremo che gestisca anche i campi che l'AI genera (es. `sections[]`, `header_image`, `signature`).
- **Social post**: card stile Instagram/Facebook con avatar finto del brand, immagine quadrata, caption, hashtag.
- **Blog**: layout articolo con hero image, titolo, meta (data/autore), body formattato in prose.

**3. Mockup device frame opzionale**
Wrap della preview in un frame "browser" (per LP) o "telefono" (per social/email mobile) per dare immediatamente il senso di "ecco come si vede davvero". Toggle desktop/mobile sopra la preview LP.

### File toccati

**Frontend solo (nessuna migrazione, nessuna edge function):**
- `src/components/client/AssetPreview.tsx` — estendere `LandingPagePreview` con renderer HTML da JSON strutturato; aggiungere device frame wrapper; migliorare `EmailFlowPreview` per gestire `sections[]`; arricchire `SocialPostPreview` e `BlogPreview`.
- `src/pages/admin/AdminClientDetail.tsx` (o componente asset detail che individueremo) — aggiungere tab `Vista previa | Texto` sopra il contenuto dell'asset.
- `src/components/admin/CampaignManager.tsx` — stesso toggle quando si espande un asset dalla campagna.

Nessun cambio di dato: usiamo il `content` JSON che l'AI già produce.

