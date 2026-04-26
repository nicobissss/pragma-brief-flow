/**
 * Fixtures for generating realistic fake prospects/clients to test E2E flows.
 * Only the 3 approved verticals: Salud & Estética, E-Learning, Deporte Offline.
 */

export type FakeVertical = "Salud & Estética" | "E-Learning" | "Deporte Offline";

const FIRST_NAMES = ["Lucia", "Marco", "Elena", "Diego", "Sofia", "Alessandro", "Chiara", "Javier", "Martina", "Pablo"];
const LAST_NAMES = ["Rossi", "García", "Bianchi", "López", "Conti", "Martínez", "Greco", "Fernández", "Romano", "Sánchez"];

const BY_VERTICAL: Record<FakeVertical, {
  sub_niches: string[];
  companies: string[];
  descriptions: string[];
  tickets: [number, number]; // min, max EUR
}> = {
  "Salud & Estética": {
    sub_niches: ["Clínica dental", "Medicina estética", "Fisioterapia", "Nutrición", "Dermatología"],
    companies: ["Clínica Aurora", "Estética Bella Vita", "Centro Médico Vitalis", "Smile Studio", "DermaCare Madrid"],
    descriptions: [
      "Clínica privada con 3 sedes, target femminile 30-55 anni, ticket medio alto. Forte concorrenza locale.",
      "Studio specializzato in trattamenti viso e corpo. Vogliono scalare le prenotazioni online e ridurre la dipendenza dal passaparola.",
      "Centro multidisciplinare aperto da 2 anni, buon brand locale ma marketing digitale assente.",
    ],
    tickets: [80, 400],
  },
  "E-Learning": {
    sub_niches: ["Cursos online", "Coaching", "Mentoría grupal", "Academia digital"],
    companies: ["Academia Lumen", "MentorBase", "Skillpath Online", "GrowAcademy", "CodeFlow School"],
    descriptions: [
      "Vendono un corso flagship a 997€ + upsell mentoring. Funnel attuale via webinar evergreen ma CTR basso.",
      "Academy con 5 corsi attivi, community Discord di 1.200 membri. Vogliono lanciare un nuovo programma high-ticket.",
      "Coach 1-to-1 che vuole passare a un modello group coaching scalabile.",
    ],
    tickets: [297, 2500],
  },
  "Deporte Offline": {
    sub_niches: ["Gimnasio", "CrossFit", "Yoga / Pilates", "Entrenamiento personal"],
    companies: ["Box Iron Athletic", "Studio Pilates Flow", "Gym Evolution", "FitLab Centro", "Tribe Training"],
    descriptions: [
      "Box CrossFit con 180 soci attivi, churn al 4% mensile. Vogliono aumentare le iscrizioni e ridurre il churn.",
      "Studio boutique di Pilates, lista d'attesa per alcuni corsi ma slot vuoti in altri orari. Marketing inesistente.",
      "Palestra tradizionale 800mq, vogliono lanciare un programma di personal training premium.",
    ],
    tickets: [60, 200],
  },
};

