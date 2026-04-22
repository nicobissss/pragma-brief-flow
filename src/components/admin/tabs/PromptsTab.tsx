import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Sparkles, Target, RefreshCw, CheckCircle2, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function ContextLine({ label, included }: { label: string; included: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span>{included ? "✅" : "⚪"}</span>
      <span className={included ? "text-foreground" : "text-muted-foreground"}>
        {label}{!included && " (not provided)"}
      </span>
    </div>
  );
}

type Props = {
  client: any;
  kickoff: any | null;
  setKickoff: (k: any) => void;
  campaignBrief: any;
  setCampaignBrief: (v: any) => void;
  briefSaved: boolean;
  setBriefSaved: (v: boolean) => void;
  generatingBrief: boolean;
  onAutoGenerateBrief: () => void;
  generating: boolean;
  generatedPrompts: string | null;
  onGeneratePrompts: () => void;
  analyzingTranscript: boolean;
  onAnalyzeTranscript: () => void;
  toolGenerations: any[];
  setToolGenerations: (v: any[]) => void;
  onSendToSlotty: (g: any) => void;
  onMarkSent: (id: string) => void;
  onApproveAllGens: () => void;
  contextScore: any;
  completenessPct: number;
  materials: any;
  promptsRef: React.RefObject<HTMLDivElement>;
};

