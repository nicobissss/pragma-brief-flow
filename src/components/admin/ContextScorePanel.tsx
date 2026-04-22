import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, CheckCircle2, AlertCircle, Circle, Info } from "lucide-react";
import { calculateContextScore, getScoreStatus, type ContextScoreResult } from "@/lib/context-score";

type Props = {
  transcript_text?: string | null;
  transcript_quality?: string | null;
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
  language?: 'en' | 'es';
  showDetails?: boolean;
  compact?: boolean;
};

const CATEGORY_LABELS = {
  critical: { en: 'Critical', es: 'Crítico' },
  important: { en: 'Important', es: 'Importante' },
  nice_to_have: { en: 'Nice to have', es: 'Opcional' },
};

export function ContextScorePanel({
  transcript_text,
  transcript_quality,
  voice_reference,
  client_rules,
  preferred_tone,
  materials,
  briefing_answers,
  has_proposal,
  has_campaign_brief,
  language = 'es',
  showDetails = true,
  compact = false,
}: Props) {

  const result = useMemo(() => {
    return calculateContextScore({
      transcript_text,
      transcript_quality,
      voice_reference,
      client_rules,
      preferred_tone,
      materials,
      briefing_answers,
      has_proposal,
      has_campaign_brief,
    });
  }, [transcript_text, transcript_quality, voice_reference, client_rules, preferred_tone, materials, briefing_answers, has_proposal, has_campaign_brief]);

  const status = getScoreStatus(result.percentage, result.missingCritical.length > 0);
  const label = language === 'es' ? status.labelEs : status.label;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Progress value={result.percentage} className="h-2" />
        </div>
        <span className={`text-xs font-medium ${status.color === 'green' ? 'text-green-600 dark:text-green-400' : status.color === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
          {result.percentage}%
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">
              {language === 'es' ? 'Contexto para Claude' : 'Context for Claude'}
            </h3>
            <Badge variant={status.color === 'green' ? 'default' : status.color === 'amber' ? 'secondary' : 'destructive'} className="text-xs">
              {label}
            </Badge>
          </div>
          {result.missingCritical.length > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {language === 'es'
                ? `${result.missingCritical.length} elemento(s) crítico(s) faltante(s)`
                : `${result.missingCritical.length} critical item(s) missing`
              }
            </p>
          )}
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${status.color === 'green' ? 'text-green-600 dark:text-green-400' : status.color === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
            {result.percentage}
          </span>
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      {/* Progress bar with threshold marker */}
      <div className="relative">
        <Progress value={result.percentage} className="h-3" />
        <div className="absolute top-0 h-3 border-l-2 border-dashed border-amber-500" style={{ left: '70%' }} />
        <div className="absolute -top-4 text-[10px] text-amber-600 dark:text-amber-400" style={{ left: '70%', transform: 'translateX(-50%)' }}>
          ▼
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-muted-foreground">
            {language === 'es' ? 'Crítico' : 'Critical'}: {result.summary.critical.complete}/{result.summary.critical.total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">
            {language === 'es' ? 'Importante' : 'Important'}: {result.summary.important.complete}/{result.summary.important.total}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">
            {language === 'es' ? 'Opcional' : 'Optional'}: {result.summary.nice_to_have.complete}/{result.summary.nice_to_have.total}
          </span>
        </div>
      </div>

      {/* Detailed checklist */}
      {showDetails && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="w-3 h-3" />
            {language === 'es' ? 'Ver checklist completo' : 'View full checklist'}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-4">
              {(['critical', 'important', 'nice_to_have'] as const).map(category => {
                const categoryChecks = result.checks.filter(c => c.category === category);
                const categoryLabel = CATEGORY_LABELS[category][language];
                const categoryColor = category === 'critical' ? 'text-red-600 dark:text-red-400'
                  : category === 'important' ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground';

                return (
                  <div key={category}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${categoryColor}`}>
                      {categoryLabel}
                    </p>
                    <div className="space-y-1.5">
                      {categoryChecks.map(check => (
                        <div key={check.key} className="flex items-start gap-2">
                          {check.has ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs ${check.has ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                {language === 'es' ? check.labelEs : check.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-2">
                                {check.weight}pts
                              </span>
                            </div>
                            {!check.has && check.hintEs && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Info className="w-2.5 h-2.5 shrink-0" />
                                {language === 'es' ? check.hintEs : check.hint}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Status message — informative only, never blocks generation */}
      {result.percentage < 70 ? (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {language === 'es'
              ? `Contexto al ${result.percentage}%. Puedes generar igualmente, pero la IA usará valores por defecto donde falte información.`
              : `Context at ${result.percentage}%. You can still generate, but the AI will fall back to defaults where info is missing.`
            }
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <p className="text-xs text-green-800 dark:text-green-300">
            {language === 'es'
              ? '¡Contexto sólido! Puedes generar prompts de calidad.'
              : 'Solid context! You can generate quality prompts.'
            }
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to use context score in other components
 */
export function useContextScore(params: Parameters<typeof calculateContextScore>[0]) {
  return useMemo(() => calculateContextScore(params), [
    params.transcript_text,
    params.transcript_quality,
    params.voice_reference,
    params.client_rules,
    params.materials,
    params.briefing_answers,
    params.has_proposal,
    params.has_campaign_brief,
  ]);
}
