import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Loader2, Copy, Upload, CheckCircle2, Sparkles, RefreshCw,
  ChevronDown, ChevronUp, Building2, Calendar, Globe,
} from "lucide-react";
import AssetUploadZone from "@/components/kickoff/AssetUploadZone";
import { AssetFeedbackPanel } from "@/components/admin/AssetFeedbackPanel";
import ClientMaterials, { type ClientMaterialsData } from "@/components/kickoff/ClientMaterials";
import { ProposalView, type ProposalData } from "@/components/proposal/ProposalView";
import SalesCallCard from "@/components/prospect/SalesCallCard";
import { MARKETS } from "@/lib/briefing-data";

// ─── Types ───────────────────────────────────────────────
type Client = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  vertical: string;
  sub_niche: string;
  market: string;
  prospect_id: string | null;
  created_at: string;
};

type Prospect = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  vertical: string;
  sub_niche: string;
  market: string;
  status: string;
  briefing_answers: Record<string, any>;
  created_at: string;
  call_status: string;
  call_scheduled_at: string | null;
  call_notes: string | null;
  follow_up_date: string | null;
};

type KickoffBrief = {
  id: string;
  client_id: string;
  suggested_questions: any;
  transcript_text: string | null;
  transcript_status: string | null;
  audio_file_url: string | null;
  generated_prompts: any;
  pragma_approved: boolean | null;
};

type AssetRow = {
  id: string;
  asset_name: string;
  asset_type: string;
  status: string;
  file_url: string | null;
  content: any;
  version: number;
  client_comment: string | null;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────
const VERTICAL_COLORS: Record<string, string> = {
  "Salud & Estética": "hsl(220, 63%, 22%)",
  "E-Learning": "hsl(152, 44%, 23%)",
  "Deporte Offline": "hsl(282, 54%, 36%)",
};

function InfoRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm font-medium text-right max-w-[60%]">{display}</span>
    </div>
  );
}

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

function generateQuestions(vertical: string, subNiche: string): Record<string, string[]> {
  const base: Record<string, string[]> = {
    "Business & Offer Details": [
      "Describe your main service/product in one sentence.",
      "What's your unique selling proposition vs competitors?",
      "What's your average ticket / price point?",
      "Do you offer packages or individual services?",
      `What makes ${subNiche} your focus area?`,
    ],
    "Current Assets": [
      "Do you have existing brand guidelines (logo, colors, fonts)?",
      "Do you have professional photos of your team/space/products?",
      "Do you have any existing copy (website text, brochures)?",
      "Do you have existing email templates or sequences?",
      "What's your current website URL (if any)?",
    ],
    "Technical Setup": [
      "Do you have domain access for landing pages?",
      "What CRM or booking system do you currently use?",
      "Do you have a checkout or payment system?",
      "Do you have a WhatsApp Business number?",
      "Do you have Google Business Profile set up?",
    ],
    "Goals & KPIs": [
      "What's your primary goal for the first 3 months?",
      "How many new clients/sales do you want per month?",
      "What's your target revenue increase?",
      "What metrics are most important to you?",
      "Any seasonal peaks or events to plan around?",
    ],
    "Communication Preferences": [
      "What language/tone should we use in marketing materials?",
      "Who will be the main point of contact for approvals?",
      "How quickly can you review and approve assets?",
      "Do you prefer formal or casual communication?",
      "Any words or phrases you want us to always use or avoid?",
    ],
  };
  if (vertical.toLowerCase().includes("salud") || vertical.toLowerCase().includes("estética")) {
    base["Business & Offer Details"].push("What certifications or licenses do your practitioners hold?");
    base["Business & Offer Details"].push("Do you offer before/after consultations?");
  } else if (vertical.toLowerCase().includes("learning") || vertical.toLowerCase().includes("curso")) {
    base["Business & Offer Details"].push("What format are your courses (live, recorded, hybrid)?");
    base["Business & Offer Details"].push("Do you offer certifications or diplomas?");
  } else if (vertical.toLowerCase().includes("deporte") || vertical.toLowerCase().includes("sport")) {
    base["Business & Offer Details"].push("What sports/activities do you offer?");
    base["Business & Offer Details"].push("Do you have membership plans or pay-per-session?");
  }
  return base;
}