export default function PromptsTab({
  client, kickoff, setKickoff, campaignBrief, setCampaignBrief,
  briefSaved, setBriefSaved, generatingBrief, onAutoGenerateBrief,
  generating, generatedPrompts, onGeneratePrompts,
  analyzingTranscript, onAnalyzeTranscript,
  toolGenerations, onSendToSlotty, onMarkSent, onApproveAllGens,
  contextScore, completenessPct, materials, promptsRef,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold">Brief di questa campagna</h3>
          <span className="text-xs text-muted-foreground ml-auto mr-2">Compilare prima di generare i prompts</span>
          <Button variant="outline" size="sm" onClick={onAutoGenerateBrief} disabled={generatingBrief}>
            {generatingBrief ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Generando...</> : <><Sparkles className="w-4 h-4 mr-1" />Genera con AI</>}
          </Button>
        </div>

        {generatingBrief && (
          <div className="bg-secondary/50 rounded-lg p-3 text-sm text-muted-foreground animate-pulse">
            L'AI sta analizzando il contesto del cliente...
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Obiettivo specifico di questa campagna</Label>
            <Textarea value={campaignBrief.campaign_objective} onChange={(e) => setCampaignBrief((p: any) => ({ ...p, campaign_objective: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Il momento in cui il cliente finale decide di comprare</Label>
            <Textarea value={campaignBrief.target_moment} onChange={(e) => setCampaignBrief((p: any) => ({ ...p, target_moment: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Hook principale</Label>
            <Textarea value={campaignBrief.main_hook} onChange={(e) => setCampaignBrief((p: any) => ({ ...p, main_hook: e.target.value }))} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Contesto stagionale (opzionale)</Label>
            <Input value={campaignBrief.seasonal_context} onChange={(e) => setCampaignBrief((p: any) => ({ ...p, seasonal_context: e.target.value }))} />
          </div>
        </div>

        <Button
          onClick={async () => {
            if (!client) return;
            const { data: campaign } = await supabase.from("campaigns").select("id").eq("client_id", client.id).eq("status", "active").maybeSingle();
            if (campaign) {
              await supabase.from("campaigns").update({
                objective: campaignBrief.campaign_objective, key_message: campaignBrief.main_hook,
                description: `Momento decisione: ${campaignBrief.target_moment}. Stagionale: ${campaignBrief.seasonal_context}`,
              } as any).eq("id", campaign.id);
            } else {
              await supabase.from("campaigns").insert({
                client_id: client.id, name: `Campagna ${new Date().toLocaleDateString()}`, status: "active",
                objective: campaignBrief.campaign_objective, key_message: campaignBrief.main_hook,
                description: `Momento decisione: ${campaignBrief.target_moment}. Stagionale: ${campaignBrief.seasonal_context}`,
              } as any);
            }
            setBriefSaved(true);
            toast.success("Brief salvato — ora puoi generare i prompts");
          }}
          disabled={!campaignBrief.campaign_objective || !campaignBrief.target_moment}
          className="w-full"
        >
          {briefSaved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Brief salvato</> : "Salva brief e sblocca generazione"}
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prerequisitos</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <ContextLine label="Brief campagna compilato" included={briefSaved} />
          <ContextLine label="Transcripción cargada y analizada" included={!!kickoff?.transcript_text && !!kickoff?.voice_reference} />
          <ContextLine label="Servicios aprobados" included={!!kickoff?.suggested_services_approved} />
          <ContextLine label="Al menos 1 tool activado" included={toolGenerations.length > 0 || !!(kickoff?.suggested_services as any[])?.some?.((s: any) => s.recommended)} />
          <ContextLine label="Materiales subidos" included={!!((materials as any)?.photos?.length || (materials as any)?.website_context)} />
          <ContextLine label={`Contexto ≥ 60% (${completenessPct}%)`} included={completenessPct >= 60} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {kickoff?.transcript_text && !kickoff?.voice_reference && (
            <Button variant="outline" size="sm" onClick={onAnalyzeTranscript} disabled={analyzingTranscript}>
              {analyzingTranscript ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}Analizar transcripción
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button onClick={onGeneratePrompts} disabled={generating}
                    className={!generating ? "bg-[hsl(142,71%,35%)] hover:bg-[hsl(142,71%,30%)] text-white" : ""}>
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generando con AI...</>
                      : generatedPrompts ? <><RefreshCw className="w-4 h-4 mr-2" />Regenerar Prompts</>
                      : <><Sparkles className="w-4 h-4 mr-2" />Generar Prompts</>}
                  </Button>
                </span>
              </TooltipTrigger>
              {contextScore.percentage < 70 && (
                <TooltipContent>
                  <p>Contexto al {contextScore.percentage}%. Puedes generar, pero la IA usará defaults donde falte info.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {kickoff?.suggested_services && Array.isArray(kickoff.suggested_services) && kickoff.suggested_services.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Servicios sugeridos</h3>
          {(kickoff.suggested_services as any[]).map((svc: any, i: number) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">{svc.tool_name}</h4>
                    <Badge variant="outline" className="text-xs">Prioridad: {svc.priority}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{svc.reason}</p>
                </div>
                <Switch checked={svc.approved || false} onCheckedChange={async (checked) => {
                  const updated = (kickoff.suggested_services as any[]).map((s: any, j: number) => j === i ? { ...s, approved: checked } : s);
                  setKickoff({ ...kickoff, suggested_services: updated });
                  await supabase.from("kickoff_briefs").update({ suggested_services: updated } as any).eq("client_id", client.id);
                }} />
              </div>
              {svc.approved && <span className="text-xs text-green-600 font-medium mt-2 block">Activado</span>}
            </div>
          ))}
          {!(kickoff.suggested_services as any[]).some((s: any) => s.approved) ? null :
            !kickoff.suggested_services_approved ? (
              <Button size="sm" onClick={async () => {
                await supabase.from("kickoff_briefs").update({ suggested_services_approved: true } as any).eq("id", kickoff.id);
                setKickoff({ ...kickoff, suggested_services_approved: true });
                toast.success("Servicios aprobados");
              }}>Aprobar servicios</Button>
            ) : <Badge className="badge-accepted text-xs">✅ Servicios aprobados</Badge>}
        </div>
      )}

      {toolGenerations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prompts por herramienta</h3>
            {toolGenerations.some(t => t.status === "prompt_ready") && (
              <Button size="sm" variant="outline" onClick={onApproveAllGens}><CheckCircle2 className="w-4 h-4 mr-1" /> Aprobar todos</Button>
            )}
          </div>
          {toolGenerations.map((gen) => {
            const prompt = gen.prompt || {};
            const toolIcons: Record<string, string> = { Slotty: "🔧", "Landing + Email": "🏠", "Blog System": "📝" };
            const toolBorderColors: Record<string, string> = { Slotty: "hsl(var(--primary))", "Landing + Email": "hsl(152, 44%, 23%)", "Blog System": "hsl(38, 92%, 50%)" };
            const isSlotty = gen.tool_name.toLowerCase().includes("slotty");
            return (
              <Collapsible key={gen.id}>
                <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ borderLeftWidth: "4px", borderLeftColor: toolBorderColors[gen.tool_name] || "hsl(var(--primary))" }}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{toolIcons[gen.tool_name] || "⚙️"}</span>
                      <span className="font-semibold text-foreground">{gen.tool_name}</span>
                      <Badge variant={gen.status === "sent" ? "default" : "outline"} className="text-xs">
                        {gen.status === "sent" ? "✅ Enviado" : gen.status}
                      </Badge>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3">
                      {prompt.objective && <p className="text-sm text-muted-foreground"><strong>Objetivo:</strong> {prompt.objective}</p>}
                      {prompt.workspace_config && (
                        <Collapsible>
                          <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Ver configuración completa</CollapsibleTrigger>
                          <CollapsibleContent><pre className="text-xs bg-secondary/20 rounded-md p-3 mt-2 whitespace-pre-wrap overflow-auto max-h-64">{JSON.stringify(prompt.workspace_config, null, 2)}</pre></CollapsibleContent>
                        </Collapsible>
                      )}
                      {prompt.system_prompt && (
                        <Collapsible>
                          <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Ver prompt sistema</CollapsibleTrigger>
                          <CollapsibleContent><pre className="text-xs bg-secondary/20 rounded-md p-3 mt-2 whitespace-pre-wrap overflow-auto max-h-64">{prompt.system_prompt}</pre></CollapsibleContent>
                        </Collapsible>
                      )}
                      {prompt.landing_task_prompts && (
                        <Collapsible>
                          <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Ver tasks landing ({prompt.landing_task_prompts.length})</CollapsibleTrigger>
                          <CollapsibleContent><ul className="text-xs space-y-1 mt-2 pl-4 list-disc text-muted-foreground">{prompt.landing_task_prompts.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></CollapsibleContent>
                        </Collapsible>
                      )}
                      {prompt.email_sequence_prompts && (
                        <Collapsible>
                          <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Ver tasks email ({prompt.email_sequence_prompts.length})</CollapsibleTrigger>
                          <CollapsibleContent><ul className="text-xs space-y-1 mt-2 pl-4 list-disc text-muted-foreground">{prompt.email_sequence_prompts.map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></CollapsibleContent>
                        </Collapsible>
                      )}
                      {prompt.topics && <div className="text-sm"><strong className="text-foreground">Topics:</strong> <span className="text-muted-foreground">{prompt.topics.join(", ")}</span></div>}
                      {prompt.keyword_focus && <div className="text-sm"><strong className="text-foreground">Keywords:</strong> <span className="text-muted-foreground">{prompt.keyword_focus.join(", ")}</span></div>}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(prompt, null, 2)); toast.success("JSON copiado"); }}><Copy className="w-4 h-4 mr-1" /> Copiar JSON</Button>
                        {isSlotty && gen.status !== "sent" && <Button size="sm" onClick={() => onSendToSlotty(gen)}>Crear workspace en Slotty →</Button>}
                        {!isSlotty && gen.status !== "sent" && <Button size="sm" variant="outline" onClick={() => onMarkSent(gen.id)}>Marcar como enviado →</Button>}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {generatedPrompts && typeof generatedPrompts === "string" && !toolGenerations.length && (
        <div ref={promptsRef} className="bg-card rounded-lg border border-border p-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-foreground text-sm">Prompts (texto)</h3>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedPrompts); toast.success("Copied!"); }}>
              <Copy className="w-4 h-4 mr-1" /> Copy all
            </Button>
          </div>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap bg-secondary/20 rounded-lg p-4 border border-border text-xs">
            {generatedPrompts}
          </div>
        </div>
      )}

      {!generatedPrompts && !generating && toolGenerations.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-8 text-center space-y-2">
          <span className="text-4xl">📋</span>
          <h3 className="font-semibold text-foreground">No hay prompts generados</h3>
          <p className="text-sm text-muted-foreground">Completa los prerequisitos y haz click en "Generar Prompts"</p>
        </div>
      )}
    </div>
  );
}
