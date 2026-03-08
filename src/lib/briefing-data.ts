export const VERTICALS = [
  "Salud & Estética",
  "E-Learning",
  "Deporte Offline",
] as const;

export const SUB_NICHES: Record<string, string[]> = {
  "Salud & Estética": [
    "Dental", "Estética Corporal", "Psicología", "Nutrición",
    "Oftalmología", "Fisioterapia", "Audiometría", "Capilar",
  ],
  "E-Learning": [
    "Agronomía/Veterinaria", "PRL/Formación obligatoria",
    "Coaching/Mentoría premium", "B2B Corporativo", "Jurídico",
    "Salud Ocupacional", "Sostenibilidad", "Finanzas",
  ],
  "Deporte Offline": [
    "Pádel/Tenis", "Danza", "Yoga/Pilates", "Artes Marciales",
    "Natación", "Fútbol Extraescolar", "Personal Trainer",
  ],
};

export const MARKETS = [
  { value: "es", label: "España" },
  { value: "it", label: "Italia" },
  { value: "ar", label: "Argentina" },
] as const;

export const CLIENT_SOURCES = [
  "Word of mouth", "Google", "Social media", "Paid ads",
  "Referrals", "Walk-in", "Other",
] as const;

export const AD_PLATFORMS = ["Meta", "Google", "TikTok", "LinkedIn", "Other"] as const;

export const BUDGET_RANGES = [
  "<€500", "€500–1.000", "€1.000–3.000", "€3.000+",
] as const;

export const EMAIL_LIST_SIZES = ["<500", "500–5.000", "5.000+"] as const;

export const MAIN_GOALS = [
  "Get more new clients",
  "Retain existing clients",
  "Both equally",
  "Launch a new offer",
] as const;

export type BriefingData = {
  // Step 1
  name: string;
  company_name: string;
  email: string;
  phone: string;
  market: string;
  vertical: string;
  sub_niche: string;
  // Step 2
  years_in_operation: string;
  monthly_new_clients: string;
  client_sources: string[];
  runs_paid_ads: string;
  ad_platforms: string[];
  monthly_budget: string;
  has_email_list: string;
  email_list_size: string;
  has_website: string;
  website_url: string;
  uses_crm: string;
  crm_name: string;
  // Step 3
  main_goal: string;
  average_ticket: string;
  ticket_currency: string;
  biggest_challenge: string;
  differentiator: string;
  additional_info: string;
};

export const emptyBriefing: BriefingData = {
  name: "", company_name: "", email: "", phone: "",
  market: "", vertical: "", sub_niche: "",
  years_in_operation: "", monthly_new_clients: "",
  client_sources: [], runs_paid_ads: "", ad_platforms: [],
  monthly_budget: "", has_email_list: "", email_list_size: "",
  has_website: "", website_url: "", uses_crm: "", crm_name: "",
  main_goal: "", average_ticket: "", ticket_currency: "EUR",
  biggest_challenge: "", differentiator: "", additional_info: "",
};
