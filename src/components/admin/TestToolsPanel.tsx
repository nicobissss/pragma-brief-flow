import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FlaskConical, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isTestModeAvailable } from "@/lib/test-mode";
import {
  generateFakeTranscript,
  generateFakeKickoffBrief,
  generateFakeAssetRequestItems,
  generateFakeCampaignBrief,
} from "@/lib/test-fixtures";

type Mode = "prospect" | "client";

interface Props {
  mode: Mode;
  entityId: string;
  /** prospect/client minimal info */
  context: {
    name: string;
    company_name: string;
    vertical: string;
  };
  onAfterAction?: () => void;
}

export default function TestToolsPanel({ mode, entityId, context, onAfterAction }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!isTestModeAvailable()) return null;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      onAfterAction?.();
    } catch (e: any) {
      toast.error(e.message || "Errore TEST action");
    } finally {
      setBusy(null);
    }
  };

  // ───────── PROSPECT actions ─────────
  const fillTranscript = () =>
    run("transcript", async () => {
      const transcript = generateFakeTranscript(context.vertical, context.name, context.company_name);
      const { error } = await supabase
        .from("prospects")
        .update({ call_notes: transcript } as any)
        .eq("id", entityId);
      if (error) throw error;
      toast.success("🧪 TEST – Trascrizione fake inserita");
    });

  // ───────── CLIENT actions ─────────
  const fillKickoffBrief = () =>
    run("kickoff", async () => {
      const brief = generateFakeKickoffBrief(context.vertical);
      const { data: existing } = await supabase
        .from("kickoff_briefs")
        .select("id")
        .eq("client_id", entityId)
        .maybeSingle();
      const transcript = generateFakeTranscript(context.vertical, context.name, context.company_name);
      const payload = {
        client_id: entityId,
        structured_info: brief.structured_info,
        voice_reference: brief.voice_reference,
        preferred_tone: brief.preferred_tone,
        client_rules: brief.client_rules,
        transcript_text: transcript,
        transcript_status: "ready" as const,
        transcript_quality: "good",
      };
      const { error } = existing
        ? await supabase.from("kickoff_briefs").update(payload as any).eq("id", existing.id)
        : await supabase.from("kickoff_briefs").insert(payload as any);
      if (error) throw error;
      toast.success("🧪 TEST – Kickoff brief compilato");
    });

  const fillAssetRequests = () =>
    run("assets", async () => {
      const items = generateFakeAssetRequestItems();
      const { error } = await supabase.from("client_asset_requests").insert({
        client_id: entityId,
        status: "completed" as any,
        requested_items: items as any,
      });
      if (error) throw error;
      toast.success("🧪 TEST – Asset requests fake create");
    });

  const fillReviewAssets = () =>
    run("review", async () => {
      const samples = [
        { asset_name: "TEST – Email welcome", asset_type: "email" as any, content: { subject: "Bienvenida a TEST", body: "Contenido placeholder generado en TEST mode." } },
        { asset_name: "TEST – Reel script", asset_type: "reel" as any, content: { script: "Hook · Desarrollo · CTA – contenido TEST" } },
        { asset_name: "TEST – Landing copy", asset_type: "landing" as any, content: { headline: "Headline TEST", body: "Body TEST" } },
      ];
      const rows = samples.map((s) => ({
        client_id: entityId,
        asset_name: s.asset_name,
        asset_type: s.asset_type,
        status: "pending_review" as any,
        content: s.content as any,
      }));
      const { error } = await supabase.from("assets").insert(rows as any);
      if (error) throw error;
      toast.success("🧪 TEST – 3 asset di review create");
    });

  const fillCampaignBrief = () =>
    run("campaign", async () => {
      const brief = generateFakeCampaignBrief();
      const { error } = await supabase.from("campaigns").insert({
        client_id: entityId,
        name: `TEST – Campaign ${new Date().toLocaleDateString()}`,
        objective: brief.objective,
        target_audience: brief.target_audience,
        key_message: brief.key_message,
        timeline: brief.timeline,
        description: brief.description,
        status: "draft" as any,
      });
      if (error) throw error;
      toast.success("🧪 TEST – Campaign brief fake creato");
    });

  const approveAllPending = () =>
    run("approve-all", async () => {
      const { error, count } = await supabase
        .from("assets")
        .update({ status: "approved" as any }, { count: "exact" })
        .eq("client_id", entityId)
        .eq("status", "pending_review");
      if (error) throw error;
      toast.success(`Approvati ${count ?? 0} asset pending`);
    });

  const resetTestClient = () =>
    run("reset", async () => {
      const { data: client } = await supabase.from("clients").select("is_test").eq("id", entityId).maybeSingle();
      if (!client?.is_test) {
        toast.error("Solo clienti marcati TEST possono essere resettati");
        return;
      }
      await supabase.from("assets").delete().eq("client_id", entityId);
      await supabase.from("campaigns").delete().eq("client_id", entityId);
      await supabase.from("client_asset_requests").delete().eq("client_id", entityId);
      toast.success("Reset cliente TEST completato");
    });

  return (
    <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/50 mb-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <FlaskConical className="w-4 h-4" /> Test tools (solo dev/staging)
            </span>
            <ChevronDown className={`w-4 h-4 text-amber-900 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 pt-0">
          <div className="text-xs text-amber-900/80 mb-3">
            Strumenti per popolare {mode === "prospect" ? "il prospect" : "il cliente"} con dati fake e accelerare i test E2E.
            I bottoni con "🧪 TEST" iniettano dati finti. Gli altri eseguono azioni reali del flusso.
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "prospect" && (
              <Button size="sm" variant="outline" onClick={fillTranscript} disabled={busy !== null} className="border-amber-400">
                {busy === "transcript" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                🧪 TEST – Genera trascrizione fake
              </Button>
            )}
            {mode === "client" && (
              <>
                <Button size="sm" variant="outline" onClick={fillKickoffBrief} disabled={busy !== null} className="border-amber-400">
                  {busy === "kickoff" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                  🧪 TEST – Compila kickoff brief
                </Button>
                <Button size="sm" variant="outline" onClick={fillAssetRequests} disabled={busy !== null} className="border-amber-400">
                  {busy === "assets" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                  🧪 TEST – Popola asset requests
                </Button>
                <Button size="sm" variant="outline" onClick={fillReviewAssets} disabled={busy !== null} className="border-amber-400">
                  {busy === "review" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                  🧪 TEST – Genera 3 asset di review
                </Button>
                <Button size="sm" variant="outline" onClick={fillCampaignBrief} disabled={busy !== null} className="border-amber-400">
                  {busy === "campaign" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                  🧪 TEST – Compila campaign brief
                </Button>
                <div className="w-full h-px bg-amber-200 my-1" />
                <Button size="sm" variant="outline" onClick={approveAllPending} disabled={busy !== null}>
                  {busy === "approve-all" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Approva tutti gli asset pending
                </Button>
                <Button size="sm" variant="destructive" onClick={resetTestClient} disabled={busy !== null}>
                  {busy === "reset" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  Reset cliente TEST
                </Button>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
