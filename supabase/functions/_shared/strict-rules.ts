// Shared strict rules for all AI-powered edge functions

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

FLOWS available — use ONLY these:
1. Salud & Estética 10-step flow → Only for Salud & Estética sub-niches
2. E-Learning Ticket Bajo 7-day flow → Only for: PRL, Agronomía/Veterinaria, Sostenibilidad, Finanzas
3. E-Learning Ticket Alto Webinar 30-day flow → Only for: Coaching/Mentoría premium, Jurídico (high ticket)
4. E-Learning B2B 45-90 day flow → Only for: B2B Corporativo, Salud Ocupacional, Jurídico (enterprise)
5. Deporte Offline 10-step flow → Only for: Deporte Offline sub-niches

TOOLS available — recommend ONLY these:
- Pragma Calendar
- Landing Pragma
- Pragma Visual Email
- Social Engine Pragma
- Pragma SEO & GEO
- Pragma Learn
- Voice Bot

NEVER invent or suggest:
- Flows not listed above
- Tools not listed above
- Sub-niches not listed above
- Pricing not in the knowledge base

If the client's sub-niche does not match any available option exactly:
Pick the closest available sub-niche and note it in the rationale.
NEVER create a new category.
`;

export const FLOW_MAPPING: Record<string, string[]> = {
  "Salud & Estética 10-step flow": [
    "Dental", "Estética Corporal", "Psicología", "Nutrición",
    "Oftalmología", "Fisioterapia", "Audiometría", "Capilar",
  ],
  "E-Learning Ticket Bajo 7-day flow": [
    "PRL/Formación obligatoria", "Agronomía/Veterinaria", "Sostenibilidad", "Finanzas",
  ],
  "E-Learning Ticket Alto Webinar 30-day flow": [
    "Coaching/Mentoría premium", "Jurídico",
  ],
  "E-Learning B2B 45-90 day flow": [
    "B2B Corporativo", "Salud Ocupacional", "Jurídico",
  ],
  "Deporte Offline 10-step flow": [
    "Pádel/Tenis", "Danza", "Yoga/Pilates", "Artes Marciales",
    "Natación", "Fútbol Extraescolar", "Personal Trainer",
  ],
};

export function getFlowForSubNiche(vertical: string, subNiche: string): string {
  for (const [flow, niches] of Object.entries(FLOW_MAPPING)) {
    if (flow.startsWith(vertical.split(" ")[0]) || niches.includes(subNiche)) {
      if (niches.includes(subNiche)) return flow;
    }
  }
  // Fallback by vertical
  if (vertical === "Salud & Estética") return "Salud & Estética 10-step flow";
  if (vertical === "Deporte Offline") return "Deporte Offline 10-step flow";
  return "E-Learning Ticket Bajo 7-day flow";
}
