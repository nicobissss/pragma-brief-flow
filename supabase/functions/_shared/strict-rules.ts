// Reglas estrictas compartidas por todas las edge functions de IA
// Catálogo Tier 1/2/3 (entry / retainer / one-shot)

export const STRICT_RULES = `
REGLAS ESTRICTAS — LEER ANTES DE GENERAR:

VERTICALES disponibles:
- Salud & Estética
- E-Learning
- Deporte Offline

SUB-NICHES por vertical:

Salud & Estética:
  Dental | Estética Corporal | Psicología | Nutrición | Oftalmología | Fisioterapia | Audiometría | Capilar

E-Learning:
  Agronomía/Veterinaria | PRL/Formación obligatoria | Coaching/Mentoría premium | B2B Corporativo | Jurídico | Salud Ocupacional | Sostenibilidad | Finanzas

Deporte Offline:
  Pádel/Tenis | Danza | Yoga/Pilates | Artes Marciales | Natación | Fútbol Extraescolar | Personal Trainer

OFERTAS PRAGMA — usar SOLO estas:

TIER 1 — Entry / Quick Wins
1. TIER1_RECUPERACION — "Recuperación Pacientes Dormidos"
   Reactivación 14 días: 3 emails + landing + SMS opcional.
   Para clientes con base de datos no explotada.

2. TIER1_NOSHOW — "No-Show Killer"
   Pre/post cita: 2 emails + 2 SMS + landing de confirmación.
   Para clientes con tasa de no-show > 10%.

3. TIER1_RESENAS — "Reseñas Google Booster"
   Post-visita: dirige a Google Reviews, intercepta feedback negativo.
   Para clientes con < 50 reseñas o rating < 4.5.

TIER 2 — Retainer / Crecimiento continuo
4. TIER2_PACK_CRECIMIENTO — "Pack Crecimiento" (650€/mes)
   Los 3 flows Tier 1 en paralelo + optimización mensual.
   Para clientes con base > 500 contactos listos para inversión recurrente.

TIER 3 — One-shot / Campañas estacionales
5. TIER3_CAMPANA_ESTACIONAL — "Campaña Estacional Completa"
   Para evento/promoción (Black Friday, vuelta al cole…).
   3 emails + 1 landing + 2 posts sociales + 1 SMS.

TOOLS disponibles — recomendar SOLO estas:
- Pragma Calendar
- Landing Pragma
- Pragma Visual Email
- Social Engine Pragma
- Pragma SEO & GEO
- Pragma Learn
- Voice Bot

NUNCA inventar:
- Ofertas fuera de las 5 listadas (no "Webinar 30-day", no "10-step flow", etc.)
- Tools fuera de las 7 listadas
- Sub-niches fuera de las listadas
- Pricing que no esté en la base de conocimiento

NUNCA compartir con el cliente:
- Horas estimadas (setup_hours_estimate, monthly_hours_estimate)
- Margen interno o desglose por hora
- Códigos internos (TIER1_*, TIER2_*) — usar siempre el nombre comercial

REGLAS DE RECOMENDACIÓN:
- Cliente nuevo sin histórico → 1 oferta TIER 1 según dolor principal
- Cliente con base > 500 y dolores múltiples → TIER 2 (Pack Crecimiento)
- Cliente con evento/promoción próxima → añadir TIER 3 (Campaña Estacional)
- NO proponer TIER 2 sin base de datos ni tracking de conversiones

Si la sub-niche del cliente no coincide exactamente:
elegir la más cercana y señalarlo en el rationale. NO crear nuevas categorías.

IDIOMA DE OUTPUT:
- Mercados ES y AR → español
- Mercado IT → italiano
- Nunca mezclar idiomas en un mismo deliverable
`;

// Mapping ofertas → sub-niches más adecuadas
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
  TIER2_PACK_CRECIMIENTO: [],
  TIER3_CAMPANA_ESTACIONAL: [],
};

export function getRecommendedOfferings(subNiche: string): string[] {
  const matches: string[] = [];
  for (const [code, niches] of Object.entries(OFFERING_FIT)) {
    if (niches.length === 0 || niches.includes(subNiche)) matches.push(code);
  }
  return matches;
}

// Lee el catálogo dinámicamente desde offering_templates
export async function fetchActiveOfferings(supabaseAdmin: any) {
  const { data } = await supabaseAdmin
    .from("offering_templates")
    .select("code, name, short_name, tier, category, description, value_proposition, deliverables, expected_outcomes, applicable_verticals, applicable_sub_niches, monthly_fee_eur, setup_fee_eur, one_shot_fee_eur")
    .eq("is_active", true)
    .order("tier")
    .order("sort_order");
  return data || [];
}

// Devuelve un bloque de texto con el catálogo activo, listo para inyectar en el system prompt
export function formatOfferingsForPrompt(offerings: any[]): string {
  if (!offerings.length) return "";
  const lines = ["\n--- CATÁLOGO ACTIVO (única fuente de verdad) ---"];
  for (const o of offerings) {
    lines.push(`\n[${o.code}] ${o.name} — Tier ${o.tier} (${o.category})`);
    if (o.value_proposition) lines.push(`  Propuesta: ${o.value_proposition}`);
    if (o.description) lines.push(`  Descripción: ${o.description}`);
    const deliverables = Array.isArray(o.deliverables) ? o.deliverables : [];
    if (deliverables.length) {
      const items = deliverables.map((d: any) => typeof d === "string" ? d : (d.name || d.title || JSON.stringify(d)));
      lines.push(`  Deliverables: ${items.join(" · ")}`);
    }
    const outcomes = Array.isArray(o.expected_outcomes) ? o.expected_outcomes : [];
    if (outcomes.length) {
      const items = outcomes.map((d: any) => typeof d === "string" ? d : (d.metric || JSON.stringify(d)));
      lines.push(`  Resultados esperados: ${items.join(" · ")}`);
    }
    const verticals = Array.isArray(o.applicable_verticals) ? o.applicable_verticals : [];
    if (verticals.length) lines.push(`  Verticales: ${verticals.join(", ")}`);
  }
  lines.push("--- FIN CATÁLOGO ---\n");
  return lines.join("\n");
}

// Backwards-compat shim — devuelve códigos recomendados como string
export function getFlowForSubNiche(_vertical: string, subNiche: string): string {
  const recs = getRecommendedOfferings(subNiche);
  if (recs.length === 0) return "TIER1_RECUPERACION";
  return recs.join(", ");
}
