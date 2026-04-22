

# Review della parte cliente — chiarezza & sfoltimento

Onestamente: **la struttura è solida**, ma ci sono **3-4 ridondanze evidenti** e **un paio di cose che il cliente non capisce** al primo colpo. Niente da rifare da zero, solo pulizia chirurgica.

---

## ✂️ Cose inutili / ridondanti da rimuovere

### 1. La tab "Archivos solicitados" nel briefing è doppia
In `ClientDashboard` ci sono **due Tabs**: "Mi briefing completo" + "Archivos solicitados". Ma "Archivos solicitados" mostra solo un link che dice *"Vai alla página de subida"*. È un click in più per niente — il cliente ha già l'icona 📎 nella nav top con badge rosso, e ha già la card "Subir N archivos" in **Sección B (Qué necesitamos de ti)**.
→ **Rimuovere la Tab.** Lasciare solo "Mi briefing completo" (e magari togliere le Tabs del tutto, è un singolo collapsible).

### 2. "Sección C" duplica metà delle info di "Sección B"
La sezione "Tu plan" mostra: status badge (già nell'hero), progress bar (utile), e poi **"Assets aprobados X/Y" + "Pasos completados X/Y"** — ma "Pasos completados" è già la stessa info della progress bar appena sopra.
→ **Rimuovere il duplicato "Pasos completados"**, lasciare solo "Assets aprobados X/Y" come unica metrica numerica.

### 3. Status badge ripetuto 2 volte
Il badge "🚀 Campaña activa" appare nell'hero E nella card "Tu plan" (Sección C).
→ **Tenerlo solo nell'hero.**

### 4. ClientCollect: la "Text alternative" sotto ogni file
Ogni richiesta di file ha sia upload box sia textarea "Or add a text response". Per richieste che sono chiaramente file (es. "Logo aziendale", "Foto del local") la textarea confonde — il cliente si chiede *"devo scrivere qualcosa anche se ho caricato il file?"*.
→ **Mostrare la textarea solo per item con `type_hint === "Text"`.** Per file fisici, solo upload.

---

## 😵 Cose poco chiare per il cliente

### 5. Mix italiano/spagnolo/inglese
La dashboard è in spagnolo ("Qué necesitamos de ti"), ma:
- `ClientCollect` è **tutto in inglese** ("Files requested by PRAGMA", "All items uploaded!", "Replace file")
- `ClientAssetReview` è **misto**: titoli inglese ("Approve All", "Hover over any section..."), domande guidate in italiano, bottoni in italiano ("Volver al panel" è spagnolo dentro a tutto inglese)
→ **Standardizzare tutto in spagnolo** (lingua principale del cliente target SP/LATAM).

### 6. "Tus assets" — il cliente non sa cosa fare se status ≠ pending_review
Nella card asset, se non ci sono assets in `pending_review` mostro solo una ✓ verde. Niente CTA, niente "Ver aprobados". Il cliente che vuole **rivedere** un asset già approvato non ha modo di farlo.
→ **Rendere la card sempre cliccabile** (anche solo per consultare). Bottone secondario "Ver" quando non c'è pending.

### 7. "ClientAssetReview" — "Approve All" è troppo aggressivo
Il bottone "Approve All" (in alto a destra, primary blu, sempre visibile se ci sono >1 assets) è la **prima cosa che vedi**. Può portare ad approvazioni accidentali di campagne intere senza leggere.
→ **Spostarlo in fondo alla pagina** dopo che il cliente ha scrollato attraverso gli asset. O renderlo `variant="outline"` invece di primary.

### 8. La frase "Hover over any section and click 💬"
Su mobile non esiste hover. Il cliente da telefono non capisce come commentare.
→ Riscrivere: *"Toca cualquier sección para dejar tu feedback. Puedes aprobar sin comentar."*

### 9. Briefing: campi vuoti mostrano "—" silenzioso
In Sección E briefing, i campi non compilati mostrano un trattino italico. 30+ trattini di seguito danno la sensazione di "manca tutto" anche se l'80% non è obbligatorio.
→ **Nascondere i campi vuoti di default**, con un piccolo toggle "Mostrar campos vacíos" se serve.

---

## ✅ Cose che funzionano già bene (non toccare)

- Hero con nome cliente + status badge: pulito, calmo
- Sección B "Qué necesitamos de ti" con priority high in ambra: chiarissima
- Empty state "Todo en orden" in verde: rassicurante
- ProgressIndicator + count assets: leggibili
- Collapsible per sezioni del briefing: giusto compromesso

---

## 📋 Piano di esecuzione (se approvi)

1. **ClientDashboard**: rimuovere Tabs (-tab "Archivos"), rimuovere duplicato "Pasos completados" e badge ripetuto in Sección C, rendere card asset sempre cliccabile, nascondere campi vuoti briefing
2. **ClientCollect**: tradurre tutto in spagnolo, mostrare textarea solo per `type_hint === "Text"`
3. **ClientAssetReview**: tradurre tutto in spagnolo, riscrivere istruzione mobile-friendly, spostare/declassare "Approve All"

Stimato: una sessione media. Nessuna migrazione DB, solo UI.

