import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditableSection } from "./EditableSection";
import { CheckCircle, XCircle, Clock, AlertTriangle, Lightbulb, MessageSquare, Mic } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export type ProposalData = {
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

type Props = {
  data: ProposalData;
  editable?: boolean;
  onSave?: (data: ProposalData) => void;
};

export function ProposalView({ data, editable = false, onSave }: Props) {
  // Defensive guard: legacy view requires `pricing` shape. If absent, render nothing
  // (caller should route to ProposalSummaryView for the new {summary, full} shape).
  if (!data || !(data as any).pricing) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-sm text-muted-foreground">
        Formato de propuesta no compatible con esta vista.
      </div>
    );
  }
  const [draft, setDraft] = useState<ProposalData>(structuredClone(data));
  // snapshot to restore on cancel
  const [snapshot, setSnapshot] = useState<ProposalData>(structuredClone(data));

  const cur = draft.pricing.currency || "EUR";
  const fmt = (n: number) => `${cur === "USD" ? "$" : "€"}${n.toLocaleString()}`;

  const startEdit = useCallback(() => {
    setSnapshot(structuredClone(draft));
  }, [draft]);

  const saveSection = useCallback(() => {
    onSave?.(draft);
  }, [draft, onSave]);

  const cancelEdit = useCallback(() => {
    setDraft(structuredClone(snapshot));
  }, [snapshot]);

  // ——— helpers for updating nested draft ———
  const updateFlow = (field: string, value: any) =>
    setDraft((d) => ({ ...d, recommended_flow: { ...d.recommended_flow, [field]: value } }));

  const updateStep = (idx: number, field: string, value: any) =>
    setDraft((d) => {
      const steps = [...d.recommended_flow.steps];
      steps[idx] = { ...steps[idx], [field]: value };
      return { ...d, recommended_flow: { ...d.recommended_flow, steps } };
    });

  const updateTool = (idx: number, field: string, value: any) =>
    setDraft((d) => {
      const tools = [...d.recommended_tools];
      tools[idx] = { ...tools[idx], [field]: value };
      return { ...d, recommended_tools: tools };
    });

  const updatePricing = (field: string, value: any) =>
    setDraft((d) => ({ ...d, pricing: { ...d.pricing, [field]: value } }));

  const updateTimeline = (idx: number, field: string, value: any) =>
    setDraft((d) => {
      const tl = [...d.timeline];
      tl[idx] = { ...tl[idx], [field]: value };
      return { ...d, timeline: tl };
    });

  const updatePitch = (field: string, value: any) =>
    setDraft((d) => ({ ...d, pitch_suggestions: { ...d.pitch_suggestions, [field]: value } }));

  const updateKeyArg = (idx: number, value: string) =>
    setDraft((d) => {
      const args = [...d.pitch_suggestions.key_arguments];
      args[idx] = value;
      return { ...d, pitch_suggestions: { ...d.pitch_suggestions, key_arguments: args } };
    });

  const updateObjection = (idx: number, field: string, value: string) =>
    setDraft((d) => {
      const objs = [...d.pitch_suggestions.objections];
      objs[idx] = { ...objs[idx], [field]: value };
      return { ...d, pitch_suggestions: { ...d.pitch_suggestions, objections: objs } };
    });

  const onEditStart = () => startEdit();

  return (
    <div className="space-y-8">
      {/* RECOMMENDED FLOW */}
      <EditableSection
        title="Recommended Flow"
        icon={<Clock className="w-5 h-5 text-primary" />}
        editable={editable}
        onSave={saveSection}
        onCancel={cancelEdit}
      >
        {(editing) => {
          if (editing) onEditStart();
          return (
            <>
              {editing ? (
                <Input value={draft.recommended_flow.title} onChange={(e) => updateFlow("title", e.target.value)} className="mb-4" />
              ) : (
                <p className="text-sm text-muted-foreground mb-4">{draft.recommended_flow.title}</p>
              )}
              <ol className="space-y-3">
                {draft.recommended_flow.steps.map((step, i) => (
                  <li key={step.number} className={`flex gap-3 p-3 rounded-lg border ${step.critical ? "border-accent bg-accent/5" : "border-border"}`}>
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.critical ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                      {step.number}
                    </span>
                    <div className="flex-1">
                      {editing ? (
                        <div className="space-y-2">
                          <Input value={step.name} onChange={(e) => updateStep(i, "name", e.target.value)} placeholder="Step name" />
                          <Textarea value={step.description} onChange={(e) => updateStep(i, "description", e.target.value)} placeholder="Description" className="min-h-[60px]" />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox checked={step.critical} onCheckedChange={(v) => updateStep(i, "critical", !!v)} /> Critical
                          </label>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-foreground text-sm">
                            {step.name}
                            {step.critical && <Badge variant="destructive" className="ml-2 text-[10px]">Critical</Badge>}
                          </p>
                          <p className="text-muted-foreground text-xs mt-0.5">{step.description}</p>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          );
        }}
      </EditableSection>

      {/* TOOLS */}
      <EditableSection
        title="Suite Tools to Activate"
        icon={<CheckCircle className="w-5 h-5 text-primary" />}
        editable={editable}
        onSave={saveSection}
        onCancel={cancelEdit}
      >
        {(editing) => {
          if (editing) onEditStart();
          return (
            <div className="space-y-3">
              {draft.recommended_tools.map((tool, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${tool.recommended ? "border-status-accepted/30 bg-status-accepted/5" : "border-border opacity-50"}`}>
                  {editing ? (
                    <Checkbox checked={tool.recommended} onCheckedChange={(v) => updateTool(i, "recommended", !!v)} className="mt-1" />
                  ) : tool.recommended ? (
                    <CheckCircle className="w-5 h-5 text-status-accepted flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {editing ? (
                      <div className="space-y-2">
                        <Input value={tool.name} onChange={(e) => updateTool(i, "name", e.target.value)} />
                        <Textarea value={tool.reason} onChange={(e) => updateTool(i, "reason", e.target.value)} className="min-h-[50px]" />
                      </div>
                    ) : (
                      <>
                        <p className={`font-medium text-sm ${tool.recommended ? "text-foreground" : "text-muted-foreground"}`}>{tool.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{tool.reason}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      </EditableSection>

      {/* PRICING */}
      <EditableSection
        title="Proposed Pricing"
        icon={<AlertTriangle className="w-5 h-5 text-primary" />}
        editable={editable}
        onSave={saveSection}
        onCancel={cancelEdit}
      >
        {(editing) => {
          if (editing) onEditStart();
          const p = draft.pricing;
          return (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                {editing ? (
                  <div className="space-y-2">
                    <Input value={p.contract_type} onChange={(e) => updatePricing("contract_type", e.target.value)} placeholder="Contract type" />
                    <Textarea value={p.contract_type_reason} onChange={(e) => updatePricing("contract_type_reason", e.target.value)} className="min-h-[50px]" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">Contract: {p.contract_type}</p>
                    <p className="text-xs text-muted-foreground">{p.contract_type_reason}</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Monthly Retainer</p>
                  {editing ? (
                    <div className="flex gap-2 mt-1">
                      <Input type="number" value={p.retainer_min} onChange={(e) => updatePricing("retainer_min", +e.target.value)} />
                      <Input type="number" value={p.retainer_max} onChange={(e) => updatePricing("retainer_max", +e.target.value)} />
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-foreground">{fmt(p.retainer_min)} – {fmt(p.retainer_max)}</p>
                  )}
                </div>
                {(p.has_ad_fee || editing) && (
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">Ad Management Fee</p>
                    {editing ? (
                      <div className="space-y-2 mt-1">
                        <label className="flex items-center gap-2 text-xs"><Checkbox checked={!!p.has_ad_fee} onCheckedChange={(v) => updatePricing("has_ad_fee", !!v)} /> Has ad fee</label>
                        <Input type="number" value={p.ad_fee || 0} onChange={(e) => updatePricing("ad_fee", +e.target.value)} placeholder="Fee" />
                        <Input type="number" value={p.declared_ad_budget || 0} onChange={(e) => updatePricing("declared_ad_budget", +e.target.value)} placeholder="Budget" />
                      </div>
                    ) : p.has_ad_fee && p.ad_fee != null ? (
                      <>
                        <p className="text-lg font-bold text-foreground">{fmt(p.ad_fee)}/mo</p>
                        <p className="text-[10px] text-muted-foreground">15% of {fmt(p.declared_ad_budget || 0)}</p>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {(p.commission_percentage != null && p.commission_percentage > 0 || editing) && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Commission</p>
                  {editing ? (
                    <div className="space-y-2 mt-1">
                      <Input type="number" value={p.commission_percentage || 0} onChange={(e) => updatePricing("commission_percentage", +e.target.value)} placeholder="%" />
                      <Input value={p.commission_description || ""} onChange={(e) => updatePricing("commission_description", e.target.value)} placeholder="Description" />
                      <Input type="number" value={p.commission_window_days || 0} onChange={(e) => updatePricing("commission_window_days", +e.target.value)} placeholder="Window days" />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">{p.commission_percentage}% — {p.commission_description}</p>
                      {p.commission_window_days && <p className="text-xs text-muted-foreground">{p.commission_window_days}-day attribution window</p>}
                    </>
                  )}
                </div>
              )}

              {(p.setup_fee_min != null || editing) && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Setup Fee</p>
                  {editing ? (
                    <div className="space-y-2 mt-1">
                      <div className="flex gap-2">
                        <Input type="number" value={p.setup_fee_min || 0} onChange={(e) => updatePricing("setup_fee_min", +e.target.value)} />
                        <Input type="number" value={p.setup_fee_max || 0} onChange={(e) => updatePricing("setup_fee_max", +e.target.value)} />
                      </div>
                      <Input value={p.setup_fee_note || ""} onChange={(e) => updatePricing("setup_fee_note", e.target.value)} placeholder="Note" />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">{fmt(p.setup_fee_min!)} – {fmt(p.setup_fee_max || p.setup_fee_min!)}</p>
                      {p.setup_fee_note && <p className="text-xs text-muted-foreground">{p.setup_fee_note}</p>}
                    </>
                  )}
                </div>
              )}

              {(p.total_month_1_min != null || editing) && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Estimated Total — Month 1</p>
                  {editing ? (
                    <div className="space-y-2 mt-1">
                      <div className="flex gap-2">
                        <Input type="number" value={p.total_month_1_min || 0} onChange={(e) => updatePricing("total_month_1_min", +e.target.value)} />
                        <Input type="number" value={p.total_month_1_max || 0} onChange={(e) => updatePricing("total_month_1_max", +e.target.value)} />
                      </div>
                      <Input value={p.total_month_3_note || ""} onChange={(e) => updatePricing("total_month_3_note", e.target.value)} placeholder="3-month note" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-primary">{fmt(p.total_month_1_min!)} – {fmt(p.total_month_1_max || p.total_month_1_min!)}</p>
                      {p.total_month_3_note && <p className="text-xs text-muted-foreground mt-1">{p.total_month_3_note}</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        }}
      </EditableSection>

      {/* TIMELINE */}
      <EditableSection
        title="Proposed Timeline"
        icon={<Clock className="w-5 h-5 text-primary" />}
        editable={editable}
        onSave={saveSection}
        onCancel={cancelEdit}
      >
        {(editing) => {
          if (editing) onEditStart();
          return (
            <div className="space-y-3">
              {draft.timeline.map((item, i) => (
                <div key={i} className="flex gap-4 p-3 rounded-lg border border-border">
                  {editing ? (
                    <div className="flex-1 space-y-2">
                      <Input value={item.period} onChange={(e) => updateTimeline(i, "period", e.target.value)} placeholder="Period" />
                      <Input value={item.title} onChange={(e) => updateTimeline(i, "title", e.target.value)} placeholder="Title" />
                      <Textarea value={item.description} onChange={(e) => updateTimeline(i, "description", e.target.value)} className="min-h-[50px]" />
                    </div>
                  ) : (
                    <>
                      <Badge variant="secondary" className="flex-shrink-0 h-fit">{item.period}</Badge>
                      <div>
                        <p className="font-medium text-sm text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        }}
      </EditableSection>

      {/* PITCH SUGGESTIONS */}
      <EditableSection
        title="Pitch Suggestions for the Call"
        icon={<Lightbulb className="w-5 h-5 text-pitch-border" />}
        editable={editable}
        onSave={saveSection}
        onCancel={cancelEdit}
        className="bg-pitch-bg border-pitch-border"
      >
        {(editing) => {
          if (editing) onEditStart();
          return (
            <>
              <p className="text-[10px] uppercase tracking-wider text-pitch-border font-semibold mb-4">⚠ Internal only — never share with client</p>
              <div className="space-y-6">
                {/* Key Arguments */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                    <Lightbulb className="w-4 h-4" /> Key Arguments
                  </h4>
                  <ul className="space-y-2">
                    {draft.pitch_suggestions.key_arguments.map((arg, i) => (
                      <li key={i} className="text-sm text-foreground flex gap-2">
                        <span className="text-pitch-border font-bold">→</span>
                        {editing ? (
                          <Textarea value={arg} onChange={(e) => updateKeyArg(i, e.target.value)} className="min-h-[40px] flex-1" />
                        ) : (
                          arg
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Objections */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" /> Likely Objections & Responses
                  </h4>
                  <div className="space-y-3">
                    {draft.pitch_suggestions.objections.map((obj, i) => (
                      <div key={i} className="p-3 rounded-lg bg-card/50 border border-pitch-border">
                        {editing ? (
                          <div className="space-y-2">
                            <Textarea value={obj.objection} onChange={(e) => updateObjection(i, "objection", e.target.value)} placeholder="Objection" className="min-h-[40px]" />
                            <Textarea value={obj.response} onChange={(e) => updateObjection(i, "response", e.target.value)} placeholder="Response" className="min-h-[40px]" />
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">❝ {obj.objection}</p>
                            <p className="text-sm text-muted-foreground mt-1">→ {obj.response}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opening Line */}
                <div>
                  <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1">
                    <Mic className="w-4 h-4" /> Recommended Opening Line
                  </h4>
                  {editing ? (
                    <Textarea value={draft.pitch_suggestions.opening_line} onChange={(e) => updatePitch("opening_line", e.target.value)} className="min-h-[60px]" />
                  ) : (
                    <div className="p-3 rounded-lg bg-card/50 border border-pitch-border italic text-sm text-foreground">
                      "{draft.pitch_suggestions.opening_line}"
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </EditableSection>
    </div>
  );
}
