UPDATE public.knowledge_base SET content = 'PRAGMA — OFFERTE E FLOW ATTIVI

L''AI deve raccomandare e descrivere SOLO le offerte qui sotto.
Non inventare nuovi flow, prezzi o servizi.

═══════════════════════════════════════════════════════════
TIER 1 — ENTRY / QUICK WINS (basso costo, attivazione rapida)
═══════════════════════════════════════════════════════════

▸ TIER1_RECUPERACION — "Recuperación Pacientes Dormidos"
  Obiettivo: riattivare pazienti/clienti inattivi da 6+ mesi.
  Durata: 14 giorni.
  Sequenza:
    Giorno 1  → Email 1 "Te echamos de menos" + segmentazione
    Giorno 4  → Email 2 con offerta personalizzata
    Giorno 8  → SMS reminder (opzionale)
    Giorno 10 → Email 3 ultima opportunità
    Giorno 14 → Landing page con CTA prenotazione
  Quando proporlo: cliente con base dati > 200 contatti, churn evidente.
  Risultato atteso: €2.000–5.000/mese recuperati.

▸ TIER1_NOSHOW — "No-Show Killer"
  Obiettivo: ridurre i no-show dal 15-20% al 5%.
  Sequenza:
    24h prima  → Email conferma con dettagli
    2h prima   → SMS reminder
    Post-cita  → Email feedback
    Se no-show → SMS riprogrammazione + landing
  Quando proporlo: cliente con sistema appuntamenti e tasso no-show > 10%.
  Risultato atteso: €20.000/anno recuperati.

▸ TIER1_RESENAS — "Reseñas Google Booster"
  Obiettivo: portare il cliente da 20 a 100+ recensioni Google in 3 mesi.
  Sequenza:
    Post-visita +24h  → SMS con link diretto Google Reviews
    Se non risponde   → Email follow-up giorno 3
    Se feedback < 4★ → form interno (intercetta negativi)
    Se feedback ≥ 4★ → push verso Google
  Quando proporlo: cliente con < 50 recensioni o rating < 4.5.
  Risultato atteso: +40% conversione nuovi clienti.

═══════════════════════════════════════════════════════════
TIER 2 — RETAINER / CRESCITA CONTINUATIVA
═══════════════════════════════════════════════════════════

▸ TIER2_PACK_CRECIMIENTO — "Pack Crecimiento" (€650/mese)
  Include: i 3 flow Tier 1 attivi in parallelo + revisioni mensili.
  Servizi inclusi:
    - Setup e gestione completa dei 3 flow
    - Revisione mensile metriche (open rate, conversioni, ROI)
    - Ottimizzazione continua copy e segmentazione
    - 1 call mensile di review con il cliente
  Quando proporlo:
    - Base dati > 500 contatti
    - Cliente pronto per investimento ricorrente
    - Tracking conversioni operativo
  Risultato atteso: €5.000–10.000/mese generati.

═══════════════════════════════════════════════════════════
TIER 3 — ONE-SHOT / CAMPAGNE STAGIONALI
═══════════════════════════════════════════════════════════

▸ TIER3_CAMPANA_ESTACIONAL — "Campaña Estacional Completa"
  Obiettivo: massimizzare revenue durante un evento o promozione specifica.
  Eventi tipici: Black Friday, vuelta al cole, estate, Natale, anniversari.
  Deliverables:
    - 3 email (teaser, lancio, last call)
    - 1 landing page dedicata
    - 2 post social (Instagram + Facebook)
    - 1 SMS broadcast il giorno del lancio
  Timeline: 21 giorni (15 di preparazione + 6 di campagna live).
  Quando proporlo: cliente con eventi stagionali ricorrenti o promo puntuali.
  Risultato atteso: boost revenue +20–40% nel mese.

═══════════════════════════════════════════════════════════
LOGICA DI RACCOMANDAZIONE
═══════════════════════════════════════════════════════════