// ─── Main Component ──────────────────────────────────────
export default function AdminClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [kickoff, setKickoff] = useState<KickoffBrief | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  // Kickoff state
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());
  const [transcriptText, setTranscriptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [materials, setMaterials] = useState<ClientMaterialsData>({});
  const [generating, setGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<string | null>(null);
  const [contextSources, setContextSources] = useState<any>(null);
  const [showContextSources, setShowContextSources] = useState(false);
  const promptsRef = useRef<HTMLDivElement>(null);

  // Default tab
  const [defaultTab, setDefaultTab] = useState<string>("prospect");

  useEffect(() => {
    const fetchAll = async () => {
      // Fetch client
      const { data: clientData } = await supabase
        .from("clients").select("*").eq("id", id!).single();
      if (!clientData) { setLoading(false); return; }
      setClient(clientData as Client);

      // Parallel fetches
      const kickoffPromise = supabase.from("kickoff_briefs").select("*").eq("client_id", id!).maybeSingle();
      const assetsPromise = supabase.from("assets").select("id, asset_name, asset_type, status, file_url, content, version, client_comment, created_at").eq("client_id", id!);

      let prospectPromise: any = null;
      let proposalPromise: any = null;

      if (clientData.prospect_id) {
        prospectPromise = supabase.from("prospects").select("*").eq("id", clientData.prospect_id).single();
        proposalPromise = supabase.from("proposals").select("full_proposal_content").eq("prospect_id", clientData.prospect_id).maybeSingle();
      }

      const [kickoffRes, assetsRes] = await Promise.all([kickoffPromise, assetsPromise]);
      const kickoffData = kickoffRes.data;
      const assetsData = (assetsRes.data || []) as AssetRow[];

      if (kickoffData) {
        setKickoff(kickoffData as KickoffBrief);
        setTranscriptText(kickoffData.transcript_text || "");
        setMaterials((kickoffData as any).client_materials || {});
        const gp = kickoffData.generated_prompts as any;
        if (gp?.raw_text) {
          setGeneratedPrompts(gp.raw_text);
          if (gp.context_sources) setContextSources(gp.context_sources);
        }
      }

      setAssets(assetsData);

      if (prospectPromise && proposalPromise) {
        const [prospectRes, proposalRes] = await Promise.all([prospectPromise, proposalPromise]);
        if (prospectRes.data) setProspect(prospectRes.data as unknown as Prospect);
        if (proposalRes.data?.full_proposal_content) {
          setProposal(proposalRes.data.full_proposal_content as unknown as ProposalData);
        }
      }

      // Auto-select assets tab if pending feedback
      const hasChangeRequested = assetsData.some((a: any) => a.status === "change_requested");
      if (hasChangeRequested) setDefaultTab("assets");

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const questions = useMemo(
    () => client ? generateQuestions(client.vertical, client.sub_niche) : {},
    [client]
  );

  // ─── Kickoff handlers (same as before) ─────────────────
  const copyAllQuestions = () => {
    const text = Object.entries(questions)
      .map(([cat, qs]) => `## ${cat}\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Questions copied to clipboard!");
  };

  const toggleQuestion = (q: string) => {
    setCheckedQuestions((prev) => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  };

  const saveTranscript = async () => {
    if (!client) return;
    setSaving(true);
    try {
      if (kickoff) {
        await supabase.from("kickoff_briefs")
          .update({ transcript_text: transcriptText, transcript_status: "ready" as any })
          .eq("id", kickoff.id);
      } else {
        const { data } = await supabase.from("kickoff_briefs")
          .insert({ client_id: client.id, transcript_text: transcriptText, transcript_status: "ready" as any, suggested_questions: questions })
          .select().single();
        if (data) setKickoff(data as KickoffBrief);
      }
      toast.success("Transcript saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePrompts = async () => {
    if (!client) return;
    setGenerating(true);
    try {
      if (transcriptText.trim().length >= 50 && !kickoff) {
        await saveTranscript();
      } else if (kickoff && transcriptText !== (kickoff.transcript_text || "")) {
        await supabase.from("kickoff_briefs")
          .update({ transcript_text: transcriptText, transcript_status: "ready" as any })
          .eq("id", kickoff.id);
      }
      const { data, error } = await supabase.functions.invoke("generate-kickoff-prompts", {
        body: { client_id: client.id },
      });
      if (error) throw error;
      if (data?.prompts) {
        setGeneratedPrompts(data.prompts);
        if (data.context_sources) setContextSources(data.context_sources);
        toast.success("Prompts generated successfully!");
        setTimeout(() => promptsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        throw new Error(data?.error || "No prompts returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate prompts");
    } finally {
      setGenerating(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("File too large. Maximum 100MB."); return; }
    setUploadingAudio(true);
    try {
      const filePath = `kickoff/${client.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("kb-documents").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("kb-documents").getPublicUrl(filePath);
      if (kickoff) {
        await supabase.from("kickoff_briefs")
          .update({ audio_file_url: urlData.publicUrl, transcript_status: "pending" as any })
          .eq("id", kickoff.id);
      } else {
        const { data } = await supabase.from("kickoff_briefs")
          .insert({ client_id: client.id, audio_file_url: urlData.publicUrl, transcript_status: "pending" as any, suggested_questions: questions })
          .select().single();
        if (data) setKickoff(data as KickoffBrief);
      }
      toast.success("Audio uploaded! Transcription will be processed.");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleCallUpdate = (fields: Record<string, any>) => {
    if (!prospect) return;
    setProspect({ ...prospect, ...fields });
  };

  // ─── Badge counts ──────────────────────────────────────
  const kickoffBadge = !kickoff?.transcript_text;
  const changeRequestedCount = assets.filter((a) => a.status === "change_requested").length;

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!client) return <div className="p-8 text-muted-foreground">Client not found.</div>;

  const marketLabel = MARKETS.find((m) => m.value === client.market)?.label || client.market;
  const verticalColor = VERTICAL_COLORS[client.vertical] || "hsl(var(--primary))";
  const answers = prospect?.briefing_answers || {};
  const contractType = proposal?.pricing?.contract_type;

  // Asset status helpers for the table in Tab 3
  const getAssetStatus = (type: string) => {
    const matching = assets.filter((a) => a.asset_type === type);
    if (matching.length === 0) return "none";
    if (matching.some((a) => a.status === "change_requested")) return "change_requested";
    if (matching.some((a) => a.status === "pending_review")) return "pending_review";
    if (matching.every((a) => a.status === "approved")) return "approved";
    return "pending_review";
  };

  const assetStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return "✅";
      case "pending_review": return "⏳";
      case "change_requested": return "💬";
      default: return "—";
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Building2 className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">{client.company_name}</h1>
        <Badge style={{ backgroundColor: verticalColor }} className="text-white text-xs">
          {client.vertical}
        </Badge>
        <Badge variant="outline" className="text-xs">{marketLabel}</Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Client since {new Date(client.created_at).toLocaleDateString()}
        </span>
        {contractType && (
          <Badge variant="secondary" className="text-xs">{contractType}</Badge>
        )}
      </div>

      {/* ─── Tabs ───────────────────────────────────────── */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="sticky top-0 z-10 bg-background border-b border-border w-full justify-start rounded-none px-0 h-auto pb-0">
          <TabsTrigger
            value="prospect"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5"
          >
            Prospect Info
          </TabsTrigger>
          <TabsTrigger
            value="kickoff"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5 relative"
          >
            Kickoff
            {kickoffBadge && (
              <span className="ml-1.5 w-2 h-2 rounded-full bg-accent inline-block" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="prompts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5"
          >
            Prompts
          </TabsTrigger>
          <TabsTrigger
            value="assets"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[hsl(348,80%,52%)] data-[state=active]:text-foreground px-4 py-2.5 relative"
          >
            Assets
            {changeRequestedCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-4">
                {changeRequestedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 1 — Prospect Info                         */}
        {/* ═══════════════════════════════════════════════ */}
        <TabsContent value="prospect" className="mt-6 space-y-6">
          {prospect ? (
            <>
              {/* Briefing answers */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">About the Business</h3>
                <InfoRow label="Full name" value={prospect.name} />
                <InfoRow label="Company" value={prospect.company_name} />
                <InfoRow label="Email" value={prospect.email} />
                <InfoRow label="Phone" value={prospect.phone} />
                <InfoRow label="Market" value={marketLabel} />
                <InfoRow label="Vertical" value={prospect.vertical} />
                <InfoRow label="Sub-niche" value={prospect.sub_niche} />
              </div>

              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">Current Situation</h3>
                <InfoRow label="Years in operation" value={answers.years_in_operation} />
                <InfoRow label="Monthly new clients" value={answers.monthly_new_clients} />
                <InfoRow label="Client sources" value={answers.client_sources} />
                <InfoRow label="Runs paid ads" value={answers.runs_paid_ads} />
                <InfoRow label="Ad platforms" value={answers.ad_platforms} />
                <InfoRow label="Monthly budget" value={answers.monthly_budget} />
                <InfoRow label="Has email list" value={answers.has_email_list} />
                <InfoRow label="Email list size" value={answers.email_list_size} />
                <InfoRow label="Has website" value={answers.has_website} />
                <InfoRow label="Website URL" value={answers.website_url} />
                <InfoRow label="Uses CRM" value={answers.uses_crm} />
                <InfoRow label="CRM system" value={answers.crm_name} />
              </div>

              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">Goals</h3>
                <InfoRow label="Main goal" value={answers.main_goal} />
                <InfoRow label="Average ticket" value={answers.average_ticket ? `${answers.average_ticket} ${answers.ticket_currency || "EUR"}` : undefined} />
                <InfoRow label="Biggest challenge" value={answers.biggest_challenge} />
                <InfoRow label="Differentiator" value={answers.differentiator} />
                <InfoRow label="Additional info" value={answers.additional_info} />
              </div>

              {/* Proposal (read-only) */}
              {proposal && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground text-lg">Generated Proposal</h3>
                  <ProposalView data={proposal} editable={false} />
                </div>
              )}

              {/* Sales call info */}
              {prospect && (
                <SalesCallCard
                  prospectId={prospect.id}
                  callStatus={prospect.call_status as any}
                  callScheduledAt={prospect.call_scheduled_at}
                  callNotes={prospect.call_notes}
                  followUpDate={prospect.follow_up_date}
                  onUpdate={handleCallUpdate}
                />
              )}
            </>
          ) : (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
              No prospect data linked to this client.
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 2 — Kickoff                               */}
        {/* ═══════════════════════════════════════════════ */}
        <TabsContent value="kickoff" className="mt-6 space-y-6">
          {/* Section 1: Questions */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Kickoff Questions</h3>
              <Button variant="outline" size="sm" onClick={copyAllQuestions}>
                <Copy className="w-4 h-4 mr-2" />
                Copy all
              </Button>
            </div>
            <div className="space-y-6">
              {Object.entries(questions).map(([category, qs]) => (
                <div key={category}>
                  <h4 className="text-sm font-semibold text-foreground mb-2">{category}</h4>
                  <div className="space-y-2">
                    {qs.map((q) => (
                      <label key={q} className="flex items-start gap-3 p-2 rounded-md hover:bg-secondary/50 cursor-pointer">
                        <Checkbox checked={checkedQuestions.has(q)} onCheckedChange={() => toggleQuestion(q)} className="mt-0.5" />
                        <span className={`text-sm ${checkedQuestions.has(q) ? "text-muted-foreground line-through" : "text-foreground"}`}>{q}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Transcript */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Kickoff Transcript</h3>
            <Tabs defaultValue="text">
              <TabsList>
                <TabsTrigger value="text">Paste Text</TabsTrigger>
                <TabsTrigger value="audio">Upload Audio/Video</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                <Textarea
                  placeholder="Paste the call transcript here..."
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="min-h-[200px]"
                />
                {transcriptText.trim() && (
                  <Button onClick={saveTranscript} disabled={saving} className="mt-3">
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save Transcript
                  </Button>
                )}
              </TabsContent>
              <TabsContent value="audio" className="mt-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Upload .mp3, .mp4, .m4a, .wav, or .webm (max 100MB)</p>
                  <Input type="file" accept=".mp3,.mp4,.m4a,.wav,.webm" onChange={handleAudioUpload} disabled={uploadingAudio} className="max-w-xs mx-auto" />
                  {uploadingAudio && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  )}
                  {kickoff?.audio_file_url && (
                    <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-status-accepted" />
                      Audio file uploaded
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Section 3: Client Materials */}
          <ClientMaterials
            clientId={client.id}
            kickoffId={kickoff?.id || null}
            materials={materials}
            onMaterialsChange={setMaterials}
            onSave={async (m) => {
              if (kickoff) {
                await supabase.from("kickoff_briefs").update({ client_materials: m } as any).eq("id", kickoff.id);
              } else {
                const { data } = await supabase.from("kickoff_briefs").insert({
                  client_id: client.id, suggested_questions: questions, client_materials: m,
                } as any).select().single();
                if (data) setKickoff(data as KickoffBrief);
              }
            }}
          />
        </TabsContent>

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 3 — Prompts                               */}
        {/* ═══════════════════════════════════════════════ */}
        <TabsContent value="prompts" className="mt-6 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Generated Prompts
            </h3>

            <div className="mb-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        onClick={handleGeneratePrompts}
                        disabled={generating || transcriptText.trim().length < 50}
                        className={transcriptText.trim().length >= 50 && !generating
                          ? "bg-[hsl(142,71%,35%)] hover:bg-[hsl(142,71%,30%)] text-white"
                          : ""}
                      >
                        {generating ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Claude is analyzing...</>
                        ) : generatedPrompts ? (
                          <><RefreshCw className="w-4 h-4 mr-2" />Regenerate Prompts</>
                        ) : (
                          <><Sparkles className="w-4 h-4 mr-2" />Generate Prompts</>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {transcriptText.trim().length < 50 && (
                    <TooltipContent>
                      <p>Paste a transcript in the Kickoff tab first (min 50 characters)</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {contextSources && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowContextSources(!showContextSources)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showContextSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Context used for generation
                  </button>
                  {showContextSources && (
                    <div className="mt-2 p-3 rounded-md bg-secondary/50 text-xs space-y-1">
                      <ContextLine label="Transcript" included={contextSources.transcript} />
                      <ContextLine label="Briefing answers" included={contextSources.briefing_answers} />
                      <ContextLine label="Proposal" included={contextSources.proposal} />
                      <ContextLine label="Brand colors" included={contextSources.brand_colors} />
                      <ContextLine label="Brand personality" included={contextSources.brand_tags} />
                      <ContextLine label="Website analysis" included={contextSources.website_context} />
                      <ContextLine label="Pricing PDF" included={contextSources.pricing_pdf} />
                      <ContextLine label={`Photos${contextSources.photos?.count ? ` (${contextSources.photos.count} assets)` : ""}`} included={contextSources.photos?.included} />
                      <ContextLine label="Existing emails" included={contextSources.emails} />
                      <ContextLine label={`Social posts${contextSources.social_posts?.count ? ` (${contextSources.social_posts.count} posts)` : ""}`} included={contextSources.social_posts?.included} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {generatedPrompts && (
              <div ref={promptsRef}>
                <div className="flex justify-end mb-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedPrompts); toast.success("Copied!"); }}>
                    <Copy className="w-4 h-4 mr-2" />Copy all
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap bg-secondary/20 rounded-lg p-4 border border-border">
                  {generatedPrompts}
                </div>
              </div>
            )}

            {!generatedPrompts && !generating && (
              <p className="text-sm text-muted-foreground">No prompts generated yet. Add a transcript in the Kickoff tab and click Generate.</p>
            )}
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════ */}
        {/* TAB 4 — Assets                                */}
        {/* ═══════════════════════════════════════════════ */}
        <TabsContent value="assets" className="mt-6 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Asset Status</h3>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {(["landing_page", "email_flow", "social_post", "blog_article"] as const).map((type) => {
                const status = getAssetStatus(type);
                const labels: Record<string, string> = { landing_page: "LP", email_flow: "Email", social_post: "Social", blog_article: "Blog" };
                return (
                  <div key={type} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border">
                    <span>{assetStatusIcon(status)}</span>
                    <span className="text-sm text-foreground font-medium">{labels[type]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Client feedback on existing assets */}
          {assets.filter((a) => a.status === "change_requested" || a.client_comment).length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground text-lg">Client Feedback</h3>
              {assets
                .filter((a) => a.status === "change_requested" || a.client_comment)
                .map((asset) => (
                  <div key={asset.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{asset.asset_name}</span>
                      <span className="text-xs font-mono text-muted-foreground">v{asset.version || 1}</span>
                    </div>
                    <AssetFeedbackPanel
                      assetId={asset.id}
                      clientComment={asset.client_comment}
                      status={asset.status}
                      version={asset.version || 1}
                    />
                  </div>
                ))}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-foreground text-lg">Upload & Manage Assets</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <AssetUploadZone clientId={client.id} assetType="landing_page" onAssetSaved={() => {}} />
              <AssetUploadZone clientId={client.id} assetType="email_flow" onAssetSaved={() => {}} />
              <AssetUploadZone clientId={client.id} assetType="social_post" onAssetSaved={() => {}} />
              <AssetUploadZone clientId={client.id} assetType="blog_article" onAssetSaved={() => {}} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
