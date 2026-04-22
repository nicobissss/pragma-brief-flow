import { CheckCircle2, Mail, FileText, Image as ImageIcon, MessageSquare, Megaphone, Layers, Workflow, Calendar, Sparkles } from "lucide-react";

type Deliverable = string | { name?: string; label?: string; type?: string; count?: number; description?: string };
type Step = string | { title?: string; name?: string; label?: string; description?: string; day?: string | number; channel?: string };

export type OfferingShape = {
  description?: string | null;
  value_proposition?: string | null;
  deliverables?: any;
  task_templates?: any;
  expected_outcomes?: any;
  recommendation_rules?: any;
};

function asArray<T = any>(x: any): T[] {
  if (!x) return [];
  if (Array.isArray(x)) return x as T[];
  if (typeof x === "object") return Object.values(x) as T[];
  return [];
}

/**
 * Convert a free-text description into bullet points.
 * Splits on newlines, "- ", "• ", or sentences when no other separator exists.
 */
function bulletsFromText(text?: string | null): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  // Already bulleted
  const lineBullets = trimmed
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\-•·*]\s*/, "").trim())
    .filter(Boolean);
  if (lineBullets.length > 1) return lineBullets;
  // Split on sentences
  const sentences = trimmed
    .split(/(?<=[\.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length > 1 ? sentences : [trimmed];
}

function deliverableIcon(type?: string) {
  switch ((type || "").toLowerCase()) {
    case "email":
    case "email_flow":
      return <Mail className="w-3.5 h-3.5" />;
    case "landing":
    case "landing_page":
      return <FileText className="w-3.5 h-3.5" />;
    case "social":
    case "social_post":
      return <ImageIcon className="w-3.5 h-3.5" />;
    case "sms":
      return <MessageSquare className="w-3.5 h-3.5" />;
    case "ads":
      return <Megaphone className="w-3.5 h-3.5" />;
    case "bundle":
      return <Layers className="w-3.5 h-3.5" />;
    default:
      return <CheckCircle2 className="w-3.5 h-3.5" />;
  }
}

function deliverableLabel(d: Deliverable): string {
  if (typeof d === "string") return d;
  const count = d.count ? `${d.count}× ` : "";
  return `${count}${d.name || d.label || d.type || "Deliverable"}${d.description ? ` — ${d.description}` : ""}`;
}

function stepLabel(s: Step): { day?: string; title: string; description?: string; channel?: string } {
  if (typeof s === "string") return { title: s };
  const day = s.day !== undefined && s.day !== null ? String(s.day) : undefined;
  return {
    day,
    title: s.title || s.name || s.label || "Paso",
    description: s.description,
    channel: s.channel,
  };
}

/**
 * Visualizza un'offerta in modo professionale: descrizione a bullet,
 * deliverables con icone, sequenza/step della campagna.
 *
 * `audience` controlla cosa viene mostrato:
 *   - "admin": tutto
 *   - "client": stessa cosa SENZA prezzi/ore (mai mostrate qui — gestito a monte)
 */
export function OfferingDetails({
  offering,
  audience = "admin",
  showSteps = true,
}: {
  offering: OfferingShape;
  audience?: "admin" | "client";
  showSteps?: boolean;
}) {
  const descBullets = bulletsFromText(offering.description);
  const deliverables = asArray<Deliverable>(offering.deliverables);
  const outcomes = asArray<string | { label?: string; description?: string }>(offering.expected_outcomes);
  const tasks = asArray<Step>(offering.task_templates);

  // Try to interpret task_templates as a campaign sequence (steps with day/order)
  const stepsToShow = showSteps ? tasks.slice(0, 12) : [];

  return (
    <div className="space-y-5">
      {offering.value_proposition && (
        <div className="bg-primary/5 border-l-4 border-primary rounded-r-lg px-4 py-3">
          <p className="text-sm font-medium text-foreground leading-snug flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>{offering.value_proposition}</span>
          </p>
        </div>
      )}

      {descBullets.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Qué incluye
          </p>
          <ul className="space-y-1.5">
            {descBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-snug">
                <CheckCircle2 className="w-4 h-4 text-[hsl(142,71%,35%)] shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deliverables.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Entregables
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {deliverables.map((d, i) => {
              const type = typeof d === "string" ? undefined : d.type;
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-foreground bg-secondary/40 rounded-md px-2.5 py-1.5"
                >
                  <span className="text-muted-foreground">{deliverableIcon(type)}</span>
                  <span className="truncate">{deliverableLabel(d)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {stepsToShow.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Workflow className="w-3.5 h-3.5" />
            Pasos de la campaña
          </p>
          <ol className="relative border-l-2 border-border ml-2 space-y-3 pl-4 py-1">
            {stepsToShow.map((s, i) => {
              const step = stepLabel(s);
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-[22px] top-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground leading-snug">{step.title}</p>
                      {step.day && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Día {step.day}
                        </span>
                      )}
                      {step.channel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {step.channel}
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-xs text-muted-foreground leading-snug">{step.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {audience === "admin" && outcomes.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Resultados esperados
          </p>
          <ul className="space-y-1">
            {outcomes.map((o, i) => {
              const label = typeof o === "string" ? o : o.label || o.description || "";
              if (!label) return null;
              return (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary shrink-0 mt-0.5">→</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
