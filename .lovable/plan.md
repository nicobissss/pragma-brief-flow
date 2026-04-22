

## Chiarimento: dove devi andare

Hai detto "li ho messi in Forge" qualche messaggio fa — ma ora lo screenshot mostra il Cloud del **Briefer** (questo progetto). Voglio essere sicuro di darti istruzioni giuste.

### Opzione A — Cerchi "Secrets" nel Briefer (questo progetto)
Nello screenshot che mi hai mandato:
- Sidebar sinistra → 7ª voce dall'alto → **🔑 Secrets** (tra "Storage" e "Edge functions")
- Click lì → vedrai la lista dei secrets già configurati qui

⚠️ Ma qui dentro **NON serve** mettere `BRIEFER_SERVICE_ROLE_KEY` — qui non ha senso, perché questo progetto È il Briefer e ha già accesso al suo DB tramite `SUPABASE_SERVICE_ROLE_KEY` standard.

### Opzione B — Devi andare in Forge (l'altro progetto)
1. In alto a sinistra dello schermo Lovable → click sul **nome del progetto attuale** ("pragma-brief-flow" o simile)
2. Si apre dropdown con la lista dei tuoi progetti → click su **Forge**
3. Una volta dentro Forge → stessa procedura: **Cloud** (icona nuvola in alto) → **Secrets** (sidebar sinistra)
4. Lì aggiungi/sovrascrivi `BRIEFER_SUPABASE_URL` e `BRIEFER_SERVICE_ROLE_KEY`

### Opzione C — Recuperare la service_role key del Briefer
Se non sai dove trovare la chiave da incollare in Forge:
1. Da questo screenshot → click su **Database** nella sidebar
2. In alto a destra cerca un link tipo "Open in Supabase" / icona freccia esterna
3. Si apre il dashboard Supabase → **Project Settings** (ingranaggio) → **API Keys** → riga **`service_role`** → **Reveal** → **Copy**

---

### Domanda per te

Per non farti perdere altro tempo, dimmi quale di queste è la tua situazione attuale:

1. **"Sono in Forge e voglio aggiungere/modificare i secrets lì"** → vai in sidebar sinistra → Secrets
2. **"Devo recuperare la service_role key del Briefer per incollarla in Forge"** → click Database → Open in Supabase → Settings → API Keys
3. **"Non so come passare da un progetto Lovable all'altro"** → click sul nome progetto in alto a sinistra → seleziona l'altro progetto dal dropdown
4. **"Sono confuso, ricominciamo da capo"** → te lo riassumo in 3 step semplici

Rispondi con il numero (1/2/3/4) e procediamo da lì senza altre deviazioni.

