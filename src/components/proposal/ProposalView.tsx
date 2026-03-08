import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, AlertTriangle, Lightbulb, MessageSquare, Mic } from "lucide-react";

type ProposalData = {
  recommended_flow: {
    title: string;
    steps: { number: number; name: string; description: string; critical: boolean }[];
  };
  recommended_tools: { name: string; recommended: boolean; reason: string }[];
  pricing: {
    contract_type: string;
    contract_type_reason: string;
    currency: string;
    retainer_min: number;
    retainer_max: number;
    has_ad_fee?: boolean;
    declared_ad_budget?: number;
    ad_fee?: number;
    commission_percentage?: number;
    commission_window_days?: number;
    commission_description?: string;
    setup_fee_min?: number;
    setup_fee_max?: number;
    setup_fee_note?: string;
    total_month_1_min?: number;
    total_month_1_max?: number;
    total_month_3_note?: string;
  };
  timeline: { period: string; title: string; description: string }[];
  pitch_suggestions: {
    key_arguments: string[];
    objections: { objection: string; response: string }[];
    opening_line: string;
  };
};

export function ProposalView({ data }: { data: ProposalData }) {
  const { recommended_flow, recommended_tools, pricing, timeline, pitch_suggestions } = data;
  const cur = pricing.currency || "EUR";
  const fmt = (n: number) => `${cur === "USD" ? "$" : "€"}${n.toLocaleString()}`;

  return (
    <div className="space-y-8">
      {/* SECTION 1 — RECOMMENDED FLOW */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Recommended Flow
        </h3>
        <p className="text-sm text-muted-foreground mb-4">{recommended_flow.title}</p>
        <ol className="space-y-3">
          {recommended_flow.steps.map((step) => (
            <li key={step.number} className={`flex gap-3 p-3 rounded-lg border ${step.critical ? "border-accent bg-accent/5" : "border-border"}`}>
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.critical ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {step.number}
              </span>
              <div>
                <p className="font-medium text-foreground text-sm">
                  {step.name}
                  {step.critical && <Badge variant="destructive" className="ml-2 text-[10px]">Critical</Badge>}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* SECTION 2 — RECOMMENDED TOOLS */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary" /> Suite Tools to Activate
        </h3>
        <div className="space-y-3">
          {recommended_tools.map((tool) => (
            <div key={tool.name} className={`flex items-start gap-3 p-3 rounded-lg border ${tool.recommended ? "border-status-accepted/30 bg-status-accepted/5" : "border-border opacity-50"}`}>
              {tool.recommended ? (
                <CheckCircle className="w-5 h-5 text-status-accepted flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium text-sm ${tool.recommended ? "text-foreground" : "text-muted-foreground"}`}>{tool.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tool.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SECTION 3 — PRICING */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" /> Proposed Pricing
        </h3>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm font-medium text-foreground">Contract: {pricing.contract_type}</p>
            <p className="text-xs text-muted-foreground">{pricing.contract_type_reason}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Monthly Retainer</p>
              <p className="text-lg font-bold text-foreground">{fmt(pricing.retainer_min)} – {fmt(pricing.retainer_max)}</p>
            </div>
            {pricing.has_ad_fee && pricing.ad_fee != null && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Ad Management Fee</p>
                <p className="text-lg font-bold text-foreground">{fmt(pricing.ad_fee)}/mo</p>
                <p className="text-[10px] text-muted-foreground">15% of {fmt(pricing.declared_ad_budget || 0)}</p>
              </div>
            )}
          </div>

          {pricing.commission_percentage != null && pricing.commission_percentage > 0 && (
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Commission (Tipo A)</p>
              <p className="text-sm font-medium text-foreground">{pricing.commission_percentage}% — {pricing.commission_description}</p>
              {pricing.commission_window_days && (
                <p className="text-xs text-muted-foreground">{pricing.commission_window_days}-day attribution window</p>
              )}
            </div>
          )}

          {pricing.setup_fee_min != null && (
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Setup Fee</p>
              <p className="text-sm font-medium text-foreground">{fmt(pricing.setup_fee_min)} – {fmt(pricing.setup_fee_max || pricing.setup_fee_min)}</p>
              {pricing.setup_fee_note && <p className="text-xs text-muted-foreground">{pricing.setup_fee_note}</p>}
            </div>
          )}

          {pricing.total_month_1_min != null && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">Estimated Total — Month 1</p>
              <p className="text-xl font-bold text-primary">{fmt(pricing.total_month_1_min)} – {fmt(pricing.total_month_1_max || pricing.total_month_1_min)}</p>
              {pricing.total_month_3_note && <p className="text-xs text-muted-foreground mt-1">{pricing.total_month_3_note}</p>}
            </div>
          )}
        </div>
      </Card>

      {/* SECTION 4 — TIMELINE */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Proposed Timeline
        </h3>
        <div className="space-y-3">
          {timeline.map((item, i) => (
            <div key={i} className="flex gap-4 p-3 rounded-lg border border-border">
              <Badge variant="secondary" className="flex-shrink-0 h-fit">{item.period}</Badge>
              <div>
                <p className="font-medium text-sm text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SECTION 5 — PITCH SUGGESTIONS (internal, yellow bg) */}
      <Card className="p-6 bg-pitch-bg border-pitch-border">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-pitch-border" /> Pitch Suggestions for the Call
        </h3>
        <p className="text-[10px] uppercase tracking-wider text-pitch-border font-semibold mb-4">⚠ Internal only — never share with client</p>

        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
              <Lightbulb className="w-4 h-4" /> Key Arguments
            </h4>
            <ul className="space-y-2">
              {pitch_suggestions.key_arguments.map((arg, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <span className="text-pitch-border font-bold">→</span> {arg}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Likely Objections & Responses
            </h4>
            <div className="space-y-3">
              {pitch_suggestions.objections.map((obj, i) => (
                <div key={i} className="p-3 rounded-lg bg-card/50 border border-pitch-border">
                  <p className="text-sm font-medium text-foreground">❝ {obj.objection}</p>
                  <p className="text-sm text-muted-foreground mt-1">→ {obj.response}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
              <Mic className="w-4 h-4" /> Recommended Opening Line
            </h4>
            <div className="p-3 rounded-lg bg-card/50 border border-pitch-border italic text-sm text-foreground">
              "{pitch_suggestions.opening_line}"
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-600" /> Pitch Suggestions for the Call
        </h3>
        <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-4">⚠ Internal only — never share with client</p>

        <div className="space-y-6">
          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
              <Lightbulb className="w-4 h-4" /> Key Arguments
            </h4>
            <ul className="space-y-2">
              {pitch_suggestions.key_arguments.map((arg, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <span className="text-amber-600 font-bold">→</span> {arg}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Likely Objections & Responses
            </h4>
            <div className="space-y-3">
              {pitch_suggestions.objections.map((obj, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/50 border border-amber-200">
                  <p className="text-sm font-medium text-foreground">❝ {obj.objection}</p>
                  <p className="text-sm text-muted-foreground mt-1">→ {obj.response}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
              <Mic className="w-4 h-4" /> Recommended Opening Line
            </h4>
            <div className="p-3 rounded-lg bg-white/50 border border-amber-200 italic text-sm text-foreground">
              "{pitch_suggestions.opening_line}"
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