Cliente nuovo, dolor singolo → 1 offerta Tier 1
Cliente con dolor multipli + base dati > 500 → Tier 2 (Pack Crecimiento)
Cliente con evento imminente → aggiungere Tier 3 (Campaña Estacional)
NON proporre Tier 2 senza tracking conversioni o base dati < 500.', updated_at = now() WHERE category = 'flows_processes';

UPDATE public.knowledge_base SET content = 'PRAGMA — PRICING ATTIVO

L''AI deve usare SOLO i prezzi qui sotto.
Non comunicare prezzi o ore al cliente in nessun output: i prezzi
sono uso interno e per la generazione delle proposte.

═══════════════════════════════════════════════════════════
TIER 1 — ENTRY (one-shot, no retainer)
═══════════════════════════════════════════════════════════

▸ TIER1_RECUPERACION — Setup €0, no fee mensile
  Modello: revenue share su pazienti riattivati
  Tipicamente cliente paga 15-20% del valore generato il primo mese.

▸ TIER1_NOSHOW — Setup €0, no fee mensile
  Modello: success fee su no-show evitati (€5-10 per appuntamento salvato).

▸ TIER1_RESENAS — Setup €0, no fee mensile
  Modello: pacchetto fisso una tantum oppure incluso nel Tier 2.

═══════════════════════════════════════════════════════════
TIER 2 — RETAINER MENSILE
═══════════════════════════════════════════════════════════

▸ TIER2_PACK_CRECIMIENTO
  Fee mensile: €650/mese
  Include: 3 flow Tier 1 + revisioni + 1 call/mese
  Setup: €0 (incluso)
  Periodo minimo: 3 mesi
  Modalità di pagamento: mensile anticipato

═══════════════════════════════════════════════════════════
TIER 3 — ONE-SHOT
═══════════════════════════════════════════════════════════

▸ TIER3_CAMPANA_ESTACIONAL
  One-shot fee: indicare €1.500–3.000 in funzione del volume
  contatti e dei canali attivati.
  Pagamento: 50% all''accettazione, 50% al lancio.

═══════════════════════════════════════════════════════════
REGOLE GENERALI
═══════════════════════════════════════════════════════════

- Tutti i prezzi sono in EUR e si intendono IVA esclusa.
- Sconti possibili solo con approvazione esplicita PRAGMA.
- Mai mostrare al cliente: stima ore interne, breakdown costi,
  margini, success fee dei tier 1.
- Nelle proposte commerciali mostrare SOLO il prezzo finale del
  pacchetto e i deliverables.', updated_at = now() WHERE category = 'pricing';

UPDATE public.knowledge_base SET content = 'PRAGMA SUITE — TOOLS ATTIVI

Strumenti interni della Suite PRAGMA. L''AI deve raccomandare
SOLO questi tool e abbinarli alle offerte tier appropriate.

═══════════════════════════════════════════════════════════
▸ Pragma Calendar
═══════════════════════════════════════════════════════════
Funzione: gestione appuntamenti integrata con Google/Outlook
Calendar del cliente. Reminder automatici via email + SMS.
Usato in: TIER1_NOSHOW, TIER2_PACK_CRECIMIENTO
Attivare per: tutti i sub-niche di Salud & Estética.

═══════════════════════════════════════════════════════════
▸ Landing Pragma
═══════════════════════════════════════════════════════════
Funzione: landing page veloci con form di prenotazione e
tracking conversioni. Template per ogni sub-niche.
Usato in: tutte le offerte Tier 1, Tier 2 e Tier 3.
Attivare per: tutti i clienti.

═══════════════════════════════════════════════════════════
▸ Pragma Visual Email
═══════════════════════════════════════════════════════════
Funzione: editor email visuale con template branded e
sequenze automatiche. Integrazione con Mailchimp/Brevo/SES.
Usato in: tutte le offerte (cuore di ogni flow).
Attivare per: tutti i clienti.

