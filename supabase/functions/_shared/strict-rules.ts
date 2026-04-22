// Shared strict rules for all AI-powered edge functions
// Allineato al catalogo offerte attuale: Tier 1 (entry) / Tier 2 (retainer) / Tier 3 (one-shot)

export const STRICT_RULES = `
STRICT RULES — READ BEFORE GENERATING:

VERTICALS available:
- Salud & Estética
- E-Learning
- Deporte Offline

SUB-NICHES available per vertical:

Salud & Estética:
  Dental | Estética Corporal | Psicología | Nutrición | Oftalmología | Fisioterapia | Audiometría | Capilar

E-Learning:
  Agronomía/Veterinaria | PRL/Formación obligatoria | Coaching/Mentoría premium | B2B Corporativo | Jurídico | Salud Ocupacional | Sostenibilidad | Finanzas

Deporte Offline:
  Pádel/Tenis | Danza | Yoga/Pilates | Artes Marciales | Natación | Fútbol Extraescolar | Personal Trainer

OFFERTE PRAGMA — usa SOLO queste:

TIER 1 — Entry / Quick Wins (basso costo, rapida attivazione)
1. TIER1_RECUPERACION — "Recuperación Pacientes Dormidos"
   Flow di reattivazione per pazienti/clienti inattivi da 6+ mesi.
   Campagna 14 giorni: 3 email + landing page + opzionale SMS.
   Use case: clienti con base dati esistente non sfruttata.

2. TIER1_NOSHOW — "No-Show Killer"
   Sequenza automatica pre/post appuntamento per ridurre assenze.
   2 email + 2 SMS + landing di conferma.
   Use case: clienti con sistema appuntamenti e tasso no-show > 10%.

3. TIER1_RESENAS — "Reseñas Google Booster"
   Sistema automatico post-visita: dirige clienti soddisfatti a Google Reviews,
   intercetta feedback negativi internamente.
   Use case: clienti con < 50 recensioni Google o rating < 4.5.

TIER 2 — Retainer / Crescita Continuativa
4. TIER2_PACK_CRECIMIENTO — "Pack Crecimiento" (€650/mese)
   Retainer mensile che include i 3 flow Tier 1 in parallelo.
   Revisioni mensili e ottimizzazione continua.
   Use case: clienti pronti per investimento ricorrente, base dati > 500 contatti.

TIER 3 — One-shot / Campagne Stagionali
5. TIER3_CAMPANA_ESTACIONAL — "Campaña Estacional Completa"
   Campagna completa per evento/promozione specifica (Black Friday, vuelta al cole, ecc.).
   Include: 3 email + 1 landing page + 2 post social + 1 SMS.
   Use case: clienti con eventi stagionali ricorrenti o promozioni puntuali.

TOOLS available — recommend ONLY these:
- Pragma Calendar
- Landing Pragma
- Pragma Visual Email
- Social Engine Pragma
- Pragma SEO & GEO
- Pragma Learn
- Voice Bot

NEVER invent or suggest:
- Offerte non listate sopra (no "Salud & Estética 10-step flow", no "E-Learning Webinar 30-day", ecc.)
- Tools non listati sopra
- Sub-niches non listate sopra
- Pricing non presente nella knowledge base

REGOLE DI RACCOMANDAZIONE:
- Cliente nuovo senza storico → proporre 1 offerta TIER 1 a scelta secondo il dolor principale
- Cliente con base dati > 500 e dolor multipli → proporre TIER 2 (Pack Crecimiento)
- Cliente con evento/promozione imminente → aggiungere TIER 3 (Campaña Estacional)
- NON proporre TIER 2 a clienti senza base dati o tracking conversioni

Se la sub-niche del cliente non corrisponde esattamente:
Scegli la sub-niche più vicina e segnala nella rationale.
NON creare nuove categorie.
`;

// Mappatura offerte → sub-niches per cui sono più adatte
export const OFFERING_FIT: Record<string, string[]> = {
  TIER1_RECUPERACION: [
    "Dental", "Estética Corporal", "Fisioterapia", "Nutrición", "Psicología",
    "Oftalmología", "Audiometría", "Capilar",
    "Pádel/Tenis", "Danza", "Yoga/Pilates", "Artes Marciales", "Natación",
    "Personal Trainer", "Fútbol Extraescolar",
  ],
  TIER1_NOSHOW: [
    "Dental", "Estética Corporal", "Fisioterapia", "Nutrición", "Psicología",
    "Oftalmología", "Audiometría", "Capilar",
  ],
  TIER1_RESENAS: [
    "Dental", "Estética Corporal", "Fisioterapia", "Nutrición", "Psicología",
    "Oftalmología", "Audiometría", "Capilar",
    "Pádel/Tenis", "Danza", "Yoga/Pilates", "Artes Marciales", "Natación",
    "Personal Trainer",
  ],
  TIER2_PACK_CRECIMIENTO: [], // applicabile a tutti se condizioni soddisfatte
  TIER3_CAMPANA_ESTACIONAL: [], // applicabile a tutti
};

export function getRecommendedOfferings(subNiche: string): string[] {
  const matches: string[] = [];
  for (const [code, niches] of Object.entries(OFFERING_FIT)) {
    if (niches.length === 0 || niches.includes(subNiche)) matches.push(code);
  }
  return matches;
}

// Backwards-compat shim per edge functions che ancora importano la vecchia API.
// Restituisce le offerte raccomandate come stringa human-readable.
export function getFlowForSubNiche(_vertical: string, subNiche: string): string {
  const recs = getRecommendedOfferings(subNiche);
  if (recs.length === 0) return "TIER1_RECUPERACION (default)";
  return recs.join(", ");
}

