/**
 * Context Completeness Score
 * 
 * Calculates how "ready" a client's context is for prompt generation.
 * Each check has a weight reflecting its importance for quality output.
 * 
 * Minimum threshold for generation: 70%
 * Critical items must ALL be present regardless of score.
 */

export type ContextCheck = {
  key: string;
  label: string;
  labelEs: string;
  weight: number;
  category: 'critical' | 'important' | 'nice_to_have';
  has: boolean;
  hint?: string;
  hintEs?: string;
};

export type ContextScoreResult = {
  score: number;
  maxScore: number;
  percentage: number;
  ready: boolean;
  checks: ContextCheck[];
  missing: ContextCheck[];
  missingCritical: ContextCheck[];
  summary: {
    critical: { total: number; complete: number };
    important: { total: number; complete: number };
    nice_to_have: { total: number; complete: number };
  };
};

const READY_THRESHOLD = 70;

export function calculateContextScore(params: {
  transcript_text?: string | null;
  transcript_quality?: 'good' | 'medium' | 'poor' | 'not_set' | string | null;
  voice_reference?: string | null;
  client_rules?: string[] | null;
  preferred_tone?: string | null;
  materials?: {
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    brand_tags?: string[] | null;
    website_context?: string | null;
    pricing_pdf_text?: string | null;
    photos?: any[] | null;
    social_posts?: any[] | null;
    email_text?: string | null;
  } | null;
  briefing_answers?: Record<string, any> | null;
  has_proposal?: boolean;
  has_campaign_brief?: boolean;
}): ContextScoreResult {

  const {
    transcript_text,
    transcript_quality,
    voice_reference,
    client_rules,
    materials,
    briefing_answers,
    has_proposal,
    has_campaign_brief,
  } = params;

  const getTranscriptWeight = () => {
    if (!transcript_text || transcript_text.trim().length < 200) return 0;
    switch (transcript_quality) {
      case 'good': return 25;
      case 'medium': return 20;
      case 'poor': return 12;
      default: return 20;
    }
  };

  const transcriptWeight = getTranscriptWeight();
  const hasTranscript = transcriptWeight > 0;

  const checks: ContextCheck[] = [
    // CRITICAL
    {
      key: 'transcript',
      label: 'Kickoff call transcript',
      labelEs: 'Transcripción de la call',
      weight: transcriptWeight || 25,
      category: 'critical',
      has: hasTranscript,
      hint: 'Paste the kickoff call transcript (min 200 chars)',
      hintEs: 'Pega la transcripción de la call (mín 200 caracteres)',
    },
    {
      key: 'voice_reference',
      label: 'Voice reference extracted',
      labelEs: 'Referencia de voz extraída',
      weight: 15,
      category: 'critical',
      has: !!(voice_reference && voice_reference.trim().length > 0),
      hint: 'Click "Analyze transcript" to extract voice reference',
      hintEs: 'Haz click en "Analizar transcripción" para extraer la voz',
    },

    // IMPORTANT
    {
      key: 'briefing_answers',
      label: 'Briefing answers from Slotty',
      labelEs: 'Respuestas del briefing',
      weight: 12,
      category: 'important',
      has: !!(briefing_answers && Object.keys(briefing_answers).length >= 3),
      hint: 'Prospect must complete at least 3 briefing questions',
      hintEs: 'El prospect debe completar al menos 3 preguntas del briefing',
    },
    {
      key: 'campaign_brief',
      label: 'Campaign brief defined',
      labelEs: 'Brief de campaña definido',
      weight: 10,
      category: 'important',
      has: !!has_campaign_brief,
      hint: 'Complete the campaign brief (objective, target moment, hook)',
      hintEs: 'Completa el brief de campaña (objetivo, momento, hook)',
    },
    {
      key: 'services_pricing',
      label: 'Services & pricing info',
      labelEs: 'Servicios y precios',
      weight: 8,
      category: 'important',
      has: !!(materials?.pricing_pdf_text && materials.pricing_pdf_text.trim().length > 0),
      hint: 'Upload a PDF or paste services/pricing info',
      hintEs: 'Sube un PDF o pega info de servicios/precios',
    },
    {
      key: 'brand_colors',
      label: 'Brand colors set',
      labelEs: 'Colores de marca',
      weight: 6,
      category: 'important',
      has: !!(materials?.primary_color),
      hint: 'Set primary brand color',
      hintEs: 'Define el color primario de marca',
    },
    {
      key: 'logo',
      label: 'Logo uploaded',
      labelEs: 'Logo subido',
      weight: 6,
      category: 'important',
      has: !!(materials?.logo_url),
      hint: 'Upload client logo',
      hintEs: 'Sube el logo del cliente',
    },

    // NICE TO HAVE
    {
      key: 'website_context',
      label: 'Website analyzed',
      labelEs: 'Web analizada',
      weight: 5,
      category: 'nice_to_have',
      has: !!(materials?.website_context && materials.website_context.trim().length > 0),
      hint: 'Fetch and analyze client website',
      hintEs: 'Analiza la web del cliente',
    },
    {
      key: 'photos',
      label: 'Photos uploaded',
      labelEs: 'Fotos subidas',
      weight: 5,
      category: 'nice_to_have',
      has: !!(materials?.photos && materials.photos.length > 0),
      hint: 'Upload team/location photos',
      hintEs: 'Sube fotos del equipo/local',
    },
    {
      key: 'client_rules',
      label: 'Client rules defined',
      labelEs: 'Reglas del cliente',
      weight: 4,
      category: 'nice_to_have',
      has: !!(client_rules && client_rules.length > 0),
      hint: 'Add specific rules from the call',
      hintEs: 'Añade reglas específicas de la call',
    },
    {
      key: 'proposal',
      label: 'Proposal generated',
      labelEs: 'Propuesta generada',
      weight: 2,
      category: 'nice_to_have',
      has: !!has_proposal,
      hint: 'Generate proposal in prospect view',
      hintEs: 'Genera la propuesta en la vista de prospect',
    },
    {
      key: 'social_posts',
      label: 'Social post examples',
      labelEs: 'Ejemplos de posts',
      weight: 2,
      category: 'nice_to_have',
      has: !!(materials?.social_posts && materials.social_posts.length > 0),
      hint: 'Add example social posts for tone reference',
      hintEs: 'Añade posts de ejemplo para referencia de tono',
    },
  ];

  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const score = checks.filter(c => c.has).reduce((sum, c) => sum + c.weight, 0);
  const percentage = Math.round((score / maxScore) * 100);

  const missing = checks.filter(c => !c.has);
  const missingCritical = missing.filter(c => c.category === 'critical');

  const summary = {
    critical: {
      total: checks.filter(c => c.category === 'critical').length,
      complete: checks.filter(c => c.category === 'critical' && c.has).length,
    },
    important: {
      total: checks.filter(c => c.category === 'important').length,
      complete: checks.filter(c => c.category === 'important' && c.has).length,
    },
    nice_to_have: {
      total: checks.filter(c => c.category === 'nice_to_have').length,
      complete: checks.filter(c => c.category === 'nice_to_have' && c.has).length,
    },
  };

  return {
    score,
    maxScore,
    percentage,
    // Context score is informative only — never blocks generation.
    // `ready` reflects "high-quality context", not a hard gate.
    ready: true,
    checks,
    missing,
    missingCritical,
    summary,
  };
}

export function getScoreStatus(percentage: number, hasCriticalMissing: boolean): {
  label: string;
  labelEs: string;
  color: 'red' | 'amber' | 'green';
  canGenerate: boolean;
} {
  // canGenerate is always true: score is informative.
  if (hasCriticalMissing) {
    return {
      label: 'Critical items missing — AI will use defaults',
      labelEs: 'Faltan elementos críticos — la IA usará valores por defecto',
      color: 'amber',
      canGenerate: true,
    };
  }
  if (percentage >= 80) {
    return {
      label: 'High-quality context',
      labelEs: 'Contexto de alta calidad',
      color: 'green',
      canGenerate: true,
    };
  }
  if (percentage >= 70) {
    return {
      label: 'Good context',
      labelEs: 'Buen contexto',
      color: 'green',
      canGenerate: true,
    };
  }
  if (percentage >= 50) {
    return {
      label: 'Partial context — output may be generic',
      labelEs: 'Contexto parcial — el resultado puede ser genérico',
      color: 'amber',
      canGenerate: true,
    };
  }
  return {
    label: 'Low context — AI will rely on defaults',
    labelEs: 'Contexto bajo — la IA usará defaults',
    color: 'amber',
    canGenerate: true,
  };
}