═══════════════════════════════════════════════════════════
▸ Social Engine Pragma
═══════════════════════════════════════════════════════════
Funzione: planner e generatore contenuti social. Integrazione
con Instagram, Facebook e LinkedIn.
Usato in: TIER3_CAMPANA_ESTACIONAL, TIER2 (opzionale).
Attivare per: clienti con presenza social attiva.

═══════════════════════════════════════════════════════════
▸ Pragma SEO & GEO
═══════════════════════════════════════════════════════════
Funzione: ottimizzazione SEO locale e Google Business Profile.
Usato in: TIER1_RESENAS, supporto a tutti i Tier.
Attivare per: clienti con presenza locale (cliniche, palestre,
studi). Non per E-Learning puro online.

═══════════════════════════════════════════════════════════
▸ Pragma Learn
═══════════════════════════════════════════════════════════
Funzione: piattaforma corsi/membership per clienti E-Learning.
Usato in: vertical E-Learning.
Attivare per: clienti del vertical E-Learning.

═══════════════════════════════════════════════════════════
▸ Voice Bot
═══════════════════════════════════════════════════════════
Funzione: assistente vocale per prenotazioni e qualificazione
lead via telefono.
Usato in: TIER2_PACK_CRECIMIENTO (opzionale).
Attivare per: clienti con alto volume chiamate (> 100/mese).

═══════════════════════════════════════════════════════════
NON SUGGERIRE MAI tool diversi da questi 7.', updated_at = now() WHERE category = 'suite_tools';

UPDATE public.knowledge_base SET content = 'PRAGMA — PITCH GUIDELINES

═══════════════════════════════════════════════════════════
FILOSOFIA
═══════════════════════════════════════════════════════════
PRAGMA non vende servizi: vende risultati misurabili.
Il pitch comunica tre cose, in quest''ordine:
  1. Capiamo il tuo business (vertical-specifico, non generico)
  2. Abbiamo un sistema provato per il tuo problema (non improvvisiamo)
  3. Iniziamo dal quick win (Tier 1) per dimostrare valore prima di scalare

═══════════════════════════════════════════════════════════
STRUTTURA DEL PITCH
═══════════════════════════════════════════════════════════

PARTE 1 — Diagnosi (sempre dati, mai opinioni)
"Tu clínica/empresa tiene X pacientes/clientes registrados.
 De estos, el Y% no ha vuelto en 6 meses.
 Eso significa €Z dejados sobre la mesa cada mes."

PARTE 2 — Soluzione (un solo flow, non un menu)
"El primer paso es activar [TIER1_RECUPERACION/NOSHOW/RESENAS]:
 una secuencia automática de N días que te recupera €X en el
 primer mes, sin que tu equipo tenga que hacer nada extra."

PARTE 3 — Prova (numeri, non promesse)
"Trabajamos con [N] clínicas/empresas similares. Promedio:
 €X recuperados al mes con [TIER1]. Caso real: [nombre/cifra]."

PARTE 4 — Prossimo passo (concreto, datato)
"Si arrancamos esta semana, en 14 días tienes el primer flow
 corriendo. La inversión es €0 hasta que veamos resultados."

═══════════════════════════════════════════════════════════
COSA EVITARE
═══════════════════════════════════════════════════════════
✘ Vendere il Tier 2 (€650/mese) come prima offerta — è il secondo step.
✘ Pitch generici "ti facciamo crescere il fatturato" — sempre vertical.
✘ Promesse senza numeri ("tantissimi clienti", "molto di più"…).
✘ Mostrare prezzi interni, ore stimate o margini.
✘ Inventare flow o tool non presenti nel catalogo.

═══════════════════════════════════════════════════════════
TONO DI VOCE
═══════════════════════════════════════════════════════════
- Diretto, professionale, in spagnolo (mercato ES/AR) o italiano (IT).
- Mai "marketing speak" anglofono.
- Numeri sempre concreti (€, %, giorni).
- Frasi corte. Una idea per frase.', updated_at = now() WHERE category = 'pitch_guidelines';