const TONES = ["profesional pero cercano", "directo y motivador", "cálido y empático", "experto y educativo"];
const VOICES = [
  "Tono colloquiale ma autorevole, usa esempi concreti, evita tecnicismi.",
  "Voce diretta, frasi brevi, molte CTA, energia alta.",
  "Tono caldo e narrativo, racconta storie di clienti, focus su trasformazione.",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function generateFakeProspect(opts?: { emailOverride?: string }) {
  const verticals = Object.keys(BY_VERTICAL) as FakeVertical[];
  const vertical = pick(verticals);
  const data = BY_VERTICAL[vertical];
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const company = pick(data.companies);
  const slug = `${first}.${last}`.toLowerCase();
  const market = pick(["es", "it", "ar"] as const);
  const callDate = new Date(Date.now() + randInt(1, 7) * 86400000);
  callDate.setHours(randInt(9, 18), pick([0, 30]), 0, 0);

  return {
    name: `${first} ${last}`,
    company_name: company,
    email: opts?.emailOverride || `test+${slug}.${Date.now().toString(36)}@example.com`,
    market,
    vertical,
    sub_niche: pick(data.sub_niches),
    average_ticket: String(randInt(data.tickets[0], data.tickets[1])),
    ticket_currency: "EUR",
    description: pick(data.descriptions),
    call_date: callDate.toISOString().slice(0, 16),
  };
}

export function generateFakeTranscript(vertical: string, clientName: string, companyName: string): string {
  const v = (vertical as FakeVertical) in BY_VERTICAL ? (vertical as FakeVertical) : "Salud & Estética";
  const data = BY_VERTICAL[v];
  const ticket = randInt(data.tickets[0], data.tickets[1]);
  const pain = pick([
    "leads de baja calidad que no convierten",
    "agenda llena pero pocos clientes recurrentes",
    "depende del boca a boca y no escala",
    "redes sociales sin estrategia clara",
  ]);
  const goal = pick([
    "duplicar facturación en 6 meses",
    "construir un funnel predecible de captación",
    "lanzar un nuevo servicio premium",
    "reducir el coste por adquisición",
  ]);

  return `[00:00] Pragma: Hola ${clientName}, gracias por la llamada. ¿Me cuentas un poco sobre ${companyName}?

[00:35] ${clientName}: Claro. Llevamos operando unos 4 años. Nuestro ticket medio ronda los ${ticket}€ y trabajamos principalmente con ${pick(["público local", "clientes de la zona metropolitana", "una audiencia ya fidelizada"])}. El problema es que ${pain}.

[02:10] Pragma: Entiendo. ¿Qué habéis probado hasta ahora en marketing?
[02:25] ${clientName}: Hicimos ${pick(["Meta Ads con una agencia hace un año", "Google Ads pero sin tracking", "contenido orgánico en Instagram", "email marketing puntual"])} pero sin resultados claros. No teníamos métricas y al final cortamos.

[04:50] Pragma: ¿Y cuál es el objetivo concreto para los próximos 6-12 meses?
[05:05] ${clientName}: El objetivo es ${goal}. Sabemos que el producto/servicio funciona porque los que entran se quedan, pero el flujo de entrada es irregular.

[07:20] Pragma: ¿Qué presupuesto mensual estáis dispuestos a invertir en captación?
[07:35] ${clientName}: Podemos arrancar con unos ${randInt(800, 3000)}€/mes en ads, más el fee de la agencia. Si vemos retorno escalamos.

[09:00] Pragma: ¿Tenéis CRM, landing pages, sistema de booking?
[09:15] ${clientName}: Tenemos ${pick(["Calendly y Mailchimp", "una web en WordPress y Stripe", "sólo Instagram y WhatsApp Business"])}. Sabemos que es básico, está todo por estructurar.

[11:40] Pragma: ¿Quién es vuestro cliente ideal? Descríbemelo.
[11:55] ${clientName}: ${pick(["Mujeres 30-50, profesionales, viven cerca, valoran la calidad por encima del precio.", "Personas activas 25-45 que buscan resultados rápidos y un entorno motivante.", "Profesionales que ya consumen contenido educativo y están listos para invertir en su crecimiento."])}

[14:20] Pragma: Perfecto. ¿Hay algo de la marca que sea innegociable, tono, valores, cosas a evitar?
[14:35] ${clientName}: No queremos sonar agresivos ni hacer promesas exageradas. Tono ${pick(TONES)}. Y nada de testimonios falsos, todo real.

[17:00] Pragma: Anotado. ¿Competencia directa que admires?
[17:10] ${clientName}: Sí, ${pick(["@competitor_a", "una marca grande del sector", "unos chicos de Madrid que están haciendo bien Reels"])} están haciendo cosas interesantes.

[19:30] Pragma: Última pregunta: si dentro de 6 meses miramos atrás, ¿qué tendría que haber pasado para que digas "ha valido la pena"?
[19:45] ${clientName}: ${goal}, y sobre todo tener un sistema que funcione sin que yo esté encima cada día.

[21:00] Pragma: Genial, con esto tengo todo lo necesario. Te preparo la propuesta y la mandamos en 48h.`;
}

export function generateFakeKickoffBrief(vertical: string) {
  return {
    structured_info: {
      business_summary: pick(BY_VERTICAL[(vertical as FakeVertical)]?.descriptions || BY_VERTICAL["Salud & Estética"].descriptions),
      target_audience: pick([
        "Mujeres 30-50, urbanas, ingresos medio-altos",
        "Profesionales 28-45 interesados en crecimiento personal",
        "Adultos activos 25-45, conscientes de salud y rendimiento",
      ]),
      key_differentiator: pick([
        "Atención personalizada y resultados medibles",
        "Metodología propia validada con +500 casos",
        "Equipo multidisciplinar y seguimiento continuo",
      ]),
      main_goal: pick(["Aumentar leads cualificados", "Lanzar nuevo programa premium", "Construir autoridad de marca"]),
    },
    voice_reference: pick(VOICES),
    preferred_tone: pick(TONES),
    client_rules: [
      "No usar emojis en titulares",
      "Evitar promesas absolutas (siempre, garantizado, 100%)",
      "Mencionar siempre el nombre de la marca al cierre",
      "Tono en castellano neutro, no usar 'vosotros'",
    ],
  };
}

export function generateFakeAssetRequestItems() {
  return [
    { type: "logo", label: "Logo principal en SVG", status: "completed", url: "https://placehold.co/400x200/png?text=Logo+TEST" },
    { type: "photos", label: "5 fotos de equipo y local", status: "completed", url: "https://placehold.co/600x400/png?text=Photos+TEST" },
    { type: "brand_guidelines", label: "Guía de marca / colores", status: "completed", url: "https://placehold.co/800x600/png?text=Brand+TEST" },
  ];
}

export function generateFakeCampaignBrief() {
  return {
    objective: pick([
      "Generar 200 leads cualificados en 30 días para el programa flagship",
      "Aumentar reservas online un 40% en el próximo trimestre",
      "Posicionar la marca como referente local en 60 días",
    ]),
    target_audience: pick([
      "Mujeres 30-50, urbanas, interesadas en bienestar y estética",
      "Profesionales 28-45 que buscan crecimiento profesional",
      "Adultos 25-45 activos, próximos a la zona del centro",
    ]),
    key_message: pick([
      "Resultados visibles en 4 semanas o devolvemos tu inversión",
      "El método validado por +500 alumnos para conseguir tu objetivo",
      "Entrena con un equipo que te conoce por tu nombre",
    ]),
    timeline: "4 semanas (1 sem brief+creatividades, 3 sem campaña activa)",
    description: "Campaña de prueba generada en TEST mode para validar el flujo de generación de assets.",
  };
}
